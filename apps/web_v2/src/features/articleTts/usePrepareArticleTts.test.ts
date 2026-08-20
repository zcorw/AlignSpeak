import type { CurrentArticleTts } from '../../services/articleTtsService'
import type { ArticleTtsPlayerState, PrepareArticleTtsRequest } from './playerController'
import {
  LARGE_ARTICLE_AUDIO_BYTES,
  requestArticleTtsPreparation,
} from './usePrepareArticleTts'

const request: PrepareArticleTtsRequest = {
  articleId: 'article-b',
  articleTitle: 'Article B',
}

const state = (overrides: Partial<ArticleTtsPlayerState> = {}): ArticleTtsPlayerState => ({
  phase: 'idle',
  articleId: null,
  articleTitle: null,
  inputHash: null,
  jobId: null,
  completedSegments: 0,
  totalSegments: 0,
  estimatedBytes: null,
  estimateIsExact: false,
  downloadedBytes: 0,
  downloadTotalBytes: null,
  asset: null,
  currentTimeSeconds: 0,
  durationSeconds: 0,
  stopMode: 'infinite',
  sleepMinutes: null,
  sleepDeadlineMs: null,
  interruptionReason: null,
  lastStopReason: null,
  resumeCandidate: null,
  error: null,
  ...overrides,
})

const current = (bytes: number): CurrentArticleTts => ({
  articleId: 'article-b',
  inputHash: 'hash-b',
  isStale: false,
  estimate: { bytes, isEstimate: true },
  asset: null,
  job: null,
})

describe('requestArticleTtsPreparation', () => {
  it('keeps the current article when the switch confirmation is cancelled', async () => {
    const getCurrent = vi.fn(async () => current(1000))
    const prepare = vi.fn(async () => undefined)

    const result = await requestArticleTtsPreparation({
      state: state({ phase: 'playing', articleId: 'article-a' }),
      request,
      getCurrent,
      confirmSwitch: async () => false,
      confirmLargeDownload: async () => true,
      prepare,
    })

    expect(result).toBe('switch-cancelled')
    expect(getCurrent).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
  })

  it('requires a second confirmation only above 20 MB', async () => {
    const prepare = vi.fn(async () => undefined)
    const confirmLargeDownload = vi.fn(async () => false)

    const result = await requestArticleTtsPreparation({
      state: state(),
      request,
      getCurrent: async () => current(LARGE_ARTICLE_AUDIO_BYTES + 1),
      confirmSwitch: async () => true,
      confirmLargeDownload,
      prepare,
    })

    expect(result).toBe('size-cancelled')
    expect(confirmLargeDownload).toHaveBeenCalledWith(LARGE_ARTICLE_AUDIO_BYTES + 1)
    expect(prepare).not.toHaveBeenCalled()
  })

  it('starts preparation after all applicable checks pass', async () => {
    const prepare = vi.fn(async () => undefined)
    const confirmLargeDownload = vi.fn(async () => true)
    const showEstimatedSize = vi.fn()

    const result = await requestArticleTtsPreparation({
      state: state({ phase: 'paused', articleId: 'article-a' }),
      request,
      getCurrent: async () => current(LARGE_ARTICLE_AUDIO_BYTES),
      confirmSwitch: async () => true,
      confirmLargeDownload,
      showEstimatedSize,
      prepare,
    })

    expect(result).toBe('started')
    expect(confirmLargeDownload).not.toHaveBeenCalled()
    expect(showEstimatedSize).toHaveBeenCalledWith(LARGE_ARTICLE_AUDIO_BYTES, true)
    expect(prepare).toHaveBeenCalledWith(request)
  })
})
