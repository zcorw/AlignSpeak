import type {
  ArticleTtsAsset,
  ArticleTtsJob,
  ArticleTtsService,
  CurrentArticleTts,
} from '../../services/articleTtsService'
import {
  ArticleTtsPlayerController,
  type ArticleTtsAudio,
  type ArticleTtsPlayerControllerOptions,
  type ArticleTtsPlayerPhase,
} from './playerController'
import type { PlaybackCoordinator } from './playbackCoordinator'

class FakeAudio implements ArticleTtsAudio {
  src = ''
  preload = ''
  currentTime = 0
  duration = Number.NaN
  paused = true
  loop = false
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

class FakeCoordinator implements PlaybackCoordinator {
  claim = vi.fn()
  dispose = vi.fn()
  private listener: (() => void) | null = null
  subscribe = vi.fn((listener: () => void) => {
    this.listener = listener
    return () => {
      this.listener = null
    }
  })
  interruptOtherTab() {
    this.listener?.()
  }
}

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  readonly values = new Map<string, string>()
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
}

const setupController = (
  service: ArticleTtsService,
  options: Partial<ArticleTtsPlayerControllerOptions> = {}
) => {
  const audio = new FakeAudio()
  const coordinator = new FakeCoordinator()
  const createObjectURL = vi.fn((blob: Blob) => `blob:test-${blob.size}-${createObjectURL.mock.calls.length}`)
  const revokeObjectURL = vi.fn()
  const audioFactory = vi.fn(() => audio)
  const controller = new ArticleTtsPlayerController({
    service,
    audioFactory,
    objectUrl: { createObjectURL, revokeObjectURL },
    wait: async () => undefined,
    pollIntervalMs: 1,
    mediaSession: null,
    storage: null,
    coordinatorFactory: () => coordinator,
    ...options,
  })
  return { controller, audio, audioFactory, coordinator, createObjectURL, revokeObjectURL }
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

  it('loops by default and stops cleanly after the selected current round', async () => {
    const service = createService()
    vi.mocked(service.getCurrent).mockResolvedValue(current({ asset: asset('a') }))
    vi.mocked(service.downloadAudio).mockResolvedValue(new Blob(['audio']))
    const { controller, audio } = setupController(service)
    await controller.prepare({ articleId: 'article-a', articleTitle: 'Article A' })

    expect(audio.loop).toBe(true)
    await controller.play()
    controller.setStopMode('end-current')
    expect(audio.loop).toBe(false)

    audio.paused = true
    audio.onended?.call(audio as unknown as GlobalEventHandlers, new Event('ended'))

    expect(controller.getState()).toMatchObject({
      phase: 'ready',
      stopMode: 'infinite',
      lastStopReason: 'end-current',
      currentTimeSeconds: 0,
    })
    expect(audio.loop).toBe(true)
  })

  it('uses wall-clock sleep time even while playback is paused', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T00:00:00Z'))
    try {
      const service = createService()
      vi.mocked(service.getCurrent).mockResolvedValue(current({ asset: asset('a') }))
      vi.mocked(service.downloadAudio).mockResolvedValue(new Blob(['audio']))
      const { controller, audio } = setupController(service, { now: Date.now })
      await controller.prepare({ articleId: 'article-a', articleTitle: 'Article A' })
      await controller.play()
      audio.currentTime = 4
      audio.ontimeupdate?.call(audio as unknown as GlobalEventHandlers, new Event('timeupdate'))
      controller.pause()

      controller.setStopMode(15)
      expect(controller.getState()).toMatchObject({ stopMode: 'sleep', sleepMinutes: 15 })
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000)

      expect(controller.getState()).toMatchObject({
        phase: 'ready',
        currentTimeSeconds: 0,
        stopMode: 'infinite',
        lastStopReason: 'sleep',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('persists an exact position for 24 hours and restores without autoplay', async () => {
    const storage = new MemoryStorage()
    const now = Date.parse('2026-08-20T00:00:00Z')
    const firstService = createService()
    vi.mocked(firstService.getCurrent).mockResolvedValue(current({ asset: asset('a') }))
    vi.mocked(firstService.downloadAudio).mockResolvedValue(new Blob(['audio']))
    const first = setupController(firstService, { storage, now: () => now })
    first.controller.setStorageOwner('user-a')
    await first.controller.prepare({ articleId: 'article-a', articleTitle: 'Article A' })
    first.audio.currentTime = 4.25
    first.audio.ontimeupdate?.call(first.audio as unknown as GlobalEventHandlers, new Event('timeupdate'))
    first.controller.dispose()

    const secondService = createService()
    vi.mocked(secondService.getCurrent).mockResolvedValue(current({ asset: asset('a') }))
    vi.mocked(secondService.downloadAudio).mockResolvedValue(new Blob(['audio']))
    const second = setupController(secondService, {
      storage,
      now: () => now + 60_000,
    })
    second.controller.setStorageOwner('user-a')
    expect(second.controller.getState().resumeCandidate?.positionSeconds).toBe(4.25)

    await second.controller.resume()

    expect(second.controller.getState()).toMatchObject({
      phase: 'ready',
      currentTimeSeconds: 4.25,
      resumeCandidate: null,
    })
    expect(second.audio.currentTime).toBe(4.25)
    expect(second.audio.play).not.toHaveBeenCalled()
  })

  it('expires old resume records and never applies seconds to a different asset version', async () => {
    const now = Date.parse('2026-08-20T00:00:00Z')
    const expiredStorage = new MemoryStorage()
    expiredStorage.setItem(
      'alignspeak:article-tts-resume:v1:user-a',
      JSON.stringify({
        version: 1,
        articleId: 'article-a',
        articleTitle: 'Article A',
        assetId: 'asset-a',
        inputHash: 'hash-a',
        positionSeconds: 4,
        durationSeconds: 10,
        updatedAtMs: now - 24 * 60 * 60 * 1000 - 1,
      })
    )
    const emptyService = createService()
    const expired = setupController(emptyService, { storage: expiredStorage, now: () => now })
    expired.controller.setStorageOwner('user-a')
    expect(expired.controller.getState().resumeCandidate).toBeNull()
    expect(expiredStorage.values.size).toBe(0)

    const storage = new MemoryStorage()
    storage.setItem(
      'alignspeak:article-tts-resume:v1:user-a',
      JSON.stringify({
        version: 1,
        articleId: 'article-a',
        articleTitle: 'Article A',
        assetId: 'asset-old',
        inputHash: 'hash-old',
        positionSeconds: 7,
        durationSeconds: 10,
        updatedAtMs: now,
      })
    )
    const nextAsset = { ...asset('new'), articleId: 'article-a' }
    const service = createService()
    vi.mocked(service.getCurrent).mockResolvedValue(
      current({ inputHash: nextAsset.inputHash, asset: nextAsset })
    )
    vi.mocked(service.downloadAudio).mockResolvedValue(new Blob(['audio']))
    const next = setupController(service, { storage, now: () => now + 1000 })
    next.controller.setStorageOwner('user-a')

    await next.controller.resume()

    expect(next.audio.currentTime).toBe(0)
    expect(next.controller.getState().currentTimeSeconds).toBe(0)
  })

  it('pauses for another tab or recording and requires manual continuation', async () => {
    const service = createService()
    vi.mocked(service.getCurrent).mockResolvedValue(current({ asset: asset('a') }))
    vi.mocked(service.downloadAudio).mockResolvedValue(new Blob(['audio']))
    const { controller, coordinator } = setupController(service)
    await controller.prepare({ articleId: 'article-a', articleTitle: 'Article A' })
    await controller.play()
    expect(coordinator.claim).toHaveBeenCalledTimes(1)

    coordinator.interruptOtherTab()
    expect(controller.getState()).toMatchObject({
      phase: 'paused',
      interruptionReason: 'another-tab',
    })

    await controller.play()
    controller.interrupt('recording')
    expect(controller.getState()).toMatchObject({
      phase: 'paused',
      interruptionReason: 'recording',
    })
    expect(controller.getState().phase).not.toBe('playing')
  })

  it('publishes Media Session controls, metadata, and exact seek state when supported', async () => {
    const handlers = new Map<MediaSessionAction, MediaSessionActionHandler | null>()
    const mediaSession = {
      metadata: null as MediaMetadata | null,
      playbackState: 'none' as MediaSessionPlaybackState,
      setActionHandler: vi.fn((action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
        handlers.set(action, handler)
      }),
      setPositionState: vi.fn(),
    }
    const service = createService()
    vi.mocked(service.getCurrent).mockResolvedValue(current({ asset: asset('a') }))
    vi.mocked(service.downloadAudio).mockResolvedValue(new Blob(['audio']))
    const { controller, audio } = setupController(service, {
      mediaSession,
      mediaMetadataFactory: (init) => init as unknown as MediaMetadata,
    })

    await controller.prepare({ articleId: 'article-a', articleTitle: 'Article A' })
    expect(mediaSession.metadata).toMatchObject({ title: 'Article A', artist: 'AlignSpeak' })

    handlers.get('play')?.({ action: 'play' })
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalledTimes(1))
    handlers.get('seekto')?.({ action: 'seekto', seekTime: 3.5, fastSeek: false })
    expect(controller.getState().currentTimeSeconds).toBe(3.5)
    expect(mediaSession.setPositionState).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 10, position: 3.5, playbackRate: 1 })
    )
    handlers.get('pause')?.({ action: 'pause' })
    expect(controller.getState().phase).toBe('paused')
  })
})
