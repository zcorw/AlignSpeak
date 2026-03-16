from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.application.usecases.openai_budget_usecase import get_openai_budget_summary
from app.db import get_db
from app.deps import get_current_user
from app.infrastructure.repositories.openai_usage_repository import OpenAIUsageRepository
from app.models import User
from app.schemas.openai_usage import OpenAIBudgetSummaryResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/openai-usage", response_model=OpenAIBudgetSummaryResponse)
def get_admin_openai_usage_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OpenAIBudgetSummaryResponse:
    repository = OpenAIUsageRepository(db=db)
    return get_openai_budget_summary(
        repository=repository,
        current_user=current_user,
    )
