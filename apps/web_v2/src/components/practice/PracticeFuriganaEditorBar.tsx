import { Box, TextField, Typography } from '@mui/material'

interface PracticeFuriganaEditorBarProps {
  visible: boolean
  activeSurface: string | null
  activeYomi: string
  saving: boolean
  syncError: string | null
  emptyLabel: string
  placeholder: string
  resetLabel: string
  prevLabel: string
  nextLabel: string
  savingLabel: string
  onChangeYomi: (value: string) => void
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
  saving,
  syncError,
  emptyLabel,
  placeholder,
  resetLabel,
  prevLabel,
  nextLabel,
  savingLabel,
  onChangeYomi,
  onReset,
  onPrev,
  onNext,
}: PracticeFuriganaEditorBarProps) => {
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
            <Box component="button" type="button" onClick={onReset} sx={{ border: 'none', bgcolor: 'transparent', color: 'text.disabled', fontSize: '12px', cursor: 'pointer' }}>
              {resetLabel}
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

