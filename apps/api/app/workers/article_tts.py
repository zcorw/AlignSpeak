import argparse
import logging
import os
import shutil
import signal
import socket
import subprocess
import threading
from pathlib import Path
from time import monotonic, time
from uuid import uuid4

from sqlalchemy import text

from app.application.usecases.article_tts_job_processor import ArticleTtsJobProcessor
from app.core.config import settings
from app.db import SessionLocal
from app.infrastructure.repositories.article_tts_repository import ArticleTtsRepository
from app.infrastructure.repositories.tts_repository import TtsRepository
from app.services.article_tts_cleanup import ArticleTtsAssetCleaner
from app.services.article_tts_worker import ArticleTtsWorkerRunner

logger = logging.getLogger(__name__)


def verify_audio_tools() -> None:
    for binary in ("ffmpeg", "ffprobe"):
        if shutil.which(binary) is None:
            raise RuntimeError(f"Required audio tool is unavailable: {binary}")
        completed = subprocess.run(
            [binary, "-version"],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if completed.returncode != 0:
            raise RuntimeError(f"Required audio tool failed its version check: {binary}")


def _worker_id() -> str:
    return f"{socket.gethostname()}:{os.getpid()}:{uuid4().hex[:8]}"


def _touch_health_file(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.touch()


def run_healthcheck() -> int:
    try:
        verify_audio_tools()
        health_path = Path(settings.article_tts_worker_health_file)
        if not health_path.is_file():
            raise RuntimeError("Worker heartbeat file does not exist.")
        age_seconds = time() - health_path.stat().st_mtime
        if age_seconds > settings.article_tts_worker_health_stale_seconds:
            raise RuntimeError("Worker heartbeat is stale.")
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Article TTS worker healthcheck failed.")
        return 1
    return 0


class ArticleTtsWorkerApplication:
    def __init__(self, *, worker_id: str | None = None) -> None:
        self.worker_id = worker_id or _worker_id()
        self.health_path = Path(settings.article_tts_worker_health_file)
        self.stop_event = threading.Event()

    def _heartbeat_loop(self) -> None:
        interval = max(min(settings.article_tts_worker_health_stale_seconds / 3, 30), 1)
        while not self.stop_event.is_set():
            try:
                _touch_health_file(self.health_path)
            except OSError:
                logger.exception("Could not update the article TTS worker heartbeat file.")
            self.stop_event.wait(interval)

    def run_job_once(self) -> bool:
        with SessionLocal() as db:
            article_repository = ArticleTtsRepository(db)
            processor = ArticleTtsJobProcessor(
                article_repository=article_repository,
                tts_repository=TtsRepository(db),
                media_root=Path(settings.tts_media_dir),
            )
            runner = ArticleTtsWorkerRunner(
                repository=article_repository,
                worker_id=self.worker_id,
                lease_seconds=settings.article_tts_worker_lease_seconds,
                max_attempts=settings.article_tts_job_max_attempts,
                process_job=processor,
            )
            return runner.run_once() is not None

    def run_cleanup_once(self) -> None:
        with SessionLocal() as db:
            result = ArticleTtsAssetCleaner(
                repository=ArticleTtsRepository(db),
                media_root=Path(settings.tts_media_dir),
                asset_retention_seconds=settings.article_tts_asset_retention_seconds,
                temp_file_ttl_seconds=settings.article_tts_temp_file_ttl_seconds,
                batch_size=settings.article_tts_cleanup_batch_size,
            ).run_once()
        logger.info("Article TTS cleanup completed: %s", result)

    def run_forever(self, *, once: bool = False) -> None:
        verify_audio_tools()
        _touch_health_file(self.health_path)
        if once:
            self.run_cleanup_once()
            self.run_job_once()
            return

        heartbeat = threading.Thread(
            target=self._heartbeat_loop,
            name="article-tts-health-heartbeat",
            daemon=True,
        )
        heartbeat.start()
        next_cleanup_at = 0.0
        logger.info("Article TTS worker started: worker_id=%s", self.worker_id)
        try:
            while not self.stop_event.is_set():
                now = monotonic()
                if now >= next_cleanup_at:
                    try:
                        self.run_cleanup_once()
                    except Exception:
                        logger.exception("Article TTS cleanup pass failed.")
                    next_cleanup_at = now + settings.article_tts_cleanup_interval_seconds
                try:
                    processed = self.run_job_once()
                except Exception:
                    logger.exception("Article TTS worker iteration failed before claiming a job.")
                    processed = False
                if not processed:
                    self.stop_event.wait(settings.article_tts_worker_poll_seconds)
        finally:
            self.stop_event.set()
            heartbeat.join(timeout=5)
            logger.info("Article TTS worker stopped: worker_id=%s", self.worker_id)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the persistent article TTS worker.")
    parser.add_argument("--once", action="store_true", help="Run one cleanup/job iteration and exit.")
    parser.add_argument("--healthcheck", action="store_true", help="Check worker liveness and dependencies.")
    args = parser.parse_args()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    if args.healthcheck:
        return run_healthcheck()

    application = ArticleTtsWorkerApplication()
    if not args.once:
        for signal_number in (signal.SIGINT, signal.SIGTERM):
            signal.signal(signal_number, lambda _signum, _frame: application.stop_event.set())
    application.run_forever(once=args.once)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
