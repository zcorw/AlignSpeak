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
