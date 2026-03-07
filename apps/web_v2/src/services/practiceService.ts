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

interface BffMeResponse {
  historyDocs?: Array<{ id?: string }>
  history_docs?: Array<{ id?: string }>
}

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
}
