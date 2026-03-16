from datetime import datetime

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models import OpenAIUsageEvent


class OpenAIUsageRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_event(self, event: OpenAIUsageEvent) -> OpenAIUsageEvent:
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def get_estimated_cost_total(self, *, start_at: datetime, end_at: datetime) -> float:
        statement = select(func.coalesce(func.sum(OpenAIUsageEvent.estimated_cost_usd), 0.0)).where(
            OpenAIUsageEvent.requested_at >= start_at,
            OpenAIUsageEvent.requested_at < end_at,
        )
        return float(self.db.scalar(statement) or 0.0)

    def get_module_cost_breakdown(self, *, start_at: datetime, end_at: datetime) -> list[tuple[str, float]]:
        statement = (
            select(
                OpenAIUsageEvent.module,
                func.coalesce(func.sum(OpenAIUsageEvent.estimated_cost_usd), 0.0).label("cost"),
            )
            .where(
                OpenAIUsageEvent.requested_at >= start_at,
                OpenAIUsageEvent.requested_at < end_at,
            )
            .group_by(OpenAIUsageEvent.module)
            .order_by(desc("cost"))
        )
        return [(str(module), float(cost or 0.0)) for module, cost in self.db.execute(statement).all()]

    def get_daily_cost_trend(self, *, start_at: datetime, end_at: datetime) -> list[tuple[str, float]]:
        # Use DATE() for cross-db compatibility (PostgreSQL + SQLite).
        day_value = func.date(OpenAIUsageEvent.requested_at)
        statement = (
            select(
                day_value.label("day"),
                func.coalesce(func.sum(OpenAIUsageEvent.estimated_cost_usd), 0.0).label("cost"),
            )
            .where(
                OpenAIUsageEvent.requested_at >= start_at,
                OpenAIUsageEvent.requested_at < end_at,
            )
            .group_by(day_value)
            .order_by(day_value.asc())
        )
        return [(str(day), float(cost or 0.0)) for day, cost in self.db.execute(statement).all()]

    def get_top_expensive_requests(
        self,
        *,
        start_at: datetime,
        end_at: datetime,
        limit: int = 10,
    ) -> list[OpenAIUsageEvent]:
        statement = (
            select(OpenAIUsageEvent)
            .where(
                OpenAIUsageEvent.requested_at >= start_at,
                OpenAIUsageEvent.requested_at < end_at,
            )
            .order_by(OpenAIUsageEvent.estimated_cost_usd.desc(), OpenAIUsageEvent.id.desc())
            .limit(limit)
        )
        return list(self.db.scalars(statement).all())
