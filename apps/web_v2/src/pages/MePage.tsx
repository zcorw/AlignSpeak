import { Box } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ChangePasswordSheet } from '../components/me/ChangePasswordSheet'
import { MeArticleList } from '../components/me/MeArticleList'
import { MeFilterTabs } from '../components/me/MeFilterTabs'
import { MeInviteEntry } from '../components/me/MeInviteEntry'
import { MeProfileHeader } from '../components/me/MeProfileHeader'
import { MeTopBar } from '../components/me/MeTopBar'
import { useConfirm, useNotifier } from '../components/common/FeedbackProvider'
import type { MeFilterType } from '../components/me/types'
import { useChangePassword } from '../hooks/me/useChangePassword'
import { articleService } from '../services/articleService'
import { authService, getApiErrorMessage } from '../services/authService'
import { useMeOverview } from '../hooks/me/useMeOverview'
import { useAuthStore } from '../stores/authStore'

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

export const MePage = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const { confirm } = useConfirm()
  const { success: showSuccess, error: showError } = useNotifier()
  const [filter, setFilter] = useState<MeFilterType>('all')
  const {
    loading,
    loadError,
    articles,
    filteredArticles,
    totalPractices,
    activeArticleId,
    setActiveArticleId,
    refresh,
  } = useMeOverview(filter)
  const password = useChangePassword()
  const [inviteGenerating, setInviteGenerating] = useState(false)
  const [latestInvitationCode, setLatestInvitationCode] = useState<string | null>(null)
  const [inviteFeedback, setInviteFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const filters = [
    { id: 'all' as const, label: t('pages.me.filters.all') },
    { id: 'en' as const, label: t('pages.me.filters.en') },
    { id: 'zh' as const, label: t('pages.me.filters.zh') },
    { id: 'done' as const, label: t('pages.me.filters.done') },
  ]
  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || t('pages.start.userName')
  const avatarText = displayName.trim().charAt(0).toUpperCase() || 'U'
  const currentLang = i18n.resolvedLanguage?.startsWith('zh') ? 'zh' : 'en'
  const nextLang = currentLang === 'zh' ? 'en' : 'zh'
  const isAdmin = user?.role === 'admin'

  const handleGenerateInvitationCode = async () => {
    if (inviteGenerating) return
    setInviteFeedback(null)

    try {
      setInviteGenerating(true)
      const result = await authService.createInvitationCode()
      setLatestInvitationCode(result.code)
      setInviteFeedback({
        type: 'success',
        message: t('pages.me.invitation.generatedSuccess', { code: result.code }),
      })
    } catch (error) {
      setInviteFeedback({
        type: 'error',
        message: getApiErrorMessage(error, t('common.error')),
      })
    } finally {
      setInviteGenerating(false)
    }
  }

  const handleCopyInvitationCode = async () => {
    if (!latestInvitationCode) return

    try {
      await navigator.clipboard.writeText(latestInvitationCode)
      setInviteFeedback({
        type: 'info',
        message: t('pages.me.invitation.copied'),
      })
    } catch {
      setInviteFeedback({
        type: 'error',
        message: t('pages.me.invitation.copyFailed'),
      })
    }
  }

  const handleLogout = () => {
    clearAuth()
    navigate('/login', { replace: true })
  }

  const handleEditArticle = (articleId: string) => {
    navigate(`/editor?article=${encodeURIComponent(articleId)}`)
  }

  const handleDeleteArticle = (articleId: string) => {
    void (async () => {
      const accepted = await confirm({
        title: t('common.delete'),
        message: t('pages.me.article.deleteConfirm'),
        confirmLabel: t('common.delete'),
        cancelLabel: t('common.cancel'),
        danger: true,
      })
      if (!accepted) return

      try {
        await articleService.deleteArticle(articleId)
        if (activeArticleId === articleId) {
          sessionStorage.removeItem('article_id')
        }
        showSuccess(t('pages.me.article.deleteSuccess'))
        refresh()
      } catch (error: unknown) {
        showError(getApiErrorMessage(error, t('common.error')))
      }
    })()
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <MeTopBar
        title={t('pages.me.topbar.title')}
        createLabel={t('pages.me.topbar.create')}
        onBack={() => navigate(-1)}
        onCreate={() => navigate('/editor')}
      />

      <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <MeProfileHeader
          avatarText={avatarText}
          displayName={displayName}
          statsText={t('pages.me.account.stats', { articles: articles.length, practices: totalPractices })}
          currentLang={currentLang}
          onOpenPassword={() => password.setOpen(true)}
          onSwitchLanguage={() => i18n.changeLanguage(nextLang)}
          onLogout={handleLogout}
          changePasswordLabel={t('pages.me.account.changePassword')}
          logoutLabel={t('pages.me.account.logout')}
        />

        {isAdmin && (
          <MeInviteEntry
            title={t('pages.me.invitation.title')}
            description={t('pages.me.invitation.description')}
            generateLabel={t('pages.me.invitation.generate')}
            generatingLabel={t('pages.me.invitation.generating')}
            copyLabel={t('pages.me.invitation.copy')}
            generatedCodeLabel={t('pages.me.invitation.generatedCode')}
            usageHint={t('pages.me.invitation.usageHint')}
            isGenerating={inviteGenerating}
            latestCode={latestInvitationCode}
            feedback={inviteFeedback}
            onGenerate={() => { void handleGenerateInvitationCode() }}
            onCopy={() => { void handleCopyInvitationCode() }}
          />
        )}

        <MeFilterTabs
          filter={filter}
          filters={filters}
          onChange={setFilter}
        />

        <MeArticleList
          loadingLabel={t('common.loading')}
          loading={loading}
          loadError={loadError}
          emptyLabel={t('pages.me.emptyState')}
          articles={filteredArticles}
          activeArticleId={activeArticleId}
          languageLabel={(article) => {
            if (article.language === 'zh') return t('common.languageChinese')
            if (article.language === 'ja') return 'Japanese'
            if (article.language === 'en') return t('common.languageEnglish')
            return '-'
          }}
          completedLabel={t('pages.me.article.completed')}
          allPassedLabel={t('pages.me.article.allPassed')}
          lastPracticeText={(article) => t('pages.me.article.lastPractice', {
            time: formatLastPracticedAt(article.lastPracticedAt),
          })}
          practiceCountText={(article) => t('pages.me.article.practiceCount', { count: article.practiceCount })}
          doneBadgeLabel={t('pages.me.article.doneBadge')}
          currentBadgeLabel={t('pages.me.article.currentBadge')}
          editLabel={t('common.edit')}
          deleteLabel={t('common.delete')}
          onOpenArticle={(article) => {
            setActiveArticleId(article.id)
            navigate(`/practice?a=${article.id}&seg=${article.currentSegmentOrder}&lv=L${article.level}`)
          }}
          onEditArticle={(article) => {
            handleEditArticle(article.id)
          }}
          onDeleteArticle={(article) => {
            handleDeleteArticle(article.id)
          }}
          toArticleBadge={toArticleBadge}
        />
      </Box>

      <ChangePasswordSheet
        open={password.open}
        submitting={password.submitting}
        currentPwd={password.currentPwd}
        newPwd={password.newPwd}
        confirmPwd={password.confirmPwd}
        fieldErrors={password.fieldErrors}
        feedback={password.feedback}
        labels={{
          title: t('pages.me.passwordModal.title'),
          currentPlaceholder: t('pages.me.passwordModal.currentPlaceholder'),
          newPlaceholder: t('pages.me.passwordModal.newPlaceholder'),
          confirmPlaceholder: t('pages.me.passwordModal.confirmPlaceholder'),
          submit: t('pages.me.passwordModal.submit'),
          loading: t('common.loading'),
        }}
        onClose={password.close}
        onCurrentPwdChange={(value) => {
          password.setCurrentPwd(value)
          password.setFieldErrors((prev) => ({ ...prev, currentPassword: '' }))
        }}
        onNewPwdChange={(value) => {
          password.setNewPwd(value)
          password.setFieldErrors((prev) => ({ ...prev, newPassword: '' }))
        }}
        onConfirmPwdChange={(value) => {
          password.setConfirmPwd(value)
          password.setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }))
        }}
        onSubmit={() => { void password.submit() }}
      />
    </Box>
  )
}
