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


if __name__ == "__main__":
    unittest.main()
