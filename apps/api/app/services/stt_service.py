from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Protocol

import httpx
from fastapi import status

from app.core.config import settings
from app.core.errors import AppError
from app.services.article_service import normalize_text


@dataclass(frozen=True)
class STTResult:
    recognized_text: str
    confidence: float | None
    provider: str
    model: str
    raw_payload: str | None = None


class STTProvider(Protocol):
    def transcribe(self, *, audio_path: Path, language: str) -> STTResult:
        ...


class OpenAISTTProvider:
    def __init__(self, *, api_key: str, model: str, base_url: str, timeout_seconds: float) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def transcribe(self, *, audio_path: Path, language: str) -> STTResult:
        language_map = {"ja": "ja", "en": "en", "zh": "zh"}
        language_hint = language_map.get(language, "en")
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
            detail = exc.response.text if exc.response is not None else str(exc)
            raise AppError(
                code="STT_PROVIDER_ERROR",
                message=f"OpenAI STT request failed: {detail[:400]}",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc
        except httpx.HTTPError as exc:
            raise AppError(
                code="STT_PROVIDER_ERROR",
                message=f"OpenAI STT request failed: {str(exc)}",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc
        except ValueError as exc:
            raise AppError(
                code="STT_PROVIDER_ERROR",
                message="OpenAI STT response is not valid JSON.",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc

        recognized_text = normalize_text(str(payload.get("text", "")))
        if not recognized_text:
            raise AppError(
                code="STT_PROVIDER_ERROR",
                message="OpenAI STT response does not contain recognized text.",
                status_code=status.HTTP_502_BAD_GATEWAY,
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
