const { contextBridge, ipcRenderer } = require('electron')

/**
 * CommonJS on purpose: a sandboxed preload cannot use ESM imports, and the
 * CommonJS form blocks page load, which removes the preload race that the
 * `.mjs` variant is subject to. Runs with sandbox: true, contextIsolation: true.
 */

/** @typedef {{ status: 'available' | 'downloaded', version: string }} UpdateState */
/** @typedef {(state: UpdateState | null) => void} StatusListener */

contextBridge.exposeInMainWorld('planner', {
  load: () => ipcRenderer.invoke('planner:load'),
  /** @param {unknown} document */
  save: (document) => ipcRenderer.invoke('planner:save', document),
})

/**
 * A sibling of `planner`, not an extension of it: this is not storage, and
 * keeping the storage port at two methods is what lets it be the one boundary
 * with two implementations. Two functions again, and no more — the renderer can
 * read the current update state, be told when it changes, and ask for an
 * install. It cannot make a request, read a file, or hold a channel.
 */
contextBridge.exposeInMainWorld('updates', {
  /** @param {StatusListener} listener */
  onStatus: (listener) => {
    /**
     * The event object is dropped rather than forwarded, so the renderer only
     * ever sees the state it is allowed to see.
     * @param {unknown} _event
     * @param {UpdateState | null} state
     */
    const handler = (_event, state) => listener(state)

    ipcRenderer.on('planner:update-status', handler)
    // The main process may already have reported an update before this
    // subscribed, so the current state is replayed on the way in. A failed
    // replay just means there is nothing to show.
    ipcRenderer.invoke('planner:current-update').then(listener, () => undefined)
    return () => ipcRenderer.removeListener('planner:update-status', handler)
  },
  install: () => ipcRenderer.invoke('planner:install-update'),
})
