import type {
  HomeSummary,
  MeSummary,
  PracticeBundle,
  PracticeResultData,
  PracticeSegmentOption,
  ProgressSummary,
} from "../domain/practice/entities";
import type {
  ArticleCreateResult,
  ArticleLanguage,
  ArticleListResult,
  ArticleSourceType,
} from "../domain/article/entities";

export const homeSummary: HomeSummary = {
  targetSegments: 3,
  completedSegments: 1,
  language: "ja",
  draftText: "春は、あけぼの。やうやう白くなりゆく山ぎは。",
};

type SegmentBundle = Omit<PracticeBundle, "articleId" | "title" | "segments">;
interface PracticeDocData {
  articleId: string;
  title: string;
  segments: PracticeSegmentOption[];
  bundles: Record<string, SegmentBundle>;
  defaultSegmentId: string;
}

const practiceDocs: Record<string, PracticeDocData> = {
  "doc-ja": {
    articleId: "doc-ja",
    title: "枕草子（春は、あけぼの）",
    defaultSegmentId: "seg-01",
    segments: [
      { id: "seg-01", label: "段落 01", progressRate: 92 },
      { id: "seg-02", label: "段落 02", progressRate: 76 },
      { id: "seg-03", label: "段落 03", progressRate: 60 },
    ],
    bundles: {
      "seg-01": {
        segmentId: "seg-01",
        preRecord: {
          level: 1,
          maskRatio: 0.2,
          tokens: [
            { text: "春は、", hidden: false },
            { text: "あけぼの", hidden: true },
            { text: "。", hidden: false },
          ],
        },
        result: {
          blocks: [
            {
              id: "ja-1",
              reference: [
                { text: "春は、", diff: "correct" },
                { text: "あけぼの", diff: "missing" },
                { text: "。", diff: "correct" },
              ],
              recognized: [
                { text: "春は、", diff: "correct" },
                { text: "えっと", diff: "insert" },
                { text: "。", diff: "correct" },
              ],
            },
          ],
        },
      },
      "seg-02": {
        segmentId: "seg-02",
        preRecord: {
          level: 2,
          maskRatio: 0.4,
          tokens: [
            { text: "やうやう", hidden: false },
            { text: "白く", hidden: false },
            { text: "なりゆく", hidden: true },
            { text: "山ぎは。", hidden: false },
          ],
        },
        result: {
          blocks: [
            {
              id: "ja-2",
              reference: [
                { text: "やうやう", diff: "correct" },
                { text: "白く", diff: "correct" },
                { text: "なりゆく", diff: "substitute" },
              ],
              recognized: [
                { text: "やうやう", diff: "correct" },
                { text: "白く", diff: "correct" },
                { text: "なるゆく", diff: "substitute" },
              ],
            },
          ],
        },
      },
      "seg-03": {
        segmentId: "seg-03",
        preRecord: {
          level: 3,
          maskRatio: 0.7,
          tokens: [
            { text: "少しあかりて、", hidden: false },
            { text: "紫だちたる雲の", hidden: true },
            { text: "細くたなびきたる。", hidden: true },
          ],
        },
        result: {
          blocks: [
            {
              id: "ja-3",
              reference: [
                { text: "少しあかりて、", diff: "correct" },
                { text: "紫だちたる雲の", diff: "missing" },
                { text: "細くたなびきたる。", diff: "substitute" },
              ],
              recognized: [
                { text: "少しあかりて、", diff: "correct" },
                { text: "えー", diff: "insert" },
                { text: "細くたなびいた。", diff: "substitute" },
              ],
            },
          ],
        },
      },
    },
  },
  "doc-en": {
    articleId: "doc-en",
    title: "The Road Not Taken",
    defaultSegmentId: "seg-01",
    segments: [
      { id: "seg-01", label: "Stanza 01", progressRate: 50 },
      { id: "seg-02", label: "Stanza 02", progressRate: 35 },
    ],
    bundles: {
      "seg-01": {
        segmentId: "seg-01",
        preRecord: {
          level: 1,
          maskRatio: 0.2,
          tokens: [
            { text: "Two roads diverged", hidden: false },
            { text: "in a yellow wood,", hidden: true },
          ],
        },
        result: {
          blocks: [
            {
              id: "en-1",
              reference: [
                { text: "Two roads diverged", diff: "correct" },
                { text: "in a yellow wood,", diff: "substitute" },
              ],
              recognized: [
                { text: "Two roads diverged", diff: "correct" },
                { text: "in yellow woods,", diff: "substitute" },
              ],
            },
          ],
        },
      },
      "seg-02": {
        segmentId: "seg-02",
        preRecord: {
          level: 2,
          maskRatio: 0.4,
          tokens: [
            { text: "And sorry I could not travel both", hidden: false },
            { text: "And be one traveler", hidden: true },
          ],
        },
        result: {
          blocks: [
            {
              id: "en-2",
              reference: [
                { text: "And sorry I could not travel both", diff: "correct" },
                { text: "And be one traveler", diff: "missing" },
              ],
              recognized: [
                { text: "And sorry I could not travel both", diff: "correct" },
                { text: "and be traveler", diff: "insert" },
              ],
            },
          ],
        },
      },
    },
  },
  "doc-zh": {
    articleId: "doc-zh",
    title: "出师表（前段）",
    defaultSegmentId: "seg-04",
    segments: [
      { id: "seg-04", label: "段落 04", progressRate: 88 },
      { id: "seg-05", label: "段落 05", progressRate: 82 },
    ],
    bundles: {
      "seg-04": {
        segmentId: "seg-04",
        preRecord: {
          level: 2,
          maskRatio: 0.4,
          tokens: [
            { text: "先帝创业未半", hidden: false },
            { text: "而中道崩殂", hidden: true },
          ],
        },
        result: {
          blocks: [
            {
              id: "zh-1",
              reference: [
                { text: "先帝创业未半", diff: "correct" },
                { text: "而中道崩殂", diff: "missing" },
              ],
              recognized: [
                { text: "先帝创业未半", diff: "correct" },
                { text: "而中道", diff: "insert" },
              ],
            },
          ],
        },
      },
      "seg-05": {
        segmentId: "seg-05",
        preRecord: {
          level: 3,
          maskRatio: 0.7,
          tokens: [
            { text: "今天下三分", hidden: true },
            { text: "益州疲弊", hidden: true },
          ],
        },
        result: {
          blocks: [
            {
              id: "zh-2",
              reference: [
                { text: "今天下三分", diff: "substitute" },
                { text: "益州疲弊", diff: "correct" },
              ],
              recognized: [
                { text: "今日天下三分", diff: "substitute" },
                { text: "益州疲弊", diff: "correct" },
              ],
            },
          ],
        },
      },
    },
  },
};

export const progressSummary: ProgressSummary = {
  accuracyRate: 88,
  currentLevel: 3,
  hotWords: [
    { word: "あけぼの", kind: "missing", count: 6 },
    { word: "なりゆく", kind: "substitute", count: 4 },
    { word: "山ぎは", kind: "insert", count: 3 },
  ],
};

export const meSummary: MeSummary = {
  email: "you@example.com",
  streakDays: 5,
  historyDocs: [
    {
      id: "doc-ja",
      title: "枕草子（春は、あけぼの）",
      lastPracticedAt: "今天 09:40",
      level: 2,
      progressRate: 60,
    },
    {
      id: "doc-en",
      title: "The Road Not Taken",
      lastPracticedAt: "昨天 21:10",
      level: 1,
      progressRate: 35,
    },
    {
      id: "doc-zh",
      title: "出师表（前段）",
      lastPracticedAt: "2 天前",
      level: 3,
      progressRate: 82,
    },
  ],
};

const resolveDoc = (docId?: string): PracticeDocData => {
  if (!docId) return practiceDocs["doc-ja"];
  return practiceDocs[docId] ?? practiceDocs["doc-ja"];
};

const resolveSegmentId = (doc: PracticeDocData, segmentId?: string): string => {
  if (segmentId && doc.bundles[segmentId]) return segmentId;
  return doc.defaultSegmentId;
};

export const getPracticeBundleByDocIdAndSegmentId = (
  docId?: string,
  segmentId?: string,
): PracticeBundle => {
  const doc = resolveDoc(docId);
  const actualSegmentId = resolveSegmentId(doc, segmentId);
  const bundle = doc.bundles[actualSegmentId];

  return {
    articleId: doc.articleId,
    segmentId: actualSegmentId,
    title: doc.title,
    segments: doc.segments,
    preRecord: bundle.preRecord,
    result: bundle.result,
  };
};

export const getPracticeResultByDocIdAndSegmentId = (
  docId?: string,
  segmentId?: string,
): PracticeResultData => {
  return getPracticeBundleByDocIdAndSegmentId(docId, segmentId).result;
};

let articleCounter = 3;

const articleStore: Array<{
  article_id: string;
  title: string;
  language: ArticleLanguage;
  segment_count: number;
  created_at: string;
}> = [
  {
    article_id: "art_mock_001",
    title: "Mock Japanese Article",
    language: "ja",
    segment_count: 3,
    created_at: "2026-03-03T09:40:00Z",
  },
  {
    article_id: "art_mock_002",
    title: "Mock English Article",
    language: "en",
    segment_count: 2,
    created_at: "2026-03-02T18:20:00Z",
  },
];

const splitMockSegments = (text: string): string[] => {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];
  return normalized
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

export const createMockArticle = (input: {
  title: string;
  language: ArticleLanguage;
  sourceType: ArticleSourceType;
  text: string;
}): ArticleCreateResult => {
  const articleId = `art_mock_${String(articleCounter).padStart(3, "0")}`;
  articleCounter += 1;

  const segments = splitMockSegments(input.text);
  const safeSegments = segments.length > 0 ? segments : [input.text.trim() || "(empty)"];
  const now = new Date().toISOString();

  articleStore.unshift({
    article_id: articleId,
    title: input.title,
    language: input.language,
    segment_count: safeSegments.length,
    created_at: now,
  });

  return {
    articleId,
    title: input.title,
    language: input.language,
    segments: safeSegments.map((segment, index) => ({
      id: `seg_mock_${articleId}_${index + 1}`,
      order: index + 1,
      preview: segment.length > 40 ? `${segment.slice(0, 40)}...` : segment,
    })),
  };
};

export const listMockArticles = (limit = 20): ArticleListResult => {
  return {
    items: articleStore.slice(0, limit).map((item) => ({
      articleId: item.article_id,
      title: item.title,
      language: item.language,
      segmentCount: item.segment_count,
      createdAt: item.created_at,
    })),
  };
};
