import api from './api'
import type { Article, ApiResponse } from '../types'

// Convert snake_case to camelCase
function toCamelCase<T>(obj: any): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item)) as T
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      acc[camelKey] = toCamelCase(obj[key])
      return acc
    }, {} as any) as T
  }
  return obj
}

export const articleService = {
  async createArticle(data: { text: string; language: string }): Promise<Article> {
    const response = await api.post<ApiResponse<any>>('/bff/v1/articles', data)
    return toCamelCase<Article>(response.data.data)
  },

  async getArticle(id: string): Promise<Article> {
    const response = await api.get<ApiResponse<any>>(`/bff/v1/articles/${id}`)
    return toCamelCase<Article>(response.data.data)
  },

  async listArticles(): Promise<Article[]> {
    const response = await api.get<ApiResponse<any[]>>('/bff/v1/articles')
    return toCamelCase<Article[]>(response.data.data)
  },
}
