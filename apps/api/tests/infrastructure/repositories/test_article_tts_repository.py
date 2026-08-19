import unittest
from datetime import datetime, timezone

from sqlalchemy import create_engine, delete, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.infrastructure.repositories.article_tts_repository import ArticleTtsRepository
from app.models import (
    Article,
    ArticleSegment,
    ArticleTtsAsset,
    ArticleTtsAssetSegment,
    ArticleTtsJob,
    TtsAsset,
    User,
)


class ArticleTtsRepositoryTests(unittest.TestCase):
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
        self._seed_source_data()

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _seed_source_data(self) -> None:
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
                title="Article A",
                language="en",
                raw_text="First\n\nSecond",
                normalized_text="First\n\nSecond",
            )
        )
        self.db.flush()
        self.db.add_all(
            [
                ArticleSegment(
                    id="segment-1",
                    article_id="article-a",
                    segment_order=1,
                    plain_text="First",
                    normalized_text="First",
                ),
                ArticleSegment(
                    id="segment-2",
                    article_id="article-a",
                    segment_order=2,
                    plain_text="Second",
                    normalized_text="Second",
                ),
            ]
        )
        self.db.flush()
        self.db.add_all(
            [
                TtsAsset(
                    id="segment-asset-1",
                    segment_id="segment-1",
                    voice="en-US-AriaNeural",
                    speed=1.0,
                    audio_url="/media/tts/segment-1.mp3",
                    duration_ms=1000,
                    text_hash="1" * 64,
                ),
                TtsAsset(
                    id="segment-asset-2",
                    segment_id="segment-2",
                    voice="en-US-AriaNeural",
                    speed=1.0,
                    audio_url="/media/tts/segment-2.mp3",
                    duration_ms=1200,
                    text_hash="2" * 64,
                ),
            ]
        )
        self.db.commit()

    def _new_asset(self, *, asset_id: str = "article-asset", input_hash: str = "a" * 64) -> ArticleTtsAsset:
        return ArticleTtsAsset(
            id=asset_id,
            user_id="user-a",
            article_id="article-a",
            input_hash=input_hash,
            status="building",
            voice="en-US-AriaNeural",
            speed=1.0,
            pause_policy_version="pause-v1",
            encoder_profile_version="mp3-v1",
            timeline_version="article-v1",
        )

    def test_metadata_bootstrap_contains_article_tts_tables(self) -> None:
        self.assertIn("article_tts_jobs", Base.metadata.tables)
        self.assertIn("article_tts_assets", Base.metadata.tables)
        self.assertIn("article_tts_asset_segments", Base.metadata.tables)

    def test_job_queries_are_scoped_to_owner_and_input(self) -> None:
        job = self.repository.create_job(
            ArticleTtsJob(
                id="job-a",
                user_id="user-a",
                article_id="article-a",
                input_hash="a" * 64,
                total_segments=2,
            )
        )

        self.assertEqual(self.repository.get_job_for_user(job_id=job.id, user_id="user-a"), job)
        self.assertIsNone(self.repository.get_job_for_user(job_id=job.id, user_id="user-b"))
        self.assertEqual(
            self.repository.get_job_by_input(
                user_id="user-a",
                article_id="article-a",
                input_hash="a" * 64,
            ),
            job,
        )

    def test_job_progress_and_unique_input_constraints_are_enforced(self) -> None:
        self.repository.create_job(
            ArticleTtsJob(
                id="job-a",
                user_id="user-a",
                article_id="article-a",
                input_hash="a" * 64,
                total_segments=2,
            )
        )
        with self.assertRaises(IntegrityError):
            self.repository.create_job(
                ArticleTtsJob(
                    id="job-b",
                    user_id="user-a",
                    article_id="article-a",
                    input_hash="a" * 64,
                    total_segments=2,
                )
            )
        self.db.rollback()

        with self.assertRaises(IntegrityError):
            self.repository.create_job(
                ArticleTtsJob(
                    id="job-c",
                    user_id="user-a",
                    article_id="article-a",
                    input_hash="c" * 64,
                    total_segments=1,
                    completed_segments=2,
                )
            )
        self.db.rollback()

    def test_ready_asset_requires_published_media_metadata(self) -> None:
        invalid_asset = self._new_asset()
        invalid_asset.status = "ready"
        with self.assertRaises(IntegrityError):
            self.repository.create_asset(invalid_asset)
        self.db.rollback()

        valid_asset = self._new_asset(asset_id="ready-asset")
        valid_asset.status = "ready"
        valid_asset.audio_path = "articles/ready-asset.mp3"
        valid_asset.duration_ms = 3700
        valid_asset.file_size = 22000
        valid_asset.ready_at = datetime.now(tz=timezone.utc)
        created = self.repository.create_asset(valid_asset)

        self.assertEqual(
            self.repository.get_asset_by_input(
                user_id="user-a",
                article_id="article-a",
                input_hash="a" * 64,
                ready_only=True,
            ),
            created,
        )
        self.assertIsNone(self.repository.get_asset_for_user(asset_id=created.id, user_id="user-b"))

    def test_asset_segment_mappings_are_ordered_and_owner_scoped(self) -> None:
        asset = self.repository.create_asset(self._new_asset())
        self.repository.add_asset_segment(
            ArticleTtsAssetSegment(
                article_tts_asset_id=asset.id,
                segment_id="segment-2",
                segment_tts_asset_id="segment-asset-2",
                segment_order=2,
                segment_text_hash="2" * 64,
                global_start_ms=1750,
                global_end_ms=2950,
            )
        )
        self.repository.add_asset_segment(
            ArticleTtsAssetSegment(
                article_tts_asset_id=asset.id,
                segment_id="segment-1",
                segment_tts_asset_id="segment-asset-1",
                segment_order=1,
                segment_text_hash="1" * 64,
                global_start_ms=0,
                global_end_ms=1000,
            )
        )

        mappings = self.repository.list_asset_segments_for_user(asset_id=asset.id, user_id="user-a")
        self.assertEqual([mapping.segment_order for mapping in mappings], [1, 2])
        self.assertEqual(
            self.repository.list_asset_segments_for_user(asset_id=asset.id, user_id="user-b"),
            [],
        )

        with self.assertRaises(IntegrityError):
            self.repository.add_asset_segment(
                ArticleTtsAssetSegment(
                    article_tts_asset_id=asset.id,
                    segment_id="segment-1",
                    segment_tts_asset_id="segment-asset-1",
                    segment_order=3,
                    segment_text_hash="1" * 64,
                    global_start_ms=4000,
                    global_end_ms=3000,
                )
            )
        self.db.rollback()

    def test_published_asset_mapping_survives_source_segment_rebuild(self) -> None:
        asset = self.repository.create_asset(self._new_asset())
        mapping = self.repository.add_asset_segment(
            ArticleTtsAssetSegment(
                article_tts_asset_id=asset.id,
                segment_id="segment-1",
                segment_tts_asset_id="segment-asset-1",
                segment_order=1,
                segment_text_hash="1" * 64,
                global_start_ms=0,
                global_end_ms=1000,
            )
        )

        self.db.execute(delete(TtsAsset).where(TtsAsset.id == "segment-asset-1"))
        self.db.execute(delete(ArticleSegment).where(ArticleSegment.id == "segment-1"))
        self.db.commit()
        self.db.refresh(mapping)

        self.assertIsNone(mapping.segment_id)
        self.assertIsNone(mapping.segment_tts_asset_id)
        self.assertEqual(mapping.segment_text_hash, "1" * 64)
        self.assertEqual(mapping.global_start_ms, 0)


if __name__ == "__main__":
    unittest.main()
