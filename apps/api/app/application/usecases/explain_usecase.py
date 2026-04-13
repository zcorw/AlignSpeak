import re

from fastapi import status

from app.core.errors import AppError
from app.infrastructure.repositories.article_repository import ArticleRepository
from app.models import User
from app.schemas.explain import (
    ExplainGrammarPayload,
    ExplainGrammarResponse,
    ExplainKeywordItem,
    ExplainSegmentPayload,
    ExplainSegmentResponse,
    GrammarPointItem,
)
from app.services.article_service import normalize_text
from app.services.explain_service import explain_segment_text, explain_sentence_grammar


def _normalize_response_language(response_language: str | None, article_language: str) -> str:
    candidate = (response_language or "").strip().lower()
    if candidate in {"en", "zh", "ja"}:
        return candidate
    article_candidate = (article_language or "").strip().lower()
    if article_candidate in {"en", "zh", "ja"}:
        return article_candidate
    return "en"


def _not_found_error() -> AppError:
    return AppError(
        code="NOT_FOUND",
        message="Article or segment not found.",
        status_code=status.HTTP_404_NOT_FOUND,
    )


def explain_segment(
    *,
    repository: ArticleRepository,
    current_user: User,
    payload: ExplainSegmentPayload,
) -> ExplainSegmentResponse:
    article = repository.get_article_by_id_for_user(article_id=payload.article_id, user_id=current_user.id)
    if article is None:
        raise _not_found_error()

    segment = repository.get_segment_by_order(article_id=article.id, segment_order=payload.segment_order)
    if segment is None:
        raise _not_found_error()

    explain_result = explain_segment_text(
        segment_text=segment.plain_text,
        language=article.language,
        response_language=_normalize_response_language(payload.response_language, article.language),
        user_id=current_user.id,
        article_id=article.id,
        segment_order=segment.segment_order,
    )
    return ExplainSegmentResponse(
        article_id=article.id,
        article_title=article.title,
        language=article.language,
        segment_order=segment.segment_order,
        segment_text=segment.plain_text,
        summary=explain_result.summary,
        keywords=[
            ExplainKeywordItem(term=item.term, explanation=item.explanation)
            for item in explain_result.keywords
        ],
        warnings=explain_result.warnings,
    )


def explain_grammar(
    *,
    repository: ArticleRepository,
    current_user: User,
    payload: ExplainGrammarPayload,
) -> ExplainGrammarResponse:
    article = repository.get_article_by_id_for_user(article_id=payload.article_id, user_id=current_user.id)
    if article is None:
        raise _not_found_error()

    segment = repository.get_segment_by_order(article_id=article.id, segment_order=payload.segment_order)
    if segment is None:
        raise _not_found_error()

    sentence_text = payload.sentence_text.strip()
    if not sentence_text:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Sentence text is required.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    segment_compact = re.sub(r"\s+", " ", normalize_text(segment.plain_text))
    sentence_compact = re.sub(r"\s+", " ", normalize_text(sentence_text))
    if sentence_compact and sentence_compact not in segment_compact:
        raise AppError(
            code="VALIDATION_ERROR",
            message="Selected sentence does not belong to the segment.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    grammar_result = explain_sentence_grammar(
        sentence_text=sentence_text,
        language=article.language,
        response_language=_normalize_response_language(payload.response_language, article.language),
        user_id=current_user.id,
        article_id=article.id,
        segment_order=segment.segment_order,
    )
    return ExplainGrammarResponse(
        article_id=article.id,
        article_title=article.title,
        language=article.language,
        segment_order=segment.segment_order,
        sentence_text=sentence_text,
        grammar_points=[
            GrammarPointItem(
                name=item.name,
                explanation=item.explanation,
                snippet=item.snippet,
                example=item.example,
            )
            for item in grammar_result.grammar_points
        ],
        warnings=grammar_result.warnings,
    )
