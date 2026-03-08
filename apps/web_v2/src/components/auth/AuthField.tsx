import { TextField, Typography } from '@mui/material'
import type { ChangeEvent } from 'react'
import type { SxProps, Theme } from '@mui/material/styles'
import { FieldError } from '../Alert'

interface AuthFieldProps {
  label: string
  type?: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  autoComplete?: string
  error?: string
  inputProps?: Record<string, unknown>
  textFieldSx?: SxProps<Theme>
}

const labelSx = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.8px',
  textTransform: 'uppercase' as const,
  color: '#55556a',
  mb: 0.75,
}

const baseRootSx = {
  bgcolor: '#22223a',
  borderRadius: '8px',
  fontSize: 15,
  color: '#eeeef6',
}

const baseInputSx: SxProps<Theme> = {
  '& .MuiInputBase-root': {
    ...baseRootSx,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '& .MuiInputBase-input::placeholder': {
    color: '#55556a',
    opacity: 1,
  },
}

export const AuthField = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  inputProps,
  textFieldSx,
}: AuthFieldProps) => (
  <>
    <Typography component="label" sx={labelSx}>
      {label}
    </Typography>
    <TextField
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      fullWidth
      error={Boolean(error)}
      inputProps={inputProps}
      sx={{
        ...baseInputSx,
        '& .MuiInputBase-root': {
          ...baseRootSx,
          border: `1px solid ${error ? '#f05252' : 'rgba(255,255,255,0.13)'}`,
        },
        ...textFieldSx,
      }}
    />
    {error && <FieldError message={error} />}
  </>
)
