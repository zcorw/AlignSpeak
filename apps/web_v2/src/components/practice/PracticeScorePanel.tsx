import { ArrowForwardRounded, ReplayRounded } from '@mui/icons-material'
import { Box, Button, Typography } from '@mui/material'
import type { AlignmentStatus, AlignmentToken } from '../../services/practiceAttemptService'

const tokenStyleFromStatus = (status: AlignmentStatus): { bg: string; color?: string; strike?: boolean } => {
  if (status === 'correct') return { bg: 'rgba(29,201,138,0.12)' }
  if (status === 'substitute') return { bg: 'rgba(240,82,82,0.2)', color: 'error.main', strike: true }
  if (status === 'missing') return { bg: 'rgba(240,166,35,0.18)', color: 'warning.main' }
  return { bg: 'rgba(240,82,82,0.1)', color: 'text.secondary' }
}

interface PracticeScorePanelProps {
  score: number
  passed: boolean
  correctCount: number
  tokenTotal: number
  wrongCount: number
  missedCount: number
  displayTokens: AlignmentToken[]
  onPracticeAgain: () => void
  onSubmitView: () => void
  onSkipSegment: () => void
  labels: {
    passed: string
    failed: string
    correctWords: string
    wrongWords: string
    missedWords: string
    noTokens: string
    practiceAgain: string
    submitView: string
    skipSegment: string
  }
}

export const PracticeScorePanel = ({
  score,
  passed,
  correctCount,
  tokenTotal,
  wrongCount,
  missedCount,
  displayTokens,
  onPracticeAgain,
  onSubmitView,
  onSkipSegment,
  labels,
}: PracticeScorePanelProps) => (
  <Box
    sx={{
      bgcolor: '#1a1a2c',
      border: '1px solid rgba(255,255,255,0.13)',
      borderRadius: '24px',
      p: '18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start', minWidth: 126 }}>
        <Typography
          sx={{
            fontSize: '72px',
            lineHeight: 0.85,
            fontWeight: 800,
            fontFamily: '"SF Mono", "Fira Code", monospace',
            color: 'success.main',
          }}
        >
          {score}%
        </Typography>
        <Typography sx={{ fontSize: '11px', color: 'text.disabled' }}>
          {passed ? labels.passed : labels.failed}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <Typography component="span" sx={{ color: 'text.secondary' }}>
            {labels.correctWords}
          </Typography>
          <Typography component="span" sx={{ minWidth: 72, textAlign: 'right', color: 'text.primary', fontFamily: 'monospace' }}>{`${correctCount} / ${tokenTotal}`}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <Typography component="span" sx={{ color: 'text.secondary' }}>
            {labels.wrongWords}
          </Typography>
          <Typography component="span" sx={{ minWidth: 72, textAlign: 'right', color: 'text.primary', fontFamily: 'monospace' }}>{wrongCount}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <Typography component="span" sx={{ color: 'text.secondary' }}>
            {labels.missedWords}
          </Typography>
          <Typography component="span" sx={{ minWidth: 72, textAlign: 'right', color: 'text.primary', fontFamily: 'monospace' }}>{missedCount}</Typography>
        </Box>
      </Box>
    </Box>

    <Box
      sx={{
        p: '12px',
        bgcolor: '#22223a',
        borderRadius: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
      }}
    >
      {displayTokens.length === 0 && (
        <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>{labels.noTokens}</Typography>
      )}
      {displayTokens.map((token, index) => {
        const style = tokenStyleFromStatus(token.status)
        return (
          <Box
            key={`${token.text}-${index}`}
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: '4px',
              py: '1px',
              borderRadius: '6px',
              fontSize: '14px',
              lineHeight: 1.3,
              bgcolor: style.bg,
              color: style.color ?? 'text.primary',
              textDecoration: style.strike ? 'line-through' : 'none',
            }}
          >
            {token.text}
          </Box>
        )
      })}
    </Box>

    <Box sx={{ display: 'flex', gap: '10px' }}>
      <Button
        variant="contained"
        startIcon={<ReplayRounded sx={{ fontSize: '14px !important' }} />}
        onClick={onPracticeAgain}
        sx={{
          flex: 1.8,
          boxShadow: '0 8px 24px rgba(110,96,238,0.3)',
          background: 'linear-gradient(90deg, #6e60ee, #7a6cff)',
        }}
      >
        {labels.practiceAgain}
      </Button>
      <Button
        variant="outlined"
        onClick={onSubmitView}
        sx={{
          flex: 1,
          bgcolor: '#22223a',
          borderColor: 'rgba(255,255,255,0.13)',
          color: 'text.primary',
          '&:hover': {
            borderColor: 'rgba(255,255,255,0.13)',
            bgcolor: '#1a1a2c',
          },
        }}
      >
        {labels.submitView}
      </Button>
    </Box>

    <Box
      component="button"
      type="button"
      onClick={onSkipSegment}
      sx={{
        border: 'none',
        bgcolor: 'transparent',
        p: '6px 0',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'text.disabled',
        fontSize: '13px',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <ArrowForwardRounded sx={{ fontSize: 18 }} />
      {labels.skipSegment}
    </Box>
  </Box>
)

