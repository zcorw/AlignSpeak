import { getApiErrorMessage } from '../../services/authService'
import {
  articleTtsService,
  type ArticleTtsAsset,
  type ArticleTtsFailedSegment,
  type ArticleTtsJob,
  type ArticleTtsService,
} from '../../services/articleTtsService'

export type ArticleTtsPlayerPhase =
  | 'idle'
  | 'checking'
  | 'preparing'
  | 'downloading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'failed'

export interface ArticleTtsPlayerError {
  code: string
  message: string
  failedSegment: ArticleTtsFailedSegment | null
}

export interface ArticleTtsPlayerState {
  phase: ArticleTtsPlayerPhase
  articleId: string | null
  articleTitle: string | null
  inputHash: string | null
  jobId: string | null
  completedSegments: number
  totalSegments: number
  estimatedBytes: number | null
  estimateIsExact: boolean
  downloadedBytes: number
  downloadTotalBytes: number | null
  asset: ArticleTtsAsset | null
  currentTimeSeconds: number
  durationSeconds: number
  error: ArticleTtsPlayerError | null
}

export interface PrepareArticleTtsRequest {
  articleId: string
  articleTitle: string
  forceRefresh?: boolean
}

export interface ArticleTtsAudio {
  src: string
  preload: string
  currentTime: number
  duration: number
  paused: boolean
  onplay: HTMLMediaElement['onplay']
  onpause: HTMLMediaElement['onpause']
  onended: HTMLMediaElement['onended']
  ontimeupdate: HTMLMediaElement['ontimeupdate']
  onerror: HTMLMediaElement['onerror']
  play: () => Promise<void>
  pause: () => void
  load: () => void
  removeAttribute: (name: string) => void
}

interface ObjectUrlAdapter {
  createObjectURL: (blob: Blob) => string
  revokeObjectURL: (url: string) => void
}

interface ArticleTtsPlayerControllerOptions {
  service?: ArticleTtsService
  audioFactory?: () => ArticleTtsAudio
  objectUrl?: ObjectUrlAdapter
  pollIntervalMs?: number
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>
}

const initialState = (): ArticleTtsPlayerState => ({
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
  error: null,
})

const defaultWait = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      },
      { once: true }
    )
  })

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'

export class ArticleTtsPlayerController {
  private state = initialState()
  private readonly listeners = new Set<() => void>()
  private readonly service: ArticleTtsService
  private readonly audioFactory: () => ArticleTtsAudio
  private readonly objectUrl: ObjectUrlAdapter
  private readonly pollIntervalMs: number
  private readonly wait: (milliseconds: number, signal: AbortSignal) => Promise<void>
  private audio: ArticleTtsAudio | null = null
  private mediaObjectUrl: string | null = null
  private abortController: AbortController | null = null
  private operationId = 0
  private disposed = false

  constructor(options: ArticleTtsPlayerControllerOptions = {}) {
    this.service = options.service ?? articleTtsService
    this.audioFactory = options.audioFactory ?? (() => new Audio())
    this.objectUrl = options.objectUrl ?? URL
    this.pollIntervalMs = options.pollIntervalMs ?? 1000
    this.wait = options.wait ?? defaultWait
  }

  getState = () => this.state

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private setState(patch: Partial<ArticleTtsPlayerState>) {
    if (this.disposed) return
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  private ensureAudio() {
    if (this.audio) return this.audio
    const audio = this.audioFactory()
    audio.preload = 'auto'
    audio.onplay = () => this.setState({ phase: 'playing' })
    audio.onpause = () => {
      if (this.state.phase === 'playing') this.setState({ phase: 'paused' })
    }
    audio.onended = () => this.setState({ phase: 'ready', currentTimeSeconds: 0 })
    audio.ontimeupdate = () => {
      this.setState({
        currentTimeSeconds: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
        durationSeconds: Number.isFinite(audio.duration)
          ? audio.duration
          : (this.state.asset?.durationMs ?? 0) / 1000,
      })
    }
    audio.onerror = () => {
      this.setState({
        phase: 'failed',
        error: {
          code: 'audio_playback_failed',
          message: 'The prepared article audio could not be played.',
          failedSegment: null,
        },
      })
    }
    this.audio = audio
    return audio
  }

  private releaseMedia() {
    if (this.audio) {
      this.audio.pause()
      this.audio.removeAttribute('src')
      this.audio.load()
      this.audio.currentTime = 0
    }
    if (this.mediaObjectUrl) {
      this.objectUrl.revokeObjectURL(this.mediaObjectUrl)
      this.mediaObjectUrl = null
    }
  }

  private startOperation() {
    this.operationId += 1
    this.abortController?.abort()
    this.abortController = new AbortController()
    return {
      id: this.operationId,
      signal: this.abortController.signal,
    }
  }

  private isCurrentOperation(id: number) {
    return !this.disposed && id === this.operationId
  }

  private updateJobState(job: ArticleTtsJob) {
    this.setState({
      phase: 'preparing',
      inputHash: job.inputHash,
      jobId: job.jobId,
      completedSegments: job.completedSegments,
      totalSegments: job.totalSegments,
      error: null,
    })
  }

  private failFromJob(job: ArticleTtsJob) {
    this.setState({
      phase: 'failed',
      inputHash: job.inputHash,
      jobId: job.jobId,
      completedSegments: job.completedSegments,
      totalSegments: job.totalSegments,
      error: {
        code: job.errorCode ?? 'article_tts_failed',
        message: job.errorMessage ?? 'The article audio could not be prepared.',
        failedSegment: job.failedSegment,
      },
    })
  }

  private async downloadAsset(
    asset: ArticleTtsAsset,
    operation: { id: number; signal: AbortSignal }
  ) {
    this.setState({
      phase: 'downloading',
      inputHash: asset.inputHash,
      asset,
      downloadedBytes: 0,
      downloadTotalBytes: asset.fileSize,
      error: null,
    })
    const blob = await this.service.downloadAudio(
      asset,
      (progress) => {
        if (!this.isCurrentOperation(operation.id)) return
        this.setState({
          downloadedBytes: progress.loadedBytes,
          downloadTotalBytes: progress.totalBytes ?? asset.fileSize,
        })
      },
      operation.signal
    )
    if (!this.isCurrentOperation(operation.id)) return
    const nextObjectUrl = this.objectUrl.createObjectURL(blob)
    this.releaseMedia()
    this.mediaObjectUrl = nextObjectUrl
    const audio = this.ensureAudio()
    audio.src = nextObjectUrl
    audio.load()
    this.setState({
      phase: 'ready',
      asset,
      downloadedBytes: blob.size,
      downloadTotalBytes: asset.fileSize,
      currentTimeSeconds: 0,
      durationSeconds: asset.durationMs / 1000,
      error: null,
    })
  }

  private async followJob(
    initialJob: ArticleTtsJob,
    operation: { id: number; signal: AbortSignal }
  ) {
    let job = initialJob
    while (this.isCurrentOperation(operation.id)) {
      if (job.status === 'done' && job.asset) {
        this.setState({
          inputHash: job.inputHash,
          jobId: job.jobId,
          completedSegments: job.completedSegments,
          totalSegments: job.totalSegments,
        })
        await this.downloadAsset(job.asset, operation)
        return
      }
      if (job.status === 'failed' || job.status === 'cancelled') {
        this.failFromJob(job)
        return
      }
      this.updateJobState(job)
      await this.wait(this.pollIntervalMs, operation.signal)
      job = await this.service.getJob(job.jobId, operation.signal)
    }
  }

  async prepare(request: PrepareArticleTtsRequest) {
    const operation = this.startOperation()
    this.releaseMedia()
    this.setState({
      ...initialState(),
      phase: 'checking',
      articleId: request.articleId,
      articleTitle: request.articleTitle,
    })
    try {
      if (!request.forceRefresh) {
        const current = await this.service.getCurrent(request.articleId, operation.signal)
        if (!this.isCurrentOperation(operation.id)) return
        this.setState({
          inputHash: current.inputHash,
          estimatedBytes: current.estimate.bytes,
          estimateIsExact: !current.estimate.isEstimate,
        })
        if (current.asset && !current.isStale) {
          await this.downloadAsset(current.asset, operation)
          return
        }
        if (current.job) {
          await this.followJob(current.job, operation)
          return
        }
      }
      const job = await this.service.createJob(
        request.articleId,
        Boolean(request.forceRefresh),
        operation.signal
      )
      if (!this.isCurrentOperation(operation.id)) return
      await this.followJob(job, operation)
    } catch (error: unknown) {
      if (!this.isCurrentOperation(operation.id) || isAbortError(error)) return
      this.setState({
        phase: 'failed',
        error: {
          code: 'article_tts_request_failed',
          message: getApiErrorMessage(error, 'The article audio request failed.'),
          failedSegment: null,
        },
      })
    }
  }

  async retry() {
    const jobId = this.state.jobId
    if (!jobId) return
    const operation = this.startOperation()
    this.setState({ phase: 'preparing', error: null })
    try {
      const job = await this.service.retryJob(jobId, operation.signal)
      if (!this.isCurrentOperation(operation.id)) return
      await this.followJob(job, operation)
    } catch (error: unknown) {
      if (!this.isCurrentOperation(operation.id) || isAbortError(error)) return
      this.setState({
        phase: 'failed',
        error: {
          code: 'article_tts_retry_failed',
          message: getApiErrorMessage(error, 'The article audio retry failed.'),
          failedSegment: null,
        },
      })
    }
  }

  async play() {
    if (this.state.phase !== 'ready' && this.state.phase !== 'paused') return
    const audio = this.audio
    if (!audio || !this.mediaObjectUrl) return
    try {
      await audio.play()
      this.setState({ phase: 'playing', error: null })
    } catch (error: unknown) {
      this.setState({
        phase: 'failed',
        error: {
          code: 'audio_playback_blocked',
          message: getApiErrorMessage(error, 'Tap play again to start the article audio.'),
          failedSegment: null,
        },
      })
    }
  }

  pause() {
    if (!this.audio || this.state.phase !== 'playing') return
    this.audio.pause()
    this.setState({ phase: 'paused' })
  }

  stop() {
    if (!this.audio || !this.state.asset) return
    this.audio.pause()
    this.audio.currentTime = 0
    this.setState({ phase: 'ready', currentTimeSeconds: 0 })
  }

  reset() {
    this.operationId += 1
    this.abortController?.abort()
    this.abortController = null
    this.releaseMedia()
    this.setState(initialState())
  }

  dispose() {
    if (this.disposed) return
    this.reset()
    this.disposed = true
    if (this.audio) {
      this.audio.onplay = null
      this.audio.onpause = null
      this.audio.onended = null
      this.audio.ontimeupdate = null
      this.audio.onerror = null
      this.audio = null
    }
    this.listeners.clear()
  }
}
