import { ArrowBackRounded, CloseRounded, NorthRounded } from '@mui/icons-material'
import { Box, Button, CircularProgress, TextField, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Alert, FieldError } from '../components/Alert'
import { authService, getApiErrorMessage } from '../services/authService'
import { startService, type StartHistoryDoc } from '../services/startService'
import { useAuthStore } from '../stores/authStore'
import { changePasswordSchema } from '../utils/validation'
import { ZodError } from 'zod'

type FilterType = 'all' | 'en' | 'zh' | 'done'

type MeArticle = {
  id: string
  title: string
  language: StartHistoryDoc['language']
  level: number
  currentSegmentOrder: number
  totalSegments: number
  lastPracticedAt: string | null
  progressRate: number
  isDone: boolean
  practiceCount: number
  isActive: boolean
}

const iconButtonSx = {
  width: 36,
  height: 36,
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.13)',
  bgcolor: '#1a1a2c',
  color: 'text.secondary',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
  '&:hover': { bgcolor: '#22223a', color: 'text.primary' },
} as const

const formatLastPracticedAt = (value: string | null): string => {
  if (!value) return '-'
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return '-'
  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

const toArticleBadge = (title: string): string => {
  const letter = title.trim().charAt(0).toUpperCase()
  return letter || 'A'
}

const toLanguageLabel = (
  language: StartHistoryDoc['language'],
  english: string,
  chinese: string
): string => {
  if (language === 'en') return english
  if (language === 'zh') return chinese
  if (language === 'ja') return 'Japanese'
  return '-'
}

export const MePage = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const [filter, setFilter] = useState<FilterType>('all')
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [articles, setArticles] = useState<MeArticle[]>([])

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    let active = true

    const loadOverview = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const overview = await startService.getOverview()
        if (!active) return
        const mapped: MeArticle[] = overview.historyDocs.map((item, index) => {
          const totalSegments = item.totalSegments > 0 ? item.totalSegments : 1
          const currentSegmentOrder = Math.min(Math.max(item.currentSegmentOrder, 1), totalSegments)
          return {
            id: item.id,
            title: item.title,
            language: item.language,
            level: Math.max(1, item.level),
            currentSegmentOrder,
            totalSegments,
            lastPracticedAt: item.lastPracticedAt,
            progressRate: item.progressRate,
            isDone: item.isDone || (totalSegments > 0 && item.passedSegments >= totalSegments) || item.progressRate >= 1,
            practiceCount: item.practiceCount,
            isActive: index === 0,
          }
        })
        setArticles(mapped)
      } catch (error: unknown) {
        if (!active) return
        setLoadError(getApiErrorMessage(error, t('common.error')))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadOverview()
    return () => {
      active = false
    }
  }, [t])

  const filteredArticles = useMemo(() => {
    if (filter === 'en') return articles.filter((item) => item.language === 'en')
    if (filter === 'zh') return articles.filter((item) => item.language === 'zh')
    if (filter === 'done') return articles.filter((item) => item.isDone)
    return articles
  }, [articles, filter])

  const totalPractices = useMemo(
    () => articles.reduce((sum, item) => sum + item.practiceCount, 0),
    [articles]
  )

  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || t('pages.start.userName')
  const avatarText = displayName.trim().charAt(0).toUpperCase() || 'U'
  const currentLang = i18n.resolvedLanguage?.startsWith('zh') ? 'zh' : 'en'
  const nextLang = currentLang === 'zh' ? 'en' : 'zh'

  const closePasswordModal = () => {
    if (passwordSubmitting) return
    setPasswordModalOpen(false)
    setCurrentPwd('')
    setNewPwd('')
    setConfirmPwd('')
    setFieldErrors({})
    setPasswordFeedback(null)
  }

  const submitPasswordChange = async () => {
    if (passwordSubmitting) return
    setFieldErrors({})
    setPasswordFeedback(null)

    try {
      const validated = changePasswordSchema.parse({
        currentPassword: currentPwd,
        newPassword: newPwd,
        confirmPassword: confirmPwd,
      })
      setPasswordSubmitting(true)
      const result = await authService.changePassword({
        currentPassword: validated.currentPassword,
        newPassword: validated.newPassword,
      })
      setPasswordFeedback({ type: 'success', message: result.message })
      window.setTimeout(() => {
        closePasswordModal()
      }, 800)
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string> = {}
        error.issues.forEach((issue) => {
          if (issue.path[0]) {
            errors[issue.path[0] as string] = issue.message
          }
        })
        setFieldErrors(errors)
      } else {
        setPasswordFeedback({
          type: 'error',
          message: getApiErrorMessage(error, t('common.error')),
        })
      }
    } finally {
      setPasswordSubmitting(false)
    }
  }

  const filters = [
    { id: 'all' as const, label: t('pages.me.filters.all') },
    { id: 'en' as const, label: t('pages.me.filters.en') },
    { id: 'zh' as const, label: t('pages.me.filters.zh') },
    { id: 'done' as const, label: t('pages.me.filters.done') },
  ]

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', px: '20px', pt: '16px', pb: '12px' }}>
        <Box component="button" type="button" sx={iconButtonSx} onClick={() => navigate(-1)}>
          <ArrowBackRounded sx={{ fontSize: 16 }} />
        </Box>
        <Typography sx={{ flex: 1, fontSize: '17px', fontWeight: 600 }}>
          {t('pages.me.topbar.title')}
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<NorthRounded sx={{ fontSize: '13px !important' }} />}
          onClick={() => navigate('/editor')}
          sx={{ px: '14px', py: '7px' }}
        >
          {t('pages.me.topbar.create')}
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px', px: '20px', pt: '20px', pb: '16px', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6e60ee, #8b7fff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {avatarText}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 600 }}>
              {displayName}
            </Typography>
            <Typography sx={{ mt: '2px', fontSize: '12px', color: 'text.secondary' }}>
              {t('pages.me.account.stats', { articles: articles.length, practices: totalPractices })}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <Box
              component="button"
              type="button"
              onClick={() => setPasswordModalOpen(true)}
              sx={{
                fontSize: '13px',
                color: 'text.disabled',
                border: 'none',
                bgcolor: 'transparent',
                cursor: 'pointer',
                transition: 'color 0.15s',
                '&:hover': { color: 'text.secondary' },
              }}
            >
              {t('pages.me.account.changePassword')}
            </Box>
            <Box
              component="button"
              type="button"
              onClick={() => i18n.changeLanguage(nextLang)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                p: '2px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.07)',
                bgcolor: '#1a1a2c',
                gap: '2px',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.13)',
                },
              }}
            >
              <Box
                component="span"
                sx={{
                  px: '8px',
                  py: '2px',
                  borderRadius: '999px',
                  bgcolor: currentLang === 'zh' ? 'rgba(110,96,238,0.2)' : 'transparent',
                  color: currentLang === 'zh' ? 'primary.light' : 'text.disabled',
                  fontSize: '11px',
                  lineHeight: 1.2,
                }}
              >
                ZH
              </Box>
              <Box
                component="span"
                sx={{
                  px: '8px',
                  py: '2px',
                  borderRadius: '999px',
                  bgcolor: currentLang === 'en' ? 'rgba(110,96,238,0.2)' : 'transparent',
                  color: currentLang === 'en' ? 'primary.light' : 'text.disabled',
                  fontSize: '11px',
                  lineHeight: 1.2,
                }}
              >
                EN
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: '8px', px: '20px', py: '14px', overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
          {filters.map((item) => {
            const active = item.id === filter
            return (
              <Box
                key={item.id}
                component="button"
                type="button"
                onClick={() => setFilter(item.id)}
                sx={{
                  px: '14px',
                  py: '6px',
                  borderRadius: '999px',
                  border: '1px solid',
                  borderColor: active ? 'rgba(110,96,238,0.4)' : 'rgba(255,255,255,0.07)',
                  bgcolor: active ? 'rgba(110,96,238,0.25)' : '#1a1a2c',
                  color: active ? 'primary.light' : 'text.secondary',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': active
                    ? undefined
                    : {
                        borderColor: 'rgba(255,255,255,0.13)',
                        color: 'text.primary',
                      },
                }}
              >
                {item.label}
              </Box>
            )
          })}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', px: '20px', pt: '4px', pb: '32px', gap: '10px' }}>
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', p: '12px 14px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '12px' }}>
              <CircularProgress size={16} thickness={5} />
              <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>{t('common.loading')}</Typography>
            </Box>
          )}

          {loadError && (
            <Box sx={{ p: '10px 12px', bgcolor: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.25)', borderRadius: '12px' }}>
              <Typography sx={{ fontSize: '12px', color: 'error.main' }}>{loadError}</Typography>
            </Box>
          )}

          {!loading && !loadError && filteredArticles.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', py: '60px', px: '32px', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '15px', color: 'text.secondary' }}>
                {t('pages.me.emptyState')}
              </Typography>
            </Box>
          ) : (
            filteredArticles.map((article) => (
              <Box
                key={article.id}
                component="button"
                type="button"
                onClick={() => navigate(`/practice?a=${article.id}&seg=${article.currentSegmentOrder}&lv=L${article.level}`)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  p: '16px',
                  textAlign: 'left',
                  bgcolor: article.isActive ? 'rgba(110,96,238,0.04)' : '#1a1a2c',
                  border: '1px solid',
                  borderColor: article.isActive ? 'rgba(110,96,238,0.4)' : 'rgba(255,255,255,0.07)',
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
                      {toLanguageLabel(article.language, t('common.languageEnglish'), t('common.languageChinese'))}
                    </Typography>
                  </Box>
                  <Box sx={{ px: '9px', py: '3px', borderRadius: '999px', border: '1px solid rgba(110,96,238,0.25)', bgcolor: 'rgba(110,96,238,0.25)', color: 'primary.light', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0 }}>
                    {article.isDone ? t('pages.me.article.completed') : `L${article.level}`}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Box sx={{ flex: 1, height: 3, borderRadius: '3px', bgcolor: '#22223a', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${article.progressRate * 100}%`, borderRadius: '3px', background: 'linear-gradient(90deg, #6e60ee, #8b7fff)' }} />
                  </Box>
                  <Typography sx={{ fontSize: '11px', color: 'text.disabled', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {article.isDone ? t('pages.me.article.allPassed') : `搂${article.currentSegmentOrder}/${article.totalSegments}`}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>
                    {t('pages.me.article.lastPractice', {
                      time: formatLastPracticedAt(article.lastPracticedAt),
                    })}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>路</Typography>
                  <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>
                    {t('pages.me.article.practiceCount', { count: article.practiceCount })}
                  </Typography>
                  {article.isDone && (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', px: '8px', py: '2px', borderRadius: '999px', bgcolor: 'rgba(29,201,138,0.1)', color: 'success.main', fontSize: '11px', fontWeight: 600 }}>
                      {t('pages.me.article.doneBadge')}
                    </Box>
                  )}
                  {article.isActive && (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'primary.light' }}>
                      {t('pages.me.article.currentBadge')}
                    </Box>
                  )}
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>

      <Box
        onClick={(event) => {
          if (event.target === event.currentTarget) closePasswordModal()
        }}
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          bgcolor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          opacity: passwordModalOpen ? 1 : 0,
          pointerEvents: passwordModalOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: '430px',
            p: '20px 20px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            bgcolor: 'background.paper',
            borderRadius: '14px 14px 0 0',
            border: '1px solid rgba(255,255,255,0.13)',
            borderBottom: 'none',
            transform: passwordModalOpen ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 600 }}>
              {t('pages.me.passwordModal.title')}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Box
              component="button"
              type="button"
              onClick={closePasswordModal}
              sx={{
                ...iconButtonSx,
                border: '1px solid transparent',
                bgcolor: 'transparent',
              }}
            >
              <CloseRounded sx={{ fontSize: 14 }} />
            </Box>
          </Box>

          {passwordFeedback && (
            <Alert type={passwordFeedback.type} message={passwordFeedback.message} />
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Box>
              <TextField
                value={currentPwd}
                onChange={(event) => {
                  setCurrentPwd(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, currentPassword: '' }))
                }}
                type="password"
                size="small"
                fullWidth
                placeholder={t('pages.me.passwordModal.currentPlaceholder')}
                error={!!fieldErrors.currentPassword}
                sx={{
                  '.MuiOutlinedInput-root': {
                    bgcolor: '#22223a',
                    borderColor: fieldErrors.currentPassword ? '#f05252' : undefined,
                  },
                }}
              />
              {fieldErrors.currentPassword && <FieldError message={fieldErrors.currentPassword} />}
            </Box>
            <Box>
              <TextField
                value={newPwd}
                onChange={(event) => {
                  setNewPwd(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, newPassword: '' }))
                }}
                type="password"
                size="small"
                fullWidth
                placeholder={t('pages.me.passwordModal.newPlaceholder')}
                error={!!fieldErrors.newPassword}
                sx={{
                  '.MuiOutlinedInput-root': {
                    bgcolor: '#22223a',
                    borderColor: fieldErrors.newPassword ? '#f05252' : undefined,
                  },
                }}
              />
              {fieldErrors.newPassword && <FieldError message={fieldErrors.newPassword} />}
            </Box>
            <Box>
              <TextField
                value={confirmPwd}
                onChange={(event) => {
                  setConfirmPwd(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }))
                }}
                type="password"
                size="small"
                fullWidth
                placeholder={t('pages.me.passwordModal.confirmPlaceholder')}
                error={!!fieldErrors.confirmPassword}
                sx={{
                  '.MuiOutlinedInput-root': {
                    bgcolor: '#22223a',
                    borderColor: fieldErrors.confirmPassword ? '#f05252' : undefined,
                  },
                }}
              />
              {fieldErrors.confirmPassword && <FieldError message={fieldErrors.confirmPassword} />}
            </Box>
          </Box>

          <Button variant="contained" fullWidth disabled={passwordSubmitting} onClick={() => { void submitPasswordChange() }}>
            {passwordSubmitting ? t('common.loading') : t('pages.me.passwordModal.submit')}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
