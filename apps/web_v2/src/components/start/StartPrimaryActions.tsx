import { NorthRounded } from '@mui/icons-material'
import { Box, Button } from '@mui/material'

interface StartPrimaryActionsProps {
  continueLabel: string
  orLabel: string
  importLabel: string
  onContinue: () => void
  onImport: () => void
}

export const StartPrimaryActions = ({
  continueLabel,
  orLabel,
  importLabel,
  onContinue,
  onImport,
}: StartPrimaryActionsProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <Button
      variant="contained"
      size="large"
      fullWidth
      onClick={onContinue}
      sx={{
        boxShadow: '0 2px 12px rgba(110,96,238,0.25)',
        '&:hover': {
          bgcolor: 'primary.light',
        },
      }}
    >
      {continueLabel}
    </Button>

    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'text.disabled',
        fontSize: '12px',
        '&::before, &::after': {
          content: '""',
          flex: 1,
          height: 1,
          bgcolor: 'divider',
        },
      }}
    >
      {orLabel}
    </Box>

    <Button
      variant="outlined"
      fullWidth
      startIcon={<NorthRounded sx={{ fontSize: '16px !important' }} />}
      onClick={onImport}
      sx={{
        bgcolor: '#22223a',
        borderColor: 'rgba(255,255,255,0.13)',
        color: 'text.primary',
        '&:hover': {
          borderColor: 'rgba(255,255,255,0.13)',
          bgcolor: '#1a1a2c',
        },
      }}
    >
      {importLabel}
    </Button>
  </Box>
)

