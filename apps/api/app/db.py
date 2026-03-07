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
