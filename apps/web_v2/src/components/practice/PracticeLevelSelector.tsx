import { Box, Button } from '@mui/material'
import type { PracticeLevel } from '../../services/practiceService'
import { PRACTICE_LEVELS } from './shared'

interface PracticeLevelSelectorProps {
  level: PracticeLevel
  disabled?: boolean
  onSwitchLevel: (nextLevel: PracticeLevel) => void
}

export const PracticeLevelSelector = ({
  level,
  disabled = false,
  onSwitchLevel,
}: PracticeLevelSelectorProps) => (
  <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
    {PRACTICE_LEVELS.map((item) => (
      <Button
        key={item}
        size="small"
        variant="outlined"
        disabled={disabled}
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
)
