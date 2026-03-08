import { NorthRounded } from '@mui/icons-material'
import { Button } from '@mui/material'
import { PageTopBar } from '../common/PageTopBar'

interface MeTopBarProps {
  title: string
  createLabel: string
  onBack: () => void
  onCreate: () => void
}

export const MeTopBar = ({
  title,
  createLabel,
  onBack,
  onCreate,
}: MeTopBarProps) => (
  <PageTopBar
    title={title}
    onBack={onBack}
    rightSlot={(
      <Button
        size="small"
        variant="contained"
        startIcon={<NorthRounded sx={{ fontSize: '13px !important' }} />}
        onClick={onCreate}
        sx={{ px: '14px', py: '7px' }}
      >
        {createLabel}
      </Button>
    )}
  />
)

