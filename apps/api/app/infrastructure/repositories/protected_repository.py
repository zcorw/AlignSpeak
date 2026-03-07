from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Article


class ProtectedReadRepository:
    """Read-side queries used by protected/BFF endpoints."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_recent_articles_by_user(self, user_id: str, limit: int = 20) -> list[Article]:
        statement = (
            select(Article)
            .where(Article.user_id == user_id)
            .order_by(Article.updated_at.desc(), Article.id.desc())
            .limit(limit)
        )
        return self.db.scalars(statement).all()

