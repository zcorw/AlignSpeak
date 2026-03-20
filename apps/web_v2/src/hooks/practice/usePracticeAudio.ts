import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiErrorMessage } from '../../services/authService'
import { type PracticeSegment } from '../../services/practiceService'
import { ttsService, type TtsTimelineSentence } from '../../services/ttsService'

interface SpeakSegmentParams {
  canPractice: boolean
  articleId: string | null
  segment: PracticeSegment | null
}

interface PlaySentenceParams extends SpeakSegmentParams {
  sentenceIndex: number
}

interface UsePracticeAudioOptions {
  failedMessage: string
  onError: (message: string) => void
}

export const usePracticeAudio = ({ failedMessage, onError }: UsePracticeAudioOptions) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const loadedSegmentIdRef = useRef<string | null>(null)
  const loadingAudioPromiseRef = useRef<Promise<HTMLAudioElement | null> | null>(null)
  const timelineRef = useRef<TtsTimelineSentence[]>([])
  const playRangeRef = useRef<{ startMs: number; endMs: number } | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [timelineSentences, setTimelineSentences] = useState<TtsTimelineSentence[]>([])
  const [activeTimelineSentenceIndex, setActiveTimelineSentenceIndex] = useState<number | null>(null)

  const findActiveTimelineSentenceIndex = useCallback((positionMs: number, timeline: TtsTimelineSentence[]): number | null => {
    if (!timeline.length) return null
    const matched = timeline.find(
      (item) => positionMs >= item.startMs && positionMs <= Math.max(item.endMs, item.startMs)
    )
    if (matched) return matched.sentenceIndex
    const before = timeline.find((item) => positionMs < item.startMs)
    if (before) return before.sentenceIndex
    return timeline[timeline.length - 1]?.sentenceIndex ?? null
  }, [])

  const clearAudioObjectUrl = useCallback(() => {
    if (!audioObjectUrlRef.current) return
    URL.revokeObjectURL(audioObjectUrlRef.current)
    audioObjectUrlRef.current = null
  }, [])

  const stopSpeaking = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
    }
    loadedSegmentIdRef.current = null
    playRangeRef.current = null
    loadingAudioPromiseRef.current = null
    clearAudioObjectUrl()
    setIsSpeaking(false)
    setActiveTimelineSentenceIndex(null)
  }, [clearAudioObjectUrl])

  const isInterruptedPlayError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false
    const message = error.message.toLowerCase()
    return message.includes('play() request was interrupted') || message.includes('interrupted by a call to pause()')
  }

  const bindAudioEvents = useCallback((audio: HTMLAudioElement) => {
    audio.ontimeupdate = () => {
      const timeline = timelineRef.current
      if (!timeline.length) {
        setActiveTimelineSentenceIndex(null)
      } else {
        const nextIndex = findActiveTimelineSentenceIndex(audio.currentTime * 1000, timeline)
        setActiveTimelineSentenceIndex(nextIndex)
      }
      const playRange = playRangeRef.current
      if (playRange && audio.currentTime * 1000 >= playRange.endMs) {
        audio.pause()
        audio.currentTime = Math.max(playRange.endMs, 0) / 1000
        playRangeRef.current = null
      }
    }
    audio.onpause = () => {
      setIsSpeaking(false)
    }
    audio.onended = () => {
      playRangeRef.current = null
      setIsSpeaking(false)
      setActiveTimelineSentenceIndex(null)
    }
    audio.onerror = () => {
      playRangeRef.current = null
      setIsSpeaking(false)
      audioRef.current = null
      loadedSegmentIdRef.current = null
      clearAudioObjectUrl()
      setActiveTimelineSentenceIndex(null)
    }
  }, [clearAudioObjectUrl, findActiveTimelineSentenceIndex])

  const ensureAudioReady = useCallback(
    async ({ canPractice, articleId, segment }: SpeakSegmentParams): Promise<HTMLAudioElement | null> => {
      if (!canPractice || !articleId || !segment) return null
      if (audioRef.current && loadedSegmentIdRef.current === segment.id) return audioRef.current
      if (loadingAudioPromiseRef.current) return loadingAudioPromiseRef.current

      const loadingTask = (async () => {
        setTtsLoading(true)
        playRangeRef.current = null

        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }
        loadedSegmentIdRef.current = null
        clearAudioObjectUrl()
        setIsSpeaking(false)

        try {
          const job = await ttsService.createTtsJob(articleId, segment.id, 1.0)
          const finalStatus = await ttsService.waitForDone(job.jobId)
          if (finalStatus.status !== 'done' || !finalStatus.audioUrl) {
            const message =
              finalStatus.errorCode === 'TTS_TIMEOUT'
                ? 'TTS timeout.'
                : finalStatus.errorCode
                  ? `TTS failed: ${finalStatus.errorCode}`
                  : failedMessage
            throw new Error(message)
          }

          const sourceUrl = await ttsService.fetchAudioObjectUrl(finalStatus.audioUrl)
          const nextTimeline = finalStatus.timeline ?? []
          timelineRef.current = nextTimeline
          setTimelineSentences(nextTimeline)
          setActiveTimelineSentenceIndex(nextTimeline[0]?.sentenceIndex ?? null)

          const audio = new Audio(sourceUrl)
          audioObjectUrlRef.current = sourceUrl
          bindAudioEvents(audio)
          audioRef.current = audio
          loadedSegmentIdRef.current = segment.id
          return audio
        } catch (error: unknown) {
          if (!isInterruptedPlayError(error)) {
            onError(getApiErrorMessage(error, failedMessage))
          }
          timelineRef.current = []
          setTimelineSentences([])
          setActiveTimelineSentenceIndex(null)
          playRangeRef.current = null
          clearAudioObjectUrl()
          audioRef.current = null
          loadedSegmentIdRef.current = null
          return null
        } finally {
          setTtsLoading(false)
          loadingAudioPromiseRef.current = null
        }
      })()

      loadingAudioPromiseRef.current = loadingTask
      return loadingTask
    },
    [bindAudioEvents, clearAudioObjectUrl, failedMessage, onError]
  )

  const speakSegment = useCallback(
    async ({ canPractice, articleId, segment }: SpeakSegmentParams) => {
      if (!canPractice || !articleId || !segment) return
      if (isSpeaking) {
        stopSpeaking()
        return
      }

      const audio = await ensureAudioReady({ canPractice, articleId, segment })
      if (!audio) return
      playRangeRef.current = null
      audio.currentTime = 0
      const timeline = timelineRef.current
      setActiveTimelineSentenceIndex(timeline[0]?.sentenceIndex ?? null)
      try {
        await audio.play()
        setIsSpeaking(true)
      } catch (error: unknown) {
        if (!isInterruptedPlayError(error)) {
          onError(getApiErrorMessage(error, failedMessage))
        }
      }
    },
    [ensureAudioReady, failedMessage, isSpeaking, onError, stopSpeaking]
  )

  const playSentence = useCallback(
    async ({ canPractice, articleId, segment, sentenceIndex }: PlaySentenceParams) => {
      const audio = await ensureAudioReady({ canPractice, articleId, segment })
      if (!audio) return
      const timeline = [...timelineRef.current].sort((left, right) => left.sentenceIndex - right.sentenceIndex)
      if (!timeline.length) return
      const fallbackPosition = Math.max(0, Math.min(sentenceIndex, timeline.length - 1))
      const target = timeline.find((item) => item.sentenceIndex === sentenceIndex) ?? timeline[fallbackPosition]
      if (!target) return
      const startMs = Math.max(target.startMs, 0)
      const endMs = Math.max(target.endMs, startMs)
      playRangeRef.current = { startMs, endMs }
      audio.currentTime = startMs / 1000
      setActiveTimelineSentenceIndex(target.sentenceIndex)
      try {
        if (audio.paused) {
          await audio.play()
        }
        setIsSpeaking(true)
      } catch (error: unknown) {
        if (!isInterruptedPlayError(error)) {
          onError(getApiErrorMessage(error, failedMessage))
        }
      }
    },
    [ensureAudioReady, failedMessage, onError]
  )

  useEffect(() => {
    return () => {
      stopSpeaking()
    }
  }, [stopSpeaking])

  return {
    isSpeaking,
    ttsLoading,
    speakSegment,
    stopSpeaking,
    timelineSentences,
    activeTimelineSentenceIndex,
    playSentence,
  }
}
