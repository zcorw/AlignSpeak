import {
  ArrowBackRounded,
  ContentPasteRounded,
  EditOutlined,
  PersonOutlineRounded,
  UploadFileRounded,
} from '@mui/icons-material'
import { Box, Typography } from '@mui/material'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { EditorTextOverlay, type OverlayLanguageCode } from '../components/EditorTextOverlay'

const SAMPLE_TEXT = `Once when I was six years old I saw a magnificent picture in a book about the primeval forest.

It was a picture of a boa constrictor in the act of swallowing an animal.

In the book it said: Boa constrictors swallow their prey whole, without chewing it. After that I used to think a lot about jungle adventures.

I showed my masterpiece to the grown-ups, and asked them whether the drawing frightened them.

They answered: "Why should anyone be frightened by a hat?"`

export const EditorPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const ocrTimerRef = useRef<number | null>(null)

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [importedText, setImportedText] = useState('')
  const [importVersion, setImportVersion] = useState(0)
  const [focusVersion, setFocusVersion] = useState(0)

  const applyImportedText = (value: string) => {
    setImportedText(value)
    setImportVersion((prev) => prev + 1)
    setFocusVersion((prev) => prev + 1)
  }

  const closeOverlay = () => {
    if (ocrTimerRef.current !== null) {
      window.clearTimeout(ocrTimerRef.current)
      ocrTimerRef.current = null
    }
    setOcrLoading(false)
    setOverlayOpen(false)
  }

  useEffect(() => {
    return () => {
      if (ocrTimerRef.current !== null) {
        window.clearTimeout(ocrTimerRef.current)
      }
    }
  }, [])

  const handleOpenOverlay = (source: 'clipboard' | 'manual') => {
    setOverlayOpen(true)
    if (source === 'manual') {
      setFocusVersion((prev) => prev + 1)
      return
    }

    navigator.clipboard
      .readText()
      .then((value) => {
        applyImportedText(value || SAMPLE_TEXT)
      })
      .catch(() => {
        applyImportedText(SAMPLE_TEXT)
      })
  }

  const handlePickFile = () => {
    inputRef.current?.click()
  }

  const handleFileImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setOverlayOpen(true)
    if (file.type.startsWith('image/')) {
      setOcrLoading(true)
      ocrTimerRef.current = window.setTimeout(() => {
        setOcrLoading(false)
        applyImportedText(SAMPLE_TEXT)
        ocrTimerRef.current = null
      }, 2200)
      return
    }

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      const value = typeof loadEvent.target?.result === 'string' ? loadEvent.target.result : ''
      applyImportedText(value)
    }
    reader.readAsText(file)
  }

  const handleConfirm = (payload: { text: string; language: OverlayLanguageCode }) => {
    sessionStorage.setItem('article_text', payload.text)
    sessionStorage.setItem('article_lang', payload.language)
    navigate('/practice?new=1')
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          px: '20px',
          pt: '16px',
          pb: '12px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <Box
          component="button"
          type="button"
          aria-label={t('pages.editor.topbar.backAriaLabel')}
          onClick={() => navigate('/start')}
          sx={{
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
            '&:hover': {
              bgcolor: '#22223a',
              color: 'text.primary',
            },
          }}
        >
          <ArrowBackRounded sx={{ fontSize: 16 }} />
        </Box>
        <Typography sx={{ flex: 1, fontSize: '16px', fontWeight: 600 }}>
          {t('pages.editor.topbar.title')}
        </Typography>
        <Box
          component="button"
          type="button"
          aria-label={t('pages.editor.topbar.meAriaLabel')}
          onClick={() => navigate('/me')}
          sx={{
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
            '&:hover': {
              bgcolor: '#22223a',
              color: 'text.primary',
            },
          }}
        >
          <PersonOutlineRounded sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          px: '24px',
          pt: '8px',
          pb: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          overflowY: 'auto',
          animation: 'fadeUp 0.35s ease forwards',
          '@keyframes fadeUp': {
            from: { opacity: 0, transform: 'translateY(10px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.13)',
            borderRadius: '4px',
          },
        }}
      >
        <Box>
          <Typography component="h1" sx={{ fontSize: '22px', fontWeight: 700, lineHeight: 1.3 }}>
            {t('pages.editor.headline')}
          </Typography>
          <Typography sx={{ mt: '6px', fontSize: '14px', color: 'text.secondary', lineHeight: 1.6 }}>
            {t('pages.editor.description')}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Box
            component="button"
            type="button"
            onClick={() => handleOpenOverlay('clipboard')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              p: '16px 18px',
              textAlign: 'left',
              bgcolor: '#1a1a2c',
              color: 'text.primary',
              border: '1px solid rgba(255,255,255,0.13)',
              borderRadius: '14px',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background-color 0.15s',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: '#22223a',
              },
            }}
          >
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                bgcolor: '#22223a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ContentPasteRounded sx={{ fontSize: 20, color: 'text.secondary' }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '15px', fontWeight: 600, color: 'text.primary' }}>
                {t('pages.editor.methods.clipboard.name')}
              </Typography>
              <Typography sx={{ mt: '2px', fontSize: '12px', color: 'text.secondary' }}>
                {t('pages.editor.methods.clipboard.desc')}
              </Typography>
            </Box>
            <Box
              sx={{
                px: '8px',
                py: '2px',
                borderRadius: '20px',
                bgcolor: 'rgba(110,96,238,0.25)',
                color: 'primary.light',
                fontSize: '11px',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {t('pages.editor.methods.clipboard.recommended')}
            </Box>
          </Box>

          <Box
            component="button"
            type="button"
            onClick={handlePickFile}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              p: '16px 18px',
              textAlign: 'left',
              bgcolor: '#1a1a2c',
              color: 'text.primary',
              border: '1px solid rgba(255,255,255,0.13)',
              borderRadius: '14px',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background-color 0.15s',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: '#22223a',
              },
            }}
          >
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                bgcolor: '#22223a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <UploadFileRounded sx={{ fontSize: 20, color: 'text.secondary' }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '15px', fontWeight: 600, color: 'text.primary' }}>
                {t('pages.editor.methods.upload.name')}
              </Typography>
              <Typography sx={{ mt: '2px', fontSize: '12px', color: 'text.secondary' }}>
                {t('pages.editor.methods.upload.desc')}
              </Typography>
            </Box>
          </Box>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.md,image/*"
            style={{ display: 'none' }}
            onChange={handleFileImport}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '12px',
            color: 'text.disabled',
            '&::before, &::after': {
              content: '""',
              flex: 1,
              height: 1,
              bgcolor: 'divider',
            },
          }}
        >
          {t('pages.editor.manualDivider')}
        </Box>

        <Box
          component="button"
          type="button"
          onClick={() => handleOpenOverlay('manual')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            p: '12px 18px',
            borderRadius: '14px',
            border: '1px dashed rgba(255,255,255,0.13)',
            bgcolor: 'transparent',
            color: 'text.secondary',
            textAlign: 'left',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'color 0.15s, border-color 0.15s',
            '&:hover': {
              color: 'text.primary',
              borderColor: 'rgba(255,255,255,0.13)',
            },
          }}
        >
          <EditOutlined sx={{ fontSize: 16 }} />
          {t('pages.editor.manualInput')}
        </Box>
      </Box>

      <EditorTextOverlay
        key={importVersion}
        open={overlayOpen}
        ocrLoading={ocrLoading}
        importedText={importedText}
        focusVersion={focusVersion}
        onClose={closeOverlay}
        onConfirm={handleConfirm}
      />
    </Box>
  )
}
