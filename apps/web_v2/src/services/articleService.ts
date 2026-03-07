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

export type ArticleLanguage = 'ja' | 'en' | 'zh'

export interface CreateArticlePayload {
  title: string
  language: ArticleLanguage
  text: string
}

export interface CreateArticleResult {
  articleId: string
  title: string
  language: ArticleLanguage
  detectedLanguage: string
  detectedConfidence?: number | null
  detectedReliable: boolean
  detectedRawLanguage: string
  segments: Array<{
    id: string
    order: number
    preview: string
  }>
}

export interface UploadParseResult {
  text: string
  sourceType: 'upload' | 'ocr'
  detectedLanguage: string
  detectedConfidence?: number | null
  detectedReliable: boolean
  detectedRawLanguage: string
  textLength: number
}

export const articleService = {
  async createArticle(data: CreateArticlePayload): Promise<CreateArticleResult> {
    const response = await api.post('/bff/v1/articles', {
      title: data.title,
      language: data.language,
      text: data.text,
    })
    return toCamelCase<CreateArticleResult>(response.data)
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

  async parseUploadFile(file: File, language?: string): Promise<UploadParseResult> {
    const formData = new FormData()
    formData.append('file', file)
    if (language) {
      formData.append('language', language)
    }
    const response = await api.post('/bff/v1/articles/parse-upload', formData)
    return toCamelCase<UploadParseResult>(response.data)
  },
}
