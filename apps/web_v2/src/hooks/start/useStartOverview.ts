import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../services/authService'
import { practiceService, type PracticeArticleDetail } from '../../services/practiceService'
import { startService, type StartOverview } from '../../services/startService'

interface UseStartOverviewResult {
  loading: boolean
  loadError: string | null
  overview: StartOverview | null
  currentArticleDetail: PracticeArticleDetail | null
}

export const useStartOverview = (): UseStartOverviewResult => {
  const { t } = useTranslation()
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

  return {
    loading,
    loadError,
    overview,
    currentArticleDetail,
  }
}

