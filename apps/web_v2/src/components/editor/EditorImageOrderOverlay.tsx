import {
  CheckRounded,
  KeyboardArrowDownRounded,
  KeyboardArrowUpRounded,
  RestartAltRounded,
  WarningAmberRounded,
} from '@mui/icons-material'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'

export interface EditorImageOrderItem {
  imageId: string
  filename: string
  text: string
  pageMarkerCandidates: string[]
  suggestedOrder: number
}

interface EditorImageOrderOverlayProps {
  open: boolean
  loading: boolean
  title: string
  hint: string
  lowConfidenceHint: string
  cancelLabel: string
  restoreLabel: string
  confirmLabel: string
  loadingLabel: string
  pageMarkerLabel: string
  aiConfidence: number | null
  warnings: string[]
  items: EditorImageOrderItem[]
  onClose: () => void
  onConfirm: (orderedImageIds: string[]) => void
}

const previewText = (value: string): string => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 88) return normalized
  return `${normalized.slice(0, 88)}...`
}

export const EditorImageOrderOverlay = ({
  open,
  loading,
  title,
  hint,
  lowConfidenceHint,
  cancelLabel,
  restoreLabel,
  confirmLabel,
  loadingLabel,
  pageMarkerLabel,
  aiConfidence,
  warnings,
  items,
  onClose,
  onConfirm,
}: EditorImageOrderOverlayProps) => {
  const aiOrderedIds = useMemo(
    () =>
      [...items]
        .sort((left, right) => left.suggestedOrder - right.suggestedOrder)
        .map((item) => item.imageId),
    [items]
  )
  const itemMap = useMemo(() => new Map(items.map((item) => [item.imageId, item])), [items])
  const [orderedIds, setOrderedIds] = useState<string[]>(aiOrderedIds)

  useEffect(() => {
    if (!open) return
    setOrderedIds(aiOrderedIds)
  }, [aiOrderedIds, open])

  const visibleItems = orderedIds
    .map((id) => itemMap.get(id))
    .filter((item): item is EditorImageOrderItem => Boolean(item))

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= orderedIds.length) return
    setOrderedIds((prev) => {
      const next = [...prev]
      const currentId = next[index]
      next[index] = next[target]
      next[target] = currentId
      return next
    })
  }

  const isLowConfidence = aiConfidence != null && aiConfidence < 0.75
  const warningText = warnings.join(' ')

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
        zIndex: 210,
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
        <Typography sx={{ flex: 1, fontSize: '16px', fontWeight: 700 }}>{title}</Typography>
        <Button
          size="small"
          variant="text"
          onClick={onClose}
          disabled={loading}
          sx={{ minWidth: 0, px: '8px' }}
        >
          {cancelLabel}
        </Button>
      </Box>

      {loading ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
          }}
        >
          <CircularProgress size={30} thickness={4} />
          <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>{loadingLabel}</Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ p: '12px 20px 0' }}>
            <Typography sx={{ fontSize: '12px', color: 'text.secondary', lineHeight: 1.5 }}>
              {hint}
            </Typography>
            {(isLowConfidence || warnings.length > 0) && (
              <Box
                sx={{
                  mt: '10px',
                  p: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,193,7,0.35)',
                  bgcolor: 'rgba(255,193,7,0.10)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <WarningAmberRounded sx={{ fontSize: 16, color: 'warning.light', mt: '1px' }} />
                <Typography sx={{ fontSize: '12px', color: 'warning.light', lineHeight: 1.5 }}>
                  {[isLowConfidence ? lowConfidenceHint : '', warningText].filter(Boolean).join(' ')}
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ p: '10px 20px 8px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              variant="text"
              onClick={() => setOrderedIds(aiOrderedIds)}
              startIcon={<RestartAltRounded sx={{ fontSize: 16 }} />}
            >
              {restoreLabel}
            </Button>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              px: '20px',
              pb: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {visibleItems.map((item, index) => (
              <Box
                key={item.imageId}
                sx={{
                  p: '10px',
                  borderRadius: '10px',
                  bgcolor: '#1a1a2c',
                  border: '1px solid rgba(255,255,255,0.13)',
                  display: 'flex',
                  gap: '10px',
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '999px',
                    bgcolor: 'rgba(110,96,238,0.22)',
                    color: 'primary.light',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: 'text.primary' }}>
                    {item.filename}
                  </Typography>
                  <Typography sx={{ mt: '4px', fontSize: '11px', color: 'text.secondary', lineHeight: 1.45 }}>
                    {previewText(item.text)}
                  </Typography>
                  {item.pageMarkerCandidates.length > 0 && (
                    <Typography sx={{ mt: '4px', fontSize: '10px', color: 'primary.light' }}>
                      {`${pageMarkerLabel}: ${item.pageMarkerCandidates.join(', ')}`}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                  <Button
                    size="small"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    sx={{ minWidth: 0, p: '2px 6px' }}
                  >
                    <KeyboardArrowUpRounded sx={{ fontSize: 18 }} />
                  </Button>
                  <Button
                    size="small"
                    onClick={() => move(index, 1)}
                    disabled={index === visibleItems.length - 1}
                    sx={{ minWidth: 0, p: '2px 6px' }}
                  >
                    <KeyboardArrowDownRounded sx={{ fontSize: 18 }} />
                  </Button>
                </Box>
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              p: '12px 20px 24px',
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => onConfirm(orderedIds)}
              startIcon={<CheckRounded sx={{ fontSize: 16 }} />}
            >
              {confirmLabel}
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}
