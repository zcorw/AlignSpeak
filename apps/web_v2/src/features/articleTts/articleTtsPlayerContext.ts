import { createContext, useContext } from 'react'
import type { ArticleTtsPlayerState, PrepareArticleTtsRequest } from './playerController'

export interface ArticleTtsPlayerContextValue {
  state: ArticleTtsPlayerState
  prepare: (request: PrepareArticleTtsRequest) => Promise<void>
  retry: () => Promise<void>
  play: () => Promise<void>
  pause: () => void
  stop: () => void
  reset: () => void
}

export const ArticleTtsPlayerContext = createContext<ArticleTtsPlayerContextValue | null>(null)

export const useArticleTtsPlayer = () => {
  const context = useContext(ArticleTtsPlayerContext)
  if (!context) throw new Error('ArticleTtsPlayerProvider is required.')
  return context
}
