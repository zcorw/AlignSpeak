from dataclasses import dataclass


@dataclass(frozen=True)
class ModelPricing:
    input_per_1m_tokens_usd: float | None = None
    output_per_1m_tokens_usd: float | None = None
    per_audio_minute_usd: float | None = None


# Centralized model price table for app-side estimation.
# Prices should be updated whenever provider pricing changes.
MODEL_PRICING_TABLE: dict[str, ModelPricing] = {
    "gpt-4.1-mini": ModelPricing(
        input_per_1m_tokens_usd=0.40,
        output_per_1m_tokens_usd=1.60,
    ),
    "gpt-4o-mini-transcribe": ModelPricing(
        per_audio_minute_usd=0.006,
    ),
}


def estimate_cost_usd(
    *,
    model: str,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    audio_duration_ms: int | None = None,
) -> float:
    pricing = MODEL_PRICING_TABLE.get(model)
    if pricing is None:
        return 0.0

    token_cost = 0.0
    if pricing.input_per_1m_tokens_usd is not None and input_tokens is not None and input_tokens > 0:
        token_cost += (float(input_tokens) / 1_000_000.0) * pricing.input_per_1m_tokens_usd
    if pricing.output_per_1m_tokens_usd is not None and output_tokens is not None and output_tokens > 0:
        token_cost += (float(output_tokens) / 1_000_000.0) * pricing.output_per_1m_tokens_usd

    audio_cost = 0.0
    if pricing.per_audio_minute_usd is not None and audio_duration_ms is not None and audio_duration_ms > 0:
        audio_cost = (float(audio_duration_ms) / 60_000.0) * pricing.per_audio_minute_usd

    return round(token_cost + audio_cost, 8)
