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

export interface ExplainKeyword {
  term: string
  explanation: string
}

export interface ExplainGrammarPoint {
  name: string
  explanation: string
  snippet: string
  example?: string | null
}

export interface ExplainSegmentResult {
  articleId: string
  articleTitle: string
  language: 'ja' | 'en' | 'zh' | string
  segmentOrder: number
  segmentText: string
  summary: string
  keywords: ExplainKeyword[]
  warnings: string[]
}

export interface ExplainGrammarResult {
  articleId: string
  articleTitle: string
  language: 'ja' | 'en' | 'zh' | string
  segmentOrder: number
  sentenceText: string
  grammarPoints: ExplainGrammarPoint[]
  warnings: string[]
}

export type ExplainResponseLanguage = 'ja' | 'en' | 'zh'

export const explainService = {
  async explainSegment(payload: {
    articleId: string
    segmentOrder: number
    responseLanguage?: ExplainResponseLanguage
  }): Promise<ExplainSegmentResult> {
    const response = await api.post('/bff/v1/explain/segment', {
      article_id: payload.articleId,
      segment_order: payload.segmentOrder,
      response_language: payload.responseLanguage,
    })
    return toCamelCase<ExplainSegmentResult>(response.data)
  },

  async explainGrammar(payload: {
    articleId: string
    segmentOrder: number
    sentenceText: string
    responseLanguage?: ExplainResponseLanguage
  }): Promise<ExplainGrammarResult> {
    const response = await api.post('/bff/v1/explain/grammar', {
      article_id: payload.articleId,
      segment_order: payload.segmentOrder,
      sentence_text: payload.sentenceText,
      response_language: payload.responseLanguage,
    })
    return toCamelCase<ExplainGrammarResult>(response.data)
  },
}
