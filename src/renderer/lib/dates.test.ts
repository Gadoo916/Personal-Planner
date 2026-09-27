import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  clockParts,
  combineDateTime,
  daysBetween,
  defaultReminderTime,
  formatClock,
  formatDayLabel,
  formatMonthYear,
  hour12,
  isClockTime,
  isISODate,
  latestSelectableDate,
  monthMatrix,
  parseISODate,
  shiftClock,
  shiftMonth,
  todayISO,
  toggleMeridiem,
  toISODate,
  WEEKDAY_INITIALS,
} from './dates'

const NOW = new Date(2026, 8, 26, 9, 0, 0)

describe('isISODate', () => {
  it('accepts a well-formed date', () => {
    expect(isISODate('2026-09-26')).toBe(true)
  })

  it('rejects a month overflow such as February 30', () => {
    expect(isISODate('2026-02-30')).toBe(false)
  })

  it('rejects a non-padded or malformed value', () => {
    expect(isISODate('2026-9-6')).toBe(false)
    expect(isISODate('yesterday')).toBe(false)
    expect(isISODate(20260926)).toBe(false)
  })

  it('accepts a leap day in a leap year and rejects it otherwise', () => {
    expect(isISODate('2024-02-29')).toBe(true)
    expect(isISODate('2026-02-29')).toBe(false)
  })
})

describe('isClockTime', () => {
  it('accepts 24-hour times', () => {
    expect(isClockTime('00:00')).toBe(true)
    expect(isClockTime('23:59')).toBe(true)
  })

  it('rejects out-of-range values', () => {
    expect(isClockTime('24:00')).toBe(false)
    expect(isClockTime('9:00')).toBe(false)
    expect(isClockTime('09:60')).toBe(false)
  })
})

describe('toISODate / parseISODate', () => {
  it('round-trips a local calendar date', () => {
    expect(toISODate(parseISODate('2026-09-26'))).toBe('2026-09-26')
  })

  it('parses to local midnight, not UTC', () => {
    const parsed = parseISODate('2026-09-26')
    expect(parsed.getHours()).toBe(0)
    expect(parsed.getDate()).toBe(26)
  })
})

describe('addDaysISO', () => {
  it('rolls over a month boundary', () => {
    expect(addDaysISO('2026-09-30', 1)).toBe('2026-10-01')
  })

  it('rolls over a year boundary', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles a leap day', () => {
    expect(addDaysISO('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDaysISO('2024-02-28', 2)).toBe('2024-03-01')
  })

  it('steps backwards', () => {
    expect(addDaysISO('2026-10-01', -1)).toBe('2026-09-30')
  })

  it('keeps the same weekday when adding a week', () => {
    const start = parseISODate('2026-09-26')
    const next = parseISODate(addDaysISO('2026-09-26', 7))
    expect(next.getDay()).toBe(start.getDay())
  })
})

describe('daysBetween', () => {
  it('counts whole calendar days', () => {
    expect(daysBetween(NOW, parseISODate('2026-09-29'))).toBe(3)
    expect(daysBetween(NOW, parseISODate('2026-09-25'))).toBe(-1)
  })

  it('is unaffected by the time of day', () => {
    const lateEvening = new Date(2026, 8, 26, 23, 59, 59)
    expect(daysBetween(lateEvening, parseISODate('2026-09-27'))).toBe(1)
  })
})

describe('combineDateTime', () => {
  it('builds a local Date from date and 24-hour time', () => {
    const combined = combineDateTime('2026-09-26', '14:30')
    expect(combined.getHours()).toBe(14)
    expect(combined.getMinutes()).toBe(30)
    expect(combined.getDate()).toBe(26)
  })
})

describe('formatDayLabel', () => {
  it('names today and tomorrow', () => {
    expect(formatDayLabel('2026-09-26', NOW)).toBe('Today')
    expect(formatDayLabel('2026-09-27', NOW)).toBe('Tomorrow')
  })

  it('uses a full weekday name for dates within a week', () => {
    expect(formatDayLabel('2026-09-28', NOW)).toBe('Monday')
    expect(formatDayLabel('2026-10-03', NOW)).toBe('Saturday')
    expect(formatDayLabel('2026-09-21', NOW)).toBe('Monday')
  })

  it('uses a compact date for anything beyond a week', () => {
    expect(formatDayLabel('2026-10-08', NOW)).toBe('Oct 8')
    expect(formatDayLabel('2026-12-25', NOW)).toBe('Dec 25')
  })
})

describe('formatClock', () => {
  it('renders 12-hour time with a suffix', () => {
    expect(formatClock('09:00')).toBe('9:00 AM')
    expect(formatClock('13:05')).toBe('1:05 PM')
    expect(formatClock('00:30')).toBe('12:30 AM')
    expect(formatClock('12:00')).toBe('12:00 PM')
  })
})

describe('todayISO / defaultReminderTime', () => {
  it('reports the local day', () => {
    expect(todayISO(NOW)).toBe('2026-09-26')
  })

  it('defaults a new reminder to the next half hour', () => {
    expect(defaultReminderTime(NOW)).toBe('09:30')
  })

  it('rounds the default up to a five-minute step the picker can reach', () => {
    expect(defaultReminderTime(new Date(2026, 8, 26, 9, 7))).toBe('09:40')
    expect(defaultReminderTime(new Date(2026, 8, 26, 9, 2))).toBe('09:35')
  })

  it('carries the hour over when the rounding lands on the next hour', () => {
    expect(defaultReminderTime(new Date(2026, 8, 26, 23, 40))).toBe('00:10')
  })
})

describe('clockParts / hour12 / shiftClock / toggleMeridiem', () => {
  it('splits a 24-hour time into the halves the picker steps', () => {
    expect(clockParts('09:00')).toEqual({ hour: 9, minute: 0, meridiem: 'AM' })
    expect(clockParts('21:05')).toEqual({ hour: 21, minute: 5, meridiem: 'PM' })
    expect(clockParts('00:30')).toEqual({ hour: 0, minute: 30, meridiem: 'AM' })
    expect(clockParts('12:00')).toEqual({ hour: 12, minute: 0, meridiem: 'PM' })
  })

  it('renders the hour on a 12-hour clock', () => {
    expect(hour12('09:00')).toBe(9)
    expect(hour12('21:00')).toBe(9)
    expect(hour12('00:00')).toBe(12)
    expect(hour12('12:00')).toBe(12)
  })

  it('steps in both directions and wraps around midnight', () => {
    expect(shiftClock('09:00', 60)).toBe('10:00')
    expect(shiftClock('09:00', -60)).toBe('08:00')
    expect(shiftClock('00:15', -30)).toBe('23:45')
    expect(shiftClock('23:45', 30)).toBe('00:15')
    expect(shiftClock('09:00', 1440)).toBe('09:00')
  })

  it('swaps the meridiem without losing the minutes', () => {
    expect(toggleMeridiem('09:00')).toBe('21:00')
    expect(toggleMeridiem('21:30')).toBe('09:30')
    expect(toggleMeridiem('00:00')).toBe('12:00')
    expect(toggleMeridiem('12:00')).toBe('00:00')
  })
})

describe('monthMatrix', () => {
  it('always returns six full weeks, Sunday first', () => {
    const { days } = monthMatrix('2026-09-26', { now: NOW })
    expect(days).toHaveLength(42)
    expect(parseISODate(days[0]!.iso).getDay()).toBe(0)
  })

  it('borrows the days around the month and marks them as outside', () => {
    // September 2026 starts on a Tuesday, so two leading days are borrowed.
    const { days } = monthMatrix('2026-09-01', { now: NOW })
    expect(days[0]?.iso).toBe('2026-08-30')
    expect(days[0]?.inMonth).toBe(false)
    expect(days[1]?.iso).toBe('2026-08-31')
    expect(days[1]?.inMonth).toBe(false)
    expect(days[2]?.iso).toBe('2026-09-01')
    expect(days[2]?.inMonth).toBe(true)
    expect(days.at(-1)?.inMonth).toBe(false)
  })

  it('spans a month that needs a trailing week', () => {
    const { days } = monthMatrix('2026-02-01', { now: NOW })
    const inMonth = days.filter((day) => day.inMonth)
    expect(inMonth).toHaveLength(28)
    expect(inMonth[0]?.iso).toBe('2026-02-01')
    expect(inMonth.at(-1)?.iso).toBe('2026-02-28')
  })

  it('marks today and leaves the disabled flag off by default', () => {
    const { days } = monthMatrix('2026-09-01', { now: NOW })
    const today = days.filter((day) => day.isToday)
    expect(today).toHaveLength(1)
    expect(today[0]?.iso).toBe('2026-09-26')
    expect(days.every((day) => day.disabled === false)).toBe(true)
  })

  it('disables only the days past the ceiling', () => {
    const { days } = monthMatrix('2026-10-01', { now: NOW, max: '2026-10-15' })
    expect(days.find((day) => day.iso === '2026-10-15')?.disabled).toBe(false)
    expect(days.find((day) => day.iso === '2026-10-16')?.disabled).toBe(true)
  })
})

describe('shiftMonth / formatMonthYear / latestSelectableDate', () => {
  it('steps between neighbouring months in both directions', () => {
    expect(shiftMonth('2026-09-15', 1)).toBe('2026-10-01')
    expect(shiftMonth('2026-09-15', -1)).toBe('2026-08-01')
    expect(shiftMonth('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftMonth('2026-01-31', -1)).toBe('2025-12-01')
  })

  it('labels the month on screen', () => {
    expect(formatMonthYear('2026-09-26')).toBe('September 2026')
  })

  it('caps how far ahead a date may be picked', () => {
    expect(latestSelectableDate(NOW)).toBe('2027-09-26')
  })

  it('offers one heading per column, Sunday first', () => {
    expect(WEEKDAY_INITIALS).toHaveLength(7)
    expect(WEEKDAY_INITIALS[0]).toBe('S')
  })
})
