import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ArticleTtsAsset, ArticleTtsJob, ArticleTtsService } from '../../services/articleTtsService'
import { useAuthStore } from '../../stores/authStore'
import '../../locales'
import { ArticleTtsMiniPlayer } from './ArticleTtsMiniPlayer'
import { ArticleTtsPlayerProvider } from './ArticleTtsPlayerProvider'
import { ArticleTtsPlayerController, type ArticleTtsAudio } from './playerController'

class FakeAudio implements ArticleTtsAudio {
  src = ''
  preload = ''
  currentTime = 0
  duration = 10
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
  articleId: 'article-a',
  inputHash: `hash-${suffix}`,
  audioUrl: `/media/tts/articles/asset-${suffix}`,
  durationMs: 10_000,
  fileSize: 100,
  voice: 'en-US-AriaNeural',
  speed: 1,
  timelineVersion: 'article-v1',
  timeline: [],
  readyAt: '2026-08-20T00:00:00Z',
})

const doneJob = (readyAsset: ArticleTtsAsset): ArticleTtsJob => ({
  jobId: 'job-a',
  articleId: 'article-a',
  inputHash: readyAsset.inputHash,
  status: 'done',
  totalSegments: 2,
  completedSegments: 2,
  failedSegment: null,
  errorCode: null,
  errorMessage: null,
  asset: readyAsset,
})

describe('ArticleTtsMiniPlayer', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: 'test-token' })
  })

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null })
  })

  it('plays only after the user clicks and immediately stops when updating', async () => {
    const firstAsset = asset('first')
    const updatedAsset = asset('updated')
    const service: ArticleTtsService = {
      getCurrent: vi.fn(async () => ({
        articleId: 'article-a',
        inputHash: firstAsset.inputHash,
        isStale: false,
        estimate: { bytes: 100, isEstimate: false },
        asset: firstAsset,
        job: null,
      })),
      createJob: vi.fn(async () => doneJob(updatedAsset)),
      retryJob: vi.fn(),
      getJob: vi.fn(),
      downloadAudio: vi.fn(async () => new Blob(['audio'])),
    }
    const audio = new FakeAudio()
    const revokeObjectURL = vi.fn()
    const controller = new ArticleTtsPlayerController({
      service,
      audioFactory: () => audio,
      objectUrl: {
        createObjectURL: vi
          .fn()
          .mockReturnValueOnce('blob:first')
          .mockReturnValueOnce('blob:updated'),
        revokeObjectURL,
      },
      wait: async () => undefined,
    })
    const view = render(
      <ArticleTtsPlayerProvider controller={controller}>
        <ArticleTtsMiniPlayer />
      </ArticleTtsPlayerProvider>
    )
    await act(async () => {
      await controller.prepare({ articleId: 'article-a', articleTitle: 'Article A' })
    })
    expect(audio.play).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Play full-article audio' }))
    expect(audio.play).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Pause full-article audio' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Update full-article audio' }))
    await waitFor(() => {
      expect(service.createJob).toHaveBeenCalledWith('article-a', true, expect.any(AbortSignal))
    })
    expect(audio.pause).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first')
    expect(await screen.findByRole('button', { name: 'Play full-article audio' })).toBeInTheDocument()
    view.unmount()
  })

  it('shows the failed segment and retries without silently skipping it', async () => {
    const recoveredAsset = asset('recovered')
    const failedJob: ArticleTtsJob = {
      ...doneJob(recoveredAsset),
      status: 'failed',
      completedSegments: 1,
      failedSegment: { segmentId: 'segment-2', segmentOrder: 2 },
      errorCode: 'segment_tts_failed',
      errorMessage: 'Segment failed.',
      asset: null,
    }
    const service: ArticleTtsService = {
      getCurrent: vi.fn(async () => ({
        articleId: 'article-a',
        inputHash: failedJob.inputHash,
        isStale: true,
        estimate: { bytes: 100, isEstimate: true },
        asset: null,
        job: failedJob,
      })),
      createJob: vi.fn(),
      retryJob: vi.fn(async () => doneJob(recoveredAsset)),
      getJob: vi.fn(),
      downloadAudio: vi.fn(async () => new Blob(['audio'])),
    }
    const controller = new ArticleTtsPlayerController({
      service,
      audioFactory: () => new FakeAudio(),
      objectUrl: { createObjectURL: () => 'blob:recovered', revokeObjectURL: vi.fn() },
      wait: async () => undefined,
    })
    const view = render(
      <ArticleTtsPlayerProvider controller={controller}>
        <ArticleTtsMiniPlayer />
      </ArticleTtsPlayerProvider>
    )
    await act(async () => {
      await controller.prepare({ articleId: 'article-a', articleTitle: 'Article A' })
    })

    expect(screen.getByText('Segment 2 failed and was not skipped')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry failed task' }))
    expect(await screen.findByRole('button', { name: 'Play full-article audio' })).toBeInTheDocument()
    expect(service.retryJob).toHaveBeenCalledWith('job-a', expect.any(AbortSignal))
    view.unmount()
  })
})
