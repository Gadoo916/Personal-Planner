import { describe, expect, it } from 'vitest'
import type { AppData, Reminder, Task } from '../storage/types'
import {
  compareReminders,
  compareTasks,
  createReminder,
  createTask,
  groupTasksByDay,
  nextOccurrence,
  normalizeAppData,
  normalizeTitle,
  plannerStats,
  sortReminders,
  sortTasks,
} from './model'

const NOW = new Date(2026, 8, 26, 9, 0, 0)

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: 'Task',
    date: '2026-09-26',
    priority: 'medium',
    repeat: 'none',
    done: false,
    createdAt: 0,
    completedAt: null,
    ...overrides,
  }
}

function reminder(overrides: Partial<Reminder> & { id: string }): Reminder {
  return {
    title: 'Reminder',
    date: '2026-09-26',
    time: '09:00',
    createdAt: 0,
    ...overrides,
  }
}

describe('normalizeTitle', () => {
  it('trims and caps length', () => {
    expect(normalizeTitle('  Read chapter 4  ')).toBe('Read chapter 4')
    expect(normalizeTitle('x'.repeat(400))).toHaveLength(200)
  })
})

describe('createTask / createReminder', () => {
  it('produces a fresh incomplete task with a unique id', () => {
    const first = createTask(
      { title: ' A ', date: '2026-09-26', priority: 'high', repeat: 'none' },
      NOW,
    )
    const second = createTask(
      { title: 'B', date: '2026-09-26', priority: 'high', repeat: 'none' },
      NOW,
    )
    expect(first.title).toBe('A')
    expect(first.done).toBe(false)
    expect(first.completedAt).toBeNull()
    expect(first.createdAt).toBe(NOW.getTime())
    expect(first.id).not.toBe(second.id)
  })

  it('produces a reminder with the given time', () => {
    expect(createReminder({ title: 'Exam', date: '2026-10-02', time: '09:00' }, NOW).time).toBe(
      '09:00',
    )
  })
})

describe('nextOccurrence', () => {
  it('adds a day for daily', () => {
    expect(nextOccurrence('2026-09-26', 'daily')).toBe('2026-09-27')
  })

  it('adds a week for weekly', () => {
    expect(nextOccurrence('2026-09-26', 'weekly')).toBe('2026-10-03')
  })

  it('stays put for none', () => {
    expect(nextOccurrence('2026-09-26', 'none')).toBe('2026-09-26')
  })
})

describe('task ordering', () => {
  it('sorts by day, then priority, then open before done, then oldest first', () => {
    const sorted = sortTasks([
      task({ id: 'd', date: '2026-09-27', priority: 'low' }),
      task({ id: 'c', date: '2026-09-26', priority: 'low' }),
      task({ id: 'b', date: '2026-09-26', priority: 'high', done: true }),
      task({ id: 'a', date: '2026-09-26', priority: 'high' }),
      task({ id: 'e', date: '2026-09-26', priority: 'medium' }),
    ])
    expect(sorted.map((item) => item.id)).toEqual(['a', 'b', 'e', 'c', 'd'])
  })

  it('breaks a full tie on creation time', () => {
    const sorted = sortTasks([
      task({ id: 'second', createdAt: 200 }),
      task({ id: 'first', createdAt: 100 }),
    ])
    expect(sorted.map((item) => item.id)).toEqual(['first', 'second'])
  })

  it('is a total order, so compare never disagrees with sort', () => {
    const list = [task({ id: 'x', priority: 'low' }), task({ id: 'y', priority: 'high' })]
    expect(compareTasks(list[0]!, list[1]!)).toBeGreaterThan(0)
  })
})

describe('groupTasksByDay', () => {
  it('creates one group per day, ordered ascending, each sorted internally', () => {
    const groups = groupTasksByDay(
      [
        task({ id: 'b', date: '2026-09-26', priority: 'low' }),
        task({ id: 'c', date: '2026-09-27', priority: 'high' }),
        task({ id: 'a', date: '2026-09-26', priority: 'high' }),
      ],
      NOW,
    )
    expect(groups.map((group) => group.key)).toEqual(['2026-09-26', '2026-09-27'])
    expect(groups[0]?.tasks.map((item) => item.id)).toEqual(['a', 'b'])
    expect(groups[0]?.label).toBe('Today')
    expect(groups[1]?.label).toBe('Tomorrow')
  })

  it('flags only the current day as today', () => {
    const groups = groupTasksByDay(
      [
        task({ id: 'a', date: '2026-09-25' }),
        task({ id: 'b', date: '2026-09-26' }),
        task({ id: 'c', date: '2026-09-27' }),
      ],
      NOW,
    )
    expect(groups.map((group) => group.isToday)).toEqual([false, true, false])
  })

  it('returns nothing for an empty list', () => {
    expect(groupTasksByDay([], NOW)).toEqual([])
  })
})

describe('reminder ordering', () => {
  it('sorts by date then time', () => {
    const sorted = sortReminders([
      reminder({ id: 'b', date: '2026-09-26', time: '14:00' }),
      reminder({ id: 'a', date: '2026-09-27', time: '08:00' }),
      reminder({ id: 'c', date: '2026-09-26', time: '09:00' }),
    ])
    expect(sorted.map((item) => item.id)).toEqual(['c', 'b', 'a'])
    expect(compareReminders(sorted[0]!, sorted[1]!)).toBeLessThan(0)
  })
})

describe('plannerStats', () => {
  it('counts tasks for today, completed tasks for today, and total tasks', () => {
    const tasks = [
      task({ id: '1', date: '2026-09-26', done: true }),
      task({ id: '2', date: '2026-09-26', done: false }),
      task({ id: '3', date: '2026-09-27', done: false }),
      task({ id: '4', date: '2026-09-25', done: true }),
    ]
    const reminders = [
      reminder({ id: 'r1', date: '2026-09-26', time: '08:00' }), // past (NOW is 09:00)
      reminder({ id: 'r2', date: '2026-09-26', time: '11:00' }), // upcoming
      reminder({ id: 'r3', date: '2026-09-27', time: '10:00' }), // later upcoming
    ]
    const stats = plannerStats(tasks, reminders, NOW)
    expect(stats.todayTotal).toBe(2)
    expect(stats.todayDone).toBe(1)
    expect(stats.allTotal).toBe(4)
    expect(stats.nextReminder?.id).toBe('r2')
  })

  it('handles empty data and no upcoming reminders', () => {
    const stats = plannerStats([], [], NOW)
    expect(stats).toEqual({
      todayTotal: 0,
      todayDone: 0,
      allTotal: 0,
      nextReminder: null,
    })
  })
})

describe('normalizeAppData', () => {
  it('returns an empty document for junk', () => {
    for (const junk of [null, undefined, 42, 'text', []]) {
      const data = normalizeAppData(junk)
      expect(data.tasks).toEqual([])
      expect(data.reminders).toEqual([])
      expect(data.schemaVersion).toBe(1)
    }
  })

  it('keeps a valid record untouched', () => {
    const original = task({ id: 'keep', title: 'Read chapter 4', priority: 'high' })
    const data = normalizeAppData({ schemaVersion: 1, tasks: [original], reminders: [] })
    expect(data.tasks).toEqual([original])
  })

  it('drops records with no usable title or date', () => {
    const data = normalizeAppData({
      schemaVersion: 1,
      reminders: [],
      tasks: [
        task({ id: 'ok' }),
        { id: 'blank', title: '   ', date: '2026-09-26' },
        { id: 'baddate', title: 'Fine', date: '26-09-2026' },
        { id: '', title: 'No id', date: '2026-09-26' },
        null,
      ],
    })
    expect(data.tasks.map((item) => item.id)).toEqual(['ok'])
  })

  it('repairs unknown enum values with safe defaults', () => {
    const data = normalizeAppData({
      schemaVersion: 1,
      reminders: [],
      tasks: [task({ id: 'a', priority: 'urgent' as never, repeat: 'monthly' as never })],
    })
    expect(data.tasks[0]?.priority).toBe('medium')
    expect(data.tasks[0]?.repeat).toBe('none')
  })

  it('drops reminders with an invalid time', () => {
    const data = normalizeAppData({
      schemaVersion: 1,
      tasks: [],
      reminders: [reminder({ id: 'ok' }), { id: 'bad', title: 'X', date: '2026-09-26', time: '9' }],
    })
    expect(data.reminders.map((item) => item.id)).toEqual(['ok'])
  })

  it('de-duplicates repeated ids so a toggle cannot hit two records', () => {
    const data = normalizeAppData({
      schemaVersion: 1,
      reminders: [],
      tasks: [task({ id: 'same' }), task({ id: 'same', title: 'Other' })],
    })
    expect(data.tasks).toHaveLength(1)
  })

  it('refuses a document written by a newer schema', () => {
    const data = normalizeAppData({ schemaVersion: 99, tasks: [task({ id: 'a' })], reminders: [] })
    expect(data.tasks).toEqual([])
  })

  it('survives a tasks field of the wrong type', () => {
    const data = normalizeAppData({ schemaVersion: 1, tasks: 'nope', reminders: [] })
    expect(data.tasks).toEqual([])
  })

  it('normalizes a valid profile and drops an invalid one', () => {
    expect(
      normalizeAppData({
        schemaVersion: 1,
        profile: { name: '  Hisham  ' },
        tasks: [],
        reminders: [],
      }).profile,
    ).toEqual({ name: 'Hisham' })

    expect(
      normalizeAppData({ schemaVersion: 1, profile: { name: '   ' }, tasks: [], reminders: [] })
        .profile,
    ).toBeNull()

    expect(
      normalizeAppData({ schemaVersion: 1, profile: 'not-an-object', tasks: [], reminders: [] })
        .profile,
    ).toBeNull()

    expect(
      normalizeAppData({ schemaVersion: 1, profile: null, tasks: [], reminders: [] }).profile,
    ).toBeNull()
  })
})

describe('appended data stays a valid AppData', () => {
  it('round-trips through normalizeAppData unchanged', () => {
    const original: AppData = {
      schemaVersion: 1,
      profile: null,
      tasks: [task({ id: 'a', done: true, completedAt: 1, repeat: 'daily' })],
      reminders: [reminder({ id: 'b' })],
    }
    expect(normalizeAppData(JSON.parse(JSON.stringify(original)))).toEqual(original)
  })
})
