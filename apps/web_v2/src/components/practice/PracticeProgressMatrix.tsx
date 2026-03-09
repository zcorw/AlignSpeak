import { Box, Typography } from '@mui/material'
import { PRACTICE_LEVELS, type PracticeMatrix } from './shared'

interface PracticeProgressMatrixProps {
  matrix: PracticeMatrix
  compact?: boolean
}

export const PracticeProgressMatrix = ({
  matrix,
  compact = false,
}: PracticeProgressMatrixProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {PRACTICE_LEVELS.map((level) => (
      <Box key={level} sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Typography
          sx={{
            width: 22,
            fontSize: '11px',
            fontWeight: 700,
            color: 'text.disabled',
            fontFamily: '"SF Mono", "Fira Code", monospace',
          }}
        >
          {level}
        </Typography>
        <Box sx={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {(matrix[level] ?? []).map((state, index) => (
            <Box
              key={`${level}-${index}`}
              sx={{
                width: compact ? 20 : 28,
                height: compact ? 20 : 28,
                borderRadius: '6px',
                border: '1px solid transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: compact ? 9 : 11,
                fontWeight: 700,
                ...(state === 'pass' && {
                  bgcolor: 'rgba(29,201,138,0.1)',
                  color: 'success.main',
                  borderColor: 'rgba(29,201,138,0.2)',
                }),
                ...(state === 'current' && {
                  bgcolor: 'rgba(110,96,238,0.25)',
                  color: 'primary.light',
                  borderColor: '#6e60ee',
                }),
                ...(state === 'skip' && {
                  bgcolor: 'rgba(240,166,35,0.1)',
                  color: 'warning.main',
                  borderColor: 'rgba(240,166,35,0.2)',
                }),
                ...(state === 'fail' && {
                  bgcolor: '#22223a',
                  color: 'text.disabled',
                }),
              }}
            >
              {state === 'pass' ? 'OK' : state === 'current' ? index + 1 : state === 'skip' ? '->' : '-'}
            </Box>
          ))}
        </Box>
      </Box>
    ))}
  </Box>
)
