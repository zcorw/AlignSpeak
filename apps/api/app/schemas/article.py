from datetime import datetime

from pydantic import BaseModel, Field


class ArticleCreateSegment(BaseModel):
    id: str
    order: int
    preview: str


class ArticleCreateResponse(BaseModel):
    article_id: str
    title: str
    language: str
    segments: list[ArticleCreateSegment]


class ArticleDetailSegment(BaseModel):
    id: str
    order: int
    plain_text: str
    token_count: int


class ArticleDetailResponse(BaseModel):
    article_id: str
    title: str
    language: str
    source_type: str
    raw_text: str
    normalized_text: str
    segments: list[ArticleDetailSegment]
    created_at: datetime


class ArticleListItem(BaseModel):
    article_id: str
    title: str
    language: str
    segment_count: int
    created_at: datetime


class ArticleListResponse(BaseModel):
    items: list[ArticleListItem]
    next_cursor: str | None = None


class CreateArticlePayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    language: str
    source_type: str
    text: str
