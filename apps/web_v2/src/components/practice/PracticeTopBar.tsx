import { ArrowBackRounded, GridViewRounded, PersonOutlineRounded } from '@mui/icons-material'
import { Box, Typography } from '@mui/material'
import { iconButtonSx } from './shared'

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
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', px: '20px', pt: '16px', pb: '12px' }}>
    <Box component="button" type="button" sx={iconButtonSx} onClick={onBack}>
      <ArrowBackRounded sx={{ fontSize: 16 }} />
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {articleTitle || '...'}
      </Typography>
      <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>
        {languageLabel}
      </Typography>
    </Box>
    <Box component="button" type="button" sx={iconButtonSx} onClick={onOpenDrawer}>
      <GridViewRounded sx={{ fontSize: 15 }} />
    </Box>
    <Box component="button" type="button" sx={iconButtonSx} onClick={onOpenMe}>
      <PersonOutlineRounded sx={{ fontSize: 16 }} />
    </Box>
  </Box>
)

