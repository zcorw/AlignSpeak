# OpenAI Budget Control (App-side Estimation)

Last updated: 2026-03-16  
Scope: `apps/api`

## What this control does

- Tracks OpenAI usage events produced by this application in `openai_usage_events`.
- Estimates USD cost by model pricing table (`app/services/openai_pricing_service.py`).
- Enforces a monthly hard stop before OCR/STT calls.
- Emits warning logs once monthly spend reaches alert threshold.

## What this control does NOT do

- This is **application-side estimated spend**, not OpenAI official invoice.
- If the same OpenAI key is used by other systems, their spend is not included here.

## Month boundary

- Monthly budget is calculated by **UTC natural month**:
  - start: `YYYY-MM-01T00:00:00+00:00`
  - end: next month start

## Environment variables

- `OPENAI_MONTHLY_BUDGET_USD` (default `10`)
- `OPENAI_BUDGET_ALERT_THRESHOLD_USD` (default `8`)
- `OPENAI_BUDGET_HARD_STOP_USD` (default `9.5`)

## Internal admin endpoint

- `GET /api/admin/openai-usage`
- Requires admin role.
- Returns:
  - monthly estimated total
  - cost share by module
  - last 7 days trend
  - top expensive requests
