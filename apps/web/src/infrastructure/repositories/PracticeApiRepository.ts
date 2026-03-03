import type {
  DiffKind,
  HomeSummary,
  MeSummary,
  PracticeBundle,
  PracticeResultData,
  ProgressSummary,
} from "../../domain/practice/entities";
import type { PracticeRepository } from "../../application/ports/PracticeRepository";
import { getJSON, postJSON } from "../http/httpClient";

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
