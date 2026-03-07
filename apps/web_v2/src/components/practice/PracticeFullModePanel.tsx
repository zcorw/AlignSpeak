import { Box, Button, Typography } from '@mui/material'
import type { PracticeLevel } from '../../services/practiceService'
import { PRACTICE_LEVELS, type PracticeMatrix } from './shared'
import { PracticeProgressMatrix } from './PracticeProgressMatrix'

interface PracticeFullModePanelProps {
  trends: number[]
  matrix: PracticeMatrix
  level: PracticeLevel
  onSwitchLevel: (level: PracticeLevel) => void
  labels: {
    trend: string
    matrix: string
    switchLevel: string
    switchLevelHint: string
  }
}

export const PracticeFullModePanel = ({
  trends,
  matrix,
  level,
  onSwitchLevel,
  labels,
}: PracticeFullModePanelProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
    <Box sx={{ p: '16px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px' }}>
      <Typography sx={{ mb: '12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
        {labels.trend}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
        {trends.map((item, index) => (
          <Box key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <Box sx={{ width: 24, height: 40, borderRadius: '4px', bgcolor: '#1a1a2c', position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', bottom: 0, width: '100%', height: `${Math.max(4, Math.round((item / 100) * 40))}px`, borderRadius: '4px', bgcolor: item >= 85 ? 'success.main' : 'primary.main' }} />
            </Box>
            <Typography sx={{ fontSize: '10px', color: 'text.disabled', fontFamily: '"SF Mono", "Fira Code", monospace' }}>{item}%</Typography>
          </Box>
        ))}
      </Box>
    </Box>

    <Box sx={{ p: '16px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px' }}>
      <Typography sx={{ mb: '12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
        {labels.matrix}
      </Typography>
      <PracticeProgressMatrix matrix={matrix} />
    </Box>

    <Box sx={{ p: '16px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <Typography sx={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
          {labels.switchLevel}
        </Typography>
        <Box sx={{ display: 'flex', gap: '6px' }}>
          {PRACTICE_LEVELS.map((item) => (
            <Button
              key={item}
              size="small"
              variant="outlined"
              onClick={() => onSwitchLevel(item)}
              sx={{
                minWidth: '42px',
                borderColor: item === level ? 'rgba(110,96,238,0.3)' : 'rgba(255,255,255,0.07)',
                bgcolor: item === level ? 'rgba(110,96,238,0.25)' : 'transparent',
                color: item === level ? 'primary.light' : 'text.secondary',
              }}
            >
              {item}
            </Button>
          ))}
        </Box>
      </Box>
      <Typography sx={{ mt: '8px', fontSize: '12px', color: 'text.disabled' }}>
        {labels.switchLevelHint}
      </Typography>
    </Box>
  </Box>
)

