import { BrowserPlaybackCoordinator } from './playbackCoordinator'

interface FakeChannel {
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  postMessage: (message: unknown) => void
  close: () => void
}

class FakeBroadcastHub {
  readonly channels: FakeChannel[] = []

  create = (): FakeChannel => {
    const channel: FakeChannel = {
      onmessage: null,
      postMessage: (message) => {
        this.channels.forEach((target) => {
          if (target !== channel) target.onmessage?.({ data: message } as MessageEvent<unknown>)
        })
      },
      close: vi.fn(),
    }
    this.channels.push(channel)
    return channel
  }
}

describe('BrowserPlaybackCoordinator', () => {
  it('lets the most recent tab claim pause older owners without echoing itself', () => {
    const hub = new FakeBroadcastHub()
    let now = 100
    const first = new BrowserPlaybackCoordinator({
      tabId: 'tab-a',
      now: () => now,
      channelFactory: hub.create,
    })
    const second = new BrowserPlaybackCoordinator({
      tabId: 'tab-b',
      now: () => now,
      channelFactory: hub.create,
    })
    const firstInterrupted = vi.fn()
    const secondInterrupted = vi.fn()
    first.subscribe(firstInterrupted)
    second.subscribe(secondInterrupted)

    first.claim()
    expect(firstInterrupted).not.toHaveBeenCalled()
    expect(secondInterrupted).toHaveBeenCalledTimes(1)

    now = 101
    second.claim()
    expect(firstInterrupted).toHaveBeenCalledTimes(1)
    expect(secondInterrupted).toHaveBeenCalledTimes(1)

    first.dispose()
    second.dispose()
  })

  it('uses a deterministic tie-breaker for simultaneous claims', () => {
    const hub = new FakeBroadcastHub()
    const first = new BrowserPlaybackCoordinator({
      tabId: 'tab-a',
      now: () => 100,
      channelFactory: hub.create,
    })
    const second = new BrowserPlaybackCoordinator({
      tabId: 'tab-b',
      now: () => 100,
      channelFactory: hub.create,
    })
    const firstInterrupted = vi.fn()
    first.subscribe(firstInterrupted)

    first.claim()
    second.claim()

    expect(firstInterrupted).toHaveBeenCalledTimes(1)
    first.dispose()
    second.dispose()
  })
})
