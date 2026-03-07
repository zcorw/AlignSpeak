import { GridViewRounded, PersonOutlineRounded } from '@mui/icons-material'
import { PageTopBar } from '../common/PageTopBar'

interface PracticeTopBarProps {
  articleTitle: string
  languageLabel: string
  onBack: () => void
  onOpenDrawer: () => void
  onOpenMe: () => void
}

export const PracticeTopBar = ({
  articleTitle,
  languageLabel,
  onBack,
  onOpenDrawer,
  onOpenMe,
}: PracticeTopBarProps) => (
  <PageTopBar
    title={articleTitle || '...'}
    subtitle={languageLabel}
    onBack={onBack}
    actions={[
      {
        icon: <GridViewRounded sx={{ fontSize: 15 }} />,
        onClick: onOpenDrawer,
      },
      {
        icon: <PersonOutlineRounded sx={{ fontSize: 16 }} />,
        onClick: onOpenMe,
      },
    ]}
  />
)
