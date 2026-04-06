from dataclasses import dataclass
from functools import lru_cache
import unicodedata


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
        if char in {"\u3005", "\u3006", "\u30F5", "\u30F6"}:
            return True
    return False


def _is_cjk_ideograph(char: str) -> bool:
    code_point = ord(char)
    return 0x4E00 <= code_point <= 0x9FFF


@lru_cache(maxsize=1)
def _build_kakasi_converter():
    import pykakasi  # type: ignore

    return pykakasi.kakasi()


@lru_cache(maxsize=1)
def _build_sudachi_tokenizer():
    from sudachipy import Dictionary, SplitMode  # type: ignore

    return Dictionary().create(), SplitMode.C


def _katakana_to_hiragana(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text)
    chars: list[str] = []
    for char in normalized:
        code_point = ord(char)
        if 0x30A1 <= code_point <= 0x30F6:
            chars.append(chr(code_point - 0x60))
        else:
            chars.append(char)
    return "".join(chars)


def _normalize_reading(*, surface: str, hira: str | None) -> str | None:
    if not hira:
        return None
    if not _contains_kanji(surface):
        return None
    normalized = _katakana_to_hiragana(hira).strip()
    if normalized == "*":
        return None
    return normalized if normalized else None


def _kakasi_reading_for_surface(surface: str) -> str | None:
    if not _contains_kanji(surface):
        return None
    try:
        converter = _build_kakasi_converter()
    except Exception:
        return None
    converted = converter.convert(surface)
    hira = "".join(str(item.get("hira") or item.get("orig") or "") for item in converted)
    return _normalize_reading(surface=surface, hira=hira)


def _build_ja_tokens_with_kakasi(text: str) -> list[ReadingToken]:
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


def _build_ja_tokens_with_sudachi(text: str) -> list[ReadingToken]:
    try:
        tokenizer, split_mode = _build_sudachi_tokenizer()
    except Exception:
        return []

    try:
        morphemes = tokenizer.tokenize(text, split_mode)
    except Exception:
        return []

    tokens: list[ReadingToken] = []
    for morpheme in morphemes:
        surface = str(morpheme.surface() or "")
        if not surface:
            continue
        reading_form: str | None
        try:
            reading_form = morpheme.reading_form()
        except Exception:
            reading_form = None

        yomi = _normalize_reading(surface=surface, hira=reading_form)
        if yomi is None and _contains_kanji(surface):
            yomi = _kakasi_reading_for_surface(surface)
        tokens.append(ReadingToken(surface=surface, yomi=yomi))

    # Keep token mapping stable; if tokenization changed text shape, use kakasi fallback path.
    reconstructed = "".join(token.surface for token in tokens)
    if reconstructed != text:
        return []
    return tokens


def _build_ja_tokens(text: str) -> list[ReadingToken]:
    tokens = _build_ja_tokens_with_sudachi(text)
    if tokens:
        return tokens
    return _build_ja_tokens_with_kakasi(text)


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

    tokens = _build_ja_tokens(text)
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
        elif reading_surface_overrides and token.surface in reading_surface_overrides:
            surface_override_raw = reading_surface_overrides[token.surface]
            if surface_override_raw is None:
                yomi = None
            else:
                surface_override = surface_override_raw.strip()
                yomi = surface_override if surface_override else None
        adjusted_tokens.append(ReadingToken(surface=token.surface, yomi=yomi))
    return adjusted_tokens
