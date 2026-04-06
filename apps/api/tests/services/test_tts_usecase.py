import unittest
from unittest.mock import patch

from app.application.usecases.tts_usecase import _build_tts_input_text, _resolve_tts_text_hash
from app.services.reading_service import ReadingToken
from app.services.tts_service import calculate_text_hash


class TtsUsecaseTextBuilderTests(unittest.TestCase):
    def test_build_tts_input_text_applies_manual_reading_override(self) -> None:
        with patch(
            "app.application.usecases.tts_usecase.build_segment_reading_tokens",
            return_value=[
                ReadingToken(surface="\u79c1"),
                ReadingToken(surface="\u306f"),
                ReadingToken(surface="\u5b66\u751f"),
            ],
        ):
            value = _build_tts_input_text(
                language="ja",
                source_text="\u79c1\u306f\u5b66\u751f",
                reading_overrides={0: "\u308f\u305f\u3057"},
                token_surface_overrides=None,
            )
        self.assertEqual(value, "\u308f\u305f\u3057\u306f\u5b66\u751f")

    def test_build_tts_input_text_returns_original_when_no_override(self) -> None:
        value = _build_tts_input_text(
            language="ja",
            source_text="\u79c1\u306f\u5b66\u751f",
            reading_overrides={},
            token_surface_overrides=None,
        )
        self.assertEqual(value, "\u79c1\u306f\u5b66\u751f")

    def test_build_tts_input_text_returns_original_for_non_japanese(self) -> None:
        value = _build_tts_input_text(
            language="zh",
            source_text="\u6211\u662f\u5b66\u751f",
            reading_overrides={0: "wo"},
            token_surface_overrides=None,
        )
        self.assertEqual(value, "\u6211\u662f\u5b66\u751f")

    def test_build_tts_input_text_fallback_on_tokenization_mismatch(self) -> None:
        with patch(
            "app.application.usecases.tts_usecase.build_segment_reading_tokens",
            return_value=[
                ReadingToken(surface="\u6771\u4eac"),
            ],
        ):
            value = _build_tts_input_text(
                language="ja",
                source_text="\u6771\u4eac\u90fd",
                reading_overrides={0: "\u3068\u3046\u304d\u3087\u3046"},
                token_surface_overrides=None,
            )
        self.assertEqual(value, "\u6771\u4eac\u90fd")

    def test_resolve_tts_text_hash_uses_legacy_key_when_text_not_changed(self) -> None:
        hash_value = _resolve_tts_text_hash(
            normalized_text="\u79c1 \u306f \u5b66\u751f",
            plain_text="\u79c1\u306f\u5b66\u751f",
            tts_input_text="\u79c1\u306f\u5b66\u751f",
        )
        self.assertEqual(hash_value, calculate_text_hash("\u79c1 \u306f \u5b66\u751f"))

    def test_resolve_tts_text_hash_changes_when_override_changes_text(self) -> None:
        default_hash = _resolve_tts_text_hash(
            normalized_text="\u79c1 \u306f \u5b66\u751f",
            plain_text="\u79c1\u306f\u5b66\u751f",
            tts_input_text="\u79c1\u306f\u5b66\u751f",
        )
        override_hash = _resolve_tts_text_hash(
            normalized_text="\u79c1 \u306f \u5b66\u751f",
            plain_text="\u79c1\u306f\u5b66\u751f",
            tts_input_text="\u308f\u305f\u3057\u306f\u5b66\u751f",
        )
        self.assertNotEqual(default_hash, override_hash)


if __name__ == "__main__":
    unittest.main()
