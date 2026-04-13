from datetime import datetime

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.orm import Session

from app.models import (
    Article,
    ArticleSegment,
    PracticeAttempt,
    PracticeRecording,
    SegmentReadingOverride,
    SegmentTokenOverride,
    TtsAsset,
)
from app.services.article_service import CursorPosition


class ArticleRepository:
    """Persistence operations for article aggregate."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create_article_with_segments(self, article: Article, segments: list[ArticleSegment]) -> None:
        self.db.add(article)
        for segment in segments:
            self.db.add(segment)
        self.db.commit()

    def get_article_by_id_for_user(self, article_id: str, user_id: str) -> Article | None:
        return self.db.scalar(
            select(Article).where(
                and_(
                    Article.id == article_id,
                    Article.user_id == user_id,
                    Article.deleted_at.is_(None),
                )
            )
        )

    def get_article_by_id_for_user_including_deleted(self, article_id: str, user_id: str) -> Article | None:
        return self.db.scalar(
            select(Article).where(
                and_(
                    Article.id == article_id,
                    Article.user_id == user_id,
                )
            )
        )

    def list_segments_by_article_id(self, article_id: str) -> list[ArticleSegment]:
        return self.db.scalars(
            select(ArticleSegment)
            .join(Article, Article.id == ArticleSegment.article_id)
            .where(ArticleSegment.article_id == article_id)
            .where(Article.deleted_at.is_(None))
            .order_by(ArticleSegment.segment_order.asc())
        ).all()

    def get_segment_by_order(self, *, article_id: str, segment_order: int) -> ArticleSegment | None:
        return self.db.scalar(
            select(ArticleSegment)
            .join(Article, Article.id == ArticleSegment.article_id)
            .where(
                ArticleSegment.article_id == article_id,
                ArticleSegment.segment_order == segment_order,
                Article.deleted_at.is_(None),
            )
        )

    def list_articles_with_segment_count(
        self,
        *,
        user_id: str,
        limit: int,
        cursor: CursorPosition | None,
    ) -> tuple[list[tuple[Article, int]], bool]:
        segment_count_subquery = (
            select(
                ArticleSegment.article_id.label("article_id"),
                func.count(ArticleSegment.id).label("segment_count"),
            )
            .group_by(ArticleSegment.article_id)
            .subquery()
        )

        statement = (
            select(
                Article,
                func.coalesce(segment_count_subquery.c.segment_count, 0).label("segment_count"),
            )
            .outerjoin(segment_count_subquery, segment_count_subquery.c.article_id == Article.id)
            .where(
                Article.user_id == user_id,
                Article.deleted_at.is_(None),
            )
            .order_by(Article.created_at.desc(), Article.id.desc())
        )

        if cursor:
            statement = statement.where(
                or_(
                    Article.created_at < cursor.created_at,
                    and_(
                        Article.created_at == cursor.created_at,
                        Article.id < cursor.article_id,
                    ),
                )
            )

        rows = self.db.execute(statement.limit(limit + 1)).all()
        has_more = len(rows) > limit
        return rows[:limit], has_more

    def count_practice_history_for_article(self, *, article_id: str, user_id: str) -> int:
        attempts_statement = select(func.count(PracticeAttempt.id)).where(
            PracticeAttempt.article_id == article_id,
            PracticeAttempt.user_id == user_id,
        )
        recordings_statement = select(func.count(PracticeRecording.id)).where(
            PracticeRecording.article_id == article_id,
            PracticeRecording.user_id == user_id,
        )
        attempt_count = int(self.db.scalar(attempts_statement) or 0)
        recording_count = int(self.db.scalar(recordings_statement) or 0)
        return attempt_count + recording_count

    def replace_article_content(
        self,
        *,
        article: Article,
        language: str,
        raw_text: str,
        normalized_text: str,
        segments: list[ArticleSegment],
        updated_at: datetime,
    ) -> None:
        old_segment_ids = list(
            self.db.scalars(
                select(ArticleSegment.id).where(ArticleSegment.article_id == article.id)
            ).all()
        )
        if old_segment_ids:
            self.db.execute(delete(SegmentReadingOverride).where(SegmentReadingOverride.segment_id.in_(old_segment_ids)))
            self.db.execute(delete(SegmentTokenOverride).where(SegmentTokenOverride.segment_id.in_(old_segment_ids)))
            self.db.execute(delete(TtsAsset).where(TtsAsset.segment_id.in_(old_segment_ids)))
            self.db.execute(delete(ArticleSegment).where(ArticleSegment.article_id == article.id))
        article.language = language
        article.raw_text = raw_text
        article.normalized_text = normalized_text
        article.updated_at = updated_at
        self.db.add(article)
        for segment in segments:
            self.db.add(segment)
        self.db.commit()

    def update_article_title(self, *, article: Article, title: str, updated_at: datetime) -> None:
        article.title = title
        article.updated_at = updated_at
        self.db.add(article)
        self.db.commit()

    def soft_delete_article(self, *, article: Article, deleted_at: datetime) -> None:
        article.deleted_at = deleted_at
        article.updated_at = deleted_at
        self.db.add(article)
        self.db.commit()
