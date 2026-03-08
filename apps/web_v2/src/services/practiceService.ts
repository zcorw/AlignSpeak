import api from './api'

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike }

function toCamelCase<T>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item)) as T
  }
  if (obj !== null && typeof obj === 'object') {
    const record = obj as Record<string, JsonLike>
    const converted = Object.keys(record).reduce<Record<string, unknown>>((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      acc[camelKey] = toCamelCase(record[key])
      return acc
    }, {})
    return converted as T
  }
  return obj as T
}

export type PracticeLanguage = 'ja' | 'en' | 'zh'
export type PracticeProgressCellState = 'pass' | 'current' | 'skip' | 'fail'
export type PracticeLevel = 'L1' | 'L2' | 'L3' | 'L4'

export interface PracticeReadingToken {
  surface: string
  yomi?: string | null
}

export interface PracticeSegment {
  id: string
  order: number
  plainText: string
  tokenCount: number
  tokens?: PracticeReadingToken[]
}

export interface PracticeArticleDetail {
  articleId: string
  title: string
  language: PracticeLanguage
  segments: PracticeSegment[]
}

export interface PracticeArticleProgress {
  articleId: string
  totalSegments: number
  passThreshold: number
  currentLevel: PracticeLevel
  matrix: Record<PracticeLevel, PracticeProgressCellState[]>
  recentScores: number[]
}

interface BffMeResponse {
  historyDocs?: Array<{ id?: string }>
  history_docs?: Array<{ id?: string }>
}

interface RawPracticeProgressLevel {
  level?: string
  cells?: Array<{
    segmentOrder?: number
    state?: string
  }>
}

interface RawPracticeArticleProgress {
  articleId?: string
  totalSegments?: number
  passThreshold?: number
  currentLevel?: string
  levels?: RawPracticeProgressLevel[]
  recentScores?: number[]
}

const LEVELS: PracticeLevel[] = ['L1', 'L2', 'L3', 'L4']

const toValidCellState = (value: string | undefined): PracticeProgressCellState => {
  if (value === 'pass' || value === 'current' || value === 'skip' || value === 'fail') return value
  return 'fail'
}

const toValidLevel = (value: string | undefined): PracticeLevel => {
  if (value === 'L1' || value === 'L2' || value === 'L3' || value === 'L4') return value
  return 'L1'
}

const createEmptyMatrix = (size: number): Record<PracticeLevel, PracticeProgressCellState[]> =>
  LEVELS.reduce(
    (acc, level) => {
      acc[level] = Array.from({ length: Math.max(size, 0) }, () => 'fail')
      return acc
    },
    {} as Record<PracticeLevel, PracticeProgressCellState[]>
  )

export const practiceService = {
  async resolveArticleId(preferredId?: string | null): Promise<string | null> {
    const trimmedPreferred = preferredId?.trim()
    if (trimmedPreferred) return trimmedPreferred

    const sessionArticleId = sessionStorage.getItem('article_id')?.trim()
    if (sessionArticleId) return sessionArticleId

    const response = await api.get<BffMeResponse>('/bff/v1/me')
    const historyDocs = response.data.historyDocs ?? response.data.history_docs ?? []
    const first = historyDocs.find((item) => typeof item?.id === 'string' && item.id.trim().length > 0)
    return first?.id?.trim() ?? null
  },

  async getPracticeArticle(articleId: string): Promise<PracticeArticleDetail> {
    const response = await api.get(`/bff/v1/articles/${articleId}`, {
      params: { include_reading: true },
    })
    return toCamelCase<PracticeArticleDetail>(response.data)
  },

  async getArticleProgress(
    articleId: string,
    options?: {
      level?: PracticeLevel
      currentSegmentOrder?: number
    }
  ): Promise<PracticeArticleProgress> {
    const response = await api.get(`/practice/articles/${articleId}/progress`, {
      params: {
        level: options?.level,
        current_segment_order: options?.currentSegmentOrder,
      },
    })
    const payload = toCamelCase<RawPracticeArticleProgress>(response.data)
    const totalSegments =
      typeof payload.totalSegments === 'number' && payload.totalSegments >= 0 ? Math.floor(payload.totalSegments) : 0
    const matrix = createEmptyMatrix(totalSegments)
    const levels = Array.isArray(payload.levels) ? payload.levels : []
    for (const item of levels) {
      const level = toValidLevel(item.level)
      const cells = Array.isArray(item.cells) ? item.cells : []
      matrix[level] = cells.map((cell) => toValidCellState(cell.state))
    }
    return {
      articleId: typeof payload.articleId === 'string' ? payload.articleId : articleId,
      totalSegments,
      passThreshold: typeof payload.passThreshold === 'number' ? payload.passThreshold : 85,
      currentLevel: toValidLevel(payload.currentLevel),
      matrix,
      recentScores: Array.isArray(payload.recentScores)
        ? payload.recentScores
          .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
          .map((score) => Math.max(0, Math.min(100, Math.round(score))))
        : [],
    }
  },
}
