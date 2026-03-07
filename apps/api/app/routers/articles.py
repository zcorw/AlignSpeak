from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.application.usecases.article_usecase import (
    create_article as create_article_usecase,
    detect_article_language as detect_article_language_usecase,
    get_article_detail as get_article_detail_usecase,
    list_articles as list_articles_usecase,
    parse_uploaded_file as parse_uploaded_file_usecase,
)
from app.db import get_db
from app.deps import get_current_user
from app.infrastructure.repositories.article_repository import ArticleRepository
from app.models import User
from app.routers.article_request_parser import (
    parse_create_article_input,
    parse_detect_language_text,
    parse_upload_file_input,
)
from app.schemas.article import (
    ArticleCreateResponse,
    ArticleDetailResponse,
    ArticleListResponse,
    DetectLanguageResponse,
    UploadParseResponse,
)

router = APIRouter(prefix="/articles", tags=["articles"])

@router.post("", response_model=ArticleCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ArticleCreateResponse:
    parsed = await parse_create_article_input(request=request)
    repository = ArticleRepository(db=db)
    return create_article_usecase(
        repository=repository,
        current_user=current_user,
        parsed=parsed,
    )


@router.post("/detect-language", response_model=DetectLanguageResponse)
async def detect_article_language(
    request: Request,
    _current_user: User = Depends(get_current_user),
) -> DetectLanguageResponse:
    raw_text = await parse_detect_language_text(request=request)
    return detect_article_language_usecase(raw_text=raw_text)


@router.post("/parse-upload", response_model=UploadParseResponse)
async def parse_uploaded_file(
    request: Request,
    _current_user: User = Depends(get_current_user),
) -> UploadParseResponse:
    parsed = await parse_upload_file_input(request=request)
    return parse_uploaded_file_usecase(parsed=parsed)


@router.get("/{article_id}", response_model=ArticleDetailResponse)
def get_article(
    article_id: str,
    include_reading: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ArticleDetailResponse:
    repository = ArticleRepository(db=db)
    return get_article_detail_usecase(
        repository=repository,
        current_user=current_user,
        article_id=article_id,
        include_reading=include_reading,
    )


@router.get("", response_model=ArticleListResponse)
def list_articles(
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ArticleListResponse:
    repository = ArticleRepository(db=db)
    return list_articles_usecase(
        repository=repository,
        current_user=current_user,
        limit=limit,
        cursor=cursor,
    )
