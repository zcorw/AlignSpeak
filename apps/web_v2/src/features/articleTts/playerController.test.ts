import type {
  ArticleTtsAsset,
  ArticleTtsJob,
  ArticleTtsService,
  CurrentArticleTts,
} from '../../services/articleTtsService'
import {
  ArticleTtsPlayerController,
  type ArticleTtsAudio,
  type ArticleTtsPlayerPhase,
} from './playerController'

class FakeAudio implements ArticleTtsAudio {
  src = ''
  preload = ''
  currentTime = 0
  duration = Number.NaN
  paused = true
  onplay: HTMLMediaElement['onplay'] = null
  onpause: HTMLMediaElement['onpause'] = null
  onended: HTMLMediaElement['onended'] = null
  ontimeupdate: HTMLMediaElement['ontimeupdate'] = null
  onerror: HTMLMediaElement['onerror'] = null
  play = vi.fn(async () => {
    this.paused = false
    this.onplay?.call(this as unknown as GlobalEventHandlers, new Event('play'))
  })
  pause = vi.fn(() => {
    const wasPaused = this.paused
    this.paused = true
    if (!wasPaused) {
      this.onpause?.call(this as unknown as GlobalEventHandlers, new Event('pause'))
    }
  })
  load = vi.fn()
  removeAttribute = vi.fn((name: string) => {
    if (name === 'src') this.src = ''
  })
}

const asset = (suffix: string): ArticleTtsAsset => ({
  assetId: `asset-${suffix}`,
  articleId: `article-${suffix}`,
  inputHash: `hash-${suffix}`,
  audioUrl: `/media/tts/articles/asset-${suffix}`,
  durationMs: 10_000,
  fileSize: 500,
  voice: 'en-US-AriaNeural',
  speed: 1,
  timelineVersion: 'article-v1',
  timeline: [],
  readyAt: '2026-08-20T00:00:00Z',
})

const job = (
  status: ArticleTtsJob['status'],
  options: Partial<ArticleTtsJob> = {}
): ArticleTtsJob => ({
  jobId: 'job-a',
  articleId: 'article-a',
  inputHash: 'hash-a',
  status,
  totalSegments: 2,
  completedSegments: status === 'done' ? 2 : 0,
  failedSegment: null,
  errorCode: null,
  errorMessage: null,
  asset: status === 'done' ? asset('a') : null,
  ...options,
})

const current = (options: Partial<CurrentArticleTts> = {}): CurrentArticleTts => ({
  articleId: 'article-a',
  inputHash: 'hash-a',
  isStale: false,
  estimate: { bytes: 500, isEstimate: true },
  asset: null,
  job: null,
  ...options,
})

const createService = (): ArticleTtsService => ({
  getCurrent: vi.fn(),
  createJob: vi.fn(),
  retryJob: vi.fn(),
  getJob: vi.fn(),
  downloadAudio: vi.fn(),
})

const setupController = (service: ArticleTtsService) => {
  const audio = new FakeAudio()
  const createObjectURL = vi.fn((blob: Blob) => `blob:test-${blob.size}-${createObjectURL.mock.calls.length}`)
  const revokeObjectURL = vi.fn()
  const audioFactory = vi.fn(() => audio)
  const controller = new ArticleTtsPlayerController({
    service,
    audioFactory,
    objectUrl: { createObjectURL, revokeObjectURL },
    wait: async () => undefined,
    pollIntervalMs: 1,
  })
  return { controller, audio, audioFactory, createObjectURL, revokeObjectURL }
}

describe('ArticleTtsPlayerController', () => {
  it('downloads the complete cached asset without autoplaying', async () => {
    const service = createService()
    const readyAsset = asset('a')
    vi.mocked(service.getCurrent).mockResolvedValue(current({ asset: readyAsset }))
    vi.mocked(service.downloadAudio).mockImplementation(async (_asset, onProgress) => {
      onProgress({ loadedBytes: 500, totalBytes: 500 })
      return new Blob(['audio'])
    })
    const { controller, audio, audioFactory } = setupController(service)
    const phases: ArticleTtsPlayerPhase[] = []
    controller.subscribe(() => phases.push(controller.getState().phase))

    await controller.prepare({ articleId: 'article-a', articleTitle: 'Article A' })

    expect(controller.getState()).toMatchObject({
      phase: 'ready',
      articleId: 'article-a',
      downloadedBytes: 5,
      downloadTotalBytes: 500,
      durationSeconds: 10,
    })
    expect(phases).toEqual(expect.arrayContaining(['checking', 'downloading', 'ready']))
    expect(audioFactory).toHaveBeenCalledTimes(1)
    expect(audio.play).not.toHaveBeenCalled()

    await controller.play()
    expect(audio.play).toHaveBeenCalledTimes(1)
    expect(controller.getState().phase).toBe('playing')
  })

  it('polls a persistent job until done and only then downloads', async () => {
    const service = createService()
    vi.mocked(service.getCurrent).mockResolvedValue(current())
    vi.mocked(service.createJob).mockResolvedValue(job('queued'))
    vi.mocked(service.getJob)
      .mockResolvedValueOnce(job('processing', { completedSegments: 1 }))
      .mockResolvedValueOnce(job('done'))
    vi.mocked(service.downloadAudio).mockResolvedValue(new Blob(['article-audio']))
    const { controller } = setupController(service)

    await controller.prepare({ articleId: 'article-a', articleTitle: 'Article A' })

    expect(service.createJob).toHaveBeenCalledWith('article-a', false, expect.any(AbortSignal))
    expect(service.getJob).toHaveBeenCalledTimes(2)
    expect(service.downloadAudio).toHaveBeenCalledTimes(1)
    expect(controller.getState()).toMatchObject({
      phase: 'ready',
      completedSegments: 2,
      totalSegments: 2,
    })
  })

  it('exposes the failed segment and retries the same job', async () => {
    const service = createService()
    const failed = job('failed', {
      completedSegments: 1,
      failedSegment: { segmentId: 'segment-2', segmentOrder: 2 },
      errorCode: 'segment_tts_failed',
      errorMessage: 'Segment 2 failed.',
    })
    vi.mocked(service.getCurrent).mockResolvedValue(current({ job: failed }))
    vi.mocked(service.retryJob).mockResolvedValue(job('done'))
    vi.mocked(service.downloadAudio).mockResolvedValue(new Blob(['recovered']))
    const { controller } = setupController(service)

    await controller.prepare({ articleId: 'article-a', articleTitle: 'Article A' })
    expect(controller.getState()).toMatchObject({
      phase: 'failed',
      error: {
        code: 'segment_tts_failed',
        failedSegment: { segmentId: 'segment-2', segmentOrder: 2 },
      },
    })

    await controller.retry()
    expect(service.retryJob).toHaveBeenCalledWith('job-a', expect.any(AbortSignal))
    expect(controller.getState().phase).toBe('ready')
  })

  it('reuses one audio element and revokes each replaced or disposed Blob URL', async () => {
    const service = createService()
    vi.mocked(service.getCurrent)
      .mockResolvedValueOnce(current({ asset: asset('a') }))
      .mockResolvedValueOnce(
        current({
          articleId: 'article-b',
          inputHash: 'hash-b',
          asset: asset('b'),
        })
      )
    vi.mocked(service.downloadAudio)
      .mockResolvedValueOnce(new Blob(['first']))
      .mockResolvedValueOnce(new Blob(['second']))
    const { controller, audioFactory, revokeObjectURL } = setupController(service)

    await controller.prepare({ articleId: 'article-a', articleTitle: 'Article A' })
    await controller.prepare({ articleId: 'article-b', articleTitle: 'Article B' })

    expect(audioFactory).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(controller.getState()).toMatchObject({ phase: 'ready', articleId: 'article-b' })

    controller.dispose()
    expect(revokeObjectURL).toHaveBeenCalledTimes(2)
  })
})
