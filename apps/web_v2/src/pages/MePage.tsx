import { ArrowBackRounded, CloseRounded, NorthRounded } from '@mui/icons-material'
import { Box, Button, TextField, Typography } from '@mui/material'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { changePasswordSchema } from '../utils/validation'
import { FieldError } from '../components/Alert'
import { ZodError } from 'zod'

type FilterType = 'all' | 'en' | 'zh' | 'done'

type Article = {
  id: string
  title: string
  lang: 'en' | 'zh'
  langFlag: string
  icon: string
  level: number
  segment: number
  totalSegments: number
  lastPracticedKey: 'today' | 'twoDaysAgo' | 'thirteenDaysAgo'
  progress: number
  isActive: boolean
  isDone: boolean
  practiceCount: number
}

const ARTICLES: Article[] = [
  {
    id: 'a1',
    title: 'The Little Prince — Chapter I',
    lang: 'en',
    langFlag: '🇺🇸',
    icon: '📖',
    level: 2,
    segment: 3,
    totalSegments: 5,
    lastPracticedKey: 'today',
    progress: 0.4,
    isActive: true,
    isDone: false,
    practiceCount: 18,
  },
  {
    id: 'a2',
    title: 'Pride and Prejudice — Opening',
    lang: 'en',
    langFlag: '🇺🇸',
    icon: '📗',
    level: 1,
    segment: 2,
    totalSegments: 4,
    lastPracticedKey: 'twoDaysAgo',
    progress: 0.5,
    isActive: false,
    isDone: false,
    practiceCount: 14,
  },
  {
    id: 'a3',
    title: '《围城》第一章节选',
    lang: 'zh',
    langFlag: '🇨🇳',
    icon: '📕',
    level: 4,
    segment: 8,
    totalSegments: 8,
    lastPracticedKey: 'thirteenDaysAgo',
    progress: 1,
    isActive: false,
    isDone: true,
    practiceCount: 32,
  },
]

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

export const MePage = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [filter, setFilter] = useState<FilterType>('all')
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const filteredArticles = useMemo(() => {
    if (filter === 'en') return ARTICLES.filter((item) => item.lang === 'en')
    if (filter === 'zh') return ARTICLES.filter((item) => item.lang === 'zh')
    if (filter === 'done') return ARTICLES.filter((item) => item.isDone)
    return ARTICLES
  }, [filter])

  const totalPractices = ARTICLES.reduce((sum, item) => sum + item.practiceCount, 0)
  const currentLang = i18n.resolvedLanguage?.startsWith('zh') ? 'zh' : 'en'
  const nextLang = currentLang === 'zh' ? 'en' : 'zh'

  const closePasswordModal = () => {
    setPasswordModalOpen(false)
    setCurrentPwd('')
    setNewPwd('')
    setConfirmPwd('')
    setFieldErrors({})
  }

  const submitPasswordChange = () => {
    setFieldErrors({})

    try {
      // Validate form data
      changePasswordSchema.parse({
        currentPassword: currentPwd,
        newPassword: newPwd,
        confirmPassword: confirmPwd,
      })

      // TODO: Call change password API
      console.log('Password change validated')
      closePasswordModal()
    } catch (err) {
      if (err instanceof ZodError) {
        // Handle validation errors
        const errors: Record<string, string> = {}
        err.issues.forEach((issue) => {
          if (issue.path[0]) {
            errors[issue.path[0] as string] = issue.message
          }
        })
        setFieldErrors(errors)
      }
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
            {t('pages.me.account.avatar')}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 600 }}>
              {t('pages.me.account.name')}
            </Typography>
            <Typography sx={{ mt: '2px', fontSize: '12px', color: 'text.secondary' }}>
              {t('pages.me.account.stats', { articles: ARTICLES.length, practices: totalPractices })}
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
                中
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
          {filteredArticles.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', py: '60px', px: '32px', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '40px' }}>📭</Typography>
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
                onClick={() => navigate(`/practice?a=${article.id}`)}
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
                    {article.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.3, color: 'text.primary' }}>
                      {article.title}
                    </Typography>
                    <Typography sx={{ mt: '3px', fontSize: '12px', color: 'text.secondary' }}>
                      {article.langFlag}{' '}
                      {article.lang === 'en' ? t('common.languageEnglish') : t('common.languageChinese')}
                    </Typography>
                  </Box>
                  <Box sx={{ px: '9px', py: '3px', borderRadius: '999px', border: '1px solid rgba(110,96,238,0.25)', bgcolor: 'rgba(110,96,238,0.25)', color: 'primary.light', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0 }}>
                    {article.isDone ? t('pages.me.article.completed') : `L${article.level}`}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Box sx={{ flex: 1, height: 3, borderRadius: '3px', bgcolor: '#22223a', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${article.progress * 100}%`, borderRadius: '3px', background: 'linear-gradient(90deg, #6e60ee, #8b7fff)' }} />
                  </Box>
                  <Typography sx={{ fontSize: '11px', color: 'text.disabled', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {article.isDone ? t('pages.me.article.allPassed') : `§${article.segment}/${article.totalSegments}`}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>
                    {t('pages.me.article.lastPractice', {
                      time: t(`pages.me.article.lastPracticeValues.${article.lastPracticedKey}`),
                    })}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>·</Typography>
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

          <Button variant="contained" fullWidth onClick={submitPasswordChange}>
            {t('pages.me.passwordModal.submit')}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
