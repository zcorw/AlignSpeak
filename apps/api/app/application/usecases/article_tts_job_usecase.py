from collections.abc import Callable
from datetime import datetime
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from app.infrastructure.repositories.article_tts_repository import ArticleTtsRepository
from app.models import ArticleTtsJob, utcnow


def create_or_get_article_tts_job(
    *,
    repository: ArticleTtsRepository,
    user_id: str,
    article_id: str,
    input_hash: str,
    total_segments: int,
    id_factory: Callable[[], str] | None = None,
    now: datetime | None = None,
) -> ArticleTtsJob:
    existing = repository.get_job_by_input(
        user_id=user_id,
        article_id=article_id,
        input_hash=input_hash,
    )
    if existing is not None:
        return existing

    make_id = id_factory or (lambda: f"atts_job_{uuid4().hex[:12]}")
    created_at = now or utcnow()
    job = ArticleTtsJob(
        id=make_id(),
        user_id=user_id,
        article_id=article_id,
        input_hash=input_hash,
        status="queued",
        total_segments=total_segments,
        completed_segments=0,
        attempt_count=0,
        created_at=created_at,
        updated_at=created_at,
    )
    try:
        return repository.create_job(job)
    except IntegrityError:
        repository.db.rollback()
        raced = repository.get_job_by_input(
            user_id=user_id,
            article_id=article_id,
            input_hash=input_hash,
        )
        if raced is None:
            raise
        return raced


def retry_article_tts_job(
    *,
    repository: ArticleTtsRepository,
    job_id: str,
    user_id: str,
    max_attempts: int,
    now: datetime | None = None,
) -> ArticleTtsJob | None:
    return repository.retry_failed_job(
        job_id=job_id,
        user_id=user_id,
        now=now or utcnow(),
        max_attempts=max_attempts,
    )
