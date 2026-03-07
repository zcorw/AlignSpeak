import { Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { AttemptResultDetail } from '../../services/resultService'
import { TARGET, type Level } from './shared'

interface ResultScoreCardProps {
  detail: AttemptResultDetail
  level: Level
  score: number
  passed: boolean
}

export const ResultScoreCard = ({
  detail,
  level,
  score,
  passed,
}: ResultScoreCardProps) => {
  const { t } = useTranslation()
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - score / 100)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        p: '20px',
        bgcolor: '#1a1a2c',
        border: '1px solid rgba(255,255,255,0.13)',
        borderRadius: '14px',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: passed
            ? 'radial-gradient(circle at 80% 50%, rgba(29,201,138,0.08) 0%, transparent 70%)'
            : 'radial-gradient(circle at 80% 50%, rgba(240,82,82,0.06) 0%, transparent 70%)',
        },
      }}
    >
      <Box sx={{ width: 80, height: 80, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box component="svg" viewBox="0 0 80 80" sx={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#22223a" strokeWidth="7" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={passed ? '#1dc98a' : '#f05252'}
            strokeWidth="7"
            strokeDasharray={circumference.toFixed(1)}
            strokeDashoffset={dashOffset.toFixed(1)}
            strokeLinecap="round"
          />
        </Box>
        <Typography
          sx={{
            zIndex: 1,
            fontSize: '22px',
            fontWeight: 800,
            fontFamily: '"SF Mono", "Fira Code", monospace',
            color: passed ? 'success.main' : 'error.main',
          }}
        >
          {score}%
        </Typography>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1 }}>
        <Typography sx={{ fontSize: '16px', fontWeight: 700, color: passed ? 'success.main' : 'error.main' }}>
          {passed ? t('pages.result.verdict.passed') : t('pages.result.verdict.failed')}
        </Typography>
        <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
          {passed
            ? t('pages.result.verdict.overTarget', { value: score - TARGET })
            : t('pages.result.verdict.belowTarget', { target: TARGET, value: TARGET - score })}
        </Typography>
        <Box sx={{ display: 'flex', gap: '6px', mt: '4px', flexWrap: 'wrap' }}>
          <Box sx={{ px: '10px', py: '3px', borderRadius: '999px', bgcolor: 'rgba(110,96,238,0.25)', border: '1px solid rgba(110,96,238,0.3)', color: 'primary.light', fontSize: '12px', fontWeight: 600 }}>
            {level}
          </Box>
          <Box sx={{ px: '10px', py: '3px', borderRadius: '999px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', color: 'text.secondary', fontSize: '12px', fontWeight: 600 }}>
            搂{detail.segmentOrder}
          </Box>
          <Box sx={{ px: '10px', py: '3px', borderRadius: '999px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', color: 'text.secondary', fontSize: '12px', fontWeight: 600 }}>
            {t('pages.result.tags.attempt', { count: detail.attemptCount })}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

