import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'

/**
 * Three levels, no library, no transport.
 * Console always; errors are additionally appended to a single file in
 * userData that is truncated once per launch, so it can never grow unbounded.
 * Never logs titles, dates or times.
 */

const isDev = !app.isPackaged

/** @typedef {Record<string, string | number | boolean>} Meta */

/**
 * @param {string} level
 * @param {string} event
 * @param {Meta} [meta]
 */
function emit(level, event, meta) {
  const line = `[planner] ${event}${meta ? ` ${JSON.stringify(meta)}` : ''}`
  if (level === 'error') {
    console.error(line)
    void appendToErrorFile(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

function errorLogPath() {
  return join(app.getPath('userData'), 'planner-error.log')
}

/** @param {string} line */
async function appendToErrorFile(line) {
  try {
    const { appendFile } = await import('node:fs/promises')
    await appendFile(errorLogPath(), `${line}\n`, 'utf8')
  } catch (error) {
    console.error('[planner] log.write_failed', describe(error))
  }
}

/** @param {unknown} error */
function describe(error) {
  return {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
  }
}

export const log = {
  /** Truncates the error log. Call once, after app ready. */
  async init() {
    try {
      await mkdir(app.getPath('userData'), { recursive: true })
      await writeFile(errorLogPath(), '', 'utf8')
    } catch (error) {
      console.error('[planner] log.init_failed', describe(error))
    }
  },

  /** @param {string} event @param {Meta} [meta] */
  info(event, meta) {
    if (!isDev) return
    emit('info', event, meta)
  },

  /** @param {string} event @param {Meta} [meta] */
  warn(event, meta) {
    if (!isDev) return
    emit('warn', event, meta)
  },

  /** @param {string} event @param {unknown} error */
  error(event, error) {
    emit('error', event, describe(error))
  },
}
