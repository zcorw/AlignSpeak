from datetime import datetime

from pydantic import BaseModel, Field


class CreateArticleTtsJobPayload(BaseModel):
    force_refresh: bool = False


class ArticleTtsTimelineSentence(BaseModel):
    segment_id: str
    segment_order: int = Field(ge=1)
    sentence_index: int = Field(ge=0)
    text: str
    start_ms: float = Field(ge=0)
    end_ms: float = Field(ge=0)


class ArticleTtsFailedSegment(BaseModel):
    segment_id: str | None = None
    segment_order: int | None = Field(default=None, ge=1)


class ArticleTtsAssetResponse(BaseModel):
    asset_id: str
    article_id: str
    input_hash: str
    audio_url: str
    duration_ms: int = Field(gt=0)
    file_size: int = Field(gt=0)
    voice: str
    speed: float
    timeline_version: str
    timeline: list[ArticleTtsTimelineSentence]
    ready_at: datetime


class ArticleTtsJobResponse(BaseModel):
    job_id: str
    article_id: str
    input_hash: str
    status: str
    total_segments: int = Field(ge=0)
    completed_segments: int = Field(ge=0)
    failed_segment: ArticleTtsFailedSegment | None = None
    error_code: str | None = None
    error_message: str | None = None
    asset: ArticleTtsAssetResponse | None = None


class ArticleTtsEstimate(BaseModel):
    bytes: int = Field(ge=0)
    is_estimate: bool


class CurrentArticleTtsResponse(BaseModel):
    article_id: str
    input_hash: str
    is_stale: bool
    estimate: ArticleTtsEstimate
    asset: ArticleTtsAssetResponse | None = None
    job: ArticleTtsJobResponse | None = None
