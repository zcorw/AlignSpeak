import type { PracticeRepository } from "../ports/PracticeRepository";

export const createAppUseCases = (repository: PracticeRepository) => {
  return {
    loadHomeSummary: () => repository.getHomeSummary(),
    loadPracticeBundle: (docId?: string, segmentId?: string) =>
      repository.getPracticeBundle(docId, segmentId),
    submitRecognition: (docId?: string, segmentId?: string) =>
      repository.submitRecognition(docId, segmentId),
    loadProgressSummary: () => repository.getProgressSummary(),
    loadMeSummary: () => repository.getMeSummary(),
  };
};

export type AppUseCases = ReturnType<typeof createAppUseCases>;
