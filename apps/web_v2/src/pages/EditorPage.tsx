import {
  ArrowBackRounded,
  CloseRounded,
  EditOutlined,
  PersonOutlineRounded,
} from '@mui/icons-material'
import { Box, Button, CircularProgress, MenuItem, Select, Typography } from '@mui/material'
import { ChangeEvent, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type LanguageCode = 'en' | 'zh' | 'ja' | 'ko' | 'fr'

const SAMPLE_TEXT = `Once when I was six years old I saw a magnificent picture in a book about the primeval forest.

It was a picture of a boa constrictor in the act of swallowing an animal.

In the book it said: Boa constrictors swallow their prey whole, without chewing it. After that I used to think a lot about jungle adventures.

I showed my masterpiece to the grown-ups, and asked them whether the drawing frightened them.

They answered: "Why should anyone be frightened by a hat?"`

const detectLanguage = (value: string): LanguageCode => {
  const cjk = (value.match(/[\u4e00-\u9fff]/g) ?? []).length
  const jp = (value.match(/[\u3040-\u30ff]/g) ?? []).length
  const kr = (value.match(/[\uac00-\ud7af]/g) ?? []).length

  if (jp > 5) return 'ja'
  if (kr > 5) return 'ko'
  if (cjk > 10) return 'zh'
  return 'en'
}

export const EditorPage = () => {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [language, setLanguage] = useState<LanguageCode>('en')
  const [text, setText] = useState('')

  const trimmedText = text.trim()
  const segments = useMemo(
    () => (trimmedText ? trimmedText.split(/\n+/).map((item) => item.trim()).filter(Boolean) : []),
    [trimmedText]
  )
  const charCount = trimmedText.replace(/\s/g, '').length

  const validationMessage = useMemo(() => {
    if (trimmedText.length < 20) return '文本不能少于 20 个字符'
    if (segments.length < 1) return '至少需要 1 个段落'
    if (segments.length > 30) return `段落数超出上限（${segments.length}/30），请在此手动拆分或精简`
    return ''
  }, [segments.length, trimmedText.length])

  const canConfirm = validationMessage.length === 0
  const statsWarn = segments.length > 30 ? '超出上限' : segments.length > 20 ? '接近上限' : ''

  const applyImportedText = (value: string) => {
    setText(value)
    setLanguage(detectLanguage(value))
  }

  const handleOpenOverlay = (source: 'clipboard' | 'manual') => {
    setOverlayOpen(true)
    if (source === 'manual') {
      window.setTimeout(() => textareaRef.current?.focus(), 350)
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
      window.setTimeout(() => {
        setOcrLoading(false)
        applyImportedText(SAMPLE_TEXT)
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

  const handleConfirm = () => {
    if (!canConfirm) return
    sessionStorage.setItem('article_text', text)
    sessionStorage.setItem('article_lang', language)
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
          aria-label="返回"
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
        <Typography sx={{ flex: 1, fontSize: '16px', fontWeight: 600 }}>新建文章</Typography>
        <Box
          component="button"
          type="button"
          aria-label="我的"
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
            选择导入方式
          </Typography>
          <Typography sx={{ mt: '6px', fontSize: '14px', color: 'text.secondary', lineHeight: 1.6 }}>
            将文章导入后，你可以进行校对和分段确认。
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
                fontSize: '20px',
              }}
            >
              📋
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '15px', fontWeight: 600, color: 'text.primary' }}>从剪贴板粘贴</Typography>
              <Typography sx={{ mt: '2px', fontSize: '12px', color: 'text.secondary' }}>
                直接粘贴已复制的文本
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
              推荐
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
                fontSize: '20px',
              }}
            >
              📄
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '15px', fontWeight: 600, color: 'text.primary' }}>上传文件</Typography>
              <Typography sx={{ mt: '2px', fontSize: '12px', color: 'text.secondary' }}>
                支持 .txt · .md · 图片 OCR
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
          或手动输入
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
          输入文本内容
        </Box>
      </Box>

      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          left: '50%',
          width: '100%',
          maxWidth: '430px',
          transform: overlayOpen ? 'translate(-50%, 0)' : 'translate(-50%, 100%)',
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
            aria-label="关闭"
            onClick={() => setOverlayOpen(false)}
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
          <Typography sx={{ flex: 1, fontSize: '16px', fontWeight: 600 }}>校对文本</Typography>
          <Box
            sx={{
              fontSize: '12px',
              color: 'text.disabled',
              fontFamily: '"SF Mono", "Fira Code", monospace',
            }}
          >
            {charCount} 字 · {segments.length} 段{' '}
            {statsWarn && (
              <Box
                component="span"
                sx={{ color: segments.length > 30 ? 'error.main' : 'warning.main' }}
              >
                {statsWarn}
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
            <Typography sx={{ fontSize: '14px', color: 'text.secondary' }}>正在识别图片文字…</Typography>
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
                  onChange={(event) => setLanguage(event.target.value as LanguageCode)}
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
                  <MenuItem value="en">🇺🇸 English</MenuItem>
                  <MenuItem value="zh">🇨🇳 中文</MenuItem>
                  <MenuItem value="ja">🇯🇵 日本語</MenuItem>
                  <MenuItem value="ko">🇰🇷 한국어</MenuItem>
                  <MenuItem value="fr">🇫🇷 Français</MenuItem>
                </Select>
                <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>自动检测 · 可修改</Typography>
              </Box>

              <Box
                component="textarea"
                ref={textareaRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={'在此输入或粘贴文章内容…\n\n以换行分隔段落。'}
                sx={{
                  flex: 1,
                  minHeight: 0,
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
              {segments.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <Typography
                    sx={{
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.7px',
                      textTransform: 'uppercase',
                      color: 'text.disabled',
                    }}
                  >
                    段落预览
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {segments.slice(0, 4).map((item, index) => (
                      <Box
                        key={`${item}-${index}`}
                        sx={{
                          px: '10px',
                          py: '4px',
                          maxWidth: 120,
                          borderRadius: '999px',
                          bgcolor: '#22223a',
                          border: '1px solid rgba(255,255,255,0.07)',
                          fontSize: '12px',
                          color: 'text.secondary',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {`§${index + 1} ${item.slice(0, 12)}${item.length > 12 ? '…' : ''}`}
                      </Box>
                    ))}
                    {segments.length > 4 && (
                      <Box
                        sx={{
                          px: '10px',
                          py: '4px',
                          borderRadius: '999px',
                          bgcolor: '#22223a',
                          border: '1px solid rgba(255,255,255,0.07)',
                          fontSize: '12px',
                          color: 'text.disabled',
                        }}
                      >
                        +{segments.length - 4} 段
                      </Box>
                    )}
                  </Box>
                </Box>
              )}

              {validationMessage && (
                <Typography sx={{ fontSize: '13px', color: 'error.main' }}>{validationMessage}</Typography>
              )}

              <Button
                variant="contained"
                size="large"
                fullWidth
                disabled={!canConfirm}
                onClick={handleConfirm}
                sx={{
                  boxShadow: '0 2px 12px rgba(110,96,238,0.25)',
                  '&:hover': {
                    bgcolor: 'primary.light',
                  },
                }}
              >
                确认并开始练习
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}
