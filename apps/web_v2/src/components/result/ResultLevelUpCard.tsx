import { Box, Button, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { Level } from './shared'

interface ResultLevelUpCardProps {
  currentLevel: Level
  unlockedLevel: Level
  onStart: (level: Level) => void
}

export const ResultLevelUpCard = ({
  currentLevel,
  unlockedLevel,
  onStart,
}: ResultLevelUpCardProps) => {
  const { t } = useTranslation()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center', p: '18px', background: 'linear-gradient(135deg, rgba(110,96,238,0.15), rgba(29,201,138,0.1))', border: '1px solid rgba(110,96,238,0.3)', borderRadius: '14px' }}>
      <Typography sx={{ fontSize: '32px' }}>L+</Typography>
      <Typography sx={{ fontSize: '18px', fontWeight: 700 }}>
        {t('pages.result.levelUp.title', { level: currentLevel })}
      </Typography>
      <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
        {t('pages.result.levelUp.subtitle', { nextLevel: unlockedLevel })}
      </Typography>
      <Button variant="contained" fullWidth sx={{ mt: '8px' }} onClick={() => onStart(unlockedLevel)}>
        {t('pages.result.levelUp.button', { nextLevel: unlockedLevel })}
      </Button>
    </Box>
  )
}
