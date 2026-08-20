import { render, screen } from '@testing-library/react'
import { useAuthStore } from '../../stores/authStore'
import { ArticleTtsPlayerProvider } from './ArticleTtsPlayerProvider'
import { useArticleTtsPlayer } from './articleTtsPlayerContext'
import { ArticleTtsPlayerController } from './playerController'

const PhaseProbe = ({ route }: { route: string }) => {
  const { state } = useArticleTtsPlayer()
  return <div data-testid="phase">{route}:{state.phase}</div>
}

describe('ArticleTtsPlayerProvider', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: 'test-token' })
  })

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null })
  })

  it('keeps the application-level controller while routed children change', () => {
    const controller = new ArticleTtsPlayerController()
    const dispose = vi.spyOn(controller, 'dispose')
    const view = render(
      <ArticleTtsPlayerProvider controller={controller}>
        <PhaseProbe route="practice" />
      </ArticleTtsPlayerProvider>
    )

    view.rerender(
      <ArticleTtsPlayerProvider controller={controller}>
        <PhaseProbe route="article-list" />
      </ArticleTtsPlayerProvider>
    )

    expect(screen.getByTestId('phase')).toHaveTextContent('article-list:idle')
    expect(dispose).not.toHaveBeenCalled()

    view.unmount()
    expect(dispose).toHaveBeenCalledTimes(1)
  })
})
