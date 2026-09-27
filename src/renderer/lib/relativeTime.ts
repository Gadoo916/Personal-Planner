import { combineDateTime, daysBetween, parseISODate } from './dates'

/**
 * Remaining-time label for a reminder. Uses the platform Intl formatter, so no
 * date library is needed and the output is locale aware.
 */

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export interface RemainingTime {
  text: string
  overdue: boolean
}

export function remainingTime(
  dateISO: string,
  time: string,
  now: Date = new Date(),
): RemainingTime {
  const target = combineDateTime(dateISO, time)
  const dayDiff = daysBetween(now, target)
  const ms = target.getTime() - now.getTime()

  if (dayDiff === 0) {
    const minutes = Math.round(ms / 60_000)
    if (Math.abs(minutes) < 1) return { text: 'now', overdue: ms < 0 }
    if (Math.abs(minutes) < 60) return { text: rtf.format(minutes, 'minute'), overdue: ms < 0 }
    return { text: rtf.format(Math.round(ms / 3_600_000), 'hour'), overdue: ms < 0 }
  }

  const sign = dayDiff > 0 ? 1 : -1
  const magnitude = Math.abs(dayDiff)

  if (magnitude === 1) return { text: rtf.format(sign, 'day'), overdue: sign < 0 }
  if (magnitude < 14) return { text: rtf.format(sign * magnitude, 'day'), overdue: sign < 0 }
  if (magnitude < 45) {
    return { text: rtf.format(sign * Math.round(magnitude / 7), 'week'), overdue: sign < 0 }
  }
  if (magnitude < 330) {
    return { text: rtf.format(sign * Math.round(magnitude / 30), 'month'), overdue: sign < 0 }
  }
  return { text: rtf.format(sign * Math.round(magnitude / 365), 'year'), overdue: sign < 0 }
}

export function isOverdue(dateISO: string, time: string, now: Date = new Date()): boolean {
  return combineDateTime(dateISO, time).getTime() < now.getTime()
}

/** True when a task's day is strictly before today. */
export function isPastDay(dateISO: string, now: Date = new Date()): boolean {
  return daysBetween(now, parseISODate(dateISO)) < 0
}
