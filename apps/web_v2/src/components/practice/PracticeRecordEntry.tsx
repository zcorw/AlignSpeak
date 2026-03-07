import { MicRounded } from '@mui/icons-material'
import { Box, Typography } from '@mui/material'

interface PracticeRecordEntryProps {
  canPractice: boolean
  isRecording: boolean
  onStart: () => void
  label: string
}

export const PracticeRecordEntry = ({
  canPractice,
  isRecording,
  onStart,
  label,
}: PracticeRecordEntryProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', pt: '8px', pb: '4px' }}>
    <Box
      component="button"
      type="button"
      onClick={onStart}
      disabled={!canPractice || isRecording}
      sx={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        border: 'none',
        bgcolor: 'primary.main',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: canPractice && !isRecording ? 'pointer' : 'default',
        opacity: canPractice && !isRecording ? 1 : 0.5,
        transition: 'transform 0.15s',
        '&:hover': canPractice && !isRecording ? { transform: 'scale(1.05)' } : undefined,
      }}
    >
      <MicRounded sx={{ fontSize: 24 }} />
    </Box>
    <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
      {label}
    </Typography>
  </Box>
)

