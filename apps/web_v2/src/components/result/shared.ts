import type { PracticeLevel, PracticeProgressCellState } from '../../services/practiceService'
import type { AlignmentStatus } from '../../services/practiceAttemptService'
import type { PracticeMatrix } from '../practice/shared'

export type MatrixState = PracticeProgressCellState
export type Level = PracticeLevel

export const TARGET = 85
export const RESULT_LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4']

export const parseLevelFromQuery = (value: string | null): Level => {
  if (value === 'L1' || value === '1') return 'L1'
  if (value === 'L2' || value === '2') return 'L2'
  if (value === 'L3' || value === '3') return 'L3'
  if (value === 'L4' || value === '4') return 'L4'
  return 'L1'
}

export const nextLevel = (level: Level): Level | null => {
  if (level === 'L1') return 'L2'
  if (level === 'L2') return 'L3'
  if (level === 'L3') return 'L4'
  return null
}

export const createFallbackMatrix = (totalSegments: number, level: Level, segmentOrder: number): PracticeMatrix => {
  const safeCount = Math.max(totalSegments, 0)
  const matrix = RESULT_LEVELS.reduce(
    (acc, item) => {
      acc[item] = Array.from({ length: safeCount }, () => 'fail')
      return acc
    },
    {} as PracticeMatrix
  )
  if (safeCount <= 0) return matrix
  const index = Math.min(Math.max(segmentOrder - 1, 0), safeCount - 1)
  matrix[level][index] = 'current'
  return matrix
}

export const matrixCellSx = (state: MatrixState) => ({
  width: 28,
  height: 28,
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  fontWeight: 700,
  border: '1px solid transparent',
  ...(state === 'pass' && {
    bgcolor: 'rgba(29,201,138,0.1)',
    color: 'success.main',
    borderColor: 'rgba(29,201,138,0.2)',
  }),
  ...(state === 'current' && {
    bgcolor: 'rgba(110,96,238,0.25)',
    color: 'primary.light',
    borderColor: 'primary.main',
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
})

export const tokenSx = (state: AlignmentStatus) => ({
  display: 'inline',
  px: '2px',
  borderRadius: '3px',
  ...(state === 'correct' && {
    bgcolor: 'rgba(29,201,138,0.12)',
    color: 'text.primary',
  }),
  ...(state === 'substitute' && {
    bgcolor: 'rgba(240,82,82,0.2)',
    color: 'error.main',
    textDecoration: 'line-through',
  }),
  ...(state === 'missing' && {
    bgcolor: 'rgba(240,166,35,0.15)',
    color: 'warning.main',
  }),
  ...(state === 'insert' && {
    bgcolor: 'rgba(240,82,82,0.1)',
    color: 'text.secondary',
  }),
})

