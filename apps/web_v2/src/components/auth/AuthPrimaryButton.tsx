import { Button } from '@mui/material'
import type { MouseEventHandler } from 'react'

interface AuthPrimaryButtonProps {
  label: string
  loadingLabel?: string
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  onClick?: MouseEventHandler<HTMLButtonElement>
  fullWidth?: boolean
}

export const AuthPrimaryButton = ({
  label,
  loadingLabel,
  loading = false,
  disabled = false,
  type = 'button',
  onClick,
  fullWidth = true,
}: AuthPrimaryButtonProps) => (
  <Button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    fullWidth={fullWidth}
    sx={{
      bgcolor: '#6e60ee',
      color: '#fff',
      borderRadius: '999px',
      padding: '13px 24px',
      fontSize: 15,
      fontWeight: 600,
      textTransform: 'none',
      boxShadow: '0 2px 12px rgba(110,96,238,0.25)',
      '&:hover': {
        bgcolor: '#8b7fff',
      },
      '&:disabled': {
        opacity: 0.4,
      },
    }}
  >
    {loading && loadingLabel ? loadingLabel : label}
  </Button>
)
