from datetime import datetime, timedelta

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.sql.dml import Update
from sqlalchemy.orm import Session

from app.models import ArticleTtsAsset, ArticleTtsAssetSegment, ArticleTtsJob


def _claimable_job_predicate(*, now: datetime):
    return or_(
        ArticleTtsJob.status == "queued",
        and_(
            ArticleTtsJob.status == "processing",
            or_(
                ArticleTtsJob.lease_expires_at.is_(None),
                ArticleTtsJob.lease_expires_at <= now,
            ),
        ),
    )


def build_article_tts_claim_statement(
    *,
    worker_id: str,
    now: datetime,
    lease_seconds: int,
    max_attempts: int,
) -> Update:
    """Build one atomic claim statement.

    PostgreSQL renders the candidate selection with ``FOR UPDATE SKIP LOCKED``.
    The outer eligibility predicate is intentionally repeated so a waiting
    concurrent statement cannot overwrite a lease acquired first.
    """

    claimable = _claimable_job_predicate(now=now)
    candidate_id = (
        select(ArticleTtsJob.id)
        .where(
            claimable,
            ArticleTtsJob.attempt_count < max_attempts,
        )
        .order_by(ArticleTtsJob.created_at.asc(), ArticleTtsJob.id.asc())
        .with_for_update(skip_locked=True)
        .limit(1)
        .scalar_subquery()
    )
    lease_expires_at = now + timedelta(seconds=lease_seconds)
    return (
        update(ArticleTtsJob)
        .where(
            ArticleTtsJob.id == candidate_id,
            claimable,
            ArticleTtsJob.attempt_count < max_attempts,
        )
        .values(
            status="processing",
            lease_owner=worker_id,
            lease_expires_at=lease_expires_at,
            heartbeat_at=now,
            attempt_count=ArticleTtsJob.attempt_count + 1,
            started_at=func.coalesce(ArticleTtsJob.started_at, now),
            finished_at=None,
            updated_at=now,
        )
        .returning(ArticleTtsJob)
    )


class ArticleTtsRepository:
    """Persistence boundary for article-level TTS jobs and assets.

    Worker claiming and lease transitions intentionally live outside this basic
    repository surface and are introduced by the next implementation task.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def create_job(self, job: ArticleTtsJob) -> ArticleTtsJob:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def update_job(self, job: ArticleTtsJob) -> ArticleTtsJob:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def get_job_for_user(self, *, job_id: str, user_id: str) -> ArticleTtsJob | None:
        statement = select(ArticleTtsJob).where(
            ArticleTtsJob.id == job_id,
            ArticleTtsJob.user_id == user_id,
        )
        return self.db.scalar(statement.execution_options(populate_existing=True))

    def get_job_by_input(
        self,
        *,
        user_id: str,
        article_id: str,
        input_hash: str,
    ) -> ArticleTtsJob | None:
        statement = select(ArticleTtsJob).where(
            ArticleTtsJob.user_id == user_id,
            ArticleTtsJob.article_id == article_id,
            ArticleTtsJob.input_hash == input_hash,
        )
        return self.db.scalar(statement.execution_options(populate_existing=True))

    def claim_next_job(
        self,
        *,
        worker_id: str,
        now: datetime,
        lease_seconds: int,
        max_attempts: int,
    ) -> ArticleTtsJob | None:
        statement = build_article_tts_claim_statement(
            worker_id=worker_id,
            now=now,
            lease_seconds=lease_seconds,
            max_attempts=max_attempts,
        )
        job = self.db.scalar(statement.execution_options(synchronize_session=False))
        self.db.commit()
        if job is not None:
            self.db.refresh(job)
        return job

    def heartbeat_job(
        self,
        *,
        job_id: str,
        worker_id: str,
        now: datetime,
        lease_seconds: int,
    ) -> bool:
        statement = (
            update(ArticleTtsJob)
            .where(
                ArticleTtsJob.id == job_id,
                ArticleTtsJob.status == "processing",
                ArticleTtsJob.lease_owner == worker_id,
                ArticleTtsJob.lease_expires_at > now,
            )
            .values(
                heartbeat_at=now,
                lease_expires_at=now + timedelta(seconds=lease_seconds),
                updated_at=now,
            )
        )
        result = self.db.execute(statement.execution_options(synchronize_session=False))
        self.db.commit()
        return result.rowcount == 1

    def update_job_progress(
        self,
        *,
        job_id: str,
        worker_id: str,
        completed_segments: int,
        now: datetime,
    ) -> bool:
        statement = (
            update(ArticleTtsJob)
            .where(
                ArticleTtsJob.id == job_id,
                ArticleTtsJob.status == "processing",
                ArticleTtsJob.lease_owner == worker_id,
                ArticleTtsJob.lease_expires_at > now,
                ArticleTtsJob.total_segments >= completed_segments,
                ArticleTtsJob.completed_segments <= completed_segments,
            )
            .values(completed_segments=completed_segments, updated_at=now)
        )
        result = self.db.execute(statement.execution_options(synchronize_session=False))
        self.db.commit()
        return result.rowcount == 1

    def complete_job(
        self,
        *,
        job_id: str,
        worker_id: str,
        asset_id: str,
        now: datetime,
    ) -> bool:
        statement = (
            update(ArticleTtsJob)
            .where(
                ArticleTtsJob.id == job_id,
                ArticleTtsJob.status == "processing",
                ArticleTtsJob.lease_owner == worker_id,
                ArticleTtsJob.lease_expires_at > now,
            )
            .values(
                status="done",
                asset_id=asset_id,
                completed_segments=ArticleTtsJob.total_segments,
                error_code=None,
                error_message=None,
                failed_segment_id=None,
                failed_segment_order=None,
                lease_owner=None,
                lease_expires_at=None,
                heartbeat_at=None,
                finished_at=now,
                updated_at=now,
            )
        )
        result = self.db.execute(statement.execution_options(synchronize_session=False))
        self.db.commit()
        return result.rowcount == 1

    def fail_job(
        self,
        *,
        job_id: str,
        worker_id: str,
        error_code: str,
        error_message: str | None,
        now: datetime,
        failed_segment_id: str | None = None,
        failed_segment_order: int | None = None,
    ) -> bool:
        statement = (
            update(ArticleTtsJob)
            .where(
                ArticleTtsJob.id == job_id,
                ArticleTtsJob.status == "processing",
                ArticleTtsJob.lease_owner == worker_id,
                ArticleTtsJob.lease_expires_at > now,
            )
            .values(
                status="failed",
                error_code=error_code,
                error_message=error_message,
                failed_segment_id=failed_segment_id,
                failed_segment_order=failed_segment_order,
                lease_owner=None,
                lease_expires_at=None,
                heartbeat_at=None,
                finished_at=now,
                updated_at=now,
            )
        )
        result = self.db.execute(statement.execution_options(synchronize_session=False))
        self.db.commit()
        return result.rowcount == 1

    def requeue_expired_jobs(self, *, now: datetime, max_attempts: int) -> tuple[int, int]:
        expired = and_(
            ArticleTtsJob.status == "processing",
            or_(
                ArticleTtsJob.lease_expires_at.is_(None),
                ArticleTtsJob.lease_expires_at <= now,
            ),
        )
        requeued = self.db.execute(
            update(ArticleTtsJob)
            .where(expired, ArticleTtsJob.attempt_count < max_attempts)
            .values(
                status="queued",
                lease_owner=None,
                lease_expires_at=None,
                heartbeat_at=None,
                updated_at=now,
            )
            .execution_options(synchronize_session=False)
        )
        exhausted = self.db.execute(
            update(ArticleTtsJob)
            .where(expired, ArticleTtsJob.attempt_count >= max_attempts)
            .values(
                status="failed",
                error_code="worker_lease_expired",
                error_message="Worker lease expired and the retry limit was reached.",
                lease_owner=None,
                lease_expires_at=None,
                heartbeat_at=None,
                finished_at=now,
                updated_at=now,
            )
            .execution_options(synchronize_session=False)
        )
        self.db.commit()
        return requeued.rowcount, exhausted.rowcount

    def retry_failed_job(
        self,
        *,
        job_id: str,
        user_id: str,
        now: datetime,
        max_attempts: int,
    ) -> ArticleTtsJob | None:
        statement = (
            update(ArticleTtsJob)
            .where(
                ArticleTtsJob.id == job_id,
                ArticleTtsJob.user_id == user_id,
                ArticleTtsJob.status == "failed",
                ArticleTtsJob.attempt_count < max_attempts,
            )
            .values(
                status="queued",
                error_code=None,
                error_message=None,
                failed_segment_id=None,
                failed_segment_order=None,
                lease_owner=None,
                lease_expires_at=None,
                heartbeat_at=None,
                finished_at=None,
                updated_at=now,
            )
            .returning(ArticleTtsJob)
        )
        job = self.db.scalar(statement.execution_options(synchronize_session=False))
        self.db.commit()
        if job is not None:
            self.db.refresh(job)
        return job

    def create_asset(self, asset: ArticleTtsAsset) -> ArticleTtsAsset:
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def update_asset(self, asset: ArticleTtsAsset) -> ArticleTtsAsset:
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def mark_asset_building(self, asset: ArticleTtsAsset, *, updated_at: datetime) -> ArticleTtsAsset:
        asset.status = "building"
        asset.audio_path = None
        asset.duration_ms = None
        asset.file_size = None
        asset.timeline_json = None
        asset.ready_at = None
        asset.updated_at = updated_at
        return self.update_asset(asset)

    def mark_asset_failed(self, asset: ArticleTtsAsset, *, updated_at: datetime) -> ArticleTtsAsset:
        asset.status = "failed"
        asset.audio_path = None
        asset.duration_ms = None
        asset.file_size = None
        asset.timeline_json = None
        asset.ready_at = None
        asset.updated_at = updated_at
        return self.update_asset(asset)

    def publish_asset(
        self,
        *,
        asset: ArticleTtsAsset,
        audio_path: str,
        duration_ms: int,
        file_size: int,
        timeline_json: str,
        mappings: list[ArticleTtsAssetSegment],
        ready_at: datetime,
    ) -> ArticleTtsAsset:
        self.db.execute(
            delete(ArticleTtsAssetSegment).where(
                ArticleTtsAssetSegment.article_tts_asset_id == asset.id
            )
        )
        for mapping in mappings:
            self.db.add(mapping)
        asset.status = "ready"
        asset.audio_path = audio_path
        asset.duration_ms = duration_ms
        asset.file_size = file_size
        asset.timeline_json = timeline_json
        asset.ready_at = ready_at
        asset.updated_at = ready_at
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def get_asset_for_user(self, *, asset_id: str, user_id: str) -> ArticleTtsAsset | None:
        statement = select(ArticleTtsAsset).where(
            ArticleTtsAsset.id == asset_id,
            ArticleTtsAsset.user_id == user_id,
        )
        return self.db.scalar(statement.execution_options(populate_existing=True))

    def get_asset_by_input(
        self,
        *,
        user_id: str,
        article_id: str,
        input_hash: str,
        ready_only: bool = False,
    ) -> ArticleTtsAsset | None:
        statement = select(ArticleTtsAsset).where(
            ArticleTtsAsset.user_id == user_id,
            ArticleTtsAsset.article_id == article_id,
            ArticleTtsAsset.input_hash == input_hash,
        )
        if ready_only:
            statement = statement.where(ArticleTtsAsset.status == "ready")
        return self.db.scalar(statement.execution_options(populate_existing=True))

    def add_asset_segment(self, mapping: ArticleTtsAssetSegment) -> ArticleTtsAssetSegment:
        self.db.add(mapping)
        self.db.commit()
        self.db.refresh(mapping)
        return mapping

    def list_asset_segments_for_user(
        self,
        *,
        asset_id: str,
        user_id: str,
    ) -> list[ArticleTtsAssetSegment]:
        statement = (
            select(ArticleTtsAssetSegment)
            .join(
                ArticleTtsAsset,
                ArticleTtsAsset.id == ArticleTtsAssetSegment.article_tts_asset_id,
            )
            .where(
                ArticleTtsAssetSegment.article_tts_asset_id == asset_id,
                ArticleTtsAsset.user_id == user_id,
            )
            .order_by(ArticleTtsAssetSegment.segment_order.asc())
        )
        return list(self.db.scalars(statement).all())
