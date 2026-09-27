import { useCallback, useEffect, useState } from 'react'
import { log } from '../lib/log'

/**
 * The renderer's whole view of the updater: two functions in, one piece of state
 * out. There is no network here and no polling — the main process checks once per
 * launch and pushes what it finds, and a plain browser has no bridge at all, in
 * which case this is a no-op rather than an error.
 */

export type UpdateStatus = 'available' | 'downloaded'

export interface UpdateState {
  status: UpdateStatus
  version: string
}

/** Mirrors `window.updates` in the preload, and nothing more of it. */
export interface UpdatesBridge {
  onStatus(listener: (state: UpdateState | null) => void): () => void
  install(): Promise<void>
}

export interface Updates {
  /** Null until the main process reports an update, and after a dismissal. */
  state: UpdateState | null
  /** True once the user has closed the banner, so it stays closed this launch. */
  dismissed: boolean
  install(): void
  dismiss(): void
}

export function useUpdates(): Updates {
  const [state, setState] = useState<UpdateState | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // The bridge is a fixed part of the window, so it is read once per mount and
  // never re-read: there is no such thing as this app gaining an updater later.
  useEffect(() => {
    if (!window.updates) return
    return window.updates.onStatus(setState)
  }, [])

  const install = useCallback(() => {
    if (!window.updates) return
    // The app is about to quit, so this never settles. A rejection is still the
    // updater's problem to report, never the user's to read.
    window.updates.install().catch((error) => {
      log.error('update.install_failed', error)
    })
  }, [])

  const dismiss = useCallback(() => setDismissed(true), [])

  return { state: dismissed ? null : state, dismissed, install, dismiss }
}
