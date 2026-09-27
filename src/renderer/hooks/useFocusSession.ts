import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import {
  blockSeconds,
  buildPlan,
  DEFAULT_FOCUS_MINUTES,
  DEFAULT_SETTINGS,
  type FocusSessionPlan,
  type FocusSessionSettings,
} from '../domain/focusSession'
import type { FocusSessionResult } from '../domain/productivity'
import { log } from '../lib/log'

/** Short enough that the clock never visibly lags, long enough to stay cheap. */
const TICK_MS = 1_000

/**
 * Which faces the panel shows. The session is not a timer that
 * happens to be stopped; it is a timer that does not exist until the user asks
 * for one, so `idle` and `setup` both mean "no clock is running".
 */
export type FocusSessionView = 'idle' | 'setup' | 'breakSetup' | 'session'

export interface TimerState {
  view: FocusSessionView
  plan: FocusSessionPlan
  index: number
  remainingSeconds: number
  running: boolean
  finished: boolean
  /** Epoch ms the current block ends, so the clock cannot drift. */
  endsAt: number | null
  manualBreak: boolean
  manualBreakRemaining: number
  manualBreakEndsAt: number | null
  /** Planned seconds of the current manual break, so elapsed time is derivable. */
  manualBreakPlannedSeconds: number
  /** Seconds spent focusing since the session started. Excludes pause and breaks. */
  focusSecondsAccumulated: number
  /** Seconds spent on breaks since the session started. Excludes pause. */
  breakSecondsAccumulated: number
  /** Focus blocks fully completed. Only incremented when a focus block ends. */
  focusBlocksCompleted: number
  /**
   * Seconds the user spent with the clock deliberately stopped, across the whole
   * run. This is its own accumulator and is never added to the focus one: a pause
   * is the absence of work, and a summary that called it focus would be wrong
   * about the one number this panel exists to get right.
   */
  pausedSecondsAccumulated: number
  /** Epoch ms the current pause began, or null while the clock is not stopped. */
  pausedAt: number | null
}

/**
 * What one run of the session is worth, and the only thing `Reset` is not allowed
 * to erase. These are kept beside the clock rather than inside the plan so a
 * re-arm of the clock cannot take them with it.
 */
export interface RunTotals {
  focusSeconds: number
  breakSeconds: number
  pausedSeconds: number
  focusBlocks: number
}

const NO_TOTALS: RunTotals = {
  focusSeconds: 0,
  breakSeconds: 0,
  pausedSeconds: 0,
  focusBlocks: 0,
}

export type TimerAction =
  | { type: 'open' }
  | { type: 'close'; now: number }
  | { type: 'start'; now: number }
  | { type: 'play'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'pauseTick'; now: number }
  | { type: 'skip'; now: number }
  | { type: 'reset' }
  | { type: 'dismiss' }
  | { type: 'reconfigure'; focusMinutes: number; settings: FocusSessionSettings }
  | { type: 'tick'; now: number }
  | { type: 'takeBreak'; now: number }
  | { type: 'startManualBreak'; minutes: number; now: number }
  | { type: 'endManualBreak'; now: number }
  | { type: 'tickBreak'; now: number }

/**
 * A clock that has never run, and so has earned nothing yet. `rearmed` carries
 * the previous run's totals forward: `Reset` and re-planning re-arm the clock,
 * and neither of those is the user saying "I did not do that".
 */
function fresh(
  plan: FocusSessionPlan,
  view: FocusSessionView = 'setup',
  rearmed: RunTotals = NO_TOTALS,
): TimerState {
  const first = plan.blocks[0]
  return {
    view,
    plan,
    index: 0,
    remainingSeconds: first ? blockSeconds(first) : 0,
    running: false,
    finished: false,
    endsAt: null,
    manualBreak: false,
    manualBreakRemaining: 0,
    manualBreakEndsAt: null,
    manualBreakPlannedSeconds: 0,
    focusSecondsAccumulated: rearmed.focusSeconds,
    breakSecondsAccumulated: rearmed.breakSeconds,
    focusBlocksCompleted: rearmed.focusBlocks,
    pausedSecondsAccumulated: rearmed.pausedSeconds,
    pausedAt: null,
  }
}

/** Everything this state has banked so far, in the shape `fresh` takes back. */
function totalsOf(state: TimerState): RunTotals {
  return {
    focusSeconds: state.focusSecondsAccumulated,
    breakSeconds: state.breakSecondsAccumulated,
    pausedSeconds: state.pausedSecondsAccumulated,
    focusBlocks: state.focusBlocksCompleted,
  }
}

/** Moves to one block, ready to run or paused, with the clock rescheduled. */
function enter(state: TimerState, index: number, now: number, running: boolean): TimerState {
  const previous = state.plan.blocks[state.index]
  const focusBlocksCompleted =
    previous && previous.phase === 'focus'
      ? state.focusBlocksCompleted + 1
      : state.focusBlocksCompleted
  const block = state.plan.blocks[index]
  if (!block) {
    return {
      ...state,
      running: false,
      finished: true,
      endsAt: null,
      remainingSeconds: 0,
      manualBreak: false,
      manualBreakRemaining: 0,
      manualBreakEndsAt: null,
      focusBlocksCompleted,
    }
  }
  const seconds = blockSeconds(block)
  return {
    ...state,
    index,
    remainingSeconds: seconds,
    running,
    endsAt: running ? now + seconds * 1000 : null,
    manualBreakPlannedSeconds: 0,
    focusBlocksCompleted,
  }
}

/**
 * Adds the elapsed time of the just-finished block to the right accumulator.
 *
 * `ranOut` is for the tick that found the deadline already past: that block ran
 * to its end, and measuring it from the last remaining we happened to render
 * would silently drop the time between that render and the deadline — which is
 * exactly the time a backgrounded window accumulates.
 */
function accumulateBlock(state: TimerState, ranOut = false): TimerState {
  const block = state.plan.blocks[state.index]
  if (!block) return state
  const elapsed = ranOut ? blockSeconds(block) : blockSeconds(block) - state.remainingSeconds
  if (block.phase === 'focus') {
    return { ...state, focusSecondsAccumulated: state.focusSecondsAccumulated + elapsed }
  }
  return { ...state, breakSecondsAccumulated: state.breakSecondsAccumulated + elapsed }
}

/** Adds the elapsed manual break time to the break accumulator. */
function accumulateManualBreak(state: TimerState): TimerState {
  if (!state.manualBreak) return state
  const elapsed = Math.max(0, state.manualBreakPlannedSeconds - state.manualBreakRemaining)
  return { ...state, breakSecondsAccumulated: state.breakSecondsAccumulated + elapsed }
}

/**
 * Folds an open pause into the paused accumulator and closes it. Every transition
 * that ends a stopped clock goes through here, so paused time is banked exactly
 * once no matter which control ended it.
 */
function settlePause(state: TimerState, now: number): TimerState {
  if (state.pausedAt === null) return state
  const held = Math.max(0, Math.round((now - state.pausedAt) / 1000))
  return {
    ...state,
    pausedSecondsAccumulated: state.pausedSecondsAccumulated + held,
    pausedAt: null,
  }
}

/**
 * The one transition, exported because the sequence of states is the behaviour:
 * `idle` holds a plan and no clock, `setup` is choosing, and only `start` turns a
 * clock on. `open` is a pause as well as a view change, so a session cannot run
 * itself to the end behind a panel the user is still deciding on.
 */
export function focusSessionReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'open':
      return { ...state, view: 'setup', running: false, endsAt: null }
    case 'close':
      if (state.view === 'breakSetup') {
        // Backing out of the picker resumes, and settles any pause that was
        // open before it, so the stopwatch cannot keep running in the dark.
        return {
          ...settlePause(state, action.now),
          view: 'session',
          running: true,
          endsAt: action.now + state.remainingSeconds * 1000,
        }
      }
      return { ...state, view: 'idle', running: false, endsAt: null }
    case 'start': {
      // The one moment a session begins: block one, running, nothing on screen
      // but the clock. Re-arming from the setup face keeps the run so far.
      //
      // Armed directly rather than through `enter`, because `enter` accounts for
      // the block it is *leaving* and starting has left none. Going through it
      // counted the first block as finished before it had run.
      const armed = fresh(state.plan, 'session', totalsOf(state))
      return { ...armed, running: true, endsAt: action.now + armed.remainingSeconds * 1000 }
    }
    case 'play': {
      if (state.finished) return state
      const resumed = settlePause(state, action.now)
      // A manual break has its own deadline, so resuming one reschedules the
      // break's clock. Resuming from `remainingSeconds` would restart the *focus*
      // block underneath and quietly end the break.
      if (state.manualBreak) {
        return {
          ...resumed,
          running: true,
          manualBreakEndsAt: action.now + resumed.manualBreakRemaining * 1000,
        }
      }
      return {
        ...resumed,
        running: true,
        endsAt: action.now + resumed.remainingSeconds * 1000,
      }
    }
    case 'pause': {
      // Pressing pause twice must not start a second stopwatch, or the same
      // second would be banked twice.
      if (state.pausedAt !== null) return state
      // Pause only stops the clock. It deliberately does NOT bank the time run
      // so far: `remainingSeconds` still holds it, and the block is banked once,
      // whole, when it actually ends. Banking here and again at the end is what
      // would count a paused-then-resumed block twice.
      return { ...state, running: false, endsAt: null, pausedAt: action.now }
    }
    case 'pauseTick': {
      if (state.pausedAt === null) return state
      // Banked as it goes rather than on resume, so closing the app mid-pause
      // still leaves the time the user actually spent paused in the run.
      const held = Math.max(0, Math.round((action.now - state.pausedAt) / 1000))
      return {
        ...state,
        pausedAt: action.now,
        pausedSecondsAccumulated: state.pausedSecondsAccumulated + held,
      }
    }
    case 'skip': {
      if (state.manualBreak) {
        // Skip on a manual break means "I have had enough", not "next block":
        // the break ends early and the focus block it was holding resumes.
        return {
          ...settlePause(accumulateManualBreak(state), action.now),
          manualBreak: false,
          manualBreakRemaining: 0,
          manualBreakEndsAt: null,
          running: true,
          endsAt: action.now + state.remainingSeconds * 1000,
        }
      }
      return enter(
        settlePause(accumulateBlock(state), action.now),
        state.index + 1,
        action.now,
        state.running,
      )
    }
    case 'reset':
      // Re-arms the clock and keeps what the run was worth. A finished session
      // goes back to idle for the same reason: it is over, not part-way through.
      // The block in progress is banked on the way out, so resetting ten minutes
      // into a block does not throw those ten minutes away.
      return fresh(
        state.plan,
        state.finished ? 'idle' : 'session',
        totalsOf(accumulateBlock(state)),
      )
    case 'dismiss':
      // The one place the run is forgotten: the user has read the summary and
      // said goodbye to it, so the next session starts from nothing.
      return fresh(state.plan, 'idle')
    case 'reconfigure':
      return fresh(
        buildPlan(action.focusMinutes, action.settings),
        state.view,
        totalsOf(accumulateBlock(state)),
      )
    case 'takeBreak':
      // Opening the picker ends any pause rather than continuing it behind a
      // form: the paused stopwatch belongs to a paused clock, not to a panel the
      // user is still deciding on.
      return {
        ...settlePause(accumulateBlock(state), action.now),
        view: 'breakSetup',
        running: false,
        endsAt: null,
      }
    case 'startManualBreak':
      return {
        ...state,
        view: 'session',
        manualBreak: true,
        manualBreakRemaining: action.minutes * 60,
        manualBreakEndsAt: action.now + action.minutes * 60 * 1000,
        manualBreakPlannedSeconds: action.minutes * 60,
        running: false,
        endsAt: null,
      }
    case 'endManualBreak':
      return {
        ...settlePause(accumulateManualBreak(state), action.now),
        manualBreak: false,
        manualBreakRemaining: 0,
        manualBreakEndsAt: null,
        running: true,
        endsAt: action.now + state.remainingSeconds * 1000,
      }
    case 'tickBreak': {
      if (!state.manualBreak || state.manualBreakEndsAt === null) return state
      // A paused break is frozen. The effect is gated on `pausedAt` too, so this
      // guard is what makes a tick already in flight when Pause landed harmless.
      if (state.pausedAt !== null) return state
      const remaining = Math.max(0, Math.round((state.manualBreakEndsAt - action.now) / 1000))
      if (remaining > 0) return { ...state, manualBreakRemaining: remaining }
      return {
        // Accounted as having run to zero, because it just did. Measuring the
        // expiry against the previous tick's remaining would bank a break one
        // tick short of the time it actually took.
        ...accumulateManualBreak({ ...state, manualBreakRemaining: 0 }),
        manualBreak: false,
        manualBreakRemaining: 0,
        manualBreakEndsAt: null,
        running: true,
        endsAt: action.now + state.remainingSeconds * 1000,
      }
    }
    case 'tick': {
      if (state.manualBreak) return state
      if (state.endsAt === null) return state
      const remaining = Math.max(0, Math.round((state.endsAt - action.now) / 1000))
      if (remaining > 0) return { ...state, remainingSeconds: remaining }
      return enter(accumulateBlock(state, true), state.index + 1, action.now, true)
    }
  }
}

/** The public face of the hook: the panel's state and the one way to change it. */
export interface FocusSession {
  view: FocusSessionView
  plan: FocusSessionPlan
  index: number
  remainingSeconds: number
  running: boolean
  finished: boolean
  manualBreak: boolean
  manualBreakRemaining: number
  /** Planned seconds of the current manual break, so its own ring can be drawn. */
  manualBreakPlannedSeconds: number
  /** True while the clock is deliberately stopped, focus block or manual break. */
  paused: boolean
  /** Seconds this run has spent paused, counting up while `paused` is true. */
  pausedSeconds: number
  /** What the run is worth so far, in seconds and completed focus blocks. */
  totals: RunTotals
  focusMinutes: number
  setFocusMinutes: (minutes: number) => void
  setShortBreak: (minutes: number) => void
  setLongBreak: (minutes: number) => void
  setBreaks: (breaks: boolean) => void
  openSetup: () => void
  closeSetup: () => void
  start: () => void
  toggle: () => void
  skip: () => void
  reset: () => void
  /** Forgets the run and returns to idle. The only way the totals are cleared. */
  dismiss: () => void
  takeBreak: () => void
  startManualBreak: (minutes: number) => void
  endManualBreak: () => void
  /** Called once when the session finishes, with the measured result. */
  onSessionResult?: (result: FocusSessionResult) => void
}

/** The state the app boots into: a plan the user has not asked to run yet. */
export function initialTimerState(): TimerState {
  return fresh(buildPlan(DEFAULT_FOCUS_MINUTES, DEFAULT_SETTINGS), 'idle')
}

interface UseFocusSessionOptions {
  onSessionResult?: (result: FocusSessionResult) => void
}

/**
 * The Focus Session timer, in memory only. It shares no state, no storage and no
 * reducer with the planner, so nothing here can disturb a task or a reminder,
 * and closing the app simply forgets the session.
 */
export function useFocusSession(options?: UseFocusSessionOptions): FocusSession {
  const [state, dispatch] = useReducer(focusSessionReducer, undefined, initialTimerState)
  const onSessionResult = options?.onSessionResult

  useEffect(() => {
    if (!state.running) return
    const id = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), TICK_MS)
    return () => clearInterval(id)
  }, [state.running])

  useEffect(() => {
    // Gated on the break being active and *not* paused. A manual break runs with
    // `running` false (the focus clock beneath it is held), so the break's own
    // countdown is what drives this, and a paused break must not run out behind
    // the user's back — Resume would then resume an already-expired break.
    if (!state.manualBreak || state.pausedAt !== null) return
    const id = setInterval(() => dispatch({ type: 'tickBreak', now: Date.now() }), TICK_MS)
    return () => clearInterval(id)
  }, [state.manualBreak, state.pausedAt])

  useEffect(() => {
    // The paused stopwatch. It is the one clock that runs while nothing else
    // does, and it is banked as it goes rather than on resume, so the seconds
    // the user actually spent stopped survive the app being closed.
    if (state.pausedAt === null) return
    const id = setInterval(() => dispatch({ type: 'pauseTick', now: Date.now() }), TICK_MS)
    return () => clearInterval(id)
  }, [state.pausedAt])

  const sessionResultSent = useRef(false)

  useEffect(() => {
    if (!state.finished) {
      sessionResultSent.current = false
      return
    }
    if (sessionResultSent.current) return
    sessionResultSent.current = true
    log.info('focus-session.completed', {
      focusMinutes: state.plan.focusMinutes,
      totalMinutes: state.plan.totalMinutes,
    })
    onSessionResult?.({
      focusMinutes: Math.round(state.focusSecondsAccumulated / 60),
      breakMinutes: Math.round(state.breakSecondsAccumulated / 60),
      focusBlocks: state.focusBlocksCompleted,
    })
  }, [
    state.finished,
    state.plan,
    state.focusSecondsAccumulated,
    state.breakSecondsAccumulated,
    state.focusBlocksCompleted,
    onSessionResult,
  ])

  const completionSoundPlayed = useRef(false)

  useEffect(() => {
    if (state.finished && !completionSoundPlayed.current) {
      completionSoundPlayed.current = true
      const audio = new Audio('/assets/focus-session/session-complete.mp3')
      audio.volume = 0.03
      audio.play()?.catch(() => {})
    }
    if (!state.finished) {
      completionSoundPlayed.current = false
    }
  }, [state.finished])

  const settings = useMemo<FocusSessionSettings>(
    () => ({
      shortBreakMinutes: state.plan.shortBreakMinutes,
      longBreakMinutes: state.plan.longBreakMinutes,
      breaks: state.plan.breaks,
    }),
    [state.plan],
  )

  // Re-planning always restarts the session: the blocks the user just watched
  // are no longer the blocks they are asking for.
  const reconfigure = useCallback(
    (focusMinutes: number, patch?: Partial<FocusSessionSettings>) => {
      const next = { ...settings, ...patch }
      log.info('focus-session.reconfigured', {
        focusMinutes,
        shortBreak: next.shortBreakMinutes,
        longBreak: next.longBreakMinutes,
        breaks: next.breaks ?? true,
      })
      dispatch({ type: 'reconfigure', focusMinutes, settings: next })
    },
    [settings],
  )

  const setFocusMinutes = useCallback((minutes: number) => reconfigure(minutes), [reconfigure])

  const setShortBreak = useCallback(
    (minutes: number) => reconfigure(state.plan.focusMinutes, { shortBreakMinutes: minutes }),
    [reconfigure, state.plan.focusMinutes],
  )

  const setLongBreak = useCallback(
    (minutes: number) => reconfigure(state.plan.focusMinutes, { longBreakMinutes: minutes }),
    [reconfigure, state.plan.focusMinutes],
  )

  const setBreaks = useCallback(
    (breaks: boolean) => reconfigure(state.plan.focusMinutes, { breaks }),
    [reconfigure, state.plan.focusMinutes],
  )

  const openSetup = useCallback(() => {
    log.info('focus-session.setup.opened')
    dispatch({ type: 'open' })
  }, [])

  const closeSetup = useCallback(() => {
    log.info('focus-session.setup.closed')
    dispatch({ type: 'close', now: Date.now() })
  }, [])

  const start = useCallback(() => {
    log.info('focus-session.started', {
      focusMinutes: state.plan.focusMinutes,
      blocks: state.plan.blocks.length,
    })
    dispatch({ type: 'start', now: Date.now() })
  }, [state.plan])

  const toggle = useCallback(() => {
    // Dispatch off the *paused* flag, not `running`. A manual break counts down
    // with `running` false, so keying off `running` would make the button read
    // "Resume" for the whole break and pressing it could never pause one.
    const resuming = state.pausedAt !== null
    log.info(resuming ? 'focus-session.resumed' : 'focus-session.paused', {
      index: state.index + 1,
      manualBreak: state.manualBreak,
    })
    dispatch({ type: resuming ? 'play' : 'pause', now: Date.now() })
  }, [state.index, state.manualBreak, state.pausedAt])

  const skip = useCallback(() => {
    log.info('focus-session.skipped', { index: state.index + 1 })
    dispatch({ type: 'skip', now: Date.now() })
  }, [state.index])

  const reset = useCallback(() => {
    log.info('focus-session.reset')
    dispatch({ type: 'reset' })
  }, [])

  const dismiss = useCallback(() => {
    log.info('focus-session.dismissed')
    dispatch({ type: 'dismiss' })
  }, [])

  const takeBreak = useCallback(() => {
    log.info('focus-session.break.taken')
    dispatch({ type: 'takeBreak', now: Date.now() })
  }, [])

  const startManualBreak = useCallback((minutes: number) => {
    log.info('focus-session.break.started', { minutes })
    dispatch({ type: 'startManualBreak', minutes, now: Date.now() })
  }, [])

  const endManualBreak = useCallback(() => {
    log.info('focus-session.break.ended')
    dispatch({ type: 'endManualBreak', now: Date.now() })
  }, [])

  return {
    view: state.view,
    plan: state.plan,
    index: state.index,
    remainingSeconds: state.remainingSeconds,
    running: state.running,
    finished: state.finished,
    manualBreak: state.manualBreak,
    manualBreakRemaining: state.manualBreakRemaining,
    manualBreakPlannedSeconds: state.manualBreakPlannedSeconds,
    paused: state.pausedAt !== null,
    pausedSeconds: state.pausedSecondsAccumulated,
    totals: {
      focusSeconds: state.focusSecondsAccumulated,
      breakSeconds: state.breakSecondsAccumulated,
      pausedSeconds: state.pausedSecondsAccumulated,
      focusBlocks: state.focusBlocksCompleted,
    },
    focusMinutes: state.plan.focusMinutes,
    setFocusMinutes,
    setShortBreak,
    setLongBreak,
    setBreaks,
    openSetup,
    closeSetup,
    start,
    toggle,
    skip,
    reset,
    dismiss,
    takeBreak,
    startManualBreak,
    endManualBreak,
    onSessionResult,
  }
}
