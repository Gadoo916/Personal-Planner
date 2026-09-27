import { app, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'
import { log } from './logger.js'

/**
 * The app's only network access, and the only reason it has a runtime
 * dependency. Everything here runs in the main process: the renderer is told
 * that an update exists and is asked whether to install it, and it never sees a
 * network API.
 *
 * The check happens once per launch and is never repeated. There is no interval,
 * no re-check on focus, and no manual trigger, so the app makes at most one
 * request to GitHub's release API per run and stays silent afterwards.
 *
 * The CommonJS dependency is imported through its default export because Node's
 * named-export detection does not see electron-updater's lazy `autoUpdater`
 * getter, so `import { autoUpdater }` is undefined at runtime.
 */

const { autoUpdater } = electronUpdater

/** @typedef {'available' | 'downloaded'} UpdateStatus */
/** @typedef {{ status: UpdateStatus, version: string }} UpdateState */
/** @typedef {() => import('electron').BrowserWindow | null} WindowProvider */

/** @type {UpdateState | null} */
let state = null

/** @type {boolean} */
let started = false

/**
 * A downloaded update is installed when the user says so and not when they
 * happen to quit. electron-updater's default is to install on quit, which would
 * make a restart the confirmation — and the brief is explicit that it must not be.
 */
autoUpdater.autoInstallOnAppQuit = false

/**
 * The failures already written, so a single failure is only ever written once.
 * A failed check reaches us twice — once as an `error` event and once as a
 * rejected promise, carrying the same Error — and a 3KB HTTP dump in the log
 * twice helps nobody.
 * @type {WeakSet<object>}
 */
const reported = new WeakSet()

/**
 * @param {unknown} error
 */
function reportFailure(error) {
  if (typeof error === 'object' && error !== null) {
    if (reported.has(error)) return
    reported.add(error)
  }
  log.error('update.failed', error)
}

/**
 * @param {WindowProvider} getWindow
 */
export function createUpdateService(getWindow) {
  /**
   * @param {UpdateState} next
   */
  function publish(next) {
    state = next
    const target = getWindow()
    if (!target || target.isDestroyed()) return
    target.webContents.send('planner:update-status', next)
  }

  autoUpdater.removeAllListeners()
  autoUpdater.on('update-available', (info) => {
    log.info('update.available', { version: info.version })
    publish({ status: 'available', version: info.version })
  })
  autoUpdater.on('update-downloaded', (info) => {
    log.info('update.downloaded', { version: info.version })
    publish({ status: 'downloaded', version: info.version })
  })
  // Logged and dropped. A failed check is the app's problem, not the user's:
  // offline is the normal state of this app, so an error here must never reach
  // the screen or interrupt anything.
  autoUpdater.on('error', (error) => {
    reportFailure(error)
  })

  // The banner asks for the current state as it mounts, so a check that landed
  // before React subscribed is not lost.
  ipcMain.handle('planner:current-update', () => state)
  ipcMain.handle('planner:install-update', () => {
    if (state?.status !== 'downloaded') return
    log.info('update.installing', { version: state.version })
    autoUpdater.quitAndInstall()
  })

  return {
    /**
     * Once per launch, after the window exists, and not awaited: a slow or
     * unreachable release API must not hold up the first frame.
     */
    start() {
      // The one-check-per-launch rule is enforced here rather than left to the
      // caller, so a second call — from a future focus handler, say — cannot turn
      // one request per run into one per window.
      if (started) return
      started = true

      if (!app.isPackaged) {
        // An unpackaged run has no app-update.yml and no installer to hand the
        // update to, so there is nothing to check for.
        log.info('update.skipped', { reason: 'unpackaged' })
        return
      }
      void autoUpdater.checkForUpdates().catch((error) => {
        reportFailure(error)
      })
    },
  }
}
