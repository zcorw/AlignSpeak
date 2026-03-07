import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiErrorMessage } from '../../services/authService'
import { type PracticeSegment } from '../../services/practiceService'
import { ttsService } from '../../services/ttsService'

interface SpeakSegmentParams {
  canPractice: boolean
  articleId: string | null
  segment: PracticeSegment | null
}

interface UsePracticeAudioOptions {
  failedMessage: string
  onError: (message: string) => void
}

export const usePracticeAudio = ({ failedMessage, onError }: UsePracticeAudioOptions) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)

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
    clearAudioObjectUrl()
    setIsSpeaking(false)
  }, [clearAudioObjectUrl])

  const isInterruptedPlayError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false
    const message = error.message.toLowerCase()
    return message.includes('play() request was interrupted') || message.includes('interrupted by a call to pause()')
  }

  const speakSegment = useCallback(
    async ({ canPractice, articleId, segment }: SpeakSegmentParams) => {
      if (!canPractice || !articleId || !segment) return
      if (isSpeaking) {
        stopSpeaking()
        return
      }

      setTtsLoading(true)
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
        const audio = new Audio(sourceUrl)
        audioObjectUrlRef.current = sourceUrl
        audio.onended = () => {
          clearAudioObjectUrl()
          setIsSpeaking(false)
          audioRef.current = null
        }
        audio.onerror = () => {
          clearAudioObjectUrl()
          setIsSpeaking(false)
          audioRef.current = null
        }
        audioRef.current = audio
        setIsSpeaking(true)
        await audio.play()
      } catch (error: unknown) {
        if (!isInterruptedPlayError(error)) {
          onError(getApiErrorMessage(error, failedMessage))
        }
        clearAudioObjectUrl()
        setIsSpeaking(false)
        audioRef.current = null
      } finally {
        setTtsLoading(false)
      }
    },
    [clearAudioObjectUrl, failedMessage, isSpeaking, onError, stopSpeaking]
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
  }
}

