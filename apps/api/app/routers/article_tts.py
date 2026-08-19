from collections.abc import Iterator
from pathlib import Path

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.application.usecases.article_tts_api_usecase import (
    create_full_article_tts_job,
    get_current_article_tts,
    get_full_article_tts_job,
    resolve_full_article_tts_media,
    retry_full_article_tts_job,
)
from app.db import get_db
from app.deps import get_current_user
from app.infrastructure.repositories.article_tts_repository import ArticleTtsRepository
from app.infrastructure.repositories.tts_repository import TtsRepository
from app.models import User
from app.schemas.article_tts import (
    ArticleTtsJobResponse,
    CreateArticleTtsJobPayload,
    CurrentArticleTtsResponse,
)

router = APIRouter(tags=["article-tts"])


def _parse_single_byte_range(range_header: str, *, file_size: int) -> tuple[int, int]:
    if not range_header.startswith("bytes=") or "," in range_header:
        raise ValueError("Only one byte range is supported.")
    raw_range = range_header[6:].strip()
    if "-" not in raw_range:
        raise ValueError("Invalid byte range.")
    raw_start, raw_end = raw_range.split("-", 1)
    if not raw_start:
        suffix_length = int(raw_end)
        if suffix_length <= 0:
            raise ValueError("Invalid suffix range.")
        start = max(file_size - suffix_length, 0)
        return start, file_size - 1

    start = int(raw_start)
    if start < 0 or start >= file_size:
        raise ValueError("Range starts outside the file.")
    end = int(raw_end) if raw_end else file_size - 1
    if end < start:
        raise ValueError("Range end precedes its start.")
    return start, min(end, file_size - 1)


def _iter_file_range(path: Path, *, start: int, end: int, chunk_size: int = 64 * 1024) -> Iterator[bytes]:
    remaining = end - start + 1
    with path.open("rb") as handle:
        handle.seek(start)
        while remaining > 0:
            chunk = handle.read(min(chunk_size, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@router.post(
    "/articles/{article_id}/full-tts-jobs",
    response_model=ArticleTtsJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_article_tts_job_endpoint(
    article_id: str,
    payload: CreateArticleTtsJobPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ArticleTtsJobResponse:
    return create_full_article_tts_job(
        repository=ArticleTtsRepository(db),
        tts_repository=TtsRepository(db),
        current_user=current_user,
        article_id=article_id,
        force_refresh=payload.force_refresh,
    )


@router.post("/full-tts-jobs/{job_id}/retry", response_model=ArticleTtsJobResponse)
def retry_article_tts_job_endpoint(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ArticleTtsJobResponse:
    return retry_full_article_tts_job(
        repository=ArticleTtsRepository(db),
        current_user=current_user,
        job_id=job_id,
    )


@router.get("/full-tts-jobs/{job_id}", response_model=ArticleTtsJobResponse)
def get_article_tts_job_endpoint(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ArticleTtsJobResponse:
    return get_full_article_tts_job(
        repository=ArticleTtsRepository(db),
        current_user=current_user,
        job_id=job_id,
    )


@router.get("/articles/{article_id}/full-tts", response_model=CurrentArticleTtsResponse)
def get_current_article_tts_endpoint(
    article_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CurrentArticleTtsResponse:
    return get_current_article_tts(
        repository=ArticleTtsRepository(db),
        tts_repository=TtsRepository(db),
        current_user=current_user,
        article_id=article_id,
    )


@router.get("/media/tts/articles/{asset_id}", response_model=None)
def get_article_tts_media_endpoint(
    asset_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse | JSONResponse:
    resolved = resolve_full_article_tts_media(
        repository=ArticleTtsRepository(db),
        current_user=current_user,
        asset_id=asset_id,
    )
    file_size = resolved.path.stat().st_size
    range_header = request.headers.get("range")
    start = 0
    end = file_size - 1
    response_status = status.HTTP_200_OK
    if range_header:
        try:
            start, end = _parse_single_byte_range(range_header, file_size=file_size)
        except (TypeError, ValueError):
            return JSONResponse(
                status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                content={
                    "error": {
                        "code": "RANGE_NOT_SATISFIABLE",
                        "message": "The requested media range is not satisfiable.",
                    }
                },
                headers={"Content-Range": f"bytes */{file_size}"},
            )
        response_status = status.HTTP_206_PARTIAL_CONTENT

    content_length = end - start + 1
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Content-Disposition": f'inline; filename="{resolved.asset.id}.mp3"',
        "Cache-Control": "private, no-store",
        "ETag": f'"{resolved.asset.input_hash}"',
    }
    if response_status == status.HTTP_206_PARTIAL_CONTENT:
        headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
    return StreamingResponse(
        _iter_file_range(resolved.path, start=start, end=end),
        status_code=response_status,
        media_type="audio/mpeg",
        headers=headers,
    )
