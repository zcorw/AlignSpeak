import { EditOutlined } from '@mui/icons-material'
import { Box } from '@mui/material'

interface EditorManualEntryTriggerProps {
  label: string
  onClick: () => void
}

export const EditorManualEntryTrigger = ({
  label,
  onClick,
}: EditorManualEntryTriggerProps) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      p: '12px 18px',
      borderRadius: '14px',
      border: '1px dashed rgba(255,255,255,0.13)',
      bgcolor: 'transparent',
      color: 'text.secondary',
      textAlign: 'left',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'color 0.15s, border-color 0.15s',
      '&:hover': {
        color: 'text.primary',
        borderColor: 'rgba(255,255,255,0.13)',
      },
    }}
  >
    <EditOutlined sx={{ fontSize: 16 }} />
    {label}
  </Box>
)

