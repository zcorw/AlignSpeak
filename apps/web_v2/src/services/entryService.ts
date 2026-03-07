import axios from 'axios'
import api from './api'

interface BffHistoryDoc {
  id?: string
  progressRate?: number
  lastPracticedAt?: string
}

interface BffMeResponse {
  historyDocs?: BffHistoryDoc[]
}

interface LegacyHistoryDoc {
  id?: string
  progress_rate?: number
  last_practiced_at?: string
}

interface LegacyMeSummaryResponse {
  history_docs?: LegacyHistoryDoc[]
}

const normalizeProgressRate = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  if (value <= 1) return value
  return value / 100
}

const toTimestamp = (value: unknown): number => {
  if (typeof value !== 'string') return Number.NEGATIVE_INFINITY
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts
}

const pickLatestRate = (rates: Array<{ progressRate: number | null; lastPracticedAt: unknown }>): number | null => {
  if (rates.length === 0) return null
  const latest = rates
    .slice()
    .sort((a, b) => toTimestamp(b.lastPracticedAt) - toTimestamp(a.lastPracticedAt))[0]
  return latest?.progressRate ?? null
}

const hasUnfinishedFromBff = (payload: BffMeResponse): boolean | null => {
  if (!Array.isArray(payload.historyDocs)) return null
  const normalized = payload.historyDocs.map((item) => ({
    progressRate: normalizeProgressRate(item.progressRate),
    lastPracticedAt: item.lastPracticedAt,
  }))
  const latestRate = pickLatestRate(normalized)
  if (latestRate === null) return false
  return latestRate < 1
}

const hasUnfinishedFromLegacy = (payload: LegacyMeSummaryResponse): boolean | null => {
  if (!Array.isArray(payload.history_docs)) return null
  const normalized = payload.history_docs.map((item) => ({
    progressRate: normalizeProgressRate(item.progress_rate),
    lastPracticedAt: item.last_practiced_at,
  }))
  const latestRate = pickLatestRate(normalized)
  if (latestRate === null) return false
  return latestRate < 1
}

export const entryService = {
  async hasPreviousUnfinishedArticle(): Promise<boolean> {
    try {
      const bffResponse = await api.get<BffMeResponse>('/bff/v1/me')
      const result = hasUnfinishedFromBff(bffResponse.data)
      if (result !== null) return result
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        throw error
      }
    }

    const legacyResponse = await api.get<LegacyMeSummaryResponse>('/me-summary')
    const fallbackResult = hasUnfinishedFromLegacy(legacyResponse.data)
    return fallbackResult ?? false
  },
}
