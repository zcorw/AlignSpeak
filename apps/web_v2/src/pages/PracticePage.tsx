import { ArrowBackRounded } from '@mui/icons-material'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PracticeFullModePanel } from '../components/practice/PracticeFullModePanel'
import { PracticeProgressDrawer } from '../components/practice/PracticeProgressDrawer'
import { PracticeRecordEntry } from '../components/practice/PracticeRecordEntry'
import { PracticeRecordingOverlay } from '../components/practice/PracticeRecordingOverlay'
import { PracticeScorePanel } from '../components/practice/PracticeScorePanel'
import { PracticeSegmentCard } from '../components/practice/PracticeSegmentCard'
import { PracticeSyncBar } from '../components/practice/PracticeSyncBar'
import { PracticeTopBar } from '../components/practice/PracticeTopBar'
import { ReadSegmentButton } from '../components/practice/ReadSegmentButton'
import { PRACTICE_LEVELS, type PracticeMatrix } from '../components/practice/shared'
import { usePracticeAudio } from '../hooks/practice/usePracticeAudio'
import { usePracticeRecording } from '../hooks/practice/usePracticeRecording'
import { getApiErrorMessage } from '../services/authService'
import {
  type AlignmentResult,
} from '../services/practiceAttemptService'
import {
  practiceService,
  type PracticeLanguage,
  type PracticeLevel,
  type PracticeProgressCellState,
  type PracticeSegment,
} from '../services/practiceService'

type CellState = PracticeProgressCellState
type Level = PracticeLevel

const createFallbackProgressMatrix = (
  totalSegments: number,
  currentLevel: Level,
  currentSegmentOrder: number
): PracticeMatrix => {
  const safeTotalSegments = Math.max(totalSegments, 0)
  const matrix = PRACTICE_LEVELS.reduce(
    (acc, level) => {
      acc[level] = Array.from({ length: safeTotalSegments }, () => 'fail')
      return acc
    },
    {} as PracticeMatrix
  )
  if (safeTotalSegments <= 0) return matrix
  const currentIndex = Math.min(Math.max(currentSegmentOrder - 1, 0), safeTotalSegments - 1)
  matrix[currentLevel][currentIndex] = 'current'
  return matrix
}

const formatTimer = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

const parseLevelFromQuery = (value: string | null): Level | null => {
  if (value === 'L1' || value === '1') return 'L1'
  if (value === 'L2' || value === '2') return 'L2'
  if (value === 'L3' || value === '3') return 'L3'
  if (value === 'L4' || value === '4') return 'L4'
  return null
}

export const PracticePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showScore, setShowScore] = useState(false)
  const [showFullMode, setShowFullMode] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [level, setLevel] = useState<Level>(parseLevelFromQuery(searchParams.get('lv')) ?? 'L1')
  const [articleId, setArticleId] = useState<string | null>(null)
  const [articleTitle, setArticleTitle] = useState('')
  const [articleLanguage, setArticleLanguage] = useState<PracticeLanguage>('en')
  const [segments, setSegments] = useState<PracticeSegment[]>([])
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [alignmentResult, setAlignmentResult] = useState<AlignmentResult | null>(null)
  const [progressRefreshVersion, setProgressRefreshVersion] = useState(0)
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressMatrix, setProgressMatrix] = useState<PracticeMatrix>(
    createFallbackProgressMatrix(0, level, 1)
  )
  const [trendScores, setTrendScores] = useState<number[]>([])

  const alertFn = (globalThis as { alert?: (message?: string) => void }).alert
  const { isSpeaking, ttsLoading, speakSegment, stopSpeaking } = usePracticeAudio({
    failedMessage: t('pages.practice.readAloud.failed'),
    onError: (message) => alertFn?.(message),
  })

  const handleBeforeStart = useCallback(() => {
    setShowScore(false)
    setAlignmentResult(null)
  }, [])

  const handleAligned = useCallback((result: AlignmentResult) => {
    setAlignmentResult(result)
    setShowScore(true)
    setProgressRefreshVersion((prev) => prev + 1)
  }, [])

  const currentSegment = segments[segmentIndex] ?? null
  const segmentText = currentSegment?.plainText ?? ''
  const totalSegments = segments.length
  const currentSegmentOrder = currentSegment?.order ?? segmentIndex + 1
  const defaultTokenTotal = Math.max(currentSegment?.tokenCount ?? 1, 1)
  const languageLabel =
    articleLanguage === 'zh'
      ? t('common.languageChinese')
      : articleLanguage === 'ja'
        ? 'Japanese'
        : t('common.languageEnglish')
  const canPractice = Boolean(currentSegment) && !loading && !loadError
  const refTokens = alignmentResult?.refTokens ?? []
  const hypTokens = alignmentResult?.hypTokens ?? []
  const displayTokens = alignmentResult?.compareBlocks?.[0]?.recognized?.length
    ? alignmentResult.compareBlocks[0].recognized
    : hypTokens
  const tokenTotal = Math.max(refTokens.length || defaultTokenTotal, 1)
  const correctCount = refTokens.filter((token) => token.status === 'correct').length
  const wrongCount = refTokens.filter((token) => token.status === 'substitute').length
  const missedCount = refTokens.filter((token) => token.status === 'missing').length
  const score = alignmentResult ? Math.round(alignmentResult.accuracyRate * 100) : 0
  const passed = score >= 85

  const {
    recordOverlayOpen,
    recordSeconds,
    recognizing,
    showSyncBar,
    syncing,
    resultError,
    lastAttemptId,
    isRecording,
    startRecording,
    stopRecording,
    retrySync,
    clearFeedback,
  } = usePracticeRecording({
    currentSegment,
    canPractice,
    ttsLoading,
    isSpeaking,
    stopSpeaking,
    errorMessage: t('common.error'),
    onBeforeStart: handleBeforeStart,
    onAligned: handleAligned,
  })

  const recordingSegmentText = useMemo<ReactNode>(() => {
    if (articleLanguage !== 'ja' || !currentSegment?.tokens?.length) return segmentText
    return currentSegment.tokens.map((token, index) => {
      if (!token.surface.trim()) {
        return null
      }
      if (!token.yomi) {
        return <span key={`${token.surface}-${index}`}>{token.surface}</span>
      }
      return (
        <ruby key={`${token.surface}-${index}`} style={{ marginInline: '1px' }}>
          {token.surface}
          <rt style={{ fontSize: '0.56em', color: 'rgba(255,255,255,0.68)', fontWeight: 500 }}>{token.yomi}</rt>
        </ruby>
      )
    })
  }, [articleLanguage, currentSegment, segmentText])

  const handleSpeakSegment = useCallback(() => {
    void speakSegment({
      canPractice,
      articleId,
      segment: currentSegment,
    })
  }, [articleId, canPractice, currentSegment, speakSegment])

  const searchKey = searchParams.toString()
  const queryArticleId = searchParams.get('a') ?? searchParams.get('articleId')
  const querySegment = Number.parseInt(searchParams.get('seg') ?? '', 10)
  const queryLevel = parseLevelFromQuery(searchParams.get('lv'))

  useEffect(() => {
    let active = true

    const loadPracticeArticle = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const resolvedArticleId = await practiceService.resolveArticleId(queryArticleId)
        if (!resolvedArticleId) {
          throw new Error('No article available for practice.')
        }

        const practiceArticle = await practiceService.getPracticeArticle(resolvedArticleId)
        if (!active) return

        setArticleId(practiceArticle.articleId)
        setArticleTitle(practiceArticle.title)
        setArticleLanguage(practiceArticle.language)
        setSegments(practiceArticle.segments)
        sessionStorage.setItem('article_id', practiceArticle.articleId)
        sessionStorage.setItem('article_lang', practiceArticle.language)

        const total = practiceArticle.segments.length
        const maxIndex = Math.max(total - 1, 0)
        const matchedByOrder = Number.isFinite(querySegment)
          ? practiceArticle.segments.findIndex((segment) => segment.order === querySegment)
          : -1
        const fallbackIndex = Number.isFinite(querySegment) ? querySegment - 1 : 0
        const resolvedIndex = matchedByOrder >= 0 ? matchedByOrder : Math.min(Math.max(fallbackIndex, 0), maxIndex)
        setSegmentIndex(resolvedIndex)
      } catch (error: unknown) {
        if (!active) return
        setLoadError(getApiErrorMessage(error, t('common.error')))
      } finally {
        if (active) setLoading(false)
      }
    }

    if (queryLevel) {
      setLevel(queryLevel)
    }

    void loadPracticeArticle()
    return () => {
      active = false
    }
  }, [queryArticleId, queryLevel, querySegment, searchKey, t])

  useEffect(() => {
    let active = true

    if (!articleId || totalSegments <= 0) {
      setProgressLoading(false)
      setProgressMatrix(createFallbackProgressMatrix(totalSegments, level, currentSegmentOrder))
      return () => {
        active = false
      }
    }

    const loadProgress = async () => {
      setProgressLoading(true)
      try {
        const progress = await practiceService.getArticleProgress(articleId, {
          level,
          currentSegmentOrder,
        })
        if (!active) return
        const resolvedTotalSegments = progress.totalSegments > 0 ? progress.totalSegments : totalSegments
        const fallback = createFallbackProgressMatrix(resolvedTotalSegments, level, currentSegmentOrder)
        const matrix = PRACTICE_LEVELS.reduce(
          (acc, item) => {
            const source = progress.matrix[item]
            acc[item] = Array.isArray(source) && source.length > 0 ? source as CellState[] : fallback[item]
            return acc
          },
          {} as PracticeMatrix
        )
        setProgressMatrix(matrix)
        setTrendScores(progress.recentScores)
      } catch {
        if (!active) return
        setProgressMatrix(createFallbackProgressMatrix(totalSegments, level, currentSegmentOrder))
        setTrendScores([])
      } finally {
        if (active) setProgressLoading(false)
      }
    }

    void loadProgress()
    return () => {
      active = false
    }
  }, [articleId, currentSegmentOrder, level, progressRefreshVersion, totalSegments])

  useEffect(() => {
    stopSpeaking()
    setShowScore(false)
    setAlignmentResult(null)
    clearFeedback()
  }, [clearFeedback, segmentIndex, stopSpeaking])

  const switchLevel = (nextLevel: Level) => {
    if (nextLevel === level) return
    if (window.confirm(t('pages.practice.confirm.switchLevel', { level: nextLevel }))) {
      setLevel(nextLevel)
    }
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <PracticeTopBar
        articleTitle={articleTitle}
        languageLabel={languageLabel}
        onBack={() => navigate('/start')}
        onOpenDrawer={() => setDrawerOpen(true)}
        onOpenMe={() => navigate('/me')}
      />

      <PracticeSyncBar
        show={showSyncBar}
        syncing={syncing}
        disabled={!lastAttemptId}
        onRetry={() => {
          void retrySync()
        }}
        syncingLabel={t('pages.practice.sync.syncing')}
        retryLabel={t('pages.practice.sync.unsyncedRetry')}
      />

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: '20px',
          pt: '4px',
          pb: '32px',
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

        {loadError && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', p: '12px 14px', bgcolor: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.25)', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '13px', color: 'error.main' }}>{loadError}</Typography>
            <Button size="small" variant="outlined" onClick={() => navigate('/editor')}>
              {t('pages.start.importNewArticle')}
            </Button>
          </Box>
        )}

        {resultError && (
          <Box sx={{ p: '10px 12px', bgcolor: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.25)', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '12px', color: 'error.main' }}>{resultError}</Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ px: '10px', py: '3px', borderRadius: '999px', bgcolor: 'rgba(110,96,238,0.25)', border: '1px solid rgba(110,96,238,0.3)', color: 'primary.light', fontSize: '12px', fontWeight: 600 }}>
            {level}
          </Box>
          <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
            {t('pages.practice.meta.segmentProgress', { current: currentSegmentOrder, total: totalSegments })}
          </Typography>
          <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>
            {t('pages.practice.meta.targetAccuracy')}
          </Typography>
        </Box>

        <PracticeSegmentCard
          segmentLabel={t('pages.practice.segmentLabel', { segment: currentSegmentOrder })}
          segmentText={segmentText}
          readButton={(
            <ReadSegmentButton
              loading={ttsLoading}
              speaking={isSpeaking}
              disabled={recordOverlayOpen || !canPractice}
              onClick={handleSpeakSegment}
              loadingLabel={t('common.loading')}
              playLabel={t('pages.practice.readAloud.play')}
              stopLabel={t('pages.practice.readAloud.stop')}
            />
          )}
        />

        {!recognizing && !showScore && (
          <PracticeRecordEntry
            canPractice={canPractice}
            isRecording={isRecording}
            onStart={() => {
              void startRecording()
            }}
            label={t('pages.practice.startRecording')}
          />
        )}

        {recognizing && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', p: '32px' }}>
            <CircularProgress size={28} thickness={4} />
            <Typography sx={{ fontSize: '14px', color: 'text.secondary' }}>
              {t('pages.practice.recognizing')}
            </Typography>
          </Box>
        )}

        {showScore && (
          <PracticeScorePanel
            score={score}
            passed={passed}
            correctCount={correctCount}
            tokenTotal={tokenTotal}
            wrongCount={wrongCount}
            missedCount={missedCount}
            displayTokens={displayTokens}
            onPracticeAgain={() => {
              setShowScore(false)
              setAlignmentResult(null)
            }}
            onSubmitView={() => {
              if (!articleId) {
                navigate('/result')
                return
              }
              const params = new URLSearchParams({
                a: articleId,
                seg: String(currentSegmentOrder),
                lv: level,
              })
              if (lastAttemptId) {
                params.set('attempt', lastAttemptId)
                sessionStorage.setItem('last_attempt_id', lastAttemptId)
              }
              navigate(`/result?${params.toString()}`)
            }}
            onSkipSegment={() => {
              if (window.confirm(t('pages.practice.confirm.skipSegment'))) setShowScore(false)
            }}
            labels={{
              passed: t('pages.practice.score.passed'),
              failed: t('pages.practice.score.failed'),
              correctWords: t('pages.practice.score.correctWords'),
              wrongWords: t('pages.practice.score.wrongWords'),
              missedWords: t('pages.practice.score.missedWords'),
              noTokens: 'No alignment tokens available.',
              practiceAgain: t('pages.practice.actions.practiceAgain'),
              submitView: t('pages.practice.actions.submitView'),
              skipSegment: t('pages.practice.actions.skipSegment'),
            }}
          />
        )}

        <Box component="button" type="button" onClick={() => setShowFullMode((prev) => !prev)} sx={{ border: 'none', bgcolor: 'transparent', p: '8px 0', color: 'text.secondary', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <ArrowBackRounded sx={{ fontSize: 14, transform: showFullMode ? 'rotate(-90deg)' : 'rotate(-270deg)', transition: 'transform 0.25s' }} />
          {showFullMode ? t('pages.practice.fullMode.collapse') : t('pages.practice.fullMode.expand')}
        </Box>

        {showFullMode && (
          <PracticeFullModePanel
            trends={trendScores.length > 0 ? trendScores : [score]}
            matrix={progressMatrix}
            level={level}
            onSwitchLevel={switchLevel}
            labels={{
              trend: t('pages.practice.fullMode.trend'),
              matrix: t('pages.practice.fullMode.matrix'),
              switchLevel: t('pages.practice.fullMode.switchLevel'),
              switchLevelHint: t('pages.practice.fullMode.switchLevelHint'),
            }}
          />
        )}
      </Box>

      <PracticeRecordingOverlay
        open={recordOverlayOpen}
        timerText={formatTimer(recordSeconds)}
        segmentLabel={t('pages.practice.segmentLabel', { segment: currentSegmentOrder })}
        segmentText={recordingSegmentText}
        readButton={(
          <ReadSegmentButton
            variant="text"
            loading={ttsLoading}
            speaking={isSpeaking}
            disabled={!canPractice}
            onClick={handleSpeakSegment}
            loadingLabel={t('common.loading')}
            playLabel={t('pages.practice.readAloud.play')}
            stopLabel={t('pages.practice.readAloud.stop')}
          />
        )}
        recordingStatusLabel={t('pages.practice.recording.status')}
        stopLabel={t('pages.practice.recording.stop')}
        onClose={stopRecording}
        onStop={stopRecording}
      />

      <PracticeProgressDrawer
        open={drawerOpen}
        loading={progressLoading}
        title={t('pages.practice.drawer.title')}
        articleInfo={t('pages.practice.drawer.articleInfo', { total: totalSegments })}
        loadingLabel={t('common.loading')}
        matrix={progressMatrix}
        legend={{
          pass: t('pages.practice.drawer.legend.pass'),
          current: t('pages.practice.drawer.legend.current'),
          skipped: t('pages.practice.drawer.legend.skipped'),
          incomplete: t('pages.practice.drawer.legend.incomplete'),
        }}
        onClose={() => setDrawerOpen(false)}
      />
    </Box>
  )
}
