import logging
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from app.infrastructure.repositories.article_tts_repository import ArticleTtsRepository
from app.models import utcnow

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ArticleTtsCleanupResult:
    claimed_assets: int = 0
    deleted_assets: int = 0
    missing_asset_files: int = 0
    failed_asset_deletions: int = 0
    deleted_orphan_files: int = 0
    deleted_temp_entries: int = 0


class ArticleTtsStorageLimitError(Exception):
    pass


def ensure_article_tts_storage_capacity(
    *,
    media_root: Path,
    max_bytes: int,
    additional_bytes: int,
    replacement_path: Path | None = None,
) -> None:
    if max_bytes < 1 or additional_bytes < 0:
        raise ValueError("Article TTS storage settings are invalid.")
    article_root = (media_root.resolve() / "articles").resolve()
    used_bytes = 0
    if article_root.is_dir():
        for candidate in article_root.rglob("*.mp3"):
            try:
                used_bytes += candidate.stat().st_size
            except FileNotFoundError:
                continue
    if replacement_path is not None:
        resolved_replacement = replacement_path.resolve()
        if _is_within(root=article_root, candidate=resolved_replacement):
            try:
                used_bytes -= resolved_replacement.stat().st_size
            except FileNotFoundError:
                pass
    if used_bytes + additional_bytes > max_bytes:
        raise ArticleTtsStorageLimitError("Article TTS media storage quota would be exceeded.")


def _is_within(*, root: Path, candidate: Path) -> bool:
    return candidate == root or root in candidate.parents


class ArticleTtsAssetCleaner:
    def __init__(
        self,
        *,
        repository: ArticleTtsRepository,
        media_root: Path,
        asset_retention_seconds: int,
        temp_file_ttl_seconds: int,
        batch_size: int,
    ) -> None:
        if asset_retention_seconds < 0 or temp_file_ttl_seconds < 0 or batch_size < 1:
            raise ValueError("Article TTS cleanup settings are invalid.")
        self.repository = repository
        self.media_root = media_root.resolve()
        self.asset_retention_seconds = asset_retention_seconds
        self.temp_file_ttl_seconds = temp_file_ttl_seconds
        self.batch_size = batch_size

    def _resolve_relative_path(self, relative_path: str) -> Path | None:
        candidate = (self.media_root / relative_path).resolve()
        return candidate if _is_within(root=self.media_root, candidate=candidate) else None

    @staticmethod
    def _is_expired(path: Path, *, cutoff_timestamp: float) -> bool:
        try:
            return path.stat().st_mtime <= cutoff_timestamp
        except FileNotFoundError:
            return False

    def _cleanup_temp_entries(self, *, cutoff_timestamp: float) -> int:
        if not self.media_root.exists():
            return 0
        deleted = 0
        article_root = (self.media_root / "articles").resolve()
        if article_root.is_dir():
            for candidate in article_root.glob(".article-tts-merge-*"):
                resolved = candidate.resolve()
                if (
                    candidate.is_dir()
                    and _is_within(root=article_root, candidate=resolved)
                    and self._is_expired(candidate, cutoff_timestamp=cutoff_timestamp)
                ):
                    try:
                        shutil.rmtree(candidate)
                        deleted += 1
                    except OSError:
                        logger.exception("Could not delete stale article TTS merge directory: %s", candidate)
        for candidate in self.media_root.rglob("*.tmp"):
            resolved = candidate.resolve()
            if (
                candidate.is_file()
                and _is_within(root=self.media_root, candidate=resolved)
                and self._is_expired(candidate, cutoff_timestamp=cutoff_timestamp)
            ):
                try:
                    candidate.unlink()
                    deleted += 1
                except OSError:
                    logger.exception("Could not delete stale article TTS temporary file: %s", candidate)
        return deleted

    def _cleanup_orphan_article_files(self, *, cutoff_timestamp: float) -> int:
        article_root = (self.media_root / "articles").resolve()
        if not article_root.is_dir():
            return 0
        referenced: set[Path] = set()
        for relative_path in self.repository.list_referenced_article_asset_paths():
            resolved = self._resolve_relative_path(relative_path)
            if resolved is not None:
                referenced.add(resolved)
        deleted = 0
        for candidate in article_root.rglob("*.mp3"):
            resolved = candidate.resolve()
            if (
                candidate.is_file()
                and _is_within(root=article_root, candidate=resolved)
                and resolved not in referenced
                and self._is_expired(candidate, cutoff_timestamp=cutoff_timestamp)
            ):
                try:
                    candidate.unlink()
                    deleted += 1
                except OSError:
                    logger.exception("Could not delete orphan article TTS file: %s", candidate)
        return deleted

    def run_once(self, *, now: datetime | None = None) -> ArticleTtsCleanupResult:
        cleanup_time = now or utcnow()
        candidates = self.repository.claim_asset_cleanup_candidates(
            now=cleanup_time,
            retention_seconds=self.asset_retention_seconds,
            limit=self.batch_size,
        )
        deleted_assets = 0
        missing_asset_files = 0
        failed_asset_deletions = 0
        for asset in candidates:
            relative_path = asset.audio_path
            path = self._resolve_relative_path(relative_path) if relative_path else None
            try:
                if path is None or not path.exists():
                    missing_asset_files += 1
                elif path.is_file():
                    path.unlink()
                    deleted_assets += 1
                else:
                    raise OSError("Article TTS asset path is not a file.")
            except OSError:
                failed_asset_deletions += 1
                logger.exception("Could not delete article TTS asset: asset_id=%s", asset.id)
                continue
            self.repository.finalize_asset_cleanup(
                asset_id=asset.id,
                expected_audio_path=relative_path,
                now=cleanup_time,
            )

        cutoff_timestamp = cleanup_time.timestamp() - self.temp_file_ttl_seconds
        deleted_temp_entries = self._cleanup_temp_entries(cutoff_timestamp=cutoff_timestamp)
        deleted_orphan_files = self._cleanup_orphan_article_files(
            cutoff_timestamp=cutoff_timestamp
        )
        return ArticleTtsCleanupResult(
            claimed_assets=len(candidates),
            deleted_assets=deleted_assets,
            missing_asset_files=missing_asset_files,
            failed_asset_deletions=failed_asset_deletions,
            deleted_orphan_files=deleted_orphan_files,
            deleted_temp_entries=deleted_temp_entries,
        )
