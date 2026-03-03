from typing import Any


HOME_SUMMARY = {
    "target_segments": 3,
    "completed_segments": 1,
    "language": "ja",
    "draft_text": "春は、あけぼの。やうやう白くなりゆく山ぎは。",
}

PRACTICE_DOCS: dict[str, dict[str, Any]] = {
    "doc-ja": {
        "article_id": "doc-ja",
        "title": "枕草子（春は、あけぼの）",
        "default_segment_id": "seg-01",
        "segments": [
            {"id": "seg-01", "label": "段落 01", "progress_rate": 92},
            {"id": "seg-02", "label": "段落 02", "progress_rate": 76},
            {"id": "seg-03", "label": "段落 03", "progress_rate": 60},
        ],
        "bundles": {
            "seg-01": {
                "segment_id": "seg-01",
                "pre_record": {
                    "level": 1,
                    "mask_ratio": 0.2,
                    "tokens": [
                        {"text": "春は、", "hidden": False},
                        {"text": "あけぼの", "hidden": True},
                        {"text": "。", "hidden": False},
                    ],
                },
                "result": {
                    "blocks": [
                        {
                            "id": "ja-1",
                            "reference": [
                                {"text": "春は、", "diff": "correct"},
                                {"text": "あけぼの", "diff": "missing"},
                                {"text": "。", "diff": "correct"},
                            ],
                            "recognized": [
                                {"text": "春は、", "diff": "correct"},
                                {"text": "えっと", "diff": "insert"},
                                {"text": "。", "diff": "correct"},
                            ],
                        }
                    ]
                },
            },
            "seg-02": {
                "segment_id": "seg-02",
                "pre_record": {
                    "level": 2,
                    "mask_ratio": 0.4,
                    "tokens": [
                        {"text": "やうやう", "hidden": False},
                        {"text": "白く", "hidden": False},
                        {"text": "なりゆく", "hidden": True},
                        {"text": "山ぎは。", "hidden": False},
                    ],
                },
                "result": {
                    "blocks": [
                        {
                            "id": "ja-2",
                            "reference": [
                                {"text": "やうやう", "diff": "correct"},
                                {"text": "白く", "diff": "correct"},
                                {"text": "なりゆく", "diff": "substitute"},
                            ],
                            "recognized": [
                                {"text": "やうやう", "diff": "correct"},
                                {"text": "白く", "diff": "correct"},
                                {"text": "なるゆく", "diff": "substitute"},
                            ],
                        }
                    ]
                },
            },
            "seg-03": {
                "segment_id": "seg-03",
                "pre_record": {
                    "level": 3,
                    "mask_ratio": 0.7,
                    "tokens": [
                        {"text": "少しあかりて、", "hidden": False},
                        {"text": "紫だちたる雲の", "hidden": True},
                        {"text": "細くたなびきたる。", "hidden": True},
                    ],
                },
                "result": {
                    "blocks": [
                        {
                            "id": "ja-3",
                            "reference": [
                                {"text": "少しあかりて、", "diff": "correct"},
                                {"text": "紫だちたる雲の", "diff": "missing"},
                                {"text": "細くたなびきたる。", "diff": "substitute"},
                            ],
                            "recognized": [
                                {"text": "少しあかりて、", "diff": "correct"},
                                {"text": "えー", "diff": "insert"},
                                {"text": "細くたなびいた。", "diff": "substitute"},
                            ],
                        }
                    ]
                },
            },
        },
    }
}

PROGRESS_SUMMARY = {
    "accuracy_rate": 88,
    "current_level": 3,
    "hot_words": [
        {"word": "あけぼの", "kind": "missing", "count": 6},
        {"word": "なりゆく", "kind": "substitute", "count": 4},
        {"word": "山ぎは", "kind": "insert", "count": 3},
    ],
}


def resolve_doc(doc_id: str | None) -> dict[str, Any]:
    if not doc_id:
        return PRACTICE_DOCS["doc-ja"]
    return PRACTICE_DOCS.get(doc_id, PRACTICE_DOCS["doc-ja"])


def get_practice_bundle(doc_id: str | None, segment_id: str | None) -> dict[str, Any]:
    doc = resolve_doc(doc_id)
    chosen_segment_id = segment_id if segment_id in doc["bundles"] else doc["default_segment_id"]
    bundle = doc["bundles"][chosen_segment_id]
    return {
        "article_id": doc["article_id"],
        "segment_id": chosen_segment_id,
        "title": doc["title"],
        "segments": doc["segments"],
        "pre_record": bundle["pre_record"],
        "result": bundle["result"],
    }


def get_practice_result(doc_id: str | None, segment_id: str | None) -> dict[str, Any]:
    return get_practice_bundle(doc_id, segment_id)["result"]
