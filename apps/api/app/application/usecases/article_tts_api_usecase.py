import json
import math
from dataclasses import dataclass
from pathlib import Path

from fastapi import status

from app.application.usecases.article_tts_job_processor import resolve_article_asset_path
from app.application.usecases.article_tts_job_usecase import (
    create_or_get_article_tts_job,
    retry_article_tts_job,
)
from app.application.usecases.article_tts_preparation import (
    ArticleTtsInputSnapshot,
    build_article_tts_input_snapshot,
)
from app.core.config import settings
from app.core.errors import AppError
from app.infrastructure.repositories.article_tts_repository import ArticleTtsRepository
from app.infrastructure.repositories.tts_repository import TtsRepository
from app.models import ArticleTtsAsset, ArticleTtsJob, User, utcnow
from app.schemas.article_tts import (
    ArticleTtsAssetResponse,
    ArticleTtsEstimate,
    ArticleTtsFailedSegment,
    ArticleTtsJobResponse,
    ArticleTtsTimelineSentence,
    CurrentArticleTtsResponse,
)


@dataclass(frozen=True)
class ResolvedArticleTtsMedia:
    asset: ArticleTtsAsset
    path: Path


def _build_snapshot_or_raise(
    *,
    tts_repository: TtsRepository,
    current_user: User,
    article_id: str,
) -> ArticleTtsInputSnapshot:
    snapshot = build_article_tts_input_snapshot(
        repository=tts_repository,
        user_id=current_user.id,
        article_id=article_id,
    )
    if snapshot is None:
        raise AppError(
            code="ARTICLE_NOT_FOUND",
            message="Article not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    if not snapshot.segments:
        raise AppError(
            code="ARTICLE_EMPTY",
            message="Article has no segments.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return snapshot


def _asset_media_path(asset: ArticleTtsAsset, *, media_root: Path) -> Path | None:
    if asset.status != "ready" or not asset.audio_path or not asset.file_size:
        return None
    try:
        path = resolve_article_asset_path(media_root=media_root, relative_path=asset.audio_path)
    except Exception:
        return None
    if not path.is_file() or path.stat().st_size != asset.file_size:
        return None
    return path


def _load_global_timeline(asset: ArticleTtsAsset) -> list[ArticleTtsTimelineSentence]:
    try:
        payload = json.loads(asset.timeline_json or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(payload, list):
        return []
    timeline: list[ArticleTtsTimelineSentence] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            timeline.append(ArticleTtsTimelineSentence.model_validate(item))
        except ValueError:
            continue
    return timeline


def _asset_response(asset: ArticleTtsAsset) -> ArticleTtsAssetResponse:
    return ArticleTtsAssetResponse(
        asset_id=asset.id,
        article_id=asset.article_id,
        input_hash=asset.input_hash,
        audio_url=f"/media/tts/articles/{asset.id}",
        duration_ms=int(asset.duration_ms or 0),
        file_size=int(asset.file_size or 0),
        voice=asset.voice,
        speed=float(asset.speed),
        timeline_version=asset.timeline_version,
        timeline=_load_global_timeline(asset),
        ready_at=asset.ready_at,
    )


def _job_response(
    *,
    repository: ArticleTtsRepository,
    job: ArticleTtsJob,
) -> ArticleTtsJobResponse:
    asset_response = None
    if job.asset_id:
        asset = repository.get_asset_for_user(asset_id=job.asset_id, user_id=job.user_id)
        if asset is not None and asset.status == "ready":
            asset_response = _asset_response(asset)
    failed_segment = None
    if job.failed_segment_id is not None or job.failed_segment_order is not None:
        failed_segment = ArticleTtsFailedSegment(
            segment_id=job.failed_segment_id,
            segment_order=job.failed_segment_order,
        )
    return ArticleTtsJobResponse(
        job_id=job.id,
        article_id=job.article_id,
        input_hash=job.input_hash,
        status=job.status,
        total_segments=job.total_segments,
        completed_segments=job.completed_segments,
        failed_segment=failed_segment,
        error_code=job.error_code,
        error_message=job.error_message,
        asset=asset_response,
    )


def _estimate_file_size(snapshot: ArticleTtsInputSnapshot) -> int:
    visible_characters = sum(
        len("".join(character for character in segment.tts_input_text if not character.isspace()))
        for segment in snapshot.segments
    )
    characters_per_second = 4.0 if snapshot.language in {"ja", "zh"} else 12.0
    speech_seconds = max(visible_characters / characters_per_second, 1.0)
    pause_seconds = max(len(snapshot.segments) - 1, 0) * 0.75 + 1.5
    # 48 kbps is 6,000 bytes/second. Keep a small container/estimation margin.
    return math.ceil((speech_seconds + pause_seconds) * 6_000 * 1.05)


def create_full_article_tts_job(
    *,
    repository: ArticleTtsRepository,
    tts_repository: TtsRepository,
    current_user: User,
    article_id: str,
    force_refresh: bool,
    media_root: Path | None = None,
) -> ArticleTtsJobResponse:
    snapshot = _build_snapshot_or_raise(
        tts_repository=tts_repository,
        current_user=current_user,
        article_id=article_id,
    )
    job = create_or_get_article_tts_job(
        repository=repository,
        user_id=current_user.id,
        article_id=article_id,
        input_hash=snapshot.input_hash,
        total_segments=len(snapshot.segments),
    )
    if force_refresh and job.status == "failed":
        retried = retry_article_tts_job(
            repository=repository,
            job_id=job.id,
            user_id=current_user.id,
            max_attempts=settings.article_tts_job_max_attempts,
        )
        if retried is None:
            raise AppError(
                code="ARTICLE_TTS_RETRY_EXHAUSTED",
                message="The article audio retry limit was reached.",
                status_code=status.HTTP_409_CONFLICT,
            )
        job = retried

    if job.status == "done" and job.asset_id:
        asset = repository.get_asset_for_user(asset_id=job.asset_id, user_id=current_user.id)
        root = media_root or Path(settings.tts_media_dir)
        if asset is None or _asset_media_path(asset, media_root=root) is None:
            rebuilt = repository.requeue_job_for_rebuild(
                job_id=job.id,
                user_id=current_user.id,
                now=utcnow(),
            )
            if rebuilt is not None:
                job = rebuilt
    return _job_response(repository=repository, job=job)


def retry_full_article_tts_job(
    *,
    repository: ArticleTtsRepository,
    current_user: User,
    job_id: str,
) -> ArticleTtsJobResponse:
    existing = repository.get_job_for_user(job_id=job_id, user_id=current_user.id)
    if existing is None:
        raise AppError(
            code="ARTICLE_TTS_JOB_NOT_FOUND",
            message="Article TTS job not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    retried = retry_article_tts_job(
        repository=repository,
        job_id=job_id,
        user_id=current_user.id,
        max_attempts=settings.article_tts_job_max_attempts,
    )
    if retried is None:
        raise AppError(
            code="ARTICLE_TTS_RETRY_NOT_ALLOWED",
            message="The article TTS job cannot be retried.",
            status_code=status.HTTP_409_CONFLICT,
        )
    return _job_response(repository=repository, job=retried)


def get_full_article_tts_job(
    *,
    repository: ArticleTtsRepository,
    current_user: User,
    job_id: str,
) -> ArticleTtsJobResponse:
    job = repository.get_job_for_user(job_id=job_id, user_id=current_user.id)
    if job is None:
        raise AppError(
            code="ARTICLE_TTS_JOB_NOT_FOUND",
            message="Article TTS job not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return _job_response(repository=repository, job=job)


def get_current_article_tts(
    *,
    repository: ArticleTtsRepository,
    tts_repository: TtsRepository,
    current_user: User,
    article_id: str,
    media_root: Path | None = None,
) -> CurrentArticleTtsResponse:
    snapshot = _build_snapshot_or_raise(
        tts_repository=tts_repository,
        current_user=current_user,
        article_id=article_id,
    )
    root = media_root or Path(settings.tts_media_dir)
    latest = repository.get_latest_ready_asset_for_article(
        article_id=article_id,
        user_id=current_user.id,
    )
    available = latest is not None and _asset_media_path(latest, media_root=root) is not None
    asset_response = _asset_response(latest) if latest is not None and available else None
    is_stale = latest is not None and (latest.input_hash != snapshot.input_hash or not available)
    if asset_response is not None and latest.input_hash == snapshot.input_hash:
        estimate = ArticleTtsEstimate(bytes=latest.file_size, is_estimate=False)
    else:
        estimate = ArticleTtsEstimate(bytes=_estimate_file_size(snapshot), is_estimate=True)
    job = repository.get_job_by_input(
        user_id=current_user.id,
        article_id=article_id,
        input_hash=snapshot.input_hash,
    )
    return CurrentArticleTtsResponse(
        article_id=article_id,
        input_hash=snapshot.input_hash,
        is_stale=is_stale,
        estimate=estimate,
        asset=asset_response,
        job=_job_response(repository=repository, job=job) if job is not None else None,
    )


def resolve_full_article_tts_media(
    *,
    repository: ArticleTtsRepository,
    current_user: User,
    asset_id: str,
    media_root: Path | None = None,
) -> ResolvedArticleTtsMedia:
    asset = repository.get_ready_asset_for_user(asset_id=asset_id, user_id=current_user.id)
    if asset is None:
        raise AppError(
            code="ARTICLE_TTS_ASSET_NOT_FOUND",
            message="Article TTS asset not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    root = media_root or Path(settings.tts_media_dir)
    path = _asset_media_path(asset, media_root=root)
    if path is None:
        raise AppError(
            code="ARTICLE_TTS_ASSET_MISSING",
            message="Article TTS audio is no longer available.",
            status_code=status.HTTP_410_GONE,
        )
    return ResolvedArticleTtsMedia(asset=asset, path=path)
