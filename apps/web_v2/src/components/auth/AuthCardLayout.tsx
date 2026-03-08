import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'

interface AuthCardLayoutProps {
  title: string
  description: string
  children: ReactNode
}

export const AuthCardLayout = ({
  title,
  description,
  children,
}: AuthCardLayoutProps) => (
  <Box
    sx={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 2.5,
    }}
  >
    <Box
      sx={{
        width: '100%',
        maxWidth: 400,
        bgcolor: '#1a1a2c',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        p: '24px',
      }}
    >
      <Typography sx={{ fontSize: 24, fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#8888aa', mb: 3 }}>
        {description}
      </Typography>
      {children}
    </Box>
  </Box>
)

