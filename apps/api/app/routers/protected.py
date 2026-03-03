from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.deps import get_current_user
from app.mock_data import HOME_SUMMARY, PROGRESS_SUMMARY, get_practice_bundle, get_practice_result
from app.models import User

router = APIRouter(prefix="/api", tags=["protected"])


class PracticeRecognitionRequest(BaseModel):
    docId: str | None = None
    segmentId: str | None = None


@router.get("/home-summary")
def home_summary(_current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    return HOME_SUMMARY


@router.get("/practice-bundle")
def practice_bundle(
    docId: str | None = None,
    segmentId: str | None = None,
    _current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    return get_practice_bundle(docId=docId, segment_id=segmentId)


@router.post("/practice-recognition")
def practice_recognition(
    payload: PracticeRecognitionRequest,
    _current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    return get_practice_result(doc_id=payload.docId, segment_id=payload.segmentId)


@router.get("/progress-summary")
def progress_summary(_current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    return PROGRESS_SUMMARY


@router.get("/me-summary")
def me_summary(current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    return {
        "email": current_user.email,
        "streak_days": 5,
        "history_docs": [
            {
                "id": "doc-ja",
                "title": "枕草子（春は、あけぼの）",
                "last_practiced_at": "2026-03-03T09:40:00Z",
                "level": 2,
                "progress_rate": 60,
            },
            {
                "id": "doc-en",
                "title": "The Road Not Taken",
                "last_practiced_at": "2026-03-02T21:10:00Z",
                "level": 1,
                "progress_rate": 35,
            },
        ],
    }
