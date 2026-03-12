import { Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { PracticeMatrix } from '../practice/shared'
import { matrixCellSx, RESULT_LEVELS, type Level, type MatrixState } from './shared'

interface ResultProgressMatrixProps {
  matrix: PracticeMatrix
  loading: boolean
  currentLevel: Level
  nextUnlockedLevel: Level | null
  totalSegments: number
  onSelectSegment: (level: Level, segmentOrder: number, state: MatrixState) => void
}

export const ResultProgressMatrix = ({
  matrix,
  loading,
  currentLevel,
  nextUnlockedLevel,
  totalSegments,
  onSelectSegment,
}: ResultProgressMatrixProps) => {
  const { t } = useTranslation()

  return (
    <>
      <Typography sx={{ px: '2px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
        {t('pages.result.progress.title', { level: currentLevel })}
      </Typography>
      <Box sx={{ bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', p: '18px' }}>
        {loading && (
          <Typography sx={{ mb: '10px', fontSize: '12px', color: 'text.disabled' }}>{t('common.loading')}</Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {RESULT_LEVELS.map((level) => (
            <Box key={level} sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Typography sx={{ width: 22, fontSize: '11px', fontWeight: 700, color: 'text.disabled', fontFamily: 'monospace' }}>
                {level}
              </Typography>
              <Box sx={{ display: 'flex', gap: '5px' }}>
                {(matrix[level] ?? []).map((state, index) => (
                  <Box
                    key={`${level}-${index}`}
                    component="button"
                    type="button"
                    onClick={() => onSelectSegment(level, index + 1, state)}
                    sx={{ ...matrixCellSx(state), cursor: state === 'pass' || state === 'current' ? 'pointer' : 'default' }}
                  >
                    {state === 'pass' ? 'OK' : state === 'current' ? index + 1 : state === 'skip' ? '->' : '-'}
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
        <Typography sx={{ mt: '12px', fontSize: '12px', color: 'text.disabled' }}>
          {nextUnlockedLevel
            ? t('pages.result.progress.hint', { total: totalSegments, nextLevel: nextUnlockedLevel })
            : t('pages.result.progress.hintMax')}
        </Typography>
      </Box>
    </>
  )
}
