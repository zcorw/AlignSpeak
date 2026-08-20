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
  const userId = useAuthStore((state) => state.user?.id ?? null)
  const state = useSyncExternalStore(player.subscribe, player.getState, player.getState)

  useEffect(() => {
    if (!accessToken) {
      player.clearForLogout()
      return
    }
    if (userId) player.setStorageOwner(userId)
  }, [accessToken, player, userId])

  useEffect(() => () => player.dispose(), [player])

  useEffect(() => {
    const checkpoint = () => player.checkpoint()
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') checkpoint()
    }
    window.addEventListener('pagehide', checkpoint)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('pagehide', checkpoint)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [player])

  const value = useMemo<ArticleTtsPlayerContextValue>(
    () => ({
      state,
      prepare: (request) => player.prepare(request),
      retry: () => player.retry(),
      play: () => player.play(),
      pause: () => player.pause(),
      stop: () => player.stop(),
      setStopMode: (option) => player.setStopMode(option),
      interrupt: (reason) => player.interrupt(reason),
      resume: () => player.resume(),
      dismissResume: () => player.dismissResume(),
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
