from pydantic import BaseModel, Field


class OpenAIModuleCostItem(BaseModel):
    module: str
    estimated_cost_usd: float = Field(ge=0)


class OpenAIDailyTrendItem(BaseModel):
    day_utc: str
    estimated_cost_usd: float = Field(ge=0)


class OpenAITopRequestItem(BaseModel):
    requested_at: str
    module: str
    model: str
    estimated_cost_usd: float = Field(ge=0)
    request_success: bool
    user_id: str | None = None
    article_id: str | None = None
    task_id: str | None = None
    error_code: str | None = None


class OpenAIBudgetSummaryResponse(BaseModel):
    month_start_utc: str
    month_end_utc: str
    monthly_budget_usd: float = Field(ge=0)
    alert_threshold_usd: float = Field(ge=0)
    hard_stop_usd: float = Field(ge=0)
    estimated_spent_usd: float = Field(ge=0)
    remaining_until_hard_stop_usd: float = Field(ge=0)
    module_costs: list[OpenAIModuleCostItem]
    trend_last_7_days: list[OpenAIDailyTrendItem]
    top_expensive_requests: list[OpenAITopRequestItem]
