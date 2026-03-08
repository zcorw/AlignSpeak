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
    article_ids = [article.id for article in articles]
    progress_snapshots = repository.get_article_progress_snapshots(
        user_id=current_user.id,
        article_ids=article_ids,
    )

    history_docs: list[dict[str, Any]] = []
    for article in articles:
        snapshot = progress_snapshots.get(article.id, {})
        total_segments = int(snapshot.get("total_segments", 0) or 0)
        passed_segments = int(snapshot.get("passed_segments", 0) or 0)
        practice_count = int(snapshot.get("practice_count", 0) or 0)
        safe_passed_segments = min(max(passed_segments, 0), total_segments) if total_segments > 0 else 0
        progress_rate = round((safe_passed_segments / total_segments) * 100, 2) if total_segments > 0 else 0
        last_practiced_at = snapshot.get("last_practiced_at")
        current_segment_order = min(safe_passed_segments + 1, total_segments) if total_segments > 0 else 1

        history_docs.append(
            {
                "id": article.id,
                "title": article.title,
                "language": article.language,
                "last_practiced_at": _to_iso8601(last_practiced_at if isinstance(last_practiced_at, datetime) else article.updated_at),
                "level": 1,
                "progress_rate": progress_rate,
                "total_segments": total_segments,
                "passed_segments": safe_passed_segments,
                "current_segment_order": current_segment_order,
                "practice_count": practice_count,
                "is_done": total_segments > 0 and safe_passed_segments >= total_segments,
            }
        )

    return history_docs


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
                "language": item["language"],
                "lastPracticedAt": item["last_practiced_at"],
                "level": item["level"],
                "progressRate": float(item["progress_rate"]) / 100,
                "totalSegments": item["total_segments"],
                "passedSegments": item["passed_segments"],
                "currentSegmentOrder": item["current_segment_order"],
                "practiceCount": item["practice_count"],
                "isDone": item["is_done"],
            }
            for item in history_docs
        ],
        "warnings": [],
    }
