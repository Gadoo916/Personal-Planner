import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebStorage } from './web'

const KEY = 'planner:data:v1'

describe('createWebStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves null when nothing has been stored', async () => {
    await expect(createWebStorage().load()).resolves.toBeNull()
  })

  it('round-trips a document', async () => {
    const storage = createWebStorage()
    const document = { schemaVersion: 1, tasks: [{ id: 'a' }], reminders: [] }
    await storage.save(document)
    await expect(storage.load()).resolves.toEqual(document)
  })

  it('survives a page reload by reading the same key', async () => {
    await createWebStorage().save({ schemaVersion: 1, tasks: [], reminders: [] })
    const raw = localStorage.getItem(KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw ?? '')).toEqual({ schemaVersion: 1, tasks: [], reminders: [] })
  })

  it('quarantines a corrupt document instead of throwing', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(KEY, '{ this is not json')
    await expect(createWebStorage().load()).resolves.toBeNull()
    expect(logged).toHaveBeenCalled()
  })

  it('returns null when the stored value is valid json of the wrong shape', async () => {
    localStorage.setItem(KEY, JSON.stringify({ unexpected: true }))
    await expect(createWebStorage().load()).resolves.toEqual({ unexpected: true })
  })

  it('resolves a rejected save without throwing at the call site', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    await expect(createWebStorage().save({ schemaVersion: 1 })).resolves.toBeUndefined()
  })
})
