import { Box, Typography } from '@mui/material'

interface ResultErrorStateProps {
  message: string
}

export const ResultErrorState = ({ message }: ResultErrorStateProps) => (
  <Box sx={{ p: '10px 12px', bgcolor: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.25)', borderRadius: '12px' }}>
    <Typography sx={{ fontSize: '12px', color: 'error.main' }}>{message}</Typography>
  </Box>
)

