from dataclasses import dataclass
import re
import unicodedata

from app.services.article_service import normalize_text
from app.services.reading_service import build_segment_reading_tokens


@dataclass(frozen=True)
class AlignedToken:
    text: str
    status: str


@dataclass(frozen=True)
class CompareBlockResult:
    block_order: int
    reference: list[AlignedToken]
    recognized: list[AlignedToken]


@dataclass(frozen=True)
class NoiseSpanResult:
    start_token: int
    end_token: int
    reason: str


@dataclass(frozen=True)
class AlignmentResult:
    accuracy_rate: float
    ref_tokens: list[AlignedToken]
    hyp_tokens: list[AlignedToken]
    compare_blocks: list[CompareBlockResult]
    noise_spans: list[NoiseSpanResult]


@dataclass(frozen=True)
class _Token:
    text: str
    key: str


def align_segment_text(
    *,
    reference_text: str,
    recognized_text: str,
    language: str,
    reading_overrides: dict[int, str | None] | None = None,
) -> AlignmentResult:
    surface_overrides = (
        _build_reference_surface_override_map(reference_text=reference_text, reading_overrides=reading_overrides)
        if language == "ja" and reading_overrides
        else None
    )
    ref = _tokenize_text(reference_text, language, reading_overrides=reading_overrides)
    hyp = _tokenize_text(
        recognized_text,
        language,
        reading_surface_overrides=surface_overrides,
    )
    operations = _align_with_resync(ref=ref, hyp=hyp, language=language)

    ref_statuses = ["correct"] * len(ref)
    hyp_statuses = ["correct"] * len(hyp)

    for kind, ref_idx, hyp_idx in operations:
        if kind == "correct":
            continue
        if kind == "missing" and ref_idx is not None:
            ref_statuses[ref_idx] = "missing"
        elif kind == "insert" and hyp_idx is not None:
            hyp_statuses[hyp_idx] = "insert"
        elif kind == "substitute":
            if ref_idx is not None:
                ref_statuses[ref_idx] = "substitute"
            if hyp_idx is not None:
                hyp_statuses[hyp_idx] = "substitute"

    if language == "ja":
        ref_tokens = _collapse_japanese_display_tokens(
            source_text=reference_text,
            char_tokens=ref,
            char_statuses=ref_statuses,
            side="ref",
            reading_overrides=reading_overrides,
        )
        hyp_tokens = _collapse_japanese_display_tokens(
            source_text=recognized_text,
            char_tokens=hyp,
            char_statuses=hyp_statuses,
            side="hyp",
            reading_surface_overrides=surface_overrides,
        )
    else:
        ref_tokens = [AlignedToken(text=token.text, status=ref_statuses[idx]) for idx, token in enumerate(ref)]
        hyp_tokens = [AlignedToken(text=token.text, status=hyp_statuses[idx]) for idx, token in enumerate(hyp)]

    correct_count = sum(1 for token in ref_tokens if token.status == "correct")
    accuracy_rate = (correct_count / len(ref_tokens)) if ref_tokens else 0.0

    return AlignmentResult(
        accuracy_rate=round(accuracy_rate, 4),
        ref_tokens=ref_tokens,
        hyp_tokens=hyp_tokens,
        compare_blocks=[
            CompareBlockResult(
                block_order=1,
                reference=ref_tokens,
                recognized=hyp_tokens,
            )
        ],
        noise_spans=_detect_noise_spans(hyp_tokens),
    )


def _tokenize_text(
    text: str,
    language: str,
    *,
    reading_overrides: dict[int, str | None] | None = None,
    reading_surface_overrides: dict[str, str | None] | None = None,
) -> list[_Token]:
    normalized = normalize_text(text)
    if not normalized:
        return []
    if language == "ja":
        reading_tokens = build_segment_reading_tokens(
            text=normalized,
            language=language,
            reading_overrides=reading_overrides,
            reading_surface_overrides=reading_surface_overrides,
        )
        if reading_tokens:
            phonetic = "".join(
                _normalize_japanese_phonetic(token.yomi or token.surface)
                for token in reading_tokens
                if token.surface
            )
        else:
            phonetic = _normalize_japanese_phonetic(normalized)
        return [
            _Token(text=char, key=char)
            for char in phonetic
            if not _is_punctuation_token(char)
        ]

    if language == "en":
        raw = re.findall(r"[A-Za-z0-9]+", normalized)
        return [_Token(text=part, key=part.lower()) for part in raw if not _is_punctuation_token(part)]

    raw = re.findall(r"[\u4e00-\u9fff]|[A-Za-z0-9]+", normalized)
    return [_Token(text=part, key=part) for part in raw if not _is_punctuation_token(part)]


def _collapse_japanese_display_tokens(
    *,
    source_text: str,
    char_tokens: list[_Token],
    char_statuses: list[str],
    side: str,
    reading_overrides: dict[int, str | None] | None = None,
    reading_surface_overrides: dict[str, str | None] | None = None,
) -> list[AlignedToken]:
    units = _build_japanese_display_units(
        source_text,
        reading_overrides=reading_overrides,
        reading_surface_overrides=reading_surface_overrides,
    )
    if not units:
        return [AlignedToken(text=token.text, status=char_statuses[idx]) for idx, token in enumerate(char_tokens)]

    collapsed: list[AlignedToken] = []
    cursor = 0
    for surface, phonetic_len in units:
        next_cursor = cursor + phonetic_len
        if next_cursor > len(char_statuses):
            return [AlignedToken(text=token.text, status=char_statuses[idx]) for idx, token in enumerate(char_tokens)]
        span_statuses = char_statuses[cursor:next_cursor]
        expanded_tokens = _expand_hyp_unit_tokens(surface=surface, statuses=span_statuses, side=side)
        if expanded_tokens:
            collapsed.extend(expanded_tokens)
        else:
            collapsed.append(AlignedToken(text=surface, status=_merge_japanese_statuses(span_statuses, side=side)))
        cursor = next_cursor

    if cursor != len(char_statuses):
        return [AlignedToken(text=token.text, status=char_statuses[idx]) for idx, token in enumerate(char_tokens)]
    return collapsed


def _build_japanese_display_units(
    text: str,
    *,
    reading_overrides: dict[int, str | None] | None = None,
    reading_surface_overrides: dict[str, str | None] | None = None,
) -> list[tuple[str, int]]:
    normalized = normalize_text(text)
    if not normalized:
        return []

    reading_tokens = build_segment_reading_tokens(
        text=normalized,
        language="ja",
        reading_overrides=reading_overrides,
        reading_surface_overrides=reading_surface_overrides,
    )
    if not reading_tokens:
        return [
            (char, 1)
            for char in normalized
            if not _is_punctuation_token(char)
        ]

    units: list[tuple[str, int]] = []
    for token in reading_tokens:
        surface = token.surface.strip()
        if not surface or _is_punctuation_token(surface):
            continue
        phonetic = _normalize_japanese_phonetic(token.yomi or token.surface)
        phonetic_chars = [char for char in phonetic if not _is_punctuation_token(char)]
        if not phonetic_chars:
            continue
        units.append((surface, len(phonetic_chars)))
    return units


def _merge_japanese_statuses(statuses: list[str], *, side: str) -> str:
    if side == "ref":
        if any(status == "substitute" for status in statuses):
            return "substitute"
        if any(status == "missing" for status in statuses):
            return "missing"
        return "correct"

    if any(status == "substitute" for status in statuses):
        return "substitute"
    if any(status == "insert" for status in statuses):
        return "insert"
    return "correct"


def _expand_hyp_unit_tokens(
    *,
    surface: str,
    statuses: list[str],
    side: str,
) -> list[AlignedToken]:
    if side != "hyp":
        return []
    # Only split when a unit contains mixed statuses and the surface can be mapped 1:1 to the phonetic span.
    if not statuses or all(status == statuses[0] for status in statuses):
        return []
    chars = list(surface)
    if len(chars) != len(statuses):
        return []

    expanded: list[AlignedToken] = []
    start = 0
    current_status = statuses[0]
    for index in range(1, len(statuses) + 1):
        next_status = statuses[index] if index < len(statuses) else None
        if next_status == current_status:
            continue
        text = "".join(chars[start:index])
        if text:
            expanded.append(AlignedToken(text=text, status=current_status))
        if index < len(statuses):
            start = index
            current_status = statuses[index]
    return expanded


def _align_with_resync(*, ref: list[_Token], hyp: list[_Token], language: str) -> list[tuple[str, int | None, int | None]]:
    if language != "ja":
        return _global_align(ref, hyp, ref_offset=0, hyp_offset=0)

    anchors = _select_anchor_chain(ref=ref, hyp=hyp)
    if not anchors:
        return _global_align(ref, hyp, ref_offset=0, hyp_offset=0)

    operations: list[tuple[str, int | None, int | None]] = []
    ref_cursor = 0
    hyp_cursor = 0
    for ref_start, hyp_start, anchor_len in anchors:
        if ref_start > ref_cursor or hyp_start > hyp_cursor:
            operations.extend(
                _global_align(
                    ref[ref_cursor:ref_start],
                    hyp[hyp_cursor:hyp_start],
                    ref_offset=ref_cursor,
                    hyp_offset=hyp_cursor,
                )
            )
        for index in range(anchor_len):
            operations.append(("correct", ref_start + index, hyp_start + index))
        ref_cursor = ref_start + anchor_len
        hyp_cursor = hyp_start + anchor_len

    if ref_cursor < len(ref) or hyp_cursor < len(hyp):
        operations.extend(
            _global_align(
                ref[ref_cursor:],
                hyp[hyp_cursor:],
                ref_offset=ref_cursor,
                hyp_offset=hyp_cursor,
            )
        )
    return operations


def _select_anchor_chain(*, ref: list[_Token], hyp: list[_Token]) -> list[tuple[int, int, int]]:
    if len(ref) < 8 or len(hyp) < 8:
        return []

    candidates = _collect_anchor_candidates(ref=ref, hyp=hyp, min_len=4, max_len=8)
    if not candidates:
        return []

    candidates.sort(key=lambda item: (item[0], item[1], -item[2]))
    n = len(candidates)
    dp = [0] * n
    prev = [-1] * n
    best_index = -1
    best_score = 0

    for i, (ref_start, hyp_start, anchor_len) in enumerate(candidates):
        dp[i] = anchor_len
        for j in range(i):
            prev_ref_start, prev_hyp_start, prev_len = candidates[j]
            prev_ref_end = prev_ref_start + prev_len
            prev_hyp_end = prev_hyp_start + prev_len
            if prev_ref_end <= ref_start and prev_hyp_end <= hyp_start:
                score = dp[j] + anchor_len
                if score > dp[i]:
                    dp[i] = score
                    prev[i] = j
        if dp[i] > best_score:
            best_score = dp[i]
            best_index = i

    if best_index < 0 or best_score < 8:
        return []

    chain: list[tuple[int, int, int]] = []
    current = best_index
    while current >= 0:
        chain.append(candidates[current])
        current = prev[current]
    chain.reverse()
    return chain


def _collect_anchor_candidates(
    *,
    ref: list[_Token],
    hyp: list[_Token],
    min_len: int,
    max_len: int,
) -> list[tuple[int, int, int]]:
    ref_keys = [token.key for token in ref]
    hyp_keys = [token.key for token in hyp]
    seen: set[tuple[int, int, int]] = set()
    candidates: list[tuple[int, int, int]] = []

    for window in range(max_len, min_len - 1, -1):
        ref_positions = _collect_ngram_positions(ref_keys, window)
        hyp_positions = _collect_ngram_positions(hyp_keys, window)
        for ngram, ref_pos_list in ref_positions.items():
            if len(ref_pos_list) != 1:
                continue
            hyp_pos_list = hyp_positions.get(ngram)
            if not hyp_pos_list or len(hyp_pos_list) != 1:
                continue
            candidate = (ref_pos_list[0], hyp_pos_list[0], window)
            if candidate in seen:
                continue
            seen.add(candidate)
            candidates.append(candidate)
    return candidates


def _collect_ngram_positions(tokens: list[str], window: int) -> dict[tuple[str, ...], list[int]]:
    positions: dict[tuple[str, ...], list[int]] = {}
    if window <= 0 or len(tokens) < window:
        return positions
    for start in range(0, len(tokens) - window + 1):
        ngram = tuple(tokens[start:start + window])
        positions.setdefault(ngram, []).append(start)
    return positions


def _global_align(
    ref: list[_Token],
    hyp: list[_Token],
    *,
    ref_offset: int,
    hyp_offset: int,
) -> list[tuple[str, int | None, int | None]]:
    n = len(ref)
    m = len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    back: list[list[tuple[int, int, str] | None]] = [[None] * (m + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        dp[i][0] = i
        back[i][0] = (i - 1, 0, "missing")
    for j in range(1, m + 1):
        dp[0][j] = j
        back[0][j] = (0, j - 1, "insert")

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            is_match = ref[i - 1].key == hyp[j - 1].key
            diagonal_cost = dp[i - 1][j - 1] + (0 if is_match else 1)
            delete_cost = dp[i - 1][j] + 1
            insert_cost = dp[i][j - 1] + 1
            best_cost = min(diagonal_cost, delete_cost, insert_cost)
            dp[i][j] = best_cost
            if best_cost == diagonal_cost:
                back[i][j] = (i - 1, j - 1, "correct" if is_match else "substitute")
            elif best_cost == delete_cost:
                back[i][j] = (i - 1, j, "missing")
            else:
                back[i][j] = (i, j - 1, "insert")

    ops: list[tuple[str, int | None, int | None]] = []
    i = n
    j = m
    while i > 0 or j > 0:
        step = back[i][j]
        if step is None:
            break
        prev_i, prev_j, kind = step
        ref_idx = (ref_offset + i - 1) if kind in {"correct", "substitute", "missing"} and i > 0 else None
        hyp_idx = (hyp_offset + j - 1) if kind in {"correct", "substitute", "insert"} and j > 0 else None
        ops.append((kind, ref_idx, hyp_idx))
        i, j = prev_i, prev_j

    ops.reverse()
    return ops


def _detect_noise_spans(tokens: list[AlignedToken]) -> list[NoiseSpanResult]:
    spans: list[NoiseSpanResult] = []
    start = -1
    for idx, token in enumerate(tokens):
        if token.status == "insert":
            if start == -1:
                start = idx
            continue
        if start != -1 and idx - start >= 2:
            spans.append(NoiseSpanResult(start_token=start, end_token=idx, reason="repeat"))
        start = -1
    if start != -1 and len(tokens) - start >= 2:
        spans.append(NoiseSpanResult(start_token=start, end_token=len(tokens), reason="repeat"))
    return spans


def _is_punctuation_token(text: str) -> bool:
    compact = "".join(char for char in text if not char.isspace())
    if not compact:
        return True
    for char in compact:
        category = unicodedata.category(char)
        if category[0] not in {"P", "S"}:
            return False
    return True


def _normalize_japanese_phonetic(text: str) -> str:
    # Normalize full-width variants and convert Katakana to Hiragana
    normalized = unicodedata.normalize("NFKC", text)
    chars: list[str] = []
    for char in normalized:
        code_point = ord(char)
        if 0x30A1 <= code_point <= 0x30F6:
            chars.append(chr(code_point - 0x60))
        else:
            chars.append(char)
    return "".join(chars)


def _build_reference_surface_override_map(
    *,
    reference_text: str,
    reading_overrides: dict[int, str | None] | None,
) -> dict[str, str | None]:
    if not reading_overrides:
        return {}

    base_tokens = build_segment_reading_tokens(text=normalize_text(reference_text), language="ja")
    if not base_tokens:
        return {}

    surface_map: dict[str, str | None] = {}
    ambiguous_surfaces: set[str] = set()
    for token_index, yomi in reading_overrides.items():
        if token_index < 0 or token_index >= len(base_tokens):
            continue
        surface = base_tokens[token_index].surface
        if not surface or _is_punctuation_token(surface):
            continue
        normalized = yomi.strip() if isinstance(yomi, str) else None
        if surface in surface_map and surface_map[surface] != normalized:
            ambiguous_surfaces.add(surface)
            continue
        surface_map[surface] = normalized

    for surface in ambiguous_surfaces:
        surface_map.pop(surface, None)
    return surface_map
