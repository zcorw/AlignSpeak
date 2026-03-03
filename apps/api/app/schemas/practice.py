from typing import Literal

from pydantic import BaseModel

DiffKind = Literal["correct", "missing", "insert", "substitute"]


class HomeSummary(BaseModel):
    target_segments: int
    completed_segments: int
    language: Literal["ja", "en", "zh"]
    draft_text: str


class PracticeQuery(BaseModel):
    docId: str | None = None
    segmentId: str | None = None


class ProgressSummary(BaseModel):
    accuracy_rate: int
    current_level: int
    hot_words: list[dict]


class MeSummary(BaseModel):
    email: str
    streak_days: int
    history_docs: list[dict]
