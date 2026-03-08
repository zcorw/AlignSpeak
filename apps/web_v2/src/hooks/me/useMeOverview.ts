import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MeArticle, MeFilterType } from '../../components/me/types'
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
}

export const useMeOverview = (filter: MeFilterType): UseMeOverviewResult => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [articles, setArticles] = useState<MeArticle[]>([])
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
        const mapped: MeArticle[] = overview.historyDocs.map((item) => {
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
          }
        })
        setArticles(mapped)
        if (mapped.length > 0) {
          setCurrentArticleId((prev) => {
            if (prev) return prev
            const nextCurrentArticleId = mapped[0].id
            sessionStorage.setItem('article_id', nextCurrentArticleId)
            return nextCurrentArticleId
          })
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
  const activeArticleId = currentArticleId || articles[0]?.id || null

  const setActiveArticleId = (articleId: string) => {
    setCurrentArticleId(articleId)
    sessionStorage.setItem('article_id', articleId)
  }

  return {
    loading,
    loadError,
    articles,
    filteredArticles,
    totalPractices,
    activeArticleId,
    setActiveArticleId,
  }
}

