from dataclasses import dataclass
from functools import lru_cache
import unicodedata


@dataclass(frozen=True)
class ReadingToken:
    surface: str
    yomi: str | None = None
    candidates: tuple[str, ...] = ()
    confidence: float | None = None
    needs_confirmation: bool = False


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


def _clamp_confidence(value: float) -> float:
    return max(0.0, min(1.0, value))


def _dedupe_candidates(*values: str | None) -> tuple[str, ...]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value is None:
            continue
        normalized = value.strip()
        if not normalized:
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return tuple(result)


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
        candidates = _dedupe_candidates(yomi)
        confidence = 0.55 if yomi is not None else None
        tokens.append(
            ReadingToken(
                surface=surface,
                yomi=yomi,
                candidates=candidates,
                confidence=confidence,
                needs_confirmation=False,
            )
        )
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

        has_kanji = _contains_kanji(surface)
        sudachi_yomi = _normalize_reading(surface=surface, hira=reading_form)
        kakasi_yomi = _kakasi_reading_for_surface(surface) if has_kanji else None
        yomi = sudachi_yomi or kakasi_yomi
        candidates = _dedupe_candidates(sudachi_yomi, kakasi_yomi)

        confidence: float | None = None
        needs_confirmation = False
        if yomi is not None and has_kanji:
            source_is_sudachi = sudachi_yomi is not None
            confidence_score = 0.88 if source_is_sudachi else 0.55

            pos0 = ""
            try:
                pos = morpheme.part_of_speech()
                if pos:
                    pos0 = str(pos[0] or "")
            except Exception:
                pos0 = ""

            if pos0 == "接尾辞":
                confidence_score += 0.08
            if pos0 == "名詞" and len(surface) > 1:
                confidence_score += 0.05
            if source_is_sudachi and kakasi_yomi is not None and kakasi_yomi != sudachi_yomi:
                confidence_score -= 0.25
            if pos0 == "代名詞" and source_is_sudachi and kakasi_yomi is not None and kakasi_yomi != sudachi_yomi:
                confidence_score -= 0.1

            confidence = _clamp_confidence(confidence_score)
            needs_confirmation = len(candidates) >= 2 and confidence < 0.75

        tokens.append(
            ReadingToken(
                surface=surface,
                yomi=yomi,
                candidates=candidates,
                confidence=confidence,
                needs_confirmation=needs_confirmation,
            )
        )

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
            yomi = _normalize_pinyin_reading(surface=char)
            tokens.append(
                ReadingToken(
                    surface=char,
                    yomi=yomi,
                    candidates=_dedupe_candidates(yomi),
                    confidence=0.65 if yomi is not None else None,
                    needs_confirmation=False,
                )
            )
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
            if reading_overrides and index in reading_overrides:
                adjusted_tokens.append(
                    ReadingToken(
                        surface=token.surface,
                        yomi=yomi,
                        candidates=_dedupe_candidates(yomi),
                        confidence=1.0 if yomi is not None else None,
                        needs_confirmation=False,
                    )
                )
            else:
                adjusted_tokens.append(
                    ReadingToken(
                        surface=token.surface,
                        yomi=yomi,
                        candidates=token.candidates,
                        confidence=token.confidence,
                        needs_confirmation=False,
                    )
                )
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
            adjusted_tokens.append(
                ReadingToken(
                    surface=token.surface,
                    yomi=yomi,
                    candidates=_dedupe_candidates(yomi),
                    confidence=1.0 if yomi is not None else None,
                    needs_confirmation=False,
                )
            )
        elif reading_surface_overrides and token.surface in reading_surface_overrides:
            surface_override_raw = reading_surface_overrides[token.surface]
            if surface_override_raw is None:
                yomi = None
            else:
                surface_override = surface_override_raw.strip()
                yomi = surface_override if surface_override else None
            adjusted_tokens.append(
                ReadingToken(
                    surface=token.surface,
                    yomi=yomi,
                    candidates=_dedupe_candidates(yomi),
                    confidence=1.0 if yomi is not None else None,
                    needs_confirmation=False,
                )
            )
        else:
            adjusted_tokens.append(
                ReadingToken(
                    surface=token.surface,
                    yomi=yomi,
                    candidates=token.candidates,
                    confidence=token.confidence,
                    needs_confirmation=token.needs_confirmation,
                )
            )
    return adjusted_tokens
