from datetime import datetime, timezone
from pathlib import Path
import unicodedata
from uuid import uuid4

from fastapi import status

from app.core.config import settings
from app.core.errors import AppError
from app.db import SessionLocal
from app.infrastructure.repositories.practice_repository import PracticeRepository
from app.models import (
    AttemptCompareBlock,
    AttemptCompareToken,
    AttemptNoiseSpan,
    PracticeAttempt,
    PracticeRecording,
    SegmentReadingOverride,
    SttJob,
    User,
)
from app.schemas.practice import (
    AlignAttemptPayload,
    AlignResultResponse,
    AlignToken,
    CompareBlock,
    FinishRecordingResponse,
    PracticeAttemptResultResponse,
    PracticeArticleProgressResponse,
    PracticeProgressCell,
    PracticeProgressLevel,
    SegmentReadingResponse,
    SegmentReadingToken,
    SegmentReadingOverrideItem,
    UpsertSegmentReadingOverridesPayload,
    NoiseSpan,
    StartRecordingResponse,
    SttJobStatusResponse,
    UploadChunkResponse,
)
from app.services.alignment_service import align_segment_text
from app.services.reading_service import build_segment_reading_tokens
from app.services.stt_service import transcribe_audio_by_provider

PRACTICE_LEVELS = ("L1", "L2", "L3", "L4")


def get_attempt_result(
    *,
    repository: PracticeRepository,
    current_user: User,
    attempt_id: str,
) -> PracticeAttemptResultResponse:
    attempt = repository.get_attempt_for_user(attempt_id=attempt_id, user_id=current_user.id)
    if attempt is None:
        raise AppError(
            code="NOT_FOUND",
            message="Practice attempt not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    article_segment = repository.get_article_and_segment_for_attempt(attempt_id=attempt.id)
    if article_segment is None:
        raise AppError(
            code="SEGMENT_NOT_FOUND",
            message="Segment not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    article, segment = article_segment
    total_segments = repository.count_segments_for_article(article_id=article.id)
    attempt_count = repository.count_attempts_for_segment(
        user_id=current_user.id,
        article_id=article.id,
        segment_id=segment.id,
    )
    if _needs_japanese_realign(
        attempt=attempt,
        language=article.language,
    ):
        stt_job = repository.get_stt_job_by_attempt(attempt_id=attempt.id)
        recognized_text = (stt_job.recognized_text if stt_job is not None else None) or ""
        if recognized_text.strip():
            reading_overrides = _load_segment_override_map(
                repository=repository,
                user_id=current_user.id,
                segment_id=segment.id,
            )
            alignment = align_segment_text(
                reference_text=segment.plain_text,
                recognized_text=recognized_text,
                language=article.language,
                reading_overrides=reading_overrides if article.language == "ja" else None,
            )
            _persist_alignment(
                repository=repository,
                attempt=attempt,
                alignment=alignment,
            )

    ref_compare_tokens = repository.list_compare_tokens_by_attempt_and_side(attempt_id=attempt.id, side="ref")
    hyp_compare_tokens = repository.list_compare_tokens_by_attempt_and_side(attempt_id=attempt.id, side="rec")

    ref_tokens = [AlignToken(text=token.text, status=token.diff_kind or "correct") for token in ref_compare_tokens]
    hyp_tokens = [AlignToken(text=token.text, status=token.diff_kind or "correct") for token in hyp_compare_tokens]

    correct_count = sum(1 for token in ref_tokens if token.status == "correct")
    wrong_count = sum(1 for token in ref_tokens if token.status == "substitute")
    missed_count = sum(1 for token in ref_tokens if token.status == "missing")
    inserted_count = sum(1 for token in hyp_tokens if token.status == "insert")
    accuracy_rate = max(0.0, min(1.0, float(attempt.accuracy_rate or 0.0) / 100.0))

    return PracticeAttemptResultResponse(
        attempt_id=attempt.id,
        article_id=article.id,
        article_title=article.title,
        segment_id=segment.id,
        segment_order=segment.segment_order,
        total_segments=total_segments,
        attempt_count=attempt_count,
        accuracy_rate=accuracy_rate,
        ref_tokens=ref_tokens,
        hyp_tokens=hyp_tokens,
        correct_count=correct_count,
        wrong_count=wrong_count,
        missed_count=missed_count,
        inserted_count=inserted_count,
    )


def resolve_attempt_audio_path(
    *,
    repository: PracticeRepository,
    current_user: User,
    attempt_id: str,
) -> Path:
    attempt = repository.get_attempt_for_user(attempt_id=attempt_id, user_id=current_user.id)
    if attempt is None:
        raise AppError(
            code="NOT_FOUND",
            message="Practice attempt not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    stt_job = repository.get_stt_job_by_attempt(attempt_id=attempt.id)
    if stt_job is not None:
        recording = repository.get_recording(recording_id=stt_job.recording_id)
        if recording is not None and recording.merged_audio_path:
            merged_path = Path(recording.merged_audio_path)
            if merged_path.exists():
                return merged_path

    # Fallback for historical rows where only audio_url was persisted.
    recording_id = Path(attempt.audio_url or "").stem
    if recording_id:
        merged_path = _resolve_merged_audio_path(recording_id=recording_id)
        if merged_path.exists():
            return merged_path

    raise AppError(
        code="AUDIO_NOT_FOUND",
        message="Practice recording audio not found.",
        status_code=status.HTTP_404_NOT_FOUND,
    )


def get_article_progress(
    *,
    repository: PracticeRepository,
    current_user: User,
    article_id: str,
    current_level: str,
    current_segment_order: int | None = None,
    pass_threshold: float = 85.0,
) -> PracticeArticleProgressResponse:
    if current_level not in PRACTICE_LEVELS:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Unsupported level.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    segments = repository.list_article_segments_for_user(article_id=article_id, user_id=current_user.id)
    if not segments:
        raise AppError(
            code="NOT_FOUND",
            message="Article not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    snapshots_by_level = repository.get_segment_attempt_snapshots_by_level(
        article_id=article_id,
        user_id=current_user.id,
    )
    recent_scores_desc = repository.list_recent_article_accuracy_rates(
        user_id=current_user.id,
        article_id=article_id,
        limit=4,
    )
    recent_scores = [int(round(score)) for score in reversed(recent_scores_desc)]

    resolved_current_segment_order = current_segment_order
    if resolved_current_segment_order is None:
        resolved_current_segment_order = segments[0].segment_order
        current_level_snapshots = snapshots_by_level.get(current_level, {})
        for segment in segments:
            snapshot = current_level_snapshots.get(segment.id, {})
            best_accuracy = snapshot.get("best_accuracy")
            if not isinstance(best_accuracy, (int, float)) or float(best_accuracy) < pass_threshold:
                resolved_current_segment_order = segment.segment_order
                break

    levels: list[PracticeProgressLevel] = []
    for level in PRACTICE_LEVELS:
        level_snapshots = snapshots_by_level.get(level, {})
        level_cells: list[PracticeProgressCell] = []
        for segment in segments:
            snapshot = level_snapshots.get(segment.id, {})
            attempt_count = int(snapshot.get("attempt_count", 0) or 0)
            best_accuracy_raw = snapshot.get("best_accuracy")
            best_accuracy = float(best_accuracy_raw) if isinstance(best_accuracy_raw, (int, float)) else None
            if best_accuracy is not None and best_accuracy >= pass_threshold:
                state = "pass"
            elif level == current_level and resolved_current_segment_order == segment.segment_order:
                state = "current"
            elif attempt_count > 0:
                state = "fail"
            else:
                state = "fail"
            level_cells.append(
                PracticeProgressCell(
                    segment_order=segment.segment_order,
                    state=state,
                    attempt_count=attempt_count,
                    best_accuracy=best_accuracy,
                )
            )
        levels.append(PracticeProgressLevel(level=level, cells=level_cells))

    return PracticeArticleProgressResponse(
        article_id=article_id,
        total_segments=len(segments),
        pass_threshold=pass_threshold,
        current_level=current_level,
        levels=levels,
        recent_scores=recent_scores,
    )


def get_segment_reading(
    *,
    repository: PracticeRepository,
    current_user: User,
    segment_id: str,
) -> SegmentReadingResponse:
    pair = repository.get_segment_for_user(segment_id=segment_id, user_id=current_user.id)
    if pair is None:
        raise AppError(
            code="SEGMENT_NOT_FOUND",
            message="Segment not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    article, segment = pair
    override_map = _load_segment_override_map(
        repository=repository,
        user_id=current_user.id,
        segment_id=segment.id,
    )
    return _build_segment_reading_response(
        segment_id=segment.id,
        language=article.language,
        text=segment.plain_text,
        override_map=override_map,
    )


def upsert_segment_reading_overrides(
    *,
    repository: PracticeRepository,
    current_user: User,
    segment_id: str,
    payload: UpsertSegmentReadingOverridesPayload,
) -> SegmentReadingResponse:
    pair = repository.get_segment_for_user(segment_id=segment_id, user_id=current_user.id)
    if pair is None:
        raise AppError(
            code="SEGMENT_NOT_FOUND",
            message="Segment not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    article, segment = pair
    if article.language != "ja":
        raise AppError(
            code="VALIDATION_ERROR",
            message="Reading override is only supported for Japanese segments.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    base_tokens = build_segment_reading_tokens(text=segment.plain_text, language=article.language)
    seen: set[int] = set()
    override_map: dict[int, str | None] = {}
    rows: list[SegmentReadingOverride] = []
    for item in payload.overrides:
        _validate_override_item(item=item, base_tokens=base_tokens, seen_indices=seen)
        normalized_yomi = (item.yomi or "").strip() or None
        override_map[item.token_index] = normalized_yomi
        rows.append(
            SegmentReadingOverride(
                id=f"sro_{uuid4().hex[:12]}",
                user_id=current_user.id,
                segment_id=segment.id,
                token_index=item.token_index,
                surface=item.surface,
                yomi=normalized_yomi,
                created_at=datetime.now(tz=timezone.utc),
                updated_at=datetime.now(tz=timezone.utc),
            )
        )

    repository.replace_segment_reading_overrides(
        user_id=current_user.id,
        segment_id=segment.id,
        overrides=rows,
    )
    return _build_segment_reading_response(
        segment_id=segment.id,
        language=article.language,
        text=segment.plain_text,
        override_map=override_map,
    )


def delete_segment_reading_override(
    *,
    repository: PracticeRepository,
    current_user: User,
    segment_id: str,
    token_index: int,
) -> SegmentReadingResponse:
    if token_index < 0:
        raise AppError(
            code="VALIDATION_ERROR",
            message="token_index must be greater than or equal to 0.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    pair = repository.get_segment_for_user(segment_id=segment_id, user_id=current_user.id)
    if pair is None:
        raise AppError(
            code="SEGMENT_NOT_FOUND",
            message="Segment not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    article, segment = pair
    if article.language != "ja":
        raise AppError(
            code="VALIDATION_ERROR",
            message="Reading override is only supported for Japanese segments.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    repository.delete_segment_reading_override(
        user_id=current_user.id,
        segment_id=segment.id,
        token_index=token_index,
    )
    override_map = _load_segment_override_map(
        repository=repository,
        user_id=current_user.id,
        segment_id=segment.id,
    )
    return _build_segment_reading_response(
        segment_id=segment.id,
        language=article.language,
        text=segment.plain_text,
        override_map=override_map,
    )


def start_recording(
    *,
    repository: PracticeRepository,
    current_user: User,
    segment_id: str,
) -> StartRecordingResponse:
    pair = repository.get_segment_for_user(segment_id=segment_id, user_id=current_user.id)
    if pair is None:
        raise AppError(
            code="SEGMENT_NOT_FOUND",
            message="Segment not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    article, _segment = pair
    recording = repository.create_recording(
        PracticeRecording(
            id=f"rec_{uuid4().hex[:12]}",
            user_id=current_user.id,
            article_id=article.id,
            segment_id=segment_id,
            status="recording",
        )
    )
    return StartRecordingResponse(recording_id=recording.id, status=recording.status)


def upload_recording_chunk(
    *,
    repository: PracticeRepository,
    current_user: User,
    recording_id: str,
    seq: int,
    duration_ms: int | None,
    content_type: str,
    chunk_data: bytes,
) -> UploadChunkResponse:
    if "audio/webm" not in content_type.lower():
        raise AppError(
            code="UNSUPPORTED_AUDIO_FORMAT",
            message="Only webm/opus recording chunks are supported.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    recording = repository.get_recording_for_user(recording_id=recording_id, user_id=current_user.id)
    if recording is None:
        raise AppError(
            code="RECORDING_NOT_FOUND",
            message="Recording session not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    if recording.status not in {"recording", "uploaded"}:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Recording session cannot accept chunks in current status.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    chunk_path = _resolve_chunk_path(recording_id=recording_id, seq=seq)
    chunk_path.parent.mkdir(parents=True, exist_ok=True)
    chunk_path.write_bytes(chunk_data)

    repository.upsert_recording_chunk(
        recording_id=recording_id,
        seq=seq,
        duration_ms=duration_ms,
        file_path=str(chunk_path),
    )
    return UploadChunkResponse(recording_id=recording_id, seq=seq, accepted=True)


def finish_recording(
    *,
    repository: PracticeRepository,
    current_user: User,
    recording_id: str,
    total_chunks: int,
    duration_ms: int,
    practice_level: str = "L1",
) -> FinishRecordingResponse:
    if practice_level not in PRACTICE_LEVELS:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Unsupported level.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    recording = repository.get_recording_for_user(recording_id=recording_id, user_id=current_user.id)
    if recording is None:
        raise AppError(
            code="RECORDING_NOT_FOUND",
            message="Recording session not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    if duration_ms > settings.stt_max_duration_ms:
        raise AppError(
            code="RECORDING_TOO_LONG",
            message="Recording duration exceeds limit.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    existing_job = repository.get_stt_job_by_recording(recording_id=recording.id)
    if existing_job is not None and existing_job.status in {"processing", "done"}:
        return FinishRecordingResponse(recording_id=recording.id, job_id=existing_job.id, status=existing_job.status)

    chunks = repository.list_recording_chunks(recording_id=recording.id)
    if not chunks:
        raise AppError(
            code="VALIDATION_ERROR",
            message="No recording chunks uploaded.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    actual_seq = [chunk.seq for chunk in chunks]
    expected_seq = list(range(total_chunks))
    if actual_seq != expected_seq:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Recording chunks are incomplete.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    merged_path = _resolve_merged_audio_path(recording_id=recording.id)
    merged_path.parent.mkdir(parents=True, exist_ok=True)
    with merged_path.open("wb") as merged_file:
        for chunk in chunks:
            merged_file.write(Path(chunk.file_path).read_bytes())

    recording.total_chunks = total_chunks
    recording.duration_ms = duration_ms
    recording.merged_audio_path = str(merged_path)
    recording.status = "processing"
    repository.update_recording(recording)

    attempt = repository.create_attempt(
        PracticeAttempt(
            id=f"att_{uuid4().hex[:12]}",
            user_id=current_user.id,
            article_id=recording.article_id,
            segment_id=recording.segment_id,
            practice_level=practice_level,
            alignment_mode="token",
            audio_url=f"/media/stt/{recording.id}.webm",
            submitted_at=datetime.now(tz=timezone.utc),
            status="processing",
        )
    )
    job = repository.create_stt_job(
        SttJob(
            id=f"stt_job_{uuid4().hex[:12]}",
            recording_id=recording.id,
            user_id=current_user.id,
            attempt_id=attempt.id,
            status="processing",
        )
    )
    return FinishRecordingResponse(recording_id=recording.id, job_id=job.id, status=job.status)


def process_stt_job(job_id: str) -> None:
    db = SessionLocal()
    repository = PracticeRepository(db=db)
    try:
        job = repository.get_stt_job(job_id=job_id)
        if job is None or job.status != "processing":
            return
        recording = repository.get_recording(recording_id=job.recording_id)
        attempt = repository.get_attempt(attempt_id=job.attempt_id)
        if recording is None or attempt is None:
            return
        article_segment = repository.get_article_and_segment_for_attempt(attempt_id=attempt.id)
        if article_segment is None:
            return
        article, _segment = article_segment
        if not recording.merged_audio_path:
            raise AppError(
                code="STT_PROVIDER_ERROR",
                message="Merged recording file is missing.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        audio_path = Path(recording.merged_audio_path)
        if not audio_path.exists():
            raise AppError(
                code="STT_PROVIDER_ERROR",
                message="Merged recording file is missing.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        result = transcribe_audio_by_provider(audio_path=audio_path, language=article.language)
        job.status = "done"
        job.recognized_text = result.recognized_text
        job.confidence = result.confidence
        job.provider = result.provider
        job.model = result.model
        job.error_code = None
        repository.update_stt_job(job)

        repository.upsert_attempt_recognition(
            attempt_id=attempt.id,
            recognized_text=result.recognized_text,
            stt_provider=result.provider,
            stt_model=result.model,
            confidence=result.confidence,
            raw_payload=result.raw_payload,
            created_at=datetime.now(tz=timezone.utc),
        )
        attempt.status = "done"
        repository.update_attempt(attempt)
        recording.status = "done"
        repository.update_recording(recording)
    except AppError as exc:
        _mark_job_failed(repository=repository, job_id=job_id, error_code=exc.code)
    except Exception:
        _mark_job_failed(repository=repository, job_id=job_id, error_code="STT_PROVIDER_ERROR")
    finally:
        db.close()


def get_stt_job_status(
    *,
    repository: PracticeRepository,
    current_user: User,
    job_id: str,
) -> SttJobStatusResponse:
    job = repository.get_stt_job_for_user(job_id=job_id, user_id=current_user.id)
    if job is None:
        raise AppError(
            code="STT_JOB_NOT_FOUND",
            message="STT job not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return SttJobStatusResponse(
        job_id=job.id,
        status=job.status,
        attempt_id=job.attempt_id,
        recognized_text=job.recognized_text,
        confidence=job.confidence,
        provider=job.provider,
        model=job.model,
        error_code=job.error_code,
    )


def align_attempt(
    *,
    repository: PracticeRepository,
    current_user: User,
    attempt_id: str,
    payload: AlignAttemptPayload,
) -> AlignResultResponse:
    attempt = repository.get_attempt_for_user(attempt_id=attempt_id, user_id=current_user.id)
    if attempt is None:
        raise AppError(
            code="NOT_FOUND",
            message="Practice attempt not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    article_segment = repository.get_article_and_segment_for_attempt(attempt_id=attempt.id)
    if article_segment is None:
        raise AppError(
            code="SEGMENT_NOT_FOUND",
            message="Segment not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    article, segment = article_segment

    if payload.segment_id and payload.segment_id != segment.id:
        raise AppError(
            code="VALIDATION_ERROR",
            message="segment_id does not match attempt segment.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    recognition = repository.get_attempt_recognition(attempt_id=attempt.id)
    recognized_text = payload.recognized_text or (recognition.recognized_text if recognition is not None else None)
    if not recognized_text:
        raise AppError(
            code="ALIGNMENT_INPUT_EMPTY",
            message="Recognized text is empty.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    alignment = align_segment_text(
        reference_text=segment.plain_text,
        recognized_text=recognized_text,
        language=article.language,
        reading_overrides=(
            _load_segment_override_map(
                repository=repository,
                user_id=current_user.id,
                segment_id=segment.id,
            )
            if article.language == "ja"
            else None
        ),
    )
    _persist_alignment(
        repository=repository,
        attempt=attempt,
        alignment=alignment,
    )

    return AlignResultResponse(
        accuracy_rate=alignment.accuracy_rate,
        ref_tokens=[AlignToken(text=token.text, status=token.status) for token in alignment.ref_tokens],
        hyp_tokens=[AlignToken(text=token.text, status=token.status) for token in alignment.hyp_tokens],
        compare_blocks=[
            CompareBlock(
                block_order=block_result.block_order,
                reference=[AlignToken(text=token.text, status=token.status) for token in block_result.reference],
                recognized=[AlignToken(text=token.text, status=token.status) for token in block_result.recognized],
            )
            for block_result in alignment.compare_blocks
        ],
        noise_spans=[
            NoiseSpan(start_token=span.start_token, end_token=span.end_token, reason=span.reason)
            for span in alignment.noise_spans
        ],
    )


def _build_segment_reading_response(
    *,
    segment_id: str,
    language: str,
    text: str,
    override_map: dict[int, str | None],
) -> SegmentReadingResponse:
    tokens = build_segment_reading_tokens(
        text=text,
        language=language,
        reading_overrides=override_map if language == "ja" else None,
    )
    response_tokens: list[SegmentReadingToken] = []
    for index, token in enumerate(tokens):
        is_override = index in override_map
        source = "override" if is_override else ("auto" if token.yomi else "none")
        response_tokens.append(
            SegmentReadingToken(
                token_index=index,
                surface=token.surface,
                yomi=token.yomi,
                editable=language == "ja" and _is_reading_token_editable(token.surface),
                source=source,
            )
        )
    return SegmentReadingResponse(
        segment_id=segment_id,
        language=language,
        tokens=response_tokens,
    )


def _load_segment_override_map(
    *,
    repository: PracticeRepository,
    user_id: str,
    segment_id: str,
) -> dict[int, str | None]:
    rows = repository.list_segment_reading_overrides(user_id=user_id, segment_id=segment_id)
    return {
        int(row.token_index): (row.yomi.strip() if row.yomi is not None else None)
        for row in rows
    }


def _validate_override_item(
    *,
    item: SegmentReadingOverrideItem,
    base_tokens,
    seen_indices: set[int],
) -> None:
    if item.token_index in seen_indices:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Duplicate token_index in overrides.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    seen_indices.add(item.token_index)

    if item.token_index < 0 or item.token_index >= len(base_tokens):
        raise AppError(
            code="VALIDATION_ERROR",
            message="token_index is out of range.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    target = base_tokens[item.token_index]
    if target.surface != item.surface:
        raise AppError(
            code="VALIDATION_ERROR",
            message="surface does not match token at token_index.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    if not _is_reading_token_editable(target.surface):
        raise AppError(
            code="VALIDATION_ERROR",
            message="token at token_index is not editable.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


def _is_reading_token_editable(surface: str) -> bool:
    compact = "".join(char for char in surface if not char.isspace())
    if not compact:
        return False
    return not _is_punctuation_token(compact)


def _is_punctuation_token(text: str) -> bool:
    for char in text:
        category = unicodedata.category(char)
        if category[0] not in {"P", "S"}:
            return False
    return True


def _mark_job_failed(*, repository: PracticeRepository, job_id: str, error_code: str) -> None:
    job = repository.get_stt_job(job_id=job_id)
    if job is None:
        return
    job.status = "failed"
    job.error_code = error_code
    repository.update_stt_job(job)
    attempt = repository.get_attempt(attempt_id=job.attempt_id)
    if attempt is not None:
        attempt.status = "failed"
        repository.update_attempt(attempt)
    recording = repository.get_recording(recording_id=job.recording_id)
    if recording is not None:
        recording.status = "failed"
        repository.update_recording(recording)


def _needs_japanese_realign(
    *,
    attempt: PracticeAttempt,
    language: str,
) -> bool:
    if language != "ja":
        return False
    return (attempt.alignment_mode or "") != "token_v2"


def _persist_alignment(
    *,
    repository: PracticeRepository,
    attempt: PracticeAttempt,
    alignment,
) -> None:
    repository.clear_attempt_alignment(attempt_id=attempt.id)
    block = repository.create_compare_block(
        AttemptCompareBlock(
            id=f"blk_{uuid4().hex[:12]}",
            attempt_id=attempt.id,
            block_order=1,
            created_at=datetime.now(tz=timezone.utc),
        )
    )
    compare_tokens: list[AttemptCompareToken] = []
    for idx, token in enumerate(alignment.ref_tokens):
        compare_tokens.append(
            AttemptCompareToken(
                block_id=block.id,
                side="ref",
                token_order=idx,
                text=token.text,
                diff_kind=token.status,
                pair_key=idx,
            )
        )
    for idx, token in enumerate(alignment.hyp_tokens):
        compare_tokens.append(
            AttemptCompareToken(
                block_id=block.id,
                side="rec",
                token_order=idx,
                text=token.text,
                diff_kind=token.status,
                pair_key=idx,
            )
        )
    repository.create_compare_tokens(compare_tokens)
    repository.create_noise_spans(
        [
            AttemptNoiseSpan(
                attempt_id=attempt.id,
                start_token=span.start_token,
                end_token=span.end_token,
                reason=span.reason,
            )
            for span in alignment.noise_spans
        ]
    )
    attempt.accuracy_rate = round(alignment.accuracy_rate * 100, 2)
    attempt.status = "done"
    attempt.alignment_mode = "token_v2"
    repository.update_attempt(attempt)


def _resolve_recording_root(recording_id: str) -> Path:
    return Path(settings.stt_media_dir).resolve() / "recordings" / recording_id


def _resolve_chunk_path(*, recording_id: str, seq: int) -> Path:
    return _resolve_recording_root(recording_id) / "chunks" / f"{seq:06d}.webm"


def _resolve_merged_audio_path(*, recording_id: str) -> Path:
    return _resolve_recording_root(recording_id) / f"{recording_id}.webm"
