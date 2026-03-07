import asyncio
import hashlib
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from uuid import uuid4

from fastapi import status

from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)


def calculate_text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sanitize_segment_id(segment_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", segment_id)


def build_tts_filename(segment_id: str, text_hash: str, voice: str, speed: float) -> str:
    safe_segment = sanitize_segment_id(segment_id)
    safe_voice = re.sub(r"[^a-zA-Z0-9_-]", "_", voice)[:24]
    safe_speed = str(speed).replace(".", "_")
    return f"{safe_segment}_{text_hash[:12]}_{safe_voice}_{safe_speed}.mp3"


def resolve_media_output_path(filename: str) -> Path:
    media_dir = Path(settings.tts_media_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    return media_dir / filename


def map_language_to_default_voice(language: str) -> str:
    if language == "zh":
        return "zh-CN-XiaoxiaoNeural"
    if language == "ja":
        return "ja-JP-NanamiNeural"
    return "en-US-AriaNeural"


def format_rate(speed: float) -> str:
    delta = round((speed - 1.0) * 100)
    if delta >= 0:
        return f"+{delta}%"
    return f"{delta}%"


def synthesize_to_mp3(*, text: str, language: str, speed: float, output_path: Path, voice: str = "default") -> None:
    chosen_voice = map_language_to_default_voice(language) if voice == "default" else voice
    rate = format_rate(speed)

    try:
        import edge_tts  # type: ignore
    except Exception as exc:
        logger.exception("TTS dependency import failed: provider=edge-tts")
        raise AppError(
            code="TTS_PROVIDER_ERROR",
            message="TTS provider dependency is not installed.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        ) from exc

    async def _run() -> None:
        communicate = edge_tts.Communicate(text=text, voice=chosen_voice, rate=rate)
        await communicate.save(str(output_path))

    try:
        logger.info(
            "TTS synth start: provider=edge-tts lang=%s voice=%s speed=%.2f rate=%s text_len=%d output=%s edge_tts_version=%s",
            language,
            chosen_voice,
            speed,
            rate,
            len(text),
            str(output_path),
            getattr(edge_tts, "__version__", "unknown"),
        )
        asyncio.run(_run())
        logger.info(
            "TTS synth done: provider=edge-tts voice=%s speed=%.2f output=%s",
            chosen_voice,
            speed,
            str(output_path),
        )
    except AppError:
        raise
    except Exception as exc:
        status_code = getattr(exc, "status", None)
        message = getattr(exc, "message", None)
        request_info = getattr(exc, "request_info", None)
        request_url = None
        if request_info is not None:
            request_url = str(getattr(request_info, "real_url", ""))
        logger.exception(
            "TTS synth failed: provider=edge-tts type=%s status=%s message=%s url=%s repr=%s voice=%s speed=%.2f lang=%s",
            type(exc).__name__,
            str(status_code),
            str(message),
            str(request_url),
            repr(exc),
            chosen_voice,
            speed,
            language,
        )
        raise AppError(
            code="TTS_PROVIDER_ERROR",
            message=f"TTS generation failed: {str(exc)}",
            status_code=status.HTTP_502_BAD_GATEWAY,
        ) from exc


@dataclass
class TtsJobState:
    job_id: str
    user_id: str
    status: str
    audio_url: str | None = None
    cached: bool | None = None
    error_code: str | None = None


_tts_jobs: dict[str, TtsJobState] = {}
_tts_job_lock = Lock()


def create_tts_job_state(*, user_id: str) -> TtsJobState:
    job = TtsJobState(job_id=f"tts_job_{uuid4().hex[:12]}", user_id=user_id, status="queued")
    with _tts_job_lock:
        _tts_jobs[job.job_id] = job
    return job


def mark_tts_job_processing(job_id: str) -> None:
    with _tts_job_lock:
        job = _tts_jobs.get(job_id)
        if job is not None:
            job.status = "processing"


def mark_tts_job_done(*, job_id: str, audio_url: str, cached: bool) -> None:
    with _tts_job_lock:
        job = _tts_jobs.get(job_id)
        if job is None:
            return
        job.status = "done"
        job.audio_url = audio_url
        job.cached = cached
        job.error_code = None


def mark_tts_job_failed(*, job_id: str, error_code: str) -> None:
    with _tts_job_lock:
        job = _tts_jobs.get(job_id)
        if job is None:
            return
        job.status = "failed"
        job.error_code = error_code


def get_tts_job_state(job_id: str) -> TtsJobState | None:
    with _tts_job_lock:
        job = _tts_jobs.get(job_id)
        if job is None:
            return None
        return TtsJobState(
            job_id=job.job_id,
            user_id=job.user_id,
            status=job.status,
            audio_url=job.audio_url,
            cached=job.cached,
            error_code=job.error_code,
        )
