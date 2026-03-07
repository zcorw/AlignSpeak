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


def align_segment_text(*, reference_text: str, recognized_text: str, language: str) -> AlignmentResult:
    ref = _tokenize_text(reference_text, language)
    hyp = _tokenize_text(recognized_text, language)
    operations = _global_align(ref, hyp)

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


def _tokenize_text(text: str, language: str) -> list[_Token]:
    normalized = normalize_text(text)
    if not normalized:
        return []
    if language == "ja":
        reading_tokens = build_segment_reading_tokens(text=normalized, language=language)
        tokens = [
            _Token(
                text=token.surface,
                key=(token.yomi or token.surface),
            )
            for token in reading_tokens
            if token.surface
        ]
        return [token for token in tokens if not _is_punctuation_token(token.text)]

    if language == "en":
        raw = re.findall(r"[A-Za-z0-9]+", normalized)
        return [_Token(text=part, key=part.lower()) for part in raw if not _is_punctuation_token(part)]

    raw = re.findall(r"[\u4e00-\u9fff]|[A-Za-z0-9]+", normalized)
    return [_Token(text=part, key=part) for part in raw if not _is_punctuation_token(part)]


def _global_align(ref: list[_Token], hyp: list[_Token]) -> list[tuple[str, int | None, int | None]]:
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
        ref_idx = i - 1 if kind in {"correct", "substitute", "missing"} and i > 0 else None
        hyp_idx = j - 1 if kind in {"correct", "substitute", "insert"} and j > 0 else None
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
