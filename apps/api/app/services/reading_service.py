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


def _is_cjk_ideograph(char: str) -> bool:
    code_point = ord(char)
    return 0x4E00 <= code_point <= 0x9FFF


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


@lru_cache(maxsize=1)
def _load_pypinyin_helpers():
    from pypinyin import Style, lazy_pinyin  # type: ignore

    return lazy_pinyin, Style


def _normalize_pinyin_reading(*, surface: str) -> str | None:
    if len(surface) != 1 or not _is_cjk_ideograph(surface):
        return None
    try:
        lazy_pinyin, style = _load_pypinyin_helpers()
        values = lazy_pinyin(surface, style=style.TONE)
    except Exception:
        return None
    if not values:
        return None
    value = str(values[0]).strip().lower()
    return value or None


def _build_zh_tokens(text: str) -> list[ReadingToken]:
    tokens: list[ReadingToken] = []
    buffer = ""
    for char in text:
        if _is_cjk_ideograph(char):
            if buffer:
                tokens.append(ReadingToken(surface=buffer, yomi=None))
                buffer = ""
            tokens.append(ReadingToken(surface=char, yomi=_normalize_pinyin_reading(surface=char)))
            continue
        if char.isspace():
            if buffer:
                tokens.append(ReadingToken(surface=buffer, yomi=None))
                buffer = ""
            tokens.append(ReadingToken(surface=char, yomi=None))
            continue
        buffer += char
    if buffer:
        tokens.append(ReadingToken(surface=buffer, yomi=None))
    return tokens


def build_segment_reading_tokens(
    *,
    text: str,
    language: str,
    reading_overrides: dict[int, str | None] | None = None,
    reading_surface_overrides: dict[str, str | None] | None = None,
) -> list[ReadingToken]:
    if language not in {"ja", "zh"}:
        return []
    if not text.strip():
        return []

    if language == "zh":
        tokens = _build_zh_tokens(text)
        if not tokens:
            return []
        adjusted_tokens: list[ReadingToken] = []
        for index, token in enumerate(tokens):
            yomi = token.yomi
            if reading_overrides and index in reading_overrides:
                override_raw = reading_overrides[index]
                if override_raw is None:
                    yomi = None
                else:
                    override = override_raw.strip()
                    yomi = override if override else None
            adjusted_tokens.append(ReadingToken(surface=token.surface, yomi=yomi))
        return adjusted_tokens

    try:
        converter = _build_kakasi_converter()
    except Exception:
        return []

    converted = converter.convert(text)
    tokens: list[ReadingToken] = []
    for index, item in enumerate(converted):
        surface = str(item.get("orig", ""))
        if not surface:
            continue
        yomi = _normalize_reading(surface=surface, hira=item.get("hira"))
        if reading_overrides and index in reading_overrides:
            override_raw = reading_overrides[index]
            if override_raw is None:
                yomi = None
            else:
                override = override_raw.strip()
                yomi = override if override else None
        elif reading_surface_overrides and surface in reading_surface_overrides:
            surface_override_raw = reading_surface_overrides[surface]
            if surface_override_raw is None:
                yomi = None
            else:
                surface_override = surface_override_raw.strip()
                yomi = surface_override if surface_override else None
        tokens.append(ReadingToken(surface=surface, yomi=yomi))
    return tokens
