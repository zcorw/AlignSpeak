import json
from collections.abc import Callable, Sequence
from pathlib import Path
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from app.application.usecases.article_tts_preparation import (
    ArticleTtsInputSnapshot,
    ArticleTtsSegmentPreparationError,
    PreparedArticleTtsSegment,
    build_article_tts_input_snapshot,
    prepare_article_tts_segments,
)
from app.core.config import settings
from app.infrastructure.repositories.article_tts_repository import ArticleTtsRepository
from app.infrastructure.repositories.tts_repository import TtsRepository
from app.models import ArticleTtsAsset, ArticleTtsAssetSegment, ArticleTtsJob, utcnow
from app.services.article_tts_merge_service import (
    ArticleTtsMergeError,
    ArticleTtsMergeResult,
    merge_article_tts_audio,
)
from app.services.article_tts_worker import (
    ArticleTtsJobContext,
    ArticleTtsProcessResult,
    ArticleTtsProcessingError,
)


def resolve_article_asset_path(*, media_root: Path, relative_path: str) -> Path:
    root = media_root.resolve()
    candidate = (root / relative_path).resolve()
    if candidate != root and root not in candidate.parents:
        raise ArticleTtsProcessingError(
            code="article_tts_asset_path_invalid",
            message="The article audio path is invalid.",
        )
    return candidate


class ArticleTtsJobProcessor:
    def __init__(
        self,
        *,
        article_repository: ArticleTtsRepository,
        tts_repository: TtsRepository,
        media_root: Path | None = None,
        prepare_segments: Callable[..., Sequence[PreparedArticleTtsSegment]] = prepare_article_tts_segments,
        merge_audio: Callable[..., ArticleTtsMergeResult] = merge_article_tts_audio,
    ) -> None:
        self.article_repository = article_repository
        self.tts_repository = tts_repository
        self.media_root = media_root or Path(settings.tts_media_dir)
        self.prepare_segments = prepare_segments
        self.merge_audio = merge_audio

    def _ready_asset_file(self, asset: ArticleTtsAsset | None) -> Path | None:
        if asset is None or asset.status != "ready" or not asset.audio_path:
            return None
        try:
            path = resolve_article_asset_path(media_root=self.media_root, relative_path=asset.audio_path)
        except ArticleTtsProcessingError:
            return None
        if not path.is_file() or path.stat().st_size <= 0:
            return None
        if asset.file_size is not None and path.stat().st_size != asset.file_size:
            return None
        return path

    def _get_or_create_building_asset(self, snapshot: ArticleTtsInputSnapshot) -> ArticleTtsAsset:
        existing = self.article_repository.get_asset_by_input(
            user_id=snapshot.user_id,
            article_id=snapshot.article_id,
            input_hash=snapshot.input_hash,
        )
        now = utcnow()
        if existing is not None:
            existing.voice = snapshot.resolved_voice
            existing.speed = snapshot.speed
            existing.pause_policy_version = snapshot.pause_policy_version
            existing.encoder_profile_version = snapshot.encoder_profile_version
            existing.timeline_version = snapshot.timeline_version
            return self.article_repository.mark_asset_building(existing, updated_at=now)

        asset = ArticleTtsAsset(
            id=f"atts_{uuid4().hex[:12]}",
            user_id=snapshot.user_id,
            article_id=snapshot.article_id,
            input_hash=snapshot.input_hash,
            status="building",
            voice=snapshot.resolved_voice,
            speed=snapshot.speed,
            pause_policy_version=snapshot.pause_policy_version,
            encoder_profile_version=snapshot.encoder_profile_version,
            timeline_version=snapshot.timeline_version,
            created_at=now,
            updated_at=now,
        )
        try:
            return self.article_repository.create_asset(asset)
        except IntegrityError:
            self.article_repository.db.rollback()
            raced = self.article_repository.get_asset_by_input(
                user_id=snapshot.user_id,
                article_id=snapshot.article_id,
                input_hash=snapshot.input_hash,
            )
            if raced is None:
                raise
            if self._ready_asset_file(raced) is not None:
                return raced
            return self.article_repository.mark_asset_building(raced, updated_at=now)

    def __call__(self, job: ArticleTtsJob, context: ArticleTtsJobContext) -> ArticleTtsProcessResult:
        snapshot = build_article_tts_input_snapshot(
            repository=self.tts_repository,
            user_id=job.user_id,
            article_id=job.article_id,
        )
        if snapshot is None:
            raise ArticleTtsProcessingError(
                code="article_not_found",
                message="The article no longer exists.",
            )
        if snapshot.input_hash != job.input_hash:
            raise ArticleTtsProcessingError(
                code="article_tts_input_stale",
                message="The article changed while its audio was being prepared.",
            )
        if not snapshot.segments:
            raise ArticleTtsProcessingError(
                code="article_empty",
                message="The article has no segments to synthesize.",
            )

        existing = self.article_repository.get_asset_by_input(
            user_id=job.user_id,
            article_id=job.article_id,
            input_hash=job.input_hash,
            ready_only=True,
        )
        if self._ready_asset_file(existing) is not None:
            context.report_progress(len(snapshot.segments))
            return ArticleTtsProcessResult(asset_id=existing.id)

        asset = self._get_or_create_building_asset(snapshot)
        if self._ready_asset_file(asset) is not None:
            context.report_progress(len(snapshot.segments))
            return ArticleTtsProcessResult(asset_id=asset.id)
        lease_lost = False

        def report_segment(
            _prepared: PreparedArticleTtsSegment,
            completed_segments: int,
            _total_segments: int,
        ) -> None:
            nonlocal lease_lost
            heartbeat_ok = context.heartbeat()
            progress_ok = context.report_progress(completed_segments)
            lease_lost = lease_lost or not heartbeat_ok or not progress_ok

        try:
            prepared = tuple(
                self.prepare_segments(
                    repository=self.tts_repository,
                    snapshot=snapshot,
                    on_segment_prepared=report_segment,
                )
            )
            if lease_lost or not context.heartbeat():
                raise ArticleTtsProcessingError(
                    code="article_tts_worker_lease_lost",
                    message="The article audio worker lost its lease.",
                )

            relative_path = (Path("articles") / f"{asset.id}_{snapshot.input_hash[:12]}.mp3").as_posix()
            output_path = resolve_article_asset_path(
                media_root=self.media_root,
                relative_path=relative_path,
            )
            merge_result = self.merge_audio(
                prepared_segments=prepared,
                output_path=output_path,
            )
            if not context.heartbeat():
                output_path.unlink(missing_ok=True)
                raise ArticleTtsProcessingError(
                    code="article_tts_worker_lease_lost",
                    message="The article audio worker lost its lease.",
                )

            mappings = [
                ArticleTtsAssetSegment(
                    article_tts_asset_id=asset.id,
                    segment_id=span.segment_id,
                    segment_tts_asset_id=span.segment_tts_asset_id,
                    segment_order=span.segment_order,
                    segment_text_hash=span.segment_text_hash,
                    global_start_ms=span.global_start_ms,
                    global_end_ms=span.global_end_ms,
                )
                for span in merge_result.segment_spans
            ]
            try:
                self.article_repository.publish_asset(
                    asset=asset,
                    audio_path=relative_path,
                    duration_ms=merge_result.probe.duration_ms,
                    file_size=merge_result.probe.file_size,
                    timeline_json=json.dumps(merge_result.timeline, ensure_ascii=False),
                    mappings=mappings,
                    ready_at=utcnow(),
                )
            except Exception:
                self.article_repository.db.rollback()
                output_path.unlink(missing_ok=True)
                raise
            return ArticleTtsProcessResult(asset_id=asset.id)
        except ArticleTtsSegmentPreparationError as exc:
            self.article_repository.mark_asset_failed(asset, updated_at=utcnow())
            raise ArticleTtsProcessingError(
                code="segment_tts_failed",
                message=str(exc),
                failed_segment_id=exc.segment_id,
                failed_segment_order=exc.segment_order,
            ) from exc
        except ArticleTtsMergeError as exc:
            self.article_repository.mark_asset_failed(asset, updated_at=utcnow())
            raise ArticleTtsProcessingError(
                code="merge_failed",
                message="The article audio could not be merged.",
            ) from exc
