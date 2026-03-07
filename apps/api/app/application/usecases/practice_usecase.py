from datetime import datetime, timezone
from pathlib import Path
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
    SttJob,
    User,
)
from app.schemas.practice import (
    AlignAttemptPayload,
    AlignResultResponse,
    AlignToken,
    CompareBlock,
    FinishRecordingResponse,
    NoiseSpan,
    StartRecordingResponse,
    SttJobStatusResponse,
    UploadChunkResponse,
)
from app.services.alignment_service import align_segment_text
from app.services.stt_service import transcribe_audio_by_provider


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
) -> FinishRecordingResponse:
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
    )

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
    repository.update_attempt(attempt)

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


def _resolve_recording_root(recording_id: str) -> Path:
    return Path(settings.stt_media_dir).resolve() / "recordings" / recording_id


def _resolve_chunk_path(*, recording_id: str, seq: int) -> Path:
    return _resolve_recording_root(recording_id) / "chunks" / f"{seq:06d}.webm"


def _resolve_merged_audio_path(*, recording_id: str) -> Path:
    return _resolve_recording_root(recording_id) / f"{recording_id}.webm"
