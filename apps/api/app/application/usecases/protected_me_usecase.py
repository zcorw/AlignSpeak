from datetime import datetime
from typing import Any

from app.infrastructure.repositories.protected_repository import ProtectedReadRepository
from app.models import User


def _to_iso8601(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.isoformat()


def _build_history_docs(repository: ProtectedReadRepository, current_user: User, limit: int = 20) -> list[dict[str, Any]]:
    articles = repository.list_recent_articles_by_user(user_id=current_user.id, limit=limit)
    return [
        {
            "id": article.id,
            "title": article.title,
            "last_practiced_at": _to_iso8601(article.updated_at),
            # Progress module is not persisted yet; keep deterministic defaults.
            "level": 1,
            "progress_rate": 0,
        }
        for article in articles
    ]


def build_me_summary_payload(repository: ProtectedReadRepository, current_user: User) -> dict[str, Any]:
    return {
        "email": current_user.email,
        "streak_days": 0,
        "history_docs": _build_history_docs(repository=repository, current_user=current_user),
    }


def build_bff_me_payload(repository: ProtectedReadRepository, current_user: User) -> dict[str, Any]:
    history_docs = _build_history_docs(repository=repository, current_user=current_user)
    return {
        "email": current_user.email,
        "streakDays": 0,
        "progress": {
            "overallAccuracy30d": 0,
            "currentLevel": 1,
        },
        "historyDocs": [
            {
                "id": item["id"],
                "title": item["title"],
                "lastPracticedAt": item["last_practiced_at"],
                "level": item["level"],
                "progressRate": float(item["progress_rate"]) / 100,
            }
            for item in history_docs
        ],
        "warnings": [],
    }

