import { afterEach, describe, expect, it, vi } from 'vitest'
import { assetUrl } from './assets'

/**
 * The regression these tests exist for: a runtime asset path written as
 * `/assets/...` is served fine by the dev server and 404s in the packaged app,
 * where the renderer is `dist/index.html` over `file://` and a leading slash is
 * a filesystem root rather than the server root. The dev server cannot catch
 * this, because its base and the broken one look identical there.
 */
describe('assetUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('serves from the root under the dev server', () => {
    vi.stubEnv('BASE_URL', '/')
    expect(assetUrl('/assets/focus-session/focus.gif')).toBe('/assets/focus-session/focus.gif')
  })

  it('stays relative under a build, so file:// can resolve it', () => {
    // `base: './'` is what vite.config.ts sets, and it is the only base a
    // `file://` build can use.
    vi.stubEnv('BASE_URL', './')
    expect(assetUrl('/assets/focus-session/focus.gif')).toBe('./assets/focus-session/focus.gif')
  })

  it('never produces a root-absolute path in a build', () => {
    vi.stubEnv('BASE_URL', './')
    const url = assetUrl('/assets/focus-session/session-complete.mp3')
    expect(url.startsWith('/')).toBe(false)
    // A relative URL resolves against the document, which is what makes the same
    // bundle work from `dist/` on disk and from inside `app.asar`.
    expect(url.startsWith('./')).toBe(true)
  })

  it('tolerates a path written with or without its leading slash', () => {
    vi.stubEnv('BASE_URL', '/')
    expect(assetUrl('assets/focus-session/break.gif')).toBe('/assets/focus-session/break.gif')
    expect(assetUrl('//assets/focus-session/break.gif')).toBe('/assets/focus-session/break.gif')
  })

  it('honours a sub-path base without doubling or dropping the separator', () => {
    vi.stubEnv('BASE_URL', '/planner/')
    expect(assetUrl('/assets/focus-session/complete.gif')).toBe(
      '/planner/assets/focus-session/complete.gif',
    )
  })
})
