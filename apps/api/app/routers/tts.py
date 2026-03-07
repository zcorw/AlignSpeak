from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.application.usecases.tts_usecase import create_tts_job, get_segment_tts, get_tts_job, resolve_tts_media_file
from app.db import get_db
from app.deps import get_current_user
from app.infrastructure.repositories.tts_repository import TtsRepository
from app.models import User
from app.schemas.tts import CreateTtsJobPayload, SegmentTtsResponse, TtsJobCreateResponse, TtsJobStatusResponse

router = APIRouter(tags=["tts"])


@router.post("/articles/{article_id}/tts-jobs", response_model=TtsJobCreateResponse, status_code=status.HTTP_202_ACCEPTED)
def create_segment_tts_job(
    article_id: str,
    payload: CreateTtsJobPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TtsJobCreateResponse:
    repository = TtsRepository(db=db)
    return create_tts_job(
        repository=repository,
        current_user=current_user,
        article_id=article_id,
        segment_id=payload.segment_id,
        speed=payload.speed,
    )


@router.get("/tts-jobs/{job_id}", response_model=TtsJobStatusResponse)
def get_tts_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
) -> TtsJobStatusResponse:
    return get_tts_job(current_user=current_user, job_id=job_id)


@router.get("/segments/{segment_id}/tts", response_model=SegmentTtsResponse)
def get_segment_tts_asset(
    segment_id: str,
    speed: float = Query(default=1.0, ge=0.8, le=1.2),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SegmentTtsResponse:
    repository = TtsRepository(db=db)
    return get_segment_tts(
        repository=repository,
        current_user=current_user,
        segment_id=segment_id,
        speed=speed,
    )


@router.get("/media/tts/{filename}")
def get_tts_media(
    filename: str,
    _current_user: User = Depends(get_current_user),
) -> FileResponse:
    media_path = resolve_tts_media_file(filename=filename)
    return FileResponse(path=media_path, media_type="audio/mpeg")
