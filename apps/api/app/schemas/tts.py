from pydantic import BaseModel, Field


class CreateTtsJobPayload(BaseModel):
    segment_id: str = Field(min_length=1, max_length=64)
    speed: float = Field(default=1.0, ge=0.8, le=1.2)


class TtsJobCreateResponse(BaseModel):
    job_id: str
    status: str


class TtsJobStatusResponse(BaseModel):
    job_id: str
    status: str
    audio_url: str | None = None
    cached: bool | None = None
    error_code: str | None = None


class SegmentTtsResponse(BaseModel):
    segment_id: str
    audio_url: str
    voice: str
    speed: float

