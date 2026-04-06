import unittest

from app.services.reading_service import build_segment_reading_tokens


def _collapse_phonetic(text: str) -> str:
    tokens = build_segment_reading_tokens(text=text, language="ja")
    return "".join(token.yomi if token.yomi is not None else token.surface for token in tokens)


class JapaneseReadingServiceTests(unittest.TestCase):
    def test_contextual_reading_ano_hito(self) -> None:
        self.assertEqual(_collapse_phonetic("\u3042\u306e\u4eba"), "\u3042\u306e\u3072\u3068")

    def test_contextual_reading_sannin(self) -> None:
        self.assertEqual(_collapse_phonetic("\u4e09\u4eba"), "\u3055\u3093\u306b\u3093")

    def test_contextual_reading_nihonjin(self) -> None:
        self.assertEqual(_collapse_phonetic("\u65e5\u672c\u4eba"), "\u306b\u307b\u3093\u3058\u3093")

    def test_contextual_reading_kono_hitotachi(self) -> None:
        self.assertEqual(
            _collapse_phonetic("\u3053\u306e\u4eba\u305f\u3061"),
            "\u3053\u306e\u3072\u3068\u305f\u3061",
        )

    def test_contextual_reading_hito_wa_hito(self) -> None:
        self.assertEqual(_collapse_phonetic("\u4eba\u306f\u4eba"), "\u3072\u3068\u306f\u3072\u3068")

    def test_reading_override_still_applies(self) -> None:
        tokens = build_segment_reading_tokens(
            text="\u4eba",
            language="ja",
            reading_overrides={0: "\u306b\u3093"},
        )
        self.assertEqual(len(tokens), 1)
        self.assertEqual(tokens[0].surface, "\u4eba")
        self.assertEqual(tokens[0].yomi, "\u306b\u3093")
        self.assertEqual(tokens[0].candidates, ("\u306b\u3093",))
        self.assertFalse(tokens[0].needs_confirmation)

    def test_pronoun_returns_candidates_and_low_confidence(self) -> None:
        tokens = build_segment_reading_tokens(
            text="\u79c1\u306f\u5b66\u751f\u3067\u3059",
            language="ja",
        )
        self.assertGreaterEqual(len(tokens), 1)
        self.assertEqual(tokens[0].surface, "\u79c1")
        self.assertEqual(tokens[0].yomi, "\u308f\u305f\u304f\u3057")
        self.assertEqual(tokens[0].candidates, ("\u308f\u305f\u304f\u3057", "\u308f\u305f\u3057"))
        self.assertIsNotNone(tokens[0].confidence)
        self.assertLess(tokens[0].confidence or 1.0, 0.75)
        self.assertTrue(tokens[0].needs_confirmation)

    def test_counter_context_keeps_high_confidence(self) -> None:
        tokens = build_segment_reading_tokens(
            text="\u4e09\u4eba",
            language="ja",
        )
        self.assertEqual(len(tokens), 2)
        self.assertEqual(tokens[1].surface, "\u4eba")
        self.assertEqual(tokens[1].yomi, "\u306b\u3093")
        self.assertEqual(tokens[1].candidates, ("\u306b\u3093",))
        self.assertIsNotNone(tokens[1].confidence)
        self.assertGreaterEqual(tokens[1].confidence or 0.0, 0.75)
        self.assertFalse(tokens[1].needs_confirmation)

    def test_token_surface_overrides_can_change_segmentation(self) -> None:
        tokens = build_segment_reading_tokens(
            text="\u6771\u4eac\u90fd",
            language="ja",
            token_surface_overrides=["\u6771\u4eac", "\u90fd"],
        )
        self.assertEqual([token.surface for token in tokens], ["\u6771\u4eac", "\u90fd"])
        self.assertEqual("".join(token.surface for token in tokens), "\u6771\u4eac\u90fd")

    def test_reading_override_works_with_token_surface_overrides(self) -> None:
        tokens = build_segment_reading_tokens(
            text="\u6771\u4eac\u90fd",
            language="ja",
            token_surface_overrides=["\u6771\u4eac", "\u90fd"],
            reading_overrides={1: "\u3068"},
        )
        self.assertEqual([token.surface for token in tokens], ["\u6771\u4eac", "\u90fd"])
        self.assertEqual(tokens[1].yomi, "\u3068")
        self.assertEqual(tokens[1].candidates, ("\u3068",))


if __name__ == "__main__":
    unittest.main()
