import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirm, useNotifier } from '../../components/common/feedbackHooks'
import { articleTtsService, type CurrentArticleTts } from '../../services/articleTtsService'
import { getApiErrorMessage } from '../../services/authService'
import { useArticleTtsPlayer } from './articleTtsPlayerContext'
import type { ArticleTtsPlayerState, PrepareArticleTtsRequest } from './playerController'

export const LARGE_ARTICLE_AUDIO_BYTES = 20 * 1024 * 1024

type PreparationResult = 'started' | 'already-active' | 'switch-cancelled' | 'size-cancelled'

interface RequestPreparationOptions {
  state: ArticleTtsPlayerState
  request: PrepareArticleTtsRequest
  getCurrent: (articleId: string) => Promise<CurrentArticleTts>
  confirmSwitch: () => Promise<boolean>
  confirmLargeDownload: (bytes: number) => Promise<boolean>
  showEstimatedSize?: (bytes: number, isEstimate: boolean) => void
  prepare: (request: PrepareArticleTtsRequest) => Promise<void>
}

export const requestArticleTtsPreparation = async ({
  state,
  request,
  getCurrent,
  confirmSwitch,
  confirmLargeDownload,
  showEstimatedSize,
  prepare,
}: RequestPreparationOptions): Promise<PreparationResult> => {
  if (state.phase !== 'idle' && state.articleId === request.articleId) {
    return 'already-active'
  }
  if (state.phase !== 'idle' && state.articleId && state.articleId !== request.articleId) {
    const accepted = await confirmSwitch()
    if (!accepted) return 'switch-cancelled'
  }
  const current = await getCurrent(request.articleId)
  showEstimatedSize?.(current.estimate.bytes, current.estimate.isEstimate)
  if (current.estimate.bytes > LARGE_ARTICLE_AUDIO_BYTES) {
    const accepted = await confirmLargeDownload(current.estimate.bytes)
    if (!accepted) return 'size-cancelled'
  }
  await prepare(request)
  return 'started'
}

const formatMegabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

export const usePrepareArticleTts = () => {
  const { t } = useTranslation()
  const { confirm } = useConfirm()
  const { error: notifyError, info: notifyInfo } = useNotifier()
  const { state, prepare } = useArticleTtsPlayer()
  const [startingArticleId, setStartingArticleId] = useState<string | null>(null)

  const start = useCallback(
    async (request: PrepareArticleTtsRequest) => {
      setStartingArticleId(request.articleId)
      try {
        await requestArticleTtsPreparation({
          state,
          request,
          getCurrent: (articleId) => articleTtsService.getCurrent(articleId),
          confirmSwitch: () =>
            confirm({
              title: t('articleTts.confirmSwitchTitle'),
              message: t('articleTts.confirmSwitchMessage'),
              confirmLabel: t('articleTts.switchAction'),
              cancelLabel: t('common.cancel'),
            }),
          confirmLargeDownload: (bytes) =>
            confirm({
              title: t('articleTts.largeDownloadTitle'),
              message: t('articleTts.largeDownloadMessage', {
                size: formatMegabytes(bytes),
              }),
              confirmLabel: t('articleTts.prepareAction'),
              cancelLabel: t('common.cancel'),
            }),
          showEstimatedSize: (bytes, isEstimate) =>
            notifyInfo(
              t('articleTts.estimatedSize', {
                size: formatMegabytes(bytes),
                qualifier: isEstimate ? t('articleTts.estimatedQualifier') : '',
              })
            ),
          prepare,
        })
      } catch (error: unknown) {
        notifyError(getApiErrorMessage(error, t('articleTts.preflightFailed')))
      } finally {
        setStartingArticleId((current) => (current === request.articleId ? null : current))
      }
    },
    [confirm, notifyError, notifyInfo, prepare, state, t]
  )

  return {
    start,
    startingArticleId,
    activeArticleId: state.phase === 'idle' ? null : state.articleId,
  }
}
