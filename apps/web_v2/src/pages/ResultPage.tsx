import { Box, CircularProgress, Typography } from '@mui/material'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ResultActionsCard } from '../components/result/ResultActionsCard'
import { ResultAttemptAudioButton } from '../components/result/ResultAttemptAudioButton'
import { ResultAlignmentPanel } from '../components/result/ResultAlignmentPanel'
import { ResultBreakdownStats } from '../components/result/ResultBreakdownStats'
import { ResultErrorState } from '../components/result/ResultErrorState'
import { ResultLevelUpCard } from '../components/result/ResultLevelUpCard'
import { ResultProgressMatrix } from '../components/result/ResultProgressMatrix'
import { ResultScoreCard } from '../components/result/ResultScoreCard'
import { ResultTopBar } from '../components/result/ResultTopBar'
import { nextLevel, TARGET } from '../components/result/shared'
import { useResultData } from '../hooks/result/useResultData'

export const ResultPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { level, loading, error, detail, matrix, matrixLoading } = useResultData(searchParams)

  const score = useMemo(() => Math.round((detail?.accuracyRate ?? 0) * 100), [detail])
  const passed = score >= TARGET
  const currentLevelStates = matrix[level] ?? []
  const levelUnlocked = currentLevelStates.length > 0 && currentLevelStates.every((state) => state === 'pass')
  const unlockedLevel = nextLevel(level)
  const nextSegmentOrder =
    detail && detail.totalSegments > 0 ? Math.min(detail.segmentOrder + 1, detail.totalSegments) : 1

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ResultTopBar
        articleTitle={detail?.articleTitle ?? '...'}
        subtitle={detail ? `${level} 路 Segment ${detail.segmentOrder}/${detail.totalSegments}` : t('common.loading')}
        onBack={() => navigate(detail ? `/practice?a=${detail.articleId}&seg=${detail.segmentOrder}&lv=${level}` : '/practice')}
        onOpenMe={() => navigate('/me')}
      />

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
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', p: '12px 14px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '12px' }}>
            <CircularProgress size={16} thickness={5} />
            <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>{t('common.loading')}</Typography>
          </Box>
        )}

        {error && <ResultErrorState message={error} />}

        {!loading && !error && detail && (
          <>
            <ResultScoreCard detail={detail} level={level} score={score} passed={passed} />
            <ResultAttemptAudioButton attemptId={detail.attemptId} />
            <ResultBreakdownStats detail={detail} />
            <ResultAlignmentPanel refTokens={detail.refTokens} hypTokens={detail.hypTokens} />
            <ResultProgressMatrix
              matrix={matrix}
              loading={matrixLoading}
              onSelectSegment={(selectedLevel, segmentOrder, state) => {
                if (state === 'pass' || state === 'current') {
                  navigate(`/practice?a=${detail.articleId}&seg=${segmentOrder}&lv=${selectedLevel}`)
                }
              }}
            />

            {levelUnlocked && unlockedLevel && (
              <ResultLevelUpCard
                unlockedLevel={unlockedLevel}
                onStart={(selectedLevel) => navigate(`/practice?a=${detail.articleId}&seg=1&lv=${selectedLevel}`)}
              />
            )}

            <ResultActionsCard
              passed={passed}
              onPracticeAgain={() => navigate(`/practice?a=${detail.articleId}&seg=${detail.segmentOrder}&lv=${level}`)}
              onNextSegment={() => navigate(`/practice?a=${detail.articleId}&seg=${nextSegmentOrder}&lv=${level}`)}
            />
          </>
        )}
      </Box>
    </Box>
  )
}
