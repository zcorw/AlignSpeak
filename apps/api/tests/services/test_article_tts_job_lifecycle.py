import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, event
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.application.usecases.article_tts_job_usecase import (
    create_or_get_article_tts_job,
    retry_article_tts_job,
)
from app.db import Base
from app.infrastructure.repositories.article_tts_repository import (
    ArticleTtsRepository,
    build_article_tts_claim_statement,
)
from app.models import Article, ArticleTtsAsset, ArticleTtsJob, User
from app.services.article_tts_worker import (
    ArticleTtsProcessResult,
    ArticleTtsProcessingError,
    ArticleTtsWorkerRunner,
)


NOW = datetime(2026, 8, 20, 0, 0, tzinfo=timezone.utc)


class MutableClock:
    def __init__(self, value: datetime) -> None:
        self.value = value

    def __call__(self) -> datetime:
        return self.value


class ArticleTtsJobLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db: Session = self.session_factory()
        self.repository = ArticleTtsRepository(self.db)
        self.db.add(
            User(
                id="user-a",
                email="a@example.com",
                password_hash="hash",
                display_name="A",
            )
        )
        self.db.flush()
        self.db.add(
            Article(
                id="article-a",
                user_id="user-a",
                title="Article",
                language="en",
                raw_text="First\n\nSecond",
                normalized_text="First\n\nSecond",
            )
        )
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _create_job(self, *, job_id: str = "job-a", attempt_count: int = 0) -> ArticleTtsJob:
        return self.repository.create_job(
            ArticleTtsJob(
                id=job_id,
                user_id="user-a",
                article_id="article-a",
                input_hash=(job_id[-1] if job_id else "a") * 64,
                status="queued",
                total_segments=2,
                completed_segments=0,
                attempt_count=attempt_count,
                created_at=NOW,
                updated_at=NOW,
            )
        )

    def _create_asset(self, *, asset_id: str = "asset-a") -> ArticleTtsAsset:
        return self.repository.create_asset(
            ArticleTtsAsset(
                id=asset_id,
                user_id="user-a",
                article_id="article-a",
                input_hash="z" * 64,
                status="building",
                voice="en-US-AriaNeural",
                speed=1.0,
                pause_policy_version="pause-v1",
                encoder_profile_version="mp3-v1",
                timeline_version="article-v1",
            )
        )

    def test_create_is_idempotent_for_same_input(self) -> None:
        first = create_or_get_article_tts_job(
            repository=self.repository,
            user_id="user-a",
            article_id="article-a",
            input_hash="a" * 64,
            total_segments=2,
            id_factory=lambda: "job-first",
            now=NOW,
        )
        second = create_or_get_article_tts_job(
            repository=self.repository,
            user_id="user-a",
            article_id="article-a",
            input_hash="a" * 64,
            total_segments=2,
            id_factory=lambda: "job-second",
            now=NOW,
        )
        self.assertEqual(first.id, "job-first")
        self.assertEqual(second.id, first.id)

        restarted_db = self.session_factory()
        try:
            restarted_repository = ArticleTtsRepository(restarted_db)
            persisted = restarted_repository.get_job_for_user(job_id=first.id, user_id="user-a")
            self.assertEqual(persisted.input_hash, "a" * 64)
            self.assertEqual(persisted.status, "queued")
        finally:
            restarted_db.close()

    def test_postgresql_claim_uses_skip_locked_and_outer_guard(self) -> None:
        statement = build_article_tts_claim_statement(
            worker_id="worker-a",
            now=NOW,
            lease_seconds=120,
            max_attempts=3,
        )
        sql = str(statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
        self.assertIn("FOR UPDATE SKIP LOCKED", sql)
        self.assertGreaterEqual(sql.count("article_tts_jobs.status"), 4)

    def test_only_one_worker_claims_a_queued_job(self) -> None:
        self._create_job()
        other_db = self.session_factory()
        other_repository = ArticleTtsRepository(other_db)
        try:
            first = self.repository.claim_next_job(
                worker_id="worker-a",
                now=NOW,
                lease_seconds=120,
                max_attempts=3,
            )
            second = other_repository.claim_next_job(
                worker_id="worker-b",
                now=NOW,
                lease_seconds=120,
                max_attempts=3,
            )
        finally:
            other_db.close()
        self.assertIsNotNone(first)
        self.assertEqual(first.lease_owner, "worker-a")
        self.assertIsNone(second)

    def test_heartbeat_progress_and_completion_require_active_owner(self) -> None:
        job = self._create_job()
        asset = self._create_asset()
        self.repository.claim_next_job(
            worker_id="worker-a",
            now=NOW,
            lease_seconds=120,
            max_attempts=3,
        )

        self.assertFalse(
            self.repository.heartbeat_job(
                job_id=job.id,
                worker_id="worker-b",
                now=NOW + timedelta(seconds=10),
                lease_seconds=120,
            )
        )
        self.assertTrue(
            self.repository.heartbeat_job(
                job_id=job.id,
                worker_id="worker-a",
                now=NOW + timedelta(seconds=10),
                lease_seconds=120,
            )
        )
        self.assertFalse(
            self.repository.update_job_progress(
                job_id=job.id,
                worker_id="worker-a",
                completed_segments=3,
                now=NOW + timedelta(seconds=20),
            )
        )
        self.assertTrue(
            self.repository.update_job_progress(
                job_id=job.id,
                worker_id="worker-a",
                completed_segments=1,
                now=NOW + timedelta(seconds=20),
            )
        )
        self.assertFalse(
            self.repository.update_job_progress(
                job_id=job.id,
                worker_id="worker-a",
                completed_segments=0,
                now=NOW + timedelta(seconds=25),
            )
        )
        self.assertTrue(
            self.repository.complete_job(
                job_id=job.id,
                worker_id="worker-a",
                asset_id=asset.id,
                now=NOW + timedelta(seconds=30),
            )
        )
        persisted = self.repository.get_job_for_user(job_id=job.id, user_id="user-a")
        self.assertEqual(persisted.status, "done")
        self.assertEqual(persisted.completed_segments, 2)
        self.assertIsNone(persisted.lease_owner)

    def test_expired_jobs_are_requeued_or_failed_when_exhausted(self) -> None:
        retryable = self._create_job(job_id="job-a")
        exhausted = self._create_job(job_id="job-b", attempt_count=2)
        self.repository.claim_next_job(
            worker_id="worker-a",
            now=NOW,
            lease_seconds=10,
            max_attempts=3,
        )
        self.repository.claim_next_job(
            worker_id="worker-b",
            now=NOW,
            lease_seconds=10,
            max_attempts=3,
        )

        requeued_count, failed_count = self.repository.requeue_expired_jobs(
            now=NOW + timedelta(seconds=11),
            max_attempts=3,
        )
        self.assertEqual((requeued_count, failed_count), (1, 1))
        self.assertEqual(
            self.repository.get_job_for_user(job_id=retryable.id, user_id="user-a").status,
            "queued",
        )
        failed = self.repository.get_job_for_user(job_id=exhausted.id, user_id="user-a")
        self.assertEqual(failed.status, "failed")
        self.assertEqual(failed.error_code, "worker_lease_expired")

    def test_failed_job_retry_is_owner_scoped_and_bounded(self) -> None:
        job = self._create_job(attempt_count=1)
        self.repository.claim_next_job(
            worker_id="worker-a",
            now=NOW,
            lease_seconds=120,
            max_attempts=3,
        )
        self.repository.fail_job(
            job_id=job.id,
            worker_id="worker-a",
            error_code="segment_tts_failed",
            error_message="failed",
            now=NOW + timedelta(seconds=1),
        )
        self.assertIsNone(
            retry_article_tts_job(
                repository=self.repository,
                job_id=job.id,
                user_id="other-user",
                max_attempts=3,
                now=NOW + timedelta(seconds=2),
            )
        )
        retried = retry_article_tts_job(
            repository=self.repository,
            job_id=job.id,
            user_id="user-a",
            max_attempts=3,
            now=NOW + timedelta(seconds=2),
        )
        self.assertEqual(retried.status, "queued")

        retried.status = "failed"
        retried.attempt_count = 3
        self.repository.update_job(retried)
        self.assertIsNone(
            retry_article_tts_job(
                repository=self.repository,
                job_id=job.id,
                user_id="user-a",
                max_attempts=3,
                now=NOW + timedelta(seconds=3),
            )
        )

    def test_worker_runner_persists_success_and_structured_failure(self) -> None:
        success_job = self._create_job(job_id="job-a")
        asset = self._create_asset()
        clock = MutableClock(NOW)
        runner = ArticleTtsWorkerRunner(
            repository=self.repository,
            worker_id="worker-a",
            lease_seconds=120,
            max_attempts=3,
            process_job=lambda _job, context: (
                context.report_progress(1) and ArticleTtsProcessResult(asset_id=asset.id)
            ),
            now_provider=clock,
        )
        completed = runner.run_once()
        self.assertEqual(completed.id, success_job.id)
        self.assertEqual(completed.status, "done")

        failed_job = self._create_job(job_id="job-b")

        def fail_processor(_job, _context):
            raise ArticleTtsProcessingError(
                code="segment_tts_failed",
                message="Segment 2 failed.",
                failed_segment_order=2,
            )

        failing_runner = ArticleTtsWorkerRunner(
            repository=self.repository,
            worker_id="worker-b",
            lease_seconds=120,
            max_attempts=3,
            process_job=fail_processor,
            now_provider=clock,
        )
        failed = failing_runner.run_once()
        self.assertEqual(failed.id, failed_job.id)
        self.assertEqual(failed.status, "failed")
        self.assertEqual(failed.failed_segment_order, 2)


if __name__ == "__main__":
    unittest.main()
