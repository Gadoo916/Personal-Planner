import { log } from '../lib/log'
import type { PlannerStorage } from './port'

/**
 * Browser fallback used by `npm run dev`. Electron always wins when its preload
 * bridge is present, so this path is development-only and does not share data
 * with the desktop app.
 */
const STORAGE_KEY = 'planner:data:v1'

export function createWebStorage(): PlannerStorage {
  return {
    async load() {
      let raw: string | null
      try {
        raw = localStorage.getItem(STORAGE_KEY)
      } catch (error) {
        log.error('storage.read_failed', error)
        return null
      }
      if (raw === null) return null
      try {
        return JSON.parse(raw)
      } catch (error) {
        log.error('storage.corrupt', error)
        return null
      }
    },

    async save(document) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(document))
      } catch (error) {
        log.error('storage.write_failed', error)
      }
    },
  }
}
