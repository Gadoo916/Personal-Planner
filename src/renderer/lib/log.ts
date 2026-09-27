/**
 * Three levels, no library, no transport, no remote sink.
 * Never logs titles, dates or times — only counts, truncated ids and timings.
 */

type Level = 'info' | 'warn' | 'error'
type Meta = Record<string, string | number | boolean>

const isDev = import.meta.env.DEV
const ENABLED: Record<Level, boolean> = { info: isDev, warn: isDev, error: true }

/** Keeps identifiers useful for correlation without exposing full values. */
export function ref(value: string): string {
  return value.length <= 4 ? value : `…${value.slice(-4)}`
}

function emit(level: Level, event: string, meta?: Meta): void {
  if (!ENABLED[level]) return
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'
  if (meta) {
    console[method](`[planner] ${event}`, meta)
  } else {
    console[method](`[planner] ${event}`)
  }
}

export const log = {
  info(event: string, meta?: Meta): void {
    emit('info', event, meta)
  },
  warn(event: string, meta?: Meta): void {
    emit('warn', event, meta)
  },
  error(event: string, error: unknown): void {
    emit('error', event, {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    })
  },
}
