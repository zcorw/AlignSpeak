import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiErrorMessage } from '../../services/authService'
import {
  practiceAttemptService,
  type AlignmentResult,
} from '../../services/practiceAttemptService'
import { type PracticeSegment } from '../../services/practiceService'

const CHUNK_DURATION_MS = 1200

interface UsePracticeRecordingOptions {
  currentSegment: PracticeSegment | null
  canPractice: boolean
  ttsLoading: boolean
  isSpeaking: boolean
  stopSpeaking: () => void
  errorMessage: string
  onBeforeStart: () => void | Promise<void>
  onAligned: (result: AlignmentResult, attemptId: string) => void
}

export const usePracticeRecording = ({
  currentSegment,
  canPractice,
  ttsLoading,
  isSpeaking,
  stopSpeaking,
  errorMessage,
  onBeforeStart,
  onAligned,
}: UsePracticeRecordingOptions) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recordingIdRef = useRef<string | null>(null)
  const recordingSegmentIdRef = useRef<string | null>(null)
  const chunkSeqRef = useRef(0)
  const uploadTasksRef = useRef<Array<Promise<void>>>([])
  const recordingStartAtRef = useRef<number | null>(null)
  const finalizingRef = useRef(false)
  const recordSecondsRef = useRef(0)

  const [recordOverlayOpen, setRecordOverlayOpen] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recognizing, setRecognizing] = useState(false)
  const [showSyncBar, setShowSyncBar] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [resultError, setResultError] = useState<string | null>(null)
  const [lastAttemptId, setLastAttemptId] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)

  useEffect(() => {
    recordSecondsRef.current = recordSeconds
  }, [recordSeconds])

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

  const cleanupRecordingMedia = useCallback(() => {
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
    setIsRecording(false)
  }, [])

  const resetRecordingState = useCallback(() => {
    recordingIdRef.current = null
    recordingSegmentIdRef.current = null
    chunkSeqRef.current = 0
    uploadTasksRef.current = []
    recordingStartAtRef.current = null
  }, [])

  const runFinishAndAlign = useCallback(async () => {
    if (finalizingRef.current) return
    finalizingRef.current = true
    setRecognizing(true)
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
      const elapsedMs = recordingStartAtRef.current
        ? Date.now() - recordingStartAtRef.current
        : recordSecondsRef.current * 1000
      const finishRes = await practiceAttemptService.finishRecording(recordingId, totalChunks, Math.max(elapsedMs, 1))
      const sttStatus = await practiceAttemptService.waitSttDone(finishRes.jobId)
      if (sttStatus.status !== 'done' || !sttStatus.attempt_id) {
        const reason = sttStatus.error_code ?? 'STT_PROVIDER_ERROR'
        throw new Error(`STT failed: ${reason}`)
      }
      setLastAttemptId(sttStatus.attempt_id)
      const alignResult = await practiceAttemptService.alignAttempt(sttStatus.attempt_id, segmentId, sttStatus.recognized_text)
      onAligned(alignResult, sttStatus.attempt_id)
      setResultError(null)
      setShowSyncBar(false)
    } catch (error: unknown) {
      setResultError(getApiErrorMessage(error, errorMessage))
      setShowSyncBar(true)
    } finally {
      setRecognizing(false)
      cleanupRecordingMedia()
      resetRecordingState()
      finalizingRef.current = false
    }
  }, [cleanupRecordingMedia, errorMessage, onAligned, resetRecordingState])

  const startRecording = useCallback(async () => {
    if (ttsLoading || !canPractice || !currentSegment || recognizing || isRecording) return
    if (isSpeaking) stopSpeaking()
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      const alertFn = (globalThis as { alert?: (message?: string) => void }).alert
      alertFn?.('MediaRecorder is not supported in this browser.')
      return
    }

    try {
      await onBeforeStart()
      setResultError(null)
      setShowSyncBar(false)
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
      setIsRecording(true)

      recorder.ondataavailable = (event: BlobEvent) => {
        if (!recordingIdRef.current || event.data.size <= 0) return
        const seq = chunkSeqRef.current
        chunkSeqRef.current += 1
        const task = practiceAttemptService.uploadChunk(recordingIdRef.current, seq, event.data, CHUNK_DURATION_MS)
        uploadTasksRef.current.push(task)
      }
      recorder.onstop = () => {
        setIsRecording(false)
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
      setResultError(getApiErrorMessage(error, errorMessage))
    }
  }, [
    canPractice,
    cleanupRecordingMedia,
    currentSegment,
    errorMessage,
    isRecording,
    isSpeaking,
    onBeforeStart,
    recognizing,
    resetRecordingState,
    runFinishAndAlign,
    stopSpeaking,
    ttsLoading,
  ])

  const stopRecording = useCallback(() => {
    stopSpeaking()
    setRecordOverlayOpen(false)
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state !== 'inactive') {
      recorder.stop()
      return
    }
    void runFinishAndAlign()
  }, [runFinishAndAlign, stopSpeaking])

  const retrySync = useCallback(async () => {
    if (!lastAttemptId || !currentSegment) return
    setSyncing(true)
    try {
      const alignResult = await practiceAttemptService.alignAttempt(lastAttemptId, currentSegment.id)
      onAligned(alignResult, lastAttemptId)
      setShowSyncBar(false)
      setResultError(null)
    } catch (error: unknown) {
      setResultError(getApiErrorMessage(error, errorMessage))
      setShowSyncBar(true)
    } finally {
      setSyncing(false)
    }
  }, [currentSegment, errorMessage, lastAttemptId, onAligned])

  const clearFeedback = useCallback(() => {
    setResultError(null)
    setShowSyncBar(false)
    setLastAttemptId(null)
  }, [])

  useEffect(() => {
    return () => {
      cleanupRecordingMedia()
      resetRecordingState()
    }
  }, [cleanupRecordingMedia, resetRecordingState])

  return {
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
  }
}
