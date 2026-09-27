/**
 * The single source of truth for persisted shapes.
 * The Electron main process never imports this — it stores an opaque document.
 */

export type Priority = 'high' | 'medium' | 'low'
export type Repeat = 'none' | 'daily' | 'weekly'

export interface Task {
  id: string
  title: string
  /** Local calendar date, 'YYYY-MM-DD'. Never a UTC instant. */
  date: string
  priority: Priority
  repeat: Repeat
  done: boolean
  createdAt: number
  completedAt: number | null
}

export interface Reminder {
  id: string
  title: string
  /** Local calendar date, 'YYYY-MM-DD'. */
  date: string
  /** 24-hour clock, 'HH:mm'. */
  time: string
  createdAt: number
}

/** Who the planner belongs to. A name and nothing else: no account, no email. */
export interface Profile {
  name: string
}

/** One calendar day of measured productivity. Rebuilt from events, never
 *  entered by hand, so the figures always match what the user actually did. */
export interface ProductivityDay {
  focusMinutes: number
  breakMinutes: number
  focusSessions: number
  /** Only ever incremented by sessions that used focus blocks. */
  focusBlocks: number
}

export interface AppData {
  schemaVersion: number
  /** Null until the first launch has asked for a name. */
  profile: Profile | null
  tasks: Task[]
  reminders: Reminder[]
  /** Keyed by 'YYYY-MM-DD'. Absent until the first Focus Session ends. */
  productivity?: Record<string, ProductivityDay>
}

export const SCHEMA_VERSION = 1
export const TITLE_MAX = 200

export const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low']
export const REPEATS: readonly Repeat[] = ['none', 'daily', 'weekly']

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

export function emptyAppData(): AppData {
  return { schemaVersion: SCHEMA_VERSION, profile: null, tasks: [], reminders: [] }
}

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value)
}

export function isRepeat(value: unknown): value is Repeat {
  return typeof value === 'string' && (REPEATS as readonly string[]).includes(value)
}
