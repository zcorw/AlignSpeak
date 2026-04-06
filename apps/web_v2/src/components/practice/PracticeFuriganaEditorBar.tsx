import { Box, TextField, Typography } from '@mui/material'
import { useMemo, useState } from 'react'

interface PracticeFuriganaEditorBarProps {
  visible: boolean
  activeSurface: string | null
  activeYomi: string
  activeCandidates: string[]
  activeNeedsConfirmation: boolean
  saving: boolean
  syncError: string | null
  emptyLabel: string
  placeholder: string
  candidatesLabel?: string
  needsConfirmLabel?: string
  splitLabel?: string
  splitAtLabel?: string
  mergePrevLabel?: string
  mergeNextLabel?: string
  resetLabel: string
  prevLabel: string
  nextLabel: string
  savingLabel: string
  onChangeYomi: (value: string) => void
  onPickCandidate: (value: string) => void
  onSplitToken: (splitAt: number) => void
  onMergeWithPrev: () => void
  onMergeWithNext: () => void
  onReset: () => void
  onPrev: () => void
  onNext: () => void
}

const navButtonSx = {
  border: '1px solid rgba(255,255,255,0.12)',
  bgcolor: 'transparent',
  color: 'text.secondary',
  borderRadius: '999px',
  px: '10px',
  py: '4px',
  fontSize: '12px',
  cursor: 'pointer',
  '&:hover': {
    borderColor: 'rgba(255,255,255,0.2)',
    color: 'text.primary',
  },
}

export const PracticeFuriganaEditorBar = ({
  visible,
  activeSurface,
  activeYomi,
  activeCandidates,
  activeNeedsConfirmation,
  saving,
  syncError,
  emptyLabel,
  placeholder,
  candidatesLabel = 'Candidates',
  needsConfirmLabel = 'Need confirmation',
  splitLabel = 'Split',
  splitAtLabel = 'Split at',
  mergePrevLabel = 'Merge Prev',
  mergeNextLabel = 'Merge Next',
  resetLabel,
  prevLabel,
  nextLabel,
  savingLabel,
  onChangeYomi,
  onPickCandidate,
  onSplitToken,
  onMergeWithPrev,
  onMergeWithNext,
  onReset,
  onPrev,
  onNext,
}: PracticeFuriganaEditorBarProps) => {
  const [splitAtState, setSplitAtState] = useState<{ surfaceKey: string; value: string }>({
    surfaceKey: '',
    value: '1',
  })
  const activeSurfaceLength = useMemo(() => (activeSurface ? Array.from(activeSurface).length : 0), [activeSurface])
  const surfaceKey = activeSurface ?? ''
  const defaultSplitText = activeSurfaceLength <= 1 ? '1' : String(Math.max(1, Math.floor(activeSurfaceLength / 2)))
  const splitAtText = splitAtState.surfaceKey === surfaceKey ? splitAtState.value : defaultSplitText
  const parsedSplitAt = Number(splitAtText)
  const splitAtValid = Number.isInteger(parsedSplitAt) && parsedSplitAt > 0 && parsedSplitAt < activeSurfaceLength

  if (!visible) return null
  return (
    <Box
      sx={{
        mt: '10px',
        p: '10px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.12)',
        bgcolor: '#22223a',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {!activeSurface ? (
        <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>
          {emptyLabel}
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <Box sx={{ px: '8px', py: '3px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.15)', fontSize: '13px' }}>
              {activeSurface}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeNeedsConfirmation && (
                <Typography sx={{ fontSize: '11px', color: '#f3b15f' }}>
                  {needsConfirmLabel}
                </Typography>
              )}
              <Box component="button" type="button" onClick={onReset} sx={{ border: 'none', bgcolor: 'transparent', color: 'text.disabled', fontSize: '12px', cursor: 'pointer' }}>
                {resetLabel}
              </Box>
            </Box>
          </Box>
          <TextField
            value={activeYomi}
            onChange={(event) => onChangeYomi(event.target.value)}
            placeholder={placeholder}
            size="small"
            fullWidth
            autoComplete="off"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#1a1a2c',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
              },
            }}
          />
          {activeCandidates.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Typography sx={{ fontSize: '11px', color: 'text.disabled' }}>
                {candidatesLabel}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {activeCandidates.map((candidate) => {
                  const selected = candidate === activeYomi
                  return (
                    <Box
                      key={candidate}
                      component="button"
                      type="button"
                      onClick={() => onPickCandidate(candidate)}
                      sx={{
                        border: '1px solid',
                        borderColor: selected ? '#6da5ff' : 'rgba(255,255,255,0.18)',
                        bgcolor: selected ? 'rgba(109,165,255,0.18)' : 'transparent',
                        color: selected ? '#dce9ff' : 'text.secondary',
                        borderRadius: '999px',
                        px: '10px',
                        py: '3px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {candidate}
                    </Box>
                  )
                })}
              </Box>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '11px', color: 'text.disabled' }}>
              {splitAtLabel}
            </Typography>
            <TextField
              type="number"
              size="small"
              value={splitAtText}
              onChange={(event) => setSplitAtState({ surfaceKey, value: event.target.value })}
              inputProps={{ min: 1, max: Math.max(activeSurfaceLength - 1, 1), step: 1 }}
              sx={{
                width: '88px',
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#1a1a2c',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
                },
              }}
            />
            <Box
              component="button"
              type="button"
              onClick={() => onSplitToken(parsedSplitAt)}
              disabled={!splitAtValid}
              sx={{
                ...navButtonSx,
                opacity: splitAtValid ? 1 : 0.45,
                cursor: splitAtValid ? 'pointer' : 'not-allowed',
              }}
            >
              {splitLabel}
            </Box>
            <Box component="button" type="button" onClick={onMergeWithPrev} sx={navButtonSx}>
              {mergePrevLabel}
            </Box>
            <Box component="button" type="button" onClick={onMergeWithNext} sx={navButtonSx}>
              {mergeNextLabel}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: '8px' }}>
            <Box component="button" type="button" onClick={onPrev} sx={navButtonSx}>
              {prevLabel}
            </Box>
            <Box component="button" type="button" onClick={onNext} sx={navButtonSx}>
              {nextLabel}
            </Box>
          </Box>
        </>
      )}

      {saving && (
        <Typography sx={{ fontSize: '11px', color: 'text.disabled' }}>
          {savingLabel}
        </Typography>
      )}
      {syncError && (
        <Typography sx={{ fontSize: '11px', color: 'error.main' }}>
          {syncError}
        </Typography>
      )}
    </Box>
  )
}
