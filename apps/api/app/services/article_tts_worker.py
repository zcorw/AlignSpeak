import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from app.infrastructure.repositories.article_tts_repository import ArticleTtsRepository
from app.models import ArticleTtsJob, utcnow

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ArticleTtsProcessResult:
    asset_id: str


class ArticleTtsProcessingError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        failed_segment_id: str | None = None,
        failed_segment_order: int | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.failed_segment_id = failed_segment_id
        self.failed_segment_order = failed_segment_order
        super().__init__(message)


class ArticleTtsJobContext:
    def __init__(
        self,
        *,
        repository: ArticleTtsRepository,
        job_id: str,
        worker_id: str,
        lease_seconds: int,
        now_provider: Callable[[], datetime],
    ) -> None:
        self.repository = repository
        self.job_id = job_id
        self.worker_id = worker_id
        self.lease_seconds = lease_seconds
        self.now_provider = now_provider

    def heartbeat(self) -> bool:
        return self.repository.heartbeat_job(
            job_id=self.job_id,
            worker_id=self.worker_id,
            now=self.now_provider(),
            lease_seconds=self.lease_seconds,
        )

    def report_progress(self, completed_segments: int) -> bool:
        return self.repository.update_job_progress(
            job_id=self.job_id,
            worker_id=self.worker_id,
            completed_segments=completed_segments,
            now=self.now_provider(),
        )


ProcessArticleTtsJob = Callable[[ArticleTtsJob, ArticleTtsJobContext], ArticleTtsProcessResult]


class ArticleTtsWorkerRunner:
    def __init__(
        self,
        *,
        repository: ArticleTtsRepository,
        worker_id: str,
        lease_seconds: int,
        max_attempts: int,
        process_job: ProcessArticleTtsJob,
        now_provider: Callable[[], datetime] = utcnow,
    ) -> None:
        self.repository = repository
        self.worker_id = worker_id
        self.lease_seconds = lease_seconds
        self.max_attempts = max_attempts
        self.process_job = process_job
        self.now_provider = now_provider

    def run_once(self) -> ArticleTtsJob | None:
        now = self.now_provider()
        self.repository.requeue_expired_jobs(now=now, max_attempts=self.max_attempts)
        job = self.repository.claim_next_job(
            worker_id=self.worker_id,
            now=now,
            lease_seconds=self.lease_seconds,
            max_attempts=self.max_attempts,
        )
        if job is None:
            return None

        context = ArticleTtsJobContext(
            repository=self.repository,
            job_id=job.id,
            worker_id=self.worker_id,
            lease_seconds=self.lease_seconds,
            now_provider=self.now_provider,
        )
        try:
            result = self.process_job(job, context)
            completed = self.repository.complete_job(
                job_id=job.id,
                worker_id=self.worker_id,
                asset_id=result.asset_id,
                now=self.now_provider(),
            )
            if not completed:
                logger.warning("Article TTS job completion lost its lease: job_id=%s", job.id)
        except ArticleTtsProcessingError as exc:
            self.repository.db.rollback()
            self.repository.fail_job(
                job_id=job.id,
                worker_id=self.worker_id,
                error_code=exc.code,
                error_message=exc.message,
                failed_segment_id=exc.failed_segment_id,
                failed_segment_order=exc.failed_segment_order,
                now=self.now_provider(),
            )
        except Exception:
            self.repository.db.rollback()
            logger.exception("Article TTS worker failed unexpectedly: job_id=%s", job.id)
            self.repository.fail_job(
                job_id=job.id,
                worker_id=self.worker_id,
                error_code="article_tts_worker_error",
                error_message="Article TTS processing failed unexpectedly.",
                now=self.now_provider(),
            )
        return self.repository.get_job_for_user(job_id=job.id, user_id=job.user_id)
