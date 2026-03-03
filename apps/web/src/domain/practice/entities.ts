export type DiffKind = "correct" | "missing" | "insert" | "substitute";

export interface HomeSummary {
  targetSegments: number;
  completedSegments: number;
  language: "ja" | "en" | "zh";
  draftText: string;
}

export interface MaskedToken {
  text: string;
  hidden: boolean;
}

export interface PracticePreRecordData {
  level: number;
  maskRatio: number;
  tokens: MaskedToken[];
}

export interface CompareToken {
  text: string;
  diff?: DiffKind;
}

export interface CompareBlock {
  id: string;
  reference: CompareToken[];
  recognized: CompareToken[];
}

export interface PracticeResultData {
  blocks: CompareBlock[];
}

export interface PracticeSegmentOption {
  id: string;
  label: string;
  progressRate: number;
}

export interface PracticeBundle {
  articleId: string;
  segmentId: string;
  title: string;
  segments: PracticeSegmentOption[];
  preRecord: PracticePreRecordData;
  result: PracticeResultData;
}

export interface HotWord {
  word: string;
  kind: DiffKind;
  count: number;
}

export interface ProgressSummary {
  accuracyRate: number;
  currentLevel: number;
  hotWords: HotWord[];
}

export interface HistoryDoc {
  id: string;
  title: string;
  lastPracticedAt: string;
  level: number;
  progressRate: number;
}

export interface MeSummary {
  email: string;
  streakDays: number;
  historyDocs: HistoryDoc[];
}
