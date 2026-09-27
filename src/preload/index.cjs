const { contextBridge, ipcRenderer } = require('electron')

/**
 * CommonJS on purpose: a sandboxed preload cannot use ESM imports, and the
 * CommonJS form blocks page load, which removes the preload race that the
 * `.mjs` variant is subject to. Runs with sandbox: true, contextIsolation: true.
 */

contextBridge.exposeInMainWorld('planner', {
  load: () => ipcRenderer.invoke('planner:load'),
  /** @param {unknown} document */
  save: (document) => ipcRenderer.invoke('planner:save', document),
})
