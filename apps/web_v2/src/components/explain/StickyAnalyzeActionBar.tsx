import { Box, Button, Typography } from '@mui/material'

interface StickyAnalyzeActionBarProps {
  disabled: boolean
  loading: boolean
  hint: string
  actionLabel: string
  loadingLabel: string
  onAnalyze: () => void
}

export const StickyAnalyzeActionBar = ({
  disabled,
  loading,
  hint,
  actionLabel,
  loadingLabel,
  onAnalyze,
}: StickyAnalyzeActionBarProps) => (
  <Box
    sx={{
      p: '12px 20px 18px',
      borderTop: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.default',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}
  >
    <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>{hint}</Typography>
    <Button
      variant="contained"
      size="large"
      fullWidth
      disabled={disabled || loading}
      onClick={onAnalyze}
      sx={{
        boxShadow: '0 2px 12px rgba(110,96,238,0.25)',
        '&:hover': { bgcolor: 'primary.light' },
      }}
    >
      {loading ? loadingLabel : actionLabel}
    </Button>
  </Box>
)

