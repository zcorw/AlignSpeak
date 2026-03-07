import { ReplayRounded } from '@mui/icons-material'
import { Box, Button, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

interface ResultActionsCardProps {
  passed: boolean
  onPracticeAgain: () => void
  onNextSegment: () => void
}

export const ResultActionsCard = ({
  passed,
  onPracticeAgain,
  onNextSegment,
}: ResultActionsCardProps) => {
  const { t } = useTranslation()

  return (
    <Box sx={{ bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '14px', p: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
        {passed ? t('pages.result.actions.hintPassed') : t('pages.result.actions.hintFailed')}
      </Typography>
      <Button
        variant="contained"
        fullWidth
        startIcon={<ReplayRounded sx={{ fontSize: '14px !important' }} />}
        onClick={onPracticeAgain}
      >
        {t('pages.result.actions.practiceAgain')}
      </Button>
      <Button
        variant="outlined"
        fullWidth
        onClick={onNextSegment}
        sx={{
          bgcolor: '#22223a',
          borderColor: 'rgba(255,255,255,0.13)',
          color: passed ? 'text.primary' : 'text.disabled',
          '&:hover': {
            borderColor: 'rgba(255,255,255,0.13)',
            bgcolor: '#1a1a2c',
          },
        }}
      >
        {t('pages.result.actions.nextSegment')}
      </Button>
    </Box>
  )
}

