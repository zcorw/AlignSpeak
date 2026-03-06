// Common types
export interface User {
  id: string
  email: string
  createdAt: string
}

// Article types
export interface Article {
  id: string
  title: string
  language: 'ja' | 'zh' | 'en'
  content: string
  segments: Segment[]
  createdAt: string
  lastPracticedAt?: string
}

export interface Segment {
  id: string
  index: number
  content: string
  tokens: Token[]
}

export interface Token {
  surface: string
  yomi?: string
  pos?: string
  masked?: boolean
  status?: 'correct' | 'substitute' | 'missing' | 'insert'
}

// Practice types
export interface PracticeLevel {
  level: 1 | 2 | 3 | 4
  maskingRate: number
}

export interface PracticeAttempt {
  id: string
  articleId: string
  segmentId: string
  level: number
  accuracy: number
  recognizedText: string
  alignment: AlignmentResult
  createdAt: string
}

export interface AlignmentResult {
  refTokens: Token[]
  hypTokens: Token[]
  alignment: AlignmentPair[]
  noiseSpans: NoiseSpan[]
}

export interface AlignmentPair {
  refIdx: number | null
  hypIdx: number | null
  status: 'correct' | 'substitute' | 'missing' | 'insert'
}

export interface NoiseSpan {
  start: number
  end: number
  reason: string
}

// Progress types
export interface Progress {
  articleId: string
  currentLevel: number
  currentSegmentIndex: number
  segmentProgress: SegmentProgress[]
}

export interface SegmentProgress {
  segmentId: string
  level: number
  passed: boolean
  skipped: boolean
  attempts: number
  bestAccuracy: number
}

// Sync types
export interface PendingAction {
  id: string
  type: 'practice_attempt' | 'skip_segment' | 'change_level'
  payload: unknown
  createdAt: string
  retryCount: number
  lastError: string | null
}

// API Response types
export interface ApiResponse<T> {
  data: T
  warnings?: ApiWarning[]
}

export interface ApiWarning {
  source: string
  code: string
  message: string
}

export interface ApiError {
  code: string
  message: string
}
