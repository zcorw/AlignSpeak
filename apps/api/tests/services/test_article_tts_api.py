import json
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.application.usecases.article_tts_preparation import build_article_tts_input_snapshot
from app.core.config import settings
from app.core.errors import AppError, app_error_handler
from app.db import Base, get_db
from app.deps import get_current_user
from app.infrastructure.repositories.article_tts_repository import ArticleTtsRepository
from app.infrastructure.repositories.tts_repository import TtsRepository
from app.models import Article, ArticleSegment, ArticleTtsAsset, TtsAsset, User, utcnow
from app.routers.article_tts import router
from app.routers.tts import router as segment_tts_router


class ArticleTtsApiTests(unittest.TestCase):
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
        self.article_tts_repository = ArticleTtsRepository(self.db)
        self.tts_repository = TtsRepository(self.db)
        self.temp_directory = tempfile.TemporaryDirectory()
        self.media_root = Path(self.temp_directory.name)
        self.previous_tts_media_dir = settings.tts_media_dir
        settings.tts_media_dir = str(self.media_root)
        self._seed_data()

        self.current_user = self.db.get(User, "user-a")
        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(router, prefix="/api")
        app.include_router(segment_tts_router, prefix="/api")

        def override_db():
            yield self.db

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = lambda: self.current_user
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        settings.tts_media_dir = self.previous_tts_media_dir
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()
        self.temp_directory.cleanup()

    def _seed_data(self) -> None:
        self.db.add_all(
            [
                User(
                    id="user-a",
                    email="a@example.com",
                    password_hash="hash",
                    display_name="A",
                ),
                User(
                    id="user-b",
                    email="b@example.com",
                    password_hash="hash",
                    display_name="B",
                ),
            ]
        )
        self.db.flush()
        self.db.add(
            Article(
                id="article-a",
                user_id="user-a",
                title="Article",
                language="en",
                raw_text="First.\n\nSecond.",
                normalized_text="First.\n\nSecond.",
            )
        )
        self.db.flush()
        self.db.add_all(
            [
                ArticleSegment(
                    id="segment-1",
                    article_id="article-a",
                    segment_order=1,
                    plain_text="First.",
                    normalized_text="First.",
                ),
                ArticleSegment(
                    id="segment-2",
                    article_id="article-a",
                    segment_order=2,
                    plain_text="Second.",
                    normalized_text="Second.",
                ),
            ]
        )
        self.db.commit()

    def _current_snapshot(self):
        return build_article_tts_input_snapshot(
            repository=self.tts_repository,
            user_id="user-a",
            article_id="article-a",
        )

    def _create_ready_asset(
        self,
        *,
        asset_id: str = "asset-a",
        input_hash: str | None = None,
        content: bytes | None = b"0123456789",
        audio_path: str | None = None,
    ) -> ArticleTtsAsset:
        snapshot = self._current_snapshot()
        relative_path = audio_path or f"articles/{asset_id}.mp3"
        if content is not None and ".." not in relative_path:
            path = self.media_root / relative_path
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        timeline = [
            {
                "segment_id": "segment-1",
                "segment_order": 1,
                "sentence_index": 0,
                "text": "First.",
                "start_ms": 0,
                "end_ms": 500,
            }
        ]
        return self.article_tts_repository.create_asset(
            ArticleTtsAsset(
                id=asset_id,
                user_id="user-a",
                article_id="article-a",
                input_hash=input_hash or snapshot.input_hash,
                status="ready",
                voice="en-US-AriaNeural",
                speed=1.0,
                pause_policy_version=snapshot.pause_policy_version,
                encoder_profile_version=snapshot.encoder_profile_version,
                timeline_version=snapshot.timeline_version,
                audio_path=relative_path,
                duration_ms=1000,
                file_size=len(content) if content is not None else 10,
                timeline_json=json.dumps(timeline),
                ready_at=utcnow(),
            )
        )

    def test_create_job_is_idempotent_and_job_is_owner_scoped(self) -> None:
        first = self.client.post("/api/articles/article-a/full-tts-jobs", json={})
        second = self.client.post("/api/articles/article-a/full-tts-jobs", json={})
        self.assertEqual(first.status_code, 202)
        self.assertEqual(second.status_code, 202)
        self.assertEqual(first.json()["job_id"], second.json()["job_id"])
        self.assertEqual(first.json()["total_segments"], 2)

        job_id = first.json()["job_id"]
        fetched = self.client.get(f"/api/full-tts-jobs/{job_id}")
        self.assertEqual(fetched.status_code, 200)
        self.current_user = self.db.get(User, "user-b")
        hidden = self.client.get(f"/api/full-tts-jobs/{job_id}")
        self.assertEqual(hidden.status_code, 404)
        self.assertEqual(hidden.json()["error"]["code"], "ARTICLE_TTS_JOB_NOT_FOUND")

    def test_failed_job_exposes_segment_and_can_be_retried(self) -> None:
        created = self.client.post("/api/articles/article-a/full-tts-jobs", json={}).json()
        job_id = created["job_id"]
        now = utcnow()
        self.article_tts_repository.claim_next_job(
            worker_id="worker-a",
            now=now,
            lease_seconds=120,
            max_attempts=3,
        )
        self.article_tts_repository.fail_job(
            job_id=job_id,
            worker_id="worker-a",
            error_code="segment_tts_failed",
            error_message="Segment 2 failed.",
            failed_segment_id="segment-2",
            failed_segment_order=2,
            now=now + timedelta(seconds=1),
        )

        failed = self.client.get(f"/api/full-tts-jobs/{job_id}")
        self.assertEqual(failed.json()["status"], "failed")
        self.assertEqual(failed.json()["failed_segment"]["segment_order"], 2)
        retried = self.client.post(f"/api/full-tts-jobs/{job_id}/retry")
        self.assertEqual(retried.status_code, 200)
        self.assertEqual(retried.json()["status"], "queued")

        self.article_tts_repository.claim_next_job(
            worker_id="worker-a",
            now=now + timedelta(seconds=2),
            lease_seconds=120,
            max_attempts=3,
        )
        self.article_tts_repository.fail_job(
            job_id=job_id,
            worker_id="worker-a",
            error_code="segment_tts_failed",
            error_message="Segment 2 failed again.",
            failed_segment_id="segment-2",
            failed_segment_order=2,
            now=now + timedelta(seconds=3),
        )
        forced = self.client.post(
            "/api/articles/article-a/full-tts-jobs",
            json={"force_refresh": True},
        )
        self.assertEqual(forced.status_code, 202)
        self.assertEqual(forced.json()["status"], "queued")

    def test_current_asset_reports_actual_size_and_becomes_stale_after_edit(self) -> None:
        asset = self._create_ready_asset()
        current = self.client.get("/api/articles/article-a/full-tts")
        self.assertEqual(current.status_code, 200)
        self.assertFalse(current.json()["is_stale"])
        self.assertEqual(current.json()["asset"]["asset_id"], asset.id)
        self.assertEqual(current.json()["estimate"], {"bytes": 10, "is_estimate": False})

        segment = self.db.get(ArticleSegment, "segment-1")
        segment.plain_text = "Changed."
        segment.normalized_text = "Changed."
        self.db.commit()
        stale = self.client.get("/api/articles/article-a/full-tts")
        self.assertTrue(stale.json()["is_stale"])
        self.assertEqual(stale.json()["asset"]["asset_id"], asset.id)
        self.assertTrue(stale.json()["estimate"]["is_estimate"])

    def test_long_article_estimate_exceeds_cellular_confirmation_threshold(self) -> None:
        article = self.db.get(Article, "article-a")
        article.language = "ja"
        segment = self.db.get(ArticleSegment, "segment-1")
        segment.plain_text = "日" * 20_000
        segment.normalized_text = segment.plain_text
        self.db.delete(self.db.get(ArticleSegment, "segment-2"))
        self.db.commit()

        response = self.client.get("/api/articles/article-a/full-tts")
        self.assertEqual(response.status_code, 200)
        self.assertGreater(response.json()["estimate"]["bytes"], 20 * 1024 * 1024)

    def test_media_supports_full_single_range_suffix_and_invalid_range(self) -> None:
        asset = self._create_ready_asset()
        full = self.client.get(f"/api/media/tts/articles/{asset.id}")
        self.assertEqual(full.status_code, 200)
        self.assertEqual(full.content, b"0123456789")
        self.assertEqual(full.headers["accept-ranges"], "bytes")

        partial = self.client.get(
            f"/api/media/tts/articles/{asset.id}",
            headers={"Range": "bytes=2-5"},
        )
        self.assertEqual(partial.status_code, 206)
        self.assertEqual(partial.content, b"2345")
        self.assertEqual(partial.headers["content-range"], "bytes 2-5/10")

        suffix = self.client.get(
            f"/api/media/tts/articles/{asset.id}",
            headers={"Range": "bytes=-3"},
        )
        self.assertEqual(suffix.status_code, 206)
        self.assertEqual(suffix.content, b"789")

        invalid = self.client.get(
            f"/api/media/tts/articles/{asset.id}",
            headers={"Range": "bytes=99-100"},
        )
        self.assertEqual(invalid.status_code, 416)
        self.assertEqual(invalid.headers["content-range"], "bytes */10")
        self.assertEqual(invalid.json()["error"]["code"], "RANGE_NOT_SATISFIABLE")

    def test_media_hides_cross_user_asset_and_reports_missing_or_unsafe_file(self) -> None:
        owned = self._create_ready_asset(asset_id="owned")
        self.current_user = self.db.get(User, "user-b")
        hidden = self.client.get(f"/api/media/tts/articles/{owned.id}")
        self.assertEqual(hidden.status_code, 404)
        self.assertEqual(hidden.json()["error"]["code"], "ARTICLE_TTS_ASSET_NOT_FOUND")

        self.current_user = self.db.get(User, "user-a")
        missing = self._create_ready_asset(asset_id="missing", input_hash="b" * 64, content=None)
        missing_response = self.client.get(f"/api/media/tts/articles/{missing.id}")
        self.assertEqual(missing_response.status_code, 410)
        self.assertEqual(missing_response.json()["error"]["code"], "ARTICLE_TTS_ASSET_MISSING")

        unsafe = self._create_ready_asset(
            asset_id="unsafe",
            input_hash="c" * 64,
            content=None,
            audio_path="../../outside.mp3",
        )
        unsafe_response = self.client.get(f"/api/media/tts/articles/{unsafe.id}")
        self.assertEqual(unsafe_response.status_code, 410)

    def test_legacy_segment_media_is_also_scoped_to_article_owner(self) -> None:
        media_path = self.media_root / "segment.mp3"
        media_path.write_bytes(b"segment audio")
        self.db.add(
            TtsAsset(
                id="segment-tts",
                segment_id="segment-1",
                voice="default",
                speed=1.0,
                audio_url="/media/tts/segment.mp3",
                text_hash="a" * 64,
            )
        )
        self.db.commit()

        owned = self.client.get("/api/media/tts/segment.mp3")
        self.assertEqual(owned.status_code, 200)
        self.assertEqual(owned.content, b"segment audio")
        self.current_user = self.db.get(User, "user-b")
        hidden = self.client.get("/api/media/tts/segment.mp3")
        self.assertEqual(hidden.status_code, 404)

    def test_done_job_with_missing_file_is_requeued_for_rebuild(self) -> None:
        asset = self._create_ready_asset()
        created = self.client.post("/api/articles/article-a/full-tts-jobs", json={}).json()
        job_id = created["job_id"]
        now = utcnow()
        self.article_tts_repository.claim_next_job(
            worker_id="worker-a",
            now=now,
            lease_seconds=120,
            max_attempts=3,
        )
        self.article_tts_repository.complete_job(
            job_id=job_id,
            worker_id="worker-a",
            asset_id=asset.id,
            now=now + timedelta(seconds=1),
        )
        (self.media_root / asset.audio_path).unlink()

        rebuilt = self.client.post("/api/articles/article-a/full-tts-jobs", json={})
        self.assertEqual(rebuilt.status_code, 202)
        self.assertEqual(rebuilt.json()["status"], "queued")
        self.assertEqual(rebuilt.json()["completed_segments"], 0)
        self.assertIsNone(rebuilt.json()["asset"])

    def test_missing_article_does_not_create_job(self) -> None:
        response = self.client.post("/api/articles/missing/full-tts-jobs", json={})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "ARTICLE_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
