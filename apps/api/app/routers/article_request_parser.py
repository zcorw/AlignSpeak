import asyncio

from fastapi import Request, status
from pydantic import ValidationError
from starlette.datastructures import UploadFile
from uuid import uuid4

from app.core.config import settings
from app.core.errors import AppError
from app.schemas.article import CreateArticlePayload, DetectLanguagePayload
from app.services.article_service import (
    ParsedArticleInput,
    ParsedUploadBatchFileInput,
    ParsedUploadBatchInput,
    ParsedUploadFileInput,
    decode_uploaded_text,
    detect_source_type_by_filename,
    extract_text_from_image,
    normalize_text,
    validate_article_input,
)


def _as_str(value: object | None) -> str:
    return str(value).strip() if value is not None else ""


async def _extract_batch_ocr_texts(
    *,
    files: list[tuple[str, bytes]],
    language: str,
) -> list[str]:
    concurrency = max(1, int(settings.ocr_batch_max_concurrency))
    semaphore = asyncio.Semaphore(concurrency)

    async def _worker(filename: str, content: bytes) -> str:
        async with semaphore:
            text = await asyncio.to_thread(
                extract_text_from_image,
                filename=filename,
                content=content,
                language=language,
            )
        if not normalize_text(text):
            raise AppError(
                code="OCR_EMPTY_TEXT",
                message=f"OCR did not extract any valid text from {filename or 'image'}.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        return text

    tasks = [_worker(filename, content) for filename, content in files]
    return await asyncio.gather(*tasks)


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


async def parse_upload_files_input(request: Request) -> ParsedUploadBatchInput:
    content_type = (request.headers.get("content-type") or "").lower()
    if not content_type.startswith("multipart/form-data"):
        raise AppError(
            code="VALIDATION_ERROR",
            message="Batch upload parsing only supports multipart/form-data.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    form = await request.form()
    language = _as_str(form.get("language"))
    file_values = form.getlist("files")
    if not file_values:
        single_file = form.get("file")
        if isinstance(single_file, UploadFile):
            file_values = [single_file]

    upload_files = [item for item in file_values if isinstance(item, UploadFile)]
    if len(upload_files) < 2:
        raise AppError(
            code="VALIDATION_ERROR",
            message="At least two image files are required for batch upload parsing.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    prepared_files: list[tuple[str, str, bytes]] = []
    for upload_file in upload_files:
        filename = upload_file.filename or ""
        content = await upload_file.read()
        if not content:
            raise AppError(
                code="VALIDATION_ERROR",
                message=f"Uploaded file is empty: {filename or 'unknown'}.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        source_type = detect_source_type_by_filename(filename)
        if source_type != "ocr":
            raise AppError(
                code="VALIDATION_ERROR",
                message="Batch upload parsing only supports image files.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        prepared_files.append((f"img_{uuid4().hex[:10]}", filename or "image", content))

    extracted_texts = await _extract_batch_ocr_texts(
        files=[(filename, content) for _, filename, content in prepared_files],
        language=language,
    )

    parsed_files: list[ParsedUploadBatchFileInput] = []
    for (image_id, filename, _), text in zip(prepared_files, extracted_texts, strict=True):
        parsed_files.append(
            ParsedUploadBatchFileInput(
                image_id=image_id,
                filename=filename,
                language=language,
                source_type="ocr",
                raw_text=text,
            )
        )

    return ParsedUploadBatchInput(
        language=language,
        files=parsed_files,
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
