import { type SxProps, type Theme } from '@mui/material'
import type { PracticeLevel, PracticeProgressCellState } from '../../services/practiceService'

export type PracticeMatrix = Record<PracticeLevel, PracticeProgressCellState[]>

export const PRACTICE_LEVELS: PracticeLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4']

export const iconButtonSx: SxProps<Theme> = {
  width: 36,
  height: 36,
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.13)',
  bgcolor: '#1a1a2c',
  color: 'text.secondary',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
  '&:hover': { bgcolor: '#22223a', color: 'text.primary' },
}
