import api from './api'

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

export interface ArticleDetailToken {
  surface: string
  yomi?: string | null
}

export interface ArticleDetailSegment {
  id: string
  order: number
  plainText: string
  tokenCount: number
  tokens?: ArticleDetailToken[] | null
}

export interface ArticleDetailResult {
  articleId: string
  title: string
  language: ArticleLanguage
  sourceType: string
  rawText: string
  normalizedText: string
  segments: ArticleDetailSegment[]
  createdAt: string
}

export interface ArticleListItem {
  articleId: string
  title: string
  language: ArticleLanguage | string
  segmentCount: number
  createdAt: string
}

export interface ArticleListResult {
  items: ArticleListItem[]
  nextCursor?: string | null
}

export interface UpdateArticlePayload {
  title?: string
  language?: ArticleLanguage
  text?: string
}

export interface UpdateArticleResult {
  articleId: string
  title: string
  language: ArticleLanguage
  segmentCount: number
  textUpdated: boolean
  updatedAt: string
}

export interface DeleteArticleResult {
  articleId: string
  deletedAt: string
  status: 'deleted'
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

export interface UploadBatchUncertainPair {
  left: string
  right: string
  confidence?: number | null
}

export interface UploadBatchOrderSuggestion {
  orderedImageIds: string[]
  overallConfidence?: number | null
  reasoningSignals: string[]
  uncertainPairs: UploadBatchUncertainPair[]
  warnings: string[]
  fallbackUsed: boolean
}

export interface UploadBatchItem {
  imageId: string
  filename: string
  sourceType: 'ocr' | string
  text: string
  textLength: number
  detectedLanguage: string
  detectedConfidence?: number | null
  detectedReliable: boolean
  detectedRawLanguage: string
  pageMarkerCandidates: string[]
  warnings: string[]
  suggestedOrder: number
}

export interface UploadParseBatchResult {
  items: UploadBatchItem[]
  orderSuggestion: UploadBatchOrderSuggestion
  needManualConfirm: boolean
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

  async getArticleDetail(id: string, includeReading = true): Promise<ArticleDetailResult> {
    const response = await api.get(`/bff/v1/articles/${id}`, {
      params: { include_reading: includeReading },
    })
    return toCamelCase<ArticleDetailResult>(response.data)
  },

  async listArticles(limit = 20, cursor?: string): Promise<ArticleListResult> {
    const response = await api.get('/bff/v1/articles', {
      params: { limit, cursor },
    })
    return toCamelCase<ArticleListResult>(response.data)
  },

  async updateArticle(articleId: string, payload: UpdateArticlePayload): Promise<UpdateArticleResult> {
    const response = await api.patch(`/bff/v1/articles/${articleId}`, payload)
    return toCamelCase<UpdateArticleResult>(response.data)
  },

  async deleteArticle(articleId: string): Promise<DeleteArticleResult> {
    const response = await api.delete(`/bff/v1/articles/${articleId}`)
    return toCamelCase<DeleteArticleResult>(response.data)
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
    const response = await api.post('/bff/v1/articles/parse-upload', formData, {
      timeout: 120000,
    })
    return toCamelCase<UploadParseResult>(response.data)
  },

  async parseUploadBatch(files: File[], language?: string): Promise<UploadParseBatchResult> {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    if (language) {
      formData.append('language', language)
    }
    const response = await api.post('/bff/v1/articles/parse-upload-batch', formData, {
      timeout: 300000,
    })
    return toCamelCase<UploadParseBatchResult>(response.data)
  },
}
