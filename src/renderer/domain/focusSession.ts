/**
 * Focus Session planning. Pure data in, pure data out: no React, no timers, no IO,
 * so the whole session shape is provable in a unit test.
 *
 * The model the user picked: a study session of N focus minutes is split into
 * fixed focus blocks, and a break sits between two consecutive blocks. Every
 * fourth break is a long break, the rest are short, and there is no break after
 * the final block.
 */

export type FocusSessionPhase = 'focus' | 'break'

/** One focus block plus, where the session continues, the break that follows. */
export interface FocusSessionBlock {
  /** 1-based position in the session, counting both phases. */
  index: number
  phase: FocusSessionPhase
  minutes: number
  /** True only for a long break; a short break and a focus block are both false. */
  long: boolean
}

export interface FocusSessionSettings {
  shortBreakMinutes: number
  longBreakMinutes: number
  /** When false the session is one continuous focus block with no breaks at all. */
  breaks: boolean
}

export interface FocusSessionPlan extends FocusSessionSettings {
  /** Focus minutes the whole session must contain. Breaks are on top of this. */
  focusMinutes: number
  blocks: FocusSessionBlock[]
  focusBlocks: number
  breakBlocks: number
  longBreaks: number
  /** focusMinutes plus every break, i.e. the real elapsed time. */
  totalMinutes: number
}

export const FOCUS_MINUTES = 25
export const SHORT_BREAK_CHOICES: readonly number[] = [5, 10]
export const LONG_BREAK_CHOICES: readonly number[] = [15, 30]
/** A long break replaces every fourth short break, so four focus blocks per cycle. */
export const LONG_BREAK_EVERY = 4

/** The session the panel opens on: two hours of focus before any choice is made. */
export const DEFAULT_FOCUS_MINUTES = 120
/** Longest session the panel offers, so a plan stays a readable list. */
export const MAX_FOCUS_MINUTES = 12 * 60
/** The setup steps the length in hours and in minutes, never one big step. */
export const HOUR_STEP_MINUTES = 60
/** The same five minute grid the clock uses, kept separate: a session length is
 *  not a time of day, and changing one must not silently change the other. */
export const MINUTE_STEP_MINUTES = 5

/** The two break lengths the panel offers, in the order the setup lists them. */
export const MIN_BREAK_MINUTES = 1
/** A manual break is a pause in a study session, not a second session. */
export const MAX_BREAK_MINUTES = 60
/**
 * The length a manual break opens on, so the common case needs no stepping.
 */
export const DEFAULT_MANUAL_BREAK_MINUTES = 5
/**
 * A manual break is a plan like any other, so it reads on the same five minute
 * grid the session length does. Kept separate from `MIN_BREAK_MINUTES` because
 * that one is the floor of a *planned* break, and a planned break is a different
 * decision from a break taken on the spot.
 */
export const MANUAL_BREAK_STEP_MINUTES = 5
/** The shortest manual break the panel will offer: one notch on the grid above. */
export const MIN_MANUAL_BREAK_MINUTES = 5

/**
 * Keeps a manual break on the five minute grid between five and sixty minutes,
 * so the wheel can never hold a value the grid does not have.
 */
export function normalizeManualBreakMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MANUAL_BREAK_MINUTES
  const snapped = Math.round(value / MANUAL_BREAK_STEP_MINUTES) * MANUAL_BREAK_STEP_MINUTES
  return Math.min(MAX_BREAK_MINUTES, Math.max(MIN_MANUAL_BREAK_MINUTES, snapped))
}

/**
 * True when one notch in `delta`'s direction keeps a manual break readable, so
 * the button need not lock. `delta` counts notches, never minutes, so the grid
 * cannot be stepped around from a call site.
 */
export function canStepManualBreak(minutes: number, delta: number): boolean {
  const next = normalizeManualBreakMinutes(minutes) + delta * MANUAL_BREAK_STEP_MINUTES
  return next >= MIN_MANUAL_BREAK_MINUTES && next <= MAX_BREAK_MINUTES
}

/** Moves a manual break by one notch, never off the grid and never out of range. */
export function stepManualBreak(minutes: number, delta: number): number {
  return normalizeManualBreakMinutes(
    normalizeManualBreakMinutes(minutes) + delta * MANUAL_BREAK_STEP_MINUTES,
  )
}

export const DEFAULT_SETTINGS: FocusSessionSettings = {
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  breaks: true,
}

function clampChoice(value: number, choices: readonly number[], fallback: number): number {
  return choices.includes(value) ? value : fallback
}

export function normalizeFocusMinutes(value: number): number {
  if (!Number.isFinite(value)) return MAX_FOCUS_MINUTES
  return Math.min(MAX_FOCUS_MINUTES, Math.max(FOCUS_MINUTES, Math.round(value)))
}

/** The length as the setup reads it: whole hours, then the minutes left over. */
export interface SessionLength {
  hours: number
  minutes: number
}

export function sessionLength(focusMinutes: number): SessionLength {
  const total = normalizeFocusMinutes(focusMinutes)
  return { hours: Math.floor(total / HOUR_STEP_MINUTES), minutes: total % HOUR_STEP_MINUTES }
}

/** True when `delta` keeps the length readable, so the button need not lock. */
export function canStepSession(focusMinutes: number, delta: number): boolean {
  const next = normalizeFocusMinutes(focusMinutes) + delta
  return next >= FOCUS_MINUTES && next <= MAX_FOCUS_MINUTES
}

/** Moves the length by one hour or one minute step, never out of range. */
export function stepSession(focusMinutes: number, delta: number): number {
  return normalizeFocusMinutes(normalizeFocusMinutes(focusMinutes) + delta)
}

/**
 * Which focus block the session is on, for `Block 1 of 5`. A break reports the
 * block it follows, so the counter only ever moves forward.
 */
export function focusBlockCount(
  plan: FocusSessionPlan,
  index: number,
): { current: number; total: number } {
  const current = plan.blocks
    .slice(0, Math.max(0, index) + 1)
    .filter((block) => block.phase === 'focus').length
  return { current, total: plan.focusBlocks }
}

/**
 * Splits `focusMinutes` of focus into fixed blocks, trimmed so the last one is
 * never longer than what is left, and interleaves the breaks. 120 focus minutes
 * with 25-minute blocks is 25, 25, 25, 25, 20 plus three short breaks and one
 * long break.
 *
 * With `settings.breaks` false the session is **one** block of the whole length
 * and no breaks at all. Splitting it anyway and simply not scheduling the breaks
 * would leave a plan whose block list disagreed with its own flag, and the two
 * would have to be kept in step everywhere downstream.
 */
export function buildPlan(focusMinutes: number, settings: FocusSessionSettings): FocusSessionPlan {
  const total = normalizeFocusMinutes(focusMinutes)
  const shortBreakMinutes = clampChoice(
    settings.shortBreakMinutes,
    SHORT_BREAK_CHOICES,
    DEFAULT_SETTINGS.shortBreakMinutes,
  )
  const longBreakMinutes = clampChoice(
    settings.longBreakMinutes,
    LONG_BREAK_CHOICES,
    DEFAULT_SETTINGS.longBreakMinutes,
  )
  const breaks = settings.breaks !== false

  if (!breaks) {
    return {
      focusMinutes: total,
      shortBreakMinutes,
      longBreakMinutes,
      breaks: false,
      blocks: [{ index: 1, phase: 'focus', minutes: total, long: false }],
      focusBlocks: 1,
      breakBlocks: 0,
      longBreaks: 0,
      totalMinutes: total,
    }
  }

  const blocks: FocusSessionBlock[] = []
  let remaining = total
  let focusBlocks = 0
  let breakBlocks = 0
  let longBreaks = 0

  while (remaining > 0) {
    const minutes = Math.min(FOCUS_MINUTES, remaining)
    focusBlocks += 1
    blocks.push({ index: blocks.length + 1, phase: 'focus', minutes, long: false })
    remaining -= minutes

    if (remaining > 0) {
      const long = breakBlocks % LONG_BREAK_EVERY === LONG_BREAK_EVERY - 1
      breakBlocks += 1
      if (long) longBreaks += 1
      blocks.push({
        index: blocks.length + 1,
        phase: 'break',
        minutes: long ? longBreakMinutes : shortBreakMinutes,
        long,
      })
    }
  }

  const breakTotal = blocks
    .filter((block) => block.phase === 'break')
    .reduce((sum, block) => sum + block.minutes, 0)

  return {
    focusMinutes: total,
    shortBreakMinutes,
    longBreakMinutes,
    breaks: true,
    blocks,
    focusBlocks,
    breakBlocks,
    longBreaks,
    totalMinutes: total + breakTotal,
  }
}

/** Seconds left in a block, never negative. */
export function blockSeconds(block: FocusSessionBlock): number {
  return block.minutes * 60
}

/** '25:00', or '1:05:00' for anything an hour or longer. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

/** '2h 30m', or '45m' when under an hour. */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safe / 60)
  const rest = safe % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

export function phaseLabel(block: FocusSessionBlock): string {
  if (block.phase === 'focus') return 'Focus'
  return block.long ? 'Long break' : 'Short break'
}

/** Whole blocks finished, plus the fraction of the one in progress. */
export function planProgress(
  plan: FocusSessionPlan,
  index: number,
  elapsedSeconds: number,
): number {
  if (plan.blocks.length === 0) return 0
  const finished = plan.blocks.slice(0, index).reduce((sum, block) => sum + block.minutes, 0)
  const current = plan.blocks[index]
  const within = current ? Math.min(current.minutes, elapsedSeconds / 60) : 0
  return Math.min(1, Math.max(0, (finished + within) / plan.totalMinutes))
}

/** Focus minutes still to do, which is what the progress caption reports. */
export function remainingFocusMinutes(
  plan: FocusSessionPlan,
  index: number,
  elapsedSeconds: number,
): number {
  const current = plan.blocks[index]
  if (!current) return 0
  const after = plan.blocks
    .slice(index + 1)
    .filter((block) => block.phase === 'focus')
    .reduce((sum, block) => sum + block.minutes, 0)
  // A break in progress contributes no focus time, so it is skipped entirely.
  const currentLeft =
    current.phase === 'focus' ? Math.max(0, current.minutes - elapsedSeconds / 60) : 0
  return Math.max(0, after + currentLeft)
}

export const FOCUS_SESSION_GIFS = {
  idle: '/assets/focus-session/idle.gif',
  focus: '/assets/focus-session/focus.gif',
  break: '/assets/focus-session/break.gif',
  complete: '/assets/focus-session/complete.gif',
} as const

/** Returns the matching GIF asset path based on the current Focus Session view, phase, and finish state. */
export function getFocusSessionGif(options: {
  view?: 'idle' | 'setup' | 'session'
  phase?: FocusSessionPhase | null
  finished?: boolean
}): string {
  if (options.finished) {
    return FOCUS_SESSION_GIFS.complete
  }
  if (options.view === 'idle' || options.view === 'setup') {
    return FOCUS_SESSION_GIFS.idle
  }
  if (options.phase === 'break') {
    return FOCUS_SESSION_GIFS.break
  }
  return FOCUS_SESSION_GIFS.focus
}
