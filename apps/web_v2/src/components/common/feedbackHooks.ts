import { createContext, useContext } from 'react'

export type NoticeLevel = 'success' | 'error' | 'info' | 'warning'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export interface FeedbackContextValue {
  notify: (level: NoticeLevel, message: string, durationMs?: number) => void
  success: (message: string, durationMs?: number) => void
  error: (message: string, durationMs?: number) => void
  info: (message: string, durationMs?: number) => void
  warning: (message: string, durationMs?: number) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

export const FeedbackContext = createContext<FeedbackContextValue | null>(null)

const useFeedbackContext = () => {
  const context = useContext(FeedbackContext)
  if (!context) {
    throw new Error('FeedbackProvider is required.')
  }
  return context
}

export const useNotifier = () => {
  const { notify, success, error, info, warning } = useFeedbackContext()
  return { notify, success, error, info, warning }
}

export const useConfirm = () => {
  const { confirm } = useFeedbackContext()
  return { confirm }
}
