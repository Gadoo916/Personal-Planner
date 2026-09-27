/**
 * Productivity analytics. Pure functions over the stored document: no React,
 * no timers, no IO, so every figure is provable in a unit test.
 *
 * The raw record is one ProductivityDay per calendar day. Nothing here is
 * persisted on its own — every number is derived from the same events the
 * planner already keeps (Focus Session results and Task.completedAt), so a
 * restart or a new day cannot disagree with the screen.
 */

import { addDaysISO, daysBetween, todayISO } from '../lib/dates'
import type { ProductivityDay, Task } from '../storage/types'
import { formatDuration } from './focusSession'

/** What one finished Focus Session contributes to a day. */
export interface FocusSessionResult {
  /** Minutes the user actually spent focusing, never the planned length. */
  focusMinutes: number
  /** Minutes the user actually spent on breaks, planned or not. */
  breakMinutes: number
  /** Focus blocks completed. Only meaningful for a blocks session. */
  focusBlocks: number
}

export interface StreakInfo {
  current: number
  longest: number
}

export interface DayStats {
  focusMinutes: number
  breakMinutes: number
  tasksCompleted: number
  focusSessions: number
  focusBlocks: number
}

export interface TodayStats {
  focusMinutes: number
  tasksCompleted: number
  totalTasks: number
}

export interface ProfileStats {
  currentStreak: number
  longestStreak: number
  todayFocusMinutes: number
  totalFocusMinutes: number
  totalTasksCompleted: number
  averageFocusMinutes: number
  totalBreakMinutes: number
}

export interface ComparisonInfo {
  /** False until there is a previous equal-length period to compare against. */
  hasBaseline: boolean
  /** Human label for the window, e.g. 'this week'. */
  windowLabel: string
  currentMinutes: number
  previousMinutes: number
  /** Signed growth in minutes. */
  deltaMinutes: number
  /** Signed growth as a percent, rounded. Null when the baseline is zero. */
  growthPercent: number | null
}

export interface GrowthPresentation {
  text: string
  detail: string
}

/** The last day of a streak window, counting back from `today`. */
function windowStart(today: string, days: number): string {
  return addDaysISO(today, -(days - 1))
}

/** Focus minutes inside [start, end] inclusive. Both are 'YYYY-MM-DD'. */
function focusInRange(
  productivity: Record<string, ProductivityDay>,
  start: string,
  end: string,
): number {
  let total = 0
  for (let cursor = start; cursor <= end; cursor = addDaysISO(cursor, 1)) {
    total += productivity[cursor]?.focusMinutes ?? 0
  }
  return total
}

/** Focus minutes on one calendar day, zero when the day has no record. */
export function focusOnDay(productivity: Record<string, ProductivityDay>, iso: string): number {
  return productivity[iso]?.focusMinutes ?? 0
}

/** Task records completed on one calendar day, read off completedAt. */
export function tasksCompletedOnDay(tasks: readonly Task[], iso: string): number {
  const dayStart = new Date(`${iso}T00:00:00`).getTime()
  const dayEnd = new Date(`${iso}T23:59:59.999`).getTime()
  return tasks.filter(
    (task) =>
      task.completedAt !== null && task.completedAt >= dayStart && task.completedAt <= dayEnd,
  ).length
}

/**
 * Current and longest streak, counted back from today. A day is a streak day
 * when it holds any real Focus Time, so a single finished block is enough.
 * Today counts only once it has Focus Time; until then the streak is still
 * alive from yesterday, because the day is not over.
 */
export function calculateStreak(
  productivity: Record<string, ProductivityDay>,
  now: Date = new Date(),
): StreakInfo {
  const today = todayISO(now)

  let current = 0
  let cursor = today
  if (focusOnDay(productivity, cursor) === 0) {
    cursor = addDaysISO(cursor, -1)
  }
  while (focusOnDay(productivity, cursor) > 0) {
    current += 1
    cursor = addDaysISO(cursor, -1)
  }

  const days = Object.keys(productivity)
    .filter((iso) => (productivity[iso]?.focusMinutes ?? 0) > 0)
    .sort()
  let longest = 0
  let run = 0
  let previous: string | null = null
  for (const iso of days) {
    if (
      previous !== null &&
      daysBetween(new Date(`${previous}T00:00:00`), new Date(`${iso}T00:00:00`)) === 1
    ) {
      run += 1
    } else {
      run = 1
    }
    longest = Math.max(longest, run)
    previous = iso
  }

  return { current, longest }
}

/** Everything the Profile header and stat grid read, in one derivation. */
export function profileStats(
  tasks: readonly Task[],
  productivity: Record<string, ProductivityDay>,
  now: Date = new Date(),
): ProfileStats {
  const today = todayISO(now)
  const days = Object.values(productivity)

  const totalFocusMinutes = days.reduce((sum, day) => sum + day.focusMinutes, 0)
  const totalBreakMinutes = days.reduce((sum, day) => sum + day.breakMinutes, 0)
  const activeDays = days.filter((day) => day.focusMinutes > 0).length
  const totalTasksCompleted = tasks.filter((task) => task.done).length
  const streak = calculateStreak(productivity, now)

  return {
    currentStreak: streak.current,
    longestStreak: streak.longest,
    todayFocusMinutes: focusOnDay(productivity, today),
    totalFocusMinutes,
    totalTasksCompleted,
    averageFocusMinutes: activeDays === 0 ? 0 : Math.round(totalFocusMinutes / activeDays),
    totalBreakMinutes,
  }
}

/** The two numbers the Profile header leads with, plus the task totals. */
export function todayStats(
  tasks: readonly Task[],
  productivity: Record<string, ProductivityDay>,
  now: Date = new Date(),
): TodayStats {
  const today = todayISO(now)
  return {
    focusMinutes: focusOnDay(productivity, today),
    tasksCompleted: tasksCompletedOnDay(tasks, today),
    totalTasks: tasks.filter((task) => task.date === today).length,
  }
}

/**
 * The adaptive comparison window. It grows with the age of the data, and it
 * only ever compares two periods of equal length: yesterday against today,
 * the last week against the one before it, and so on. With no equal-length
 * history there is nothing honest to show, so it reports no baseline rather
 * than a flattering number.
 */
export function adaptiveComparison(
  productivity: Record<string, ProductivityDay>,
  now: Date = new Date(),
): ComparisonInfo {
  const today = todayISO(now)
  const firstDay = Object.keys(productivity)
    .filter((iso) => (productivity[iso]?.focusMinutes ?? 0) > 0)
    .sort()[0]

  const empty: ComparisonInfo = {
    hasBaseline: false,
    windowLabel: '',
    currentMinutes: 0,
    previousMinutes: 0,
    deltaMinutes: 0,
    growthPercent: null,
  }
  if (firstDay === undefined) return empty

  const age = daysBetween(new Date(`${firstDay}T00:00:00`), new Date(`${today}T00:00:00`)) + 1

  // The window doubles as the data allows: a day, a week, two weeks, a month.
  let window = 1
  for (const candidate of [1, 7, 14, 30]) {
    if (age >= candidate * 2) window = candidate
  }
  if (age < window * 2) return empty

  const currentStart = windowStart(today, window)
  const previousEnd = addDaysISO(currentStart, -1)
  const previousStart = windowStart(previousEnd, window)

  const currentMinutes = focusInRange(productivity, currentStart, today)
  const previousMinutes = focusInRange(productivity, previousStart, previousEnd)
  const deltaMinutes = currentMinutes - previousMinutes
  const growthPercent =
    previousMinutes === 0 ? null : Math.round((deltaMinutes / previousMinutes) * 100)

  const label =
    window === 1
      ? 'today'
      : window === 7
        ? 'this week'
        : window === 14
          ? 'past two weeks'
          : 'past month'

  return {
    hasBaseline: true,
    windowLabel: label,
    currentMinutes,
    previousMinutes,
    deltaMinutes,
    growthPercent,
  }
}

/** The growth line for the Profile: words first, then the number. */
export function growthPresentation(comparison: ComparisonInfo): GrowthPresentation | null {
  if (!comparison.hasBaseline) return null
  const abs = Math.abs(comparison.deltaMinutes)
  const verb =
    comparison.deltaMinutes > 0 ? 'more' : comparison.deltaMinutes < 0 ? 'less' : 'the same as'
  const percent =
    comparison.growthPercent === null
      ? ''
      : ` (${comparison.growthPercent > 0 ? '+' : ''}${comparison.growthPercent}%)`
  return {
    text:
      comparison.deltaMinutes === 0
        ? `You focused as much as the previous period.`
        : `You focused ${formatDuration(abs)} ${verb} than the previous period.${percent}`,
    detail: `${formatDuration(comparison.currentMinutes)} vs ${formatDuration(comparison.previousMinutes)}`,
  }
}

/** Calendar intensity for one day: empty, light, medium or strong. */
export type FocusIntensity = 'empty' | 'light' | 'medium' | 'strong'

/** The four steps the Profile Calendar uses to shade a day. */
export function focusIntensity(focusMinutes: number): FocusIntensity {
  if (focusMinutes <= 0) return 'empty'
  if (focusMinutes < 120) return 'light'
  if (focusMinutes < 360) return 'medium'
  return 'strong'
}

/** Builds the day record from a session result, merged into an existing day. */
export function mergeSessionResult(
  day: ProductivityDay | undefined,
  result: FocusSessionResult,
): ProductivityDay {
  return {
    focusMinutes: (day?.focusMinutes ?? 0) + result.focusMinutes,
    breakMinutes: (day?.breakMinutes ?? 0) + result.breakMinutes,
    focusSessions: (day?.focusSessions ?? 0) + 1,
    focusBlocks: (day?.focusBlocks ?? 0) + result.focusBlocks,
  }
}
