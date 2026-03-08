import { PersonOutlineRounded } from '@mui/icons-material'
import { Box } from '@mui/material'
import { PageTopBar } from '../common/PageTopBar'

interface StartTopBarProps {
  title: string
  meAriaLabel: string
  onOpenMe: () => void
}

export const StartTopBar = ({
  title,
  meAriaLabel,
  onOpenMe,
}: StartTopBarProps) => (
  <PageTopBar
    title={title}
    leading={(
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: '8px',
          bgcolor: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          flexShrink: 0,
          color: '#fff',
          ml: '3px',
          mr: '3px',
        }}
      >
        A
      </Box>
    )}
    actions={[
      {
        icon: <PersonOutlineRounded sx={{ fontSize: 16 }} />,
        onClick: onOpenMe,
        ariaLabel: meAriaLabel,
      },
    ]}
  />
)

