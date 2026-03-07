import { PersonOutlineRounded } from '@mui/icons-material'
import { PageTopBar } from '../common/PageTopBar'

interface ResultTopBarProps {
  articleTitle: string
  subtitle: string
  onBack: () => void
  onOpenMe: () => void
}

export const ResultTopBar = ({
  articleTitle,
  subtitle,
  onBack,
  onOpenMe,
}: ResultTopBarProps) => (
  <PageTopBar
    title={articleTitle || '...'}
    subtitle={subtitle}
    onBack={onBack}
    actions={[
      {
        icon: <PersonOutlineRounded sx={{ fontSize: 16 }} />,
        onClick: onOpenMe,
      },
    ]}
  />
)

