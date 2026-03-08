import { CloseRounded, StopRounded } from '@mui/icons-material'
import { Box, Button, Typography } from '@mui/material'
import { type ReactNode } from 'react'
import { iconButtonSx } from './shared'

interface PracticeRecordingOverlayProps {
  open: boolean
  timerText: string
  segmentLabel: string
  segmentText: ReactNode
  readButton: ReactNode
  recordingStatusLabel: string
  stopLabel: string
  onClose: () => void
  onStop: () => void
}

export const PracticeRecordingOverlay = ({
  open,
  timerText,
  segmentLabel,
  segmentText,
  readButton,
  recordingStatusLabel,
  stopLabel,
  onClose,
  onStop,
}: PracticeRecordingOverlayProps) => (
  <Box
    sx={{
      position: 'fixed',
      inset: 0,
      left: '50%',
      width: '100%',
      maxWidth: '430px',
      transform: open ? 'translate(-50%, 0)' : 'translate(-50%, 100%)',
      transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      zIndex: 300,
      bgcolor: 'background.default',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', p: '16px 20px' }}>
      <Box component="button" type="button" sx={{ ...iconButtonSx, border: '1px solid transparent', bgcolor: 'transparent' }} onClick={onClose}>
        <CloseRounded sx={{ fontSize: 16 }} />
      </Box>
      <Typography sx={{ color: 'error.main', fontSize: '14px', fontWeight: 600 }}>
        {recordingStatusLabel}
      </Typography>
      <Box sx={{ flex: 1 }} />
      <Typography sx={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', color: 'text.secondary' }}>{timerText}</Typography>
    </Box>

    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', p: '24px 28px 12px', gap: '14px' }}>
      <Typography sx={{ fontSize: '12px', color: 'text.disabled', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        {segmentLabel}
      </Typography>
      <Box sx={{ width: '100%', maxWidth: '360px', flex: 1, minHeight: 0, overflowY: 'auto', px: '2px' }}>
        <Typography
          sx={{
            display: 'block',
            width: '100%',
            fontSize: '20px',
            lineHeight: 1.9,
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            lineBreak: 'auto',
            '& ruby': {
              whiteSpace: 'normal',
            },
          }}
        >
          {segmentText}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px', height: 32 }}>
        {Array.from({ length: 7 }).map((_, index) => (
          <Box
            key={index}
            sx={{
              width: 4,
              borderRadius: '2px',
              bgcolor: 'error.main',
              animation: 'wave 0.8s ease-in-out infinite alternate',
              animationDelay: `${(index % 3) * 0.1}s`,
              '@keyframes wave': { from: { height: 4 }, to: { height: 28 } },
            }}
          />
        ))}
      </Box>
      {readButton}
    </Box>

    <Box sx={{ p: '16px 24px calc(24px + env(safe-area-inset-bottom, 0px))' }}>
      <Button variant="contained" color="error" size="large" fullWidth startIcon={<StopRounded />} onClick={onStop}>
        {stopLabel}
      </Button>
    </Box>
  </Box>
)
