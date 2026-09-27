import { log } from '../lib/log'
import type { PlannerStorage } from './port'

export interface PlannerBridge {
  load(): Promise<unknown>
  save(document: unknown): Promise<void>
}

/** Desktop implementation. The main process owns the file and its atomic write. */
export function createElectronStorage(): PlannerStorage {
  const bridge = window.planner
  if (!bridge) {
    throw new Error('Electron storage requested but the preload bridge is missing')
  }
  return {
    load: () => bridge.load(),
    save: async (document) => {
      try {
        await bridge.save(document)
      } catch (error) {
        log.error('storage.write_failed', error)
      }
    },
  }
}
