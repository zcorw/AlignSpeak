from datetime import datetime, timezone
from uuid import uuid4

from fastapi import status

from app.core.errors import AppError
from app.infrastructure.repositories.article_repository import ArticleRepository
from app.models import Article, ArticleSegment, User
from app.schemas.article import (
    ArticleCreateResponse,
    ArticleCreateSegment,
    ArticleDetailResponse,
    ArticleDetailSegment,
    ArticleListItem,
    ArticleListResponse,
    DetectLanguageResponse,
    UploadParseResponse,
)
from app.services.article_service import (
    ParsedArticleInput,
    ParsedUploadFileInput,
    decode_cursor,
    encode_cursor,
    estimate_token_count,
    normalize_text,
    preview_text,
    split_segments,
)
from app.services.language_detection_service import detect_language


def _not_found_error() -> AppError:
    return AppError(
        code="NOT_FOUND",
        message="Article not found.",
        status_code=status.HTTP_404_NOT_FOUND,
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


def get_article_detail(
    *,
    repository: ArticleRepository,
    current_user: User,
    article_id: str,
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
