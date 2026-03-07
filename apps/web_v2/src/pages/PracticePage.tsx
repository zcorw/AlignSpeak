import {
  ArrowBackRounded,
  ArrowForwardRounded,
  CloseRounded,
  GridViewRounded,
  MicRounded,
  PersonOutlineRounded,
  RefreshRounded,
  ReplayRounded,
  StopRounded,
  VolumeUpRounded,
} from '@mui/icons-material'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getApiErrorMessage } from '../services/authService'
import {
  practiceAttemptService,
  type AlignmentResult,
  type AlignmentStatus,
} from '../services/practiceAttemptService'
import {
  practiceService,
  type PracticeLanguage,
  type PracticeLevel,
  type PracticeProgressCellState,
  type PracticeSegment,
} from '../services/practiceService'
import { ttsService } from '../services/ttsService'

type CellState = PracticeProgressCellState
type Level = PracticeLevel

const TRENDS = [62, 70, 75, 78]
const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4']

const createFallbackProgressMatrix = (
  totalSegments: number,
  currentLevel: Level,
  currentSegmentOrder: number
): Record<Level, CellState[]> => {
  const safeTotalSegments = Math.max(totalSegments, 0)
  const matrix = LEVELS.reduce(
    (acc, level) => {
      acc[level] = Array.from({ length: safeTotalSegments }, () => 'fail')
      return acc
    },
    {} as Record<Level, CellState[]>
  )
  if (safeTotalSegments <= 0) return matrix
  const currentIndex = Math.min(Math.max(currentSegmentOrder - 1, 0), safeTotalSegments - 1)
  matrix[currentLevel][currentIndex] = 'current'
  return matrix
}

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

const Matrix = ({ matrix, compact = false }: { matrix: Record<Level, CellState[]>; compact?: boolean }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {LEVELS.map((level) => (
      <Box key={level} sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Typography
          sx={{
            width: 22,
            fontSize: '11px',
            fontWeight: 700,
            color: 'text.disabled',
            fontFamily: '"SF Mono", "Fira Code", monospace',
          }}
        >
          {level}
        </Typography>
        <Box sx={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {(matrix[level] ?? []).map((state, i) => (
            <Box
              key={`${level}-${i}`}
              sx={{
                width: compact ? 20 : 28,
                height: compact ? 20 : 28,
                borderRadius: '6px',
                border: '1px solid transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: compact ? 9 : 11,
                fontWeight: 700,
                ...(state === 'pass' && {
                  bgcolor: 'rgba(29,201,138,0.1)',
                  color: 'success.main',
                  borderColor: 'rgba(29,201,138,0.2)',
                }),
                ...(state === 'current' && {
                  bgcolor: 'rgba(110,96,238,0.25)',
                  color: 'primary.light',
                  borderColor: '#6e60ee',
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
              }}
            >
              {state === 'pass' ? 'OK' : state === 'current' ? i + 1 : state === 'skip' ? '->' : '-'}
            </Box>
          ))}
        </Box>
      </Box>
    ))}
  </Box>
)

const formatTimer = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

const parseLevelFromQuery = (value: string | null): Level | null => {
  if (value === 'L1' || value === '1') return 'L1'
  if (value === 'L2' || value === '2') return 'L2'
  if (value === 'L3' || value === '3') return 'L3'
  if (value === 'L4' || value === '4') return 'L4'
  return null
}

const CHUNK_DURATION_MS = 1200

const tokenStyleFromStatus = (status: AlignmentStatus): { bg: string; color?: string; strike?: boolean } => {
  if (status === 'correct') return { bg: 'rgba(29,201,138,0.12)' }
  if (status === 'substitute') return { bg: 'rgba(240,82,82,0.2)', color: 'error.main', strike: true }
  if (status === 'missing') return { bg: 'rgba(240,166,35,0.18)', color: 'warning.main' }
  return { bg: 'rgba(240,82,82,0.1)', color: 'text.secondary' }
}

export const PracticePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recordingIdRef = useRef<string | null>(null)
  const recordingSegmentIdRef = useRef<string | null>(null)
  const chunkSeqRef = useRef(0)
  const uploadTasksRef = useRef<Array<Promise<void>>>([])
  const recordingStartAtRef = useRef<number | null>(null)
  const finalizingRef = useRef(false)
  const [showSyncBar, setShowSyncBar] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const [showScore, setShowScore] = useState(false)
  const [showFullMode, setShowFullMode] = useState(false)
  const [recordOverlayOpen, setRecordOverlayOpen] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [level, setLevel] = useState<Level>(parseLevelFromQuery(searchParams.get('lv')) ?? 'L1')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [articleId, setArticleId] = useState<string | null>(null)
  const [articleTitle, setArticleTitle] = useState('')
  const [articleLanguage, setArticleLanguage] = useState<PracticeLanguage>('en')
  const [segments, setSegments] = useState<PracticeSegment[]>([])
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [resultError, setResultError] = useState<string | null>(null)
  const [alignmentResult, setAlignmentResult] = useState<AlignmentResult | null>(null)
  const [lastAttemptId, setLastAttemptId] = useState<string | null>(null)
  const [progressRefreshVersion, setProgressRefreshVersion] = useState(0)
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressMatrix, setProgressMatrix] = useState<Record<Level, CellState[]>>(
    createFallbackProgressMatrix(0, level, 1)
  )

  useEffect(() => {
    if (!recordOverlayOpen) return undefined
    const timer = window.setInterval(() => setRecordSeconds((prev) => prev + 1), 1000)
    return () => window.clearInterval(timer)
  }, [recordOverlayOpen])

  useEffect(() => {
    if (!showSyncBar || syncing) return undefined
    const timer = window.setTimeout(() => setShowSyncBar(false), 4000)
    return () => window.clearTimeout(timer)
  }, [showSyncBar, syncing])

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

        const requestedIndex = Number.isFinite(querySegment) ? querySegment - 1 : 0
        const clampedIndex = Math.min(Math.max(requestedIndex, 0), Math.max(practiceArticle.segments.length - 1, 0))
        setSegmentIndex(clampedIndex)
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

  const currentSegment = segments[segmentIndex] ?? null
  const segmentText = currentSegment?.plainText ?? ''
  const totalSegments = segments.length
  const currentSegmentOrder = currentSegment?.order ?? segmentIndex + 1
  const defaultTokenTotal = Math.max(currentSegment?.tokenCount ?? 1, 1)
  const languageLabel =
    articleLanguage === 'zh' ? t('common.languageChinese') : articleLanguage === 'ja' ? 'Japanese' : t('common.languageEnglish')
  const canPractice = Boolean(currentSegment) && !loading && !loadError
  const isRecording = Boolean(mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive')
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
        const matrix = LEVELS.reduce(
          (acc, item) => {
            const source = progress.matrix[item]
            acc[item] = Array.isArray(source) && source.length > 0 ? source : fallback[item]
            return acc
          },
          {} as Record<Level, CellState[]>
        )
        setProgressMatrix(matrix)
      } catch {
        if (!active) return
        setProgressMatrix(createFallbackProgressMatrix(totalSegments, level, currentSegmentOrder))
      } finally {
        if (active) setProgressLoading(false)
      }
    }

    void loadProgress()
    return () => {
      active = false
    }
  }, [articleId, currentSegmentOrder, level, progressRefreshVersion, totalSegments])

  const renderRecordingSegmentText = (): ReactNode => {
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
  }

  const stopSpeaking = () => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current)
      audioObjectUrlRef.current = null
    }
    setIsSpeaking(false)
  }

  const cleanupRecordingMedia = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    mediaRecorderRef.current = null
    const stream = mediaStreamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
    mediaStreamRef.current = null
  }

  const resetRecordingState = () => {
    recordingIdRef.current = null
    recordingSegmentIdRef.current = null
    chunkSeqRef.current = 0
    uploadTasksRef.current = []
    recordingStartAtRef.current = null
  }

  const isInterruptedPlayError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false
    const message = error.message.toLowerCase()
    return message.includes('play() request was interrupted') || message.includes('interrupted by a call to pause()')
  }

  const speakSegment = async () => {
    if (!canPractice || !articleId || !currentSegment) return
    if (isSpeaking) {
      stopSpeaking()
      return
    }

    setTtsLoading(true)
    try {
      const job = await ttsService.createTtsJob(articleId, currentSegment.id, 1.0)
      const finalStatus = await ttsService.waitForDone(job.jobId)
      if (finalStatus.status !== 'done' || !finalStatus.audioUrl) {
        const message =
          finalStatus.errorCode === 'TTS_TIMEOUT'
            ? 'TTS timeout.'
            : finalStatus.errorCode
              ? `TTS failed: ${finalStatus.errorCode}`
              : t('pages.practice.readAloud.failed')
        throw new Error(message)
      }

      const sourceUrl = await ttsService.fetchAudioObjectUrl(finalStatus.audioUrl)
      const audio = new Audio(sourceUrl)
      audioObjectUrlRef.current = sourceUrl
      audio.onended = () => {
        if (audioObjectUrlRef.current) {
          URL.revokeObjectURL(audioObjectUrlRef.current)
          audioObjectUrlRef.current = null
        }
        setIsSpeaking(false)
        audioRef.current = null
      }
      audio.onerror = () => {
        if (audioObjectUrlRef.current) {
          URL.revokeObjectURL(audioObjectUrlRef.current)
          audioObjectUrlRef.current = null
        }
        setIsSpeaking(false)
        audioRef.current = null
      }
      audioRef.current = audio
      setIsSpeaking(true)
      await audio.play()
    } catch (error: unknown) {
      if (!isInterruptedPlayError(error)) {
        const alertFn = (globalThis as { alert?: (message?: string) => void }).alert
        alertFn?.(getApiErrorMessage(error, t('pages.practice.readAloud.failed')))
      }
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current)
        audioObjectUrlRef.current = null
      }
      setIsSpeaking(false)
      audioRef.current = null
    } finally {
      setTtsLoading(false)
    }
  }

  const runFinishAndAlign = async () => {
    if (finalizingRef.current) return
    finalizingRef.current = true
    setRecognizing(true)
    setShowScore(false)
    setShowSyncBar(false)
    setResultError(null)
    try {
      const recordingId = recordingIdRef.current
      const segmentId = recordingSegmentIdRef.current
      if (!recordingId || !segmentId) {
        throw new Error('Recording session is missing.')
      }
      await Promise.all(uploadTasksRef.current)
      const totalChunks = chunkSeqRef.current
      if (totalChunks <= 0) {
        throw new Error('No recording chunks uploaded.')
      }
      const elapsedMs = recordingStartAtRef.current ? Date.now() - recordingStartAtRef.current : recordSeconds * 1000
      const finishRes = await practiceAttemptService.finishRecording(recordingId, totalChunks, Math.max(elapsedMs, 1))
      const sttStatus = await practiceAttemptService.waitSttDone(finishRes.jobId)
      if (sttStatus.status !== 'done' || !sttStatus.attempt_id) {
        const reason = sttStatus.error_code ?? 'STT_PROVIDER_ERROR'
        throw new Error(`STT failed: ${reason}`)
      }
      setLastAttemptId(sttStatus.attempt_id)
      const alignResult = await practiceAttemptService.alignAttempt(sttStatus.attempt_id, segmentId, sttStatus.recognized_text)
      setAlignmentResult(alignResult)
      setShowScore(true)
      setProgressRefreshVersion((prev) => prev + 1)
    } catch (error: unknown) {
      setResultError(getApiErrorMessage(error, t('common.error')))
      setShowSyncBar(true)
    } finally {
      setRecognizing(false)
      cleanupRecordingMedia()
      resetRecordingState()
      finalizingRef.current = false
    }
  }

  const startRecording = async () => {
    if (ttsLoading || !canPractice || !currentSegment || recognizing || isRecording) return
    if (isSpeaking) stopSpeaking()
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      const alertFn = (globalThis as { alert?: (message?: string) => void }).alert
      alertFn?.('MediaRecorder is not supported in this browser.')
      return
    }
    try {
      setResultError(null)
      setShowSyncBar(false)
      setShowScore(false)
      setAlignmentResult(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const started = await practiceAttemptService.startRecording(currentSegment.id)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : undefined
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder
      recordingIdRef.current = started.recordingId
      recordingSegmentIdRef.current = currentSegment.id
      chunkSeqRef.current = 0
      uploadTasksRef.current = []
      recordingStartAtRef.current = Date.now()
      setRecordSeconds(0)
      setRecordOverlayOpen(true)

      recorder.ondataavailable = (event: BlobEvent) => {
        if (!recordingIdRef.current || event.data.size <= 0) return
        const seq = chunkSeqRef.current
        chunkSeqRef.current += 1
        const task = practiceAttemptService.uploadChunk(recordingIdRef.current, seq, event.data, CHUNK_DURATION_MS)
        uploadTasksRef.current.push(task)
      }
      recorder.onstop = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop())
        }
        void runFinishAndAlign()
      }
      recorder.start(CHUNK_DURATION_MS)
    } catch (error: unknown) {
      cleanupRecordingMedia()
      resetRecordingState()
      setRecordOverlayOpen(false)
      setRecognizing(false)
      setShowSyncBar(true)
      setResultError(getApiErrorMessage(error, t('common.error')))
    }
  }

  const stopRecording = () => {
    stopSpeaking()
    setRecordOverlayOpen(false)
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state !== 'inactive') {
      recorder.stop()
      return
    }
    void runFinishAndAlign()
  }

  const retrySync = async () => {
    if (!lastAttemptId || !currentSegment) return
    setSyncing(true)
    try {
      const alignResult = await practiceAttemptService.alignAttempt(lastAttemptId, currentSegment.id)
      setAlignmentResult(alignResult)
      setShowScore(true)
      setShowSyncBar(false)
      setResultError(null)
      setProgressRefreshVersion((prev) => prev + 1)
    } catch (error: unknown) {
      setResultError(getApiErrorMessage(error, t('common.error')))
      setShowSyncBar(true)
    } finally {
      setSyncing(false)
    }
  }

  const switchLevel = (nextLevel: Level) => {
    if (nextLevel === level) return
    if (window.confirm(t('pages.practice.confirm.switchLevel', { level: nextLevel }))) {
      setLevel(nextLevel)
    }
  }

  useEffect(() => {
    return () => {
      stopSpeaking()
      cleanupRecordingMedia()
      resetRecordingState()
    }
  }, [])

  useEffect(() => {
    stopSpeaking()
    setShowScore(false)
    setAlignmentResult(null)
    setResultError(null)
    setShowSyncBar(false)
    setLastAttemptId(null)
  }, [segmentIndex])

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', px: '20px', pt: '16px', pb: '12px' }}>
        <Box component="button" type="button" sx={iconButtonSx} onClick={() => navigate('/start')}>
          <ArrowBackRounded sx={{ fontSize: 16 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {articleTitle || '...'}
          </Typography>
          <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>
            {languageLabel}
          </Typography>
        </Box>
        <Box component="button" type="button" sx={iconButtonSx} onClick={() => setDrawerOpen(true)}>
          <GridViewRounded sx={{ fontSize: 15 }} />
        </Box>
        <Box component="button" type="button" sx={iconButtonSx} onClick={() => navigate('/me')}>
          <PersonOutlineRounded sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      {showSyncBar && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: '20px', pb: '8px' }}>
          <Box
            component="button"
            type="button"
            onClick={retrySync}
            disabled={syncing || !lastAttemptId}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              px: '10px',
              py: '5px',
              bgcolor: 'rgba(240,166,35,0.1)',
              border: '1px solid rgba(240,166,35,0.25)',
              borderRadius: '999px',
              color: 'warning.main',
              fontSize: '12px',
              cursor: syncing || !lastAttemptId ? 'default' : 'pointer',
            }}
          >
            {syncing ? <CircularProgress size={12} thickness={5} sx={{ color: 'warning.main' }} /> : <RefreshRounded sx={{ fontSize: 13 }} />}
            {syncing ? t('pages.practice.sync.syncing') : t('pages.practice.sync.unsyncedRetry')}
          </Box>
        </Box>
      )}

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

        <Box sx={{ bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '14px', p: '20px' }}>
          <Typography sx={{ mb: '10px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'text.disabled' }}>
            {t('pages.practice.segmentLabel', { segment: currentSegmentOrder })}
          </Typography>
          <Typography sx={{ fontSize: '17px', lineHeight: 1.75 }}>{segmentText || '...'}</Typography>
          <Box
            component="button"
            type="button"
            onClick={speakSegment}
            disabled={recordOverlayOpen || !canPractice || ttsLoading}
            sx={{
              mt: '14px',
              px: '10px',
              py: '6px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.13)',
              bgcolor: isSpeaking ? 'rgba(110,96,238,0.25)' : '#22223a',
              color: isSpeaking ? 'primary.light' : 'text.secondary',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: recordOverlayOpen || !canPractice || ttsLoading ? 'default' : 'pointer',
              transition: 'all 0.15s',
              '&:hover': recordOverlayOpen || !canPractice || ttsLoading
                ? undefined
                : {
                    borderColor: 'rgba(110,96,238,0.3)',
                    color: 'text.primary',
                  },
            }}
          >
            {ttsLoading ? <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} /> : <VolumeUpRounded sx={{ fontSize: 14 }} />}
            {ttsLoading ? t('common.loading') : isSpeaking ? t('pages.practice.readAloud.stop') : t('pages.practice.readAloud.play')}
          </Box>
        </Box>

        {!recognizing && !showScore && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', pt: '8px', pb: '4px' }}>
            <Box
              component="button"
              type="button"
              onClick={() => {
                void startRecording()
              }}
              disabled={!canPractice || isRecording}
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                border: 'none',
                bgcolor: 'primary.main',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canPractice && !isRecording ? 'pointer' : 'default',
                opacity: canPractice && !isRecording ? 1 : 0.5,
                transition: 'transform 0.15s',
                '&:hover': canPractice && !isRecording ? { transform: 'scale(1.05)' } : undefined,
              }}
            >
              <MicRounded sx={{ fontSize: 24 }} />
            </Box>
            <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
              {t('pages.practice.startRecording')}
            </Typography>
          </Box>
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
                  {passed ? t('pages.practice.score.passed') : t('pages.practice.score.failed')}
                </Typography>
              </Box>

              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <Typography component="span" sx={{ color: 'text.secondary' }}>
                    {t('pages.practice.score.correctWords')}
                  </Typography>
                  <Typography component="span" sx={{ minWidth: 72, textAlign: 'right', color: 'text.primary', fontFamily: 'monospace' }}>{`${correctCount} / ${tokenTotal}`}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <Typography component="span" sx={{ color: 'text.secondary' }}>
                    {t('pages.practice.score.wrongWords')}
                  </Typography>
                  <Typography component="span" sx={{ minWidth: 72, textAlign: 'right', color: 'text.primary', fontFamily: 'monospace' }}>{wrongCount}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <Typography component="span" sx={{ color: 'text.secondary' }}>
                    {t('pages.practice.score.missedWords')}
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
                <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>No alignment tokens available.</Typography>
              )}
              {displayTokens.map((token, i) => {
                const style = tokenStyleFromStatus(token.status)
                return (
                  <Box
                    key={`${token.text}-${i}`}
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
                onClick={() => {
                  setShowScore(false)
                  setAlignmentResult(null)
                  setResultError(null)
                }}
                sx={{
                  flex: 1.8,
                  boxShadow: '0 8px 24px rgba(110,96,238,0.3)',
                  background: 'linear-gradient(90deg, #6e60ee, #7a6cff)',
                }}
              >
                {t('pages.practice.actions.practiceAgain')}
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate(articleId ? `/result?a=${articleId}&seg=${currentSegmentOrder}` : '/result')}
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
                {t('pages.practice.actions.submitView')}
              </Button>
            </Box>

            <Box
              component="button"
              type="button"
              onClick={() => {
                if (window.confirm(t('pages.practice.confirm.skipSegment'))) setShowScore(false)
              }}
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
              {t('pages.practice.actions.skipSegment')}
            </Box>
          </Box>
        )}

        <Box component="button" type="button" onClick={() => setShowFullMode((prev) => !prev)} sx={{ border: 'none', bgcolor: 'transparent', p: '8px 0', color: 'text.secondary', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <ArrowBackRounded sx={{ fontSize: 14, transform: showFullMode ? 'rotate(-90deg)' : 'rotate(-270deg)', transition: 'transform 0.25s' }} />
          {showFullMode ? t('pages.practice.fullMode.collapse') : t('pages.practice.fullMode.expand')}
        </Box>

        {showFullMode && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Box sx={{ p: '16px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px' }}>
              <Typography sx={{ mb: '12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
                {t('pages.practice.fullMode.trend')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                {TRENDS.map((item, i) => (
                  <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <Box sx={{ width: 24, height: 40, borderRadius: '4px', bgcolor: '#1a1a2c', position: 'relative', overflow: 'hidden' }}>
                      <Box sx={{ position: 'absolute', bottom: 0, width: '100%', height: `${Math.max(4, Math.round((item / 100) * 40))}px`, borderRadius: '4px', bgcolor: item >= 85 ? 'success.main' : 'primary.main' }} />
                    </Box>
                    <Typography sx={{ fontSize: '10px', color: 'text.disabled', fontFamily: '"SF Mono", "Fira Code", monospace' }}>{item}%</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box sx={{ p: '16px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px' }}>
              <Typography sx={{ mb: '12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
                {t('pages.practice.fullMode.matrix')}
              </Typography>
              <Matrix matrix={progressMatrix} />
            </Box>

            <Box sx={{ p: '16px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
                  {t('pages.practice.fullMode.switchLevel')}
                </Typography>
                <Box sx={{ display: 'flex', gap: '6px' }}>
                  {LEVELS.map((item) => (
                    <Button
                      key={item}
                      size="small"
                      variant="outlined"
                      onClick={() => switchLevel(item)}
                      sx={{
                        minWidth: '42px',
                        borderColor: item === level ? 'rgba(110,96,238,0.3)' : 'rgba(255,255,255,0.07)',
                        bgcolor: item === level ? 'rgba(110,96,238,0.25)' : 'transparent',
                        color: item === level ? 'primary.light' : 'text.secondary',
                      }}
                    >
                      {item}
                    </Button>
                  ))}
                </Box>
              </Box>
              <Typography sx={{ mt: '8px', fontSize: '12px', color: 'text.disabled' }}>
                {t('pages.practice.fullMode.switchLevelHint')}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          left: '50%',
          width: '100%',
          maxWidth: '430px',
          transform: recordOverlayOpen ? 'translate(-50%, 0)' : 'translate(-50%, 100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 300,
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', p: '16px 20px' }}>
          <Box component="button" type="button" sx={{ ...iconButtonSx, border: '1px solid transparent', bgcolor: 'transparent' }} onClick={stopRecording}>
            <CloseRounded sx={{ fontSize: 16 }} />
          </Box>
          <Typography sx={{ color: 'error.main', fontSize: '14px', fontWeight: 600 }}>
            {t('pages.practice.recording.status')}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', color: 'text.secondary' }}>{formatTimer(recordSeconds)}</Typography>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', p: '24px 28px 12px', gap: '14px' }}>
          <Typography sx={{ fontSize: '12px', color: 'text.disabled', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {t('pages.practice.segmentLabel', { segment: currentSegmentOrder })}
          </Typography>
          <Box sx={{ width: '100%', maxWidth: '360px', flex: 1, minHeight: 0, overflowY: 'auto', px: '2px' }}>
            <Typography
              sx={{
                fontSize: '20px',
                lineHeight: 1.9,
                textAlign: 'justify',
                textAlignLast: 'left',
                whiteSpace: 'normal',
                wordBreak: 'keep-all',
                lineBreak: 'strict',
              }}
            >
              {renderRecordingSegmentText()}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px', height: 32 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: 4,
                  borderRadius: '2px',
                  bgcolor: 'error.main',
                  animation: 'wave 0.8s ease-in-out infinite alternate',
                  animationDelay: `${(i % 3) * 0.1}s`,
                  '@keyframes wave': { from: { height: 4 }, to: { height: 28 } },
                }}
              />
            ))}
          </Box>
          <Button
            variant="text"
            size="small"
            startIcon={ttsLoading ? <CircularProgress size={12} thickness={5} sx={{ color: 'inherit' }} /> : <VolumeUpRounded sx={{ fontSize: 15 }} />}
            onClick={speakSegment}
            disabled={!canPractice || ttsLoading}
            sx={{
              mt: '2px',
              color: 'text.secondary',
              fontSize: '12px',
              fontWeight: 500,
              minHeight: '28px',
              opacity: 0.85,
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.05)',
                color: 'text.primary',
              },
            }}
          >
            {ttsLoading ? t('common.loading') : isSpeaking ? t('pages.practice.readAloud.stop') : t('pages.practice.readAloud.play')}
          </Button>
        </Box>

        <Box sx={{ p: '16px 24px calc(24px + env(safe-area-inset-bottom, 0px))' }}>
          <Button variant="contained" color="error" size="large" fullWidth startIcon={<StopRounded />} onClick={stopRecording}>
            {t('pages.practice.recording.stop')}
          </Button>
        </Box>
      </Box>

      <Box onClick={() => setDrawerOpen(false)} sx={{ position: 'fixed', inset: 0, zIndex: 90, bgcolor: 'rgba(0,0,0,0.6)', opacity: drawerOpen ? 1 : 0, pointerEvents: drawerOpen ? 'auto' : 'none', transition: 'opacity 0.3s' }} />
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          width: '100%',
          maxWidth: '430px',
          maxHeight: '80svh',
          transform: drawerOpen ? 'translate(-50%,0)' : 'translate(-50%,100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 100,
          bgcolor: 'background.paper',
          borderRadius: '14px 14px 0 0',
          border: '1px solid rgba(255,255,255,0.13)',
          borderBottom: 'none',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ width: 36, height: 4, bgcolor: 'rgba(255,255,255,0.13)', borderRadius: '4px', m: '10px auto 0' }} />
        <Box sx={{ p: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <GridViewRounded sx={{ fontSize: 16, color: 'text.disabled' }} />
          <Typography sx={{ flex: 1, fontSize: '15px', fontWeight: 600 }}>
            {t('pages.practice.drawer.title')}
          </Typography>
          <Box component="button" type="button" sx={{ ...iconButtonSx, border: '1px solid transparent', bgcolor: 'transparent' }} onClick={() => setDrawerOpen(false)}>
            <CloseRounded sx={{ fontSize: 14 }} />
          </Box>
        </Box>
        <Box sx={{ p: '4px 20px 32px', overflowY: 'auto' }}>
          <Typography sx={{ mb: '16px', fontSize: '13px', color: 'text.secondary' }}>
            {t('pages.practice.drawer.articleInfo', { total: totalSegments })}
          </Typography>
          {progressLoading && (
            <Typography sx={{ mb: '10px', fontSize: '12px', color: 'text.disabled' }}>
              {t('common.loading')}
            </Typography>
          )}
          <Matrix matrix={progressMatrix} />
          <Box sx={{ mt: '20px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'text.disabled' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: 'rgba(29,201,138,0.1)', border: '1px solid rgba(29,201,138,0.2)', color: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>OK</Box>
              {t('pages.practice.drawer.legend.pass')}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: 'rgba(110,96,238,0.25)', border: '1px solid #6e60ee', color: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>-&gt;</Box>
              {t('pages.practice.drawer.legend.current')}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: 'rgba(240,166,35,0.1)', border: '1px solid rgba(240,166,35,0.2)', color: 'warning.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>-&gt;</Box>
              {t('pages.practice.drawer.legend.skipped')}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: '#22223a', color: 'text.disabled', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>-</Box>
              {t('pages.practice.drawer.legend.incomplete')}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
