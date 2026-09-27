import { log, ref } from '../lib/log'
import type { AppData, Reminder, Task } from '../storage/types'
import {
  createId,
  createReminder,
  createTask,
  nextOccurrence,
  normalizeTitle,
  type ReminderDraft,
  type TaskDraft,
} from './model'
import { type FocusSessionResult, mergeSessionResult } from './productivity'

/** Every mutation is a pure AppData -> AppData function. No IO, no logging
 *  inside the transform itself; the hook logs at the boundary. */

export function setProfile(data: AppData, name: string): AppData {
  return { ...data, profile: { name: normalizeTitle(name) } }
}

function replaceTask(data: AppData, id: string, update: (task: Task) => Task): AppData {
  let changed = false
  const tasks = data.tasks.map((task) => {
    if (task.id !== id) return task
    changed = true
    return update(task)
  })
  return changed ? { ...data, tasks } : data
}

export function addTask(data: AppData, draft: TaskDraft, now: Date = new Date()): AppData {
  return { ...data, tasks: [...data.tasks, createTask(draft, now)] }
}

export function updateTask(data: AppData, id: string, patch: Partial<TaskDraft>): AppData {
  return replaceTask(data, id, (task) => ({
    ...task,
    title: patch.title === undefined ? task.title : normalizeTitle(patch.title),
    date: patch.date ?? task.date,
    priority: patch.priority ?? task.priority,
    repeat: patch.repeat ?? task.repeat,
  }))
}

/**
 * Completing a repeating task marks the current one done and rolls the task
 * forward to its next occurrence. Toggling a done task always just un-completes.
 */
export function toggleTask(data: AppData, id: string, now: Date = new Date()): AppData {
  const task = data.tasks.find((item) => item.id === id)
  if (!task) return data

  if (task.done) {
    return replaceTask(data, id, (item) => ({ ...item, done: false, completedAt: null }))
  }

  const completed = replaceTask(data, id, (item) => ({
    ...item,
    done: true,
    completedAt: now.getTime(),
  }))

  if (task.repeat === 'none') return completed

  const rolled: Task = {
    ...task,
    id: createId(),
    date: nextOccurrence(task.date, task.repeat),
    done: false,
    completedAt: null,
    createdAt: now.getTime(),
  }
  log.info('task.rolled_forward', { from: ref(task.date), repeat: task.repeat })
  return { ...completed, tasks: [...completed.tasks, rolled] }
}

export function deleteTask(data: AppData, id: string): AppData {
  if (!data.tasks.some((task) => task.id === id)) return data
  return { ...data, tasks: data.tasks.filter((task) => task.id !== id) }
}

function replaceReminder(
  data: AppData,
  id: string,
  update: (reminder: Reminder) => Reminder,
): AppData {
  let changed = false
  const reminders = data.reminders.map((reminder) => {
    if (reminder.id !== id) return reminder
    changed = true
    return update(reminder)
  })
  return changed ? { ...data, reminders } : data
}

export function addReminder(data: AppData, draft: ReminderDraft, now: Date = new Date()): AppData {
  return { ...data, reminders: [...data.reminders, createReminder(draft, now)] }
}

export function updateReminder(data: AppData, id: string, patch: Partial<ReminderDraft>): AppData {
  return replaceReminder(data, id, (reminder) => ({
    ...reminder,
    title: patch.title === undefined ? reminder.title : normalizeTitle(patch.title),
    date: patch.date ?? reminder.date,
    time: patch.time ?? reminder.time,
  }))
}

export function deleteReminder(data: AppData, id: string): AppData {
  if (!data.reminders.some((reminder) => reminder.id === id)) return data
  return { ...data, reminders: data.reminders.filter((reminder) => reminder.id !== id) }
}

/**
 * Folds one finished Focus Session into the day it ended on. The session is
 * never stored as a session — only its measured result — so a restart cannot
 * resurrect a timer, and the day record stays the single source of truth.
 */
export function recordFocusSession(
  data: AppData,
  dayISO: string,
  result: FocusSessionResult,
): AppData {
  const productivity = { ...(data.productivity ?? {}) }
  productivity[dayISO] = mergeSessionResult(productivity[dayISO], result)
  return { ...data, productivity }
}
