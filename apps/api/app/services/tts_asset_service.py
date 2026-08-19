import json
import math
from pathlib import Path

from app.models import TtsAsset
from app.services.tts_service import resolve_media_output_path

SEGMENT_TIMELINE_VERSION = "v3"
TimelineItem = dict[str, int | float | str]


def normalize_timeline_item(raw: dict) -> TimelineItem | None:
    try:
        sentence_index = int(raw.get("sentence_index", 0))
        text = str(raw.get("text") or "").strip()
        start_ms = float(raw.get("start_ms", 0))
        end_ms = float(raw.get("end_ms", 0))
    except (TypeError, ValueError):
        return None

    if not text:
        return None
    if not math.isfinite(start_ms) or not math.isfinite(end_ms):
        return None
    sentence_index = max(sentence_index, 0)
    start_ms = max(start_ms, 0.0)
    end_ms = max(end_ms, start_ms)
    return {
        "sentence_index": sentence_index,
        "text": text,
        "start_ms": round(start_ms, 3),
        "end_ms": round(end_ms, 3),
    }


def normalize_timeline_payload(payload: object) -> list[TimelineItem] | None:
    if not isinstance(payload, list):
        return None
    normalized: list[TimelineItem] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        normalized_item = normalize_timeline_item(item)
        if normalized_item is not None:
            normalized.append(normalized_item)
    if not normalized:
        return None
    normalized.sort(key=lambda item: (int(item["sentence_index"]), float(item["start_ms"])))
    previous_end = 0.0
    for item in normalized:
        start_ms = float(item["start_ms"])
        end_ms = float(item["end_ms"])
        if start_ms < previous_end or end_ms < start_ms:
            return None
        previous_end = end_ms
    return normalized


def load_timeline_from_asset(*, asset: TtsAsset) -> list[TimelineItem] | None:
    if not asset.timeline_json:
        return None
    try:
        payload = json.loads(asset.timeline_json)
    except json.JSONDecodeError:
        return None
    return normalize_timeline_payload(payload)


def resolve_media_path_from_audio_url(audio_url: str) -> Path:
    return resolve_media_output_path(Path(audio_url).name)


def load_valid_tts_asset(
    *,
    asset: TtsAsset | None,
    path_resolver=resolve_media_path_from_audio_url,
) -> tuple[Path, list[TimelineItem]] | None:
    if asset is None or asset.timeline_version != SEGMENT_TIMELINE_VERSION:
        return None
    media_path = path_resolver(asset.audio_url)
    if not media_path.is_file() or media_path.stat().st_size <= 0:
        return None
    timeline = load_timeline_from_asset(asset=asset)
    if timeline is None:
        return None
    return media_path, timeline


# Backward-compatible private names used by the existing segment use case.
_normalize_timeline_item = normalize_timeline_item
_load_timeline_from_asset = load_timeline_from_asset
_resolve_media_path_from_audio_url = resolve_media_path_from_audio_url
