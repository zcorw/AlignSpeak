from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ArticleTtsAsset, ArticleTtsAssetSegment, ArticleTtsJob


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
        return self.db.scalar(statement)

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
        return self.db.scalar(statement)

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

    def get_asset_for_user(self, *, asset_id: str, user_id: str) -> ArticleTtsAsset | None:
        statement = select(ArticleTtsAsset).where(
            ArticleTtsAsset.id == asset_id,
            ArticleTtsAsset.user_id == user_id,
        )
        return self.db.scalar(statement)

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
        return self.db.scalar(statement)

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
