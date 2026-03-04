import type {
  HomeSummary,
  MeSummary,
  PracticeBundle,
  PracticeResultData,
  ProgressSummary,
} from "../../domain/practice/entities";
import type { ArticleCreateInput, ArticleCreateResult, ArticleListResult } from "../../domain/article/entities";

export interface PracticeRepository {
  createArticle(input: ArticleCreateInput): Promise<ArticleCreateResult>;
  listArticles(limit?: number, cursor?: string): Promise<ArticleListResult>;
  getHomeSummary(): Promise<HomeSummary>;
  getPracticeBundle(docId?: string, segmentId?: string): Promise<PracticeBundle>;
  submitRecognition(docId?: string, segmentId?: string): Promise<PracticeResultData>;
  getProgressSummary(): Promise<ProgressSummary>;
  getMeSummary(): Promise<MeSummary>;
}
