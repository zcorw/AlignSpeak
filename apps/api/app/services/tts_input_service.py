import logging

from app.services.reading_service import build_segment_reading_tokens
from app.services.tts_service import calculate_text_hash

logger = logging.getLogger(__name__)


def build_tts_input_text(
    *,
    language: str,
    source_text: str,
    reading_overrides: dict[int, str],
    token_surface_overrides: list[str] | None,
) -> str:
    if language != "ja" or not reading_overrides:
        return source_text

    tokens = build_segment_reading_tokens(
        text=source_text,
        language=language,
        token_surface_overrides=token_surface_overrides,
    )
    if not tokens:
        return source_text

    joined_surface = "".join(token.surface for token in tokens)
    if joined_surface != source_text:
        logger.warning(
            "TTS override skipped due to tokenization mismatch: source_len=%d joined_len=%d",
            len(source_text),
            len(joined_surface),
        )
        return source_text

    parts = [reading_overrides.get(index) or token.surface for index, token in enumerate(tokens)]
    return "".join(parts) or source_text


def resolve_tts_text_hash(*, normalized_text: str, plain_text: str, tts_input_text: str) -> str:
    # Preserve the historical cache key when no pronunciation override changed
    # the spoken input.
    if tts_input_text == plain_text:
        return calculate_text_hash(normalized_text)
    return calculate_text_hash(tts_input_text)


# Backward-compatible private names used by existing callers/tests.
_build_tts_input_text = build_tts_input_text
_resolve_tts_text_hash = resolve_tts_text_hash
