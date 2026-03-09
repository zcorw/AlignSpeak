import { Box, Typography } from '@mui/material'
import { type ReactNode } from 'react'

interface PracticeSegmentCardProps {
  segmentLabel: string
  segmentText: ReactNode
  middleControls?: ReactNode
  readButton: ReactNode
}

export const PracticeSegmentCard = ({
  segmentLabel,
  segmentText,
  middleControls,
  readButton,
}: PracticeSegmentCardProps) => (
  <Box sx={{ bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '14px', p: '20px' }}>
    <Typography sx={{ mb: '10px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'text.disabled' }}>
      {segmentLabel}
    </Typography>
    <Box
      sx={{
        fontSize: '17px',
        lineHeight: 1.75,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        '& ruby': {
          whiteSpace: 'normal',
        },
        '& rt': {
          fontSize: '0.56em',
          color: 'rgba(255,255,255,0.68)',
          fontWeight: 500,
        },
      }}
    >
      {segmentText || '...'}
    </Box>
    {middleControls}
    {readButton}
  </Box>
)
