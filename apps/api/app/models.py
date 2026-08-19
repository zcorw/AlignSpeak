from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
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


class InvitationCode(Base):
    __tablename__ = "invitation_codes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    created_by_user_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id"), nullable=True, index=True)
    max_uses: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    used_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class InvitationCodeUsage(Base):
    __tablename__ = "invitation_code_usages"
    __table_args__ = (UniqueConstraint("invitation_code_id", "user_id", name="uq_invitation_code_usages_code_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    invitation_code_id: Mapped[str] = mapped_column(String(32), ForeignKey("invitation_codes.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    language: Mapped[str] = mapped_column(String(8), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(24), nullable=False, default="manual")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
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


class SegmentReadingOverride(Base):
    __tablename__ = "segment_reading_overrides"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "segment_id",
            "token_index",
            name="uq_segment_reading_overrides_user_segment_token",
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    segment_id: Mapped[str] = mapped_column(String(32), ForeignKey("article_segments.id"), nullable=False, index=True)
    token_index: Mapped[int] = mapped_column(Integer, nullable=False)
    surface: Mapped[str] = mapped_column(String(128), nullable=False)
    yomi: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now(), onupdate=func.now()
    )


class SegmentTokenOverride(Base):
    __tablename__ = "segment_token_overrides"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "segment_id",
            "token_index",
            name="uq_segment_token_overrides_user_segment_token",
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    segment_id: Mapped[str] = mapped_column(String(32), ForeignKey("article_segments.id"), nullable=False, index=True)
    token_index: Mapped[int] = mapped_column(Integer, nullable=False)
    surface: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now(), onupdate=func.now()
    )


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
    timeline_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    timeline_version: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )


class ArticleTtsAsset(Base):
    __tablename__ = "article_tts_assets"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "article_id",
            "input_hash",
            name="uq_article_tts_assets_user_article_input_hash",
        ),
        CheckConstraint(
            "status IN ('building', 'ready', 'deleting', 'failed')",
            name="ck_article_tts_assets_status",
        ),
        CheckConstraint("speed > 0", name="ck_article_tts_assets_speed_positive"),
        CheckConstraint(
            "duration_ms IS NULL OR duration_ms >= 0",
            name="ck_article_tts_assets_duration_nonnegative",
        ),
        CheckConstraint(
            "file_size IS NULL OR file_size >= 0",
            name="ck_article_tts_assets_file_size_nonnegative",
        ),
        CheckConstraint(
            "status <> 'ready' OR "
            "(audio_path IS NOT NULL AND duration_ms > 0 AND file_size > 0 AND ready_at IS NOT NULL)",
            name="ck_article_tts_assets_ready_metadata",
        ),
        Index("ix_article_tts_assets_article_status", "article_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    article_id: Mapped[str] = mapped_column(String(32), ForeignKey("articles.id"), nullable=False, index=True)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="building")
    voice: Mapped[str] = mapped_column(String(64), nullable=False)
    speed: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    pause_policy_version: Mapped[str] = mapped_column(String(32), nullable=False)
    encoder_profile_version: Mapped[str] = mapped_column(String(32), nullable=False)
    timeline_version: Mapped[str] = mapped_column(String(32), nullable=False)
    audio_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timeline_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now(), onupdate=func.now()
    )
    ready_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ArticleTtsJob(Base):
    __tablename__ = "article_tts_jobs"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "article_id",
            "input_hash",
            name="uq_article_tts_jobs_user_article_input_hash",
        ),
        CheckConstraint(
            "status IN ('queued', 'processing', 'done', 'failed', 'cancelled')",
            name="ck_article_tts_jobs_status",
        ),
        CheckConstraint("total_segments >= 0", name="ck_article_tts_jobs_total_segments_nonnegative"),
        CheckConstraint(
            "completed_segments >= 0 AND completed_segments <= total_segments",
            name="ck_article_tts_jobs_completed_segments_range",
        ),
        CheckConstraint("attempt_count >= 0", name="ck_article_tts_jobs_attempt_count_nonnegative"),
        CheckConstraint(
            "failed_segment_order IS NULL OR failed_segment_order > 0",
            name="ck_article_tts_jobs_failed_segment_order_positive",
        ),
        CheckConstraint(
            "status <> 'done' OR asset_id IS NOT NULL",
            name="ck_article_tts_jobs_done_asset",
        ),
        Index("ix_article_tts_jobs_status_lease", "status", "lease_expires_at"),
        Index("ix_article_tts_jobs_article_created", "article_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    article_id: Mapped[str] = mapped_column(String(32), ForeignKey("articles.id"), nullable=False, index=True)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    total_segments: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_segments: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_segment_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("article_segments.id", ondelete="SET NULL"), nullable=True
    )
    failed_segment_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    lease_owner: Mapped[str | None] = mapped_column(String(128), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    asset_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("article_tts_assets.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now(), onupdate=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ArticleTtsAssetSegment(Base):
    __tablename__ = "article_tts_asset_segments"
    __table_args__ = (
        UniqueConstraint(
            "article_tts_asset_id",
            "segment_id",
            name="uq_article_tts_asset_segments_asset_segment",
        ),
        CheckConstraint("segment_order > 0", name="ck_article_tts_asset_segments_order_positive"),
        CheckConstraint(
            "global_start_ms >= 0 AND global_end_ms >= global_start_ms",
            name="ck_article_tts_asset_segments_time_range",
        ),
        Index("ix_article_tts_asset_segments_segment", "segment_id"),
    )

    article_tts_asset_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("article_tts_assets.id"), primary_key=True
    )
    segment_order: Mapped[int] = mapped_column(Integer, primary_key=True)
    segment_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("article_segments.id", ondelete="SET NULL"), nullable=True
    )
    segment_tts_asset_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("tts_assets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    segment_text_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    global_start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    global_end_ms: Mapped[int] = mapped_column(Integer, nullable=False)


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
    practice_level: Mapped[str] = mapped_column(String(8), nullable=False, default="L0")
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )


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


class OpenAIUsageEvent(Base):
    __tablename__ = "openai_usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now(), index=True
    )
    module: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="openai")
    model: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    request_success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    article_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    task_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
