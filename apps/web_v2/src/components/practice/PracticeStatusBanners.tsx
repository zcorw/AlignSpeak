import { Box, Button, CircularProgress, Typography } from '@mui/material'

interface PracticeStatusBannersProps {
  loading: boolean
  loadError: string | null
  resultError: string | null
  loadingLabel: string
  importLabel: string
  onImport: () => void
}

export const PracticeStatusBanners = ({
  loading,
  loadError,
  resultError,
  loadingLabel,
  importLabel,
  onImport,
}: PracticeStatusBannersProps) => (
  <>
    {loading && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', p: '12px 14px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '12px' }}>
        <CircularProgress size={16} thickness={5} />
        <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>{loadingLabel}</Typography>
      </Box>
    )}

    {loadError && (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', p: '12px 14px', bgcolor: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.25)', borderRadius: '12px' }}>
        <Typography sx={{ fontSize: '13px', color: 'error.main' }}>{loadError}</Typography>
        <Button size="small" variant="outlined" onClick={onImport}>
          {importLabel}
        </Button>
      </Box>
    )}

    {resultError && (
      <Box sx={{ p: '10px 12px', bgcolor: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.25)', borderRadius: '12px' }}>
        <Typography sx={{ fontSize: '12px', color: 'error.main' }}>{resultError}</Typography>
      </Box>
    )}
  </>
)

