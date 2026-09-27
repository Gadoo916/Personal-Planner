/**
 * The two-method storage port. This is the only boundary in the app that has
 * more than one implementation, and it exists because the app genuinely runs in
 * two environments: a desktop window and a plain browser during development.
 *
 * The port is schema-agnostic on purpose. It moves an opaque document so that a
 * future sync implementation can be dropped in without touching domain code.
 * Shape validation belongs to the domain, not to storage.
 */

import { createElectronStorage } from './electron'
import { createWebStorage } from './web'

export interface PlannerStorage {
  /** Resolves to the stored document, or null when nothing is stored yet. */
  load(): Promise<unknown>
  save(document: unknown): Promise<void>
}

export function createStorage(): PlannerStorage {
  return window.planner ? createElectronStorage() : createWebStorage()
}
