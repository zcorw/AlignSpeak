import api from './api'

export interface StartHistoryDoc {
  id: string
  title: string
  language: 'ja' | 'en' | 'zh' | 'unknown'
  lastPracticedAt: string | null
  level: number
  progressRate: number
  totalSegments: number
  passedSegments: number
  currentSegmentOrder: number
  practiceCount: number
  isDone: boolean
}

export interface StartOverview {
  email: string
  streakDays: number
  overallAccuracy30d: number
  currentLevel: number
  historyDocs: StartHistoryDoc[]
}

interface BffMeResponse {
  email?: string
  streakDays?: number
  progress?: {
    overallAccuracy30d?: number
    currentLevel?: number
  }
  historyDocs?: Array<{
    id?: string
    title?: string
    language?: string
    lastPracticedAt?: string
    level?: number
    progressRate?: number
    totalSegments?: number
    passedSegments?: number
    currentSegmentOrder?: number
    practiceCount?: number
    isDone?: boolean
  }>
}

const normalizeRate = (value: unknown): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  if (value <= 1) return Math.max(0, Math.min(1, value))
  return Math.max(0, Math.min(1, value / 100))
}

const normalizeHistoryDocs = (docs: BffMeResponse['historyDocs']): StartHistoryDoc[] => {
  if (!Array.isArray(docs)) return []
  return docs
    .map((item) => {
      const id = typeof item?.id === 'string' ? item.id.trim() : ''
      const title = typeof item?.title === 'string' ? item.title.trim() : ''
      if (!id || !title) return null
      const languageRaw = typeof item.language === 'string' ? item.language.trim().toLowerCase() : ''
      const language = languageRaw === 'en' || languageRaw === 'zh' || languageRaw === 'ja' ? languageRaw : 'unknown'
      const totalSegments =
        typeof item.totalSegments === 'number' && item.totalSegments > 0 ? Math.round(item.totalSegments) : 0
      const passedSegmentsRaw =
        typeof item.passedSegments === 'number' && item.passedSegments >= 0 ? Math.round(item.passedSegments) : 0
      const passedSegments = totalSegments > 0 ? Math.min(totalSegments, passedSegmentsRaw) : 0
      const currentSegmentOrderRaw =
        typeof item.currentSegmentOrder === 'number' && item.currentSegmentOrder > 0
          ? Math.round(item.currentSegmentOrder)
          : passedSegments + 1
      const currentSegmentOrder = totalSegments > 0 ? Math.min(totalSegments, currentSegmentOrderRaw) : 1

      return {
        id,
        title,
        language,
        lastPracticedAt: typeof item.lastPracticedAt === 'string' && item.lastPracticedAt ? item.lastPracticedAt : null,
        level: typeof item.level === 'number' && item.level > 0 ? Math.round(item.level) : 1,
        progressRate: normalizeRate(item.progressRate),
        totalSegments,
        passedSegments,
        currentSegmentOrder,
        practiceCount: typeof item.practiceCount === 'number' && item.practiceCount >= 0 ? Math.round(item.practiceCount) : 0,
        isDone:
          typeof item.isDone === 'boolean'
            ? item.isDone
            : totalSegments > 0 && passedSegments >= totalSegments,
      } satisfies StartHistoryDoc
    })
    .filter((item): item is StartHistoryDoc => item !== null)
}

export const startService = {
  async getOverview(): Promise<StartOverview> {
    const response = await api.get<BffMeResponse>('/bff/v1/me')
    const payload = response.data
    return {
      email: typeof payload.email === 'string' ? payload.email : '',
      streakDays: typeof payload.streakDays === 'number' ? payload.streakDays : 0,
      overallAccuracy30d: normalizeRate(payload.progress?.overallAccuracy30d),
      currentLevel: typeof payload.progress?.currentLevel === 'number' && payload.progress.currentLevel > 0
        ? Math.round(payload.progress.currentLevel)
        : 1,
      historyDocs: normalizeHistoryDocs(payload.historyDocs),
    }
  },
}
