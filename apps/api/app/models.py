from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="user")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(12), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    language: Mapped[str] = mapped_column(String(8), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(24), nullable=False, default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class ArticleSegment(Base):
    __tablename__ = "article_segments"
    __table_args__ = (UniqueConstraint("article_id", "segment_order", name="uq_article_segments_article_order"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    article_id: Mapped[str] = mapped_column(String(32), ForeignKey("articles.id"), nullable=False, index=True)
    segment_order: Mapped[int] = mapped_column(Integer, nullable=False)
    plain_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_text: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class TtsAsset(Base):
    __tablename__ = "tts_assets"
    __table_args__ = (
        UniqueConstraint(
            "segment_id",
            "voice",
            "speed",
            "text_hash",
            name="uq_tts_assets_segment_voice_speed_hash",
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    segment_id: Mapped[str] = mapped_column(String(32), ForeignKey("article_segments.id"), nullable=False, index=True)
    voice: Mapped[str] = mapped_column(String(64), nullable=False, default="default")
    speed: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    audio_url: Mapped[str] = mapped_column(Text, nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )


class PracticeRecording(Base):
    __tablename__ = "practice_recordings"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    article_id: Mapped[str] = mapped_column(String(32), ForeignKey("articles.id"), nullable=False, index=True)
    segment_id: Mapped[str] = mapped_column(String(32), ForeignKey("article_segments.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="recording")
    total_chunks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    merged_audio_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class PracticeRecordingChunk(Base):
    __tablename__ = "practice_recording_chunks"
    __table_args__ = (UniqueConstraint("recording_id", "seq", name="uq_recording_chunks_recording_seq"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recording_id: Mapped[str] = mapped_column(String(32), ForeignKey("practice_recordings.id"), nullable=False, index=True)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PracticeAttempt(Base):
    __tablename__ = "practice_attempts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    article_id: Mapped[str] = mapped_column(String(32), ForeignKey("articles.id"), nullable=False, index=True)
    segment_id: Mapped[str] = mapped_column(String(32), ForeignKey("article_segments.id"), nullable=False, index=True)
    alignment_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="token")
    audio_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="processing")
    accuracy_rate: Mapped[float | None] = mapped_column(Float, nullable=True)


class SttJob(Base):
    __tablename__ = "stt_jobs"
    __table_args__ = (UniqueConstraint("recording_id", name="uq_stt_jobs_recording"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    recording_id: Mapped[str] = mapped_column(String(32), ForeignKey("practice_recordings.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    attempt_id: Mapped[str] = mapped_column(String(32), ForeignKey("practice_attempts.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="processing")
    recognized_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class AttemptRecognition(Base):
    __tablename__ = "attempt_recognition"

    attempt_id: Mapped[str] = mapped_column(String(32), ForeignKey("practice_attempts.id"), primary_key=True)
    recognized_text: Mapped[str] = mapped_column(Text, nullable=False)
    stt_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    stt_model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    raw_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AttemptCompareBlock(Base):
    __tablename__ = "attempt_compare_blocks"
    __table_args__ = (UniqueConstraint("attempt_id", "block_order", name="uq_attempt_compare_blocks_attempt_order"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    attempt_id: Mapped[str] = mapped_column(String(32), ForeignKey("practice_attempts.id"), nullable=False, index=True)
    block_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AttemptCompareToken(Base):
    __tablename__ = "attempt_compare_tokens"
    __table_args__ = (UniqueConstraint("block_id", "side", "token_order", name="uq_attempt_compare_tokens_block_side_order"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    block_id: Mapped[str] = mapped_column(String(32), ForeignKey("attempt_compare_blocks.id"), nullable=False, index=True)
    side: Mapped[str] = mapped_column(String(8), nullable=False)
    token_order: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(String(128), nullable=False)
    diff_kind: Mapped[str | None] = mapped_column(String(16), nullable=True)
    pair_key: Mapped[int | None] = mapped_column(Integer, nullable=True)


class AttemptNoiseSpan(Base):
    __tablename__ = "attempt_noise_spans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    attempt_id: Mapped[str] = mapped_column(String(32), ForeignKey("practice_attempts.id"), nullable=False, index=True)
    start_token: Mapped[int] = mapped_column(Integer, nullable=False)
    end_token: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(64), nullable=False)
