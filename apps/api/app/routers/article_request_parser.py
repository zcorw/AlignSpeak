from fastapi import Request, status
from pydantic import ValidationError
from starlette.datastructures import UploadFile

from app.core.errors import AppError
from app.schemas.article import CreateArticlePayload, DetectLanguagePayload
from app.services.article_service import (
    ParsedArticleInput,
    ParsedUploadFileInput,
    decode_uploaded_text,
    detect_source_type_by_filename,
    extract_text_from_image,
    normalize_text,
    validate_article_input,
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

    return validate_article_input(
        ParsedArticleInput(
            title=parsed.title,
            language=parsed.language,
            source_type="manual",
            raw_text=parsed.text,
        )
    )


async def _parse_multipart_payload(request: Request) -> ParsedArticleInput:
    form = await request.form()
    title = _as_str(form.get("title"))
    language = _as_str(form.get("language"))
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

    source_type = detect_source_type_by_filename(filename)

    if source_type == "upload":
        text = decode_uploaded_text(filename=filename, content=content)
    else:
        text = extract_text_from_image(filename=filename, content=content, language=language)
        if not normalize_text(text):
            raise AppError(
                code="OCR_EMPTY_TEXT",
                message="OCR did not extract any valid text.",
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


async def parse_upload_file_input(request: Request) -> ParsedUploadFileInput:
    content_type = (request.headers.get("content-type") or "").lower()
    if not content_type.startswith("multipart/form-data"):
        raise AppError(
            code="VALIDATION_ERROR",
            message="Upload parsing only supports multipart/form-data.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    form = await request.form()
    language = _as_str(form.get("language"))
    file_value = form.get("file")

    if not isinstance(file_value, UploadFile):
        raise AppError(
            code="VALIDATION_ERROR",
            message="File is required for upload parsing.",
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

    source_type = detect_source_type_by_filename(filename)
    if source_type == "upload":
        text = decode_uploaded_text(filename=filename, content=content)
    else:
        text = extract_text_from_image(filename=filename, content=content, language=language)
        if not normalize_text(text):
            raise AppError(
                code="OCR_EMPTY_TEXT",
                message="OCR did not extract any valid text.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

    return ParsedUploadFileInput(
        language=language,
        source_type=source_type,
        raw_text=text,
    )


async def parse_create_article_input(request: Request) -> ParsedArticleInput:
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


async def parse_detect_language_text(request: Request) -> str:
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

    raise AppError(
        code="VALIDATION_ERROR",
        message="Language detection only supports application/json with text.",
        status_code=status.HTTP_400_BAD_REQUEST,
    )
