/**
 * All dates in this app are local calendar dates held as 'YYYY-MM-DD' text.
 * A task due "tomorrow" must stay tomorrow across timezone changes and DST,
 * so a UTC instant is never used to represent a day.
 */

const DAY_MS = 86_400_000

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'narrow' })
const longWeekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const compactDayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number) as [number, number, number]
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const probe = new Date(y, m - 1, d)
  return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d
}

export function isClockTime(value: unknown): value is string {
  return typeof value === 'string' && CLOCK_TIME.test(value)
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Local calendar date of a Date as 'YYYY-MM-DD'. */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now)
}

/** Local midnight for a 'YYYY-MM-DD' string. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

/**
 * Whole calendar days from `from`'s day to `to`'s day.
 * Normalised through UTC so a 23- or 25-hour DST day cannot skew the result.
 */
export function daysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((toUtc - fromUtc) / DAY_MS)
}

/** Local Date for a reminder's date + 24-hour time. */
export function combineDateTime(dateISO: string, time: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number) as [number, number, number]
  const [hh, mm] = time.split(':').map(Number) as [number, number]
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}

export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const diff = daysBetween(now, parseISODate(iso))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff >= -7 && diff <= 7) return longWeekdayFormatter.format(parseISODate(iso))
  return compactDayFormatter.format(parseISODate(iso))
}

export function formatDayDate(iso: string): string {
  return dayFormatter.format(parseISODate(iso))
}

/** 'HH:mm' as '9:00 AM'. */
export function formatClock(time: string): string {
  const [h, m] = time.split(':').map(Number) as [number, number]
  const suffix = h < 12 ? 'AM' : 'PM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${pad(m)} ${suffix}`
}

/* ------------------------------------------------------------------ clock */

/** Granularity of the custom time picker, and the rounding of its default. */
export const MINUTE_STEP = 5

/** The two halves the custom time picker steps through. */
export interface ClockParts {
  hour: number
  minute: number
  meridiem: 'AM' | 'PM'
}

export function clockParts(time: string): ClockParts {
  const [h, m] = time.split(':').map(Number) as [number, number]
  return { hour: h, minute: m, meridiem: h < 12 ? 'AM' : 'PM' }
}

/** Hour on a 12-hour clock, 1 through 12. */
export function hour12(time: string): number {
  const hour = clockParts(time).hour
  return hour % 12 === 0 ? 12 : hour % 12
}

/** Moves a 24-hour time by whole minutes, wrapping around midnight. */
export function shiftClock(time: string, deltaMinutes: number): string {
  const { hour, minute } = clockParts(time)
  const total = (((hour * 60 + minute + deltaMinutes) % 1440) + 1440) % 1440
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/** Swaps 09:00 for 21:00, and midnight for noon. */
export function toggleMeridiem(time: string): string {
  const { hour, minute } = clockParts(time)
  return `${pad(hour < 12 ? hour + 12 : hour - 12)}:${pad(minute)}`
}

/** Next five-minute boundary, so a new reminder defaults to a sensible future
 *  time and the picker's five-minute step can always reach it. */
export function defaultReminderTime(now: Date = new Date()): string {
  const next = new Date(now.getTime() + 30 * 60_000)
  next.setSeconds(0, 0)
  const step = Math.ceil(next.getMinutes() / MINUTE_STEP) * MINUTE_STEP
  if (step === 60) return `${pad((next.getHours() + 1) % 24)}:00`
  return `${pad(next.getHours())}:${pad(step)}`
}

/* --------------------------------------------------------------- calendar */

/** Single-letter day headings, Sunday first, matching the en-US week order. */
export const WEEKDAY_INITIALS: readonly string[] = Array.from({ length: 7 }, (_, index) =>
  // 7 January 2024 was a Sunday, so this walks one week per index.
  weekdayFormatter.format(new Date(2024, 0, 7 + index)),
)

export interface CalendarDay {
  iso: string
  day: number
  /** False for the leading and trailing days borrowed from the neighbours. */
  inMonth: boolean
  isToday: boolean
  disabled: boolean
}

export interface CalendarMonth {
  /** The month on screen, so the header can label it. */
  monthISO: string
  days: CalendarDay[]
}

/** Six weeks, so the grid never changes height between months. */
const GRID_CELLS = 42

/**
 * The 42 cells of a month grid, Sunday first. Always full, so the picker cannot
 * jump in height as the user pages through months.
 */
export function monthMatrix(
  monthISO: string,
  options: { now?: Date; max?: string } = {},
): CalendarMonth {
  // The grid belongs to the month, not to the day the caller happened to pass.
  const first = parseISODate(monthISO)
  first.setDate(1)
  const month = first.getMonth()
  const leading = first.getDay()
  const today = todayISO(options.now ?? new Date())
  const start = new Date(first.getFullYear(), month, 1 - leading)
  const days: CalendarDay[] = []

  for (let cell = 0; cell < GRID_CELLS; cell += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + cell)
    const iso = toISODate(date)
    days.push({
      iso,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: iso === today,
      disabled: options.max === undefined ? false : iso > options.max,
    })
  }

  return { monthISO, days }
}

/** Same day of the neighbouring month; always the first, so it cannot overflow. */
export function shiftMonth(iso: string, delta: number): string {
  const date = parseISODate(iso)
  date.setDate(1)
  date.setMonth(date.getMonth() + delta)
  return toISODate(date)
}

/** 'September 2026'. */
export function formatMonthYear(iso: string): string {
  return monthFormatter.format(parseISODate(iso))
}

/** How far ahead a date may be picked, matching the ceiling the form used. */
export const MAX_DAYS_AHEAD = 365

export function latestSelectableDate(now: Date = new Date()): string {
  return addDaysISO(todayISO(now), MAX_DAYS_AHEAD)
}
