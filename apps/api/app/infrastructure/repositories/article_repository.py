from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models import Article, ArticleSegment
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
                )
            )
        )

    def list_segments_by_article_id(self, article_id: str) -> list[ArticleSegment]:
        return self.db.scalars(
            select(ArticleSegment)
            .where(ArticleSegment.article_id == article_id)
            .order_by(ArticleSegment.segment_order.asc())
        ).all()

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
            .where(Article.user_id == user_id)
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

