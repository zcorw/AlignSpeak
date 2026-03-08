import { CloseRounded } from '@mui/icons-material'
import { Box, Button, TextField, Typography } from '@mui/material'
import { Alert, FieldError } from '../Alert'

interface ChangePasswordSheetProps {
  open: boolean
  submitting: boolean
  currentPwd: string
  newPwd: string
  confirmPwd: string
  fieldErrors: Record<string, string>
  feedback: { type: 'success' | 'error'; message: string } | null
  labels: {
    title: string
    currentPlaceholder: string
    newPlaceholder: string
    confirmPlaceholder: string
    submit: string
    loading: string
  }
  onClose: () => void
  onCurrentPwdChange: (value: string) => void
  onNewPwdChange: (value: string) => void
  onConfirmPwdChange: (value: string) => void
  onSubmit: () => void
}

const iconButtonSx = {
  width: 36,
  height: 36,
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.13)',
  bgcolor: '#1a1a2c',
  color: 'text.secondary',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
  '&:hover': { bgcolor: '#22223a', color: 'text.primary' },
} as const

export const ChangePasswordSheet = ({
  open,
  submitting,
  currentPwd,
  newPwd,
  confirmPwd,
  fieldErrors,
  feedback,
  labels,
  onClose,
  onCurrentPwdChange,
  onNewPwdChange,
  onConfirmPwdChange,
  onSubmit,
}: ChangePasswordSheetProps) => (
  <Box
    onClick={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}
    sx={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      bgcolor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      opacity: open ? 1 : 0,
      pointerEvents: open ? 'auto' : 'none',
      transition: 'opacity 0.25s',
    }}
  >
    <Box
      sx={{
        width: '100%',
        maxWidth: '430px',
        p: '20px 20px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        bgcolor: 'background.paper',
        borderRadius: '14px 14px 0 0',
        border: '1px solid rgba(255,255,255,0.13)',
        borderBottom: 'none',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Typography sx={{ fontSize: '16px', fontWeight: 600 }}>
          {labels.title}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Box
          component="button"
          type="button"
          onClick={onClose}
          sx={{
            ...iconButtonSx,
            border: '1px solid transparent',
            bgcolor: 'transparent',
          }}
        >
          <CloseRounded sx={{ fontSize: 14 }} />
        </Box>
      </Box>

      {feedback && (
        <Alert type={feedback.type} message={feedback.message} />
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Box>
          <TextField
            value={currentPwd}
            onChange={(event) => onCurrentPwdChange(event.target.value)}
            type="password"
            size="small"
            fullWidth
            placeholder={labels.currentPlaceholder}
            error={!!fieldErrors.currentPassword}
            sx={{
              '.MuiOutlinedInput-root': {
                bgcolor: '#22223a',
                borderColor: fieldErrors.currentPassword ? '#f05252' : undefined,
              },
            }}
          />
          {fieldErrors.currentPassword && <FieldError message={fieldErrors.currentPassword} />}
        </Box>
        <Box>
          <TextField
            value={newPwd}
            onChange={(event) => onNewPwdChange(event.target.value)}
            type="password"
            size="small"
            fullWidth
            placeholder={labels.newPlaceholder}
            error={!!fieldErrors.newPassword}
            sx={{
              '.MuiOutlinedInput-root': {
                bgcolor: '#22223a',
                borderColor: fieldErrors.newPassword ? '#f05252' : undefined,
              },
            }}
          />
          {fieldErrors.newPassword && <FieldError message={fieldErrors.newPassword} />}
        </Box>
        <Box>
          <TextField
            value={confirmPwd}
            onChange={(event) => onConfirmPwdChange(event.target.value)}
            type="password"
            size="small"
            fullWidth
            placeholder={labels.confirmPlaceholder}
            error={!!fieldErrors.confirmPassword}
            sx={{
              '.MuiOutlinedInput-root': {
                bgcolor: '#22223a',
                borderColor: fieldErrors.confirmPassword ? '#f05252' : undefined,
              },
            }}
          />
          {fieldErrors.confirmPassword && <FieldError message={fieldErrors.confirmPassword} />}
        </Box>
      </Box>

      <Button variant="contained" fullWidth disabled={submitting} onClick={onSubmit}>
        {submitting ? labels.loading : labels.submit}
      </Button>
    </Box>
  </Box>
)

