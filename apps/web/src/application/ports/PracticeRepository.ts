import type {
  HomeSummary,
  MeSummary,
  PracticeBundle,
  PracticeResultData,
  ProgressSummary,
} from "../../domain/practice/entities";

export interface PracticeRepository {
  getHomeSummary(): Promise<HomeSummary>;
  getPracticeBundle(docId?: string, segmentId?: string): Promise<PracticeBundle>;
  submitRecognition(docId?: string, segmentId?: string): Promise<PracticeResultData>;
  getProgressSummary(): Promise<ProgressSummary>;
  getMeSummary(): Promise<MeSummary>;
}
