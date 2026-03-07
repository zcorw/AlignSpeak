from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.application.usecases.protected_me_usecase import (
    build_bff_me_payload,
    build_me_summary_payload,
)
from app.db import get_db
from app.deps import get_current_user
from app.mock_data import HOME_SUMMARY, PROGRESS_SUMMARY, get_practice_bundle, get_practice_result
from app.models import User
from app.infrastructure.repositories.protected_repository import ProtectedReadRepository

router = APIRouter(tags=["protected"])


class PracticeRecognitionRequest(BaseModel):
    docId: str | None = None
    segmentId: str | None = None


def _snake_to_camel(key: str) -> str:
    parts = key.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


def _to_camel_case(value: Any) -> Any:
    if isinstance(value, list):
        return [_to_camel_case(item) for item in value]
    if isinstance(value, dict):
        return {_snake_to_camel(str(key)): _to_camel_case(item) for key, item in value.items()}
    return value


# Legacy endpoints: keep for compatibility with current frontend clients.
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
def me_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    repository = ProtectedReadRepository(db=db)
    return build_me_summary_payload(repository=repository, current_user=current_user)


# BFF v1 endpoints documented in apps/api/docs/BFF_MODULE.md
@router.get("/bff/v1/home")
def bff_home(_current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    payload = _to_camel_case(HOME_SUMMARY)
    payload["warnings"] = []
    return payload


@router.get("/bff/v1/practice")
def bff_practice(
    docId: str | None = Query(default=None),
    segmentId: str | None = Query(default=None),
    _current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    payload = _to_camel_case(get_practice_bundle(docId=docId, segment_id=segmentId))
    payload["warnings"] = []
    return payload


@router.get("/bff/v1/progress")
def bff_progress(_current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    accuracy_rate = float(PROGRESS_SUMMARY.get("accuracy_rate", 0))
    current_level = PROGRESS_SUMMARY.get("current_level", 1)
    hot_words = PROGRESS_SUMMARY.get("hot_words", [])
    return {
        "summary": {
            "overallAccuracy30d": accuracy_rate / 100,
            "currentLevel": current_level,
        },
        "hotwords": _to_camel_case(hot_words),
        "warnings": [],
    }


@router.get("/bff/v1/me")
def bff_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    repository = ProtectedReadRepository(db=db)
    return build_bff_me_payload(repository=repository, current_user=current_user)
