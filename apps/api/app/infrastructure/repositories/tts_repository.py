from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Article, ArticleSegment, TtsAsset


class TtsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_segment_for_user_in_article(
        self,
        *,
        article_id: str,
        segment_id: str,
        user_id: str,
    ) -> tuple[Article, ArticleSegment] | None:
        statement = (
            select(Article, ArticleSegment)
            .join(ArticleSegment, ArticleSegment.article_id == Article.id)
            .where(
                Article.id == article_id,
                Article.user_id == user_id,
                ArticleSegment.id == segment_id,
            )
        )
        row = self.db.execute(statement).first()
        if row is None:
            return None
        return row[0], row[1]

    def get_segment_for_user(self, *, segment_id: str, user_id: str) -> tuple[Article, ArticleSegment] | None:
        statement = (
            select(Article, ArticleSegment)
            .join(ArticleSegment, ArticleSegment.article_id == Article.id)
            .where(
                Article.user_id == user_id,
                ArticleSegment.id == segment_id,
            )
        )
        row = self.db.execute(statement).first()
        if row is None:
            return None
        return row[0], row[1]

    def get_tts_asset(self, *, segment_id: str, voice: str, speed: float, text_hash: str) -> TtsAsset | None:
        statement = select(TtsAsset).where(
            TtsAsset.segment_id == segment_id,
            TtsAsset.voice == voice,
            TtsAsset.speed == speed,
            TtsAsset.text_hash == text_hash,
        )
        return self.db.scalar(statement)

    def create_tts_asset(self, asset: TtsAsset) -> TtsAsset:
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

