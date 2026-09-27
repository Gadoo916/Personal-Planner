import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPlan, DEFAULT_FOCUS_MINUTES, DEFAULT_SETTINGS } from '../domain/focusSession'
import {
  focusSessionReducer,
  initialTimerState,
  type TimerState,
  useFocusSession,
} from './useFocusSession'

/**
 * The panel's state machine, tested without React. A clock is the one component
 * where "what happens between the clicks" is the behaviour, and the domain tests
 * already cover the plan; what is left is the sequence of states, which is
 * cheaper and sharper to assert as a pure function than through the DOM.
 */

const NOW = 1_000_000

/** A fresh idle panel, the state the app boots into. */
function idle(): TimerState {
  return initialTimerState()
}

/** A running default session, started at `NOW`. */
function running(): TimerState {
  return focusSessionReducer(idle(), { type: 'start', now: NOW })
}

/** A manual break of `minutes`, opened over a 25 minute focus block it holds. */
function breaking(minutes = 15): TimerState {
  const noBreaks = focusSessionReducer(idle(), {
    type: 'reconfigure',
    focusMinutes: 25,
    settings: { ...DEFAULT_SETTINGS, breaks: false },
  })
  const started = focusSessionReducer(noBreaks, { type: 'start', now: NOW })
  const picker = focusSessionReducer(started, { type: 'takeBreak', now: NOW })
  return focusSessionReducer(picker, { type: 'startManualBreak', minutes, now: NOW })
}

describe('focus session state machine', () => {
  it('boots idle, with a plan but no clock and no deadline', () => {
    const state = idle()
    expect(state.view).toBe('idle')
    expect(state.running).toBe(false)
    expect(state.endsAt).toBeNull()
    expect(state.remainingSeconds).toBeGreaterThan(0)
  })

  it('begins the session at Start, not at Focus', () => {
    const opened = focusSessionReducer(idle(), { type: 'open' })
    expect(opened.view).toBe('setup')
    expect(opened.running).toBe(false)
    expect(opened.endsAt).toBeNull()

    const started = focusSessionReducer(opened, { type: 'start', now: NOW })
    expect(started.view).toBe('session')
    expect(started.running).toBe(true)
    expect(started.index).toBe(0)
    expect(started.endsAt).toBe(NOW + 25 * 60 * 1000)
  })

  it('stops the clock when the setup opens, so choosing is not running a session', () => {
    const reconfigured = focusSessionReducer(running(), { type: 'open' })

    expect(reconfigured.view).toBe('setup')
    expect(reconfigured.running).toBe(false)
    expect(reconfigured.endsAt).toBeNull()

    // With no deadline there is no tick to consume, so an hour cannot pass.
    const later = focusSessionReducer(reconfigured, { type: 'tick', now: NOW + 60 * 60 * 1000 })
    expect(later.index).toBe(0)
    expect(later.finished).toBe(false)
  })

  it('keeps the plan when the setup is closed, so returning does not lose it', () => {
    const withThreeHours = focusSessionReducer(idle(), {
      type: 'reconfigure',
      focusMinutes: 180,
      settings: DEFAULT_SETTINGS,
    })
    expect(withThreeHours.plan.focusMinutes).toBe(180)

    const cancelled = focusSessionReducer(withThreeHours, { type: 'close', now: NOW })
    expect(cancelled.view).toBe('idle')
    expect(cancelled.plan.focusMinutes).toBe(180)
  })

  it('re-plans from block one, paused, so a change is visible immediately', () => {
    const skipped = focusSessionReducer(running(), { type: 'skip', now: NOW })
    expect(skipped.index).toBe(1)

    const changed = focusSessionReducer(skipped, {
      type: 'reconfigure',
      focusMinutes: DEFAULT_FOCUS_MINUTES + 5,
      settings: DEFAULT_SETTINGS,
    })
    expect(changed.index).toBe(0)
    expect(changed.running).toBe(false)
    expect(changed.endsAt).toBeNull()
    expect(changed.plan.focusMinutes).toBe(DEFAULT_FOCUS_MINUTES + 5)
  })

  it('counts down from an absolute deadline rather than by decrementing', () => {
    const started = running()

    expect(focusSessionReducer(started, { type: 'tick', now: NOW + 60_000 }).remainingSeconds).toBe(
      24 * 60,
    )

    // A late frame cannot stretch the block: the deadline is absolute.
    expect(focusSessionReducer(started, { type: 'tick', now: NOW + 90_000 }).remainingSeconds).toBe(
      23 * 60 + 30,
    )
  })

  it('moves to the break by itself when a block runs out', () => {
    const elapsed = focusSessionReducer(running(), { type: 'tick', now: NOW + 25 * 60 * 1000 })

    expect(elapsed.index).toBe(1)
    expect(elapsed.plan.blocks[1]?.phase).toBe('break')
    expect(elapsed.plan.blocks[1]?.long).toBe(false)
    expect(elapsed.running).toBe(true)
  })

  it('cannot be resumed once the whole session is over', () => {
    const plan = buildPlan(DEFAULT_FOCUS_MINUTES, DEFAULT_SETTINGS)
    let state = running()
    for (let block = 0; block < plan.blocks.length; block += 1) {
      state = focusSessionReducer(state, { type: 'skip', now: NOW })
    }

    expect(state.finished).toBe(true)
    expect(state.running).toBe(false)
    expect(focusSessionReducer(state, { type: 'play', now: NOW }).finished).toBe(true)
  })

  it('resets to the first block, paused and visible', () => {
    const reset = focusSessionReducer(focusSessionReducer(running(), { type: 'skip', now: NOW }), {
      type: 'reset',
    })

    expect(reset.index).toBe(0)
    expect(reset.view).toBe('session')
    expect(reset.running).toBe(false)
    expect(reset.endsAt).toBeNull()
  })

  it('runs as one continuous block, never into a break, when Breaks is off', () => {
    const noBreaks = focusSessionReducer(idle(), {
      type: 'reconfigure',
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      settings: { ...DEFAULT_SETTINGS, breaks: false },
    })
    expect(noBreaks.plan.blocks).toHaveLength(1)
    expect(noBreaks.plan.blocks[0]?.phase).toBe('focus')

    const started = focusSessionReducer(noBreaks, { type: 'start', now: NOW })
    const elapsed = focusSessionReducer(started, { type: 'tick', now: NOW + 25 * 60 * 1000 })

    expect(elapsed.index).toBe(0)
    expect(elapsed.plan.blocks[0]?.phase).toBe('focus')
    expect(elapsed.running).toBe(true)
    expect(elapsed.remainingSeconds).toBe(5700)
  })

  it('ends the session on the last focus block when Breaks is off', () => {
    const noBreaks = focusSessionReducer(idle(), {
      type: 'reconfigure',
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      settings: { ...DEFAULT_SETTINGS, breaks: false },
    })
    let state = focusSessionReducer(noBreaks, { type: 'start', now: NOW })
    for (let block = 0; block < noBreaks.plan.blocks.length; block += 1) {
      state = focusSessionReducer(state, { type: 'skip', now: NOW })
    }

    expect(state.finished).toBe(true)
    expect(state.running).toBe(false)
  })

  it('restores the break blocks when Breaks is turned back on', () => {
    const offline = focusSessionReducer(idle(), {
      type: 'reconfigure',
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      settings: { ...DEFAULT_SETTINGS, breaks: false },
    })
    const online = focusSessionReducer(offline, {
      type: 'reconfigure',
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      settings: { ...DEFAULT_SETTINGS, breaks: true },
    })

    expect(online.plan.breaks).toBe(true)
    expect(online.plan.blocks[1]?.phase).toBe('break')
    expect(online.plan.totalMinutes).toBe(150)
  })

  it('opens the break duration picker on takeBreak', () => {
    const noBreaks = focusSessionReducer(idle(), {
      type: 'reconfigure',
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      settings: { ...DEFAULT_SETTINGS, breaks: false },
    })
    const started = focusSessionReducer(noBreaks, { type: 'start', now: NOW })
    const paused = focusSessionReducer(started, { type: 'takeBreak', now: NOW })

    expect(paused.view).toBe('breakSetup')
    expect(paused.running).toBe(false)
    expect(paused.endsAt).toBeNull()
    expect(paused.remainingSeconds).toBe(7200)
  })

  it('resumes focus when the break duration picker is cancelled', () => {
    const noBreaks = focusSessionReducer(idle(), {
      type: 'reconfigure',
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      settings: { ...DEFAULT_SETTINGS, breaks: false },
    })
    const started = focusSessionReducer(noBreaks, { type: 'start', now: NOW })
    const picker = focusSessionReducer(started, { type: 'takeBreak', now: NOW })
    const resumed = focusSessionReducer(picker, { type: 'close', now: NOW })

    expect(resumed.view).toBe('session')
    expect(resumed.running).toBe(true)
    expect(resumed.remainingSeconds).toBe(7200)
  })

  it('starts a manual break with the chosen duration', () => {
    const noBreaks = focusSessionReducer(idle(), {
      type: 'reconfigure',
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      settings: { ...DEFAULT_SETTINGS, breaks: false },
    })
    const started = focusSessionReducer(noBreaks, { type: 'start', now: NOW })
    const picker = focusSessionReducer(started, { type: 'takeBreak', now: NOW })
    const breaking = focusSessionReducer(picker, {
      type: 'startManualBreak',
      minutes: 15,
      now: NOW,
    })

    expect(breaking.manualBreak).toBe(true)
    expect(breaking.manualBreakRemaining).toBe(900)
    expect(breaking.running).toBe(false)
    expect(breaking.endsAt).toBeNull()
    expect(breaking.remainingSeconds).toBe(7200)
  })

  it('does not deduct break time from the focus timer', () => {
    const noBreaks = focusSessionReducer(idle(), {
      type: 'reconfigure',
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      settings: { ...DEFAULT_SETTINGS, breaks: false },
    })
    const started = focusSessionReducer(noBreaks, { type: 'start', now: NOW })
    const picker = focusSessionReducer(started, { type: 'takeBreak', now: NOW })
    const breaking = focusSessionReducer(picker, {
      type: 'startManualBreak',
      minutes: 15,
      now: NOW,
    })
    const ticked = focusSessionReducer(breaking, { type: 'tickBreak', now: NOW + 60 * 1000 })

    expect(ticked.manualBreakRemaining).toBe(840)
    expect(ticked.remainingSeconds).toBe(7200)
  })

  it('resumes focus from the same point when the break ends', () => {
    const noBreaks = focusSessionReducer(idle(), {
      type: 'reconfigure',
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      settings: { ...DEFAULT_SETTINGS, breaks: false },
    })
    const started = focusSessionReducer(noBreaks, { type: 'start', now: NOW })
    const picker = focusSessionReducer(started, { type: 'takeBreak', now: NOW })
    const breaking = focusSessionReducer(picker, { type: 'startManualBreak', minutes: 5, now: NOW })
    const ended = focusSessionReducer(breaking, { type: 'tickBreak', now: NOW + 5 * 60 * 1000 })

    expect(ended.manualBreak).toBe(false)
    expect(ended.manualBreakRemaining).toBe(0)
    expect(ended.running).toBe(true)
    expect(ended.remainingSeconds).toBe(7200)
  })

  it('skips the break and resumes focus immediately', () => {
    const noBreaks = focusSessionReducer(idle(), {
      type: 'reconfigure',
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      settings: { ...DEFAULT_SETTINGS, breaks: false },
    })
    const started = focusSessionReducer(noBreaks, { type: 'start', now: NOW })
    const picker = focusSessionReducer(started, { type: 'takeBreak', now: NOW })
    const breaking = focusSessionReducer(picker, {
      type: 'startManualBreak',
      minutes: 30,
      now: NOW,
    })
    const skipped = focusSessionReducer(breaking, { type: 'skip', now: NOW })

    expect(skipped.manualBreak).toBe(false)
    expect(skipped.running).toBe(true)
    expect(skipped.remainingSeconds).toBe(7200)
  })

  it('resets to idle from a manual break', () => {
    const noBreaks = focusSessionReducer(idle(), {
      type: 'reconfigure',
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      settings: { ...DEFAULT_SETTINGS, breaks: false },
    })
    const started = focusSessionReducer(noBreaks, { type: 'start', now: NOW })
    const picker = focusSessionReducer(started, { type: 'takeBreak', now: NOW })
    const breaking = focusSessionReducer(picker, {
      type: 'startManualBreak',
      minutes: 15,
      now: NOW,
    })
    const reset = focusSessionReducer(breaking, { type: 'reset' })

    expect(reset.manualBreak).toBe(false)
    expect(reset.manualBreakRemaining).toBe(0)
    expect(reset.running).toBe(false)
    expect(reset.view).toBe('session')
  })

  describe('run totals', () => {
    /** A session that has banked one focus block and one break. */
    function spent(): TimerState {
      const breaking = focusSessionReducer(running(), { type: 'skip', now: NOW })
      return focusSessionReducer(breaking, {
        type: 'startManualBreak',
        minutes: 15,
        now: NOW,
      })
    }

    it('counts a focus block only once it has actually been left', () => {
      expect(running().focusBlocksCompleted).toBe(0)
      expect(focusSessionReducer(running(), { type: 'skip', now: NOW }).focusBlocksCompleted).toBe(
        1,
      )
    })

    it('counts the focus time a block was actually run for', () => {
      const tenIn = focusSessionReducer(running(), { type: 'tick', now: NOW + 10 * 60 * 1000 })
      expect(tenIn.focusSecondsAccumulated).toBe(0)

      const finished = focusSessionReducer(tenIn, { type: 'tick', now: NOW + 25 * 60 * 1000 })
      expect(finished.focusSecondsAccumulated).toBe(25 * 60)
    })

    it('keeps the run through a reset, because resetting the clock is not ending it', () => {
      const before = spent()
      const reset = focusSessionReducer(before, { type: 'reset' })

      expect(reset.index).toBe(0)
      expect(reset.view).toBe('session')
      expect(reset.focusBlocksCompleted).toBe(before.focusBlocksCompleted)
      expect(reset.focusSecondsAccumulated).toBe(before.focusSecondsAccumulated)
    })

    it('keeps the run through re-planning', () => {
      const before = spent()
      const replanned = focusSessionReducer(before, {
        type: 'reconfigure',
        focusMinutes: 30,
        settings: DEFAULT_SETTINGS,
      })

      expect(replanned.plan.focusMinutes).toBe(30)
      expect(replanned.focusBlocksCompleted).toBe(before.focusBlocksCompleted)
    })

    it('forgets the run on dismiss, and returns to idle', () => {
      const dismissed = focusSessionReducer(spent(), { type: 'dismiss' })

      expect(dismissed.view).toBe('idle')
      expect(dismissed.finished).toBe(false)
      expect(dismissed.focusSecondsAccumulated).toBe(0)
      expect(dismissed.breakSecondsAccumulated).toBe(0)
      expect(dismissed.focusBlocksCompleted).toBe(0)
    })

    it('forgets paused time on dismiss too, because it is part of the same run', () => {
      const paused = focusSessionReducer(running(), { type: 'pause', now: NOW })
      const stopped = focusSessionReducer(paused, { type: 'pauseTick', now: NOW + 2 * 60 * 1000 })
      const dismissed = focusSessionReducer(stopped, { type: 'dismiss' })

      expect(stopped.pausedSecondsAccumulated).toBe(2 * 60)
      expect(dismissed.pausedSecondsAccumulated).toBe(0)
    })
  })

  describe('paused time', () => {
    it('freezes the clock on pause, and resumes it on the same second', () => {
      const tenIn = focusSessionReducer(running(), { type: 'tick', now: NOW + 10 * 60 * 1000 })
      const paused = focusSessionReducer(tenIn, { type: 'pause', now: NOW + 10 * 60 * 1000 })

      expect(paused.running).toBe(false)
      expect(paused.endsAt).toBeNull()
      expect(paused.pausedAt).toBe(NOW + 10 * 60 * 1000)

      // Half an hour of wall clock cannot move a clock that is not running.
      const later = focusSessionReducer(paused, { type: 'tick', now: NOW + 40 * 60 * 1000 })
      expect(later.remainingSeconds).toBe(15 * 60)

      const resumed = focusSessionReducer(paused, { type: 'play', now: NOW + 40 * 60 * 1000 })
      expect(resumed.remainingSeconds).toBe(15 * 60)
      expect(resumed.endsAt).toBe(NOW + 40 * 60 * 1000 + 15 * 60 * 1000)
      expect(resumed.pausedAt).toBeNull()
    })

    it('counts paused time in its own column, and never as focus', () => {
      const tenIn = focusSessionReducer(running(), { type: 'tick', now: NOW + 10 * 60 * 1000 })
      const paused = focusSessionReducer(tenIn, { type: 'pause', now: NOW + 10 * 60 * 1000 })
      const oneMinute = focusSessionReducer(paused, {
        type: 'pauseTick',
        now: NOW + 11 * 60 * 1000,
      })
      const twoMinutes = focusSessionReducer(oneMinute, {
        type: 'pauseTick',
        now: NOW + 12 * 60 * 1000,
      })

      expect(twoMinutes.pausedSecondsAccumulated).toBe(120)
      expect(twoMinutes.focusSecondsAccumulated).toBe(0)
    })

    it('does not count the same second twice when a pause is settled on resume', () => {
      const paused = focusSessionReducer(running(), { type: 'pause', now: NOW })
      const ticked = focusSessionReducer(paused, { type: 'pauseTick', now: NOW + 2 * 60 * 1000 })
      // Two minutes were banked as they went, so the minute between the last tick
      // and Resume is the only part left to settle, not all three minutes again.
      const resumed = focusSessionReducer(ticked, { type: 'play', now: NOW + 3 * 60 * 1000 })

      expect(resumed.pausedSecondsAccumulated).toBe(3 * 60)
    })

    it('ignores a second pause, so one stopwatch cannot be started twice', () => {
      const paused = focusSessionReducer(running(), { type: 'pause', now: NOW })
      const again = focusSessionReducer(paused, { type: 'pause', now: NOW + 60 * 1000 })

      expect(again.pausedAt).toBe(NOW)
    })

    it('banks a focus block by its own length, not by the wall clock it sat through', () => {
      const tenIn = focusSessionReducer(running(), { type: 'tick', now: NOW + 10 * 60 * 1000 })
      const paused = focusSessionReducer(tenIn, { type: 'pause', now: NOW + 10 * 60 * 1000 })
      const stopped = focusSessionReducer(paused, { type: 'pauseTick', now: NOW + 15 * 60 * 1000 })
      const resumed = focusSessionReducer(stopped, { type: 'play', now: NOW + 15 * 60 * 1000 })
      const finished = focusSessionReducer(resumed, { type: 'tick', now: NOW + 30 * 60 * 1000 })

      // Twenty five minutes of focus with a five minute pause inside it: the
      // focus figure is 25 minutes, and the pause is 5 of its own beside it.
      expect(finished.focusSecondsAccumulated).toBe(25 * 60)
      expect(finished.pausedSecondsAccumulated).toBe(5 * 60)
    })

    it('keeps paused time through a reset, like focus and break time', () => {
      const paused = focusSessionReducer(running(), { type: 'pause', now: NOW })
      const stopped = focusSessionReducer(paused, { type: 'pauseTick', now: NOW + 2 * 60 * 1000 })
      const reset = focusSessionReducer(stopped, { type: 'reset' })

      expect(reset.pausedSecondsAccumulated).toBe(2 * 60)
    })

    it('never sends paused time to the finished session result', () => {
      const paused = focusSessionReducer(running(), { type: 'pause', now: NOW })
      const stopped = focusSessionReducer(paused, { type: 'pauseTick', now: NOW + 2 * 60 * 1000 })
      const rearmed = focusSessionReducer(stopped, { type: 'reset' })
      const started = focusSessionReducer(rearmed, { type: 'start', now: NOW + 3 * 60 * 1000 })

      // The result the app records is measured in focus, break and blocks, so a
      // pause is not something a session can be credited with.
      expect(started.pausedSecondsAccumulated).toBe(2 * 60)
    })
  })

  describe('pausing and skipping a manual break', () => {
    it('freezes a manual break on pause, and leaves the focus block alone', () => {
      const paused = focusSessionReducer(breaking(), { type: 'pause', now: NOW })
      expect(paused.pausedAt).toBe(NOW)

      // Ten minutes of break time pass and the break does not move, because it
      // is not running. The focus block underneath did not move either.
      const later = focusSessionReducer(paused, { type: 'tickBreak', now: NOW + 10 * 60 * 1000 })
      expect(later.manualBreakRemaining).toBe(15 * 60)
      expect(later.remainingSeconds).toBe(25 * 60)
    })

    it('resumes a paused break on the second it left, not the second it started', () => {
      const paused = focusSessionReducer(breaking(), { type: 'pause', now: NOW })
      const ticked = focusSessionReducer(paused, { type: 'pauseTick', now: NOW + 10 * 60 * 1000 })
      const resumed = focusSessionReducer(ticked, { type: 'play', now: NOW + 10 * 60 * 1000 })

      expect(resumed.manualBreak).toBe(true)
      expect(resumed.manualBreakRemaining).toBe(15 * 60)
      expect(resumed.manualBreakEndsAt).toBe(NOW + 10 * 60 * 1000 + 15 * 60 * 1000)
      expect(resumed.remainingSeconds).toBe(25 * 60)
    })

    it('banks a resumed break for its full length, and never as focus', () => {
      const paused = focusSessionReducer(breaking(), { type: 'pause', now: NOW })
      const ticked = focusSessionReducer(paused, { type: 'pauseTick', now: NOW + 10 * 60 * 1000 })
      const resumed = focusSessionReducer(ticked, { type: 'play', now: NOW + 10 * 60 * 1000 })
      const ended = focusSessionReducer(resumed, {
        type: 'tickBreak',
        now: NOW + 10 * 60 * 1000 + 15 * 60 * 1000,
      })

      expect(ended.manualBreak).toBe(false)
      expect(ended.breakSecondsAccumulated).toBe(15 * 60)
      expect(ended.focusSecondsAccumulated).toBe(0)
      expect(ended.running).toBe(true)
      expect(ended.remainingSeconds).toBe(25 * 60)
    })

    it('skips a manual break, ending it early and resuming the focus block', () => {
      const skipped = focusSessionReducer(breaking(30), { type: 'skip', now: NOW })

      expect(skipped.manualBreak).toBe(false)
      expect(skipped.manualBreakRemaining).toBe(0)
      expect(skipped.running).toBe(true)
      expect(skipped.remainingSeconds).toBe(25 * 60)
      expect(skipped.focusSecondsAccumulated).toBe(0)
    })

    it('skips a paused manual break, and settles the pause on the way out', () => {
      const paused = focusSessionReducer(breaking(30), { type: 'pause', now: NOW })
      const ticked = focusSessionReducer(paused, { type: 'pauseTick', now: NOW + 4 * 60 * 1000 })
      const skipped = focusSessionReducer(ticked, { type: 'skip', now: NOW + 4 * 60 * 1000 })

      expect(skipped.manualBreak).toBe(false)
      expect(skipped.running).toBe(true)
      expect(skipped.pausedAt).toBeNull()
      // Four minutes were banked as they went, and nothing was left to settle.
      expect(skipped.pausedSecondsAccumulated).toBe(4 * 60)
      expect(skipped.remainingSeconds).toBe(25 * 60)
    })

    it('banks only the part of a skipped break that was actually spent', () => {
      const running20 = focusSessionReducer(breaking(20), {
        type: 'tickBreak',
        now: NOW + 5 * 60 * 1000,
      })
      const skipped = focusSessionReducer(running20, { type: 'skip', now: NOW + 5 * 60 * 1000 })

      expect(skipped.breakSecondsAccumulated).toBe(5 * 60)
    })
  })
})

class MockAudio {
  static instances: MockAudio[] = []
  src: string
  play = vi.fn().mockResolvedValue(undefined)
  constructor(src: string) {
    this.src = src
    MockAudio.instances.push(this)
  }
}

describe('focus session completion sound', () => {
  beforeEach(() => {
    MockAudio.instances = []
    vi.stubGlobal('Audio', MockAudio)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('plays the completion sound once when the session finishes', () => {
    const { result } = renderHook(() => useFocusSession())

    act(() => {
      result.current.setFocusMinutes(25)
    })
    act(() => {
      result.current.start()
    })
    act(() => {
      result.current.skip()
    })

    expect(result.current.finished).toBe(true)
    expect(MockAudio.instances).toHaveLength(1)
    const playMock = MockAudio.instances[0]!.play
    expect(playMock).toHaveBeenCalledTimes(1)
  })

  it('does not replay the sound on re-render after completion', () => {
    const { result, rerender } = renderHook(() => useFocusSession())

    act(() => {
      result.current.setFocusMinutes(25)
    })
    act(() => {
      result.current.start()
    })
    act(() => {
      result.current.skip()
    })

    const playMock = MockAudio.instances[0]!.play
    expect(playMock).toHaveBeenCalledTimes(1)

    rerender()
    expect(playMock).toHaveBeenCalledTimes(1)
  })

  it('does not play the sound when pausing', () => {
    const { result } = renderHook(() => useFocusSession())

    act(() => {
      result.current.setFocusMinutes(25)
    })
    act(() => {
      result.current.start()
    })
    act(() => {
      result.current.toggle()
    })

    expect(result.current.finished).toBe(false)
    expect(MockAudio.instances).toHaveLength(0)
  })

  it('does not play the sound when resetting', () => {
    const { result } = renderHook(() => useFocusSession())

    act(() => {
      result.current.setFocusMinutes(25)
    })
    act(() => {
      result.current.start()
    })
    act(() => {
      result.current.reset()
    })

    expect(result.current.finished).toBe(false)
    expect(MockAudio.instances).toHaveLength(0)
  })
})
