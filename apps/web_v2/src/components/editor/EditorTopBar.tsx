import { PersonOutlineRounded } from '@mui/icons-material'
import { PageTopBar } from '../common/PageTopBar'

interface EditorTopBarProps {
  title: string
  backAriaLabel: string
  meAriaLabel: string
  onBack: () => void
  onOpenMe: () => void
}

export const EditorTopBar = ({
  title,
  backAriaLabel,
  meAriaLabel,
  onBack,
  onOpenMe,
}: EditorTopBarProps) => (
  <PageTopBar
    title={title}
    onBack={onBack}
    backAriaLabel={backAriaLabel}
    actions={[
      {
        icon: <PersonOutlineRounded sx={{ fontSize: 16 }} />,
        onClick: onOpenMe,
        ariaLabel: meAriaLabel,
      },
    ]}
  />
)

