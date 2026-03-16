from datetime import datetime, timezone

from fastapi import status

from app.core.config import settings
from app.core.errors import AppError
from app.infrastructure.repositories.openai_usage_repository import OpenAIUsageRepository
from app.models import User
from app.schemas.openai_usage import (
    OpenAIBudgetSummaryResponse,
    OpenAIDailyTrendItem,
    OpenAIModuleCostItem,
    OpenAITopRequestItem,
)
from app.services.openai_usage_service import build_budget_snapshot, last_n_days_start_utc


def _assert_admin(current_user: User) -> None:
    if current_user.role != "admin":
        raise AppError(
            code="FORBIDDEN",
            message="Admin permission is required.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


def get_openai_budget_summary(
    *,
    repository: OpenAIUsageRepository,
    current_user: User,
) -> OpenAIBudgetSummaryResponse:
    _assert_admin(current_user)

    snapshot = build_budget_snapshot(repository)
    now_utc = datetime.now(tz=timezone.utc)
    trend_start = last_n_days_start_utc(days=7, now=now_utc)

    module_costs = repository.get_module_cost_breakdown(
        start_at=snapshot.month_start_utc,
        end_at=snapshot.month_end_utc,
    )
    trend_rows = repository.get_daily_cost_trend(
        start_at=trend_start,
        end_at=now_utc,
    )
    top_events = repository.get_top_expensive_requests(
        start_at=snapshot.month_start_utc,
        end_at=snapshot.month_end_utc,
        limit=10,
    )

    return OpenAIBudgetSummaryResponse(
        month_start_utc=snapshot.month_start_utc.isoformat(),
        month_end_utc=snapshot.month_end_utc.isoformat(),
        monthly_budget_usd=float(settings.openai_monthly_budget_usd),
        alert_threshold_usd=snapshot.alert_threshold_usd,
        hard_stop_usd=snapshot.hard_stop_usd,
        estimated_spent_usd=round(snapshot.estimated_spent_usd, 8),
        remaining_until_hard_stop_usd=round(max(snapshot.hard_stop_usd - snapshot.estimated_spent_usd, 0.0), 8),
        module_costs=[
            OpenAIModuleCostItem(module=module, estimated_cost_usd=round(cost, 8))
            for module, cost in module_costs
        ],
        trend_last_7_days=[
            OpenAIDailyTrendItem(day_utc=day, estimated_cost_usd=round(cost, 8))
            for day, cost in trend_rows
        ],
        top_expensive_requests=[
            OpenAITopRequestItem(
                requested_at=event.requested_at.isoformat(),
                module=event.module,
                model=event.model,
                estimated_cost_usd=round(float(event.estimated_cost_usd or 0.0), 8),
                request_success=bool(event.request_success),
                user_id=event.user_id,
                article_id=event.article_id,
                task_id=event.task_id,
                error_code=event.error_code,
            )
            for event in top_events
        ],
    )
