import api from './api'
import type { AlignmentStatus } from './practiceAttemptService'

export interface ResultToken {
  text: string
  status: AlignmentStatus
}

export interface AttemptResultDetail {
  attemptId: string
  articleId: string
  articleTitle: string
  segmentId: string
  segmentOrder: number
  totalSegments: number
  attemptCount: number
  accuracyRate: number
  refTokens: ResultToken[]
  hypTokens: ResultToken[]
  correctCount: number
  wrongCount: number
  missedCount: number
  insertedCount: number
}

interface AttemptResultResponse {
  attempt_id: string
  article_id: string
  article_title: string
  segment_id: string
  segment_order: number
  total_segments: number
  attempt_count: number
  accuracy_rate: number
  ref_tokens: ResultToken[]
  hyp_tokens: ResultToken[]
  correct_count: number
  wrong_count: number
  missed_count: number
  inserted_count: number
}

export const resultService = {
  async getAttemptResult(attemptId: string): Promise<AttemptResultDetail> {
    const response = await api.get<AttemptResultResponse>(`/practice/attempts/${attemptId}/result`)
    const payload = response.data
    return {
      attemptId: payload.attempt_id,
      articleId: payload.article_id,
      articleTitle: payload.article_title,
      segmentId: payload.segment_id,
      segmentOrder: payload.segment_order,
      totalSegments: payload.total_segments,
      attemptCount: payload.attempt_count,
      accuracyRate: payload.accuracy_rate,
      refTokens: payload.ref_tokens,
      hypTokens: payload.hyp_tokens,
      correctCount: payload.correct_count,
      wrongCount: payload.wrong_count,
      missedCount: payload.missed_count,
      insertedCount: payload.inserted_count,
    }
  },
}

