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
    # Backfill default for historical Postgres schemas created before created_at default was added.
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
