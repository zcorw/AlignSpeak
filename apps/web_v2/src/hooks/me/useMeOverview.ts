import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MeArticle, MeFilterType } from '../../components/me/types'
import { resolveLegacyArticleIds } from '../../services/articleLegacyService'
import { getApiErrorMessage } from '../../services/authService'
import { startService } from '../../services/startService'

interface UseMeOverviewResult {
  loading: boolean
  loadError: string | null
  articles: MeArticle[]
  filteredArticles: MeArticle[]
  totalPractices: number
  activeArticleId: string | null
  setActiveArticleId: (articleId: string) => void
  refresh: () => void
}

export const useMeOverview = (filter: MeFilterType): UseMeOverviewResult => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [articles, setArticles] = useState<MeArticle[]>([])
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [currentArticleId, setCurrentArticleId] = useState<string | null>(() => {
    const articleId = sessionStorage.getItem('article_id')?.trim()
    return articleId || null
  })

  useEffect(() => {
    let active = true

    const loadOverview = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const overview = await startService.getOverview()
        if (!active) return
        const mappedBase = overview.historyDocs.map((item) => {
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
            isLegacy: false,
          }
        })
        const legacyIds = resolveLegacyArticleIds(mappedBase.map((item) => item.id))
        const mapped: MeArticle[] = mappedBase.map((item) => ({
          ...item,
          isLegacy: legacyIds.has(item.id),
        }))
        setArticles(mapped)
        if (mapped.length > 0) {
          setCurrentArticleId((prev) => {
            if (prev && mapped.some((item) => item.id === prev)) return prev
            const nextCurrentArticleId = mapped[0].id
            sessionStorage.setItem('article_id', nextCurrentArticleId)
            return nextCurrentArticleId
          })
        } else {
          setCurrentArticleId(null)
          sessionStorage.removeItem('article_id')
        }
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
  }, [refreshVersion, t])

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
  const activeArticleId =
    currentArticleId && articles.some((item) => item.id === currentArticleId)
      ? currentArticleId
      : articles[0]?.id || null

  const setActiveArticleId = (articleId: string) => {
    setCurrentArticleId(articleId)
    sessionStorage.setItem('article_id', articleId)
  }

  const refresh = () => {
    setRefreshVersion((prev) => prev + 1)
  }

  return {
    loading,
    loadError,
    articles,
    filteredArticles,
    totalPractices,
    activeArticleId,
    setActiveArticleId,
    refresh,
  }
}
