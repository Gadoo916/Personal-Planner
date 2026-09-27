/// <reference types="vite/client" />
import type { PlannerBridge } from './storage/electron'

declare global {
  interface Window {
    /** Present only inside the Electron renderer. */
    planner?: PlannerBridge
  }
}
