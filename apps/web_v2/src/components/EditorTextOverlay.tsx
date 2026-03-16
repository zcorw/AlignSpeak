import { CloseRounded } from '@mui/icons-material'
import { Box, Button, CircularProgress, MenuItem, Select, Typography } from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { articleService } from '../services/articleService'

export type OverlayLanguageCode = 'en' | 'zh' | 'ja'
type DetectableLanguageCode = OverlayLanguageCode
type DetectedLanguage = DetectableLanguageCode | 'unknown'

interface EditorTextOverlayProps {
  open: boolean
  ocrLoading: boolean
  importedText: string
  initialLanguage?: OverlayLanguageCode
  focusVersion: number
  submitting: boolean
  onClose: () => void
  onConfirm: (payload: { text: string; language: OverlayLanguageCode }) => void
}

const fallbackDetectLanguage = (value: string): OverlayLanguageCode => {
  const cjk = (value.match(/[\u4e00-\u9fff]/g) ?? []).length
  const jp = (value.match(/[\u3040-\u30ff]/g) ?? []).length

  if (jp > 5) return 'ja'
  if (cjk > 10) return 'zh'
  return 'en'
}

const isDetectableLanguage = (value: string): value is DetectableLanguageCode =>
  value === 'en' || value === 'zh' || value === 'ja'

const normalizeTextForPreview = (value: string) => {
  const unified = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rightTrimmed = unified
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
  return rightTrimmed.replace(/\n{3,}/g, '\n\n').trim()
}

const splitSegmentsForPreview = (normalizedText: string) =>
  normalizedText
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter(Boolean)

export const EditorTextOverlay = ({
  open,
  ocrLoading,
  importedText,
  initialLanguage,
  focusVersion,
  submitting,
  onClose,
  onConfirm,
}: EditorTextOverlayProps) => {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const detectRequestIdRef = useRef(0)

  const [language, setLanguage] = useState<OverlayLanguageCode>(() => initialLanguage || fallbackDetectLanguage(importedText))
  const [text, setText] = useState(importedText)
  const [detectingLanguage, setDetectingLanguage] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState<DetectedLanguage | null>(null)
  const [detectedReliable, setDetectedReliable] = useState<boolean>(true)

  useEffect(() => {
    if (!open) return
    window.setTimeout(() => textareaRef.current?.focus(), 50)
  }, [focusVersion, open])

  const trimmedText = useMemo(() => normalizeTextForPreview(text), [text])
  const segments = useMemo(
    () => (trimmedText ? splitSegmentsForPreview(trimmedText) : []),
    [trimmedText]
  )
  const charCount = trimmedText.replace(/\s/g, '').length

  const validationMessage = useMemo(() => {
    if (trimmedText.length < 20) return t('pages.editor.validation.minChars')
    if (segments.length < 1) return t('pages.editor.validation.minSegments')
    if (segments.length > 30) return t('pages.editor.validation.maxSegments', { count: segments.length })
    return ''
  }, [segments.length, t, trimmedText.length])

  const canConfirm = validationMessage.length === 0
  const statsWarn = segments.length > 30 ? 'overLimit' : segments.length > 20 ? 'nearLimit' : ''
  const detectedLanguageHint = useMemo(() => {
    if (detectingLanguage) return t('pages.editor.overlay.detectingLanguage')
    if (!detectedLanguage) return t('pages.editor.overlay.autoDetectEditable')
    if (detectedLanguage === 'unknown') return t('pages.editor.overlay.detectedUnknown')

    const languageLabel = t(`pages.editor.overlay.languageLabel.${detectedLanguage}`)
    if (detectedReliable) {
      return t('pages.editor.overlay.detectedLanguage', { language: languageLabel })
    }
    return t('pages.editor.overlay.detectedLanguageUnreliable', { language: languageLabel })
  }, [detectedLanguage, detectedReliable, detectingLanguage, t])

  useEffect(() => {
    if (!open || ocrLoading) return

    const timer = window.setTimeout(() => {
      const normalized = text.trim()
      if (normalized.length < 8) {
        setDetectingLanguage(false)
        setDetectedLanguage(null)
        setDetectedReliable(true)
        return
      }

      const requestId = detectRequestIdRef.current + 1
      detectRequestIdRef.current = requestId
      setDetectingLanguage(true)

      void articleService
        .detectLanguage(normalized)
        .then((detection) => {
          if (requestId !== detectRequestIdRef.current) return
          setDetectedLanguage(detection.detectedLanguage)
          setDetectedReliable(detection.detectedReliable)

          if (isDetectableLanguage(detection.detectedLanguage)) {
            setLanguage(detection.detectedLanguage)
            return
          }
          setLanguage(fallbackDetectLanguage(text))
        })
        .catch(() => {
          if (requestId !== detectRequestIdRef.current) return
          setDetectedLanguage(null)
          setDetectedReliable(true)
          setLanguage(fallbackDetectLanguage(text))
        })
        .finally(() => {
          if (requestId === detectRequestIdRef.current) {
            setDetectingLanguage(false)
          }
        })
    }, 380)

    return () => window.clearTimeout(timer)
  }, [open, ocrLoading, text])

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        left: '50%',
        width: '100%',
        maxWidth: '430px',
        transform: open ? 'translate(-50%, 0)' : 'translate(-50%, 100%)',
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 200,
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          p: '16px 20px',
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box
          component="button"
          type="button"
          aria-label={t('pages.editor.overlay.closeAriaLabel')}
          onClick={() => {
            detectRequestIdRef.current += 1
            setDetectingLanguage(false)
            onClose()
          }}
          sx={{
            width: 36,
            height: 36,
            borderRadius: '999px',
            border: '1px solid transparent',
            bgcolor: 'transparent',
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <CloseRounded sx={{ fontSize: 16 }} />
        </Box>
        <Typography sx={{ flex: 1, fontSize: '16px', fontWeight: 600 }}>
          {t('pages.editor.overlay.title')}
        </Typography>
        <Box
          sx={{
            fontSize: '12px',
            color: 'text.disabled',
            fontFamily: '"SF Mono", "Fira Code", monospace',
          }}
        >
          {t('pages.editor.overlay.stats', { chars: charCount, segments: segments.length })}{' '}
          {statsWarn && (
            <Box component="span" sx={{ color: segments.length > 30 ? 'error.main' : 'warning.main' }}>
              {t(`pages.editor.overlay.${statsWarn}`)}
            </Box>
          )}
        </Box>
      </Box>

      {ocrLoading ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            p: '40px',
          }}
        >
          <CircularProgress size={32} thickness={4} />
          <Typography sx={{ fontSize: '14px', color: 'text.secondary' }}>
            {t('pages.editor.overlay.ocrLoading')}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              p: '16px 20px',
              gap: '12px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <Select
                value={language}
                onChange={(event) => setLanguage(event.target.value as OverlayLanguageCode)}
                size="small"
                sx={{
                  minWidth: 140,
                  height: 34,
                  borderRadius: '999px',
                  bgcolor: '#22223a',
                  color: 'text.primary',
                  '.MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.13)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '.MuiSelect-select': {
                    py: '6px',
                    fontSize: '13px',
                  },
                }}
              >
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="zh">中文</MenuItem>
                <MenuItem value="ja">日本語</MenuItem>
              </Select>
              <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>{detectedLanguageHint}</Typography>
            </Box>

            <Typography
              sx={{
                fontSize: '12px',
                color: 'text.disabled',
                px: '10px',
                py: '6px',
                borderRadius: '8px',
                border: '1px dashed rgba(255,255,255,0.16)',
                bgcolor: 'rgba(255,255,255,0.02)',
              }}
            >
              {t('pages.editor.overlay.segmentRuleHint')}
            </Typography>

            <Box
              component="textarea"
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t('pages.editor.overlay.placeholder')}
              sx={{
                flex: 1,
                minHeight: 180,
                px: '14px',
                py: '12px',
                bgcolor: '#22223a',
                border: '1px solid rgba(255,255,255,0.13)',
                borderRadius: '8px',
                outline: 'none',
                resize: 'none',
                color: 'text.primary',
                fontSize: '15px',
                lineHeight: 1.7,
                fontFamily: 'inherit',
                '&::placeholder': {
                  color: 'text.disabled',
                },
                '&:focus': {
                  borderColor: 'primary.main',
                },
              }}
            />

            <Box
              sx={{
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                bgcolor: 'rgba(255,255,255,0.02)',
                minHeight: 120,
                maxHeight: 200,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Typography
                sx={{
                  px: '10px',
                  py: '8px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.7px',
                  textTransform: 'uppercase',
                  color: 'text.disabled',
                }}
              >
                {t('pages.editor.overlay.segmentList', { count: segments.length })}
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  p: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {segments.length === 0 ? (
                  <Typography
                    sx={{
                      fontSize: '12px',
                      color: 'text.disabled',
                      p: '10px',
                      border: '1px dashed rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      lineHeight: 1.5,
                    }}
                  >
                    {t('pages.editor.overlay.segmentListEmpty')}
                  </Typography>
                ) : (
                  segments.map((item, index) => (
                    <Box
                      key={`${index}-${item.slice(0, 24)}`}
                      sx={{
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        bgcolor: '#22223a',
                        p: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          fontFamily: '"SF Mono", "Fira Code", monospace',
                          fontSize: '11px',
                          color: 'text.disabled',
                        }}
                      >
                        <Box sx={{ color: 'text.secondary', fontWeight: 700 }}>{`#${index + 1}`}</Box>
                        <Box>{t('pages.editor.overlay.segmentChars', { count: item.replace(/\s/g, '').length })}</Box>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: '12px',
                          color: 'text.secondary',
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {item}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              p: '16px 20px 32px',
              borderTop: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {validationMessage && (
              <Typography sx={{ fontSize: '13px', color: 'error.main' }}>{validationMessage}</Typography>
            )}

            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={!canConfirm || submitting}
              onClick={() => {
                if (!canConfirm) return
                onConfirm({ text, language })
              }}
              sx={{
                boxShadow: '0 2px 12px rgba(110,96,238,0.25)',
                '&:hover': {
                  bgcolor: 'primary.light',
                },
              }}
            >
              {submitting ? t('common.loading') : t('pages.editor.overlay.confirmStart')}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  )
}
