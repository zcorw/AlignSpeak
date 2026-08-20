export interface PlaybackClaim {
  type: 'claim'
  tabId: string
  claimedAt: number
  nonce: string
}

export interface PlaybackCoordinator {
  claim: () => void
  subscribe: (listener: () => void) => () => void
  dispose: () => void
}

interface BroadcastChannelLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  postMessage: (message: unknown) => void
  close: () => void
}

interface BrowserPlaybackCoordinatorOptions {
  tabId?: string
  now?: () => number
  channelFactory?: ((name: string) => BroadcastChannelLike) | null
  storage?: Pick<Storage, 'setItem'> | null
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null
}

const CHANNEL_NAME = 'alignspeak-article-tts-player-v1'
const STORAGE_KEY = 'alignspeak:article-tts-player-claim:v1'

const isPlaybackClaim = (value: unknown): value is PlaybackClaim => {
  if (!value || typeof value !== 'object') return false
  const claim = value as Partial<PlaybackClaim>
  return (
    claim.type === 'claim' &&
    typeof claim.tabId === 'string' &&
    typeof claim.claimedAt === 'number' &&
    Number.isFinite(claim.claimedAt) &&
    typeof claim.nonce === 'string'
  )
}

const compareClaims = (left: PlaybackClaim, right: PlaybackClaim) => {
  if (left.claimedAt !== right.claimedAt) return left.claimedAt - right.claimedAt
  return left.tabId.localeCompare(right.tabId)
}

export class BrowserPlaybackCoordinator implements PlaybackCoordinator {
  private readonly tabId: string
  private readonly now: () => number
  private readonly channel: BroadcastChannelLike | null
  private readonly storage: Pick<Storage, 'setItem'> | null
  private readonly eventTarget: Pick<Window, 'addEventListener' | 'removeEventListener'> | null
  private readonly listeners = new Set<() => void>()
  private latestClaim: PlaybackClaim | null = null
  private disposed = false

  constructor(options: BrowserPlaybackCoordinatorOptions = {}) {
    this.tabId = options.tabId ?? crypto.randomUUID()
    this.now = options.now ?? Date.now
    const defaultChannelFactory =
      typeof BroadcastChannel === 'undefined'
        ? null
        : (name: string) => new BroadcastChannel(name)
    const channelFactory = options.channelFactory === undefined
      ? defaultChannelFactory
      : options.channelFactory
    let channel: BroadcastChannelLike | null = null
    try {
      channel = channelFactory?.(CHANNEL_NAME) ?? null
    } catch {
      // Fall back to storage when a privacy mode exposes but denies BroadcastChannel.
    }
    this.channel = channel
    this.storage = options.storage === undefined
      ? (typeof window === 'undefined' ? null : window.localStorage)
      : options.storage
    this.eventTarget = options.eventTarget === undefined
      ? (typeof window === 'undefined' ? null : window)
      : options.eventTarget
    if (this.channel) {
      this.channel.onmessage = (event) => this.receive(event.data)
    } else {
      this.eventTarget?.addEventListener('storage', this.handleStorageEvent)
    }
  }

  private handleStorageEvent = (event: Event) => {
    const storageEvent = event as StorageEvent
    if (storageEvent.key !== STORAGE_KEY || !storageEvent.newValue) return
    try {
      this.receive(JSON.parse(storageEvent.newValue))
    } catch {
      // Ignore malformed messages from unrelated or older clients.
    }
  }

  private receive(value: unknown) {
    if (this.disposed || !isPlaybackClaim(value) || value.tabId === this.tabId) return
    if (this.latestClaim && compareClaims(value, this.latestClaim) <= 0) return
    this.latestClaim = value
    this.listeners.forEach((listener) => listener())
  }

  claim() {
    if (this.disposed) return
    const minimumTimestamp = this.latestClaim ? this.latestClaim.claimedAt + 1 : 0
    const claim: PlaybackClaim = {
      type: 'claim',
      tabId: this.tabId,
      claimedAt: Math.max(this.now(), minimumTimestamp),
      nonce: crypto.randomUUID(),
    }
    this.latestClaim = claim
    if (this.channel) {
      try {
        this.channel.postMessage(claim)
      } catch {
        // Coordination is best effort; a closed channel must never block playback.
      }
      return
    }
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(claim))
    } catch {
      // Playback still works when privacy settings deny storage.
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.listeners.clear()
    if (this.channel) {
      this.channel.onmessage = null
      this.channel.close()
    } else {
      this.eventTarget?.removeEventListener('storage', this.handleStorageEvent)
    }
  }
}
