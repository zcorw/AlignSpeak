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
    detected_language: str
    detected_confidence: float | None = None
    detected_reliable: bool
    detected_raw_language: str
    segments: list[ArticleCreateSegment]


class ArticleReadingToken(BaseModel):
    surface: str
    yomi: str | None = None


class ArticleDetailSegment(BaseModel):
    id: str
    order: int
    plain_text: str
    token_count: int
    tokens: list[ArticleReadingToken] | None = None


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


class ArticleUpdatePayload(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    language: str | None = Field(default=None, min_length=2, max_length=8)
    text: str | None = Field(default=None, min_length=1, max_length=20000)


class ArticleUpdateResponse(BaseModel):
    article_id: str
    title: str
    language: str
    segment_count: int
    text_updated: bool
    updated_at: datetime


class ArticleDeleteResponse(BaseModel):
    article_id: str
    deleted_at: datetime
    status: str = "deleted"


class CreateArticlePayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    language: str
    text: str


class DetectLanguagePayload(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class DetectLanguageResponse(BaseModel):
    detected_language: str
    detected_confidence: float | None = None
    detected_reliable: bool
    detected_raw_language: str
    text_length: int


class UploadParseResponse(BaseModel):
    text: str
    source_type: str
    detected_language: str
    detected_confidence: float | None = None
    detected_reliable: bool
    detected_raw_language: str
    text_length: int


class UploadBatchUncertainPair(BaseModel):
    left: str
    right: str
    confidence: float | None = None


class UploadBatchOrderSuggestion(BaseModel):
    ordered_image_ids: list[str]
    overall_confidence: float | None = None
    reasoning_signals: list[str] = []
    uncertain_pairs: list[UploadBatchUncertainPair] = []
    warnings: list[str] = []
    fallback_used: bool = False


class UploadBatchItem(BaseModel):
    image_id: str
    filename: str
    source_type: str
    text: str
    text_length: int
    detected_language: str
    detected_confidence: float | None = None
    detected_reliable: bool
    detected_raw_language: str
    page_marker_candidates: list[str] = []
    warnings: list[str] = []
    suggested_order: int


class UploadParseBatchResponse(BaseModel):
    items: list[UploadBatchItem]
    order_suggestion: UploadBatchOrderSuggestion
    need_manual_confirm: bool = True
