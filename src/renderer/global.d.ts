/// <reference types="vite/client" />
import type { UpdatesBridge } from './hooks/useUpdates'
import type { PlannerBridge } from './storage/electron'

declare global {
  interface Window {
    /** Present only inside the Electron renderer. */
    planner?: PlannerBridge
    /** Absent in a plain browser, where there is no updater to talk to. */
    updates?: UpdatesBridge
  }
}
