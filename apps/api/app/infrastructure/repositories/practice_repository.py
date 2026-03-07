from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import (
    Article,
    ArticleSegment,
    AttemptCompareBlock,
    AttemptCompareToken,
    AttemptNoiseSpan,
    AttemptRecognition,
    PracticeAttempt,
    PracticeRecording,
    PracticeRecordingChunk,
    SttJob,
)


class PracticeRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_segment_for_user(self, *, segment_id: str, user_id: str) -> tuple[Article, ArticleSegment] | None:
        statement = (
            select(Article, ArticleSegment)
            .join(ArticleSegment, ArticleSegment.article_id == Article.id)
            .where(
                Article.user_id == user_id,
                ArticleSegment.id == segment_id,
            )
        )
        row = self.db.execute(statement).first()
        if row is None:
            return None
        return row[0], row[1]

    def list_article_segments_for_user(self, *, article_id: str, user_id: str) -> list[ArticleSegment]:
        statement = (
            select(ArticleSegment)
            .join(Article, Article.id == ArticleSegment.article_id)
            .where(
                Article.id == article_id,
                Article.user_id == user_id,
            )
            .order_by(ArticleSegment.segment_order.asc())
        )
        return list(self.db.scalars(statement).all())

    def get_segment_attempt_snapshots(
        self,
        *,
        article_id: str,
        user_id: str,
    ) -> dict[str, dict[str, int | float | None]]:
        statement = (
            select(
                PracticeAttempt.segment_id,
                func.count(PracticeAttempt.id).label("attempt_count"),
                func.max(PracticeAttempt.accuracy_rate).label("best_accuracy"),
            )
            .where(
                PracticeAttempt.article_id == article_id,
                PracticeAttempt.user_id == user_id,
                PracticeAttempt.status == "done",
            )
            .group_by(PracticeAttempt.segment_id)
        )
        snapshots: dict[str, dict[str, int | float | None]] = {}
        for segment_id, attempt_count, best_accuracy in self.db.execute(statement).all():
            snapshots[str(segment_id)] = {
                "attempt_count": int(attempt_count or 0),
                "best_accuracy": float(best_accuracy) if best_accuracy is not None else None,
            }
        return snapshots

    def create_recording(self, recording: PracticeRecording) -> PracticeRecording:
        self.db.add(recording)
        self.db.commit()
        self.db.refresh(recording)
        return recording

    def get_recording_for_user(self, *, recording_id: str, user_id: str) -> PracticeRecording | None:
        statement = select(PracticeRecording).where(
            PracticeRecording.id == recording_id,
            PracticeRecording.user_id == user_id,
        )
        return self.db.scalar(statement)

    def get_recording(self, *, recording_id: str) -> PracticeRecording | None:
        statement = select(PracticeRecording).where(PracticeRecording.id == recording_id)
        return self.db.scalar(statement)

    def update_recording(self, recording: PracticeRecording) -> PracticeRecording:
        self.db.add(recording)
        self.db.commit()
        self.db.refresh(recording)
        return recording

    def upsert_recording_chunk(
        self,
        *,
        recording_id: str,
        seq: int,
        duration_ms: int | None,
        file_path: str,
    ) -> PracticeRecordingChunk:
        statement = select(PracticeRecordingChunk).where(
            PracticeRecordingChunk.recording_id == recording_id,
            PracticeRecordingChunk.seq == seq,
        )
        chunk = self.db.scalar(statement)
        if chunk is None:
            chunk = PracticeRecordingChunk(
                recording_id=recording_id,
                seq=seq,
                duration_ms=duration_ms,
                file_path=file_path,
            )
        else:
            chunk.duration_ms = duration_ms
            chunk.file_path = file_path
        self.db.add(chunk)
        self.db.commit()
        self.db.refresh(chunk)
        return chunk

    def list_recording_chunks(self, *, recording_id: str) -> list[PracticeRecordingChunk]:
        statement = (
            select(PracticeRecordingChunk)
            .where(PracticeRecordingChunk.recording_id == recording_id)
            .order_by(PracticeRecordingChunk.seq.asc())
        )
        return list(self.db.scalars(statement).all())

    def create_attempt(self, attempt: PracticeAttempt) -> PracticeAttempt:
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def get_attempt_for_user(self, *, attempt_id: str, user_id: str) -> PracticeAttempt | None:
        statement = select(PracticeAttempt).where(
            PracticeAttempt.id == attempt_id,
            PracticeAttempt.user_id == user_id,
        )
        return self.db.scalar(statement)

    def get_attempt(self, *, attempt_id: str) -> PracticeAttempt | None:
        statement = select(PracticeAttempt).where(PracticeAttempt.id == attempt_id)
        return self.db.scalar(statement)

    def update_attempt(self, attempt: PracticeAttempt) -> PracticeAttempt:
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def create_stt_job(self, job: SttJob) -> SttJob:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def get_stt_job_by_recording(self, *, recording_id: str) -> SttJob | None:
        statement = select(SttJob).where(SttJob.recording_id == recording_id)
        return self.db.scalar(statement)

    def get_stt_job_for_user(self, *, job_id: str, user_id: str) -> SttJob | None:
        statement = select(SttJob).where(
            SttJob.id == job_id,
            SttJob.user_id == user_id,
        )
        return self.db.scalar(statement)

    def get_stt_job(self, *, job_id: str) -> SttJob | None:
        statement = select(SttJob).where(SttJob.id == job_id)
        return self.db.scalar(statement)

    def update_stt_job(self, job: SttJob) -> SttJob:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def get_article_and_segment_for_attempt(self, *, attempt_id: str) -> tuple[Article, ArticleSegment] | None:
        statement = (
            select(Article, ArticleSegment)
            .join(PracticeAttempt, PracticeAttempt.article_id == Article.id)
            .join(ArticleSegment, ArticleSegment.id == PracticeAttempt.segment_id)
            .where(PracticeAttempt.id == attempt_id)
        )
        row = self.db.execute(statement).first()
        if row is None:
            return None
        return row[0], row[1]

    def upsert_attempt_recognition(
        self,
        *,
        attempt_id: str,
        recognized_text: str,
        stt_provider: str | None,
        stt_model: str | None,
        confidence: float | None,
        raw_payload: str | None,
        created_at: datetime,
    ) -> AttemptRecognition:
        statement = select(AttemptRecognition).where(AttemptRecognition.attempt_id == attempt_id)
        recognition = self.db.scalar(statement)
        if recognition is None:
            recognition = AttemptRecognition(
                attempt_id=attempt_id,
                recognized_text=recognized_text,
                stt_provider=stt_provider,
                stt_model=stt_model,
                confidence=confidence,
                raw_payload=raw_payload,
                created_at=created_at,
            )
        else:
            recognition.recognized_text = recognized_text
            recognition.stt_provider = stt_provider
            recognition.stt_model = stt_model
            recognition.confidence = confidence
            recognition.raw_payload = raw_payload
        self.db.add(recognition)
        self.db.commit()
        self.db.refresh(recognition)
        return recognition

    def get_attempt_recognition(self, *, attempt_id: str) -> AttemptRecognition | None:
        statement = select(AttemptRecognition).where(AttemptRecognition.attempt_id == attempt_id)
        return self.db.scalar(statement)

    def clear_attempt_alignment(self, *, attempt_id: str) -> None:
        block_ids = list(
            self.db.scalars(
                select(AttemptCompareBlock.id).where(AttemptCompareBlock.attempt_id == attempt_id)
            ).all()
        )
        if block_ids:
            self.db.execute(delete(AttemptCompareToken).where(AttemptCompareToken.block_id.in_(block_ids)))
            self.db.execute(delete(AttemptCompareBlock).where(AttemptCompareBlock.id.in_(block_ids)))
        self.db.execute(delete(AttemptNoiseSpan).where(AttemptNoiseSpan.attempt_id == attempt_id))
        self.db.commit()

    def create_compare_block(self, block: AttemptCompareBlock) -> AttemptCompareBlock:
        self.db.add(block)
        self.db.commit()
        self.db.refresh(block)
        return block

    def create_compare_tokens(self, tokens: list[AttemptCompareToken]) -> None:
        for token in tokens:
            self.db.add(token)
        self.db.commit()

    def create_noise_spans(self, noise_spans: list[AttemptNoiseSpan]) -> None:
        for span in noise_spans:
            self.db.add(span)
        self.db.commit()
