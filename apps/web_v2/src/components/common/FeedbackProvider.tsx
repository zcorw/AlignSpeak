import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar } from '@mui/material'
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

type NoticeLevel = 'success' | 'error' | 'info' | 'warning'

interface SnackbarState {
  open: boolean
  level: NoticeLevel
  message: string
  durationMs: number
}

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface FeedbackContextValue {
  notify: (level: NoticeLevel, message: string, durationMs?: number) => void
  success: (message: string, durationMs?: number) => void
  error: (message: string, durationMs?: number) => void
  info: (message: string, durationMs?: number) => void
  warning: (message: string, durationMs?: number) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

interface ConfirmState extends ConfirmOptions {
  open: boolean
}

export const FeedbackProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation()
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    level: 'info',
    message: '',
    durationMs: 2600,
  })
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    message: '',
    title: '',
    confirmLabel: '',
    cancelLabel: '',
    danger: false,
  })
  const resolveRef = useRef<((result: boolean) => void) | null>(null)

  const notify = useCallback((level: NoticeLevel, message: string, durationMs = 2600) => {
    setSnackbar({
      open: true,
      level,
      message,
      durationMs,
    })
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setConfirmState({
        open: true,
        ...options,
      })
    })
  }, [])

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmState((prev) => ({ ...prev, open: false }))
    if (resolveRef.current) {
      resolveRef.current(result)
      resolveRef.current = null
    }
  }, [])

  const contextValue = useMemo<FeedbackContextValue>(
    () => ({
      notify,
      success: (message, durationMs) => notify('success', message, durationMs),
      error: (message, durationMs) => notify('error', message, durationMs),
      info: (message, durationMs) => notify('info', message, durationMs),
      warning: (message, durationMs) => notify('warning', message, durationMs),
      confirm,
    }),
    [confirm, notify]
  )

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.durationMs}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.level}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={confirmState.open}
        onClose={() => closeConfirm(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{confirmState.title || t('common.confirm')}</DialogTitle>
        <DialogContent>{confirmState.message}</DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => closeConfirm(false)}>{confirmState.cancelLabel || t('common.cancel')}</Button>
          <Button
            variant="contained"
            color={confirmState.danger ? 'error' : 'primary'}
            onClick={() => closeConfirm(true)}
          >
            {confirmState.confirmLabel || t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </FeedbackContext.Provider>
  )
}

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
