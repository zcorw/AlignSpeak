from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def apply_runtime_schema_fixes() -> None:
    # Backfill defaults for historical Postgres schemas.
    with engine.begin() as conn:
        if conn.dialect.name != "postgresql":
            return
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS tts_assets
                ALTER COLUMN created_at SET DEFAULT now()
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS attempt_compare_blocks
                ALTER COLUMN created_at SET DEFAULT now()
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS attempt_recognition
                ALTER COLUMN created_at SET DEFAULT now()
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS practice_attempts
                ADD COLUMN IF NOT EXISTS alignment_mode VARCHAR(16)
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE practice_attempts
                SET alignment_mode = 'token'
                WHERE alignment_mode IS NULL
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS practice_attempts
                ALTER COLUMN alignment_mode SET DEFAULT 'token'
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS practice_attempts
                ALTER COLUMN alignment_mode SET NOT NULL
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS practice_attempts
                ADD COLUMN IF NOT EXISTS practice_level VARCHAR(8)
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE practice_attempts
                SET practice_level = 'L1'
                WHERE practice_level IS NULL
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS practice_attempts
                ALTER COLUMN practice_level SET DEFAULT 'L1'
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS practice_attempts
                ALTER COLUMN practice_level SET NOT NULL
                """
            )
        )
        conn.execute(
            text(
                """
                DROP TABLE IF EXISTS email_verification_codes
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS invitation_codes (
                    id VARCHAR(32) PRIMARY KEY,
                    code VARCHAR(32) UNIQUE NOT NULL,
                    created_by_user_id VARCHAR(32) NULL REFERENCES users(id),
                    max_uses INTEGER NOT NULL DEFAULT 3,
                    used_count INTEGER NOT NULL DEFAULT 0,
                    status VARCHAR(16) NOT NULL DEFAULT 'active',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_invitation_codes_code
                ON invitation_codes (code)
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS invitation_code_usages (
                    id SERIAL PRIMARY KEY,
                    invitation_code_id VARCHAR(32) NOT NULL REFERENCES invitation_codes(id),
                    user_id VARCHAR(32) NOT NULL UNIQUE REFERENCES users(id),
                    used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT uq_invitation_code_usages_code_user UNIQUE (invitation_code_id, user_id)
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_invitation_code_usages_invitation_code_id
                ON invitation_code_usages (invitation_code_id)
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS segment_reading_overrides (
                    id VARCHAR(32) PRIMARY KEY,
                    user_id VARCHAR(32) NOT NULL REFERENCES users(id),
                    segment_id VARCHAR(32) NOT NULL REFERENCES article_segments(id),
                    token_index INTEGER NOT NULL,
                    surface VARCHAR(128) NOT NULL,
                    yomi VARCHAR(128) NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT uq_segment_reading_overrides_user_segment_token
                        UNIQUE (user_id, segment_id, token_index)
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_segment_reading_overrides_user_id
                ON segment_reading_overrides (user_id)
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_segment_reading_overrides_segment_id
                ON segment_reading_overrides (segment_id)
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS segment_reading_overrides
                ALTER COLUMN yomi DROP NOT NULL
                """
            )
        )
