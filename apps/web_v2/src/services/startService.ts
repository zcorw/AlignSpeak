import api from './api'

export interface StartHistoryDoc {
  id: string
  title: string
  lastPracticedAt: string | null
  level: number
  progressRate: number
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
    lastPracticedAt?: string
    level?: number
    progressRate?: number
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
      return {
        id,
        title,
        lastPracticedAt: typeof item.lastPracticedAt === 'string' && item.lastPracticedAt ? item.lastPracticedAt : null,
        level: typeof item.level === 'number' && item.level > 0 ? Math.round(item.level) : 1,
        progressRate: normalizeRate(item.progressRate),
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
