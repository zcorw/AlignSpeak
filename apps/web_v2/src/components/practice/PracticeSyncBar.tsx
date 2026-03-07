import { RefreshRounded } from '@mui/icons-material'
import { Box, CircularProgress } from '@mui/material'

interface PracticeSyncBarProps {
  show: boolean
  syncing: boolean
  disabled: boolean
  onRetry: () => void
  syncingLabel: string
  retryLabel: string
}

export const PracticeSyncBar = ({
  show,
  syncing,
  disabled,
  onRetry,
  syncingLabel,
  retryLabel,
}: PracticeSyncBarProps) => {
  if (!show) return null
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: '20px', pb: '8px' }}>
      <Box
        component="button"
        type="button"
        onClick={onRetry}
        disabled={syncing || disabled}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          px: '10px',
          py: '5px',
          bgcolor: 'rgba(240,166,35,0.1)',
          border: '1px solid rgba(240,166,35,0.25)',
          borderRadius: '999px',
          color: 'warning.main',
          fontSize: '12px',
          cursor: syncing || disabled ? 'default' : 'pointer',
        }}
      >
        {syncing ? <CircularProgress size={12} thickness={5} sx={{ color: 'warning.main' }} /> : <RefreshRounded sx={{ fontSize: 13 }} />}
        {syncing ? syncingLabel : retryLabel}
      </Box>
    </Box>
  )
}

