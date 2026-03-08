import { Box, CircularProgress, Typography } from '@mui/material'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { StartCurrentArticleCard } from '../components/start/StartCurrentArticleCard'
import { StartHistoryList } from '../components/start/StartHistoryList'
import { StartPrimaryActions } from '../components/start/StartPrimaryActions'
import { StartTopBar } from '../components/start/StartTopBar'
import { useStartOverview } from '../hooks/start/useStartOverview'
import type { PracticeArticleDetail } from '../services/practiceService'
import { useAuthStore } from '../stores/authStore'

const languageToLabel = (
  language: PracticeArticleDetail['language'] | null,
  english: string,
  chinese: string
): string => {
  if (language === 'zh') return chinese
  if (language === 'ja') return 'Japanese'
  if (language === 'en') return english
  return '-'
}

const formatLastPracticedAt = (value: string | null): string => {
  if (!value) return '-'
  const time = Date.parse(value)
  if (Number.isNaN(time)) return '-'
  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time))
}

const buildArticleBadge = (title: string): string => {
  const letter = title.trim().charAt(0).toUpperCase()
  return letter || 'A'
}

export const StartPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { loading, loadError, overview, currentArticleDetail } = useStartOverview()

  const currentHistoryDoc = overview?.historyDocs[0] ?? null
  const fallbackLevel = overview?.currentLevel ?? 1
  const currentLevel = currentHistoryDoc?.level ?? fallbackLevel
  const totalSegments = Math.max(currentArticleDetail?.segments.length ?? 0, 0)
  const passedSegments = useMemo(() => {
    if (!currentHistoryDoc || totalSegments <= 0) return 0
    return Math.min(totalSegments, Math.max(0, Math.round(currentHistoryDoc.progressRate * totalSegments)))
  }, [currentHistoryDoc, totalSegments])
  const currentSegment = totalSegments > 0 ? Math.min(totalSegments, passedSegments + 1) : 1
  const progress = totalSegments > 0
    ? Math.round((passedSegments / totalSegments) * 100)
    : Math.round((currentHistoryDoc?.progressRate ?? 0) * 100)
  const languageLabel = languageToLabel(
    currentArticleDetail?.language ?? null,
    t('common.languageEnglish'),
    t('common.languageChinese')
  )
  const displayName = user?.displayName?.trim() || t('pages.start.userName')
  const recentArticles = overview?.historyDocs ?? []

  const handleContinue = () => {
    if (!currentHistoryDoc) {
      navigate('/editor')
      return
    }
    navigate(`/practice?a=${currentHistoryDoc.id}&seg=${currentSegment}`)
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <StartTopBar
        title={t('pages.start.appTitle')}
        meAriaLabel={t('pages.start.meAriaLabel')}
        onOpenMe={() => navigate('/me')}
      />

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: '24px',
          pt: '32px',
          pb: '48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '32px',
          animation: 'fadeUp 0.35s ease forwards',
          '@keyframes fadeUp': {
            from: { opacity: 0, transform: 'translateY(10px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.13)',
            borderRadius: '4px',
          },
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', p: '12px 14px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '12px' }}>
            <CircularProgress size={16} thickness={5} />
            <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>{t('common.loading')}</Typography>
          </Box>
        )}

        {loadError && (
          <Box sx={{ p: '12px 14px', bgcolor: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.25)', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '13px', color: 'error.main' }}>{loadError}</Typography>
          </Box>
        )}

        <Box>
          <Typography sx={{ fontSize: '14px', color: 'text.secondary', mb: '4px' }}>
            {t('pages.start.greetingPrefix')}
            <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
              {displayName}
            </Box>
          </Typography>
        </Box>

        <StartCurrentArticleCard
          languageLabel={languageLabel}
          title={currentHistoryDoc?.title ?? '-'}
          currentLevelLabel={t('pages.start.currentArticle.currentLevel')}
          currentSegmentLabel={t('pages.start.currentArticle.currentSegment')}
          currentLevel={currentLevel}
          currentSegment={currentSegment}
          totalSegments={totalSegments}
          lastPracticeLabel={t('pages.start.currentArticle.lastPractice')}
          lastPracticeValue={formatLastPracticedAt(currentHistoryDoc?.lastPracticedAt ?? null)}
          overallProgressLabel={t('pages.start.currentArticle.overallProgress', { level: currentLevel })}
          passedSegmentsLabel={t('pages.start.currentArticle.passedSegments', {
            passed: passedSegments,
            total: Math.max(totalSegments, 1),
          })}
          progress={progress}
        />

        <StartPrimaryActions
          continueLabel={t('pages.start.continuePractice')}
          orLabel={t('pages.start.or')}
          importLabel={t('pages.start.importNewArticle')}
          onContinue={handleContinue}
          onImport={() => navigate('/editor')}
        />

        <StartHistoryList
          title={t('pages.start.historyTitle')}
          emptyLabel="No practice history yet."
          docs={recentArticles}
          formatLastPracticedAt={formatLastPracticedAt}
          buildArticleBadge={buildArticleBadge}
          onOpenArticle={(articleId) => sessionStorage.setItem('article_id', articleId)}
        />
      </Box>
    </Box>
  )
}

