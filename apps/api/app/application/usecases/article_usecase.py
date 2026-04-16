from datetime import datetime, timezone
import re
from uuid import uuid4

from fastapi import status

from app.core.errors import AppError
from app.infrastructure.repositories.article_repository import ArticleRepository
from app.models import Article, ArticleSegment, User
from app.schemas.article import (
    ArticleCreateResponse,
    ArticleDeleteResponse,
    ArticleCreateSegment,
    ArticleDetailResponse,
    ArticleReadingToken,
    ArticleDetailSegment,
    ArticleListItem,
    ArticleListResponse,
    ArticleUpdatePayload,
    ArticleUpdateResponse,
    DetectLanguageResponse,
    UploadBatchItem,
    UploadBatchOrderSuggestion,
    UploadBatchUncertainPair,
    UploadParseBatchResponse,
    UploadParseResponse,
)
from app.services.article_service import (
    ParsedArticleInput,
    ParsedUploadBatchInput,
    ParsedUploadFileInput,
    decode_cursor,
    encode_cursor,
    estimate_token_count,
    normalize_text,
    preview_text,
    split_segments,
)
from app.services.language_detection_service import detect_language
from app.services.ocr_order_service import OCROrderCandidate, suggest_ocr_image_order
from app.services.reading_service import build_segment_reading_tokens


def _not_found_error() -> AppError:
    return AppError(
        code="NOT_FOUND",
        message="Article not found.",
        status_code=status.HTTP_404_NOT_FOUND,
    )


def _article_locked_for_content_edit_error() -> AppError:
    return AppError(
        code="ARTICLE_EDIT_LOCKED",
        message="Article content/language cannot be changed after practice history exists.",
        status_code=status.HTTP_409_CONFLICT,
    )


def create_article(
    *,
    repository: ArticleRepository,
    current_user: User,
    parsed: ParsedArticleInput,
) -> ArticleCreateResponse:
    normalized_full_text = normalize_text(parsed.raw_text)
    detection = detect_language(normalized_full_text)
    segment_texts = split_segments(normalized_text=normalized_full_text)
    if not segment_texts:
        raise AppError(
            code="VALIDATION_ERROR",
            message="No valid segment generated from text.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    now = datetime.now(tz=timezone.utc)
    article = Article(
        id=f"art_{uuid4().hex[:12]}",
        user_id=current_user.id,
        title=parsed.title,
        language=parsed.language,
        raw_text=parsed.raw_text,
        normalized_text=normalized_full_text,
        source_type=parsed.source_type,
        created_at=now,
        updated_at=now,
    )

    segments: list[ArticleSegment] = []
    for idx, plain_text in enumerate(segment_texts, start=1):
        normalized_segment = normalize_text(plain_text)
        segments.append(
            ArticleSegment(
                id=f"seg_{uuid4().hex[:12]}",
                article_id=article.id,
                segment_order=idx,
                plain_text=plain_text,
                normalized_text=normalized_segment,
                token_count=estimate_token_count(normalized_segment),
                created_at=now,
            )
        )

    repository.create_article_with_segments(article=article, segments=segments)

    return ArticleCreateResponse(
        article_id=article.id,
        title=article.title,
        language=article.language,
        detected_language=detection.detected_language,
        detected_confidence=detection.confidence,
        detected_reliable=detection.reliable,
        detected_raw_language=detection.raw_language,
        segments=[
            ArticleCreateSegment(
                id=segment.id,
                order=segment.segment_order,
                preview=preview_text(segment.plain_text),
            )
            for segment in segments
        ],
    )


def detect_article_language(raw_text: str) -> DetectLanguageResponse:
    normalized_text = normalize_text(raw_text)
    if not normalized_text:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Input text is empty.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    detection = detect_language(normalized_text)
    return DetectLanguageResponse(
        detected_language=detection.detected_language,
        detected_confidence=detection.confidence,
        detected_reliable=detection.reliable,
        detected_raw_language=detection.raw_language,
        text_length=len(normalized_text),
    )


def parse_uploaded_file(parsed: ParsedUploadFileInput) -> UploadParseResponse:
    normalized_text = normalize_text(parsed.raw_text)
    if not normalized_text:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Uploaded file does not contain valid text.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    detection = detect_language(normalized_text)
    return UploadParseResponse(
        text=normalized_text,
        source_type=parsed.source_type,
        detected_language=detection.detected_language,
        detected_confidence=detection.confidence,
        detected_reliable=detection.reliable,
        detected_raw_language=detection.raw_language,
        text_length=len(normalized_text),
    )


def _extract_page_marker_candidates(text: str) -> list[str]:
    patterns = [
        r"(?:^|\s)(?:\u7b2c\s*\d+\s*\u9875)",
        r"(?:^|\s)(?:page\s*\d+)",
        r"(?:^|\s)(?:p\.\s*\d+)",
        r"(?:^|\s)(?:chapter\s*\d+)",
        r"(?:^|\s)(?:section\s*\d+)",
    ]
    found: list[str] = []
    lowered = text.lower()
    for pattern in patterns:
        for match in re.findall(pattern, lowered, flags=re.IGNORECASE):
            value = str(match).strip()
            if value and value not in found:
                found.append(value)
            if len(found) >= 5:
                return found
    return found


def parse_uploaded_files(parsed: ParsedUploadBatchInput) -> UploadParseBatchResponse:
    normalized_items: list[tuple[str, str, str, object]] = []
    order_candidates: list[OCROrderCandidate] = []
    for item in parsed.files:
        normalized_text = normalize_text(item.raw_text)
        if not normalized_text:
            raise AppError(
                code="VALIDATION_ERROR",
                message=f"Uploaded file does not contain valid text: {item.filename}.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        detection = detect_language(normalized_text)
        page_markers = _extract_page_marker_candidates(normalized_text)
        normalized_items.append((item.image_id, item.filename, normalized_text, detection))
        order_candidates.append(
            OCROrderCandidate(
                image_id=item.image_id,
                filename=item.filename,
                captured_at=None,
                ocr_text_head=normalized_text[:180],
                ocr_text_tail=normalized_text[-180:],
                page_marker_candidates=page_markers,
                quality_flags=[],
            )
        )

    suggestion = suggest_ocr_image_order(
        candidates=order_candidates,
        language_hint=parsed.language,
    )
    ordered_position = {
        image_id: index + 1 for index, image_id in enumerate(suggestion.ordered_image_ids)
    }
    items_response: list[UploadBatchItem] = []
    page_marker_by_id = {
        candidate.image_id: candidate.page_marker_candidates for candidate in order_candidates
    }
    for image_id, filename, normalized_text, detection in normalized_items:
        items_response.append(
            UploadBatchItem(
                image_id=image_id,
                filename=filename,
                source_type="ocr",
                text=normalized_text,
                text_length=len(normalized_text),
                detected_language=detection.detected_language,
                detected_confidence=detection.confidence,
                detected_reliable=detection.reliable,
                detected_raw_language=detection.raw_language,
                page_marker_candidates=page_marker_by_id.get(image_id, []),
                warnings=[],
                suggested_order=ordered_position.get(image_id, 9999),
            )
        )

    items_response.sort(key=lambda item: item.suggested_order)
    return UploadParseBatchResponse(
        items=items_response,
        order_suggestion=UploadBatchOrderSuggestion(
            ordered_image_ids=suggestion.ordered_image_ids,
            overall_confidence=suggestion.overall_confidence,
            reasoning_signals=suggestion.reasoning_signals,
            uncertain_pairs=[
                UploadBatchUncertainPair(
                    left=pair.left,
                    right=pair.right,
                    confidence=pair.confidence,
                )
                for pair in suggestion.uncertain_pairs
            ],
            warnings=suggestion.warnings,
            fallback_used=suggestion.fallback_used,
        ),
        need_manual_confirm=True,
    )


def get_article_detail(
    *,
    repository: ArticleRepository,
    current_user: User,
    article_id: str,
    include_reading: bool = False,
) -> ArticleDetailResponse:
    article = repository.get_article_by_id_for_user(article_id=article_id, user_id=current_user.id)
    if article is None:
        raise _not_found_error()

    segments = repository.list_segments_by_article_id(article_id=article.id)
    return ArticleDetailResponse(
        article_id=article.id,
        title=article.title,
        language=article.language,
        source_type=article.source_type,
        raw_text=article.raw_text,
        normalized_text=article.normalized_text,
        segments=[
            ArticleDetailSegment(
                id=segment.id,
                order=segment.segment_order,
                plain_text=segment.plain_text,
                token_count=segment.token_count,
                tokens=(
                    [
                        ArticleReadingToken(surface=token.surface, yomi=token.yomi)
                        for token in build_segment_reading_tokens(
                            text=segment.plain_text,
                            language=article.language,
                        )
                    ]
                    if include_reading and article.language in {"ja", "zh"}
                    else None
                ),
            )
            for segment in segments
        ],
        created_at=article.created_at,
    )


def list_articles(
    *,
    repository: ArticleRepository,
    current_user: User,
    limit: int,
    cursor: str | None,
) -> ArticleListResponse:
    cursor_position = decode_cursor(cursor) if cursor else None
    rows, has_more = repository.list_articles_with_segment_count(
        user_id=current_user.id,
        limit=limit,
        cursor=cursor_position,
    )

    items = [
        ArticleListItem(
            article_id=article.id,
            title=article.title,
            language=article.language,
            segment_count=int(segment_count),
            created_at=article.created_at,
        )
        for article, segment_count in rows
    ]

    next_cursor = None
    if has_more and rows:
        last_article = rows[-1][0]
        next_cursor = encode_cursor(last_article.created_at, last_article.id)

    return ArticleListResponse(items=items, next_cursor=next_cursor)


def update_article(
    *,
    repository: ArticleRepository,
    current_user: User,
    article_id: str,
    payload: ArticleUpdatePayload,
) -> ArticleUpdateResponse:
    article = repository.get_article_by_id_for_user(article_id=article_id, user_id=current_user.id)
    if article is None:
        raise _not_found_error()

    next_title = article.title
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise AppError(
                code="VALIDATION_ERROR",
                message="Title is required.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        next_title = title

    text_updated = False
    now = datetime.now(tz=timezone.utc)
    if payload.text is None and payload.language is None:
        repository.update_article_title(article=article, title=next_title, updated_at=now)
        segments = repository.list_segments_by_article_id(article_id=article.id)
        return ArticleUpdateResponse(
            article_id=article.id,
            title=next_title,
            language=article.language,
            segment_count=len(segments),
            text_updated=False,
            updated_at=now,
        )

    history_count = repository.count_practice_history_for_article(article_id=article.id, user_id=current_user.id)
    if history_count > 0:
        raise _article_locked_for_content_edit_error()

    next_language = payload.language or article.language
    if next_language not in {"ja", "en", "zh"}:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Unsupported language.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    source_text = payload.text if payload.text is not None else article.raw_text
    normalized_full_text = normalize_text(source_text)
    if not normalized_full_text:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Article text is empty.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    segment_texts = split_segments(normalized_text=normalized_full_text)
    if not segment_texts:
        raise AppError(
            code="VALIDATION_ERROR",
            message="No valid segment generated from text.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    segments: list[ArticleSegment] = []
    for idx, plain_text in enumerate(segment_texts, start=1):
        normalized_segment = normalize_text(plain_text)
        segments.append(
            ArticleSegment(
                id=f"seg_{uuid4().hex[:12]}",
                article_id=article.id,
                segment_order=idx,
                plain_text=plain_text,
                normalized_text=normalized_segment,
                token_count=estimate_token_count(normalized_segment),
                created_at=now,
            )
        )

    repository.replace_article_content(
        article=article,
        language=next_language,
        raw_text=source_text,
        normalized_text=normalized_full_text,
        segments=segments,
        updated_at=now,
    )
    article.title = next_title
    repository.update_article_title(article=article, title=next_title, updated_at=now)
    text_updated = True

    return ArticleUpdateResponse(
        article_id=article.id,
        title=next_title,
        language=next_language,
        segment_count=len(segments),
        text_updated=text_updated,
        updated_at=now,
    )


def delete_article(
    *,
    repository: ArticleRepository,
    current_user: User,
    article_id: str,
) -> ArticleDeleteResponse:
    article = repository.get_article_by_id_for_user_including_deleted(article_id=article_id, user_id=current_user.id)
    if article is None:
        raise _not_found_error()
    if article.deleted_at is not None:
        return ArticleDeleteResponse(
            article_id=article.id,
            deleted_at=article.deleted_at,
            status="deleted",
        )
    deleted_at = datetime.now(tz=timezone.utc)
    repository.soft_delete_article(article=article, deleted_at=deleted_at)
    return ArticleDeleteResponse(
        article_id=article.id,
        deleted_at=deleted_at,
        status="deleted",
    )

