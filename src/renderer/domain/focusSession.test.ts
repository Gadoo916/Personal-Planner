import { describe, expect, it } from 'vitest'
import {
  blockSeconds,
  buildPlan,
  canStepManualBreak,
  canStepSession,
  DEFAULT_FOCUS_MINUTES,
  DEFAULT_MANUAL_BREAK_MINUTES,
  DEFAULT_SETTINGS,
  FOCUS_MINUTES,
  FOCUS_SESSION_GIFS,
  focusBlockCount,
  formatClock,
  formatDuration,
  getFocusSessionGif,
  HOUR_STEP_MINUTES,
  LONG_BREAK_CHOICES,
  MAX_FOCUS_MINUTES,
  MINUTE_STEP_MINUTES,
  normalizeManualBreakMinutes,
  phaseLabel,
  planProgress,
  remainingFocusMinutes,
  SHORT_BREAK_CHOICES,
  sessionLength,
  stepManualBreak,
  stepSession,
} from './focusSession'

const SHORT = DEFAULT_SETTINGS

function focusMinutesOf(plan: ReturnType<typeof buildPlan>): number[] {
  return plan.blocks.filter((block) => block.phase === 'focus').map((block) => block.minutes)
}

function breakMinutesOf(plan: ReturnType<typeof buildPlan>): number[] {
  return plan.blocks.filter((block) => block.phase === 'break').map((block) => block.minutes)
}

describe('buildPlan', () => {
  it('splits the session into focus blocks separated by breaks', () => {
    const plan = buildPlan(120, SHORT)
    expect(plan.focusMinutes).toBe(120)
    expect(focusMinutesOf(plan)).toEqual([25, 25, 25, 25, 20])
    expect(plan.blocks.map((block) => block.phase)).toEqual([
      'focus',
      'break',
      'focus',
      'break',
      'focus',
      'break',
      'focus',
      'break',
      'focus',
    ])
  })

  it('never exceeds the requested focus time, trimming the last block', () => {
    const plan = buildPlan(120, SHORT)
    expect(focusMinutesOf(plan).reduce((sum, value) => sum + value, 0)).toBe(120)
    expect(plan.blocks.at(-1)?.minutes).toBe(20)
  })

  it('puts no break after the final focus block', () => {
    const plan = buildPlan(300, SHORT)
    expect(plan.blocks.at(-1)?.phase).toBe('focus')
    expect(plan.focusBlocks).toBe(12)
    expect(plan.breakBlocks).toBe(11)
  })

  it('makes every fourth break the long one and repeats the cycle', () => {
    const plan = buildPlan(300, SHORT)
    const breaks = plan.blocks.filter((block) => block.phase === 'break')
    expect(breaks.map((block) => block.long)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ])
    expect(breakMinutesOf(plan)).toEqual([5, 5, 5, 15, 5, 5, 5, 15, 5, 5, 5])
    expect(plan.longBreaks).toBe(2)
  })

  it('honours the chosen break lengths', () => {
    const plan = buildPlan(300, { ...SHORT, shortBreakMinutes: 10, longBreakMinutes: 30 })
    expect(breakMinutesOf(plan)).toEqual([10, 10, 10, 30, 10, 10, 10, 30, 10, 10, 10])
  })

  it('adds the breaks on top of the focus time, and reports both', () => {
    const plan = buildPlan(300, SHORT)
    expect(plan.focusMinutes).toBe(300)
    expect(plan.totalMinutes).toBe(375)
  })

  it('clamps a session to a readable range and a single block minimum', () => {
    expect(buildPlan(0, SHORT).blocks).toHaveLength(1)
    expect(buildPlan(-30, SHORT).focusMinutes).toBe(FOCUS_MINUTES)
    expect(buildPlan(99_999, SHORT).focusMinutes).toBe(12 * 60)
    expect(Number.isNaN(buildPlan(Number.NaN, SHORT).focusMinutes)).toBe(false)
  })

  it('falls back to the default break when handed an unknown length', () => {
    const plan = buildPlan(100, { ...SHORT, shortBreakMinutes: 7, longBreakMinutes: 45 })
    expect(plan.shortBreakMinutes).toBe(SHORT.shortBreakMinutes)
    expect(plan.longBreakMinutes).toBe(SHORT.longBreakMinutes)
  })

  it('numbers every block from one, in session order', () => {
    const plan = buildPlan(100, SHORT)
    expect(plan.blocks.map((block) => block.index)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('offers the same options the panel renders', () => {
    expect(SHORT_BREAK_CHOICES).toEqual([5, 10])
    expect(LONG_BREAK_CHOICES).toEqual([15, 30])
  })
})

describe('session length stepper', () => {
  it('opens on two hours of focus', () => {
    expect(DEFAULT_FOCUS_MINUTES).toBe(120)
  })

  it('reads a length as whole hours and minutes', () => {
    expect(sessionLength(120)).toEqual({ hours: 2, minutes: 0 })
    expect(sessionLength(150)).toEqual({ hours: 2, minutes: 30 })
    expect(sessionLength(45)).toEqual({ hours: 0, minutes: 45 })
    expect(sessionLength(MAX_FOCUS_MINUTES)).toEqual({ hours: 12, minutes: 0 })
  })

  it('steps the hours and the minutes independently', () => {
    expect(stepSession(120, HOUR_STEP_MINUTES)).toBe(180)
    expect(stepSession(120, -HOUR_STEP_MINUTES)).toBe(60)
    expect(stepSession(120, MINUTE_STEP_MINUTES)).toBe(125)
    expect(stepSession(120, -MINUTE_STEP_MINUTES)).toBe(115)
  })

  it('keeps every length on the five minute grid', () => {
    let total = DEFAULT_FOCUS_MINUTES
    for (let step = 0; step < 6; step += 1) total = stepSession(total, MINUTE_STEP_MINUTES)
    expect(total).toBe(150)
    expect(total % MINUTE_STEP_MINUTES).toBe(0)
  })

  it('refuses a step that would leave the readable range', () => {
    expect(canStepSession(25, -MINUTE_STEP_MINUTES)).toBe(false)
    expect(canStepSession(30, -MINUTE_STEP_MINUTES)).toBe(true)
    expect(canStepSession(60, -HOUR_STEP_MINUTES)).toBe(false)
    expect(canStepSession(85, -HOUR_STEP_MINUTES)).toBe(true)
    expect(canStepSession(MAX_FOCUS_MINUTES, HOUR_STEP_MINUTES)).toBe(false)
    expect(canStepSession(MAX_FOCUS_MINUTES, MINUTE_STEP_MINUTES)).toBe(false)
  })

  it('always lands exactly on the grid and inside the range when allowed', () => {
    for (const total of [25, 30, 60, 85, 120, 715, MAX_FOCUS_MINUTES]) {
      for (const delta of [
        HOUR_STEP_MINUTES,
        -HOUR_STEP_MINUTES,
        MINUTE_STEP_MINUTES,
        -MINUTE_STEP_MINUTES,
      ]) {
        if (!canStepSession(total, delta)) continue
        const next = stepSession(total, delta)
        expect(next).toBe(total + delta)
        expect(next).toBeGreaterThanOrEqual(FOCUS_MINUTES)
        expect(next).toBeLessThanOrEqual(MAX_FOCUS_MINUTES)
      }
    }
  })

  it('clamps a refused step rather than leaving the range', () => {
    expect(stepSession(FOCUS_MINUTES, -MINUTE_STEP_MINUTES)).toBe(FOCUS_MINUTES)
    expect(stepSession(MAX_FOCUS_MINUTES, HOUR_STEP_MINUTES)).toBe(MAX_FOCUS_MINUTES)
  })

  it('composes back to exactly the length the panel shows', () => {
    for (const total of [25, 45, 120, 150, 300, 720]) {
      const { hours, minutes } = sessionLength(total)
      expect(hours * 60 + minutes).toBe(total)
    }
  })
})

describe('manual break stepper', () => {
  it('opens on five minutes, so the common case needs no stepping', () => {
    expect(DEFAULT_MANUAL_BREAK_MINUTES).toBe(5)
  })

  it('steps in five minute notches, not single minutes', () => {
    expect(stepManualBreak(5, 1)).toBe(10)
    expect(stepManualBreak(5, -1)).toBe(5)
    expect(stepManualBreak(20, 1)).toBe(25)
  })

  it('never goes below five or above sixty minutes', () => {
    expect(stepManualBreak(5, -1)).toBe(5)
    expect(stepManualBreak(60, 1)).toBe(60)
    expect(normalizeManualBreakMinutes(1)).toBe(5)
    expect(normalizeManualBreakMinutes(90)).toBe(60)
  })

  it('snaps a length that is off the grid onto it', () => {
    expect(normalizeManualBreakMinutes(7)).toBe(5)
    expect(normalizeManualBreakMinutes(8)).toBe(10)
    expect(normalizeManualBreakMinutes(0)).toBe(5)
  })

  it('locks the button exactly when the next notch would leave the range', () => {
    expect(canStepManualBreak(5, -1)).toBe(false)
    expect(canStepManualBreak(5, 1)).toBe(true)
    expect(canStepManualBreak(60, 1)).toBe(false)
    expect(canStepManualBreak(55, 1)).toBe(true)
  })
})

describe('block counter', () => {
  it('counts focus blocks and not breaks', () => {
    const plan = buildPlan(120, SHORT)
    // A two hour session is five focus blocks, however many breaks sit between.
    expect(plan.focusBlocks).toBe(5)
    expect(focusBlockCount(plan, 0)).toEqual({ current: 1, total: 5 })
    expect(focusBlockCount(plan, 2)).toEqual({ current: 2, total: 5 })
  })

  it('holds its number through the break that follows a block', () => {
    const plan = buildPlan(120, SHORT)
    expect(plan.blocks[1]?.phase).toBe('break')
    expect(focusBlockCount(plan, 1)).toEqual({ current: 1, total: 5 })
  })

  it('reads the last block as the last one, complete or not', () => {
    const plan = buildPlan(120, SHORT)
    expect(focusBlockCount(plan, plan.blocks.length - 1)).toEqual({ current: 5, total: 5 })
    expect(focusBlockCount(plan, plan.blocks.length)).toEqual({ current: 5, total: 5 })
  })
})

describe('progress', () => {
  it('reports the fraction of the whole session that is done', () => {
    const plan = buildPlan(100, SHORT)
    expect(planProgress(plan, 0, 0)).toBe(0)
    expect(planProgress(plan, 0, blockSeconds(plan.blocks[0]!) / 2)).toBeCloseTo(12.5 / 115, 5)
    expect(planProgress(plan, 0, blockSeconds(plan.blocks[0]!))).toBeCloseTo(
      25 / plan.totalMinutes,
      5,
    )
  })

  it('reaches one at the end of the last block and never passes it', () => {
    const plan = buildPlan(50, SHORT)
    const last = plan.blocks.length - 1
    const seconds = blockSeconds(plan.blocks[last]!)
    expect(planProgress(plan, last, seconds)).toBe(1)
    expect(planProgress(plan, last, seconds * 2)).toBe(1)
  })

  it('counts only the focus time that is left', () => {
    const plan = buildPlan(100, SHORT)
    expect(remainingFocusMinutes(plan, 0, 0)).toBe(100)
    expect(remainingFocusMinutes(plan, 0, 25 * 60)).toBe(75)
    expect(remainingFocusMinutes(plan, 1, 0)).toBe(75)
    expect(remainingFocusMinutes(plan, plan.blocks.length, 0)).toBe(0)
  })

  it('is empty rather than negative when the plan has no blocks', () => {
    const plan = buildPlan(100, SHORT)
    expect(planProgress(plan, 99, 0)).toBe(1)
    expect(remainingFocusMinutes(plan, 99, 0)).toBe(0)
  })
})

describe('labels', () => {
  it('names each phase in the words the panel shows', () => {
    const plan = buildPlan(200, SHORT)
    expect(phaseLabel(plan.blocks[0]!)).toBe('Focus')
    expect(phaseLabel(plan.blocks[1]!)).toBe('Short break')
    expect(phaseLabel(plan.blocks[7]!)).toBe('Long break')
  })

  it('formats a countdown as minutes and seconds', () => {
    expect(formatClock(25 * 60)).toBe('25:00')
    expect(formatClock(61)).toBe('01:01')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(-10)).toBe('00:00')
    expect(formatClock(3600 + 125)).toBe('1:02:05')
  })

  it('formats a duration for the caption', () => {
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(120)).toBe('2h')
    expect(formatDuration(375)).toBe('6h 15m')
  })
})

describe('getFocusSessionGif', () => {
  it('maps idle and setup views to idle.gif', () => {
    expect(getFocusSessionGif({ view: 'idle' })).toBe(FOCUS_SESSION_GIFS.idle)
    expect(getFocusSessionGif({ view: 'setup' })).toBe(FOCUS_SESSION_GIFS.idle)
    expect(FOCUS_SESSION_GIFS.idle).toBe('/assets/focus-session/idle.gif')
  })

  it('maps focus phase to focus.gif during a session', () => {
    expect(getFocusSessionGif({ view: 'session', phase: 'focus' })).toBe(FOCUS_SESSION_GIFS.focus)
    expect(FOCUS_SESSION_GIFS.focus).toBe('/assets/focus-session/focus.gif')
  })

  it('maps break phase to break.gif during a session', () => {
    expect(getFocusSessionGif({ view: 'session', phase: 'break' })).toBe(FOCUS_SESSION_GIFS.break)
    expect(FOCUS_SESSION_GIFS.break).toBe('/assets/focus-session/break.gif')
  })

  it('maps finished session to complete.gif', () => {
    expect(getFocusSessionGif({ view: 'session', phase: 'focus', finished: true })).toBe(
      FOCUS_SESSION_GIFS.complete,
    )
    expect(getFocusSessionGif({ view: 'session', phase: 'break', finished: true })).toBe(
      FOCUS_SESSION_GIFS.complete,
    )
    expect(FOCUS_SESSION_GIFS.complete).toBe('/assets/focus-session/complete.gif')
  })
})
