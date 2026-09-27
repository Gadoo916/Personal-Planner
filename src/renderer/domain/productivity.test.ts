import { describe, expect, it } from 'vitest'
import type { ProductivityDay, Task } from '../storage/types'
import {
  adaptiveComparison,
  calculateStreak,
  focusIntensity,
  focusOnDay,
  growthPresentation,
  mergeSessionResult,
  profileStats,
  tasksCompletedOnDay,
  todayStats,
} from './productivity'

const NOW = new Date(2026, 8, 26, 9, 0, 0)
const TODAY = '2026-09-26'

function day(overrides: Partial<ProductivityDay> = {}): ProductivityDay {
  return {
    focusMinutes: 0,
    breakMinutes: 0,
    focusSessions: 0,
    focusBlocks: 0,
    ...overrides,
  }
}

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: 'Task',
    date: TODAY,
    priority: 'medium',
    repeat: 'none',
    done: false,
    createdAt: 0,
    completedAt: null,
    ...overrides,
  }
}

describe('focusOnDay', () => {
  it('returns zero for a day with no record', () => {
    expect(focusOnDay({}, TODAY)).toBe(0)
  })

  it('returns the focus minutes for a day with a record', () => {
    expect(focusOnDay({ [TODAY]: day({ focusMinutes: 45 }) }, TODAY)).toBe(45)
  })
})

describe('tasksCompletedOnDay', () => {
  it('counts tasks completed on the given day', () => {
    const tasks = [
      task({ id: 'a', done: true, completedAt: new Date(2026, 8, 26, 10, 0, 0).getTime() }),
      task({ id: 'b', done: true, completedAt: new Date(2026, 8, 27, 10, 0, 0).getTime() }),
      task({ id: 'c', done: false }),
    ]
    expect(tasksCompletedOnDay(tasks, TODAY)).toBe(1)
  })

  it('returns zero when no tasks were completed', () => {
    expect(tasksCompletedOnDay([], TODAY)).toBe(0)
  })
})

describe('calculateStreak', () => {
  it('returns zero for empty productivity', () => {
    expect(calculateStreak({}, NOW)).toEqual({ current: 0, longest: 0 })
  })

  it('counts a single day streak', () => {
    const productivity = { [TODAY]: day({ focusMinutes: 30 }) }
    expect(calculateStreak(productivity, NOW)).toEqual({ current: 1, longest: 1 })
  })

  it('counts consecutive days ending today', () => {
    const productivity = {
      '2026-09-24': day({ focusMinutes: 30 }),
      '2026-09-25': day({ focusMinutes: 45 }),
      [TODAY]: day({ focusMinutes: 60 }),
    }
    expect(calculateStreak(productivity, NOW)).toEqual({ current: 3, longest: 3 })
  })

  it('keeps the streak alive from yesterday when today has no focus yet', () => {
    const productivity = {
      '2026-09-25': day({ focusMinutes: 30 }),
      '2026-09-24': day({ focusMinutes: 45 }),
    }
    expect(calculateStreak(productivity, NOW)).toEqual({ current: 2, longest: 2 })
  })

  it('breaks the streak after a gap', () => {
    const productivity = {
      '2026-09-20': day({ focusMinutes: 30 }),
      '2026-09-21': day({ focusMinutes: 45 }),
      '2026-09-25': day({ focusMinutes: 60 }),
    }
    expect(calculateStreak(productivity, NOW)).toEqual({ current: 1, longest: 2 })
  })

  it('tracks the longest streak across history', () => {
    const productivity = {
      '2026-09-01': day({ focusMinutes: 30 }),
      '2026-09-02': day({ focusMinutes: 45 }),
      '2026-09-03': day({ focusMinutes: 60 }),
      '2026-09-10': day({ focusMinutes: 30 }),
      '2026-09-25': day({ focusMinutes: 60 }),
    }
    expect(calculateStreak(productivity, NOW)).toEqual({ current: 1, longest: 3 })
  })
})

describe('profileStats', () => {
  it('returns zeros for empty data', () => {
    const stats = profileStats([], {}, NOW)
    expect(stats).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      todayFocusMinutes: 0,
      totalFocusMinutes: 0,
      totalTasksCompleted: 0,
      averageFocusMinutes: 0,
      totalBreakMinutes: 0,
    })
  })

  it('sums focus and break minutes across days', () => {
    const productivity = {
      '2026-09-25': day({ focusMinutes: 60, breakMinutes: 15 }),
      [TODAY]: day({ focusMinutes: 90, breakMinutes: 30 }),
    }
    const stats = profileStats([], productivity, NOW)
    expect(stats.totalFocusMinutes).toBe(150)
    expect(stats.totalBreakMinutes).toBe(45)
    expect(stats.todayFocusMinutes).toBe(90)
    expect(stats.averageFocusMinutes).toBe(75)
  })

  it('counts completed tasks', () => {
    const tasks = [
      task({ id: 'a', done: true }),
      task({ id: 'b', done: true }),
      task({ id: 'c', done: false }),
    ]
    const stats = profileStats(tasks, {}, NOW)
    expect(stats.totalTasksCompleted).toBe(2)
  })
})

describe('todayStats', () => {
  it('reads today focus and task counts', () => {
    const productivity = { [TODAY]: day({ focusMinutes: 45 }) }
    const tasks = [
      task({ id: 'a', done: true, completedAt: new Date(2026, 8, 26, 10, 0, 0).getTime() }),
      task({ id: 'b', done: false }),
    ]
    const stats = todayStats(tasks, productivity, NOW)
    expect(stats).toEqual({ focusMinutes: 45, tasksCompleted: 1, totalTasks: 2 })
  })
})

describe('adaptiveComparison', () => {
  it('reports no baseline with no data', () => {
    const comparison = adaptiveComparison({}, NOW)
    expect(comparison.hasBaseline).toBe(false)
  })

  it('reports no baseline with only one day of data', () => {
    const productivity = { [TODAY]: day({ focusMinutes: 60 }) }
    const comparison = adaptiveComparison(productivity, NOW)
    expect(comparison.hasBaseline).toBe(false)
  })

  it('compares today against yesterday with two days of data', () => {
    const productivity = {
      '2026-09-25': day({ focusMinutes: 60 }),
      [TODAY]: day({ focusMinutes: 90 }),
    }
    const comparison = adaptiveComparison(productivity, NOW)
    expect(comparison.hasBaseline).toBe(true)
    expect(comparison.windowLabel).toBe('today')
    expect(comparison.currentMinutes).toBe(90)
    expect(comparison.previousMinutes).toBe(60)
    expect(comparison.deltaMinutes).toBe(30)
    expect(comparison.growthPercent).toBe(50)
  })

  it('compares weeks once two weeks of data exist', () => {
    const productivity: Record<string, ProductivityDay> = {}
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date(2026, 8, 26 - i)
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      productivity[iso] = day({ focusMinutes: 60 })
    }
    const comparison = adaptiveComparison(productivity, NOW)
    expect(comparison.hasBaseline).toBe(true)
    expect(comparison.windowLabel).toBe('this week')
    expect(comparison.currentMinutes).toBe(420)
    expect(comparison.previousMinutes).toBe(420)
    expect(comparison.growthPercent).toBe(0)
  })

  it('handles zero previous period', () => {
    const productivity = {
      '2026-09-25': day({ focusMinutes: 0 }),
      [TODAY]: day({ focusMinutes: 60 }),
    }
    const comparison = adaptiveComparison(productivity, NOW)
    expect(comparison.growthPercent).toBeNull()
  })
})

describe('growthPresentation', () => {
  it('returns null without a baseline', () => {
    expect(
      growthPresentation({
        hasBaseline: false,
        windowLabel: '',
        currentMinutes: 0,
        previousMinutes: 0,
        deltaMinutes: 0,
        growthPercent: null,
      }),
    ).toBeNull()
  })

  it('presents growth in words', () => {
    const result = growthPresentation({
      hasBaseline: true,
      windowLabel: 'today',
      currentMinutes: 90,
      previousMinutes: 60,
      deltaMinutes: 30,
      growthPercent: 50,
    })
    expect(result?.text).toContain('30m more')
    expect(result?.text).toContain('+50%')
  })

  it('presents decline in words', () => {
    const result = growthPresentation({
      hasBaseline: true,
      windowLabel: 'today',
      currentMinutes: 30,
      previousMinutes: 60,
      deltaMinutes: -30,
      growthPercent: -50,
    })
    expect(result?.text).toContain('30m less')
  })

  it('presents no change', () => {
    const result = growthPresentation({
      hasBaseline: true,
      windowLabel: 'today',
      currentMinutes: 60,
      previousMinutes: 60,
      deltaMinutes: 0,
      growthPercent: 0,
    })
    expect(result?.text).toContain('as much')
  })
})

describe('focusIntensity', () => {
  it('maps focus minutes to intensity levels', () => {
    expect(focusIntensity(0)).toBe('empty')
    expect(focusIntensity(30)).toBe('light')
    expect(focusIntensity(120)).toBe('medium')
    expect(focusIntensity(360)).toBe('strong')
    expect(focusIntensity(480)).toBe('strong')
  })
})

describe('mergeSessionResult', () => {
  it('creates a new day record', () => {
    const result = mergeSessionResult(undefined, {
      focusMinutes: 25,
      breakMinutes: 5,
      focusBlocks: 1,
    })
    expect(result).toEqual({ focusMinutes: 25, breakMinutes: 5, focusSessions: 1, focusBlocks: 1 })
  })

  it('merges into an existing day record', () => {
    const existing = day({ focusMinutes: 50, breakMinutes: 10, focusSessions: 2, focusBlocks: 2 })
    const result = mergeSessionResult(existing, {
      focusMinutes: 25,
      breakMinutes: 5,
      focusBlocks: 1,
    })
    expect(result).toEqual({ focusMinutes: 75, breakMinutes: 15, focusSessions: 3, focusBlocks: 3 })
  })
})
