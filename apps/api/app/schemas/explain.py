from pydantic import BaseModel, Field


class ExplainSegmentPayload(BaseModel):
    article_id: str = Field(min_length=1, max_length=32)
    segment_order: int = Field(ge=1, le=5000)


class ExplainKeywordItem(BaseModel):
    term: str
    explanation: str


class ExplainSegmentResponse(BaseModel):
    article_id: str
    article_title: str
    language: str
    segment_order: int
    segment_text: str
    summary: str
    keywords: list[ExplainKeywordItem]
    warnings: list[str] = []


class ExplainGrammarPayload(BaseModel):
    article_id: str = Field(min_length=1, max_length=32)
    segment_order: int = Field(ge=1, le=5000)
    sentence_text: str = Field(min_length=1, max_length=2000)


class GrammarPointItem(BaseModel):
    name: str
    explanation: str
    snippet: str
    example: str | None = None


class ExplainGrammarResponse(BaseModel):
    article_id: str
    article_title: str
    language: str
    segment_order: int
    sentence_text: str
    grammar_points: list[GrammarPointItem]
    warnings: list[str] = []

