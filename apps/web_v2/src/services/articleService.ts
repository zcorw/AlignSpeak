import api from './api'
import type { Article, ApiResponse } from '../types'

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike }

// Convert snake_case to camelCase
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

export interface DetectLanguageResult {
  detectedLanguage: 'ja' | 'en' | 'zh' | 'unknown'
  detectedConfidence?: number | null
  detectedReliable: boolean
  detectedRawLanguage: string
  textLength: number
}

export const articleService = {
  async createArticle(data: { text: string; language: string }): Promise<Article> {
    const response = await api.post<ApiResponse<unknown>>('/bff/v1/articles', data)
    return toCamelCase<Article>(response.data.data)
  },

  async getArticle(id: string): Promise<Article> {
    const response = await api.get<ApiResponse<unknown>>(`/bff/v1/articles/${id}`)
    return toCamelCase<Article>(response.data.data)
  },

  async listArticles(): Promise<Article[]> {
    const response = await api.get<ApiResponse<unknown>>('/bff/v1/articles')
    return toCamelCase<Article[]>(response.data.data)
  },

  async detectLanguage(text: string): Promise<DetectLanguageResult> {
    const response = await api.post('/bff/v1/articles/detect-language', { text })
    return toCamelCase<DetectLanguageResult>(response.data)
  },
}
