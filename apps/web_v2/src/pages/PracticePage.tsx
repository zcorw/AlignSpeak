import { ArrowBackRounded } from '@mui/icons-material'
import { Box, CircularProgress, Typography } from '@mui/material'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PracticeFullModePanel } from '../components/practice/PracticeFullModePanel'
import { PracticeMetaBar } from '../components/practice/PracticeMetaBar'
import { PracticeProgressDrawer } from '../components/practice/PracticeProgressDrawer'
import { PracticeRecordEntry } from '../components/practice/PracticeRecordEntry'
import { PracticeRecordingOverlay } from '../components/practice/PracticeRecordingOverlay'
import { PracticeScorePanel } from '../components/practice/PracticeScorePanel'
import { PracticeSegmentCard } from '../components/practice/PracticeSegmentCard'
import { PracticeStatusBanners } from '../components/practice/PracticeStatusBanners'
import { PracticeSyncBar } from '../components/practice/PracticeSyncBar'
import { PracticeTopBar } from '../components/practice/PracticeTopBar'
import { ReadSegmentButton } from '../components/practice/ReadSegmentButton'
import { type PracticeLevel } from '../services/practiceService'
import { type AlignmentResult } from '../services/practiceAttemptService'
import { usePracticeAudio } from '../hooks/practice/usePracticeAudio'
import { usePracticeData } from '../hooks/practice/usePracticeData'
import { usePracticeRecording } from '../hooks/practice/usePracticeRecording'
import { usePracticeRouteState } from '../hooks/practice/usePracticeRouteState'

type Level = PracticeLevel

const formatTimer = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

export const PracticePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showScore, setShowScore] = useState(false)
  const [showFullMode, setShowFullMode] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [alignmentResult, setAlignmentResult] = useState<AlignmentResult | null>(null)
  const [progressRefreshVersion, setProgressRefreshVersion] = useState(0)
  const { level, setLevel, queryArticleId, querySegment, searchKey } = usePracticeRouteState()
  const {
    articleId,
    articleTitle,
    articleLanguage,
    segmentIndex,
    loading,
    loadError,
    currentSegment,
    totalSegments,
    currentSegmentOrder,
    progressLoading,
    progressMatrix,
    trendScores,
  } = usePracticeData({
    level,
    queryArticleId,
    querySegment,
    searchKey,
    progressRefreshVersion,
    errorMessage: t('common.error'),
  })

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

  const segmentText = currentSegment?.plainText ?? ''
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
        <PracticeStatusBanners
          loading={loading}
          loadError={loadError}
          resultError={resultError}
          loadingLabel={t('common.loading')}
          importLabel={t('pages.start.importNewArticle')}
          onImport={() => navigate('/editor')}
        />

        <PracticeMetaBar
          level={level}
          segmentProgressLabel={t('pages.practice.meta.segmentProgress', { current: currentSegmentOrder, total: totalSegments })}
          targetAccuracyLabel={t('pages.practice.meta.targetAccuracy')}
        />

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
