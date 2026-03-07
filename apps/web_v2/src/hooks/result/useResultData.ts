import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PracticeMatrix } from '../../components/practice/shared'
import { createFallbackMatrix, parseLevelFromQuery } from '../../components/result/shared'
import { getApiErrorMessage } from '../../services/authService'
import { practiceService } from '../../services/practiceService'
import { resultService, type AttemptResultDetail } from '../../services/resultService'

interface UseResultDataResult {
  level: ReturnType<typeof parseLevelFromQuery>
  loading: boolean
  error: string | null
  detail: AttemptResultDetail | null
  matrix: PracticeMatrix
  matrixLoading: boolean
}

export const useResultData = (searchParams: URLSearchParams): UseResultDataResult => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<AttemptResultDetail | null>(null)
  const [matrix, setMatrix] = useState<PracticeMatrix>(createFallbackMatrix(0, 'L1', 1))
  const [matrixLoading, setMatrixLoading] = useState(false)

  const level = parseLevelFromQuery(searchParams.get('lv'))
  const queryAttemptId = searchParams.get('attempt')?.trim() ?? ''
  const queryArticleId = searchParams.get('a')?.trim() ?? ''
  const querySegment = Number.parseInt(searchParams.get('seg') ?? '', 10)

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const fallbackAttemptId = sessionStorage.getItem('last_attempt_id')?.trim() ?? ''
        const resolvedAttemptId = queryAttemptId || fallbackAttemptId
        if (!resolvedAttemptId) {
          throw new Error('Missing attempt id.')
        }

        const attemptDetail = await resultService.getAttemptResult(resolvedAttemptId)
        if (!active) return
        setDetail(attemptDetail)
        sessionStorage.setItem('article_id', attemptDetail.articleId)
      } catch (loadError: unknown) {
        if (!active) return
        setError(getApiErrorMessage(loadError, t('common.error')))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [queryAttemptId, t])

  useEffect(() => {
    let active = true
    const articleId = detail?.articleId || queryArticleId
    const segmentOrder = detail?.segmentOrder ?? (Number.isFinite(querySegment) ? querySegment : 1)
    const totalSegments = detail?.totalSegments ?? 0
    if (!articleId) {
      setMatrix(createFallbackMatrix(totalSegments, level, segmentOrder))
      return () => {
        active = false
      }
    }

    const loadProgress = async () => {
      setMatrixLoading(true)
      try {
        const progress = await practiceService.getArticleProgress(articleId, {
          level,
          currentSegmentOrder: segmentOrder,
        })
        if (!active) return
        setMatrix(progress.matrix)
      } catch {
        if (!active) return
        setMatrix(createFallbackMatrix(totalSegments, level, segmentOrder))
      } finally {
        if (active) setMatrixLoading(false)
      }
    }

    void loadProgress()
    return () => {
      active = false
    }
  }, [detail, level, queryArticleId, querySegment])

  return {
    level,
    loading,
    error,
    detail,
    matrix,
    matrixLoading,
  }
}

