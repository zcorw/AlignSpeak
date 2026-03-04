from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import ValidationError
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile

from app.core.errors import AppError
from app.db import get_db
from app.deps import get_current_user
from app.models import Article, ArticleSegment, User
from app.schemas.article import (
    ArticleCreateResponse,
    ArticleCreateSegment,
    ArticleDetailResponse,
    ArticleDetailSegment,
    ArticleListItem,
    ArticleListResponse,
    CreateArticlePayload,
    DetectLanguagePayload,
    DetectLanguageResponse,
)
from app.services.article_service import (
    ParsedArticleInput,
    decode_cursor,
    decode_uploaded_text,
    encode_cursor,
    estimate_token_count,
    extract_text_from_image,
    normalize_text,
    preview_text,
    split_segments,
    validate_article_input,
)
from app.services.language_detection_service import detect_language

router = APIRouter(prefix="/articles", tags=["articles"])


def _not_found_error() -> AppError:
    return AppError(
        code="NOT_FOUND",
        message="Article not found.",
        status_code=status.HTTP_404_NOT_FOUND,
    )


def _as_str(value: object | None) -> str:
    return str(value).strip() if value is not None else ""


def _validate_json_payload(payload: dict) -> ParsedArticleInput:
    try:
        parsed = CreateArticlePayload.model_validate(payload)
    except ValidationError as exc:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Invalid article payload.",
            status_code=status.HTTP_400_BAD_REQUEST,
        ) from exc

    if parsed.source_type != "manual":
        raise AppError(
            code="VALIDATION_ERROR",
            message="JSON payload only supports source_type=manual.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    return validate_article_input(
        ParsedArticleInput(
            title=parsed.title,
            language=parsed.language,
            source_type=parsed.source_type,
            raw_text=parsed.text,
        )
    )


async def _parse_multipart_payload(request: Request) -> ParsedArticleInput:
    form = await request.form()
    title = _as_str(form.get("title"))
    language = _as_str(form.get("language"))
    source_type = _as_str(form.get("source_type"))
    file_value = form.get("file")

    if not isinstance(file_value, UploadFile):
        raise AppError(
            code="VALIDATION_ERROR",
            message="File is required for multipart payload.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    filename = file_value.filename or ""
    content = await file_value.read()
    if not content:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Uploaded file is empty.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if source_type == "upload":
        text = decode_uploaded_text(filename=filename, content=content)
    elif source_type == "ocr":
        text = extract_text_from_image(filename=filename, content=content, language=language)
        if not normalize_text(text):
            raise AppError(
                code="OCR_EMPTY_TEXT",
                message="OCR did not extract any valid text.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
    else:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Multipart payload supports source_type=upload|ocr.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    return validate_article_input(
        ParsedArticleInput(
            title=title,
            language=language,
            source_type=source_type,
            raw_text=text,
        )
    )


async def _parse_create_article_input(request: Request) -> ParsedArticleInput:
    content_type = (request.headers.get("content-type") or "").lower()

    if content_type.startswith("application/json"):
        try:
            payload = await request.json()
        except Exception as exc:
            raise AppError(
                code="VALIDATION_ERROR",
                message="Invalid JSON payload.",
                status_code=status.HTTP_400_BAD_REQUEST,
            ) from exc
        if not isinstance(payload, dict):
            raise AppError(
                code="VALIDATION_ERROR",
                message="JSON payload must be an object.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        return _validate_json_payload(payload=payload)

    if content_type.startswith("multipart/form-data"):
        return await _parse_multipart_payload(request=request)

    raise AppError(
        code="VALIDATION_ERROR",
        message="Unsupported content type.",
        status_code=status.HTTP_400_BAD_REQUEST,
    )


def _extract_best_ocr_text(filename: str, content: bytes) -> str:
    best_text = ""
    for language in ("ja", "en", "zh"):
        candidate = extract_text_from_image(filename=filename, content=content, language=language)
        if len(normalize_text(candidate)) > len(normalize_text(best_text)):
            best_text = candidate
    return best_text


async def _parse_detect_language_text(request: Request) -> str:
    content_type = (request.headers.get("content-type") or "").lower()

    if content_type.startswith("application/json"):
        try:
            payload = await request.json()
        except Exception as exc:
            raise AppError(
                code="VALIDATION_ERROR",
                message="Invalid JSON payload.",
                status_code=status.HTTP_400_BAD_REQUEST,
            ) from exc
        if not isinstance(payload, dict):
            raise AppError(
                code="VALIDATION_ERROR",
                message="JSON payload must be an object.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            parsed = DetectLanguagePayload.model_validate(payload)
        except ValidationError as exc:
            raise AppError(
                code="VALIDATION_ERROR",
                message="Invalid language detection payload.",
                status_code=status.HTTP_400_BAD_REQUEST,
            ) from exc
        return parsed.text

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        source_type = _as_str(form.get("source_type"))
        file_value = form.get("file")
        if not isinstance(file_value, UploadFile):
            raise AppError(
                code="VALIDATION_ERROR",
                message="File is required for multipart payload.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        filename = file_value.filename or ""
        content = await file_value.read()
        if not content:
            raise AppError(
                code="VALIDATION_ERROR",
                message="Uploaded file is empty.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if source_type == "upload":
            return decode_uploaded_text(filename=filename, content=content)
        if source_type == "ocr":
            text = _extract_best_ocr_text(filename=filename, content=content)
            if not normalize_text(text):
                raise AppError(
                    code="OCR_EMPTY_TEXT",
                    message="OCR did not extract any valid text.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            return text

        raise AppError(
            code="VALIDATION_ERROR",
            message="Multipart payload supports source_type=upload|ocr.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    raise AppError(
        code="VALIDATION_ERROR",
        message="Unsupported content type.",
        status_code=status.HTTP_400_BAD_REQUEST,
    )


@router.post("", response_model=ArticleCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ArticleCreateResponse:
    parsed = await _parse_create_article_input(request=request)
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
    db.add(article)

    segments: list[ArticleSegment] = []
    for idx, plain_text in enumerate(segment_texts, start=1):
        normalized_segment = normalize_text(plain_text)
        segment = ArticleSegment(
            id=f"seg_{uuid4().hex[:12]}",
            article_id=article.id,
            segment_order=idx,
            plain_text=plain_text,
            normalized_text=normalized_segment,
            token_count=estimate_token_count(normalized_segment),
            created_at=now,
        )
        db.add(segment)
        segments.append(segment)

    db.commit()

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


@router.post("/detect-language", response_model=DetectLanguageResponse)
async def detect_article_language(
    request: Request,
    _current_user: User = Depends(get_current_user),
) -> DetectLanguageResponse:
    raw_text = await _parse_detect_language_text(request=request)
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


@router.get("/{article_id}", response_model=ArticleDetailResponse)
def get_article(
    article_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ArticleDetailResponse:
    article = db.scalar(
        select(Article).where(
            and_(
                Article.id == article_id,
                Article.user_id == current_user.id,
            )
        )
    )
    if article is None:
        raise _not_found_error()

    segments = db.scalars(
        select(ArticleSegment)
        .where(ArticleSegment.article_id == article.id)
        .order_by(ArticleSegment.segment_order.asc())
    ).all()

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


@router.get("", response_model=ArticleListResponse)
def list_articles(
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ArticleListResponse:
    segment_count_subquery = (
        select(
            ArticleSegment.article_id.label("article_id"),
            func.count(ArticleSegment.id).label("segment_count"),
        )
        .group_by(ArticleSegment.article_id)
        .subquery()
    )

    statement = (
        select(
            Article,
            func.coalesce(segment_count_subquery.c.segment_count, 0).label("segment_count"),
        )
        .outerjoin(segment_count_subquery, segment_count_subquery.c.article_id == Article.id)
        .where(Article.user_id == current_user.id)
        .order_by(Article.created_at.desc(), Article.id.desc())
    )

    if cursor:
        position = decode_cursor(cursor)
        statement = statement.where(
            or_(
                Article.created_at < position.created_at,
                and_(
                    Article.created_at == position.created_at,
                    Article.id < position.article_id,
                ),
            )
        )

    rows = db.execute(statement.limit(limit + 1)).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

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
