import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { log } from './logger.js'

/**
 * The main process stores an opaque JSON document. It has no knowledge of the
 * data model, which keeps the storage port replaceable by a future sync
 * implementation without touching anything else.
 */

const FILE_NAME = 'planner-data.json'

function dataPath() {
  return join(app.getPath('userData'), FILE_NAME)
}

/** @param {unknown} error */
function errorCode(error) {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    return String(error.code)
  }
  return ''
}

/**
 * A damaged file is quarantined, never deleted and never allowed to surface as
 * an exception in the UI.
 * @param {string} file
 */
async function quarantine(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  try {
    await rename(file, `${file}.corrupt-${stamp}`)
    log.warn('storage.corrupt_quarantined')
  } catch (error) {
    log.error('storage.quarantine_failed', error)
  }
}

/** @returns {Promise<unknown>} the stored document, or null when there is none */
export async function readData() {
  const file = dataPath()
  try {
    const raw = await readFile(file, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      log.info('storage.absent')
      return null
    }
    if (error instanceof SyntaxError) {
      log.error('storage.corrupt', error)
      await quarantine(file)
      return null
    }
    log.error('storage.read_failed', error)
    return null
  }
}

/**
 * Writes through a temporary file and renames it into place, so a crash or a
 * forced quit mid-write can never leave a half-written document behind.
 * @param {unknown} document
 */
export async function writeData(document) {
  const file = dataPath()
  const temp = `${file}.tmp`
  try {
    await mkdir(app.getPath('userData'), { recursive: true })
    await writeFile(temp, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
    await rename(temp, file)
  } catch (error) {
    log.error('storage.write_failed', error)
  }
}
