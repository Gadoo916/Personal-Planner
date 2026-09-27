import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FOCUS_SESSION_GIFS } from '../domain/focusSession'
import { useFocusSession } from '../hooks/useFocusSession'
import { FocusSessionTimer } from './FocusSessionTimer'

/**
 * The panel is a renderer: `App` owns the clock and hands it down, so a test that
 * wants to drive a real session needs something to own it too.
 */
function Harness() {
  const timer = useFocusSession()
  return <FocusSessionTimer timer={timer} />
}

function renderTimer() {
  return render(<Harness />)
}

describe('FocusSessionTimer GIF integrations', () => {
  it('displays the idle GIF when the timer is idle', () => {
    renderTimer()
    const img = screen.getByAltText('Idle cat animation')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', FOCUS_SESSION_GIFS.idle)
  })

  it('switches to focus GIF inside the ring when the session starts', async () => {
    const user = userEvent.setup()
    renderTimer()

    // Open setup
    await user.click(screen.getByRole('button', { name: /focus/i }))
    // Start session
    await user.click(screen.getByRole('button', { name: /start/i }))

    const img = screen.getByAltText('Focus cat animation')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', FOCUS_SESSION_GIFS.focus)
    expect(img).toHaveClass('focus-session__animation--ring')
  })

  it('switches to break GIF inside the ring when advancing from focus to break phase', async () => {
    const user = userEvent.setup()
    renderTimer()

    await user.click(screen.getByRole('button', { name: /focus/i }))
    await user.click(screen.getByRole('button', { name: /start/i }))

    // Skip the first focus block to enter the break phase
    await user.click(screen.getByRole('button', { name: /skip/i }))

    const img = screen.getByAltText('Break cat animation')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', FOCUS_SESSION_GIFS.break)
    expect(img).toHaveClass('focus-session__animation--ring')
  })

  it('switches back to focus GIF when advancing from break phase to next focus block', async () => {
    const user = userEvent.setup()
    renderTimer()

    await user.click(screen.getByRole('button', { name: /focus/i }))
    await user.click(screen.getByRole('button', { name: /start/i }))

    // Skip to break
    await user.click(screen.getByRole('button', { name: /skip/i }))
    expect(screen.getByAltText('Break cat animation')).toHaveAttribute(
      'src',
      FOCUS_SESSION_GIFS.break,
    )

    // Skip break to next focus
    await user.click(screen.getByRole('button', { name: /skip/i }))
    expect(screen.getByAltText('Focus cat animation')).toHaveAttribute(
      'src',
      FOCUS_SESSION_GIFS.focus,
    )
  })

  it('shows the session summary with complete GIF, and Done returns to idle', async () => {
    const user = userEvent.setup()
    renderTimer()

    await user.click(screen.getByRole('button', { name: /focus/i }))
    // The default session is 120m (5 focus blocks + 4 breaks = 9 blocks)
    await user.click(screen.getByRole('button', { name: /start/i }))

    // Skip all 9 blocks
    for (let i = 0; i < 9; i++) {
      await user.click(screen.getByRole('button', { name: /skip/i }))
    }

    // The complete face is a summary, and it is not a dialog.
    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument()
    const card = document.querySelector('.focus-session__summary-card')
    expect(card).not.toBeNull()
    expect(card).toHaveTextContent('Focused')
    expect(card).toHaveTextContent('On break')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('5 focus blocks completed')).toBeInTheDocument()
    const completeImg = screen.getByAltText('Session complete celebration animation')
    expect(completeImg).toBeInTheDocument()
    expect(completeImg).toHaveAttribute('src', FOCUS_SESSION_GIFS.complete)

    // Done is the single way past the summary, and it forgets the run.
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByRole('heading', { name: 'Focus Session' })).toBeInTheDocument()
    const idleImg = screen.getByAltText('Idle cat animation')
    expect(idleImg).toBeInTheDocument()
    expect(idleImg).toHaveAttribute('src', FOCUS_SESSION_GIFS.idle)
  })

  it('colours a manual break as a break, not as the focus block it borrowed', async () => {
    const user = userEvent.setup()
    renderTimer()

    await user.click(screen.getByRole('button', { name: /focus/i }))
    await user.click(screen.getByRole('button', { name: /start/i }))
    await user.click(screen.getByRole('button', { name: 'Take a Break' }))
    await user.click(screen.getByRole('button', { name: /start break/i }))

    // The clock is on a break while the focus block underneath is untouched, so
    // both the label and the arc must read the break modifier.
    expect(screen.getByText('Break')).toHaveClass('focus-session__phase--break')
    expect(document.querySelector('.focus-session__ring-arc--break')).not.toBeNull()
    expect(document.querySelector('.focus-session__ring-arc--focus')).toBeNull()
  })
})

describe('FocusSessionTimer manual break controls', () => {
  /** Starts a session and borrows the face for a manual break. */
  async function startManualBreak(user: ReturnType<typeof userEvent.setup>) {
    renderTimer()
    await user.click(screen.getByRole('button', { name: /focus/i }))
    await user.click(screen.getByRole('button', { name: /start/i }))
    await user.click(screen.getByRole('button', { name: 'Take a Break' }))
    await user.click(screen.getByRole('button', { name: /start break/i }))
  }

  it('leaves Pause and Skip live on a manual break', async () => {
    const user = userEvent.setup()
    await startManualBreak(user)

    // A control that goes dead on the face the user is looking at reads as a
    // broken panel, and pausing and ending a break early are both real acts.
    expect(screen.getByRole('button', { name: 'Pause session' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Skip this block' })).toBeEnabled()
  })

  it('pauses a manual break, showing the resume control and the paused counter', async () => {
    const user = userEvent.setup()
    await startManualBreak(user)

    await user.click(screen.getByRole('button', { name: 'Pause session' }))

    // The break is frozen, so the control offers to resume it, and the paused
    // stopwatch is on screen counting up from zero.
    expect(screen.getByRole('button', { name: 'Resume session' })).toBeEnabled()
    expect(screen.getByText(/^Paused for /)).toBeInTheDocument()
    expect(screen.getByText('Break')).toHaveClass('focus-session__phase--break')
  })

  it('skips a manual break and returns to the focus block', async () => {
    const user = userEvent.setup()
    await startManualBreak(user)

    await user.click(screen.getByRole('button', { name: 'Skip this block' }))

    // Back on focus, so the phase and the controls read focus again.
    expect(screen.getByText('Focus')).toHaveClass('focus-session__phase--focus')
    expect(screen.getByRole('button', { name: 'Pause session' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Take a Break' })).toBeEnabled()
  })
})

describe('FocusSessionTimer paused time', () => {
  it('shows the paused counter while paused, and hides it once running again', async () => {
    const user = userEvent.setup()
    renderTimer()
    await user.click(screen.getByRole('button', { name: /focus/i }))
    await user.click(screen.getByRole('button', { name: /start/i }))

    // Nothing is paused yet, so there is no counter to show.
    expect(screen.queryByText(/^Paused for /)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Pause session' }))
    expect(screen.getByText(/^Paused for /)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resume session' }))
    expect(screen.queryByText(/^Paused for /)).toBeNull()
  })

  it('reports paused time as its own figure, never inside the focus figure', async () => {
    const user = userEvent.setup()
    renderTimer()
    await user.click(screen.getByRole('button', { name: /focus/i }))
    await user.click(screen.getByRole('button', { name: /start/i }))

    // Pause once so there is paused time to report, then skip every block.
    await user.click(screen.getByRole('button', { name: 'Pause session' }))
    await user.click(screen.getByRole('button', { name: 'Resume session' }))
    for (let i = 0; i < 9; i++) {
      await user.click(screen.getByRole('button', { name: /skip/i }))
    }

    const card = document.querySelector('.focus-session__summary-card')
    expect(card).toHaveTextContent('Focused')
    expect(card).toHaveTextContent('On break')
    expect(card).toHaveTextContent('Paused')
  })
})
