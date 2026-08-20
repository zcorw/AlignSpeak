import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { useAuthStore } from '../../stores/authStore'
import {
  ArticleTtsPlayerController,
} from './playerController'
import {
  ArticleTtsPlayerContext,
  type ArticleTtsPlayerContextValue,
} from './articleTtsPlayerContext'

interface ArticleTtsPlayerProviderProps {
  children: ReactNode
  controller?: ArticleTtsPlayerController
}

export const ArticleTtsPlayerProvider = ({
  children,
  controller,
}: ArticleTtsPlayerProviderProps) => {
  const [player] = useState(() => controller ?? new ArticleTtsPlayerController())
  const accessToken = useAuthStore((state) => state.accessToken)
  const state = useSyncExternalStore(player.subscribe, player.getState, player.getState)

  useEffect(() => {
    if (!accessToken) player.reset()
  }, [accessToken, player])

  useEffect(() => () => player.dispose(), [player])

  const value = useMemo<ArticleTtsPlayerContextValue>(
    () => ({
      state,
      prepare: (request) => player.prepare(request),
      retry: () => player.retry(),
      play: () => player.play(),
      pause: () => player.pause(),
      stop: () => player.stop(),
      reset: () => player.reset(),
    }),
    [player, state]
  )

  return (
    <ArticleTtsPlayerContext.Provider value={value}>
      {children}
    </ArticleTtsPlayerContext.Provider>
  )
}
