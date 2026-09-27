import { describe, expect, it } from 'vitest'
import { isOverdue, isPastDay, remainingTime } from './relativeTime'

/** Saturday 26 September 2026, 09:00 local. */
const NOW = new Date(2026, 8, 26, 9, 0, 0)

describe('remainingTime', () => {
  it('reports hours for a reminder later the same day', () => {
    expect(remainingTime('2026-09-26', '14:00', NOW)).toEqual({
      text: 'in 5 hours',
      overdue: false,
    })
  })

  it('reports minutes inside the hour', () => {
    expect(remainingTime('2026-09-26', '09:30', NOW).text).toBe('in 30 minutes')
  })

  it('reports a sub-minute gap as now', () => {
    expect(remainingTime('2026-09-26', '09:00', NOW).text).toBe('now')
  })

  it('says tomorrow for the next calendar day', () => {
    expect(remainingTime('2026-09-27', '09:00', NOW)).toEqual({
      text: 'tomorrow',
      overdue: false,
    })
  })

  it('says yesterday for the previous calendar day', () => {
    expect(remainingTime('2026-09-25', '09:00', NOW)).toEqual({
      text: 'yesterday',
      overdue: true,
    })
  })

  it('counts days inside the first fortnight', () => {
    expect(remainingTime('2026-09-29', '09:00', NOW).text).toBe('in 3 days')
  })

  it('switches to weeks at two weeks out', () => {
    expect(remainingTime('2026-10-10', '09:00', NOW).text).toBe('in 2 weeks')
  })

  it('switches to months past two months', () => {
    expect(remainingTime('2026-11-15', '09:00', NOW).text).toBe('in 2 months')
  })

  it('switches to years past eleven months', () => {
    expect(remainingTime('2028-01-01', '09:00', NOW).text).toBe('next year')
  })

  it('marks a past time the same day as overdue', () => {
    const result = remainingTime('2026-09-26', '07:00', NOW)
    expect(result.text).toBe('2 hours ago')
    expect(result.overdue).toBe(true)
  })

  it('marks any earlier day as overdue', () => {
    expect(remainingTime('2026-09-20', '09:00', NOW).overdue).toBe(true)
  })
})

describe('isOverdue', () => {
  it('is false for a future moment', () => {
    expect(isOverdue('2026-09-26', '14:00', NOW)).toBe(false)
  })

  it('is true once the moment has passed', () => {
    expect(isOverdue('2026-09-26', '08:59', NOW)).toBe(true)
  })
})

describe('isPastDay', () => {
  it('treats today as not past', () => {
    expect(isPastDay('2026-09-26', NOW)).toBe(false)
  })

  it('treats yesterday as past', () => {
    expect(isPastDay('2026-09-25', NOW)).toBe(true)
  })
})
