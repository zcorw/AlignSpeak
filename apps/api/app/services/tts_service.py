import asyncio
import hashlib
import json
import logging
import re
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4

from fastapi import status

from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)
SENTENCE_BREAK_CHARS = {"。", "！", "？", ".", "!", "?", "\n"}


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


# Keep an explicit override to avoid any source-file encoding issues.
SENTENCE_BREAK_CHARS = {"。", "！", "？", ".", "!", "?", "\n"}


SENTENCE_BREAK_CHARS = {"\u3002", "\uff01", "\uff1f", ".", "!", "?", "\n"}
TimelineSentencePayload = dict[str, Any]


def _round_ms(raw_value: float) -> float:
    return round(max(raw_value, 0.0), 3)


def _coerce_ticks(raw_value: Any) -> int | None:
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        return None
    if value < 0:
        return None
    return value


def _ticks_to_ms(raw_value: Any) -> float:
    value = _coerce_ticks(raw_value)
    if value is None:
        return 0.0
    if value == 0:
        return 0.0
    return _round_ms(value / 10_000.0)


def _trim_span(text: str, start: int, end: int) -> tuple[int, int]:
    cursor_start = max(start, 0)
    cursor_end = max(end, cursor_start)
    limit = len(text)
    cursor_start = min(cursor_start, limit)
    cursor_end = min(cursor_end, limit)
    while cursor_start < cursor_end and text[cursor_start].isspace():
        cursor_start += 1
    while cursor_end > cursor_start and text[cursor_end - 1].isspace():
        cursor_end -= 1
    return cursor_start, cursor_end


def _split_sentences_with_offsets(text: str) -> list[tuple[int, int, str]]:
    spans: list[tuple[int, int, str]] = []
    start = 0
    length = len(text)
    for index, char in enumerate(text):
        if char not in SENTENCE_BREAK_CHARS:
            continue
        end = index + 1
        trimmed_start, trimmed_end = _trim_span(text, start, end)
        if trimmed_end > trimmed_start:
            spans.append((trimmed_start, trimmed_end, text[trimmed_start:trimmed_end]))
        start = end

    if start < length:
        trimmed_start, trimmed_end = _trim_span(text, start, length)
        if trimmed_end > trimmed_start:
            spans.append((trimmed_start, trimmed_end, text[trimmed_start:trimmed_end]))
    return spans


def _estimate_span_duration_ms(text: str) -> float:
    # Fallback estimate when provider doesn't expose boundaries.
    visible_chars = len("".join(ch for ch in text if not ch.isspace()))
    return float(max(450, visible_chars * 140))


def _build_fallback_sentence_timeline(*, sentence_spans: Sequence[tuple[int, int, str]]) -> list[TimelineSentencePayload]:
    timeline: list[TimelineSentencePayload] = []
    cursor_ms = 0.0
    for sentence_index, (_, __, sentence_text) in enumerate(sentence_spans):
        duration_ms = _estimate_span_duration_ms(sentence_text)
        start_ms = cursor_ms
        end_ms = start_ms + duration_ms
        timeline.append(
            {
                "sentence_index": sentence_index,
                "text": sentence_text,
                "start_ms": _round_ms(start_ms),
                "end_ms": _round_ms(end_ms),
                "timing_source": "estimated",
                "raw_start_ticks": None,
                "raw_end_ticks": None,
                "raw_duration_ticks": None,
            }
        )
        cursor_ms = end_ms
    return timeline


def _resolve_boundary_char_span(
    *,
    source_text: str,
    boundary: dict[str, Any],
    search_cursor: int,
) -> tuple[int, int, int]:
    text_offset_raw = boundary.get("text_offset")
    token_text_raw = boundary.get("text")
    token_text = str(token_text_raw or "")

    if isinstance(text_offset_raw, int):
        start = max(0, min(text_offset_raw, len(source_text)))
        end = min(len(source_text), start + len(token_text))
        return start, end, end

    stripped_token = token_text.strip()
    if not stripped_token:
        return search_cursor, search_cursor, search_cursor

    start = source_text.find(stripped_token, search_cursor)
    if start < 0:
        start = source_text.find(stripped_token)
    if start < 0:
        start = search_cursor
    end = min(len(source_text), start + len(stripped_token))
    return start, end, end


def _build_sentence_timeline(
    *,
    source_text: str,
    word_boundaries: Sequence[dict[str, Any]],
) -> list[TimelineSentencePayload]:
    sentence_spans = _split_sentences_with_offsets(source_text)
    if not sentence_spans:
        return []
    if not word_boundaries:
        logger.warning("TTS boundary metadata missing; falling back to estimated sentence timeline")
        return _build_fallback_sentence_timeline(sentence_spans=sentence_spans)

    mapped_boundaries: list[tuple[int, int, float, float, int, int, str]] = []
    search_cursor = 0
    for boundary in word_boundaries:
        boundary_type = str(boundary.get("type") or "")
        raw_offset_ticks = _coerce_ticks(boundary.get("offset")) or 0
        raw_duration_ticks = _coerce_ticks(boundary.get("duration")) or 0
        raw_end_ticks = raw_offset_ticks + raw_duration_ticks
        start_ms = _ticks_to_ms(raw_offset_ticks)
        end_ms = _ticks_to_ms(raw_end_ticks)
        start_char, end_char, next_cursor = _resolve_boundary_char_span(
            source_text=source_text,
            boundary=boundary,
            search_cursor=search_cursor,
        )
        search_cursor = next_cursor
        if end_char <= start_char:
            continue
        mapped_boundaries.append(
            (start_char, end_char, start_ms, end_ms, raw_offset_ticks, raw_end_ticks, boundary_type)
        )

    if not mapped_boundaries:
        logger.warning("TTS boundary metadata unusable; falling back to estimated sentence timeline")
        return _build_fallback_sentence_timeline(sentence_spans=sentence_spans)

    timeline: list[TimelineSentencePayload] = []
    for sentence_index, (sentence_start, sentence_end, sentence_text) in enumerate(sentence_spans):
        sentence_boundaries = [
            item
            for item in mapped_boundaries
            if not (item[1] <= sentence_start or item[0] >= sentence_end)
        ]
        if not sentence_boundaries:
            previous_end = float(timeline[-1]["end_ms"]) if timeline else 0.0
            start_ms = previous_end
            end_ms = previous_end + _estimate_span_duration_ms(sentence_text)
            raw_start_ticks = None
            raw_end_ticks = None
            raw_duration_ticks = None
            timing_source = "estimated"
        else:
            start_ms = min(item[2] for item in sentence_boundaries)
            end_ms = max(item[3] for item in sentence_boundaries)
            raw_start_ticks = min(item[4] for item in sentence_boundaries)
            raw_end_ticks = max(item[5] for item in sentence_boundaries)
            raw_duration_ticks = max(raw_end_ticks - raw_start_ticks, 0)
            if any(item[6] == "WordBoundary" for item in sentence_boundaries):
                timing_source = "word_boundary"
            else:
                timing_source = "sentence_boundary"
        if end_ms < start_ms:
            end_ms = start_ms
        timeline.append(
            {
                "sentence_index": sentence_index,
                "text": sentence_text,
                "start_ms": _round_ms(start_ms),
                "end_ms": _round_ms(end_ms),
                "timing_source": timing_source,
                "raw_start_ticks": raw_start_ticks,
                "raw_end_ticks": raw_end_ticks,
                "raw_duration_ticks": raw_duration_ticks,
            }
        )
    return timeline


def synthesize_to_mp3(
    *,
    text: str,
    language: str,
    speed: float,
    output_path: Path,
    voice: str = "default",
) -> list[TimelineSentencePayload]:
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

    async def _run() -> list[TimelineSentencePayload]:
        try:
            communicate = edge_tts.Communicate(
                text=text,
                voice=chosen_voice,
                rate=rate,
                boundary="WordBoundary",
            )
        except TypeError:
            # Older edge-tts versions may not support explicit boundary selection.
            communicate = edge_tts.Communicate(text=text, voice=chosen_voice, rate=rate)
        audio_chunks: list[bytes] = []
        word_boundaries: list[dict[str, Any]] = []
        sentence_boundary_count = 0
        sentence_boundaries_raw: list[dict[str, Any]] = []
        async for chunk in communicate.stream():
            chunk_type = chunk.get("type")
            if chunk_type == "audio":
                audio_data = chunk.get("data")
                if isinstance(audio_data, (bytes, bytearray)):
                    audio_chunks.append(bytes(audio_data))
            elif chunk_type in ("WordBoundary", "SentenceBoundary"):
                word_boundaries.append(chunk)
                if chunk_type == "SentenceBoundary":
                    sentence_boundary_count += 1
                    sentence_boundaries_raw.append(dict(chunk))
                    logger.warning(
                        "TTS SentenceBoundary: idx=%d payload_json=%s payload_repr=%r",
                        sentence_boundary_count,
                        json.dumps(chunk, ensure_ascii=False, default=str),
                        chunk,
                    )

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"".join(audio_chunks))
        if sentence_boundaries_raw:
            logger.warning(
                "TTS SentenceBoundary batch payloads=%s",
                json.dumps(sentence_boundaries_raw, ensure_ascii=False, default=str),
            )
        logger.warning("TTS SentenceBoundary total=%d", sentence_boundary_count)
        return _build_sentence_timeline(source_text=text, word_boundaries=word_boundaries)

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
        timeline = asyncio.run(_run())
        logger.info(
            "TTS synth done: provider=edge-tts voice=%s speed=%.2f output=%s timeline_items=%d",
            chosen_voice,
            speed,
            str(output_path),
            len(timeline),
        )
        return timeline
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
    timeline: list[TimelineSentencePayload] | None = None
    timeline_version: str | None = None


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


def mark_tts_job_done(
    *,
    job_id: str,
    audio_url: str,
    cached: bool,
    timeline: list[TimelineSentencePayload] | None = None,
    timeline_version: str | None = None,
) -> None:
    with _tts_job_lock:
        job = _tts_jobs.get(job_id)
        if job is None:
            return
        job.status = "done"
        job.audio_url = audio_url
        job.cached = cached
        job.error_code = None
        job.timeline = timeline
        job.timeline_version = timeline_version


def mark_tts_job_failed(*, job_id: str, error_code: str) -> None:
    with _tts_job_lock:
        job = _tts_jobs.get(job_id)
        if job is None:
            return
        job.status = "failed"
        job.error_code = error_code
        job.timeline = None
        job.timeline_version = None


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
            timeline=job.timeline,
            timeline_version=job.timeline_version,
        )
