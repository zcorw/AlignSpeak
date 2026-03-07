import { NorthRounded, PersonOutlineRounded } from '@mui/icons-material'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { getApiErrorMessage } from '../services/authService'
import { practiceService, type PracticeArticleDetail } from '../services/practiceService'
import { startService, type StartOverview } from '../services/startService'
import { useAuthStore } from '../stores/authStore'

const languageToLabel = (language: PracticeArticleDetail['language'] | null, english: string, chinese: string): string => {
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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [overview, setOverview] = useState<StartOverview | null>(null)
  const [currentArticleDetail, setCurrentArticleDetail] = useState<PracticeArticleDetail | null>(null)

  useEffect(() => {
    let active = true

    const loadStartData = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const nextOverview = await startService.getOverview()
        if (!active) return
        setOverview(nextOverview)

        const currentArticleId = nextOverview.historyDocs[0]?.id
        if (!currentArticleId) {
          setCurrentArticleDetail(null)
          return
        }

        const detail = await practiceService.getPracticeArticle(currentArticleId)
        if (!active) return
        setCurrentArticleDetail(detail)
        sessionStorage.setItem('article_id', detail.articleId)
        sessionStorage.setItem('article_lang', detail.language)
      } catch (error: unknown) {
        if (!active) return
        setLoadError(getApiErrorMessage(error, t('common.error')))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadStartData()
    return () => {
      active = false
    }
  }, [t])

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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: '20px',
          pt: '16px',
          pb: '12px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: '8px',
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            flexShrink: 0,
          }}
        >
          A
        </Box>
        <Typography sx={{ fontSize: '15px', fontWeight: 600, flex: 1 }}>
          {t('pages.start.appTitle')}
        </Typography>
        <Box
          component="button"
          type="button"
          aria-label={t('pages.start.meAriaLabel')}
          onClick={() => navigate('/me')}
          sx={{
            width: 36,
            height: 36,
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.13)',
            bgcolor: '#1a1a2c',
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'background-color 0.15s, color 0.15s',
            '&:hover': {
              bgcolor: '#22223a',
              color: 'text.primary',
            },
          }}
        >
          <PersonOutlineRounded sx={{ fontSize: 16 }} />
        </Box>
      </Box>

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

        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            bgcolor: '#1a1a2c',
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: '14px',
            p: '22px',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #6e60ee, #8b7fff)',
            },
          }}
        >
          <Typography
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              mb: '10px',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: 'text.disabled',
            }}
          >
            {languageLabel}
          </Typography>

          <Typography sx={{ mb: '20px', fontSize: '17px', fontWeight: 600, lineHeight: 1.4 }}>
            {currentHistoryDoc?.title ?? '-'}
          </Typography>

          <Box sx={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'text.disabled' }}>
                {t('pages.start.currentArticle.currentLevel')}
              </Typography>
              <Typography sx={{ fontSize: '15px', fontWeight: 700, fontFamily: '"SF Mono", "Fira Code", monospace' }}>
                <Box component="span" sx={{ color: 'primary.light' }}>L{currentLevel}</Box>
              </Typography>
            </Box>

            <Box sx={{ width: 1, alignSelf: 'stretch', mx: '4px', bgcolor: 'divider' }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'text.disabled' }}>
                {t('pages.start.currentArticle.currentSegment')}
              </Typography>
              <Typography sx={{ fontSize: '15px', fontWeight: 700, fontFamily: '"SF Mono", "Fira Code", monospace' }}>
                {currentSegment}
                <Box component="span" sx={{ ml: 0.5, fontSize: '13px', color: 'text.secondary', fontWeight: 400 }}>
                  / {Math.max(totalSegments, 1)}
                </Box>
              </Typography>
            </Box>

            <Box sx={{ width: 1, alignSelf: 'stretch', mx: '4px', bgcolor: 'divider' }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'text.disabled' }}>
                {t('pages.start.currentArticle.lastPractice')}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: 'text.secondary', fontWeight: 500 }}>
                {formatLastPracticedAt(currentHistoryDoc?.lastPracticedAt ?? null)}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'text.secondary' }}>
              <Typography component="span" sx={{ fontSize: '12px', color: 'text.secondary' }}>
                {t('pages.start.currentArticle.overallProgress', { level: currentLevel })}
              </Typography>
              <Typography component="span" sx={{ fontSize: '12px', color: 'text.secondary' }}>
                {t('pages.start.currentArticle.passedSegments', {
                  passed: passedSegments,
                  total: Math.max(totalSegments, 1),
                })}
              </Typography>
            </Box>
            <Box sx={{ height: 4, bgcolor: '#22223a', borderRadius: '4px', overflow: 'hidden' }}>
              <Box
                sx={{
                  width: `${Math.max(0, Math.min(100, progress))}%`,
                  height: '100%',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease',
                  background: 'linear-gradient(90deg, #6e60ee, #8b7fff)',
                }}
              />
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleContinue}
            sx={{
              boxShadow: '0 2px 12px rgba(110,96,238,0.25)',
              '&:hover': {
                bgcolor: 'primary.light',
              },
            }}
          >
            {t('pages.start.continuePractice')}
          </Button>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'text.disabled',
              fontSize: '12px',
              '&::before, &::after': {
                content: '""',
                flex: 1,
                height: 1,
                bgcolor: 'divider',
              },
            }}
          >
            {t('pages.start.or')}
          </Box>

          <Button
            variant="outlined"
            fullWidth
            startIcon={<NorthRounded sx={{ fontSize: '16px !important' }} />}
            onClick={() => navigate('/editor')}
            sx={{
              bgcolor: '#22223a',
              borderColor: 'rgba(255,255,255,0.13)',
              color: 'text.primary',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.13)',
                bgcolor: '#1a1a2c',
              },
            }}
          >
            {t('pages.start.importNewArticle')}
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Typography sx={{ px: '2px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'text.disabled' }}>
            {t('pages.start.historyTitle')}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentArticles.length === 0 && (
              <Box sx={{ p: '12px 14px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px' }}>
                <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>No practice history yet.</Typography>
              </Box>
            )}
            {recentArticles.map((article) => (
              <Box
                key={article.id}
                component={Link}
                to={`/practice?a=${article.id}`}
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
      </Box>
    </Box>
  )
}
