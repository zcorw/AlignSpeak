import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.application.usecases.article_tts_job_processor import ArticleTtsJobProcessor
from app.application.usecases.article_tts_preparation import PreparedArticleTtsSegment
from app.core.config import settings
from app.core.errors import AppError, app_error_handler
from app.db import Base, get_db
from app.deps import get_current_user
from app.infrastructure.repositories.article_tts_repository import ArticleTtsRepository
from app.infrastructure.repositories.tts_repository import TtsRepository
from app.models import Article, ArticleSegment, TtsAsset, User
from app.routers.article_tts import router
from app.services.article_tts_worker import ArticleTtsWorkerRunner
from app.services.tts_asset_service import SEGMENT_TIMELINE_VERSION


@unittest.skipUnless(
    shutil.which("ffmpeg") and shutil.which("ffprobe"),
    "ffmpeg and ffprobe are required for the article TTS end-to-end test",
)
class ArticleTtsEndToEndTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_directory = tempfile.TemporaryDirectory()
        self.media_root = Path(self.temp_directory.name)
        database_path = (self.media_root / "article-tts-e2e.sqlite3").as_posix()
        self.engine = create_engine(
            f"sqlite+pysqlite:///{database_path}",
            connect_args={"check_same_thread": False},
        )

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self._seed_data()
        self.previous_tts_media_dir = settings.tts_media_dir
        settings.tts_media_dir = str(self.media_root)

        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(router, prefix="/api")

        def override_db():
            db = self.session_factory()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = lambda: self.current_user
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        settings.tts_media_dir = self.previous_tts_media_dir
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()
        self.temp_directory.cleanup()

    def _seed_data(self) -> None:
        with self.session_factory() as db:
            user = User(
                id="user-e2e",
                email="e2e@example.com",
                password_hash="hash",
                display_name="E2E",
            )
            db.add(user)
            db.flush()
            db.add(
                Article(
                    id="article-e2e",
                    user_id=user.id,
                    title="End-to-end article",
                    language="en",
                    raw_text="First sentence.\n\nSecond sentence.",
                    normalized_text="First sentence.\n\nSecond sentence.",
                )
            )
            db.flush()
            db.add_all(
                [
                    ArticleSegment(
                        id="segment-e2e-1",
                        article_id="article-e2e",
                        segment_order=1,
                        plain_text="First sentence.",
                        normalized_text="First sentence.",
                    ),
                    ArticleSegment(
                        id="segment-e2e-2",
                        article_id="article-e2e",
                        segment_order=2,
                        plain_text="Second sentence.",
                        normalized_text="Second sentence.",
                    ),
                ]
            )
            db.commit()
            self.current_user = user

    def _prepare_segments(self, *, repository, snapshot, on_segment_prepared):
        prepared: list[PreparedArticleTtsSegment] = []
        for segment in snapshot.segments:
            filename = f"e2e-segment-{segment.segment_order}.mp3"
            media_path = self.media_root / filename
            subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-f",
                    "lavfi",
                    "-i",
                    f"sine=frequency={400 + segment.segment_order * 100}:sample_rate=24000:duration=0.2",
                    "-codec:a",
                    "libmp3lame",
                    "-ar",
                    "24000",
                    "-ac",
                    "1",
                    "-b:a",
                    "48k",
                    str(media_path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            timeline = [
                {
                    "sentence_index": 0,
                    "text": segment.tts_input_text,
                    "start_ms": 0,
                    "end_ms": 150,
                }
            ]
            asset = repository.create_tts_asset(
                TtsAsset(
                    id=f"tts-e2e-{segment.segment_order}",
                    segment_id=segment.segment_id,
                    voice=snapshot.resolved_voice,
                    speed=snapshot.speed,
                    audio_url=f"/media/tts/{filename}",
                    text_hash=segment.text_hash,
                    timeline_json=json.dumps(timeline),
                    timeline_version=SEGMENT_TIMELINE_VERSION,
                )
            )
            item = PreparedArticleTtsSegment(
                segment=segment,
                asset=asset,
                media_path=media_path,
                timeline=tuple(timeline),
                cached=False,
            )
            prepared.append(item)
            on_segment_prepared(item, len(prepared), len(snapshot.segments))
        return tuple(prepared)

    def _run_worker_from_new_session(self):
        worker_db: Session = self.session_factory()
        try:
            article_repository = ArticleTtsRepository(worker_db)
            processor = ArticleTtsJobProcessor(
                article_repository=article_repository,
                tts_repository=TtsRepository(worker_db),
                media_root=self.media_root,
                prepare_segments=self._prepare_segments,
            )
            return ArticleTtsWorkerRunner(
                repository=article_repository,
                worker_id="e2e-worker-after-restart",
                lease_seconds=120,
                max_attempts=3,
                process_job=processor,
            ).run_once()
        finally:
            worker_db.close()

    def test_api_to_restarted_worker_to_protected_range_download(self) -> None:
        created = self.client.post("/api/articles/article-e2e/full-tts-jobs", json={})
        self.assertEqual(created.status_code, 202)
        self.assertEqual(created.json()["status"], "queued")
        self.assertEqual(created.json()["total_segments"], 2)

        completed = self._run_worker_from_new_session()
        self.assertIsNotNone(completed)
        self.assertEqual(completed.status, "done")

        job = self.client.get(f"/api/full-tts-jobs/{created.json()['job_id']}")
        self.assertEqual(job.status_code, 200)
        payload = job.json()
        self.assertEqual(payload["status"], "done")
        self.assertEqual(payload["completed_segments"], 2)
        self.assertEqual(len(payload["asset"]["timeline"]), 2)
        self.assertGreater(payload["asset"]["duration_ms"], 2_000)

        asset_id = payload["asset"]["asset_id"]
        full = self.client.get(f"/api/media/tts/articles/{asset_id}")
        self.assertEqual(full.status_code, 200)
        self.assertEqual(full.headers["content-type"], "audio/mpeg")
        self.assertEqual(len(full.content), payload["asset"]["file_size"])

        partial = self.client.get(
            f"/api/media/tts/articles/{asset_id}",
            headers={"Range": "bytes=0-31"},
        )
        self.assertEqual(partial.status_code, 206)
        self.assertEqual(partial.content, full.content[:32])
        self.assertEqual(
            partial.headers["content-range"],
            f"bytes 0-31/{len(full.content)}",
        )

        current = self.client.get("/api/articles/article-e2e/full-tts").json()
        self.assertFalse(current["is_stale"])
        self.assertFalse(current["estimate"]["is_estimate"])
        self.assertEqual(current["asset"]["asset_id"], asset_id)

    def test_legal_twenty_thousand_character_article_reaches_done(self) -> None:
        with self.session_factory() as db:
            article = db.get(Article, "article-e2e")
            segment = db.get(ArticleSegment, "segment-e2e-1")
            article.raw_text = "x" * 20_000
            article.normalized_text = article.raw_text
            segment.plain_text = article.raw_text
            segment.normalized_text = article.raw_text
            db.delete(db.get(ArticleSegment, "segment-e2e-2"))
            db.commit()

        created = self.client.post("/api/articles/article-e2e/full-tts-jobs", json={})
        self.assertEqual(created.status_code, 202)
        self.assertEqual(created.json()["total_segments"], 1)
        completed = self._run_worker_from_new_session()
        self.assertEqual(completed.status, "done")


if __name__ == "__main__":
    unittest.main()
