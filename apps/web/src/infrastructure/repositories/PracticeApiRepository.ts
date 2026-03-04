import type {
  DiffKind,
  HomeSummary,
  MeSummary,
  PracticeBundle,
  PracticeResultData,
  ProgressSummary,
} from "../../domain/practice/entities";
import type {
  ArticleCreateInput,
  ArticleCreateResult,
  ArticleLanguageDetectInput,
  ArticleLanguageDetectResult,
  ArticleLanguage,
  ArticleListResult,
} from "../../domain/article/entities";
import type { PracticeRepository } from "../../application/ports/PracticeRepository";
import { getJSON, postJSON, postMultipart } from "../http/httpClient";

type AnyRecord = Record<string, unknown>;

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
};

const toString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  return fallback;
};

const read = (obj: AnyRecord | null | undefined, camel: string, snake: string): unknown => {
  if (!obj) return undefined;
  if (camel in obj) return obj[camel];
  return obj[snake];
};

const toDiffKind = (value: unknown): DiffKind | undefined => {
  if (value === "correct" || value === "missing" || value === "insert" || value === "substitute") {
    return value;
  }
  return undefined;
};

export class PracticeApiRepository implements PracticeRepository {
  async createArticle(input: ArticleCreateInput): Promise<ArticleCreateResult> {
    let raw: AnyRecord;

    if (input.sourceType === "manual") {
      raw = (await postJSON<AnyRecord, Record<string, unknown>>("/articles", {
        title: input.title,
        language: input.language,
        source_type: input.sourceType,
        text: input.text ?? "",
      })) as AnyRecord;
    } else {
      if (!input.file) {
        throw new Error("File is required for upload/ocr source type.");
      }
      const formData = new FormData();
      formData.append("title", input.title);
      formData.append("language", input.language);
      formData.append("file", input.file);
      raw = (await postMultipart<AnyRecord>("/articles", formData)) as AnyRecord;
    }

    const rawSegments = (read(raw, "segments", "segments") as AnyRecord[]) ?? [];
    return {
      articleId: toString(read(raw, "articleId", "article_id"), ""),
      title: toString(read(raw, "title", "title"), ""),
      language: (toString(read(raw, "language", "language"), "ja") as ArticleLanguage),
      detectedLanguage: toString(read(raw, "detectedLanguage", "detected_language"), "unknown") as
        | "ja"
        | "en"
        | "zh"
        | "unknown",
      detectedConfidence: (() => {
        const value = read(raw, "detectedConfidence", "detected_confidence");
        if (typeof value === "number" && Number.isFinite(value)) return value;
        return undefined;
      })(),
      detectedReliable: Boolean(read(raw, "detectedReliable", "detected_reliable")),
      detectedRawLanguage: toString(read(raw, "detectedRawLanguage", "detected_raw_language"), "unknown"),
      segments: rawSegments.map((segment) => ({
        id: toString(read(segment, "id", "id"), ""),
        order: toNumber(read(segment, "order", "order"), 0),
        preview: toString(read(segment, "preview", "preview"), ""),
      })),
    };
  }

  async detectArticleLanguage(input: ArticleLanguageDetectInput): Promise<ArticleLanguageDetectResult> {
    const raw = (await postJSON<AnyRecord, Record<string, unknown>>("/articles/detect-language", {
      text: input.text,
    })) as AnyRecord;

    return {
      detectedLanguage: toString(read(raw, "detectedLanguage", "detected_language"), "unknown") as
        | "ja"
        | "en"
        | "zh"
        | "unknown",
      detectedConfidence: (() => {
        const value = read(raw, "detectedConfidence", "detected_confidence");
        if (typeof value === "number" && Number.isFinite(value)) return value;
        return undefined;
      })(),
      detectedReliable: Boolean(read(raw, "detectedReliable", "detected_reliable")),
      detectedRawLanguage: toString(read(raw, "detectedRawLanguage", "detected_raw_language"), "unknown"),
      textLength: toNumber(read(raw, "textLength", "text_length"), 0),
    };
  }

  async listArticles(limit = 20, cursor?: string): Promise<ArticleListResult> {
    const search = new URLSearchParams();
    search.set("limit", String(limit));
    if (cursor) {
      search.set("cursor", cursor);
    }
    const raw = (await getJSON<AnyRecord>(`/articles?${search.toString()}`)) as AnyRecord;
    const rawItems = (read(raw, "items", "items") as AnyRecord[]) ?? [];
    return {
      items: rawItems.map((item) => ({
        articleId: toString(read(item, "articleId", "article_id"), ""),
        title: toString(read(item, "title", "title"), ""),
        language: toString(read(item, "language", "language"), "ja") as ArticleLanguage,
        segmentCount: toNumber(read(item, "segmentCount", "segment_count"), 0),
        createdAt: toString(read(item, "createdAt", "created_at"), ""),
      })),
      nextCursor: (() => {
        const value = read(raw, "nextCursor", "next_cursor");
        if (typeof value === "string" && value.length > 0) return value;
        return undefined;
      })(),
    };
  }

  async getHomeSummary(): Promise<HomeSummary> {
    const raw = (await getJSON<AnyRecord>("/api/home-summary")) as AnyRecord;
    return {
      targetSegments: toNumber(read(raw, "targetSegments", "target_segments"), 0),
      completedSegments: toNumber(read(raw, "completedSegments", "completed_segments"), 0),
      language: (read(raw, "language", "language") as HomeSummary["language"]) ?? "ja",
      draftText: toString(read(raw, "draftText", "draft_text"), ""),
    };
  }

  async getPracticeBundle(docId?: string, segmentId?: string): Promise<PracticeBundle> {
    const search = new URLSearchParams();
    if (docId) search.set("docId", docId);
    if (segmentId) search.set("segmentId", segmentId);
    const query = search.size ? `?${search.toString()}` : "";
    const raw = (await getJSON<AnyRecord>(`/api/practice-bundle${query}`)) as AnyRecord;
    const rawSegments = (read(raw, "segments", "segments") as AnyRecord[]) ?? [];
    const rawPreRecord = (read(raw, "preRecord", "pre_record") as AnyRecord) ?? {};
    const rawTokens = (read(rawPreRecord, "tokens", "tokens") as AnyRecord[]) ?? [];
    const rawResult = (read(raw, "result", "result") as AnyRecord) ?? {};
    const rawBlocks = (read(rawResult, "blocks", "blocks") as AnyRecord[]) ?? [];

    return {
      articleId: toString(read(raw, "articleId", "article_id"), ""),
      segmentId: toString(read(raw, "segmentId", "segment_id"), ""),
      title: toString(read(raw, "title", "title"), ""),
      segments: rawSegments.map((segment) => ({
        id: toString(read(segment, "id", "id"), ""),
        label: toString(read(segment, "label", "label"), ""),
        progressRate: toNumber(read(segment, "progressRate", "progress_rate"), 0),
      })),
      preRecord: {
        level: toNumber(read(rawPreRecord, "level", "level"), 0),
        maskRatio: toNumber(read(rawPreRecord, "maskRatio", "mask_ratio"), 0),
        tokens: rawTokens.map((token) => ({
          text: toString(read(token, "text", "text"), ""),
          hidden: Boolean(read(token, "hidden", "hidden")),
        })),
      },
      result: {
        blocks: rawBlocks.map((block) => ({
          id: toString(read(block, "id", "id"), ""),
          reference: ((read(block, "reference", "reference") as AnyRecord[]) ?? []).map((token) => ({
            text: toString(read(token, "text", "text"), ""),
            diff: toDiffKind(read(token, "diff", "diff")),
          })),
          recognized: ((read(block, "recognized", "recognized") as AnyRecord[]) ?? []).map((token) => ({
            text: toString(read(token, "text", "text"), ""),
            diff: toDiffKind(read(token, "diff", "diff")),
          })),
        })),
      },
    };
  }

  async submitRecognition(docId?: string, segmentId?: string): Promise<PracticeResultData> {
    return postJSON<PracticeResultData, { docId?: string; segmentId?: string }>(
      "/api/practice-recognition",
      {
        docId,
        segmentId,
      },
    );
  }

  async getProgressSummary(): Promise<ProgressSummary> {
    const raw = (await getJSON<AnyRecord>("/api/progress-summary")) as AnyRecord;
    const rawHotWords = (read(raw, "hotWords", "hot_words") as AnyRecord[]) ?? [];
    return {
      accuracyRate: toNumber(read(raw, "accuracyRate", "accuracy_rate"), 0),
      currentLevel: toNumber(read(raw, "currentLevel", "current_level"), 0),
      hotWords: rawHotWords.map((word) => ({
        word: toString(read(word, "word", "word"), ""),
        kind: toDiffKind(read(word, "kind", "kind")) ?? "substitute",
        count: toNumber(read(word, "count", "count"), 0),
      })),
    };
  }

  async getMeSummary(): Promise<MeSummary> {
    const raw = (await getJSON<AnyRecord>("/api/me-summary")) as AnyRecord;
    const rawHistoryDocs = (read(raw, "historyDocs", "history_docs") as AnyRecord[]) ?? [];
    return {
      email: toString(read(raw, "email", "email"), ""),
      streakDays: toNumber(read(raw, "streakDays", "streak_days"), 0),
      historyDocs: rawHistoryDocs.map((doc) => ({
        id: toString(read(doc, "id", "id"), ""),
        title: toString(read(doc, "title", "title"), ""),
        lastPracticedAt: toString(read(doc, "lastPracticedAt", "last_practiced_at"), ""),
        level: toNumber(read(doc, "level", "level"), 0),
        progressRate: toNumber(read(doc, "progressRate", "progress_rate"), 0),
      })),
    };
  }
}
