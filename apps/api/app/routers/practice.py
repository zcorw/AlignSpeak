from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.application.usecases.practice_usecase import (
    align_attempt,
    delete_segment_reading_override,
    finish_recording,
    get_attempt_result,
    get_article_progress,
    get_segment_reading,
    get_stt_job_status,
    process_stt_job,
    start_recording,
    upsert_segment_reading_overrides,
    upload_recording_chunk,
)
from app.db import get_db
from app.deps import get_current_user
from app.infrastructure.repositories.practice_repository import PracticeRepository
from app.models import User
from app.schemas.practice import (
    AlignAttemptPayload,
    AlignResultResponse,
    FinishRecordingPayload,
    FinishRecordingResponse,
    PracticeAttemptResultResponse,
    PracticeArticleProgressResponse,
    SegmentReadingResponse,
    StartRecordingPayload,
    StartRecordingResponse,
    SttJobStatusResponse,
    UpsertSegmentReadingOverridesPayload,
    UploadChunkResponse,
)

router = APIRouter(tags=["practice"])


@router.get("/practice/attempts/{attempt_id}/result", response_model=PracticeAttemptResultResponse)
def get_practice_attempt_result(
    attempt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PracticeAttemptResultResponse:
    repository = PracticeRepository(db=db)
    return get_attempt_result(
        repository=repository,
        current_user=current_user,
        attempt_id=attempt_id,
    )


@router.get("/practice/articles/{article_id}/progress", response_model=PracticeArticleProgressResponse)
def get_article_practice_progress(
    article_id: str,
    level: str = Query(default="L1", pattern="^L[1-4]$"),
    current_segment_order: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PracticeArticleProgressResponse:
    repository = PracticeRepository(db=db)
    return get_article_progress(
        repository=repository,
        current_user=current_user,
        article_id=article_id,
        current_level=level,
        current_segment_order=current_segment_order,
    )


@router.get("/practice/segments/{segment_id}/reading", response_model=SegmentReadingResponse)
def get_practice_segment_reading(
    segment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SegmentReadingResponse:
    repository = PracticeRepository(db=db)
    return get_segment_reading(
        repository=repository,
        current_user=current_user,
        segment_id=segment_id,
    )


@router.put("/practice/segments/{segment_id}/reading-overrides", response_model=SegmentReadingResponse)
def put_practice_segment_reading_overrides(
    segment_id: str,
    payload: UpsertSegmentReadingOverridesPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SegmentReadingResponse:
    repository = PracticeRepository(db=db)
    return upsert_segment_reading_overrides(
        repository=repository,
        current_user=current_user,
        segment_id=segment_id,
        payload=payload,
    )


@router.delete("/practice/segments/{segment_id}/reading-overrides/{token_index}", response_model=SegmentReadingResponse)
def remove_practice_segment_reading_override(
    segment_id: str,
    token_index: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SegmentReadingResponse:
    repository = PracticeRepository(db=db)
    return delete_segment_reading_override(
        repository=repository,
        current_user=current_user,
        segment_id=segment_id,
        token_index=token_index,
    )


@router.post("/practice/segments/{segment_id}/recordings/start", response_model=StartRecordingResponse, status_code=status.HTTP_201_CREATED)
def start_segment_recording(
    segment_id: str,
    _payload: StartRecordingPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StartRecordingResponse:
    repository = PracticeRepository(db=db)
    return start_recording(
        repository=repository,
        current_user=current_user,
        segment_id=segment_id,
    )


@router.post("/practice/recordings/{recording_id}/chunks", response_model=UploadChunkResponse)
async def upload_segment_recording_chunk(
    recording_id: str,
    request: Request,
    seq: int = Query(ge=0),
    duration_ms: int | None = Query(default=None, ge=0, le=600000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UploadChunkResponse:
    content_type = request.headers.get("content-type", "")
    chunk_data = await request.body()
    repository = PracticeRepository(db=db)
    return upload_recording_chunk(
        repository=repository,
        current_user=current_user,
        recording_id=recording_id,
        seq=seq,
        duration_ms=duration_ms,
        content_type=content_type,
        chunk_data=chunk_data,
    )


@router.post("/practice/recordings/{recording_id}/finish", response_model=FinishRecordingResponse, status_code=status.HTTP_202_ACCEPTED)
def finish_segment_recording(
    recording_id: str,
    payload: FinishRecordingPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FinishRecordingResponse:
    repository = PracticeRepository(db=db)
    response = finish_recording(
        repository=repository,
        current_user=current_user,
        recording_id=recording_id,
        total_chunks=payload.total_chunks,
        duration_ms=payload.duration_ms,
    )
    background_tasks.add_task(process_stt_job, response.job_id)
    return response


@router.get("/stt-jobs/{job_id}", response_model=SttJobStatusResponse)
def get_segment_stt_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SttJobStatusResponse:
    repository = PracticeRepository(db=db)
    return get_stt_job_status(
        repository=repository,
        current_user=current_user,
        job_id=job_id,
    )


@router.post("/practice/attempts/{attempt_id}/align", response_model=AlignResultResponse)
def align_practice_attempt(
    attempt_id: str,
    payload: AlignAttemptPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AlignResultResponse:
    repository = PracticeRepository(db=db)
    return align_attempt(
        repository=repository,
        current_user=current_user,
        attempt_id=attempt_id,
        payload=payload,
    )
