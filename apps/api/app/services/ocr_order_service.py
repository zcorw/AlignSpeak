from dataclasses import dataclass
from functools import lru_cache
import json
import logging
import re

import httpx
from fastapi import status

from app.core.config import settings
from app.core.errors import AppError
from app.db import SessionLocal
from app.infrastructure.repositories.openai_usage_repository import OpenAIUsageRepository
from app.services.openai_usage_service import OpenAIUsageContext, enforce_budget_or_raise, record_openai_usage_event

logger = logging.getLogger(__name__)


def _natural_sort_key(value: str) -> tuple:
    parts = re.split(r"(\d+)", (value or "").lower())
    key: list[object] = []
    for part in parts:
        if part.isdigit():
            key.append(int(part))
        else:
            key.append(part)
    return tuple(key)


@dataclass(frozen=True)
class OCROrderCandidate:
    image_id: str
    filename: str
    captured_at: str | None
    ocr_text_head: str
    ocr_text_tail: str
    page_marker_candidates: list[str]
    quality_flags: list[str]


@dataclass(frozen=True)
class OCROrderUncertainPair:
    left: str
    right: str
    confidence: float | None = None


@dataclass(frozen=True)
class OCROrderSuggestionResult:
    ordered_image_ids: list[str]
    overall_confidence: float | None
    reasoning_signals: list[str]
    uncertain_pairs: list[OCROrderUncertainPair]
    warnings: list[str]
    fallback_used: bool


def fallback_order_suggestion(candidates: list[OCROrderCandidate], warnings: list[str] | None = None) -> OCROrderSuggestionResult:
    ordered = sorted(candidates, key=lambda item: _natural_sort_key(item.filename))
    return OCROrderSuggestionResult(
        ordered_image_ids=[item.image_id for item in ordered],
        overall_confidence=None,
        reasoning_signals=["filename_natural_order"],
        uncertain_pairs=[],
        warnings=warnings or [],
        fallback_used=True,
    )


class OpenAIOCROrderProvider:
    def __init__(self, *, api_key: str, model: str, base_url: str, timeout_seconds: float) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def suggest_order(
        self,
        *,
        candidates: list[OCROrderCandidate],
        language_hint: str,
    ) -> OCROrderSuggestionResult:
        usage_context = OpenAIUsageContext(
            module="ocr_order",
            provider="openai",
            model=self.model,
        )
        _enforce_openai_budget_for_ocr_order(usage_context=usage_context)

        candidates_payload = [
            {
                "image_id": item.image_id,
                "filename": item.filename,
                "captured_at": item.captured_at,
                "ocr_text_head": item.ocr_text_head,
                "ocr_text_tail": item.ocr_text_tail,
                "page_marker_candidates": item.page_marker_candidates,
                "quality_flags": item.quality_flags,
            }
            for item in candidates
        ]
        prompt = (
            "You are a document page ordering assistant.\n"
            "Task: infer the most likely reading order of uploaded images that belong to one article.\n"
            "Return strict JSON only.\n"
            "JSON schema:\n"
            "{\n"
            '  "ordered_image_ids": ["string"],\n'
            '  "overall_confidence": 0.0,\n'
            '  "reasoning_signals": ["string"],\n'
            '  "uncertain_pairs": [{"left": "string", "right": "string", "confidence": 0.0}],\n'
            '  "warnings": ["string"]\n'
            "}\n"
            "Rules:\n"
            "- consider these signals in priority: page markers, text continuity, filename order, captured_at.\n"
            "- ordered_image_ids must include each image_id exactly once.\n"
            "- if uncertain, reduce overall_confidence and include uncertain_pairs/warnings.\n"
            "- do not output markdown.\n"
            f"Language hint: {language_hint or 'unknown'}\n"
            "Candidates JSON:\n"
            f"{json.dumps(candidates_payload, ensure_ascii=False)}"
        )
        request_payload = {
            "model": self.model,
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                    ],
                }
            ],
        }
        try:
            response = httpx.post(
                f"{self.base_url}/responses",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=request_payload,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
            input_tokens, output_tokens = _extract_openai_usage_tokens(payload)
            _record_ocr_order_usage_event(
                usage_context=usage_context,
                request_success=True,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                error_code=None,
            )
        except httpx.HTTPStatusError as exc:
            _record_ocr_order_usage_event(
                usage_context=usage_context,
                request_success=False,
                input_tokens=None,
                output_tokens=None,
                error_code="OCR_ORDER_PROVIDER_ERROR",
            )
            detail = exc.response.text if exc.response is not None else str(exc)
            raise AppError(
                code="OCR_ORDER_PROVIDER_ERROR",
                message=f"OpenAI OCR order request failed: {detail[:400]}",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc
        except httpx.HTTPError as exc:
            _record_ocr_order_usage_event(
                usage_context=usage_context,
                request_success=False,
                input_tokens=None,
                output_tokens=None,
                error_code="OCR_ORDER_PROVIDER_ERROR",
            )
            raise AppError(
                code="OCR_ORDER_PROVIDER_ERROR",
                message=f"OpenAI OCR order request failed: {str(exc)}",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc
        except ValueError as exc:
            _record_ocr_order_usage_event(
                usage_context=usage_context,
                request_success=False,
                input_tokens=None,
                output_tokens=None,
                error_code="OCR_ORDER_PROVIDER_ERROR",
            )
            raise AppError(
                code="OCR_ORDER_PROVIDER_ERROR",
                message="OpenAI OCR order response is not valid JSON.",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc

        text = _extract_openai_text(payload)
        parsed = _extract_json_object(text)
        return _validate_and_convert_suggestion(parsed=parsed, candidates=candidates)


def suggest_ocr_image_order(
    *,
    candidates: list[OCROrderCandidate],
    language_hint: str,
) -> OCROrderSuggestionResult:
    if len(candidates) <= 1:
        return OCROrderSuggestionResult(
            ordered_image_ids=[item.image_id for item in candidates],
            overall_confidence=1.0,
            reasoning_signals=["single_image"],
            uncertain_pairs=[],
            warnings=[],
            fallback_used=False,
        )
    provider = _build_ocr_order_provider()
    if provider is None:
        return fallback_order_suggestion(
            candidates,
            warnings=["AI order unavailable. Fallback to filename natural order."],
        )
    try:
        return provider.suggest_order(candidates=candidates, language_hint=language_hint)
    except AppError as exc:
        logger.warning("OCR order fallback. reason=%s", exc.code)
        return fallback_order_suggestion(
            candidates,
            warnings=["AI order failed. Fallback to filename natural order."],
        )


def _extract_openai_text(response_payload: dict) -> str:
    output_text = response_payload.get("output_text")
    if isinstance(output_text, str):
        return output_text.strip()
    texts: list[str] = []
    output_items = response_payload.get("output")
    if isinstance(output_items, list):
        for item in output_items:
            if not isinstance(item, dict):
                continue
            content_items = item.get("content")
            if not isinstance(content_items, list):
                continue
            for content in content_items:
                if not isinstance(content, dict):
                    continue
                if content.get("type") not in {"output_text", "text"}:
                    continue
                text_value = content.get("text")
                if isinstance(text_value, str):
                    texts.append(text_value.strip())
    return "\n".join(part for part in texts if part)


def _extract_json_object(text: str) -> dict:
    raw = (text or "").strip()
    if not raw:
        raise AppError(
            code="OCR_ORDER_PROVIDER_ERROR",
            message="OpenAI OCR order response is empty.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end < start:
        raise AppError(
            code="OCR_ORDER_PROVIDER_ERROR",
            message="OpenAI OCR order response is not JSON text.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )
    try:
        payload = json.loads(raw[start : end + 1])
    except Exception as exc:
        raise AppError(
            code="OCR_ORDER_PROVIDER_ERROR",
            message="OpenAI OCR order response JSON parse failed.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        ) from exc
    if not isinstance(payload, dict):
        raise AppError(
            code="OCR_ORDER_PROVIDER_ERROR",
            message="OpenAI OCR order response root should be object.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )
    return payload


def _validate_and_convert_suggestion(*, parsed: dict, candidates: list[OCROrderCandidate]) -> OCROrderSuggestionResult:
    candidate_ids = [item.image_id for item in candidates]
    candidate_set = set(candidate_ids)
    ordered_raw = parsed.get("ordered_image_ids")
    if not isinstance(ordered_raw, list):
        raise AppError(
            code="OCR_ORDER_PROVIDER_ERROR",
            message="ordered_image_ids is required.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )
    ordered_ids = [str(item).strip() for item in ordered_raw if str(item).strip()]
    if set(ordered_ids) != candidate_set or len(ordered_ids) != len(candidate_ids):
        raise AppError(
            code="OCR_ORDER_PROVIDER_ERROR",
            message="ordered_image_ids does not match candidates.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )

    confidence_raw = parsed.get("overall_confidence")
    overall_confidence = float(confidence_raw) if isinstance(confidence_raw, (int, float)) else None

    reasoning_raw = parsed.get("reasoning_signals")
    reasoning_signals = [str(item).strip() for item in reasoning_raw if str(item).strip()] if isinstance(reasoning_raw, list) else []

    uncertain_pairs_raw = parsed.get("uncertain_pairs")
    uncertain_pairs: list[OCROrderUncertainPair] = []
    if isinstance(uncertain_pairs_raw, list):
        for item in uncertain_pairs_raw:
            if not isinstance(item, dict):
                continue
            left = str(item.get("left", "")).strip()
            right = str(item.get("right", "")).strip()
            conf_raw = item.get("confidence")
            confidence = float(conf_raw) if isinstance(conf_raw, (int, float)) else None
            if left and right:
                uncertain_pairs.append(
                    OCROrderUncertainPair(
                        left=left,
                        right=right,
                        confidence=confidence,
                    )
                )

    warnings_raw = parsed.get("warnings")
    warnings = [str(item).strip() for item in warnings_raw if str(item).strip()] if isinstance(warnings_raw, list) else []

    return OCROrderSuggestionResult(
        ordered_image_ids=ordered_ids,
        overall_confidence=overall_confidence,
        reasoning_signals=reasoning_signals,
        uncertain_pairs=uncertain_pairs,
        warnings=warnings,
        fallback_used=False,
    )


def _extract_openai_usage_tokens(response_payload: dict) -> tuple[int | None, int | None]:
    usage = response_payload.get("usage")
    if not isinstance(usage, dict):
        return None, None
    input_raw = usage.get("input_tokens", usage.get("prompt_tokens"))
    output_raw = usage.get("output_tokens", usage.get("completion_tokens"))
    input_tokens = int(input_raw) if isinstance(input_raw, (int, float)) else None
    output_tokens = int(output_raw) if isinstance(output_raw, (int, float)) else None
    return input_tokens, output_tokens


def _enforce_openai_budget_for_ocr_order(*, usage_context: OpenAIUsageContext) -> None:
    db = None
    try:
        db = SessionLocal()
        repository = OpenAIUsageRepository(db=db)
        enforce_budget_or_raise(repository=repository, context=usage_context)
    except AppError as exc:
        _record_ocr_order_usage_event(
            usage_context=usage_context,
            request_success=False,
            input_tokens=None,
            output_tokens=None,
            error_code=exc.code,
        )
        raise
    except Exception:
        logger.exception("Failed to enforce OCR order budget guard.")
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass


def _record_ocr_order_usage_event(
    *,
    usage_context: OpenAIUsageContext,
    request_success: bool,
    input_tokens: int | None,
    output_tokens: int | None,
    error_code: str | None,
) -> None:
    db = None
    try:
        db = SessionLocal()
        repository = OpenAIUsageRepository(db=db)
        record_openai_usage_event(
            repository=repository,
            context=usage_context,
            request_success=request_success,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            error_code=error_code,
        )
    except Exception:
        logger.exception("Failed to persist OCR order usage event.")
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass


@lru_cache(maxsize=1)
def _build_ocr_order_provider() -> OpenAIOCROrderProvider | None:
    api_key = settings.openai_api_key.strip()
    if not api_key:
        logger.warning("OPENAI_API_KEY is empty. OCR order service will use fallback output.")
        return None
    return OpenAIOCROrderProvider(
        api_key=api_key,
        model=settings.openai_ocr_order_model,
        base_url=settings.openai_base_url,
        timeout_seconds=settings.openai_ocr_order_timeout_seconds,
    )
