import { HeadphonesRounded, PersonOutlineRounded } from '@mui/icons-material'
import { PageTopBar } from '../common/PageTopBar'

interface ExplainTopBarProps {
  articleTitle: string
  languageLabel: string
  backLabel: string
  onBackToPractice: () => void
  onOpenMe: () => void
}

export const ExplainTopBar = ({
  articleTitle,
  languageLabel,
  backLabel,
  onBackToPractice,
  onOpenMe,
}: ExplainTopBarProps) => (
  <PageTopBar
    title={articleTitle || '...'}
    subtitle={languageLabel}
    onBack={onBackToPractice}
    backAriaLabel={backLabel}
    actions={[
      {
        icon: <HeadphonesRounded sx={{ fontSize: 16 }} />,
        onClick: onBackToPractice,
        ariaLabel: backLabel,
      },
      {
        icon: <PersonOutlineRounded sx={{ fontSize: 16 }} />,
        onClick: onOpenMe,
      },
    ]}
  />
)

