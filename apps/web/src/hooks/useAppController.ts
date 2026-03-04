import { useCallback, useEffect, useRef, useState } from "react";
import type { AppUseCases } from "../application/usecases/createAppUseCases";
import type {
  MeSummary,
  PracticeBundle,
  PracticeResultData,
  ProgressSummary,
} from "../domain/practice/entities";
import type {
  ArticleCreateInput,
  ArticleCreateResult,
  ArticleLanguageDetectInput,
  ArticleLanguageDetectResult,
  ArticleListItem,
} from "../domain/article/entities";
import { HttpError } from "../infrastructure/http/httpClient";
import { useAppUIState } from "./useAppUIState";

interface UseAppControllerOptions {
  enabled: boolean;
  onUnauthorized: () => void;
  maxAutoRequestAttempts?: number;
}

const resolveErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof HttpError) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
};

export const useAppController = (useCases: AppUseCases, options: UseAppControllerOptions) => {
  const ui = useAppUIState();
  const { enabled, onUnauthorized } = options;
  const maxAutoRequestAttempts = options.maxAutoRequestAttempts ?? 2;

  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [practiceBundle, setPracticeBundle] = useState<PracticeBundle | null>(null);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);
  const [meSummary, setMeSummary] = useState<MeSummary | null>(null);
  const [articleCreating, setArticleCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialAttemptsRef = useRef(0);
  const practiceAttemptsRef = useRef(0);
  const practiceKeyRef = useRef("");
  const onUnauthorizedRef = useRef(onUnauthorized);

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  useEffect(() => {
    if (!enabled) {
      setArticles([]);
      setProgressSummary(null);
      setMeSummary(null);
      setLoading(false);
      initialAttemptsRef.current = 0;
      return;
    }

    if (initialAttemptsRef.current >= maxAutoRequestAttempts) {
      setLoading(false);
      setError("Initial request retry limit reached.");
      return;
    }

    const loadInitial = async () => {
      setLoading(true);
      setError(null);
      initialAttemptsRef.current += 1;
      try {
        const [articleList, progress, me] = await Promise.all([
          useCases.loadArticles(20),
          useCases.loadProgressSummary(),
          useCases.loadMeSummary(),
        ]);
        setArticles(articleList.items);
        setProgressSummary(progress);
        setMeSummary(me);
        initialAttemptsRef.current = 0;
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) {
          onUnauthorizedRef.current();
          return;
        }
        setError(resolveErrorMessage(err, "Failed to load initial data."));
      } finally {
        setLoading(false);
      }
    };

    void loadInitial();
  }, [enabled, maxAutoRequestAttempts, useCases]);

  useEffect(() => {
    if (!enabled) {
      setPracticeBundle(null);
      practiceAttemptsRef.current = 0;
      practiceKeyRef.current = "";
      return;
    }

    const practiceKey = `${ui.selectedDocId ?? ""}::${ui.selectedSegmentId ?? ""}`;
    if (practiceKeyRef.current !== practiceKey) {
      practiceKeyRef.current = practiceKey;
      practiceAttemptsRef.current = 0;
    }

    if (practiceAttemptsRef.current >= maxAutoRequestAttempts) {
      setError("Practice request retry limit reached.");
      return;
    }

    const loadPractice = async () => {
      practiceAttemptsRef.current += 1;
      try {
        const bundle = await useCases.loadPracticeBundle(ui.selectedDocId, ui.selectedSegmentId);
        setPracticeBundle(bundle);
        practiceAttemptsRef.current = 0;
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) {
          onUnauthorizedRef.current();
          return;
        }
        setError(resolveErrorMessage(err, "Failed to load practice content."));
      }
    };

    void loadPractice();
  }, [enabled, maxAutoRequestAttempts, useCases, ui.selectedDocId, ui.selectedSegmentId]);

  const submitRecognition = useCallback(async (): Promise<PracticeResultData> => {
    try {
      return await useCases.submitRecognition(ui.selectedDocId, ui.selectedSegmentId);
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        onUnauthorizedRef.current();
      } else {
        setError(resolveErrorMessage(err, "Failed to submit recognition."));
      }
      throw err;
    }
  }, [ui.selectedDocId, ui.selectedSegmentId, useCases]);

  const createArticle = useCallback(async (input: ArticleCreateInput): Promise<ArticleCreateResult> => {
    setArticleCreating(true);
    setError(null);
    try {
      const created = await useCases.createArticle(input);
      const articleList = await useCases.loadArticles(20);
      setArticles(articleList.items);
      return created;
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        onUnauthorizedRef.current();
      } else {
        setError(resolveErrorMessage(err, "Failed to create article."));
      }
      throw err;
    } finally {
      setArticleCreating(false);
    }
  }, [useCases]);

  const detectArticleLanguage = useCallback(
    async (input: ArticleLanguageDetectInput): Promise<ArticleLanguageDetectResult> => {
      try {
        return await useCases.detectArticleLanguage(input);
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) {
          onUnauthorizedRef.current();
        } else {
          setError(resolveErrorMessage(err, "Failed to detect language."));
        }
        throw err;
      }
    },
    [useCases],
  );

  return {
    ui,
    data: {
      articles,
      practiceBundle,
      progressSummary,
      meSummary,
    },
    actions: {
      createArticle,
      detectArticleLanguage,
      submitRecognition,
    },
    articleCreating,
    loading,
    error,
  };
};
