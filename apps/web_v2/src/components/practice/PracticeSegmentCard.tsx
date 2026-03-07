import { Box, Typography } from '@mui/material'
import { type ReactNode } from 'react'

interface PracticeSegmentCardProps {
  segmentLabel: string
  segmentText: string
  readButton: ReactNode
}

export const PracticeSegmentCard = ({
  segmentLabel,
  segmentText,
  readButton,
}: PracticeSegmentCardProps) => (
  <Box sx={{ bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '14px', p: '20px' }}>
    <Typography sx={{ mb: '10px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'text.disabled' }}>
      {segmentLabel}
    </Typography>
    <Typography sx={{ fontSize: '17px', lineHeight: 1.75 }}>{segmentText || '...'}</Typography>
    {readButton}
  </Box>
)

