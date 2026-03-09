import { GraphicEqRounded, PauseRounded, PlayArrowRounded } from '@mui/icons-material'
import { Box, Button, Typography } from '@mui/material'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../services/authService'
import { resultService } from '../../services/resultService'

interface ResultAttemptAudioButtonProps {
  attemptId: string
}

export const ResultAttemptAudioButton = ({ attemptId }: ResultAttemptAudioButtonProps) => {
  const { t } = useTranslation()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearObjectUrl = useCallback(() => {
    if (!audioObjectUrlRef.current) return
    URL.revokeObjectURL(audioObjectUrlRef.current)
    audioObjectUrlRef.current = null
  }, [])

  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
    }
    setPlaying(false)
  }, [])

  useEffect(() => {
    stopAudio()
    clearObjectUrl()
    setError(null)
  }, [attemptId, clearObjectUrl, stopAudio])

  useEffect(() => {
    return () => {
      stopAudio()
      clearObjectUrl()
    }
  }, [clearObjectUrl, stopAudio])

  const handleTogglePlay = useCallback(async () => {
    if (loading) return

    const current = audioRef.current
    if (current && playing) {
      stopAudio()
      return
    }

    try {
      setLoading(true)
      setError(null)

      let audio = audioRef.current
      if (!audio) {
        const objectUrl = await resultService.fetchAttemptAudioObjectUrl(attemptId)
        audioObjectUrlRef.current = objectUrl
        audio = new Audio(objectUrl)
        audio.onended = () => {
          setPlaying(false)
        }
        audio.onerror = () => {
          setPlaying(false)
          setError(t('common.error'))
        }
        audioRef.current = audio
      }

      if (audio.duration > 0 && audio.currentTime >= audio.duration) {
        audio.currentTime = 0
      }
      await audio.play()
      setPlaying(true)
    } catch (err: unknown) {
      setPlaying(false)
      setError(getApiErrorMessage(err, t('common.error')))
    } finally {
      setLoading(false)
    }
  }, [attemptId, loading, playing, stopAudio, t])

  return (
    <Box
      sx={{
        p: '12px 14px',
        bgcolor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
      }}
    >
      <Button
        variant="outlined"
        size="small"
        onClick={() => {
          void handleTogglePlay()
        }}
        startIcon={playing ? <PauseRounded sx={{ fontSize: '14px !important' }} /> : <PlayArrowRounded sx={{ fontSize: '14px !important' }} />}
        sx={{
          minHeight: 32,
          px: '10px',
          borderColor: 'rgba(255,255,255,0.16)',
          color: 'text.secondary',
          textTransform: 'none',
          fontSize: '13px',
          '&:hover': {
            borderColor: 'rgba(255,255,255,0.26)',
            bgcolor: 'rgba(255,255,255,0.04)',
          },
        }}
      >
        {loading
          ? t('common.loading')
          : playing
            ? t('pages.result.recording.stop', { defaultValue: '停止播放录音' })
            : t('pages.result.recording.play', { defaultValue: '播放本次录音' })}
      </Button>
      <Box sx={{ mt: '6px', display: 'flex', alignItems: 'center', gap: '6px', color: 'text.disabled' }}>
        <GraphicEqRounded sx={{ fontSize: 14 }} />
        <Typography sx={{ fontSize: '12px' }}>
          {t('pages.result.recording.hint', { defaultValue: '可先回听本次录音，再查看对齐详情' })}
        </Typography>
      </Box>
      {error && (
        <Typography sx={{ mt: '6px', fontSize: '12px', color: 'error.main' }}>
          {error}
        </Typography>
      )}
    </Box>
  )
}
