import { getApiErrorMessage } from '../../services/authService'
import {
  articleTtsService,
  type ArticleTtsAsset,
  type ArticleTtsFailedSegment,
  type ArticleTtsJob,
  type ArticleTtsService,
} from '../../services/articleTtsService'
import { BrowserPlaybackCoordinator, type PlaybackCoordinator } from './playbackCoordinator'

export const ARTICLE_TTS_RESUME_TTL_MS = 24 * 60 * 60 * 1000
const POSITION_PERSIST_INTERVAL_MS = 5000

export type ArticleTtsPlayerPhase =
  | 'idle'
  | 'checking'
  | 'preparing'
  | 'downloading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'failed'

export type ArticleTtsStopModeOption = 'infinite' | 'end-current' | 15 | 30 | 60
export type ArticleTtsStopMode = 'infinite' | 'end-current' | 'sleep'
export type ArticleTtsInterruptionReason =
  | 'another-tab'
  | 'recording'
  | 'segment-audio'
  | 'sentence-audio'
  | 'system'

export interface ArticleTtsResumeCandidate {
  articleId: string
  articleTitle: string
  assetId: string
  inputHash: string
  positionSeconds: number
  durationSeconds: number
  updatedAtMs: number
}

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
  stopMode: ArticleTtsStopMode
  sleepMinutes: 15 | 30 | 60 | null
  sleepDeadlineMs: number | null
  interruptionReason: ArticleTtsInterruptionReason | null
  lastStopReason: 'manual' | 'end-current' | 'sleep' | null
  resumeCandidate: ArticleTtsResumeCandidate | null
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
  loop: boolean
  playbackRate?: number
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

interface MediaSessionAdapter {
  metadata: MediaMetadata | null
  playbackState: MediaSessionPlaybackState
  setActionHandler: (
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null
  ) => void
  setPositionState?: (state?: MediaPositionState) => void
}

interface ResumeStorageRecord extends ArticleTtsResumeCandidate {
  version: 1
}

export interface ArticleTtsPlayerControllerOptions {
  service?: ArticleTtsService
  audioFactory?: () => ArticleTtsAudio
  objectUrl?: ObjectUrlAdapter
  pollIntervalMs?: number
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>
  now?: () => number
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  coordinatorFactory?: () => PlaybackCoordinator
  mediaSession?: MediaSessionAdapter | null
  mediaMetadataFactory?: (init: MediaMetadataInit) => MediaMetadata | null
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
  stopMode: 'infinite',
  sleepMinutes: null,
  sleepDeadlineMs: null,
  interruptionReason: null,
  lastStopReason: null,
  resumeCandidate: null,
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

const isResumeStorageRecord = (value: unknown): value is ResumeStorageRecord => {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<ResumeStorageRecord>
  return (
    record.version === 1 &&
    typeof record.articleId === 'string' &&
    typeof record.articleTitle === 'string' &&
    typeof record.assetId === 'string' &&
    typeof record.inputHash === 'string' &&
    typeof record.positionSeconds === 'number' &&
    Number.isFinite(record.positionSeconds) &&
    record.positionSeconds >= 0 &&
    typeof record.durationSeconds === 'number' &&
    Number.isFinite(record.durationSeconds) &&
    record.durationSeconds > 0 &&
    typeof record.updatedAtMs === 'number' &&
    Number.isFinite(record.updatedAtMs)
  )
}

export class ArticleTtsPlayerController {
  private state = initialState()
  private readonly listeners = new Set<() => void>()
  private readonly service: ArticleTtsService
  private readonly audioFactory: () => ArticleTtsAudio
  private readonly objectUrl: ObjectUrlAdapter
  private readonly pollIntervalMs: number
  private readonly wait: (milliseconds: number, signal: AbortSignal) => Promise<void>
  private readonly now: () => number
  private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  private readonly coordinatorFactory: () => PlaybackCoordinator
  private readonly mediaSession: MediaSessionAdapter | null
  private readonly mediaMetadataFactory: (init: MediaMetadataInit) => MediaMetadata | null
  private audio: ArticleTtsAudio | null = null
  private mediaObjectUrl: string | null = null
  private abortController: AbortController | null = null
  private coordinator: PlaybackCoordinator | null = null
  private unsubscribeCoordinator: (() => void) | null = null
  private sleepTimer: ReturnType<typeof setTimeout> | null = null
  private storageOwnerId: string | null = null
  private lastPersistedAtMs = 0
  private requestedPause: ArticleTtsInterruptionReason | 'manual' | null = null
  private suppressPauseEvent = false
  private operationId = 0
  private disposed = false

  constructor(options: ArticleTtsPlayerControllerOptions = {}) {
    this.service = options.service ?? articleTtsService
    this.audioFactory = options.audioFactory ?? (() => new Audio())
    this.objectUrl = options.objectUrl ?? URL
    this.pollIntervalMs = options.pollIntervalMs ?? 1000
    this.wait = options.wait ?? defaultWait
    this.now = options.now ?? Date.now
    this.storage = options.storage === undefined
      ? (typeof window === 'undefined' ? null : window.localStorage)
      : options.storage
    this.coordinatorFactory = options.coordinatorFactory ?? (() => new BrowserPlaybackCoordinator())
    this.mediaSession = options.mediaSession === undefined
      ? (typeof navigator === 'undefined' ? null : navigator.mediaSession ?? null)
      : options.mediaSession
    this.mediaMetadataFactory = options.mediaMetadataFactory ?? ((init) => {
      if (typeof MediaMetadata === 'undefined') return null
      return new MediaMetadata(init)
    })
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

  private ensureCoordinator() {
    if (this.coordinator) return this.coordinator
    this.coordinator = this.coordinatorFactory()
    this.unsubscribeCoordinator = this.coordinator.subscribe(() => {
      if (this.state.phase === 'playing') this.interrupt('another-tab')
    })
    return this.coordinator
  }

  private updateMediaSessionPlaybackState() {
    if (!this.mediaSession) return
    try {
      this.mediaSession.playbackState = this.state.phase === 'playing'
        ? 'playing'
        : this.state.asset
          ? 'paused'
          : 'none'
    } catch {
      // Media Session support is best effort on iOS WebKit.
    }
  }

  private updateMediaSessionPosition() {
    if (!this.mediaSession?.setPositionState || !this.state.asset) return
    const duration = this.state.durationSeconds || this.state.asset.durationMs / 1000
    if (!Number.isFinite(duration) || duration <= 0) return
    const position = Math.min(Math.max(this.state.currentTimeSeconds, 0), duration)
    try {
      this.mediaSession.setPositionState({
        duration,
        playbackRate: this.audio?.playbackRate || 1,
        position,
      })
    } catch {
      // Some iOS versions expose Media Session but reject position state.
    }
  }

  private configureMediaSession() {
    if (!this.mediaSession || !this.state.asset) return
    try {
      this.mediaSession.metadata = this.mediaMetadataFactory({
        title: this.state.articleTitle || 'Article audio',
        artist: 'AlignSpeak',
        album: 'Full-article TTS',
      })
    } catch {
      // Metadata construction is optional.
    }
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => { void this.play() }],
      ['pause', () => this.pause()],
      ['stop', () => this.stop()],
      ['seekto', (details) => {
        if (typeof details.seekTime === 'number') this.seekTo(details.seekTime)
      }],
    ]
    handlers.forEach(([action, handler]) => {
      try {
        this.mediaSession?.setActionHandler(action, handler)
      } catch {
        // Ignore unsupported actions while retaining play/pause when available.
      }
    })
    this.updateMediaSessionPlaybackState()
    this.updateMediaSessionPosition()
  }

  private clearMediaSession() {
    if (!this.mediaSession) return
    ;(['play', 'pause', 'stop', 'seekto'] as MediaSessionAction[]).forEach((action) => {
      try {
        this.mediaSession?.setActionHandler(action, null)
      } catch {
        // Ignore unsupported actions.
      }
    })
    try {
      this.mediaSession.metadata = null
      this.mediaSession.playbackState = 'none'
      this.mediaSession.setPositionState?.()
    } catch {
      // Best effort cleanup.
    }
  }

  private ensureAudio() {
    if (this.audio) return this.audio
    const audio = this.audioFactory()
    audio.preload = 'auto'
    audio.loop = true
    audio.onplay = () => {
      this.requestedPause = null
      this.setState({ phase: 'playing', interruptionReason: null, lastStopReason: null })
      this.updateMediaSessionPlaybackState()
    }
    audio.onpause = () => {
      if (this.suppressPauseEvent || this.state.phase !== 'playing') return
      const reason = this.requestedPause === 'manual'
        ? null
        : this.requestedPause ?? 'system'
      this.requestedPause = null
      this.setState({ phase: 'paused', interruptionReason: reason })
      this.persistPosition(true)
      this.updateMediaSessionPlaybackState()
    }
    audio.onended = () => {
      if (this.state.stopMode === 'end-current') {
        audio.loop = true
        audio.currentTime = 0
        this.setState({
          phase: 'ready',
          currentTimeSeconds: 0,
          stopMode: 'infinite',
          lastStopReason: 'end-current',
          interruptionReason: null,
        })
        this.persistPosition(true)
        this.updateMediaSessionPlaybackState()
        return
      }
      if (this.enforceSleepDeadline()) return
      audio.currentTime = 0
      void audio.play().catch(() => {
        this.setState({ phase: 'paused', interruptionReason: 'system' })
        this.updateMediaSessionPlaybackState()
      })
    }
    audio.ontimeupdate = () => {
      this.setState({
        currentTimeSeconds: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
        durationSeconds: Number.isFinite(audio.duration)
          ? audio.duration
          : (this.state.asset?.durationMs ?? 0) / 1000,
      })
      if (!this.enforceSleepDeadline()) {
        this.persistPosition(false)
        this.updateMediaSessionPosition()
      }
    }
    audio.onerror = () => {
      this.persistPosition(true)
      this.setState({
        phase: 'failed',
        error: {
          code: 'audio_playback_failed',
          message: 'The prepared article audio could not be played.',
          failedSegment: null,
        },
      })
      this.updateMediaSessionPlaybackState()
    }
    this.audio = audio
    return audio
  }

  private releaseMedia() {
    this.clearSleepTimer()
    this.clearMediaSession()
    if (this.audio) {
      this.suppressPauseEvent = true
      this.audio.pause()
      this.audio.removeAttribute('src')
      this.audio.load()
      this.audio.currentTime = 0
      this.audio.loop = true
      this.suppressPauseEvent = false
      this.requestedPause = null
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
    return { id: this.operationId, signal: this.abortController.signal }
  }

  private isCurrentOperation(id: number) {
    return !this.disposed && id === this.operationId
  }

  private storageKey() {
    return this.storageOwnerId
      ? `alignspeak:article-tts-resume:v1:${this.storageOwnerId}`
      : null
  }

  private loadResumeCandidate() {
    const key = this.storageKey()
    if (!key || !this.storage) return null
    try {
      const raw = this.storage.getItem(key)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      if (
        !isResumeStorageRecord(parsed) ||
        parsed.updatedAtMs > this.now() ||
        this.now() - parsed.updatedAtMs > ARTICLE_TTS_RESUME_TTL_MS
      ) {
        this.storage.removeItem(key)
        return null
      }
      return parsed
    } catch {
      try {
        this.storage.removeItem(key)
      } catch {
        // Ignore storage denial.
      }
      return null
    }
  }

  private persistPosition(force: boolean) {
    const key = this.storageKey()
    const asset = this.state.asset
    const audio = this.audio
    if (!key || !this.storage || !asset || !audio || !this.state.articleId || !this.state.articleTitle) return
    const persistedAt = this.now()
    if (!force && persistedAt - this.lastPersistedAtMs < POSITION_PERSIST_INTERVAL_MS) return
    const duration = this.state.durationSeconds || asset.durationMs / 1000
    const record: ResumeStorageRecord = {
      version: 1,
      articleId: this.state.articleId,
      articleTitle: this.state.articleTitle,
      assetId: asset.assetId,
      inputHash: asset.inputHash,
      positionSeconds: Math.min(Math.max(audio.currentTime || 0, 0), duration),
      durationSeconds: duration,
      updatedAtMs: persistedAt,
    }
    try {
      this.storage.setItem(key, JSON.stringify(record))
      this.lastPersistedAtMs = persistedAt
    } catch {
      // Private browsing may deny localStorage writes.
    }
  }

  private removePersistedPosition() {
    const key = this.storageKey()
    if (!key || !this.storage) return
    try {
      this.storage.removeItem(key)
    } catch {
      // Ignore storage denial.
    }
  }

  setStorageOwner(userId: string | null) {
    const normalized = userId?.trim() || null
    if (normalized === this.storageOwnerId) return
    if (this.storageOwnerId && this.storageOwnerId !== normalized) this.reset()
    this.storageOwnerId = normalized
    if (this.state.phase === 'idle') {
      this.setState({ resumeCandidate: normalized ? this.loadResumeCandidate() : null })
    }
  }

  clearForLogout() {
    this.reset()
    this.storageOwnerId = null
  }

  dismissResume() {
    this.removePersistedPosition()
    this.setState({ resumeCandidate: null })
  }

  async resume() {
    const candidate = this.state.resumeCandidate
    if (!candidate) return
    await this.prepare({ articleId: candidate.articleId, articleTitle: candidate.articleTitle })
    if (this.state.phase !== 'ready' || !this.audio || !this.state.asset) {
      this.setState({ resumeCandidate: candidate })
      return
    }
    const sameAsset =
      this.state.asset.assetId === candidate.assetId &&
      this.state.asset.inputHash === candidate.inputHash
    const position = sameAsset
      ? Math.min(candidate.positionSeconds, this.state.durationSeconds)
      : 0
    this.audio.currentTime = position
    this.setState({ currentTimeSeconds: position, resumeCandidate: null })
    this.persistPosition(true)
    this.updateMediaSessionPosition()
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
    audio.loop = true
    audio.load()
    this.lastPersistedAtMs = 0
    this.setState({
      phase: 'ready',
      asset,
      downloadedBytes: blob.size,
      downloadTotalBytes: asset.fileSize,
      currentTimeSeconds: 0,
      durationSeconds: asset.durationMs / 1000,
      stopMode: 'infinite',
      sleepMinutes: null,
      sleepDeadlineMs: null,
      interruptionReason: null,
      lastStopReason: null,
      resumeCandidate: null,
      error: null,
    })
    this.configureMediaSession()
    this.persistPosition(true)
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
    this.persistPosition(true)
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

  private clearSleepTimer() {
    if (this.sleepTimer !== null) {
      clearTimeout(this.sleepTimer)
      this.sleepTimer = null
    }
  }

  private scheduleSleepDeadline() {
    this.clearSleepTimer()
    const deadline = this.state.sleepDeadlineMs
    if (!deadline) return
    this.sleepTimer = setTimeout(() => {
      this.sleepTimer = null
      if (!this.enforceSleepDeadline()) this.scheduleSleepDeadline()
    }, Math.max(deadline - this.now(), 0))
  }

  private enforceSleepDeadline() {
    const deadline = this.state.sleepDeadlineMs
    if (!deadline || this.now() < deadline) return false
    this.stopAtPolicyBoundary('sleep')
    return true
  }

  private stopAtPolicyBoundary(reason: 'manual' | 'sleep') {
    if (!this.audio || !this.state.asset) return
    this.clearSleepTimer()
    this.requestedPause = 'manual'
    this.audio.pause()
    this.audio.currentTime = 0
    this.audio.loop = true
    this.requestedPause = null
    this.setState({
      phase: 'ready',
      currentTimeSeconds: 0,
      stopMode: 'infinite',
      sleepMinutes: null,
      sleepDeadlineMs: null,
      interruptionReason: null,
      lastStopReason: reason,
    })
    this.persistPosition(true)
    this.updateMediaSessionPlaybackState()
    this.updateMediaSessionPosition()
  }

  setStopMode(option: ArticleTtsStopModeOption) {
    this.clearSleepTimer()
    if (option === 'infinite') {
      if (this.audio) this.audio.loop = true
      this.setState({
        stopMode: 'infinite',
        sleepMinutes: null,
        sleepDeadlineMs: null,
        lastStopReason: null,
      })
      return
    }
    if (option === 'end-current') {
      if (this.audio) this.audio.loop = false
      this.setState({
        stopMode: 'end-current',
        sleepMinutes: null,
        sleepDeadlineMs: null,
        lastStopReason: null,
      })
      return
    }
    const deadline = this.now() + option * 60 * 1000
    if (this.audio) this.audio.loop = true
    this.setState({
      stopMode: 'sleep',
      sleepMinutes: option,
      sleepDeadlineMs: deadline,
      lastStopReason: null,
    })
    this.scheduleSleepDeadline()
  }

  async play() {
    if (this.state.phase !== 'ready' && this.state.phase !== 'paused') return
    const audio = this.audio
    if (!audio || !this.mediaObjectUrl || this.enforceSleepDeadline()) return
    this.ensureCoordinator().claim()
    audio.loop = this.state.stopMode !== 'end-current'
    try {
      await audio.play()
      this.setState({
        phase: 'playing',
        error: null,
        interruptionReason: null,
        lastStopReason: null,
      })
      this.updateMediaSessionPlaybackState()
    } catch (error: unknown) {
      this.setState({
        phase: 'failed',
        error: {
          code: 'audio_playback_blocked',
          message: getApiErrorMessage(error, 'Tap play again to start the article audio.'),
          failedSegment: null,
        },
      })
      this.updateMediaSessionPlaybackState()
    }
  }

  pause() {
    if (!this.audio || this.state.phase !== 'playing') return
    this.requestedPause = 'manual'
    this.audio.pause()
    this.requestedPause = null
    this.setState({ phase: 'paused', interruptionReason: null })
    this.persistPosition(true)
    this.updateMediaSessionPlaybackState()
  }

  interrupt(reason: ArticleTtsInterruptionReason) {
    if (!this.audio || this.state.phase !== 'playing') return
    this.requestedPause = reason
    this.audio.pause()
    this.requestedPause = null
    this.setState({ phase: 'paused', interruptionReason: reason })
    this.persistPosition(true)
    this.updateMediaSessionPlaybackState()
  }

  seekTo(positionSeconds: number) {
    if (!this.audio || !this.state.asset || !Number.isFinite(positionSeconds)) return
    const duration = this.state.durationSeconds || this.state.asset.durationMs / 1000
    const position = Math.min(Math.max(positionSeconds, 0), duration)
    this.audio.currentTime = position
    this.setState({ currentTimeSeconds: position })
    this.persistPosition(true)
    this.updateMediaSessionPosition()
  }

  stop() {
    this.stopAtPolicyBoundary('manual')
  }

  checkpoint() {
    if (!this.enforceSleepDeadline()) this.persistPosition(true)
  }

  reset() {
    this.operationId += 1
    this.abortController?.abort()
    this.abortController = null
    this.removePersistedPosition()
    this.releaseMedia()
    this.unsubscribeCoordinator?.()
    this.unsubscribeCoordinator = null
    this.coordinator?.dispose()
    this.coordinator = null
    this.setState(initialState())
  }

  dispose() {
    if (this.disposed) return
    this.persistPosition(true)
    this.operationId += 1
    this.abortController?.abort()
    this.abortController = null
    this.clearSleepTimer()
    this.unsubscribeCoordinator?.()
    this.coordinator?.dispose()
    this.unsubscribeCoordinator = null
    this.coordinator = null
    this.disposed = true
    this.releaseMedia()
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
