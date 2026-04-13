from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.application.usecases.explain_usecase import explain_grammar as explain_grammar_usecase
from app.application.usecases.explain_usecase import explain_segment as explain_segment_usecase
from app.db import get_db
from app.deps import get_current_user
from app.infrastructure.repositories.article_repository import ArticleRepository
from app.models import User
from app.schemas.explain import (
    ExplainGrammarPayload,
    ExplainGrammarResponse,
    ExplainSegmentPayload,
    ExplainSegmentResponse,
)

router = APIRouter(prefix="/bff/v1/explain", tags=["explain"])


@router.post("/segment", response_model=ExplainSegmentResponse)
def explain_segment(
    payload: ExplainSegmentPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExplainSegmentResponse:
    repository = ArticleRepository(db=db)
    return explain_segment_usecase(
        repository=repository,
        current_user=current_user,
        payload=payload,
    )


@router.post("/grammar", response_model=ExplainGrammarResponse)
def explain_grammar(
    payload: ExplainGrammarPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExplainGrammarResponse:
    repository = ArticleRepository(db=db)
    return explain_grammar_usecase(
        repository=repository,
        current_user=current_user,
        payload=payload,
    )

