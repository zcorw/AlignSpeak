from pathlib import Path
import logging
from uuid import uuid4

from fastapi import status

from app.core.config import settings
from app.core.errors import AppError
from app.infrastructure.repositories.tts_repository import TtsRepository
from app.models import TtsAsset, User, utcnow
from app.schemas.tts import SegmentTtsResponse, TtsJobCreateResponse, TtsJobStatusResponse
from app.services.tts_service import (
    build_tts_filename,
    calculate_text_hash,
    create_tts_job_state,
    get_tts_job_state,
    mark_tts_job_done,
    mark_tts_job_failed,
    mark_tts_job_processing,
    resolve_media_output_path,
    synthesize_to_mp3,
)

logger = logging.getLogger(__name__)


def create_tts_job(
    *,
    repository: TtsRepository,
    current_user: User,
    article_id: str,
    segment_id: str,
    speed: float,
    voice: str = "default",
) -> TtsJobCreateResponse:
    logger.info(
        "TTS job create requested: user_id=%s article_id=%s segment_id=%s speed=%.2f voice=%s",
        current_user.id,
        article_id,
        segment_id,
        speed,
        voice,
    )
    pair = repository.get_segment_for_user_in_article(
        article_id=article_id,
        segment_id=segment_id,
        user_id=current_user.id,
    )
    if pair is None:
        raise AppError(
            code="SEGMENT_NOT_FOUND",
            message="Segment not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    article, segment = pair
    text_hash = calculate_text_hash(segment.normalized_text)
    existing = repository.get_tts_asset(
        segment_id=segment.id,
        voice=voice,
        speed=speed,
        text_hash=text_hash,
    )

    job = create_tts_job_state(user_id=current_user.id)
    mark_tts_job_processing(job.job_id)
    logger.info("TTS job processing: job_id=%s segment_id=%s", job.job_id, segment_id)

    try:
        if existing is not None:
            existing_path = _resolve_media_path_from_audio_url(existing.audio_url)
            if existing_path.exists():
                mark_tts_job_done(job_id=job.job_id, audio_url=existing.audio_url, cached=True)
                logger.info("TTS cache hit: job_id=%s segment_id=%s audio_url=%s", job.job_id, segment_id, existing.audio_url)
                return TtsJobCreateResponse(job_id=job.job_id, status="queued")

        filename = build_tts_filename(
            segment_id=segment.id,
            text_hash=text_hash,
            voice=voice,
            speed=speed,
        )
        output_path = resolve_media_output_path(filename)
        synthesize_to_mp3(
            text=segment.plain_text,
            language=article.language,
            speed=speed,
            output_path=output_path,
            voice=voice,
        )
        audio_url = f"/media/tts/{filename}"

        repository.create_tts_asset(
            TtsAsset(
                id=f"tts_{uuid4().hex[:12]}",
                segment_id=segment.id,
                voice=voice,
                speed=speed,
                audio_url=audio_url,
                text_hash=text_hash,
                created_at=utcnow(),
            )
        )
        mark_tts_job_done(job_id=job.job_id, audio_url=audio_url, cached=False)
        logger.info("TTS job done: job_id=%s segment_id=%s audio_url=%s", job.job_id, segment_id, audio_url)
    except AppError as exc:
        logger.error(
            "TTS job failed with app error: job_id=%s segment_id=%s code=%s message=%s",
            job.job_id,
            segment_id,
            exc.code,
            exc.message,
        )
        mark_tts_job_failed(job_id=job.job_id, error_code=exc.code)
    except Exception:
        logger.exception("TTS job failed with unexpected error: job_id=%s segment_id=%s", job.job_id, segment_id)
        mark_tts_job_failed(job_id=job.job_id, error_code="TTS_PROVIDER_ERROR")

    return TtsJobCreateResponse(job_id=job.job_id, status="queued")


def get_tts_job(*, current_user: User, job_id: str) -> TtsJobStatusResponse:
    job = get_tts_job_state(job_id)
    if job is None:
        raise AppError(
            code="TTS_JOB_NOT_FOUND",
            message="TTS job not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    if job.user_id != current_user.id:
        raise AppError(
            code="FORBIDDEN",
            message="Forbidden.",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    return TtsJobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        audio_url=job.audio_url,
        cached=job.cached,
        error_code=job.error_code,
    )


def get_segment_tts(
    *,
    repository: TtsRepository,
    current_user: User,
    segment_id: str,
    speed: float,
    voice: str = "default",
) -> SegmentTtsResponse:
    pair = repository.get_segment_for_user(segment_id=segment_id, user_id=current_user.id)
    if pair is None:
        raise AppError(
            code="SEGMENT_NOT_FOUND",
            message="Segment not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    _article, segment = pair
    text_hash = calculate_text_hash(segment.normalized_text)
    asset = repository.get_tts_asset(
        segment_id=segment.id,
        voice=voice,
        speed=speed,
        text_hash=text_hash,
    )
    if asset is None:
        raise AppError(
            code="NOT_FOUND",
            message="TTS asset not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    media_path = _resolve_media_path_from_audio_url(asset.audio_url)
    if not media_path.exists():
        raise AppError(
            code="NOT_FOUND",
            message="TTS audio file not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return SegmentTtsResponse(
        segment_id=segment.id,
        audio_url=asset.audio_url,
        voice=asset.voice,
        speed=float(asset.speed),
    )


def resolve_tts_media_file(filename: str) -> Path:
    requested = Path(filename).name
    media_path = resolve_media_output_path(requested).resolve()
    media_dir = Path(settings.tts_media_dir).resolve()
    if media_dir not in media_path.parents and media_path != media_dir:
        raise AppError(
            code="FORBIDDEN",
            message="Invalid media path.",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    if not media_path.exists():
        raise AppError(
            code="NOT_FOUND",
            message="TTS audio file not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return media_path


def _resolve_media_path_from_audio_url(audio_url: str) -> Path:
    filename = Path(audio_url).name
    return resolve_media_output_path(filename)
