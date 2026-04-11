import { Box, CircularProgress, Typography } from '@mui/material'
import { MeArticleCard } from './MeArticleCard'
import type { MeArticle } from './types'

interface MeArticleListProps {
  loadingLabel: string
  loading: boolean
  loadError: string | null
  emptyLabel: string
  articles: MeArticle[]
  activeArticleId: string | null
  languageLabel: (article: MeArticle) => string
  completedLabel: string
  allPassedLabel: string
  lastPracticeText: (article: MeArticle) => string
  practiceCountText: (article: MeArticle) => string
  doneBadgeLabel: string
  currentBadgeLabel: string
  legacyBadgeLabel: string
  editLabel: string
  deleteLabel: string
  onOpenArticle: (article: MeArticle) => void
  onEditArticle: (article: MeArticle) => void
  onDeleteArticle: (article: MeArticle) => void
  toArticleBadge: (title: string) => string
}

export const MeArticleList = ({
  loadingLabel,
  loading,
  loadError,
  emptyLabel,
  articles,
  activeArticleId,
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
  onOpenArticle,
  onEditArticle,
  onDeleteArticle,
  toArticleBadge,
}: MeArticleListProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', px: '20px', pt: '4px', pb: '32px', gap: '10px' }}>
    {loading && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', p: '12px 14px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '12px' }}>
        <CircularProgress size={16} thickness={5} />
        <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>{loadingLabel}</Typography>
      </Box>
    )}

    {loadError && (
      <Box sx={{ p: '10px 12px', bgcolor: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.25)', borderRadius: '12px' }}>
        <Typography sx={{ fontSize: '12px', color: 'error.main' }}>{loadError}</Typography>
      </Box>
    )}

    {!loading && !loadError && articles.length === 0 ? (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', py: '60px', px: '32px', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '15px', color: 'text.secondary' }}>
          {emptyLabel}
        </Typography>
      </Box>
    ) : (
      articles.map((article) => (
        <MeArticleCard
          key={article.id}
          article={article}
          isActive={activeArticleId === article.id}
          languageLabel={languageLabel(article)}
          completedLabel={completedLabel}
          allPassedLabel={allPassedLabel}
          lastPracticeText={lastPracticeText(article)}
          practiceCountText={practiceCountText(article)}
          doneBadgeLabel={doneBadgeLabel}
          currentBadgeLabel={currentBadgeLabel}
          legacyBadgeLabel={legacyBadgeLabel}
          editLabel={editLabel}
          deleteLabel={deleteLabel}
          onOpen={onOpenArticle}
          onEdit={onEditArticle}
          onDelete={onDeleteArticle}
          toArticleBadge={toArticleBadge}
        />
      ))
    )}
  </Box>
)
