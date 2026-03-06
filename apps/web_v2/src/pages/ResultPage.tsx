import { ArrowBackRounded, PersonOutlineRounded, ReplayRounded } from '@mui/icons-material'
import { Box, Button, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

type TokenState = 'ok' | 'err' | 'miss' | 'ins'
type MatrixState = 'pass' | 'current' | 'skip' | 'fail'
type Level = 'L1' | 'L2' | 'L3' | 'L4'

const SCORE = 78
const TARGET = 85
const PASS = SCORE >= TARGET

const ORIGINAL_TOKENS: { word: string; state: TokenState }[] = [
  { word: 'After', state: 'ok' },
  { word: 'that', state: 'ok' },
  { word: 'I', state: 'ok' },
  { word: 'used', state: 'err' },
  { word: 'to', state: 'ok' },
  { word: 'think', state: 'ok' },
  { word: 'a', state: 'ok' },
  { word: 'lot', state: 'ok' },
  { word: 'about', state: 'ok' },
  { word: 'jungle', state: 'ok' },
  { word: 'adventures', state: 'err' },
  { word: ',', state: 'ok' },
  { word: 'and', state: 'ok' },
  { word: 'eventually', state: 'ok' },
  { word: 'managed', state: 'ok' },
  { word: 'to', state: 'ok' },
  { word: 'make', state: 'ok' },
  { word: 'my', state: 'miss' },
  { word: 'first', state: 'ok' },
  { word: 'drawing', state: 'ok' },
  { word: 'with', state: 'miss' },
  { word: 'colored', state: 'miss' },
  { word: 'pencils', state: 'miss' },
  { word: '.', state: 'ok' },
]

const SPOKEN_TOKENS: { word: string; state: TokenState }[] = [
  { word: 'After', state: 'ok' },
  { word: 'that', state: 'ok' },
  { word: 'I', state: 'ok' },
  { word: 'use', state: 'err' },
  { word: 'to', state: 'ok' },
  { word: 'think', state: 'ok' },
  { word: 'a', state: 'ok' },
  { word: 'lot', state: 'ok' },
  { word: 'about', state: 'ok' },
  { word: 'jungle', state: 'ok' },
  { word: 'adventure', state: 'err' },
  { word: ',', state: 'ok' },
  { word: 'and', state: 'ok' },
  { word: 'eventually', state: 'ok' },
  { word: 'managed', state: 'ok' },
  { word: 'to', state: 'ok' },
  { word: 'make', state: 'ok' },
  { word: 'first', state: 'ok' },
  { word: 'drawing', state: 'ok' },
  { word: '.', state: 'ok' },
  { word: 'right', state: 'ins' },
]

const PROGRESS: Record<Level, MatrixState[]> = {
  L1: ['pass', 'pass', 'pass', 'pass', 'pass'],
  L2: ['pass', 'pass', 'current', 'fail', 'fail'],
  L3: ['fail', 'fail', 'fail', 'fail', 'fail'],
  L4: ['fail', 'fail', 'fail', 'fail', 'fail'],
}

const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4']

const tokenSx = (state: TokenState) => ({
  display: 'inline',
  px: '2px',
  borderRadius: '3px',
  ...(state === 'ok' && {
    bgcolor: 'rgba(29,201,138,0.12)',
    color: 'text.primary',
  }),
  ...(state === 'err' && {
    bgcolor: 'rgba(240,82,82,0.2)',
    color: 'error.main',
    textDecoration: 'line-through',
  }),
  ...(state === 'miss' && {
    bgcolor: 'rgba(240,166,35,0.15)',
    color: 'warning.main',
  }),
  ...(state === 'ins' && {
    bgcolor: 'rgba(240,82,82,0.1)',
    color: 'text.secondary',
  }),
})

const matrixCellSx = (state: MatrixState) => ({
  width: 28,
  height: 28,
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  fontWeight: 700,
  border: '1px solid transparent',
  ...(state === 'pass' && {
    bgcolor: 'rgba(29,201,138,0.1)',
    color: 'success.main',
    borderColor: 'rgba(29,201,138,0.2)',
  }),
  ...(state === 'current' && {
    bgcolor: 'rgba(110,96,238,0.25)',
    color: 'primary.light',
    borderColor: 'primary.main',
  }),
  ...(state === 'skip' && {
    bgcolor: 'rgba(240,166,35,0.1)',
    color: 'warning.main',
    borderColor: 'rgba(240,166,35,0.2)',
  }),
  ...(state === 'fail' && {
    bgcolor: '#22223a',
    color: 'text.disabled',
  }),
})

const iconButtonSx = {
  width: 36,
  height: 36,
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.13)',
  bgcolor: '#1a1a2c',
  color: 'text.secondary',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
  '&:hover': { bgcolor: '#22223a', color: 'text.primary' },
} as const

export const ResultPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - SCORE / 100)
  const levelUnlocked = PROGRESS.L2.every((state) => state === 'pass')

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', px: '20px', pt: '16px', pb: '12px' }}>
        <Box component="button" type="button" sx={iconButtonSx} onClick={() => navigate('/practice')}>
          <ArrowBackRounded sx={{ fontSize: 16 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            The Little Prince — Ch.I
          </Typography>
          <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>
            {t('pages.result.topbarSubtitle')}
          </Typography>
        </Box>
        <Box component="button" type="button" sx={iconButtonSx} onClick={() => navigate('/me')}>
          <PersonOutlineRounded sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: '20px',
          pt: '8px',
          pb: '40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          animation: 'fadeUp 0.35s ease forwards',
          '@keyframes fadeUp': {
            from: { opacity: 0, transform: 'translateY(10px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
        }}
      >
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
              background: PASS
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
                stroke={PASS ? '#1dc98a' : '#f05252'}
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
                color: PASS ? 'success.main' : 'error.main',
              }}
            >
              {SCORE}%
            </Typography>
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1 }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 700, color: PASS ? 'success.main' : 'error.main' }}>
              {PASS ? t('pages.result.verdict.passed') : t('pages.result.verdict.failed')}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
              {PASS
                ? t('pages.result.verdict.overTarget', { value: SCORE - TARGET })
                : t('pages.result.verdict.belowTarget', { target: TARGET, value: TARGET - SCORE })}
            </Typography>
            <Box sx={{ display: 'flex', gap: '6px', mt: '4px', flexWrap: 'wrap' }}>
              <Box sx={{ px: '10px', py: '3px', borderRadius: '999px', bgcolor: 'rgba(110,96,238,0.25)', border: '1px solid rgba(110,96,238,0.3)', color: 'primary.light', fontSize: '12px', fontWeight: 600 }}>
                {t('pages.result.tags.level')}
              </Box>
              <Box sx={{ px: '10px', py: '3px', borderRadius: '999px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', color: 'text.secondary', fontSize: '12px', fontWeight: 600 }}>
                {t('pages.result.tags.segment')}
              </Box>
              <Box sx={{ px: '10px', py: '3px', borderRadius: '999px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', color: 'text.secondary', fontSize: '12px', fontWeight: 600 }}>
                {t('pages.result.tags.attempt', { count: 4 })}
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: '8px' }}>
          <Box sx={{ flex: 1, p: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: 'success.main' }}>11</Typography>
            <Typography sx={{ fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'text.disabled' }}>
              {t('pages.result.breakdown.correct')}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, p: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: 'error.main' }}>3</Typography>
            <Typography sx={{ fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'text.disabled' }}>
              {t('pages.result.breakdown.wrong')}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, p: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: 'warning.main' }}>4</Typography>
            <Typography sx={{ fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'text.disabled' }}>
              {t('pages.result.breakdown.missed')}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, p: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: 'text.disabled' }}>1</Typography>
            <Typography sx={{ fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'text.disabled' }}>
              {t('pages.result.breakdown.inserted')}
            </Typography>
          </Box>
        </Box>

        <Typography sx={{ px: '2px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
          {t('pages.result.alignment.title')}
        </Typography>
        <Box sx={{ bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', p: '18px' }}>
          <Box sx={{ mb: '14px', fontSize: '14px', lineHeight: 2 }}>
            {ORIGINAL_TOKENS.map((token, i) => (
              <Box key={`o-${i}`} component="span" sx={tokenSx(token.state)}>
                {token.word}{' '}
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', mb: '14px', fontSize: '11px', color: 'text.disabled', '&::before, &::after': { content: '""', flex: 1, height: 1, bgcolor: 'divider' } }}>
            {t('pages.result.alignment.spoken')}
          </Box>

          <Box sx={{ fontSize: '14px', lineHeight: 2 }}>
            {SPOKEN_TOKENS.map((token, i) => (
              <Box key={`s-${i}`} component="span" sx={tokenSx(token.state)}>
                {token.word}{' '}
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

        <Typography sx={{ px: '2px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
          {t('pages.result.progress.title')}
        </Typography>
        <Box sx={{ bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', p: '18px' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {LEVELS.map((lv) => (
              <Box key={lv} sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Typography sx={{ width: 22, fontSize: '11px', fontWeight: 700, color: 'text.disabled', fontFamily: 'monospace' }}>
                  {lv}
                </Typography>
                <Box sx={{ display: 'flex', gap: '5px' }}>
                  {PROGRESS[lv].map((state, idx) => (
                    <Box
                      key={`${lv}-${idx}`}
                      component="button"
                      type="button"
                      onClick={() => {
                        if (state === 'pass' || state === 'current') navigate(`/practice?seg=${idx + 1}&lv=${lv}`)
                      }}
                      sx={{ ...matrixCellSx(state), cursor: state === 'pass' || state === 'current' ? 'pointer' : 'default' }}
                    >
                      {state === 'pass' ? '✓' : state === 'current' ? idx + 1 : state === 'skip' ? '↷' : '·'}
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
          <Typography sx={{ mt: '12px', fontSize: '12px', color: 'text.disabled' }}>
            {t('pages.result.progress.hint')}
          </Typography>
        </Box>

        {levelUnlocked && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center', p: '18px', background: 'linear-gradient(135deg, rgba(110,96,238,0.15), rgba(29,201,138,0.1))', border: '1px solid rgba(110,96,238,0.3)', borderRadius: '14px' }}>
            <Typography sx={{ fontSize: '32px' }}>🎉</Typography>
            <Typography sx={{ fontSize: '18px', fontWeight: 700 }}>
              {t('pages.result.levelUp.title')}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
              {t('pages.result.levelUp.subtitle')}
            </Typography>
            <Button variant="contained" fullWidth sx={{ mt: '8px' }} onClick={() => navigate('/practice?level=3')}>
              {t('pages.result.levelUp.button')}
            </Button>
          </Box>
        )}

        <Box sx={{ bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '14px', p: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
            {PASS ? t('pages.result.actions.hintPassed') : t('pages.result.actions.hintFailed')}
          </Typography>
          <Button variant="contained" fullWidth startIcon={<ReplayRounded sx={{ fontSize: '14px !important' }} />} onClick={() => navigate('/practice')}>
            {t('pages.result.actions.practiceAgain')}
          </Button>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => navigate('/practice?seg=4')}
            sx={{
              bgcolor: '#22223a',
              borderColor: 'rgba(255,255,255,0.13)',
              color: PASS ? 'text.primary' : 'text.disabled',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.13)',
                bgcolor: '#1a1a2c',
              },
            }}
          >
            {t('pages.result.actions.nextSegment')}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
