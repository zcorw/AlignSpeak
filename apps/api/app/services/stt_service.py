from dataclasses import dataclass
from functools import lru_cache
import logging
from pathlib import Path
from typing import Protocol

import httpx
from fastapi import status

from app.core.config import settings
from app.core.errors import AppError
from app.db import SessionLocal
from app.infrastructure.repositories.openai_usage_repository import OpenAIUsageRepository
from app.services.article_service import normalize_text
from app.services.openai_usage_service import OpenAIUsageContext, enforce_budget_or_raise, record_openai_usage_event

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class STTResult:
    recognized_text: str
    confidence: float | None
    provider: str
    model: str
    raw_payload: str | None = None


class STTProvider(Protocol):
    def transcribe(
        self,
        *,
        audio_path: Path,
        language: str,
        usage_context: OpenAIUsageContext | None = None,
        audio_duration_ms: int | None = None,
    ) -> STTResult:
        ...


class OpenAISTTProvider:
    def __init__(self, *, api_key: str, model: str, base_url: str, timeout_seconds: float) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def transcribe(
        self,
        *,
        audio_path: Path,
        language: str,
        usage_context: OpenAIUsageContext | None = None,
        audio_duration_ms: int | None = None,
    ) -> STTResult:
        language_map = {"ja": "ja", "en": "en", "zh": "zh"}
        language_hint = language_map.get(language, "en")
        if usage_context is not None:
            _enforce_openai_budget_for_stt(usage_context=usage_context)
        try:
            with audio_path.open("rb") as audio_file:
                files = {
                    "file": (audio_path.name, audio_file, "audio/webm"),
                    "model": (None, self.model),
                    "language": (None, language_hint),
                }
                response = httpx.post(
                    f"{self.base_url}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    files=files,
                    timeout=self.timeout_seconds,
                )
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPStatusError as exc:
            if usage_context is not None:
                _record_stt_usage_event(
                    usage_context=usage_context,
                    request_success=False,
                    input_tokens=None,
                    output_tokens=None,
                    audio_duration_ms=audio_duration_ms,
                    error_code="STT_PROVIDER_ERROR",
                )
            detail = exc.response.text if exc.response is not None else str(exc)
            raise AppError(
                code="STT_PROVIDER_ERROR",
                message=f"OpenAI STT request failed: {detail[:400]}",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc
        except httpx.HTTPError as exc:
            if usage_context is not None:
                _record_stt_usage_event(
                    usage_context=usage_context,
                    request_success=False,
                    input_tokens=None,
                    output_tokens=None,
                    audio_duration_ms=audio_duration_ms,
                    error_code="STT_PROVIDER_ERROR",
                )
            raise AppError(
                code="STT_PROVIDER_ERROR",
                message=f"OpenAI STT request failed: {str(exc)}",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc
        except ValueError as exc:
            if usage_context is not None:
                _record_stt_usage_event(
                    usage_context=usage_context,
                    request_success=False,
                    input_tokens=None,
                    output_tokens=None,
                    audio_duration_ms=audio_duration_ms,
                    error_code="STT_PROVIDER_ERROR",
                )
            raise AppError(
                code="STT_PROVIDER_ERROR",
                message="OpenAI STT response is not valid JSON.",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc

        recognized_text = normalize_text(str(payload.get("text", "")))
        if not recognized_text:
            if usage_context is not None:
                _record_stt_usage_event(
                    usage_context=usage_context,
                    request_success=False,
                    input_tokens=None,
                    output_tokens=None,
                    audio_duration_ms=audio_duration_ms,
                    error_code="STT_PROVIDER_ERROR",
                )
            raise AppError(
                code="STT_PROVIDER_ERROR",
                message="OpenAI STT response does not contain recognized text.",
                status_code=status.HTTP_502_BAD_GATEWAY,
            )
        if usage_context is not None:
            input_tokens, output_tokens = _extract_stt_usage_tokens(payload)
            _record_stt_usage_event(
                usage_context=usage_context,
                request_success=True,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                audio_duration_ms=audio_duration_ms,
                error_code=None,
            )
        return STTResult(
            recognized_text=recognized_text,
            confidence=None,
            provider="openai_stt",
            model=self.model,
            raw_payload=response.text if "response" in locals() else None,
        )


@lru_cache(maxsize=1)
def _build_stt_provider() -> STTProvider:
    provider = settings.stt_provider.lower().strip()
    if provider == "openai":
        api_key = settings.openai_api_key.strip()
        if not api_key:
            raise AppError(
                code="STT_PROVIDER_ERROR",
                message="OPENAI_API_KEY is required when STT_PROVIDER=openai.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return OpenAISTTProvider(
            api_key=api_key,
            model=settings.openai_stt_model,
            base_url=settings.openai_base_url,
            timeout_seconds=settings.openai_stt_timeout_seconds,
        )
    raise AppError(
        code="STT_PROVIDER_ERROR",
        message=f"Unsupported STT provider: {provider}.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def transcribe_audio_by_provider(*, audio_path: Path, language: str) -> STTResult:
    provider = _build_stt_provider()
    return provider.transcribe(audio_path=audio_path, language=language)


def transcribe_audio_with_usage_tracking(
    *,
    audio_path: Path,
    language: str,
    user_id: str | None,
    article_id: str | None,
    task_id: str | None,
    audio_duration_ms: int | None = None,
) -> STTResult:
    provider = _build_stt_provider()
    usage_context = OpenAIUsageContext(
        module="stt",
        provider="openai",
        model=settings.openai_stt_model,
        user_id=user_id,
        article_id=article_id,
        task_id=task_id,
    )
    return provider.transcribe(
        audio_path=audio_path,
        language=language,
        usage_context=usage_context,
        audio_duration_ms=audio_duration_ms,
    )


def _extract_stt_usage_tokens(response_payload: dict) -> tuple[int | None, int | None]:
    usage = response_payload.get("usage")
    if not isinstance(usage, dict):
        return None, None
    input_raw = usage.get("input_tokens", usage.get("prompt_tokens"))
    output_raw = usage.get("output_tokens", usage.get("completion_tokens"))
    input_tokens = int(input_raw) if isinstance(input_raw, (int, float)) else None
    output_tokens = int(output_raw) if isinstance(output_raw, (int, float)) else None
    return input_tokens, output_tokens


def _enforce_openai_budget_for_stt(*, usage_context: OpenAIUsageContext) -> None:
    db = None
    try:
        db = SessionLocal()
        repository = OpenAIUsageRepository(db=db)
        enforce_budget_or_raise(repository=repository, context=usage_context)
    except AppError as exc:
        _record_stt_usage_event(
            usage_context=usage_context,
            request_success=False,
            input_tokens=None,
            output_tokens=None,
            audio_duration_ms=None,
            error_code=exc.code,
        )
        raise
    except Exception:
        logger.exception("Failed to enforce STT budget guard.")
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass


def _record_stt_usage_event(
    *,
    usage_context: OpenAIUsageContext,
    request_success: bool,
    input_tokens: int | None,
    output_tokens: int | None,
    audio_duration_ms: int | None,
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
            audio_duration_ms=audio_duration_ms,
            error_code=error_code,
        )
    except Exception:
        logger.exception("Failed to persist STT usage event.")
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass
