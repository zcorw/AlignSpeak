from dataclasses import dataclass
import re


@dataclass
class LanguageDetectionResult:
    detected_language: str
    raw_language: str
    confidence: float | None
    reliable: bool


def _normalize_language_code(language_code: str) -> str:
    code = language_code.lower().strip()
    if code.startswith("zh"):
        return "zh"
    if code.startswith("ja"):
        return "ja"
    if code.startswith("en"):
        return "en"
    return "unknown"


def _fallback_detect_language(text: str) -> LanguageDetectionResult:
    ja_chars = len(re.findall(r"[\u3040-\u30ff]", text))
    cjk_chars = len(re.findall(r"[\u4e00-\u9fff]", text))
    latin_chars = len(re.findall(r"[A-Za-z]", text))

    if ja_chars >= 2 and ja_chars >= latin_chars:
        return LanguageDetectionResult(
            detected_language="ja",
            raw_language="fallback-ja",
            confidence=0.55,
            reliable=False,
        )
    if cjk_chars >= 2 and ja_chars == 0:
        return LanguageDetectionResult(
            detected_language="zh",
            raw_language="fallback-zh",
            confidence=0.55,
            reliable=False,
        )
    if latin_chars >= 4 and cjk_chars == 0 and ja_chars == 0:
        return LanguageDetectionResult(
            detected_language="en",
            raw_language="fallback-en",
            confidence=0.55,
            reliable=False,
        )
    return LanguageDetectionResult(
        detected_language="unknown",
        raw_language="fallback-unknown",
        confidence=0.0,
        reliable=False,
    )


def detect_language(text: str) -> LanguageDetectionResult:
    normalized = " ".join(text.split())
    if len(normalized) < 8:
        return LanguageDetectionResult(
            detected_language="unknown",
            raw_language="too-short",
            confidence=0.0,
            reliable=False,
        )

    try:
        import pycld2 as cld2  # type: ignore

        reliable, _, details = cld2.detect(
            normalized,
            isPlainText=True,
            bestEffort=True,
        )
        primary = details[0] if details else ("Unknown", "un", 0, 0)
        raw_language = str(primary[1])
        confidence = max(0.0, min(float(primary[2]) / 100.0, 1.0))
        detected_language = _normalize_language_code(raw_language)
        if detected_language == "unknown" and confidence < 0.4:
            return LanguageDetectionResult(
                detected_language="unknown",
                raw_language=raw_language,
                confidence=confidence,
                reliable=bool(reliable),
            )
        return LanguageDetectionResult(
            detected_language=detected_language,
            raw_language=raw_language,
            confidence=confidence,
            reliable=bool(reliable),
        )
    except Exception:
        return _fallback_detect_language(normalized)
