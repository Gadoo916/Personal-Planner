// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The update glue is the only code in the app that talks to the network, and the
 * only part that can install something over the user. These tests pin the three
 * rules that matter: nothing is installed without a press, the check happens
 * exactly once, and a failure never leaves the main process.
 */

const h = vi.hoisted(() => {
  const listeners = new Map()
  /** @type {{ channel: string, payload: unknown }[]} */
  const sent = []
  return {
    listeners,
    sent,
    handlers: new Map(),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    app: { isPackaged: true },
    updater: {
      autoDownload: true,
      autoInstallOnAppQuit: true,
      checkForUpdates: vi.fn(async () => null),
      quitAndInstall: vi.fn(),
      removeAllListeners: vi.fn(),
      on: vi.fn(),
    },
  }
})

vi.mock('electron', () => ({
  app: h.app,
  ipcMain: {
    /**
     * @param {string} channel
     * @param {() => unknown} handler
     */
    handle: (channel, handler) => h.handlers.set(channel, handler),
  },
}))

// The CommonJS default export, because that is the only shape Node's interop
// hands over for this package.
vi.mock('electron-updater', () => ({ default: { autoUpdater: h.updater } }))
vi.mock('./logger.js', () => ({ log: h.log }))

/** @type {typeof import('./updater.js').createUpdateService} */
let createUpdateService

/** A window that is only ever asked to receive a message. */
function windowStub() {
  return /** @type {import('electron').BrowserWindow} */ ({
    isDestroyed: () => false,
    webContents: {
      /**
       * @param {string} channel
       * @param {unknown} payload
       */
      send: (channel, payload) => {
        h.sent.push({ channel, payload })
      },
    },
  })
}

beforeEach(async () => {
  // A fresh module each time, so the retained state one service hands the next
  // cannot leak between tests.
  vi.resetModules()
  createUpdateService = (await import('./updater.js')).createUpdateService

  h.listeners.clear()
  h.sent.length = 0
  h.handlers.clear()
  h.app.isPackaged = true
  h.updater.checkForUpdates.mockClear()
  h.updater.quitAndInstall.mockClear()
  h.updater.removeAllListeners.mockImplementation(() => h.listeners.clear())
  h.updater.on.mockImplementation((event, listener) => h.listeners.set(event, listener))
  h.log.info.mockClear()
  h.log.error.mockClear()
})

describe('update service', () => {
  it('never installs on its own, even when the app quits', () => {
    createUpdateService(() => windowStub())
    // electron-updater ships this as true, which would make a restart the
    // user's confirmation. It is the reason this module exists.
    expect(h.updater.autoInstallOnAppQuit).toBe(false)
    expect(h.updater.autoDownload).toBe(true)
  })

  it('checks once per launch and never again', () => {
    const updates = createUpdateService(() => windowStub())

    updates.start()
    updates.start()
    updates.start()

    expect(h.updater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('skips the check in an unpackaged run, which has nothing to install into', () => {
    h.app.isPackaged = false
    const updates = createUpdateService(() => windowStub())

    updates.start()

    expect(h.updater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('forwards a found update and then a finished download to the window', () => {
    createUpdateService(() => windowStub())

    h.listeners.get('update-available')({ version: '1.1.0' })
    h.listeners.get('update-downloaded')({ version: '1.1.0' })

    expect(h.sent).toEqual([
      { channel: 'planner:update-status', payload: { status: 'available', version: '1.1.0' } },
      { channel: 'planner:update-status', payload: { status: 'downloaded', version: '1.1.0' } },
    ])
  })

  it('replays the state a late subscriber asks for', () => {
    createUpdateService(() => windowStub())
    h.listeners.get('update-downloaded')({ version: '1.1.0' })

    const current = h.handlers.get('planner:current-update')

    expect(current()).toEqual({ status: 'downloaded', version: '1.1.0' })
  })

  it('has no state to replay before anything has been found', () => {
    createUpdateService(() => windowStub())
    expect(h.handlers.get('planner:current-update')()).toBeNull()
  })

  it('installs only a downloaded update, and only when asked', () => {
    createUpdateService(() => windowStub())
    const install = h.handlers.get('planner:install-update')

    // Found but not finished: there is nothing to install yet.
    h.listeners.get('update-available')({ version: '1.1.0' })
    install()
    expect(h.updater.quitAndInstall).not.toHaveBeenCalled()

    h.listeners.get('update-downloaded')({ version: '1.1.0' })
    install()
    expect(h.updater.quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed check to the log, and tells the window nothing', async () => {
    const failure = new Error('getaddrinfo ENOTFOUND api.github.com')
    h.updater.checkForUpdates.mockRejectedValueOnce(failure)
    createUpdateService(() => windowStub())

    createUpdateService(() => windowStub()).start()
    await vi.waitFor(() => expect(h.log.error).toHaveBeenCalledTimes(1))

    expect(h.log.error.mock.calls[0]?.[0]).toBe('update.failed')
    expect(h.sent).toEqual([])
    // The updater's own error event is the second half of the same silence.
    h.listeners.get('error')(failure)
    expect(h.sent).toEqual([])
  })

  // One failure arrives as an event *and* a rejection, carrying one Error. The
  // log is a fixed-size file that a user may well open, so it gets one line.
  it('writes one failed check to the log once, whichever half arrives first', async () => {
    const failure = new Error('getaddrinfo ENOTFOUND api.github.com')
    h.updater.checkForUpdates.mockRejectedValueOnce(failure)
    createUpdateService(() => windowStub()).start()

    h.listeners.get('error')(failure)
    await vi.waitFor(() => expect(h.log.error).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(h.log.error).toHaveBeenCalledTimes(1)
  })

  it('still reports a second, different failure rather than swallowing it', async () => {
    h.updater.checkForUpdates.mockRejectedValueOnce(new Error('first'))
    createUpdateService(() => windowStub()).start()
    await vi.waitFor(() => expect(h.log.error).toHaveBeenCalledTimes(1))

    h.listeners.get('error')(new Error('second'))
    expect(h.log.error).toHaveBeenCalledTimes(2)
  })

  it('does not throw when the window has already gone', () => {
    createUpdateService(() => null)
    expect(() => h.listeners.get('update-available')({ version: '1.1.0' })).not.toThrow()
  })
})
