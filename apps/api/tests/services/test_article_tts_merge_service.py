import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.application.usecases.article_tts_job_processor import ArticleTtsJobProcessor
from app.application.usecases.article_tts_job_usecase import create_or_get_article_tts_job
from app.application.usecases.article_tts_preparation import (
    ArticleTtsSegmentInput,
    PreparedArticleTtsSegment,
    build_article_tts_input_snapshot,
)
from app.db import Base
from app.infrastructure.repositories.article_tts_repository import ArticleTtsRepository
from app.infrastructure.repositories.tts_repository import TtsRepository
from app.models import Article, ArticleSegment, TtsAsset, User
from app.services.article_tts_merge_service import (
    ArticleTtsMergeError,
    ArticleTtsMergeResult,
    ArticleTtsSegmentSpan,
    AudioProbe,
    merge_article_tts_audio,
)
from app.services.article_tts_worker import ArticleTtsWorkerRunner


class ArticleTtsMergeServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_directory.name)

    def tearDown(self) -> None:
        self.temp_directory.cleanup()

    def _create_tone(self, name: str, *, duration_seconds: float, frequency: int) -> Path:
        output = self.root / name
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
                f"sine=frequency={frequency}:sample_rate=22050:duration={duration_seconds}",
                "-codec:a",
                "libmp3lame",
                "-b:a",
                "64k",
                str(output),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return output

    def _prepared(self) -> tuple[PreparedArticleTtsSegment, PreparedArticleTtsSegment]:
        first_path = self._create_tone("first.mp3", duration_seconds=0.4, frequency=440)
        second_path = self._create_tone("second.mp3", duration_seconds=0.6, frequency=660)
        first_input = ArticleTtsSegmentInput(
            segment_id="segment-1",
            segment_order=1,
            tts_input_text="First.",
            text_hash="1" * 64,
        )
        second_input = ArticleTtsSegmentInput(
            segment_id="segment-2",
            segment_order=2,
            tts_input_text="Second.",
            text_hash="2" * 64,
        )
        return (
            PreparedArticleTtsSegment(
                segment=first_input,
                asset=TtsAsset(
                    id="tts-1",
                    segment_id="segment-1",
                    voice="en-US-AriaNeural",
                    speed=1.0,
                    audio_url="/media/tts/first.mp3",
                    text_hash="1" * 64,
                ),
                media_path=first_path,
                timeline=(
                    {"sentence_index": 0, "text": "First.", "start_ms": 0, "end_ms": 350},
                ),
                cached=True,
            ),
            PreparedArticleTtsSegment(
                segment=second_input,
                asset=TtsAsset(
                    id="tts-2",
                    segment_id="segment-2",
                    voice="en-US-AriaNeural",
                    speed=1.0,
                    audio_url="/media/tts/second.mp3",
                    text_hash="2" * 64,
                ),
                media_path=second_path,
                timeline=(
                    {"sentence_index": 0, "text": "Second.", "start_ms": 0, "end_ms": 500},
                ),
                cached=True,
            ),
        )

    def test_real_ffmpeg_merge_inserts_pauses_and_builds_global_timeline(self) -> None:
        prepared = self._prepared()
        output = self.root / "articles" / "merged.mp3"
        result = merge_article_tts_audio(prepared_segments=prepared, output_path=output)

        self.assertTrue(output.is_file())
        self.assertEqual(result.probe.codec_name, "mp3")
        self.assertEqual(result.probe.sample_rate, 24_000)
        self.assertEqual(result.probe.channels, 1)
        self.assertLessEqual(abs(result.probe.bit_rate - 48_000), 5_000)
        self.assertEqual(len(result.segment_spans), 2)
        first_span, second_span = result.segment_spans
        self.assertEqual(second_span.global_start_ms - first_span.global_end_ms, 750)
        self.assertEqual(result.timeline[1]["segment_id"], "segment-2")
        self.assertEqual(result.timeline[1]["start_ms"], float(second_span.global_start_ms))
        loop_tail_ms = result.probe.duration_ms - second_span.global_end_ms
        self.assertLessEqual(abs(loop_tail_ms - 1500), 150)
        self.assertGreater(result.probe.file_size, 0)

    def test_merge_failure_does_not_replace_existing_published_file(self) -> None:
        prepared = self._prepared()
        output = self.root / "articles" / "existing.mp3"
        output.parent.mkdir(parents=True)
        output.write_bytes(b"existing")

        with self.assertRaises(ArticleTtsMergeError):
            merge_article_tts_audio(
                prepared_segments=prepared,
                output_path=output,
                ffmpeg_binary="ffmpeg-does-not-exist",
            )
        self.assertEqual(output.read_bytes(), b"existing")
        self.assertEqual(list(output.parent.glob(".article-tts-merge-*")), [])


class ArticleTtsJobProcessorTests(unittest.TestCase):
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
        self.article_repository = ArticleTtsRepository(self.db)
        self.tts_repository = TtsRepository(self.db)
        self.temp_directory = tempfile.TemporaryDirectory()
        self.media_root = Path(self.temp_directory.name)
        self._seed_data()

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()
        self.temp_directory.cleanup()

    def _seed_data(self) -> None:
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
        self.db.flush()
        self.db.add_all(
            [
                TtsAsset(
                    id="tts-1",
                    segment_id="segment-1",
                    voice="en-US-AriaNeural",
                    speed=1.0,
                    audio_url="/media/tts/first.mp3",
                    text_hash="1" * 64,
                ),
                TtsAsset(
                    id="tts-2",
                    segment_id="segment-2",
                    voice="en-US-AriaNeural",
                    speed=1.0,
                    audio_url="/media/tts/second.mp3",
                    text_hash="2" * 64,
                ),
            ]
        )
        self.db.commit()

    def test_processor_publishes_asset_mappings_and_reuses_ready_cache(self) -> None:
        snapshot = build_article_tts_input_snapshot(
            repository=self.tts_repository,
            user_id="user-a",
            article_id="article-a",
        )
        job = create_or_get_article_tts_job(
            repository=self.article_repository,
            user_id="user-a",
            article_id="article-a",
            input_hash=snapshot.input_hash,
            total_segments=2,
            id_factory=lambda: "job-a",
        )
        prepare_calls: list[str] = []
        merge_calls: list[Path] = []

        def prepare_stub(*, snapshot, on_segment_prepared, **_kwargs):
            prepare_calls.append(snapshot.input_hash)
            prepared: list[PreparedArticleTtsSegment] = []
            for index, segment in enumerate(snapshot.segments, start=1):
                asset = self.db.get(TtsAsset, f"tts-{index}")
                item = PreparedArticleTtsSegment(
                    segment=segment,
                    asset=asset,
                    media_path=self.media_root / f"segment-{index}.mp3",
                    timeline=(
                        {
                            "sentence_index": 0,
                            "text": segment.tts_input_text,
                            "start_ms": 0,
                            "end_ms": 500,
                        },
                    ),
                    cached=True,
                )
                prepared.append(item)
                on_segment_prepared(item, index, len(snapshot.segments))
            return tuple(prepared)

        def merge_stub(*, prepared_segments, output_path):
            merge_calls.append(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(b"article")
            spans = tuple(
                ArticleTtsSegmentSpan(
                    segment_id=item.segment.segment_id,
                    segment_tts_asset_id=item.asset.id,
                    segment_order=item.segment.segment_order,
                    segment_text_hash=item.segment.text_hash,
                    global_start_ms=(index - 1) * 1250,
                    global_end_ms=(index - 1) * 1250 + 500,
                )
                for index, item in enumerate(prepared_segments, start=1)
            )
            timeline = tuple(
                {
                    "segment_id": item.segment.segment_id,
                    "segment_order": item.segment.segment_order,
                    "sentence_index": 0,
                    "text": item.segment.tts_input_text,
                    "start_ms": float((index - 1) * 1250),
                    "end_ms": float((index - 1) * 1250 + 500),
                }
                for index, item in enumerate(prepared_segments, start=1)
            )
            return ArticleTtsMergeResult(
                output_path=output_path,
                probe=AudioProbe(
                    duration_ms=3250,
                    file_size=7,
                    codec_name="mp3",
                    sample_rate=24_000,
                    channels=1,
                    bit_rate=48_000,
                ),
                timeline=timeline,
                segment_spans=spans,
            )

        processor = ArticleTtsJobProcessor(
            article_repository=self.article_repository,
            tts_repository=self.tts_repository,
            media_root=self.media_root,
            prepare_segments=prepare_stub,
            merge_audio=merge_stub,
        )
        runner = ArticleTtsWorkerRunner(
            repository=self.article_repository,
            worker_id="worker-a",
            lease_seconds=120,
            max_attempts=3,
            process_job=processor,
        )
        completed = runner.run_once()

        self.assertEqual(completed.status, "done")
        asset = self.article_repository.get_asset_by_input(
            user_id="user-a",
            article_id="article-a",
            input_hash=snapshot.input_hash,
            ready_only=True,
        )
        self.assertIsNotNone(asset)
        self.assertEqual(asset.duration_ms, 3250)
        self.assertEqual(asset.file_size, 7)
        self.assertEqual(len(json.loads(asset.timeline_json)), 2)
        mappings = self.article_repository.list_asset_segments_for_user(
            asset_id=asset.id,
            user_id="user-a",
        )
        self.assertEqual([mapping.segment_order for mapping in mappings], [1, 2])

        completed.status = "queued"
        completed.asset_id = None
        completed.completed_segments = 0
        completed.finished_at = None
        self.article_repository.update_job(completed)
        cached_completion = runner.run_once()
        self.assertEqual(cached_completion.status, "done")
        self.assertEqual(len(prepare_calls), 1)
        self.assertEqual(len(merge_calls), 1)


if __name__ == "__main__":
    unittest.main()
