import { Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { AttemptResultDetail } from '../../services/resultService'

interface ResultBreakdownStatsProps {
  detail: AttemptResultDetail
}

const itemSx = {
  flex: 1,
  p: '8px 12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px',
  bgcolor: '#1a1a2c',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '8px',
}

const labelSx = {
  fontSize: '10px',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: 'text.disabled',
}

export const ResultBreakdownStats = ({ detail }: ResultBreakdownStatsProps) => {
  const { t } = useTranslation()

  return (
    <Box sx={{ display: 'flex', gap: '8px' }}>
      <Box sx={itemSx}>
        <Typography sx={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: 'success.main' }}>{detail.correctCount}</Typography>
        <Typography sx={labelSx}>{t('pages.result.breakdown.correct')}</Typography>
      </Box>
      <Box sx={itemSx}>
        <Typography sx={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: 'error.main' }}>{detail.wrongCount}</Typography>
        <Typography sx={labelSx}>{t('pages.result.breakdown.wrong')}</Typography>
      </Box>
      <Box sx={itemSx}>
        <Typography sx={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: 'warning.main' }}>{detail.missedCount}</Typography>
        <Typography sx={labelSx}>{t('pages.result.breakdown.missed')}</Typography>
      </Box>
      <Box sx={itemSx}>
        <Typography sx={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: 'text.disabled' }}>{detail.insertedCount}</Typography>
        <Typography sx={labelSx}>{t('pages.result.breakdown.inserted')}</Typography>
      </Box>
    </Box>
  )
}

