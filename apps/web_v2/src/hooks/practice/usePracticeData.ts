import { useEffect, useState } from 'react'
import { PRACTICE_LEVELS, type PracticeMatrix } from '../../components/practice/shared'
import { getApiErrorMessage } from '../../services/authService'
import {
  practiceService,
  type PracticeLanguage,
  type PracticeLevel,
  type PracticeProgressCellState,
  type PracticeSegment,
} from '../../services/practiceService'

type CellState = PracticeProgressCellState

const createFallbackProgressMatrix = (
  totalSegments: number,
  currentLevel: PracticeLevel,
  currentSegmentOrder: number
): PracticeMatrix => {
  const safeTotalSegments = Math.max(totalSegments, 0)
  const matrix = PRACTICE_LEVELS.reduce(
    (acc, level) => {
      acc[level] = Array.from({ length: safeTotalSegments }, () => 'fail')
      return acc
    },
    {} as PracticeMatrix
  )
  if (safeTotalSegments <= 0) return matrix
  const currentIndex = Math.min(Math.max(currentSegmentOrder - 1, 0), safeTotalSegments - 1)
  matrix[currentLevel][currentIndex] = 'current'
  return matrix
}

interface UsePracticeDataOptions {
  level: PracticeLevel
  queryArticleId: string | null
  querySegment: number
  searchKey: string
  progressRefreshVersion: number
  errorMessage: string
}

export const usePracticeData = ({
  level,
  queryArticleId,
  querySegment,
  searchKey,
  progressRefreshVersion,
  errorMessage,
}: UsePracticeDataOptions) => {
  const [articleId, setArticleId] = useState<string | null>(null)
  const [articleTitle, setArticleTitle] = useState('')
  const [articleLanguage, setArticleLanguage] = useState<PracticeLanguage>('en')
  const [segments, setSegments] = useState<PracticeSegment[]>([])
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressMatrix, setProgressMatrix] = useState<PracticeMatrix>(
    createFallbackProgressMatrix(0, level, 1)
  )
  const [trendScores, setTrendScores] = useState<number[]>([])

  const currentSegment = segments[segmentIndex] ?? null
  const totalSegments = segments.length
  const currentSegmentOrder = currentSegment?.order ?? segmentIndex + 1

  useEffect(() => {
    let active = true

    const loadPracticeArticle = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const resolvedArticleId = await practiceService.resolveArticleId(queryArticleId)
        if (!resolvedArticleId) {
          throw new Error('No article available for practice.')
        }

        const practiceArticle = await practiceService.getPracticeArticle(resolvedArticleId)
        if (!active) return

        setArticleId(practiceArticle.articleId)
        setArticleTitle(practiceArticle.title)
        setArticleLanguage(practiceArticle.language)
        setSegments(practiceArticle.segments)
        sessionStorage.setItem('article_id', practiceArticle.articleId)
        sessionStorage.setItem('article_lang', practiceArticle.language)

        const total = practiceArticle.segments.length
        const maxIndex = Math.max(total - 1, 0)
        const matchedByOrder = Number.isFinite(querySegment)
          ? practiceArticle.segments.findIndex((segment) => segment.order === querySegment)
          : -1
        const fallbackIndex = Number.isFinite(querySegment) ? querySegment - 1 : 0
        const resolvedIndex = matchedByOrder >= 0 ? matchedByOrder : Math.min(Math.max(fallbackIndex, 0), maxIndex)
        setSegmentIndex(resolvedIndex)
      } catch (error: unknown) {
        if (!active) return
        setLoadError(getApiErrorMessage(error, errorMessage))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadPracticeArticle()
    return () => {
      active = false
    }
  }, [errorMessage, queryArticleId, querySegment, searchKey])

  useEffect(() => {
    let active = true

    if (!articleId || totalSegments <= 0) {
      setProgressLoading(false)
      setProgressMatrix(createFallbackProgressMatrix(totalSegments, level, currentSegmentOrder))
      return () => {
        active = false
      }
    }

    const loadProgress = async () => {
      setProgressLoading(true)
      try {
        const progress = await practiceService.getArticleProgress(articleId, {
          level,
          currentSegmentOrder,
        })
        if (!active) return
        const resolvedTotalSegments = progress.totalSegments > 0 ? progress.totalSegments : totalSegments
        const fallback = createFallbackProgressMatrix(resolvedTotalSegments, level, currentSegmentOrder)
        const matrix = PRACTICE_LEVELS.reduce(
          (acc, item) => {
            const source = progress.matrix[item]
            acc[item] = Array.isArray(source) && source.length > 0 ? source as CellState[] : fallback[item]
            return acc
          },
          {} as PracticeMatrix
        )
        setProgressMatrix(matrix)
        setTrendScores(progress.recentScores)
      } catch {
        if (!active) return
        setProgressMatrix(createFallbackProgressMatrix(totalSegments, level, currentSegmentOrder))
        setTrendScores([])
      } finally {
        if (active) setProgressLoading(false)
      }
    }

    void loadProgress()
    return () => {
      active = false
    }
  }, [articleId, currentSegmentOrder, level, progressRefreshVersion, totalSegments])

  return {
    articleId,
    articleTitle,
    articleLanguage,
    segments,
    segmentIndex,
    setSegmentIndex,
    loading,
    loadError,
    currentSegment,
    totalSegments,
    currentSegmentOrder,
    progressLoading,
    progressMatrix,
    trendScores,
  }
}
