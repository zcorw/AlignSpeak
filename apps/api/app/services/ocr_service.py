import base64
from functools import lru_cache
from io import BytesIO
import logging
from pathlib import Path
from typing import Protocol

import httpx
from fastapi import status

from app.core.config import settings
from app.core.errors import AppError
from app.db import SessionLocal
from app.infrastructure.repositories.openai_usage_repository import OpenAIUsageRepository
from app.services.openai_usage_service import OpenAIUsageContext, enforce_budget_or_raise, record_openai_usage_event

logger = logging.getLogger(__name__)


class OCRProvider(Protocol):
    def extract_text(self, *, filename: str, content: bytes, language: str) -> str:
        ...


class TesseractOCRProvider:
    def extract_text(self, *, filename: str, content: bytes, language: str) -> str:
        try:
            from PIL import Image  # type: ignore
            import pytesseract  # type: ignore
        except Exception:
            return ""

        try:
            lang_map = {
                "en": "eng",
                "ja": "jpn",
                "zh": "chi_sim",
            }
            tesseract_lang = lang_map.get(language, "eng")
            image = Image.open(BytesIO(content))
            return str(pytesseract.image_to_string(image, lang=tesseract_lang))
        except Exception:
            return ""


class OpenAIOCRProvider:
    def __init__(self, *, api_key: str, model: str, base_url: str, timeout_seconds: float) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def extract_text(self, *, filename: str, content: bytes, language: str) -> str:
        usage_context = OpenAIUsageContext(
            module="ocr",
            provider="openai",
            model=self.model,
        )
        _enforce_openai_budget_for_ocr(usage_context=usage_context)

        extension = Path(filename).suffix.lower()
        mime_type_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
        }
        mime_type = mime_type_map.get(extension, "image/jpeg")
        encoded = base64.b64encode(content).decode("utf-8")
        image_url = f"data:{mime_type};base64,{encoded}"

        language_hint_map = {
            "en": "English",
            "ja": "Japanese",
            "zh": "Simplified Chinese",
        }
        language_hint = language_hint_map.get(language, "the likely language in the image")
        prompt = (
            "Extract the article text from this image.\n"
            f"Primary language hint: {language_hint}.\n"
            "Return plain text only.\n"
            "Preserve paragraph breaks.\n"
            "Do not add explanations or markdown."
        )

        payload = {
            "model": self.model,
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        {"type": "input_image", "image_url": image_url},
                    ],
                }
            ]
        }

        try:
            response = httpx.post(
                f"{self.base_url}/responses",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
            input_tokens, output_tokens = _extract_openai_usage_tokens(payload)
            _record_ocr_usage_event(
                usage_context=usage_context,
                request_success=True,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                error_code=None,
            )
            return _extract_openai_text(payload)
        except httpx.HTTPStatusError as exc:
            _record_ocr_usage_event(
                usage_context=usage_context,
                request_success=False,
                input_tokens=None,
                output_tokens=None,
                error_code="OCR_PROVIDER_ERROR",
            )
            detail = exc.response.text if exc.response is not None else str(exc)
            raise AppError(
                code="OCR_PROVIDER_ERROR",
                message=f"OpenAI OCR request failed: {detail[:400]}",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc
        except httpx.HTTPError as exc:
            _record_ocr_usage_event(
                usage_context=usage_context,
                request_success=False,
                input_tokens=None,
                output_tokens=None,
                error_code="OCR_PROVIDER_ERROR",
            )
            raise AppError(
                code="OCR_PROVIDER_ERROR",
                message=f"OpenAI OCR request failed: {str(exc)}",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc
        except ValueError as exc:
            _record_ocr_usage_event(
                usage_context=usage_context,
                request_success=False,
                input_tokens=None,
                output_tokens=None,
                error_code="OCR_PROVIDER_ERROR",
            )
            raise AppError(
                code="OCR_PROVIDER_ERROR",
                message="OpenAI OCR response is not valid JSON.",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc


def _extract_openai_text(response_payload: dict) -> str:
    output_text = response_payload.get("output_text")
    if isinstance(output_text, str):
        return output_text.strip()

    texts: list[str] = []
    output_items = response_payload.get("output")
    if isinstance(output_items, list):
        for item in output_items:
            if not isinstance(item, dict):
                continue
            content_items = item.get("content")
            if not isinstance(content_items, list):
                continue
            for content in content_items:
                if not isinstance(content, dict):
                    continue
                if content.get("type") not in {"output_text", "text"}:
                    continue
                text_value = content.get("text")
                if isinstance(text_value, str):
                    texts.append(text_value.strip())

    if texts:
        return "\n".join(part for part in texts if part)

    choices = response_payload.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str):
                    return content.strip()
    return ""


def _extract_openai_usage_tokens(response_payload: dict) -> tuple[int | None, int | None]:
    usage = response_payload.get("usage")
    if not isinstance(usage, dict):
        return None, None
    input_raw = usage.get("input_tokens", usage.get("prompt_tokens"))
    output_raw = usage.get("output_tokens", usage.get("completion_tokens"))
    input_tokens = int(input_raw) if isinstance(input_raw, (int, float)) else None
    output_tokens = int(output_raw) if isinstance(output_raw, (int, float)) else None
    return input_tokens, output_tokens


def _enforce_openai_budget_for_ocr(*, usage_context: OpenAIUsageContext) -> None:
    db = None
    try:
        db = SessionLocal()
        repository = OpenAIUsageRepository(db=db)
        enforce_budget_or_raise(repository=repository, context=usage_context)
    except AppError as exc:
        _record_ocr_usage_event(
            usage_context=usage_context,
            request_success=False,
            input_tokens=None,
            output_tokens=None,
            error_code=exc.code,
        )
        raise
    except Exception:
        logger.exception("Failed to enforce OCR budget guard.")
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass


def _record_ocr_usage_event(
    *,
    usage_context: OpenAIUsageContext,
    request_success: bool,
    input_tokens: int | None,
    output_tokens: int | None,
    error_code: str | None,
) -> None:
    db = None
    try:
        db = SessionLocal()
        repository = OpenAIUsageRepository(db=db)
        record_openai_usage_event(
            repository=repository,
            context=usage_context,
            request_success=request_success,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            error_code=error_code,
        )
    except Exception:
        logger.exception("Failed to persist OCR usage event.")
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass


@lru_cache(maxsize=1)
def _build_ocr_provider() -> OCRProvider:
    provider = settings.ocr_provider.lower().strip()
    if provider == "tesseract":
        return TesseractOCRProvider()
    if provider == "openai":
        api_key = settings.openai_api_key.strip()
        if not api_key:
            raise AppError(
                code="OCR_PROVIDER_ERROR",
                message="OPENAI_API_KEY is required when OCR_PROVIDER=openai.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return OpenAIOCRProvider(
            api_key=api_key,
            model=settings.openai_ocr_model,
            base_url=settings.openai_base_url,
            timeout_seconds=settings.openai_ocr_timeout_seconds,
        )
    raise AppError(
        code="OCR_PROVIDER_ERROR",
        message=f"Unsupported OCR provider: {provider}.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def extract_text_from_image_by_provider(*, filename: str, content: bytes, language: str) -> str:
    provider = _build_ocr_provider()
    return provider.extract_text(filename=filename, content=content, language=language)
