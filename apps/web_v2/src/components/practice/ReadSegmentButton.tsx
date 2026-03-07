import { VolumeUpRounded } from '@mui/icons-material'
import { Box, Button, CircularProgress } from '@mui/material'

interface ReadSegmentButtonProps {
  loading: boolean
  speaking: boolean
  disabled?: boolean
  onClick: () => void
  loadingLabel: string
  playLabel: string
  stopLabel: string
  variant?: 'pill' | 'text'
}

export const ReadSegmentButton = ({
  loading,
  speaking,
  disabled = false,
  onClick,
  loadingLabel,
  playLabel,
  stopLabel,
  variant = 'pill',
}: ReadSegmentButtonProps) => {
  if (variant === 'text') {
    return (
      <Button
        variant="text"
        size="small"
        startIcon={loading ? <CircularProgress size={12} thickness={5} sx={{ color: 'inherit' }} /> : <VolumeUpRounded sx={{ fontSize: 15 }} />}
        onClick={onClick}
        disabled={disabled || loading}
        sx={{
          mt: '2px',
          color: 'text.secondary',
          fontSize: '12px',
          fontWeight: 500,
          minHeight: '28px',
          opacity: 0.85,
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.05)',
            color: 'text.primary',
          },
        }}
      >
        {loading ? loadingLabel : speaking ? stopLabel : playLabel}
      </Button>
    )
  }

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      sx={{
        mt: '14px',
        px: '10px',
        py: '6px',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.13)',
        bgcolor: speaking ? 'rgba(110,96,238,0.25)' : '#22223a',
        color: speaking ? 'primary.light' : 'text.secondary',
        fontSize: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        cursor: disabled || loading ? 'default' : 'pointer',
        transition: 'all 0.15s',
        '&:hover': disabled || loading
          ? undefined
          : {
              borderColor: 'rgba(110,96,238,0.3)',
              color: 'text.primary',
            },
      }}
    >
      {loading ? <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} /> : <VolumeUpRounded sx={{ fontSize: 14 }} />}
      {loading ? loadingLabel : speaking ? stopLabel : playLabel}
    </Box>
  )
}

