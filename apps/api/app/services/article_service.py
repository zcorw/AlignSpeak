import base64
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from fastapi import status

from app.core.errors import AppError
from app.services.ocr_service import extract_text_from_image_by_provider

SUPPORTED_LANGUAGES = {"ja", "en", "zh"}
SUPPORTED_SOURCE_TYPES = {"manual", "upload", "ocr"}
SUPPORTED_UPLOAD_EXTENSIONS = {".txt", ".md"}
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
MAX_ARTICLE_TEXT_LENGTH = 20_000


@dataclass
class ParsedArticleInput:
    title: str
    language: str
    source_type: str
    raw_text: str


@dataclass
class ParsedUploadFileInput:
    language: str
    source_type: str
    raw_text: str


@dataclass
class ParsedUploadBatchFileInput:
    image_id: str
    filename: str
    language: str
    source_type: str
    raw_text: str


@dataclass
class ParsedUploadBatchInput:
    language: str
    files: list[ParsedUploadBatchFileInput]


@dataclass
class CursorPosition:
    created_at: datetime
    article_id: str


def normalize_text(text: str) -> str:
    unified = text.replace("\r\n", "\n").replace("\r", "\n")
    unified = "\n".join(line.rstrip() for line in unified.split("\n"))
    unified = re.sub(r"\n{3,}", "\n\n", unified)
    return unified.strip()


def validate_article_input(payload: ParsedArticleInput) -> ParsedArticleInput:
    title = payload.title.strip()
    if not title:
        raise AppError("VALIDATION_ERROR", "Title is required.", status.HTTP_400_BAD_REQUEST)
    if len(title) > 200:
        raise AppError("VALIDATION_ERROR", "Title is too long.", status.HTTP_400_BAD_REQUEST)
    if payload.language not in SUPPORTED_LANGUAGES:
        raise AppError("VALIDATION_ERROR", "Unsupported language.", status.HTTP_400_BAD_REQUEST)
    if payload.source_type not in SUPPORTED_SOURCE_TYPES:
        raise AppError("VALIDATION_ERROR", "Unsupported source type.", status.HTTP_400_BAD_REQUEST)

    normalized = normalize_text(payload.raw_text)
    if not normalized:
        raise AppError("VALIDATION_ERROR", "Article text is empty.", status.HTTP_400_BAD_REQUEST)
    if len(normalized) > MAX_ARTICLE_TEXT_LENGTH:
        raise AppError("ARTICLE_TOO_LONG", "Article text exceeds maximum length.", status.HTTP_400_BAD_REQUEST)

    return ParsedArticleInput(
        title=title,
        language=payload.language,
        source_type=payload.source_type,
        raw_text=payload.raw_text,
    )


def split_segments(normalized_text: str) -> list[str]:
    segments = [part.strip() for part in re.split(r"\n\s*\n+", normalized_text) if part.strip()]
    if not segments and normalized_text.strip():
        return [normalized_text.strip()]
    return segments


def estimate_token_count(text: str) -> int:
    token_matches = re.findall(r"\S+", text)
    return len(token_matches)


def preview_text(text: str, max_chars: int = 40) -> str:
    text = text.strip()
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}..."


def decode_uploaded_text(filename: str, content: bytes) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_UPLOAD_EXTENSIONS:
        raise AppError("UNSUPPORTED_FILE_TYPE", "Unsupported text file type.", status.HTTP_400_BAD_REQUEST)
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise AppError("VALIDATION_ERROR", "Text file must be UTF-8 encoded.", status.HTTP_400_BAD_REQUEST) from exc


def detect_source_type_by_filename(filename: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension in SUPPORTED_UPLOAD_EXTENSIONS:
        return "upload"
    if extension in SUPPORTED_IMAGE_EXTENSIONS:
        return "ocr"
    raise AppError("UNSUPPORTED_FILE_TYPE", "Unsupported file type.", status.HTTP_400_BAD_REQUEST)


def extract_text_from_image(filename: str, content: bytes, language: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_IMAGE_EXTENSIONS:
        raise AppError("UNSUPPORTED_FILE_TYPE", "Unsupported image file type.", status.HTTP_400_BAD_REQUEST)
    return extract_text_from_image_by_provider(filename=filename, content=content, language=language)


def encode_cursor(created_at: datetime, article_id: str) -> str:
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    payload = f"{created_at.isoformat()}|{article_id}"
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8")


def decode_cursor(cursor: str) -> CursorPosition:
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
        raw_created_at, article_id = decoded.split("|", 1)
        created_at = datetime.fromisoformat(raw_created_at)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return CursorPosition(created_at=created_at, article_id=article_id)
    except Exception as exc:
        raise AppError("VALIDATION_ERROR", "Invalid cursor.", status.HTTP_400_BAD_REQUEST) from exc
