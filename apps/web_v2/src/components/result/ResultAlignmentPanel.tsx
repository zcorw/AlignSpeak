import { Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { ResultToken } from '../../services/resultService'
import { tokenSx } from './shared'

interface ResultAlignmentPanelProps {
  refTokens: ResultToken[]
  hypTokens: ResultToken[]
}

export const ResultAlignmentPanel = ({
  refTokens,
  hypTokens,
}: ResultAlignmentPanelProps) => {
  const { t } = useTranslation()

  return (
    <>
      <Typography sx={{ px: '2px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
        {t('pages.result.alignment.title')}
      </Typography>
      <Box sx={{ bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', p: '18px' }}>
        <Box sx={{ mb: '14px', fontSize: '14px', lineHeight: 2 }}>
          {refTokens.map((token, index) => (
            <Box key={`o-${index}`} component="span" sx={tokenSx(token.status)}>
              {token.text}{' '}
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', mb: '14px', fontSize: '11px', color: 'text.disabled', '&::before, &::after': { content: '""', flex: 1, height: 1, bgcolor: 'divider' } }}>
          {t('pages.result.alignment.spoken')}
        </Box>

        <Box sx={{ fontSize: '14px', lineHeight: 2 }}>
          {hypTokens.map((token, index) => (
            <Box key={`s-${index}`} component="span" sx={tokenSx(token.status)}>
              {token.text}{' '}
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: '14px', flexWrap: 'wrap', mt: '12px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'text.secondary' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'rgba(29,201,138,0.3)' }} />
            {t('pages.result.alignment.legendCorrect')}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'text.secondary' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'rgba(240,82,82,0.3)' }} />
            {t('pages.result.alignment.legendWrong')}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'text.secondary' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'rgba(240,166,35,0.25)' }} />
            {t('pages.result.alignment.legendMissed')}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'text.secondary' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'rgba(240,82,82,0.1)' }} />
            {t('pages.result.alignment.legendInserted')}
          </Box>
        </Box>
      </Box>
    </>
  )
}

