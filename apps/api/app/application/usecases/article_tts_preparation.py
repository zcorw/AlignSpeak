import hashlib
import json
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from app.infrastructure.repositories.tts_repository import TtsRepository
from app.models import Article, ArticleSegment, TtsAsset, utcnow
from app.services.tts_asset_service import (
    SEGMENT_TIMELINE_VERSION,
    TimelineItem,
    load_valid_tts_asset,
    normalize_timeline_payload,
    resolve_media_path_from_audio_url,
)
from app.services.tts_input_service import build_tts_input_text, resolve_tts_text_hash
from app.services.tts_service import (
    build_tts_filename,
    map_language_to_default_voice,
    resolve_media_output_path,
    synthesize_to_mp3,
)

ARTICLE_TTS_INPUT_VERSION = "article-input-v1"
DEFAULT_VOICE_POLICY_VERSION = "default-voice-v1"
ARTICLE_TTS_SPEED = 1.0
PAUSE_POLICY_VERSION = "pause-v1-750-1500"
ENCODER_PROFILE_VERSION = "mp3-24k-mono-48k-v1"
ARTICLE_TIMELINE_VERSION = "article-v1"


@dataclass(frozen=True)
class ArticleTtsSegmentInput:
    segment_id: str
    segment_order: int
    tts_input_text: str
    text_hash: str


@dataclass(frozen=True)
class ArticleTtsInputSnapshot:
    user_id: str
    article_id: str
    language: str
    resolved_voice: str
    speed: float
    voice_policy_version: str
    pause_policy_version: str
    encoder_profile_version: str
    timeline_version: str
    segments: tuple[ArticleTtsSegmentInput, ...]
    input_hash: str


@dataclass(frozen=True)
class PreparedArticleTtsSegment:
    segment: ArticleTtsSegmentInput
    asset: TtsAsset
    media_path: Path
    timeline: tuple[TimelineItem, ...]
    cached: bool


class ArticleTtsSegmentPreparationError(Exception):
    def __init__(
        self,
        *,
        segment_id: str,
        segment_order: int,
        attempts: int,
        cause: Exception,
    ) -> None:
        self.segment_id = segment_id
        self.segment_order = segment_order
        self.attempts = attempts
        self.cause = cause
        super().__init__(f"Segment {segment_order} TTS preparation failed after {attempts} attempts.")


def _load_reading_overrides(
    *,
    repository: TtsRepository,
    user_id: str,
    segment_id: str,
) -> dict[int, str]:
    overrides: dict[int, str] = {}
    for row in repository.list_segment_reading_overrides(user_id=user_id, segment_id=segment_id):
        yomi = str(row.yomi or "").strip()
        if yomi:
            overrides[int(row.token_index)] = yomi
    return overrides


def _load_token_surfaces(
    *,
    repository: TtsRepository,
    user_id: str,
    segment_id: str,
) -> list[str] | None:
    rows = repository.list_segment_token_overrides(user_id=user_id, segment_id=segment_id)
    if not rows:
        return None
    return [str(row.surface or "") for row in rows]


def _build_segment_input(
    *,
    repository: TtsRepository,
    user_id: str,
    article: Article,
    segment: ArticleSegment,
) -> ArticleTtsSegmentInput:
    tts_input_text = build_tts_input_text(
        language=article.language,
        source_text=segment.plain_text,
        reading_overrides=_load_reading_overrides(
            repository=repository,
            user_id=user_id,
            segment_id=segment.id,
        ),
        token_surface_overrides=_load_token_surfaces(
            repository=repository,
            user_id=user_id,
            segment_id=segment.id,
        ),
    )
    return ArticleTtsSegmentInput(
        segment_id=segment.id,
        segment_order=int(segment.segment_order),
        tts_input_text=tts_input_text,
        text_hash=resolve_tts_text_hash(
            normalized_text=segment.normalized_text,
            plain_text=segment.plain_text,
            tts_input_text=tts_input_text,
        ),
    )


def _calculate_snapshot_hash(payload: dict) -> str:
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def build_article_tts_input_snapshot(
    *,
    repository: TtsRepository,
    user_id: str,
    article_id: str,
    voice: str = "default",
    speed: float = ARTICLE_TTS_SPEED,
    voice_policy_version: str = DEFAULT_VOICE_POLICY_VERSION,
    pause_policy_version: str = PAUSE_POLICY_VERSION,
    encoder_profile_version: str = ENCODER_PROFILE_VERSION,
    timeline_version: str = ARTICLE_TIMELINE_VERSION,
) -> ArticleTtsInputSnapshot | None:
    article = repository.get_article_for_user(article_id=article_id, user_id=user_id)
    if article is None:
        return None
    segments = repository.list_segments_for_article(article_id=article_id)
    segment_inputs = tuple(
        _build_segment_input(
            repository=repository,
            user_id=user_id,
            article=article,
            segment=segment,
        )
        for segment in segments
    )
    resolved_voice = map_language_to_default_voice(article.language) if voice == "default" else voice
    canonical_payload = {
        "version": ARTICLE_TTS_INPUT_VERSION,
        "article_id": article.id,
        "language": article.language,
        "voice": resolved_voice,
        "voice_policy_version": voice_policy_version,
        "speed": format(speed, ".3f"),
        "pause_policy_version": pause_policy_version,
        "encoder_profile_version": encoder_profile_version,
        "timeline_version": timeline_version,
        "segments": [
            {
                "segment_id": segment.segment_id,
                "segment_order": segment.segment_order,
                "text_hash": segment.text_hash,
            }
            for segment in segment_inputs
        ],
    }
    return ArticleTtsInputSnapshot(
        user_id=user_id,
        article_id=article.id,
        language=article.language,
        resolved_voice=resolved_voice,
        speed=speed,
        voice_policy_version=voice_policy_version,
        pause_policy_version=pause_policy_version,
        encoder_profile_version=encoder_profile_version,
        timeline_version=timeline_version,
        segments=segment_inputs,
        input_hash=_calculate_snapshot_hash(canonical_payload),
    )


def _find_valid_cached_asset(
    *,
    repository: TtsRepository,
    segment: ArticleTtsSegmentInput,
    resolved_voice: str,
    speed: float,
    allow_legacy_default: bool,
    path_resolver,
) -> tuple[TtsAsset, Path, list[TimelineItem]] | None:
    voices = [resolved_voice]
    if allow_legacy_default and resolved_voice != "default":
        voices.append("default")
    for cache_voice in voices:
        candidate = repository.get_tts_asset(
            segment_id=segment.segment_id,
            voice=cache_voice,
            speed=speed,
            text_hash=segment.text_hash,
        )
        valid = load_valid_tts_asset(asset=candidate, path_resolver=path_resolver)
        if candidate is not None and valid is not None:
            media_path, timeline = valid
            return candidate, media_path, timeline
    return None


def prepare_article_tts_segments(
    *,
    repository: TtsRepository,
    snapshot: ArticleTtsInputSnapshot,
    synthesizer=synthesize_to_mp3,
    output_path_resolver: Callable[[str], Path] = resolve_media_output_path,
    asset_path_resolver=resolve_media_path_from_audio_url,
    sleep: Callable[[float], None] = time.sleep,
    max_attempts: int = 3,
    initial_backoff_seconds: float = 0.25,
    on_segment_prepared: Callable[[PreparedArticleTtsSegment, int, int], None] | None = None,
) -> tuple[PreparedArticleTtsSegment, ...]:
    if max_attempts < 1:
        raise ValueError("max_attempts must be at least 1.")
    if initial_backoff_seconds < 0:
        raise ValueError("initial_backoff_seconds must be non-negative.")

    prepared: list[PreparedArticleTtsSegment] = []
    allow_legacy_default = snapshot.voice_policy_version == DEFAULT_VOICE_POLICY_VERSION

    total_segments = len(snapshot.segments)
    for segment in snapshot.segments:
        cached = _find_valid_cached_asset(
            repository=repository,
            segment=segment,
            resolved_voice=snapshot.resolved_voice,
            speed=snapshot.speed,
            allow_legacy_default=allow_legacy_default,
            path_resolver=asset_path_resolver,
        )
        if cached is not None:
            asset, media_path, timeline = cached
            prepared_segment = PreparedArticleTtsSegment(
                segment=segment,
                asset=asset,
                media_path=media_path,
                timeline=tuple(timeline),
                cached=True,
            )
            prepared.append(prepared_segment)
            if on_segment_prepared is not None:
                on_segment_prepared(prepared_segment, len(prepared), total_segments)
            continue

        filename = build_tts_filename(
            segment_id=segment.segment_id,
            text_hash=segment.text_hash,
            voice=snapshot.resolved_voice,
            speed=snapshot.speed,
        )
        output_path = output_path_resolver(filename)
        last_error: Exception | None = None
        for attempt in range(1, max_attempts + 1):
            attempt_path = output_path.with_name(f".{output_path.name}.{uuid4().hex}.tmp")
            try:
                raw_timeline = synthesizer(
                    text=segment.tts_input_text,
                    language=snapshot.language,
                    speed=snapshot.speed,
                    output_path=attempt_path,
                    voice=snapshot.resolved_voice,
                )
                timeline = normalize_timeline_payload(raw_timeline)
                if not attempt_path.is_file() or attempt_path.stat().st_size <= 0:
                    raise ValueError("TTS synthesizer did not create a non-empty audio file.")
                if timeline is None:
                    raise ValueError("TTS synthesizer returned an invalid timeline.")
                output_path.parent.mkdir(parents=True, exist_ok=True)
                attempt_path.replace(output_path)

                asset = repository.get_tts_asset(
                    segment_id=segment.segment_id,
                    voice=snapshot.resolved_voice,
                    speed=snapshot.speed,
                    text_hash=segment.text_hash,
                )
                if asset is None:
                    asset = TtsAsset(
                        id=f"tts_{uuid4().hex[:12]}",
                        segment_id=segment.segment_id,
                        voice=snapshot.resolved_voice,
                        speed=snapshot.speed,
                        audio_url=f"/media/tts/{filename}",
                        text_hash=segment.text_hash,
                        timeline_json=json.dumps(timeline, ensure_ascii=False),
                        timeline_version=SEGMENT_TIMELINE_VERSION,
                        created_at=utcnow(),
                    )
                    try:
                        repository.create_tts_asset(asset)
                    except IntegrityError:
                        repository.db.rollback()
                        winner = repository.get_tts_asset(
                            segment_id=segment.segment_id,
                            voice=snapshot.resolved_voice,
                            speed=snapshot.speed,
                            text_hash=segment.text_hash,
                        )
                        if winner is None:
                            raise
                        asset = winner
                else:
                    asset.audio_url = f"/media/tts/{filename}"
                    asset.timeline_json = json.dumps(timeline, ensure_ascii=False)
                    asset.timeline_version = SEGMENT_TIMELINE_VERSION
                    asset.created_at = utcnow()
                    repository.update_tts_asset(asset)

                prepared_segment = PreparedArticleTtsSegment(
                    segment=segment,
                    asset=asset,
                    media_path=output_path,
                    timeline=tuple(timeline),
                    cached=False,
                )
                prepared.append(prepared_segment)
                if on_segment_prepared is not None:
                    on_segment_prepared(prepared_segment, len(prepared), total_segments)
                break
            except Exception as exc:
                repository.db.rollback()
                attempt_path.unlink(missing_ok=True)
                last_error = exc
                if attempt < max_attempts:
                    sleep(initial_backoff_seconds * (2 ** (attempt - 1)))
        else:
            assert last_error is not None
            raise ArticleTtsSegmentPreparationError(
                segment_id=segment.segment_id,
                segment_order=segment.segment_order,
                attempts=max_attempts,
                cause=last_error,
            ) from last_error

    return tuple(prepared)
