/**
 * Where the app's bundled images and sounds live at runtime.
 *
 * Vite copies `public/` into the build output verbatim and rewrites only the
 * URLs it can actually see: an ES import, a `new URL(..., import.meta.url)`, a
 * reference in the HTML, a `url()` in a stylesheet. A path written as a plain
 * string in a JavaScript module is none of those, so it is emitted exactly as
 * written and nothing checks it.
 *
 * That is why `/assets/focus-session/focus.gif` worked in `npm run dev` and
 * failed in the packaged app. Served by the dev server, a leading `/` is the
 * server root and the dev server really does serve the public directory there.
 * In a build, the renderer is `dist/index.html` opened over `file://`, and there
 * a leading `/` is a *filesystem* root: it resolves against the drive the app
 * was launched from, and a file that is not there renders as a broken image
 * with its alt text. The `base: './'` in `vite.config.ts` fixed `index.html`'s
 * own references and nothing else.
 *
 * So every runtime asset path goes through here, and is resolved against
 * `import.meta.env.BASE_URL` — the one value the build already gets right. In
 * dev and in tests that base is `/`; in a build it is `./`, which is a URL
 * relative to the document and therefore correct wherever `dist/` was placed,
 * including inside `app.asar`.
 */

/**
 * Resolves a path under the build's `public/` directory against the base URL.
 *
 * @param path Public-directory path, with or without a leading slash.
 * @returns A URL usable in both the dev server and a `file://` build.
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}
