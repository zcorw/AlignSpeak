import { Box, Typography } from '@mui/material'
import { ErrorOutlineRounded, CheckCircleOutlineRounded, InfoOutlined } from '@mui/icons-material'

interface AlertProps {
  type: 'error' | 'success' | 'info'
  message: string
}

export const Alert = ({ type, message }: AlertProps) => {
  const config = {
    error: {
      icon: ErrorOutlineRounded,
      bgcolor: 'rgba(240,82,82,0.1)',
      borderColor: 'rgba(240,82,82,0.3)',
      color: '#f05252',
      iconColor: '#f05252',
    },
    success: {
      icon: CheckCircleOutlineRounded,
      bgcolor: 'rgba(29,201,138,0.1)',
      borderColor: 'rgba(29,201,138,0.3)',
      color: '#1dc98a',
      iconColor: '#1dc98a',
    },
    info: {
      icon: InfoOutlined,
      bgcolor: 'rgba(110,96,238,0.15)',
      borderColor: 'rgba(110,96,238,0.3)',
      color: '#8b7fff',
      iconColor: '#8b7fff',
    },
  }

  const { icon: Icon, bgcolor, borderColor, color, iconColor } = config[type]

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        px: '14px',
        py: '12px',
        bgcolor,
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        color,
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <Icon sx={{ fontSize: 18, color: iconColor, mt: '1px', flexShrink: 0 }} />
      <Typography sx={{ fontSize: 14, color, flex: 1 }}>{message}</Typography>
    </Box>
  )
}

interface FieldErrorProps {
  message: string
}

export const FieldError = ({ message }: FieldErrorProps) => {
  return (
    <Typography
      sx={{
        mt: '6px',
        fontSize: '12px',
        color: '#f05252',
        lineHeight: 1.4,
      }}
    >
      {message}
    </Typography>
  )
}
