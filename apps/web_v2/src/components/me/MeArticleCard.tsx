import { Box, Typography } from '@mui/material'
import type { MeArticle } from './types'

interface MeArticleCardProps {
  article: MeArticle
  isActive: boolean
  languageLabel: string
  completedLabel: string
  allPassedLabel: string
  lastPracticeText: string
  practiceCountText: string
  doneBadgeLabel: string
  currentBadgeLabel: string
  legacyBadgeLabel: string
  editLabel: string
  deleteLabel: string
  onOpen: (article: MeArticle) => void
  onEdit: (article: MeArticle) => void
  onDelete: (article: MeArticle) => void
  toArticleBadge: (title: string) => string
}

export const MeArticleCard = ({
  article,
  isActive,
  languageLabel,
  completedLabel,
  allPassedLabel,
  lastPracticeText,
  practiceCountText,
  doneBadgeLabel,
  currentBadgeLabel,
  legacyBadgeLabel,
  editLabel,
  deleteLabel,
  onOpen,
  onEdit,
  onDelete,
  toArticleBadge,
}: MeArticleCardProps) => (
  <Box
    component="button"
    type="button"
    onClick={() => onOpen(article)}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      p: '16px',
      textAlign: 'left',
      bgcolor: isActive ? 'rgba(110,96,238,0.04)' : '#1a1a2c',
      border: '1px solid',
      borderColor: isActive ? 'rgba(110,96,238,0.4)' : 'rgba(255,255,255,0.07)',
      borderRadius: '14px',
      cursor: 'pointer',
      transition: 'border-color 0.15s, background-color 0.15s',
      '&:hover': {
        borderColor: 'rgba(255,255,255,0.13)',
        bgcolor: '#22223a',
      },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <Box sx={{ width: 38, height: 38, borderRadius: '9px', bgcolor: '#22223a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0 }}>
        {toArticleBadge(article.title)}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.3, color: 'text.primary' }}>
          {article.title}
        </Typography>
        <Typography sx={{ mt: '3px', fontSize: '12px', color: 'text.secondary' }}>
          {languageLabel}
        </Typography>
      </Box>
      <Box sx={{ px: '9px', py: '3px', borderRadius: '999px', border: '1px solid rgba(110,96,238,0.25)', bgcolor: 'rgba(110,96,238,0.25)', color: 'primary.light', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0 }}>
        {article.isDone ? completedLabel : `L${article.level}`}
      </Box>
    </Box>

    <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <Box sx={{ flex: 1, height: 3, borderRadius: '3px', bgcolor: '#22223a', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${article.progressRate * 100}%`, borderRadius: '3px', background: 'linear-gradient(90deg, #6e60ee, #8b7fff)' }} />
      </Box>
      <Typography sx={{ fontSize: '11px', color: 'text.disabled', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
        {article.isDone ? allPassedLabel : `S${article.currentSegmentOrder}/${article.totalSegments}`}
      </Typography>
    </Box>

    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>
        {lastPracticeText}
      </Typography>
      <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>|</Typography>
      <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>
        {practiceCountText}
      </Typography>
      {article.isDone && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', px: '8px', py: '2px', borderRadius: '999px', bgcolor: 'rgba(29,201,138,0.1)', color: 'success.main', fontSize: '11px', fontWeight: 600 }}>
          {doneBadgeLabel}
        </Box>
      )}
      {isActive && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'primary.light' }}>
          {currentBadgeLabel}
        </Box>
      )}
      {article.isLegacy && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', px: '8px', py: '2px', borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.06)', color: 'text.secondary', fontSize: '11px', fontWeight: 600 }}>
          {legacyBadgeLabel}
        </Box>
      )}
    </Box>

    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', pt: '2px' }}>
      <Box
        component="button"
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onEdit(article)
        }}
        sx={{
          border: '1px solid rgba(255,255,255,0.16)',
          bgcolor: 'transparent',
          color: 'text.secondary',
          borderRadius: '999px',
          px: '10px',
          py: '4px',
          fontSize: '11px',
          cursor: 'pointer',
        }}
      >
        {editLabel}
      </Box>
      <Box
        component="button"
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onDelete(article)
        }}
        sx={{
          border: '1px solid rgba(240,82,82,0.35)',
          bgcolor: 'rgba(240,82,82,0.08)',
          color: 'error.main',
          borderRadius: '999px',
          px: '10px',
          py: '4px',
          fontSize: '11px',
          cursor: 'pointer',
        }}
      >
        {deleteLabel}
      </Box>
    </Box>
  </Box>
)
