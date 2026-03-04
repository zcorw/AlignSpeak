import type { PracticeRepository } from "../ports/PracticeRepository";

export const createAppUseCases = (repository: PracticeRepository) => {
  return {
    createArticle: (...args: Parameters<PracticeRepository["createArticle"]>) =>
      repository.createArticle(...args),
    loadArticles: (...args: Parameters<PracticeRepository["listArticles"]>) =>
      repository.listArticles(...args),
    loadPracticeBundle: (docId?: string, segmentId?: string) =>
      repository.getPracticeBundle(docId, segmentId),
    submitRecognition: (docId?: string, segmentId?: string) =>
      repository.submitRecognition(docId, segmentId),
    loadProgressSummary: () => repository.getProgressSummary(),
    loadMeSummary: () => repository.getMeSummary(),
  };
};

export type AppUseCases = ReturnType<typeof createAppUseCases>;
