import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.infrastructure.repositories.article_tts_repository import ArticleTtsRepository
from app.models import Article, ArticleTtsAsset, ArticleTtsJob, User
from app.services.article_tts_cleanup import (
    ArticleTtsAssetCleaner,
    ArticleTtsStorageLimitError,
    ensure_article_tts_storage_capacity,
)
from app.workers.article_tts import verify_audio_tools


NOW = datetime(2026, 8, 20, 0, 0, tzinfo=timezone.utc)


class ArticleTtsWorkerRuntimeTests(unittest.TestCase):
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
        self.temp_directory = tempfile.TemporaryDirectory()
        self.media_root = Path(self.temp_directory.name)
        self.article_root = self.media_root / "articles"
        self.article_root.mkdir()
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
                raw_text="Text",
                normalized_text="Text",
            )
        )
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()
        self.temp_directory.cleanup()

    def _ready_asset(
        self,
        *,
        asset_id: str,
        ready_at: datetime,
        filename: str,
    ) -> ArticleTtsAsset:
        path = self.article_root / filename
        path.write_bytes(asset_id.encode())
        asset = ArticleTtsAsset(
            id=asset_id,
            user_id="user-a",
            article_id="article-a",
            input_hash=(asset_id * 64)[:64],
            status="ready",
            voice="en-US-AriaNeural",
            speed=1.0,
            pause_policy_version="segment-750_loop-1500_v1",
            encoder_profile_version="mp3-24k-mono-48k-v1",
            timeline_version="article-v1",
            audio_path=f"articles/{filename}",
            duration_ms=1000,
            file_size=path.stat().st_size,
            timeline_json="[]",
            created_at=ready_at,
            updated_at=ready_at,
            ready_at=ready_at,
        )
        self.db.add(asset)
        self.db.commit()
        return asset

    def _cleaner(self, *, temp_ttl: int = 24 * 60 * 60) -> ArticleTtsAssetCleaner:
        return ArticleTtsAssetCleaner(
            repository=self.repository,
            media_root=self.media_root,
            asset_retention_seconds=7 * 24 * 60 * 60,
            temp_file_ttl_seconds=temp_ttl,
            batch_size=100,
        )

    def test_cleanup_deletes_only_expired_superseded_and_orphan_files(self) -> None:
        old = self._ready_asset(
            asset_id="asset-old",
            ready_at=NOW - timedelta(days=10),
            filename="old.mp3",
        )
        active = self._ready_asset(
            asset_id="asset-active",
            ready_at=NOW - timedelta(days=9),
            filename="active.mp3",
        )
        latest = self._ready_asset(
            asset_id="asset-latest",
            ready_at=NOW - timedelta(days=1),
            filename="latest.mp3",
        )
        self.db.add(
            ArticleTtsJob(
                id="job-active",
                user_id="user-a",
                article_id="article-a",
                input_hash="job-active".ljust(64, "0"),
                status="queued",
                total_segments=1,
                completed_segments=0,
                attempt_count=0,
                asset_id=active.id,
                created_at=NOW,
                updated_at=NOW,
            )
        )
        self.db.commit()

        orphan = self.article_root / "orphan.mp3"
        orphan.write_bytes(b"orphan")
        temp_file = self.media_root / ".segment.mp3.deadbeef.tmp"
        temp_file.write_bytes(b"temp")
        merge_dir = self.article_root / ".article-tts-merge-stale"
        merge_dir.mkdir()
        (merge_dir / "merged.mp3").write_bytes(b"partial")
        old_timestamp = (NOW - timedelta(days=2)).timestamp()
        for path in (orphan, temp_file, merge_dir):
            os.utime(path, (old_timestamp, old_timestamp))

        result = self._cleaner().run_once(now=NOW)

        self.db.expire_all()
        self.assertEqual(result.claimed_assets, 1)
        self.assertEqual(result.deleted_assets, 1)
        self.assertEqual(result.deleted_orphan_files, 1)
        self.assertEqual(result.deleted_temp_entries, 2)
        self.assertFalse((self.article_root / "old.mp3").exists())
        self.assertFalse(orphan.exists())
        self.assertFalse(temp_file.exists())
        self.assertFalse(merge_dir.exists())
        self.assertEqual(self.db.get(ArticleTtsAsset, old.id).status, "deleting")
        self.assertIsNone(self.db.get(ArticleTtsAsset, old.id).audio_path)
        self.assertEqual(self.db.get(ArticleTtsAsset, active.id).status, "ready")
        self.assertTrue((self.article_root / "active.mp3").exists())
        self.assertEqual(self.db.get(ArticleTtsAsset, latest.id).status, "ready")
        self.assertTrue((self.article_root / "latest.mp3").exists())

    def test_failed_asset_deletion_stays_retryable(self) -> None:
        old = self._ready_asset(
            asset_id="asset-old",
            ready_at=NOW - timedelta(days=10),
            filename="stubborn.mp3",
        )
        self._ready_asset(
            asset_id="asset-latest",
            ready_at=NOW,
            filename="latest.mp3",
        )
        stubborn = self.article_root / "stubborn.mp3"
        stubborn.unlink()
        stubborn.mkdir()

        first = self._cleaner().run_once(now=NOW)

        self.db.expire_all()
        self.assertEqual(first.failed_asset_deletions, 1)
        self.assertEqual(self.db.get(ArticleTtsAsset, old.id).status, "deleting")
        self.assertEqual(self.db.get(ArticleTtsAsset, old.id).audio_path, "articles/stubborn.mp3")

        stubborn.rmdir()
        second = self._cleaner().run_once(now=NOW + timedelta(minutes=1))

        self.db.expire_all()
        self.assertEqual(second.missing_asset_files, 1)
        self.assertIsNone(self.db.get(ArticleTtsAsset, old.id).audio_path)

    def test_storage_quota_accounts_for_replaced_output(self) -> None:
        existing = self.article_root / "existing.mp3"
        existing.write_bytes(b"123456")
        ensure_article_tts_storage_capacity(
            media_root=self.media_root,
            max_bytes=10,
            additional_bytes=9,
            replacement_path=existing,
        )
        with self.assertRaises(ArticleTtsStorageLimitError):
            ensure_article_tts_storage_capacity(
                media_root=self.media_root,
                max_bytes=10,
                additional_bytes=11,
                replacement_path=existing,
            )

    @patch("app.workers.article_tts.subprocess.run")
    @patch("app.workers.article_tts.shutil.which")
    def test_worker_entrypoint_verifies_ffmpeg_and_ffprobe(self, which: Mock, run: Mock) -> None:
        which.side_effect = lambda binary: f"/usr/bin/{binary}"
        run.return_value = Mock(returncode=0)

        verify_audio_tools()

        self.assertEqual(which.call_count, 2)
        self.assertEqual(
            [call.args[0][0] for call in run.call_args_list],
            ["ffmpeg", "ffprobe"],
        )


if __name__ == "__main__":
    unittest.main()
