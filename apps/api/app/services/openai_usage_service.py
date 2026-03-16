from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import logging

from fastapi import status

from app.core.config import settings
from app.core.errors import AppError
from app.infrastructure.repositories.openai_usage_repository import OpenAIUsageRepository
from app.models import OpenAIUsageEvent
from app.services.openai_pricing_service import estimate_cost_usd

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OpenAIUsageContext:
    module: str
    provider: str
    model: str
    user_id: str | None = None
    article_id: str | None = None
    task_id: str | None = None


@dataclass(frozen=True)
class BudgetSnapshot:
    month_start_utc: datetime
    month_end_utc: datetime
    estimated_spent_usd: float
    alert_threshold_usd: float
    hard_stop_usd: float


def utc_month_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    point = now or datetime.now(tz=timezone.utc)
    if point.tzinfo is None:
        point = point.replace(tzinfo=timezone.utc)
    current = point.astimezone(timezone.utc)
    month_start = current.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1)
    return month_start, month_end


def build_budget_snapshot(repository: OpenAIUsageRepository) -> BudgetSnapshot:
    month_start, month_end = utc_month_bounds()
    estimated_spent = repository.get_estimated_cost_total(start_at=month_start, end_at=month_end)
    return BudgetSnapshot(
        month_start_utc=month_start,
        month_end_utc=month_end,
        estimated_spent_usd=estimated_spent,
        alert_threshold_usd=float(settings.openai_budget_alert_threshold_usd),
        hard_stop_usd=float(settings.openai_budget_hard_stop_usd),
    )


def enforce_budget_or_raise(*, repository: OpenAIUsageRepository, context: OpenAIUsageContext) -> BudgetSnapshot:
    snapshot = build_budget_snapshot(repository)
    if snapshot.estimated_spent_usd >= snapshot.hard_stop_usd:
        raise AppError(
            code="OPENAI_BUDGET_EXCEEDED",
            message="OpenAI monthly app-side budget hard limit reached.",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    if snapshot.estimated_spent_usd >= snapshot.alert_threshold_usd:
        logger.warning(
            "OpenAI budget alert. month_start=%s spent=%.6f alert_threshold=%.6f hard_stop=%.6f module=%s model=%s",
            snapshot.month_start_utc.isoformat(),
            snapshot.estimated_spent_usd,
            snapshot.alert_threshold_usd,
            snapshot.hard_stop_usd,
            context.module,
            context.model,
        )
    return snapshot


def record_openai_usage_event(
    *,
    repository: OpenAIUsageRepository,
    context: OpenAIUsageContext,
    request_success: bool,
    input_tokens: int | None,
    output_tokens: int | None,
    audio_duration_ms: int | None = None,
    error_code: str | None = None,
) -> OpenAIUsageEvent:
    estimated_cost = estimate_cost_usd(
        model=context.model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        audio_duration_ms=audio_duration_ms,
    )
    return repository.create_event(
        OpenAIUsageEvent(
            module=context.module,
            provider=context.provider,
            model=context.model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=estimated_cost,
            request_success=request_success,
            error_code=error_code,
            user_id=context.user_id,
            article_id=context.article_id,
            task_id=context.task_id,
        )
    )


def last_n_days_start_utc(*, days: int, now: datetime | None = None) -> datetime:
    point = now or datetime.now(tz=timezone.utc)
    if point.tzinfo is None:
        point = point.replace(tzinfo=timezone.utc)
    current = point.astimezone(timezone.utc)
    today_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
    return today_start - timedelta(days=max(days - 1, 0))
