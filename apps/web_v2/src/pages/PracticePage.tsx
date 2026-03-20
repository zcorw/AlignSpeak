import { ArrowBackRounded } from '@mui/icons-material'
import { Box, CircularProgress, Typography } from '@mui/material'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PracticeFullModePanel } from '../components/practice/PracticeFullModePanel'
import { PracticeFuriganaEditEntry } from '../components/practice/PracticeFuriganaEditEntry'
import { PracticeFuriganaEditorBar } from '../components/practice/PracticeFuriganaEditorBar'
import { PracticeFuriganaText } from '../components/practice/PracticeFuriganaText'
import { PracticeMaskedPlainText } from '../components/practice/PracticeMaskedPlainText'
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
import { type PracticeLevel, type SegmentReadingOverrideInput } from '../services/practiceService'
import { type AlignmentResult } from '../services/practiceAttemptService'
import { usePracticeAudio } from '../hooks/practice/usePracticeAudio'
import { usePracticeData } from '../hooks/practice/usePracticeData'
import { usePracticeFuriganaEditor } from '../hooks/practice/usePracticeFuriganaEditor'
import { usePracticeFuriganaSync } from '../hooks/practice/usePracticeFuriganaSync'
import { usePracticeRecording } from '../hooks/practice/usePracticeRecording'
import { usePracticeRouteState } from '../hooks/practice/usePracticeRouteState'
import { computeMaskedReadingTokenIndices } from '../components/practice/masking'
import { buildSentenceTextRanges, splitTextToSentences } from '../components/practice/timelineText'
import { useConfirm, useNotifier } from '../components/common/feedbackHooks'

type Level = PracticeLevel
type SegmentResultState = {
  segmentKey: string | null
  alignmentResult: AlignmentResult | null
  showScore: boolean
}

const formatTimer = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

export const PracticePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const { error: notifyError } = useNotifier()
  const [showFullMode, setShowFullMode] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [segmentResultState, setSegmentResultState] = useState<SegmentResultState>({
    segmentKey: null,
    alignmentResult: null,
    showScore: false,
  })
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
  const activeSegmentKey = `${articleId ?? queryArticleId ?? 'unknown'}:${segmentIndex}`
  const alignmentResult =
    segmentResultState.segmentKey === activeSegmentKey ? segmentResultState.alignmentResult : null
  const showScore = segmentResultState.segmentKey === activeSegmentKey && segmentResultState.showScore

  const {
    isSpeaking,
    ttsLoading,
    speakSegment,
    stopSpeaking,
    timelineSentences,
    activeTimelineSentenceIndex,
    playSentence,
  } = usePracticeAudio({
    failedMessage: t('pages.practice.readAloud.failed'),
    onError: notifyError,
  })

  const handleAligned = useCallback((result: AlignmentResult) => {
    setSegmentResultState({
      segmentKey: activeSegmentKey,
      alignmentResult: result,
      showScore: true,
    })
    setProgressRefreshVersion((prev) => prev + 1)
  }, [activeSegmentKey])

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
    tokens: syncedReadingTokens,
    saving: furiganaSaving,
    error: furiganaSyncError,
    scheduleReplaceOverrides,
    flushPendingOverrides,
  } = usePracticeFuriganaSync({
    segmentId: currentSegment?.id ?? null,
    language: articleLanguage,
    fallbackTokens: currentSegment?.tokens,
    errorMessage: t('common.error'),
  })

  const handleOverridesChange = useCallback(
    (overrides: SegmentReadingOverrideInput[]) => {
      scheduleReplaceOverrides(overrides)
    },
    [scheduleReplaceOverrides]
  )

  const {
    canEdit: canEditFurigana,
    isEditMode,
    activeTokenIndex,
    activeToken,
    activeYomi,
    mergedTokens: readingTokens,
    setEditMode,
    toggleEditMode,
    selectToken,
    setActiveYomi,
    resetActiveToken,
    focusPrevToken,
    focusNextToken,
  } = usePracticeFuriganaEditor({
    language: articleLanguage,
    tokens: syncedReadingTokens,
    enabled: canPractice,
    onOverridesChange: handleOverridesChange,
  })

  const handleBeforeStart = useCallback(async () => {
    setEditMode(false)
    try {
      await flushPendingOverrides()
    } catch {
      // Keep local overrides and continue recording flow.
    }
    setSegmentResultState({
      segmentKey: activeSegmentKey,
      alignmentResult: null,
      showScore: false,
    })
  }, [activeSegmentKey, flushPendingOverrides, setEditMode])

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
    cancelRecording,
    retrySync,
    clearFeedback,
  } = usePracticeRecording({
    level,
    currentSegment,
    canPractice,
    ttsLoading,
    isSpeaking,
    stopSpeaking,
    notifyError,
    errorMessage: t('common.error'),
    onBeforeStart: handleBeforeStart,
    onAligned: handleAligned,
  })

  const handleSpeakSegment = useCallback(() => {
    void speakSegment({
      canPractice,
      articleId,
      segment: currentSegment,
    })
  }, [articleId, canPractice, currentSegment, speakSegment])

  const furiganaEditableUIVisible =
    canEditFurigana && !recordOverlayOpen && !recognizing && !showScore && !loading && !loadError
  const isMaskingPhase = recordOverlayOpen || recognizing
  const maskingDisabled = !isMaskingPhase || (isEditMode && furiganaEditableUIVisible)
  const supportsReadingTokens = articleLanguage === 'ja' || articleLanguage === 'zh'

  const maskedReadingTokenIndices = useMemo(() => {
    if (!supportsReadingTokens) return new Set<number>()
    if (!currentSegment || maskingDisabled) return new Set<number>()
    return computeMaskedReadingTokenIndices(currentSegment.id, level, readingTokens)
  }, [currentSegment, level, maskingDisabled, readingTokens, supportsReadingTokens])

  const recordingMaskedReadingTokenIndices = useMemo(() => {
    if (!supportsReadingTokens) return new Set<number>()
    if (!currentSegment) return new Set<number>()
    return computeMaskedReadingTokenIndices(currentSegment.id, level, readingTokens)
  }, [currentSegment, level, readingTokens, supportsReadingTokens])

  const displayTimelineSentences = useMemo(
    () => (timelineSentences.length ? timelineSentences : splitTextToSentences(segmentText)),
    [segmentText, timelineSentences]
  )

  const timelineSentenceRanges = useMemo(
    () => buildSentenceTextRanges(segmentText, displayTimelineSentences),
    [displayTimelineSentences, segmentText]
  )

  const handleSelectTimelineSentence = useCallback((sentenceIndex: number) => {
    void playSentence({
      canPractice,
      articleId,
      segment: currentSegment,
      sentenceIndex,
    })
  }, [articleId, canPractice, currentSegment, playSentence])

  const recordingSegmentText = useMemo<ReactNode>(() => {
    if (supportsReadingTokens) {
      return (
        <PracticeFuriganaText
          tokens={readingTokens}
          fallbackText={segmentText}
          editable={false}
          activeTokenIndex={null}
          maskedTokenIndices={recordingMaskedReadingTokenIndices}
          sentenceRanges={timelineSentenceRanges}
          activeSentenceIndex={activeTimelineSentenceIndex}
          onSelectSentence={handleSelectTimelineSentence}
        />
      )
    }
    return (
      <PracticeMaskedPlainText
        text={segmentText}
        language={articleLanguage}
        level={level}
        segmentId={currentSegment?.id ?? 'seg_unknown'}
        sentenceRanges={timelineSentenceRanges}
        activeSentenceIndex={activeTimelineSentenceIndex}
        onSelectSentence={handleSelectTimelineSentence}
      />
    )
  }, [
    activeTimelineSentenceIndex,
    articleLanguage,
    currentSegment,
    handleSelectTimelineSentence,
    level,
    readingTokens,
    recordingMaskedReadingTokenIndices,
    segmentText,
    supportsReadingTokens,
    timelineSentenceRanges,
  ])

  const segmentContent = supportsReadingTokens ? (
    <PracticeFuriganaText
      tokens={readingTokens}
      fallbackText={segmentText}
      editable={isEditMode && furiganaEditableUIVisible}
      activeTokenIndex={activeTokenIndex}
      maskedTokenIndices={maskedReadingTokenIndices}
      onSelectToken={selectToken}
      sentenceRanges={timelineSentenceRanges}
      activeSentenceIndex={activeTimelineSentenceIndex}
      onSelectSentence={handleSelectTimelineSentence}
    />
  ) : (
    <PracticeMaskedPlainText
      text={segmentText}
      language={articleLanguage}
      level={level}
      segmentId={currentSegment?.id ?? 'seg_unknown'}
      maskingDisabled={maskingDisabled}
      sentenceRanges={timelineSentenceRanges}
      activeSentenceIndex={activeTimelineSentenceIndex}
      onSelectSentence={handleSelectTimelineSentence}
    />
  )

  useEffect(() => {
    stopSpeaking()
    clearFeedback()
    setEditMode(false)
  }, [clearFeedback, segmentIndex, setEditMode, stopSpeaking])

  useEffect(() => {
    if (furiganaEditableUIVisible) return
    setEditMode(false)
  }, [furiganaEditableUIVisible, setEditMode])

  const switchLevel = (nextLevel: Level) => {
    if (nextLevel === level) return
    void (async () => {
      const accepted = await confirm({
        message: t('pages.practice.confirm.switchLevel', { level: nextLevel }),
      })
      if (accepted) {
        setLevel(nextLevel)
      }
    })()
  }

  const handleSelectSegment = useCallback((segmentOrder: number) => {
    if (segmentOrder === currentSegmentOrder) {
      setDrawerOpen(false)
      return
    }
    const targetArticleId = articleId ?? queryArticleId
    if (!targetArticleId) return
    const params = new URLSearchParams({
      a: targetArticleId,
      seg: String(segmentOrder),
      lv: level,
    })
    setDrawerOpen(false)
    navigate(`/practice?${params.toString()}`, { replace: true })
  }, [articleId, currentSegmentOrder, level, navigate, queryArticleId])

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
          segmentText={segmentContent}
          middleControls={(
            <>
              <PracticeFuriganaEditEntry
                visible={furiganaEditableUIVisible}
                active={isEditMode}
                buttonLabel={isEditMode ? t('pages.practice.furigana.finish') : t('pages.practice.furigana.entry')}
                hintLabel={isEditMode ? t('pages.practice.furigana.editingHint') : t('pages.practice.furigana.weakHint')}
                onToggle={toggleEditMode}
              />
              <PracticeFuriganaEditorBar
                visible={furiganaEditableUIVisible && isEditMode}
                activeSurface={activeToken?.surface ?? null}
                activeYomi={activeYomi}
                saving={furiganaSaving}
                syncError={furiganaSyncError}
                emptyLabel={t('pages.practice.furigana.empty')}
                placeholder={t('pages.practice.furigana.inputPlaceholder')}
                resetLabel={t('pages.practice.furigana.reset')}
                prevLabel={t('pages.practice.furigana.prev')}
                nextLabel={t('pages.practice.furigana.next')}
                savingLabel={t('pages.practice.furigana.saving')}
                onChangeYomi={setActiveYomi}
                onReset={resetActiveToken}
                onPrev={focusPrevToken}
                onNext={focusNextToken}
              />
            </>
          )}
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
              setSegmentResultState({
                segmentKey: activeSegmentKey,
                alignmentResult: null,
                showScore: false,
              })
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
              void (async () => {
                const accepted = await confirm({
                  message: t('pages.practice.confirm.skipSegment'),
                })
                if (accepted) {
                  setSegmentResultState({
                    segmentKey: activeSegmentKey,
                    alignmentResult: null,
                    showScore: false,
                  })
                }
              })()
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
            labels={{
              trend: t('pages.practice.fullMode.trend'),
              matrix: t('pages.practice.fullMode.matrix'),
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
        onClose={cancelRecording}
        onStop={stopRecording}
      />

      <PracticeProgressDrawer
        open={drawerOpen}
        loading={progressLoading}
        title={t('pages.practice.drawer.title')}
        articleInfo={t('pages.practice.drawer.articleInfo', { total: totalSegments })}
        loadingLabel={t('common.loading')}
        matrix={progressMatrix}
        level={level}
        totalSegments={totalSegments}
        currentSegmentOrder={currentSegmentOrder}
        switchLevelLabel={t('pages.practice.fullMode.switchLevel')}
        switchLevelHint={t('pages.practice.fullMode.switchLevelHint')}
        legend={{
          pass: t('pages.practice.drawer.legend.pass'),
          current: t('pages.practice.drawer.legend.current'),
          skipped: t('pages.practice.drawer.legend.skipped'),
          incomplete: t('pages.practice.drawer.legend.incomplete'),
        }}
        onSwitchLevel={switchLevel}
        onSelectSegment={handleSelectSegment}
        onClose={() => setDrawerOpen(false)}
      />
    </Box>
  )
}
