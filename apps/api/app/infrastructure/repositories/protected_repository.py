from datetime import datetime

from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.models import Article, ArticleSegment, PracticeAttempt


class ProtectedReadRepository:
    """Read-side queries used by protected/BFF endpoints."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_recent_articles_by_user(self, user_id: str, limit: int = 20) -> list[Article]:
        statement = (
            select(Article)
            .where(
                Article.user_id == user_id,
                Article.deleted_at.is_(None),
            )
            .order_by(Article.updated_at.desc(), Article.id.desc())
            .limit(limit)
        )
        return self.db.scalars(statement).all()

    def get_article_progress_snapshots(
        self,
        *,
        user_id: str,
        article_ids: list[str],
        pass_threshold: float = 85.0,
    ) -> dict[str, dict[str, int | datetime | None]]:
        if not article_ids:
            return {}

        snapshots: dict[str, dict[str, int | datetime | None]] = {
            article_id: {
                "total_segments": 0,
                "passed_segments": 0,
                "practice_count": 0,
                "last_practiced_at": None,
            }
            for article_id in article_ids
        }

        total_statement = (
            select(ArticleSegment.article_id, func.count(ArticleSegment.id))
            .where(ArticleSegment.article_id.in_(article_ids))
            .group_by(ArticleSegment.article_id)
        )
        for article_id, total_segments in self.db.execute(total_statement).all():
            snapshots[str(article_id)]["total_segments"] = int(total_segments)

        passed_statement = (
            select(PracticeAttempt.article_id, func.count(distinct(PracticeAttempt.segment_id)))
            .where(
                PracticeAttempt.user_id == user_id,
                PracticeAttempt.article_id.in_(article_ids),
                PracticeAttempt.status == "done",
                PracticeAttempt.accuracy_rate.is_not(None),
                PracticeAttempt.accuracy_rate >= pass_threshold,
            )
            .group_by(PracticeAttempt.article_id)
        )
        for article_id, passed_segments in self.db.execute(passed_statement).all():
            snapshots[str(article_id)]["passed_segments"] = int(passed_segments)

        attempt_count_statement = (
            select(PracticeAttempt.article_id, func.count(PracticeAttempt.id))
            .where(
                PracticeAttempt.user_id == user_id,
                PracticeAttempt.article_id.in_(article_ids),
            )
            .group_by(PracticeAttempt.article_id)
        )
        for article_id, practice_count in self.db.execute(attempt_count_statement).all():
            snapshots[str(article_id)]["practice_count"] = int(practice_count)

        latest_statement = (
            select(PracticeAttempt.article_id, func.max(PracticeAttempt.submitted_at))
            .where(
                PracticeAttempt.user_id == user_id,
                PracticeAttempt.article_id.in_(article_ids),
            )
            .group_by(PracticeAttempt.article_id)
        )
        for article_id, last_practiced_at in self.db.execute(latest_statement).all():
            snapshots[str(article_id)]["last_practiced_at"] = last_practiced_at

        return snapshots
