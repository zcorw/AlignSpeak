from pydantic import BaseModel, Field


class StartRecordingPayload(BaseModel):
    client_ts: str | None = None


class StartRecordingResponse(BaseModel):
    recording_id: str
    status: str


class UploadChunkResponse(BaseModel):
    recording_id: str
    seq: int
    accepted: bool


class FinishRecordingPayload(BaseModel):
    total_chunks: int = Field(ge=1, le=10000)
    duration_ms: int = Field(ge=0, le=600000)
    level: str = Field(default="L0", pattern="^L[0-4]$")


class FinishRecordingResponse(BaseModel):
    recording_id: str
    job_id: str
    status: str


class SttJobStatusResponse(BaseModel):
    job_id: str
    status: str
    attempt_id: str | None = None
    recognized_text: str | None = None
    confidence: float | None = None
    provider: str | None = None
    model: str | None = None
    error_code: str | None = None


class AlignAttemptPayload(BaseModel):
    segment_id: str | None = None
    recognized_text: str | None = None


class AlignToken(BaseModel):
    text: str
    status: str


class CompareBlock(BaseModel):
    block_order: int
    reference: list[AlignToken]
    recognized: list[AlignToken]


class NoiseSpan(BaseModel):
    start_token: int
    end_token: int
    reason: str


class AlignResultResponse(BaseModel):
    accuracy_rate: float
    ref_tokens: list[AlignToken]
    hyp_tokens: list[AlignToken]
    compare_blocks: list[CompareBlock]
    noise_spans: list[NoiseSpan]


class SegmentReadingToken(BaseModel):
    token_index: int = Field(ge=0)
    surface: str
    yomi: str | None = None
    reading_candidates: list[str] | None = None
    reading_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    needs_confirmation: bool = False
    editable: bool
    source: str


class SegmentReadingResponse(BaseModel):
    segment_id: str
    language: str
    tokens: list[SegmentReadingToken]


class SegmentReadingOverrideItem(BaseModel):
    token_index: int = Field(ge=0)
    surface: str = Field(min_length=1, max_length=128)
    yomi: str | None = Field(default=None, max_length=128)


class UpsertSegmentReadingOverridesPayload(BaseModel):
    overrides: list[SegmentReadingOverrideItem] = Field(default_factory=list, max_length=512)


class PracticeProgressCell(BaseModel):
    segment_order: int = Field(ge=1)
    state: str
    attempt_count: int = Field(default=0, ge=0)
    best_accuracy: float | None = None


class PracticeProgressLevel(BaseModel):
    level: str
    cells: list[PracticeProgressCell]


class PracticeArticleProgressResponse(BaseModel):
    article_id: str
    total_segments: int = Field(ge=0)
    pass_threshold: float
    current_level: str
    levels: list[PracticeProgressLevel]
    recent_scores: list[int] = Field(default_factory=list)


class PracticeAttemptResultResponse(BaseModel):
    attempt_id: str
    article_id: str
    article_title: str
    segment_id: str
    segment_order: int = Field(ge=1)
    total_segments: int = Field(ge=0)
    attempt_count: int = Field(ge=0)
    accuracy_rate: float = Field(ge=0)
    ref_tokens: list[AlignToken]
    hyp_tokens: list[AlignToken]
    correct_count: int = Field(ge=0)
    wrong_count: int = Field(ge=0)
    missed_count: int = Field(ge=0)
    inserted_count: int = Field(ge=0)
