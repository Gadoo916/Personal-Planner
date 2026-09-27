import { describe, expect, it } from 'vitest'
import type { AppData, Reminder, Task } from '../storage/types'
import { createReminder, createTask, normalizeAppData } from './model'
import {
  addReminder,
  addTask,
  deleteReminder,
  deleteTask,
  setProfile,
  toggleTask,
  updateReminder,
  updateTask,
} from './mutations'

const NOW = new Date(2026, 8, 26, 9, 0, 0)

function empty(): AppData {
  return { schemaVersion: 1, profile: null, tasks: [], reminders: [] }
}

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

describe('addTask', () => {
  it('appends the new task', () => {
    const next = addTask(
      empty(),
      createTask(
        { title: 'Read chapter 4', date: '2026-09-26', priority: 'high', repeat: 'none' },
        NOW,
      ),
    )
    expect(next.tasks).toHaveLength(1)
    expect(next.tasks[0]?.title).toBe('Read chapter 4')
  })

  it('leaves the input document untouched', () => {
    const before = empty()
    addTask(
      before,
      createTask(
        { title: 'Read chapter 4', date: '2026-09-26', priority: 'high', repeat: 'none' },
        NOW,
      ),
    )
    expect(before.tasks).toEqual([])
  })
})

describe('addReminder', () => {
  it('appends the new reminder', () => {
    const next = addReminder(
      empty(),
      createReminder({ title: 'Exam', date: '2026-10-02', time: '09:00' }, NOW),
    )
    expect(next.reminders).toHaveLength(1)
    expect(next.reminders[0]?.time).toBe('09:00')
  })
})

describe('updateTask', () => {
  it('changes only the supplied fields', () => {
    const next = updateTask(
      { ...empty(), tasks: [task({ id: 'a', title: 'Old', priority: 'high' })] },
      'a',
      { priority: 'low' },
    )
    expect(next.tasks[0]).toMatchObject({ id: 'a', title: 'Old', priority: 'low' })
  })

  it('trims the title', () => {
    const next = updateTask({ ...empty(), tasks: [task({ id: 'a' })] }, 'a', { title: '  New  ' })
    expect(next.tasks[0]?.title).toBe('New')
  })

  it('cannot be used to complete a task behind the toggle’s back', () => {
    const base: AppData = { ...empty(), tasks: [task({ id: 'a' })] }
    const next = updateTask(base, 'a', { done: true } as never)
    expect(next.tasks[0]?.done).toBe(false)
    expect(next.tasks[0]?.completedAt).toBeNull()
  })

  it('does not spawn a clone, even for a repeating task', () => {
    const next = updateTask({ ...empty(), tasks: [task({ id: 'a', repeat: 'daily' })] }, 'a', {
      title: 'Stretch break',
    })
    expect(next.tasks).toHaveLength(1)
    expect(next.tasks[0]?.title).toBe('Stretch break')
  })

  it('ignores an edit aimed at a task that is gone', () => {
    const base: AppData = { ...empty(), tasks: [task({ id: 'a' })] }
    expect(updateTask(base, 'missing', { title: 'New' })).toBe(base)
  })
})

describe('toggleTask', () => {
  it('marks a task done and stamps completedAt', () => {
    const next = toggleTask({ ...empty(), tasks: [task({ id: 'a' })] }, 'a', NOW)
    expect(next.tasks[0]?.done).toBe(true)
    expect(next.tasks[0]?.completedAt).toBe(NOW.getTime())
  })

  it('reopens a task and clears completedAt', () => {
    const next = toggleTask(
      { ...empty(), tasks: [task({ id: 'a', done: true, completedAt: 5 })] },
      'a',
      NOW,
    )
    expect(next.tasks[0]?.done).toBe(false)
    expect(next.tasks[0]?.completedAt).toBeNull()
  })

  it('is its own inverse for a task that does not repeat', () => {
    const base: AppData = { ...empty(), tasks: [task({ id: 'a' })] }
    const roundTrip = toggleTask(toggleTask(base, 'a', NOW), 'a', NOW)
    expect(roundTrip).toEqual(base)
  })

  it('rolls a repeating task forward when completing', () => {
    const next = toggleTask(
      {
        ...empty(),
        tasks: [task({ id: 'a', title: 'Stretch', repeat: 'daily', date: '2026-09-26' })],
      },
      'a',
      NOW,
    )
    expect(next.tasks).toHaveLength(2)
    const [original, clone] = next.tasks
    expect(original).toMatchObject({
      id: 'a',
      title: 'Stretch',
      date: '2026-09-26',
      done: true,
      completedAt: NOW.getTime(),
    })
    expect(clone).toMatchObject({
      id: expect.any(String),
      title: 'Stretch',
      date: '2026-09-27',
      done: false,
      completedAt: null,
      repeat: 'daily',
    })
    expect(clone?.id).not.toBe('a')
  })

  it('adds a week for a weekly task', () => {
    const next = toggleTask(
      { ...empty(), tasks: [task({ id: 'a', repeat: 'weekly', date: '2026-09-26' })] },
      'a',
      NOW,
    )
    expect(next.tasks[1]?.date).toBe('2026-10-03')
  })

  it('only ever rolls forward once per completion', () => {
    let data: AppData = { ...empty(), tasks: [task({ id: 'a', repeat: 'daily' })] }
    data = toggleTask(data, 'a', NOW)
    const rolledId = data.tasks[1]!.id
    data = toggleTask(data, rolledId, NOW)
    expect(data.tasks.filter((item) => item.date === '2026-09-28')).toHaveLength(1)
    expect(data.tasks).toHaveLength(3)
  })

  it('un-completes a rolled-forward task without creating a fourth record', () => {
    let data: AppData = { ...empty(), tasks: [task({ id: 'a', repeat: 'daily' })] }
    data = toggleTask(data, 'a', NOW)
    data = toggleTask(data, 'a', NOW)
    expect(data.tasks).toHaveLength(2)
    expect(data.tasks[0]).toMatchObject({ id: 'a', done: false, completedAt: null })
  })

  it('leaves the list alone for an unknown id', () => {
    const base: AppData = { ...empty(), tasks: [task({ id: 'a' })] }
    expect(toggleTask(base, 'missing', NOW)).toBe(base)
  })
})

describe('deleteTask', () => {
  it('removes only the requested task', () => {
    const base: AppData = { ...empty(), tasks: [task({ id: 'a' }), task({ id: 'b' })] }
    expect(deleteTask(base, 'a').tasks.map((item) => item.id)).toEqual(['b'])
  })

  it('is a no-op for an unknown id', () => {
    const base: AppData = { ...empty(), tasks: [task({ id: 'a' })] }
    expect(deleteTask(base, 'missing')).toBe(base)
  })
})

describe('reminder mutations', () => {
  it('updates date, time and title', () => {
    const base: AppData = { ...empty(), reminders: [reminder({ id: 'a' })] }
    const next = updateReminder(base, 'a', {
      date: '2026-10-01',
      time: '07:45',
      title: ' Exam ',
    })
    expect(next.reminders[0]).toMatchObject({
      title: 'Exam',
      date: '2026-10-01',
      time: '07:45',
    })
  })

  it('leaves a reminder without a completion concept', () => {
    const base: AppData = { ...empty(), reminders: [reminder({ id: 'a' })] }
    const next = updateReminder(base, 'a', { time: '11:00' })
    expect(next.reminders[0]).toEqual({ ...reminder({ id: 'a' }), time: '11:00' })
  })

  it('ignores an edit aimed at a reminder that is gone', () => {
    const base: AppData = { ...empty(), reminders: [reminder({ id: 'a' })] }
    expect(updateReminder(base, 'missing', { time: '11:00' })).toBe(base)
  })

  it('deletes the requested reminder and no other', () => {
    const base: AppData = {
      ...empty(),
      reminders: [reminder({ id: 'a' }), reminder({ id: 'b' })],
    }
    expect(deleteReminder(base, 'a').reminders.map((item) => item.id)).toEqual(['b'])
    expect(deleteReminder(base, 'missing')).toBe(base)
  })
})

describe('setProfile', () => {
  it('stores a trimmed name', () => {
    const base: AppData = { ...empty(), profile: null }
    const next = setProfile(base, '  Hisham  ')
    expect(next.profile).toEqual({ name: 'Hisham' })
  })

  it('does not change other fields', () => {
    const base: AppData = {
      ...empty(),
      tasks: [task({ id: 't1' })],
      reminders: [reminder({ id: 'r1' })],
    }
    const next = setProfile(base, 'Hisham')
    expect(next.tasks).toEqual(base.tasks)
    expect(next.reminders).toEqual(base.reminders)
    expect(next.profile).toEqual({ name: 'Hisham' })
  })
})

describe('mutations keep the document persistable', () => {
  it('survives a normalize round trip after a mixed sequence', () => {
    let data = empty()
    data = addTask(
      data,
      createTask({ title: 'Stretch', date: '2026-09-26', priority: 'high', repeat: 'daily' }, NOW),
    )
    const firstId = data.tasks[0]!.id
    data = toggleTask(data, firstId, NOW)
    data = addReminder(
      data,
      createReminder({ title: 'Exam', date: '2026-10-02', time: '09:00' }, NOW),
    )
    data = updateTask(data, data.tasks[1]!.id, { title: 'Stretch break' })
    data = deleteTask(data, firstId)

    expect(normalizeAppData(JSON.parse(JSON.stringify(data)))).toEqual(data)
  })
})
