import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type UpdateState, useUpdates } from '../hooks/useUpdates'
import { UpdateBanner } from './UpdateBanner'

/**
 * The banner and the hook that feeds it, driven through the same bridge the
 * preload exposes. The main process owns the check, so what is under test here
 * is the whole renderer half: that nothing is drawn until the app is told
 * something, and that installing takes a press.
 */

const VERSION = '1.1.0'

let emit: (state: UpdateState | null) => void = () => {}
const install = vi.fn(async () => {})
const unsubscribe = vi.fn()

/** The banner the way App draws it, so the hook is covered with it. */
function Harness() {
  const updates = useUpdates()
  if (!updates.state) return null
  return (
    <UpdateBanner state={updates.state} onInstall={updates.install} onDismiss={updates.dismiss} />
  )
}

/** The push the main process makes, so React sees it as the state change it is. */
async function report(status: UpdateState['status']): Promise<void> {
  await act(async () => {
    emit({ status, version: VERSION })
  })
}

beforeEach(() => {
  window.updates = {
    onStatus: (listener) => {
      emit = listener
      return unsubscribe
    },
    install,
  }
})

afterEach(() => {
  cleanup()
  delete window.updates
})

describe('update banner', () => {
  it('draws nothing until an update is reported', () => {
    render(<Harness />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('is a no-op in a browser, where there is no updater to talk to', async () => {
    delete window.updates
    render(<Harness />)
    await report('downloaded')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('reports a download without offering to install it', async () => {
    render(<Harness />)
    await report('available')

    expect(screen.getByRole('status')).toHaveTextContent('Update available')
    expect(screen.getByText(`Version ${VERSION} is downloading.`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Install and restart' })).not.toBeInTheDocument()
    expect(install).not.toHaveBeenCalled()
  })

  it('offers the install once the download has finished', async () => {
    render(<Harness />)
    await report('downloaded')

    expect(screen.getByRole('status')).toHaveTextContent('Update ready')
    expect(screen.getByRole('button', { name: 'Install and restart' })).toBeInTheDocument()
  })

  it('installs on a press, and on nothing else', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await report('available')
    // Reading a notice is not consent, so nothing is installed by being told
    // that there is one.
    expect(install).not.toHaveBeenCalled()

    await report('downloaded')
    await user.click(screen.getByRole('button', { name: 'Install and restart' }))
    expect(install).toHaveBeenCalledTimes(1)
  })

  it('stays dismissed for the rest of the launch', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await report('available')

    await user.click(screen.getByRole('button', { name: 'Dismiss the update notice' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    // A download finishing later must not resurrect a notice the user closed.
    await report('downloaded')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('stops listening once the view that drew it is gone', () => {
    const { unmount } = render(<Harness />)
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
