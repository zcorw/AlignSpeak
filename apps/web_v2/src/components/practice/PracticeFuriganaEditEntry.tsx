import { Box, Typography } from '@mui/material'

interface PracticeFuriganaEditEntryProps {
  visible: boolean
  active: boolean
  buttonLabel: string
  hintLabel: string
  onToggle: () => void
}

export const PracticeFuriganaEditEntry = ({
  visible,
  active,
  buttonLabel,
  hintLabel,
  onToggle,
}: PracticeFuriganaEditEntryProps) => {
  if (!visible) return null
  return (
    <Box sx={{ mt: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        sx={{
          border: '1px solid',
          borderColor: active ? 'rgba(110,96,238,0.45)' : 'rgba(255,255,255,0.14)',
          bgcolor: active ? 'rgba(110,96,238,0.16)' : 'transparent',
          color: active ? 'primary.light' : 'text.secondary',
          borderRadius: '999px',
          px: '12px',
          py: '5px',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        {buttonLabel}
      </Box>
      <Typography sx={{ fontSize: '11px', color: 'text.disabled' }}>
        {hintLabel}
      </Typography>
    </Box>
  )
}

