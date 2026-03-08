import { Button } from '@mui/material'
import type { MouseEventHandler } from 'react'

interface AuthSecondaryButtonProps {
  label: string
  disabled?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'submit'
  fullWidth?: boolean
}

export const AuthSecondaryButton = ({
  label,
  disabled = false,
  onClick,
  type = 'button',
  fullWidth = true,
}: AuthSecondaryButtonProps) => (
  <Button
    type={type}
    onClick={onClick}
    disabled={disabled}
    fullWidth={fullWidth}
    sx={{
      bgcolor: 'transparent',
      color: '#8888aa',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '999px',
      padding: '13px 24px',
      fontSize: 15,
      fontWeight: 600,
      textTransform: 'none',
      '&:hover': {
        color: '#eeeef6',
        borderColor: 'rgba(255,255,255,0.13)',
      },
    }}
  >
    {label}
  </Button>
)
