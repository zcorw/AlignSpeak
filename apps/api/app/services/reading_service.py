from dataclasses import dataclass
from functools import lru_cache
import re

KANJI_PATTERN = re.compile(r"[一-龯々〆ヵヶ]")


@dataclass(frozen=True)
class ReadingToken:
    surface: str
    yomi: str | None = None


@lru_cache(maxsize=1)
def _build_kakasi_converter():
    import pykakasi  # type: ignore

    return pykakasi.kakasi()


def _normalize_reading(*, surface: str, hira: str | None) -> str | None:
    if not hira:
        return None
    if not KANJI_PATTERN.search(surface):
        return None
    normalized = hira.strip()
    return normalized if normalized else None


def build_segment_reading_tokens(*, text: str, language: str) -> list[ReadingToken]:
    if language != "ja":
        return []
    if not text.strip():
        return []

    try:
        converter = _build_kakasi_converter()
    except Exception:
        return []

    converted = converter.convert(text)
    tokens: list[ReadingToken] = []
    for item in converted:
        surface = str(item.get("orig", ""))
        if not surface:
            continue
        yomi = _normalize_reading(surface=surface, hira=item.get("hira"))
        tokens.append(ReadingToken(surface=surface, yomi=yomi))
    return tokens
