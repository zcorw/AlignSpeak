import { Box, Typography } from '@mui/material'

interface PracticeMetaBarProps {
  level: string
  segmentProgressLabel: string
  targetAccuracyLabel: string
}

export const PracticeMetaBar = ({
  level,
  segmentProgressLabel,
  targetAccuracyLabel,
}: PracticeMetaBarProps) => (
  <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
    <Box sx={{ px: '10px', py: '3px', borderRadius: '999px', bgcolor: 'rgba(110,96,238,0.25)', border: '1px solid rgba(110,96,238,0.3)', color: 'primary.light', fontSize: '12px', fontWeight: 600 }}>
      {level}
    </Box>
    <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
      {segmentProgressLabel}
    </Typography>
    <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>
      {targetAccuracyLabel}
    </Typography>
  </Box>
)

