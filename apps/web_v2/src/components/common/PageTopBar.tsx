import { ArrowBackRounded } from '@mui/icons-material'
import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'

interface PageTopBarAction {
  icon: ReactNode
  onClick: () => void
  ariaLabel?: string
}

interface PageTopBarProps {
  title: string
  subtitle: string
  onBack: () => void
  backAriaLabel?: string
  actions?: PageTopBarAction[]
}

const iconButtonSx = {
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

export const PageTopBar = ({
  title,
  subtitle,
  onBack,
  backAriaLabel,
  actions = [],
}: PageTopBarProps) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', px: '20px', pt: '16px', pb: '12px' }}>
    <Box component="button" type="button" sx={iconButtonSx} onClick={onBack} aria-label={backAriaLabel}>
      <ArrowBackRounded sx={{ fontSize: 16 }} />
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>
        {subtitle}
      </Typography>
    </Box>
    {actions.map((action, index) => (
      <Box
        key={`${action.ariaLabel ?? 'action'}-${index}`}
        component="button"
        type="button"
        sx={iconButtonSx}
        onClick={action.onClick}
        aria-label={action.ariaLabel}
      >
        {action.icon}
      </Box>
    ))}
  </Box>
)

