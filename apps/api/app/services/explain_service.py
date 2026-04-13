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
from app.services.article_service import normalize_text
from app.services.openai_usage_service import OpenAIUsageContext, enforce_budget_or_raise, record_openai_usage_event

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ExplainKeyword:
    term: str
    explanation: str


@dataclass(frozen=True)
class ExplainSegmentResult:
    summary: str
    keywords: list[ExplainKeyword]
    warnings: list[str]


@dataclass(frozen=True)
class GrammarPoint:
    name: str
    explanation: str
    snippet: str
    example: str | None = None


@dataclass(frozen=True)
class ExplainGrammarResult:
    grammar_points: list[GrammarPoint]
    warnings: list[str]


class OpenAIExplainProvider:
    def __init__(self, *, api_key: str, model: str, base_url: str, timeout_seconds: float) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def explain_segment(
        self,
        *,
        segment_text: str,
        language: str,
        usage_context: OpenAIUsageContext,
    ) -> ExplainSegmentResult:
        prompt = (
            "You are a language tutor. Analyze the given paragraph and return strict JSON only.\n"
            "JSON schema:\n"
            "{\n"
            '  "summary": "string (<= 180 chars)",\n'
            '  "keywords": [{"term": "string", "explanation": "string"}]\n'
            "}\n"
            "Rules:\n"
            "- summary should be concise and easy for learners.\n"
            "- keywords: 3 to 6 items.\n"
            "- explanations should be short and practical.\n"
            "- do not return markdown.\n"
            f"Language code: {language}\n"
            "Paragraph:\n"
            f"{segment_text}"
        )
        payload = self._request_json(prompt=prompt, usage_context=usage_context)
        summary = str(payload.get("summary", "")).strip()
        raw_keywords = payload.get("keywords")
        keywords: list[ExplainKeyword] = []
        if isinstance(raw_keywords, list):
            for item in raw_keywords:
                if not isinstance(item, dict):
                    continue
                term = str(item.get("term", "")).strip()
                explanation = str(item.get("explanation", "")).strip()
                if term and explanation:
                    keywords.append(ExplainKeyword(term=term, explanation=explanation))
        if not summary:
            raise AppError(
                code="EXPLAIN_PROVIDER_ERROR",
                message="AI explain response is missing summary.",
                status_code=status.HTTP_502_BAD_GATEWAY,
            )
        if not keywords:
            raise AppError(
                code="EXPLAIN_PROVIDER_ERROR",
                message="AI explain response is missing keywords.",
                status_code=status.HTTP_502_BAD_GATEWAY,
            )
        return ExplainSegmentResult(summary=summary[:180], keywords=keywords[:6], warnings=[])

    def explain_grammar(
        self,
        *,
        sentence_text: str,
        language: str,
        usage_context: OpenAIUsageContext,
    ) -> ExplainGrammarResult:
        prompt = (
            "You are a language tutor. Extract grammar points from the sentence and return strict JSON only.\n"
            "JSON schema:\n"
            "{\n"
            '  "grammar_points": [\n'
            "    {\n"
            '      "name": "string",\n'
            '      "explanation": "string",\n'
            '      "snippet": "string",\n'
            '      "example": "string"\n'
            "    }\n"
            "  ]\n"
            "}\n"
            "Rules:\n"
            "- 2 to 5 grammar points.\n"
            "- snippets must be exact spans from the input sentence.\n"
            "- explanations should be short and learner-friendly.\n"
            "- do not return markdown.\n"
            f"Language code: {language}\n"
            "Sentence:\n"
            f"{sentence_text}"
        )
        payload = self._request_json(prompt=prompt, usage_context=usage_context)
        raw_points = payload.get("grammar_points")
        points: list[GrammarPoint] = []
        if isinstance(raw_points, list):
            for item in raw_points:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name", "")).strip()
                explanation = str(item.get("explanation", "")).strip()
                snippet = str(item.get("snippet", "")).strip()
                example_raw = item.get("example")
                example = str(example_raw).strip() if isinstance(example_raw, str) else None
                if name and explanation and snippet:
                    points.append(
                        GrammarPoint(
                            name=name,
                            explanation=explanation,
                            snippet=snippet,
                            example=example,
                        )
                    )
        if not points:
            raise AppError(
                code="EXPLAIN_PROVIDER_ERROR",
                message="AI grammar response is missing grammar points.",
                status_code=status.HTTP_502_BAD_GATEWAY,
            )
        return ExplainGrammarResult(grammar_points=points[:5], warnings=[])

    def _request_json(self, *, prompt: str, usage_context: OpenAIUsageContext) -> dict:
        _enforce_openai_budget_for_explain(usage_context=usage_context)
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
            _record_explain_usage_event(
                usage_context=usage_context,
                request_success=True,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                error_code=None,
            )
        except httpx.HTTPStatusError as exc:
            _record_explain_usage_event(
                usage_context=usage_context,
                request_success=False,
                input_tokens=None,
                output_tokens=None,
                error_code="EXPLAIN_PROVIDER_ERROR",
            )
            detail = exc.response.text if exc.response is not None else str(exc)
            raise AppError(
                code="EXPLAIN_PROVIDER_ERROR",
                message=f"OpenAI explain request failed: {detail[:400]}",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc
        except httpx.HTTPError as exc:
            _record_explain_usage_event(
                usage_context=usage_context,
                request_success=False,
                input_tokens=None,
                output_tokens=None,
                error_code="EXPLAIN_PROVIDER_ERROR",
            )
            raise AppError(
                code="EXPLAIN_PROVIDER_ERROR",
                message=f"OpenAI explain request failed: {str(exc)}",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc
        except ValueError as exc:
            _record_explain_usage_event(
                usage_context=usage_context,
                request_success=False,
                input_tokens=None,
                output_tokens=None,
                error_code="EXPLAIN_PROVIDER_ERROR",
            )
            raise AppError(
                code="EXPLAIN_PROVIDER_ERROR",
                message="OpenAI explain response is not valid JSON.",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc

        response_text = _extract_openai_text(payload)
        try:
            return _extract_json_object(response_text)
        except ValueError as exc:
            raise AppError(
                code="EXPLAIN_PROVIDER_ERROR",
                message="OpenAI explain response is not valid JSON text.",
                status_code=status.HTTP_502_BAD_GATEWAY,
            ) from exc


def explain_segment_text(
    *,
    segment_text: str,
    language: str,
    user_id: str,
    article_id: str,
    segment_order: int,
) -> ExplainSegmentResult:
    normalized = normalize_text(segment_text)
    provider = _build_explain_provider()
    if provider is None:
        return _fallback_explain_segment(normalized, language)
    task_id = f"seg:{segment_order}"
    context = OpenAIUsageContext(
        module="explain_segment",
        provider="openai",
        model=settings.openai_explain_model,
        user_id=user_id,
        article_id=article_id,
        task_id=task_id,
    )
    try:
        return provider.explain_segment(
            segment_text=normalized,
            language=language,
            usage_context=context,
        )
    except AppError as exc:
        logger.warning("Explain segment fallback. reason=%s", exc.code)
        fallback = _fallback_explain_segment(normalized, language)
        return ExplainSegmentResult(
            summary=fallback.summary,
            keywords=fallback.keywords,
            warnings=[*fallback.warnings, "AI explain unavailable. Returned fallback result."],
        )


def explain_sentence_grammar(
    *,
    sentence_text: str,
    language: str,
    user_id: str,
    article_id: str,
    segment_order: int,
) -> ExplainGrammarResult:
    normalized = normalize_text(sentence_text)
    provider = _build_explain_provider()
    if provider is None:
        return _fallback_explain_grammar(normalized, language)
    task_id = f"seg:{segment_order}:grammar"
    context = OpenAIUsageContext(
        module="explain_grammar",
        provider="openai",
        model=settings.openai_explain_model,
        user_id=user_id,
        article_id=article_id,
        task_id=task_id,
    )
    try:
        return provider.explain_grammar(
            sentence_text=normalized,
            language=language,
            usage_context=context,
        )
    except AppError as exc:
        logger.warning("Explain grammar fallback. reason=%s", exc.code)
        fallback = _fallback_explain_grammar(normalized, language)
        return ExplainGrammarResult(
            grammar_points=fallback.grammar_points,
            warnings=[*fallback.warnings, "AI grammar unavailable. Returned fallback result."],
        )


def _fallback_explain_segment(segment_text: str, language: str) -> ExplainSegmentResult:
    collapsed = re.sub(r"\s+", " ", segment_text).strip()
    summary = collapsed[:180] if collapsed else ""
    if len(collapsed) > 180:
        summary = f"{summary}..."
    if not summary:
        summary = "This segment introduces key ideas from the selected paragraph."

    keywords: list[ExplainKeyword] = []
    if language == "en":
        words = re.findall(r"[A-Za-z][A-Za-z'-]{3,}", segment_text)
        seen: set[str] = set()
        for word in words:
            key = word.lower()
            if key in seen:
                continue
            seen.add(key)
            keywords.append(ExplainKeyword(term=word, explanation="Key vocabulary in this paragraph."))
            if len(keywords) >= 5:
                break
    else:
        phrases = re.findall(r"[\u4e00-\u9fffぁ-んァ-ヶ]{2,}", segment_text)
        seen_phrase: set[str] = set()
        for phrase in phrases:
            if phrase in seen_phrase:
                continue
            seen_phrase.add(phrase)
            keywords.append(ExplainKeyword(term=phrase, explanation="This phrase is important for understanding context."))
            if len(keywords) >= 5:
                break

    if not keywords:
        keywords.append(ExplainKeyword(term=segment_text[:12] or "Key idea", explanation="Core point in this segment."))

    return ExplainSegmentResult(summary=summary, keywords=keywords, warnings=["Fallback explanation used."])


def _fallback_explain_grammar(sentence_text: str, language: str) -> ExplainGrammarResult:
    points: list[GrammarPoint] = []
    if language == "en":
        if " if " in f" {sentence_text.lower()} ":
            points.append(
                GrammarPoint(
                    name="Conditional clause",
                    explanation="This sentence uses an if-clause to set a condition.",
                    snippet="if",
                    example="If it rains, we stay home.",
                )
            )
        if re.search(r"\b(to|for|with|at|on|in)\b", sentence_text.lower()):
            points.append(
                GrammarPoint(
                    name="Prepositional phrase",
                    explanation="A preposition introduces extra context such as place, time, or purpose.",
                    snippet=sentence_text,
                )
            )
    elif language == "zh":
        if "了" in sentence_text:
            points.append(
                GrammarPoint(
                    name="动态助词“了”",
                    explanation="“了”常用于表示动作完成或状态变化。",
                    snippet="了",
                    example="我吃了饭。",
                )
            )
        if "的" in sentence_text:
            points.append(
                GrammarPoint(
                    name="结构助词“的”",
                    explanation="“的”常用于修饰关系或所属关系表达。",
                    snippet="的",
                )
            )
    else:
        if "です" in sentence_text or "ます" in sentence_text:
            points.append(
                GrammarPoint(
                    name="丁寧体",
                    explanation="文末使用です/ます体现礼貌表达。",
                    snippet="です/ます",
                )
            )
        if "は" in sentence_text:
            points.append(
                GrammarPoint(
                    name="主题提示“は”",
                    explanation="“は”用于提示主题，后续内容对主题进行说明。",
                    snippet="は",
                )
            )

    if not points:
        points.append(
            GrammarPoint(
                name="Sentence structure",
                explanation="This sentence follows a basic predicate structure.",
                snippet=sentence_text[:48] or sentence_text,
            )
        )
    return ExplainGrammarResult(grammar_points=points[:5], warnings=["Fallback grammar analysis used."])


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

    if texts:
        return "\n".join(part for part in texts if part)
    return ""


def _extract_json_object(text: str) -> dict:
    raw = text.strip()
    if not raw:
        raise ValueError("empty response")
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end < start:
        raise ValueError("json object not found")
    json_text = raw[start : end + 1]
    value = json.loads(json_text)
    if not isinstance(value, dict):
        raise ValueError("json root should be object")
    return value


def _extract_openai_usage_tokens(response_payload: dict) -> tuple[int | None, int | None]:
    usage = response_payload.get("usage")
    if not isinstance(usage, dict):
        return None, None
    input_raw = usage.get("input_tokens", usage.get("prompt_tokens"))
    output_raw = usage.get("output_tokens", usage.get("completion_tokens"))
    input_tokens = int(input_raw) if isinstance(input_raw, (int, float)) else None
    output_tokens = int(output_raw) if isinstance(output_raw, (int, float)) else None
    return input_tokens, output_tokens


def _enforce_openai_budget_for_explain(*, usage_context: OpenAIUsageContext) -> None:
    db = None
    try:
        db = SessionLocal()
        repository = OpenAIUsageRepository(db=db)
        enforce_budget_or_raise(repository=repository, context=usage_context)
    except AppError as exc:
        _record_explain_usage_event(
            usage_context=usage_context,
            request_success=False,
            input_tokens=None,
            output_tokens=None,
            error_code=exc.code,
        )
        raise
    except Exception:
        logger.exception("Failed to enforce explain budget guard.")
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass


def _record_explain_usage_event(
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
        logger.exception("Failed to persist explain usage event.")
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass


@lru_cache(maxsize=1)
def _build_explain_provider() -> OpenAIExplainProvider | None:
    api_key = settings.openai_api_key.strip()
    if not api_key:
        logger.warning("OPENAI_API_KEY is empty. Explain service will use fallback output.")
        return None
    return OpenAIExplainProvider(
        api_key=api_key,
        model=settings.openai_explain_model,
        base_url=settings.openai_base_url,
        timeout_seconds=settings.openai_explain_timeout_seconds,
    )

