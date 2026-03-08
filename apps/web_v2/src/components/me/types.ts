import type { StartHistoryDoc } from '../../services/startService'

export type MeFilterType = 'all' | 'en' | 'zh' | 'done'

export interface MeArticle {
  id: string
  title: string
  language: StartHistoryDoc['language']
  level: number
  currentSegmentOrder: number
  totalSegments: number
  lastPracticedAt: string | null
  progressRate: number
  isDone: boolean
  practiceCount: number
}

