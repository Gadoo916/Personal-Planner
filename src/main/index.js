import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain } from 'electron'
import { readData, writeData } from './dataFile.js'
import { log } from './logger.js'

/**
 * ESM main process, unbundled. It has no npm dependencies, so there is nothing
 * for a bundler to do here.
 */

const here = dirname(fileURLToPath(import.meta.url))
const preloadPath = join(here, '..', 'preload', 'index.cjs')
const rendererEntry = join(here, '..', '..', 'dist', 'index.html')

const devServerUrl = process.env.VITE_DEV_SERVER_URL
const isDev = Boolean(devServerUrl)

/**
 * The window background sits outside the CSS cascade, so it cannot read
 * var(--color-canvas). tokens.test.ts asserts this value stays equal to that
 * token, which keeps tokens.css the single source of visual truth.
 */
const CANVAS = '#ffffff'

/** @type {BrowserWindow | null} */
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 880,
    minWidth: 680,
    minHeight: 560,
    show: false,
    backgroundColor: CANVAS,
    title: 'Personal Planner',
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // The app is offline by design: no popups and no off-app navigation.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(rendererEntry)
  }
}

function registerIpc() {
  ipcMain.handle('planner:load', () => readData())
  ipcMain.handle('planner:save', (_event, document) => writeData(document))
}

function focusExistingWindow() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', focusExistingWindow)

  void app.whenReady().then(async () => {
    await log.init()
    log.info('app.boot', { mode: isDev ? 'dev' : 'packaged' })
    registerIpc()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
