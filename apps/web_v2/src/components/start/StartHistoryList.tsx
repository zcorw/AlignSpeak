import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { StartHistoryDoc } from '../../services/startService'

interface StartHistoryListProps {
  title: string
  emptyLabel: string
  docs: StartHistoryDoc[]
  formatLastPracticedAt: (value: string | null) => string
  buildArticleBadge: (title: string) => string
  onOpenArticle?: (articleId: string) => void
}

export const StartHistoryList = ({
  title,
  emptyLabel,
  docs,
  formatLastPracticedAt,
  buildArticleBadge,
  onOpenArticle,
}: StartHistoryListProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <Typography sx={{ px: '2px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'text.disabled' }}>
      {title}
    </Typography>

    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {docs.length === 0 && (
        <Box sx={{ p: '12px 14px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px' }}>
          <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>{emptyLabel}</Typography>
        </Box>
      )}
      {docs.map((article) => (
        <Box
          key={article.id}
          component={Link}
          to={`/practice?a=${article.id}`}
          onClick={() => onOpenArticle?.(article.id)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            p: '13px 16px',
            bgcolor: '#1a1a2c',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '8px',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'border-color 0.15s, background-color 0.15s',
            '&:hover': {
              borderColor: 'rgba(255,255,255,0.13)',
              bgcolor: '#22223a',
            },
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              bgcolor: '#22223a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              flexShrink: 0,
              color: 'text.secondary',
            }}
          >
            {buildArticleBadge(article.title)}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {article.title}
            </Typography>
            <Typography sx={{ mt: '2px', fontSize: '12px', color: 'text.secondary' }}>
              {formatLastPracticedAt(article.lastPracticedAt)}
            </Typography>
          </Box>

          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'primary.light', fontFamily: '"SF Mono", "Fira Code", monospace', flexShrink: 0 }}>
            L{article.level}
          </Typography>
        </Box>
      ))}
    </Box>
  </Box>
)

