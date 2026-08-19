import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.application.usecases.article_tts_preparation import (
    ArticleTtsSegmentPreparationError,
    build_article_tts_input_snapshot,
    prepare_article_tts_segments,
)
from app.db import Base
from app.infrastructure.repositories.tts_repository import TtsRepository
from app.models import (
    Article,
    ArticleSegment,
    SegmentReadingOverride,
    SegmentTokenOverride,
    TtsAsset,
    User,
)
from app.services.reading_service import ReadingToken
from app.services.tts_service import _build_sentence_timeline, calculate_text_hash


class ArticleTtsPreparationTests(unittest.TestCase):
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
        self.repository = TtsRepository(self.db)
        self.temp_directory = tempfile.TemporaryDirectory()
        self.media_dir = Path(self.temp_directory.name)
        self._seed_article()

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()
        self.temp_directory.cleanup()

    def _seed_article(self) -> None:
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
                language="ja",
                raw_text="私\n\n学生",
                normalized_text="私\n\n学生",
            )
        )
        self.db.flush()
        self.db.add_all(
            [
                ArticleSegment(
                    id="segment-1",
                    article_id="article-a",
                    segment_order=1,
                    plain_text="私",
                    normalized_text="私",
                ),
                ArticleSegment(
                    id="segment-2",
                    article_id="article-a",
                    segment_order=2,
                    plain_text="学生",
                    normalized_text="学生",
                ),
            ]
        )
        self.db.flush()
        self.db.add_all(
            [
                SegmentReadingOverride(
                    id="reading-1",
                    user_id="user-a",
                    segment_id="segment-1",
                    token_index=0,
                    surface="私",
                    yomi="わたし",
                ),
                SegmentTokenOverride(
                    id="token-1",
                    user_id="user-a",
                    segment_id="segment-1",
                    token_index=0,
                    surface="私",
                ),
            ]
        )
        self.db.commit()

    def _snapshot(self, **kwargs):
        with patch(
            "app.services.tts_input_service.build_segment_reading_tokens",
            side_effect=lambda *, text, **_kwargs: [ReadingToken(surface=text)],
        ):
            return build_article_tts_input_snapshot(
                repository=self.repository,
                user_id="user-a",
                article_id="article-a",
                **kwargs,
            )

    def _output_path(self, filename: str) -> Path:
        return self.media_dir / filename

    def _asset_path(self, audio_url: str) -> Path:
        return self.media_dir / Path(audio_url).name

    @staticmethod
    def _timeline(text: str) -> list[dict]:
        return [{"sentence_index": 0, "text": text, "start_ms": 0, "end_ms": 500}]

    def test_snapshot_is_stable_and_includes_reading_override(self) -> None:
        first = self._snapshot()
        second = self._snapshot()

        self.assertEqual(first.input_hash, second.input_hash)
        self.assertEqual(first.resolved_voice, "ja-JP-NanamiNeural")
        self.assertEqual(first.speed, 1.0)
        self.assertEqual(first.segments[0].tts_input_text, "わたし")
        self.assertEqual(first.segments[0].text_hash, calculate_text_hash("わたし"))
        self.assertEqual([segment.segment_order for segment in first.segments], [1, 2])

    def test_snapshot_passes_saved_token_boundaries_to_reading_builder(self) -> None:
        with patch(
            "app.services.tts_input_service.build_segment_reading_tokens",
            side_effect=lambda *, text, **_kwargs: [ReadingToken(surface=text)],
        ) as builder:
            build_article_tts_input_snapshot(
                repository=self.repository,
                user_id="user-a",
                article_id="article-a",
            )
        self.assertEqual(builder.call_args_list[0].kwargs["token_surface_overrides"], ["私"])

    def test_snapshot_hash_changes_for_reading_voice_order_and_policy(self) -> None:
        baseline = self._snapshot()
        override = self.db.get(SegmentReadingOverride, "reading-1")
        override.yomi = "わたくし"
        self.db.commit()
        reading_changed = self._snapshot()
        self.assertNotEqual(reading_changed.input_hash, baseline.input_hash)

        explicit_voice = self._snapshot(voice="ja-JP-KeitaNeural")
        self.assertNotEqual(explicit_voice.input_hash, reading_changed.input_hash)
        policy_changed = self._snapshot(pause_policy_version="pause-v2")
        self.assertNotEqual(policy_changed.input_hash, reading_changed.input_hash)
        speed_changed = self._snapshot(speed=1.1)
        self.assertNotEqual(speed_changed.input_hash, reading_changed.input_hash)

        segment_two = self.db.get(ArticleSegment, "segment-2")
        segment_two.segment_order = 3
        self.db.commit()
        order_changed = self._snapshot()
        self.assertNotEqual(order_changed.input_hash, reading_changed.input_hash)

        segment_two.plain_text = "大学生"
        segment_two.normalized_text = "大学生"
        self.db.commit()
        text_changed = self._snapshot()
        self.assertNotEqual(text_changed.input_hash, order_changed.input_hash)

    def test_preparation_retries_then_reuses_generated_cache(self) -> None:
        snapshot = self._snapshot()
        attempts: list[str] = []
        backoffs: list[float] = []

        def flaky_synthesizer(*, text, output_path, **_kwargs):
            attempts.append(text)
            if len(attempts) <= 2:
                raise RuntimeError("temporary provider failure")
            output_path.write_bytes(b"mp3")
            return self._timeline(text)

        prepared = prepare_article_tts_segments(
            repository=self.repository,
            snapshot=snapshot,
            synthesizer=flaky_synthesizer,
            output_path_resolver=self._output_path,
            asset_path_resolver=self._asset_path,
            sleep=backoffs.append,
        )
        self.assertEqual(len(prepared), 2)
        self.assertEqual(attempts[:3], ["わたし", "わたし", "わたし"])
        self.assertEqual(backoffs[:2], [0.25, 0.5])
        self.assertFalse(prepared[0].cached)

        def unexpected_synthesizer(**_kwargs):
            raise AssertionError("valid cache must skip synthesis")

        cached = prepare_article_tts_segments(
            repository=self.repository,
            snapshot=snapshot,
            synthesizer=unexpected_synthesizer,
            output_path_resolver=self._output_path,
            asset_path_resolver=self._asset_path,
            sleep=backoffs.append,
        )
        self.assertTrue(all(item.cached for item in cached))

    def test_failure_identifies_segment_and_next_run_only_fills_missing_segment(self) -> None:
        snapshot = self._snapshot()
        calls: list[str] = []

        def fail_second(*, text, output_path, **_kwargs):
            calls.append(text)
            if text == "学生":
                raise RuntimeError("provider down")
            output_path.write_bytes(b"first")
            return self._timeline(text)

        with self.assertRaises(ArticleTtsSegmentPreparationError) as raised:
            prepare_article_tts_segments(
                repository=self.repository,
                snapshot=snapshot,
                synthesizer=fail_second,
                output_path_resolver=self._output_path,
                asset_path_resolver=self._asset_path,
                sleep=lambda _seconds: None,
            )
        self.assertEqual(raised.exception.segment_id, "segment-2")
        self.assertEqual(raised.exception.segment_order, 2)
        self.assertEqual(raised.exception.attempts, 3)
        self.assertEqual(calls.count("わたし"), 1)
        self.assertEqual(calls.count("学生"), 3)

        retry_calls: list[str] = []

        def recover(*, text, output_path, **_kwargs):
            retry_calls.append(text)
            output_path.write_bytes(b"recovered")
            return self._timeline(text)

        prepared = prepare_article_tts_segments(
            repository=self.repository,
            snapshot=snapshot,
            synthesizer=recover,
            output_path_resolver=self._output_path,
            asset_path_resolver=self._asset_path,
            sleep=lambda _seconds: None,
        )
        self.assertEqual(retry_calls, ["学生"])
        self.assertTrue(prepared[0].cached)
        self.assertFalse(prepared[1].cached)

    def test_legacy_default_voice_cache_is_reused_for_current_policy(self) -> None:
        snapshot = self._snapshot()
        filename = "legacy.mp3"
        self._output_path(filename).write_bytes(b"legacy")
        first_segment = snapshot.segments[0]
        self.db.add(
            TtsAsset(
                id="legacy-asset",
                segment_id=first_segment.segment_id,
                voice="default",
                speed=1.0,
                audio_url=f"/media/tts/{filename}",
                text_hash=first_segment.text_hash,
                timeline_json=json.dumps(self._timeline(first_segment.tts_input_text), ensure_ascii=False),
                timeline_version="v3",
            )
        )
        self.db.commit()

        synthesized: list[str] = []

        def synthesize_missing(*, text, output_path, **_kwargs):
            synthesized.append(text)
            output_path.write_bytes(b"new")
            return self._timeline(text)

        prepared = prepare_article_tts_segments(
            repository=self.repository,
            snapshot=snapshot,
            synthesizer=synthesize_missing,
            output_path_resolver=self._output_path,
            asset_path_resolver=self._asset_path,
            sleep=lambda _seconds: None,
        )
        self.assertTrue(prepared[0].cached)
        self.assertEqual(prepared[0].asset.id, "legacy-asset")
        self.assertEqual(synthesized, ["学生"])

    def test_long_segment_timeline_keeps_cross_chunk_offsets_monotonic(self) -> None:
        source_text = f"{'A' * 5000}. {'B' * 5000}."
        boundaries = [
            {
                "type": "WordBoundary",
                "text": "A" * 5000,
                "text_offset": 0,
                "offset": 0,
                "duration": 10_000_000,
            },
            {
                "type": "WordBoundary",
                "text": "B" * 5000,
                "text_offset": 5002,
                "offset": 25_000_000,
                "duration": 10_000_000,
            },
        ]
        timeline = _build_sentence_timeline(source_text=source_text, word_boundaries=boundaries)
        self.assertEqual(len(timeline), 2)
        self.assertGreaterEqual(timeline[1]["start_ms"], timeline[0]["end_ms"])
        self.assertEqual(timeline[1]["start_ms"], 2500.0)


if __name__ == "__main__":
    unittest.main()
