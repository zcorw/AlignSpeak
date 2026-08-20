import { createContext, useContext } from 'react'
import type {
  ArticleTtsInterruptionReason,
  ArticleTtsPlayerState,
  ArticleTtsStopModeOption,
  PrepareArticleTtsRequest,
} from './playerController'

export interface ArticleTtsPlayerContextValue {
  state: ArticleTtsPlayerState
  prepare: (request: PrepareArticleTtsRequest) => Promise<void>
  retry: () => Promise<void>
  play: () => Promise<void>
  pause: () => void
  stop: () => void
  setStopMode: (option: ArticleTtsStopModeOption) => void
  interrupt: (reason: ArticleTtsInterruptionReason) => void
  resume: () => Promise<void>
  dismissResume: () => void
  reset: () => void
}

export const ArticleTtsPlayerContext = createContext<ArticleTtsPlayerContextValue | null>(null)

export const useArticleTtsPlayer = () => {
  const context = useContext(ArticleTtsPlayerContext)
  if (!context) throw new Error('ArticleTtsPlayerProvider is required.')
  return context
}
