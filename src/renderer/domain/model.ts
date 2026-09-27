import {
  addDaysISO,
  formatDayDate,
  formatDayLabel,
  isClockTime,
  isISODate,
  todayISO,
} from '../lib/dates'
import { log } from '../lib/log'
import { isOverdue } from '../lib/relativeTime'
import {
  type AppData,
  emptyAppData,
  isPriority,
  isRepeat,
  PRIORITY_RANK,
  type Priority,
  type ProductivityDay,
  type Profile,
  type Reminder,
  type Repeat,
  SCHEMA_VERSION,
  type Task,
  TITLE_MAX,
} from '../storage/types'

export interface TaskDraft {
  title: string
  date: string
  priority: Priority
  repeat: Repeat
}

export interface ReminderDraft {
  title: string
  date: string
  time: string
}

export function createId(): string {
  return crypto.randomUUID()
}

export function normalizeTitle(value: string): string {
  return value.trim().slice(0, TITLE_MAX)
}

export function createTask(draft: TaskDraft, now: Date = new Date()): Task {
  return {
    id: createId(),
    title: normalizeTitle(draft.title),
    date: draft.date,
    priority: draft.priority,
    repeat: draft.repeat,
    done: false,
    createdAt: now.getTime(),
    completedAt: null,
  }
}

export function createReminder(draft: ReminderDraft, now: Date = new Date()): Reminder {
  return {
    id: createId(),
    title: normalizeTitle(draft.title),
    date: draft.date,
    time: draft.time,
    createdAt: now.getTime(),
  }
}

/** Daily and weekly both preserve the task's own day; weekly just adds a week. */
export function nextOccurrence(dateISO: string, repeat: Repeat): string {
  if (repeat === 'daily') return addDaysISO(dateISO, 1)
  if (repeat === 'weekly') return addDaysISO(dateISO, 7)
  return dateISO
}

export interface TaskDayGroup {
  key: string
  label: string
  dateLabel: string
  /** Drives the design system's emphasised treatment for the current day. */
  isToday: boolean
  tasks: Task[]
}

/** Day ascending, then priority high to low, then open before done, then oldest. */
export function compareTasks(a: Task, b: Task): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (rank !== 0) return rank
  if (a.done !== b.done) return a.done ? 1 : -1
  return a.createdAt - b.createdAt
}

export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(compareTasks)
}

export function groupTasksByDay(tasks: readonly Task[], now: Date = new Date()): TaskDayGroup[] {
  const groups = new Map<string, Task[]>()
  for (const task of tasks) {
    const bucket = groups.get(task.date)
    if (bucket) bucket.push(task)
    else groups.set(task.date, [task])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, dayTasks]) => ({
      key,
      label: formatDayLabel(key, now),
      dateLabel: formatDayDate(key),
      isToday: key === todayISO(now),
      tasks: dayTasks.sort(compareTasks),
    }))
}

export function compareReminders(a: Reminder, b: Reminder): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.time !== b.time) return a.time < b.time ? -1 : 1
  return a.createdAt - b.createdAt
}

export function sortReminders(reminders: readonly Reminder[]): Reminder[] {
  return [...reminders].sort(compareReminders)
}

export interface PlannerStats {
  /** Tasks dated today, open or done. */
  todayTotal: number
  /** Of those, the ones finished. */
  todayDone: number
  allTotal: number
  /** The nearest moment still to arrive, or null when none is left. */
  nextReminder: Reminder | null
}

/**
 * The four numbers the welcome strip shows, counted off the stored document as
 * it stands. Nothing is aggregated or recorded: every figure is a count of rows
 * that already exist, so the strip cannot drift from the lists below it.
 */
export function plannerStats(
  tasks: readonly Task[],
  reminders: readonly Reminder[],
  now: Date = new Date(),
): PlannerStats {
  const today = todayISO(now)
  let todayTotal = 0
  let todayDone = 0

  for (const task of tasks) {
    if (task.date !== today) continue
    todayTotal += 1
    if (task.done) todayDone += 1
  }

  const nextReminder =
    sortReminders(reminders).find((reminder) => !isOverdue(reminder.date, reminder.time, now)) ??
    null

  return { todayTotal, todayDone, allTotal: tasks.length, nextReminder }
}

/* ------------------------------------------------------- load-time repair */

function readTask(raw: unknown): Task | null {
  if (raw === null || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id === '') return null

  const title = typeof record.title === 'string' ? normalizeTitle(record.title) : ''
  if (title === '' || !isISODate(record.date)) return null

  return {
    id: record.id,
    title,
    date: record.date,
    priority: isPriority(record.priority) ? record.priority : 'medium',
    repeat: isRepeat(record.repeat) ? record.repeat : 'none',
    done: record.done === true,
    createdAt:
      typeof record.createdAt === 'number' && Number.isFinite(record.createdAt)
        ? record.createdAt
        : 0,
    completedAt:
      typeof record.completedAt === 'number' && Number.isFinite(record.completedAt)
        ? record.completedAt
        : null,
  }
}

function readReminder(raw: unknown): Reminder | null {
  if (raw === null || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id === '') return null

  const title = typeof record.title === 'string' ? normalizeTitle(record.title) : ''
  if (title === '' || !isISODate(record.date) || !isClockTime(record.time)) return null

  return {
    id: record.id,
    title,
    date: record.date,
    time: record.time,
    createdAt:
      typeof record.createdAt === 'number' && Number.isFinite(record.createdAt)
        ? record.createdAt
        : 0,
  }
}

function readList<T extends { id: string }>(
  raw: unknown,
  read: (item: unknown) => T | null,
  label: string,
): T[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    log.warn('storage.unexpected_shape', { field: label })
    return []
  }
  const seen = new Set<string>()
  const result: T[] = []
  let dropped = 0
  for (const item of raw) {
    const value = read(item)
    if (!value || seen.has(value.id)) {
      dropped += 1
      continue
    }
    seen.add(value.id)
    result.push(value)
  }
  if (dropped > 0) log.warn('storage.records_dropped', { field: label, count: dropped })
  return result
}

/** A profile is a name and nothing else; anything else reads as no profile. */
function readProfile(raw: unknown): Profile | null {
  if (raw === null || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (typeof record.name !== 'string') return null
  const name = normalizeTitle(record.name)
  return name === '' ? null : { name }
}

function readProductivityDay(raw: unknown): ProductivityDay | null {
  if (raw === null || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const minutes = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
  return {
    focusMinutes: minutes(record.focusMinutes),
    breakMinutes: minutes(record.breakMinutes),
    focusSessions: minutes(record.focusSessions),
    focusBlocks: minutes(record.focusBlocks),
  }
}

/** Reads the productivity map, dropping days with no usable record. */
function readProductivity(raw: unknown): Record<string, ProductivityDay> | undefined {
  if (raw === undefined) return undefined
  if (raw === null || typeof raw !== 'object') {
    log.warn('storage.unexpected_shape', { field: 'productivity' })
    return undefined
  }
  const result: Record<string, ProductivityDay> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isISODate(key)) continue
    const day = readProductivityDay(value)
    if (day) result[key] = day
  }
  return result
}

/**
 * Turns whatever was on disk into a valid AppData. Unreadable records are
 * dropped rather than propagated, so a damaged file can never crash the screen.
 */
export function normalizeAppData(raw: unknown): AppData {
  if (raw === null || typeof raw !== 'object') return emptyAppData()

  const document = raw as Record<string, unknown>
  const version = typeof document.schemaVersion === 'number' ? document.schemaVersion : 0

  if (version > SCHEMA_VERSION) {
    log.warn('storage.unmigrated', { found: version, supported: SCHEMA_VERSION })
    return emptyAppData()
  }
  if (version < SCHEMA_VERSION) {
    log.warn('storage.migration_required', { found: version, supported: SCHEMA_VERSION })
  }

  const productivity = readProductivity(document.productivity)
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: readProfile(document.profile),
    tasks: readList(document.tasks, readTask, 'tasks'),
    reminders: readList(document.reminders, readReminder, 'reminders'),
    ...(productivity === undefined ? {} : { productivity }),
  }
}
