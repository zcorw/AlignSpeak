from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class ReadingToken:
    surface: str
    yomi: str | None = None


def _contains_kanji(text: str) -> bool:
    for char in text:
        code_point = ord(char)
        if 0x3400 <= code_point <= 0x4DBF:  # CJK Unified Ideographs Extension A
            return True
        if 0x4E00 <= code_point <= 0x9FFF:  # CJK Unified Ideographs
            return True
        if char in {"\u3005", "\u3006", "\u30F5", "\u30F6"}:  # 々, 〆, ヵ, ヶ
            return True
    return False


@lru_cache(maxsize=1)
def _build_kakasi_converter():
    import pykakasi  # type: ignore

    return pykakasi.kakasi()


def _normalize_reading(*, surface: str, hira: str | None) -> str | None:
    if not hira:
        return None
    if not _contains_kanji(surface):
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

