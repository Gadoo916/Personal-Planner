import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The design system is only enforceable if it is checked. These tests fail the
 * build when a colour or a hardcoded visual literal escapes tokens.css, which
 * is the failure mode a code review will eventually miss.
 */

const ROOT = resolve(import.meta.dirname, '..', '..')
const TOKENS_PATH = join(ROOT, 'src', 'renderer', 'styles', 'tokens.css')
const DESIGN_PATH = join(ROOT, 'DESIGN.md')
const SCAN_ROOTS = ['src', 'scripts']
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.cjs', '.mjs']
const SKIP_DIRS = new Set(['node_modules', 'dist', 'release', '.git'])

const tokens = readFileSync(TOKENS_PATH, 'utf8')
const design = readFileSync(DESIGN_PATH, 'utf8')

function walk(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else if (SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) found.push(full)
  }
  return found
}

/** Every hex colour literal outside of tokens.css, with its file and line. */
function hexOutsideTokens(): string[] {
  const offenders: string[] = []
  for (const root of SCAN_ROOTS) {
    for (const file of walk(join(ROOT, root))) {
      if (file === TOKENS_PATH) continue
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (line.includes('.test.')) return
          // The one sanctioned duplicate: the window background cannot read a
          // CSS variable, and the test below pins it to --color-canvas.
          if (/const CANVAS = '#[0-9a-fA-F]+'/.test(line)) return
          for (const match of line.matchAll(/#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b/g)) {
            const where = relative(ROOT, file).split(sep).join('/')
            offenders.push(`${where}:${index + 1} ${match[0]}`)
          }
        })
    }
  }
  return offenders
}

function tokenValue(name: string): string {
  const match = tokens.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]+)`))
  if (!match) throw new Error(`tokens.css is missing ${name}`)
  return match[1] as string
}

describe('design system tokens', () => {
  it('keeps every hex colour inside tokens.css', () => {
    expect(hexOutsideTokens()).toEqual([])
  })

  it('defines the tokens the components rely on', () => {
    for (const name of [
      '--color-canvas',
      '--color-primary',
      '--color-brand-accent',
      '--color-ink',
      '--color-body',
      '--color-muted',
      '--color-hairline',
      '--color-success',
      '--color-warning',
      '--color-error',
      '--color-on-primary',
    ]) {
      expect(() => tokenValue(name), name).not.toThrow()
    }
  })

  it('pins the window background to the canvas token', () => {
    const main = readFileSync(join(ROOT, 'src', 'main', 'index.js'), 'utf8')
    const declared = main.match(/const CANVAS = '(#[0-9a-fA-F]+)'/)
    expect(declared?.[1]).toBe(tokenValue('--color-canvas'))
  })

  it('never writes an inline visual value in the renderer', () => {
    const offenders: string[] = []
    for (const file of walk(join(ROOT, 'src', 'renderer'))) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (line.includes('.test.') || !line.includes('style={{')) return
          if (line.match(/style=\{\{[^}]*:\s*['"]#/)) {
            offenders.push(`${relative(ROOT, file)}:${index + 1}`)
          }
        })
    }
    expect(offenders).toEqual([])
  })

  it('allows exactly one inline value, the measured progress width', () => {
    // A percentage is data, not a design decision, so it cannot be tokenised.
    // Everything else about the bar is a token, and this keeps it that way.
    const offenders: string[] = []
    for (const file of walk(join(ROOT, 'src', 'renderer'))) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (!line.includes('style={{')) return
          if (/--progress/.test(line)) return
          offenders.push(`${relative(ROOT, file)}:${index + 1} ${line.trim()}`)
        })
    }
    expect(offenders).toEqual([])
  })
})

describe('design system completeness', () => {
  it('renders the three priorities from one badge component', () => {
    const ui = readFileSync(join(ROOT, 'src', 'renderer', 'components', 'ui.tsx'), 'utf8')
    expect(ui).toContain('export function PriorityBadge')
    expect(ui).toContain('export function PillGroup')
  })

  it('has a class for every part of the task row', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    for (const selector of [
      '.task-item',
      '.task-item--completed',
      '.task-item__title',
      '.completion-toggle',
      '.completion-toggle--done',
      '.reminder-card',
      '.reminder-card--overdue',
      '.task-group',
      '.add-form',
      '.planner-grid',
      '.planner-main',
      '.planner-side',
      '.welcome',
      '.quick-stats',
      '.quick-stat',
      '.onboarding',
    ]) {
      expect(css, selector).toContain(selector)
    }
  })

  it('composes the screen as a 7:3 main column and widget column', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    expect(css).toContain('.focus-session')
    expect(css).toContain('.planner-main')
    expect(css).toContain('.planner-side')
    expect(css).toContain('.planner-column__header')
    // The reminder column stays a supporting column, not a second main column.
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*7fr\)\s*minmax\(0,\s*3fr\)/)
    // The removed chrome must not come back through a stale class.
    expect(css).not.toContain('.app-header')
    expect(css).not.toContain('.primary-planner-container')
  })

  it('gives the session panel an idle, a setup and a running face', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    for (const selector of [
      '.focus-session--idle',
      '.focus-session--setup',
      '.focus-session--session',
      '.focus-session--breakSetup',
      '.focus-session--complete',
      '.focus-session__setup',
      '.focus-session__centre',
      '.focus-session__ring',
    ]) {
      expect(css, selector).toContain(selector)
    }
    // The setup is centred, and the running clock is centred too.
    expect(css).toMatch(/\.focus-session__setup \{[^}]*align-items: center/)
    expect(css).toMatch(/\.focus-session__centre \{[^}]*align-items: center/)
    // The ring's geometry is tokens, and its only measured input is --progress.
    expect(css).toContain('var(--control-ring-size)')
    expect(css).toContain('var(--control-ring-circumference)')
    expect(css).toMatch(/stroke-dashoffset: calc\(.*--progress/)
  })

  it('gives the end of a session one outlined summary card and no dialog', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    const card = css.match(/\.focus-session__summary-card \{([^}]*)\}/)?.[1] ?? ''

    expect(card).toContain('var(--color-canvas)')
    expect(card).toContain('var(--elevation-hairline)')
    expect(card).toContain('var(--rounded-lg)')
    // The figures are labelled by their own elements, so the card needs no
    // second class to hang typography on.
    expect(css).toMatch(/\.focus-session__summary-card dt \{[^}]*var\(--type-caption\)/)
    expect(css).toMatch(/\.focus-session__summary-card dd \{[^}]*var\(--type-title-md\)/)
    // A summary is a block on the panel, not a layer over it.
    expect(css).not.toContain('role="dialog"')
    expect(card).not.toContain('position: fixed')
    expect(card).not.toContain('inset:')
  })

  it('stacks the idle face in one column of the panel', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    // The panel is already a column, so two children stack; the idle face
    // centres them and needs no row of its own.
    expect(css).toMatch(/\.focus-session \{[^}]*flex-direction: column/)
    const idle = css.match(/\.focus-session--idle[^{]*\{([^}]*)\}/)?.[1] ?? ''
    expect(idle).toContain('align-items: center')
    // The setup and session faces still need the row that carries their action.
    expect(css).toContain('.focus-session__bar')
    // The guidance line is gone with the element that used it.
    expect(css).not.toContain('.focus-session__hint')
  })

  it('centres the panel content instead of pushing the title aside', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    const title = css.match(/\.focus-session__title \{([^}]*)\}/)?.[1] ?? ''
    const bar = css.match(/\.focus-session__bar \{([^}]*)\}/)?.[1] ?? ''

    // A cross-axis auto margin outranks align-items, so one on the title would
    // pin it to the left of a centred column and the face would read as
    // left-aligned. The title is typography; the row distributes, not it.
    expect(title).not.toContain('margin')
    expect(bar).toContain('justify-content: space-between')
  })

  it('holds the session card to one compact measure, centred on both axes', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    const card = css.match(/\.focus-session \{([^}]*)\}/)?.[1] ?? ''
    const onboarding = css.match(/\.onboarding__panel \{([^}]*)\}/)?.[1] ?? ''

    // The card is the width of a small card, not of a page. A full-width session
    // panel is a band with the title at one end, Change session at the other,
    // and a 176px clock adrift in the middle of it.
    expect(card).toContain('max-width: var(--control-form-width)')
    expect(card).not.toContain('var(--container-max)')

    // The measure is reused, not doubled: the onboarding panel and the session
    // card are both "one thing the user looks at", and a second near-identical
    // width is a drift waiting to happen. This is what pins them to one value.
    const width = card.match(/max-width: (var\(--[a-z-]+\))/)?.[1]
    expect(width).toBe(onboarding.match(/max-width: (var\(--[a-z-]+\))/)?.[1])

    // Shrinks rather than overflows a narrow window: 100% sits under the
    // max-width, and the shell's padding at 768px is what narrows it.
    expect(card).toContain('width: 100%')

    // Centred on the inline axis like every panel, and on the block axis too,
    // so the card is the middle of the Focus Session view rather than pinned to
    // the top of it. The block margin is the one that survives an over-tall
    // card: auto margins resolve to zero under negative free space, where a
    // justify-content centre would push the top edge out of the view.
    expect(card).toContain('margin-inline: auto')
    expect(card).toContain('margin-block: auto')
  })

  it('keeps the session card off every other view', () => {
    const source = readFileSync(join(ROOT, 'src', 'renderer', 'App.tsx'), 'utf8')
    // The card is a direct child of the shell, and the shell renders it on the
    // Focus Session view alone. Nothing else in the tree may mount it, or the
    // centring would follow it onto Home or the Profile.
    expect(source).toContain('<FocusSessionTimer timer={timer} />')
    expect([...source.matchAll(/<FocusSessionTimer/g)]).toHaveLength(1)
    // ...and it is the else of the view ternary, so it is the focus view's body.
    expect(source).toMatch(/:\s*\(\s*<FocusSessionTimer/)
  })

  it('keeps a column header to one row, with no counter in it', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    const header = css.match(/\.planner-column__header \{([^}]*)\}/)?.[1] ?? ''

    // A wrapping header is what pushed the Add under the title in the narrower
    // reminders column; the row has two ends and must not break.
    expect(header).not.toContain('flex-wrap')
    // The count is gone with the element that rendered it.
    expect(css).not.toContain('.planner-column__count')
  })

  it('keeps the choice groups minimal rather than pill-heavy', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'ui.css'), 'utf8')
    const group = css.match(/\.nav-pill-group \{[^}]*\}/)?.[0] ?? ''
    const selected = css.match(/\.category-tab\[aria-selected='true'\] \{[^}]*\}/)?.[0] ?? ''

    // No track behind the words, and no fill behind the selection: a choice is
    // emphasis, not a pressed button.
    expect(group).not.toContain('background')
    expect(group).not.toContain('border-radius')
    expect(selected).not.toContain('background')
    expect(selected).not.toContain('--elevation-pill-active')
    // Bold, and a hairline rather than a heavy border.
    expect(selected).toContain('--type-tab-selected')
    expect(selected).toContain('inset 0 -2px 0')
  })

  it('pins the navigation bar to the bottom and reuses the choice-group treatment', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    const bar = css.match(/\.bottom-nav \{[^}]*\}/)?.[0] ?? ''
    const item = css.match(/\.bottom-nav__item \{[^}]*\}/)?.[0] ?? ''
    const current = css.match(/\.bottom-nav__item\[aria-current='page'\] \{[^}]*\}/)?.[0] ?? ''

    // Fixed, not sticky: a sticky bar scrolls out of reach under a long
    // calendar, and this one is the only way between views.
    expect(bar).toContain('position: fixed')
    expect(bar).toContain('bottom: 0')
    // A hairline, not a shadow: a shadow here would be the only depth in the
    // system with no panel above it to cast.
    expect(bar).toContain('--color-hairline')
    expect(bar).not.toContain('box-shadow')
    // The items are words, so they borrow the choice group's own types. The
    // transparent background is the native button's being reset, as
    // `.category-tab` does; what they must not have is a track or a radius.
    expect(item).toContain('--type-nav-link')
    expect(item).toContain('background: transparent')
    expect(item).not.toContain('border-radius')
    // Current view: bold plus the shared 2px hairline, and nothing else.
    expect(current).toContain('--type-tab-selected')
    expect(current).toContain('inset 0 -2px 0')
    expect(current).not.toContain('background')
    expect(current).not.toContain('--elevation-pill-active')
  })

  it('gives the Profile a view rather than a layer over the shell', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    const source = readFileSync(join(ROOT, 'src', 'renderer', 'components', 'Profile.tsx'), 'utf8')

    // No overlay, no scrim: nothing is composited over the planner any more, so
    // the system's one backdrop is gone with it.
    expect(css).not.toContain('.profile-overlay')
    expect(source).not.toContain('role="dialog"')
    expect(source).not.toContain('color-mix')
    // The bar is the way out, so a Close beside the title would be its duplicate.
    expect(source).not.toContain('onClose')
    // A report is not a layer, so it scrolls with the page rather than inside a
    // box of its own.
    expect(css).not.toMatch(/\.profile \{[^}]*overflow-y/)
  })

  it('uses no system control anywhere in the session panel', () => {
    const source = readFileSync(
      join(ROOT, 'src', 'renderer', 'components', 'FocusSessionTimer.tsx'),
      'utf8',
    )
    // The operating system's own select, number field and date field are the one
    // thing that would break the panel's visual language.
    for (const native of ['<select', 'type="number"', 'type="date"', 'type="time"']) {
      expect(source, native).not.toContain(native)
    }
  })

  it('reads the session length as a wheel of two columns, not a row of controls', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'ui.css'), 'utf8')
    const source = readFileSync(
      join(ROOT, 'src', 'renderer', 'components', 'FocusSessionTimer.tsx'),
      'utf8',
    )
    // The column is a vertical stack: a control, the value, a control, with the
    // value in the display step and nothing around it to compete.
    const wheel = css.match(/\.wheel \{([^}]*)\}/)?.[1] ?? ''
    expect(wheel).toMatch(/flex-direction: column/)
    expect(wheel).not.toContain('border-radius')
    expect(css).toMatch(
      /\.wheel \+ \.wheel \{[^}]*border-inline-start: 1px solid var\(--color-hairline\)/,
    )
    const value = css.match(/\.wheel__value \{([^}]*)\}/)?.[1] ?? ''
    expect(value).toContain('var(--type-display-sm)')
    expect(value).toContain('var(--color-ink)')
    // One number per column: a context row either side of the value would put a
    // second, lighter number back in the column.
    expect(css).not.toContain('.wheel__row')
    expect(value).not.toContain('--color-muted')
    // A stepper row is a row: the session length must not go back to one.
    expect(source).not.toContain('Stepper')
  })

  it('styles the pickers from tokens rather than literals', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'ui.css'), 'utf8')
    expect(css).toContain('.picker-trigger')
    expect(css).toContain('.picker-popover')
    expect(css).toContain('var(--control-popover-width)')
    // Native date and time inputs would reintroduce the system chrome.
    expect(css).not.toContain('.date-input')
    expect(css).not.toContain('.time-input')
  })

  it('never spends the one accent on a flat fill', () => {
    const sheets = ['ui.css', 'app.css'].map((file) =>
      readFileSync(join(ROOT, 'src', 'renderer', 'styles', file), 'utf8'),
    )
    for (const css of sheets) {
      // The accent is a tint or it is nothing. A flat `background:
      // var(--color-brand-accent)` would spend it on whatever surface happened
      // to use it, which is how one accent turns into a palette.
      const flat = [
        ...css.matchAll(/(background|border-color|stroke|color):\s*var\(--color-brand-accent\)/g),
      ]
      expect(flat).toHaveLength(0)
      // So every rule that does name it is a mix, and never a bare fill.
      for (const block of css.matchAll(/\{[^}]*\}/g)) {
        if (!block[0].includes('var(--color-brand-accent)')) continue
        expect(block[0], block[0].trim()).toContain('color-mix(')
      }
    }

    // The primary action is the brand pink, and the button reads the primary
    // token rather than the accent, so the two can be swapped without touching
    // a single component.
    const primary = (sheets[0] ?? '').match(/\.button-primary \{[^}]*\}/)?.[0] ?? ''
    expect(primary).toContain('var(--color-primary)')
    expect(primary).not.toContain('var(--color-brand-accent)')
  })

  it('makes the update banner a block in the flow, with no layer under it', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    const banner = css.match(/\.update-banner \{([^}]*)\}/)?.[1] ?? ''

    // The composer's own outlined treatment, reused rather than a new pattern:
    // a canvas fill, a hairline, and the panel radius. Nothing new, because a
    // notice is not a reason to add a token.
    expect(banner).toContain('var(--color-canvas)')
    expect(banner).toContain('var(--elevation-hairline)')
    expect(banner).toContain('var(--rounded-lg)')
    // A toast needs a viewport, an overlay, and a z-index over the planner.
    // This system has no backdrop at all, so a notice cannot be one.
    expect(banner).not.toContain('position')
    expect(banner).not.toContain('z-index')
    expect(banner).not.toContain('inset')
    // The one primary button on Home, so the brand pink marks one action.
    const title = css.match(/\.update-banner__title \{([^}]*)\}/)?.[1] ?? ''
    expect(title).toContain('var(--type-title-md)')
    expect(title).toContain('var(--color-ink)')
    const note = css.match(/\.update-banner__note \{([^}]*)\}/)?.[1] ?? ''
    expect(note).toContain('var(--type-body-sm)')
    // The note supports the title, so it is muted and never the ink.
    expect(note).toContain('var(--color-muted)')
    expect(note).not.toContain('var(--color-error)')
  })

  it('gives the two grid children no surface of their own', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    // They are an alignment device between the grid and the columns inside it.
    // A panel here would put a third border where the design asks for space.
    const tracks = css.match(/\.planner-main,\s*\.planner-side \{[^}]*\}/)?.[0] ?? ''
    expect(tracks).toContain('flex-direction: column')
    expect(tracks).not.toContain('background')
    expect(tracks).not.toContain('border')
    expect(tracks).not.toContain('padding')
  })

  it('ramps the Profile calendar with tints, never with new colours', () => {
    const css = readFileSync(join(ROOT, 'src', 'renderer', 'styles', 'app.css'), 'utf8')
    // Four steps, one accent, each a fixed mix into the canvas.
    for (const step of ['empty', 'light', 'medium', 'strong']) {
      const rule = css.match(new RegExp(`\\.profile__calendar-day--${step} \\{[^}]*\\}`))?.[0] ?? ''
      expect(rule, step).not.toBe('')
    }
    const tinted = [...css.matchAll(/\.profile__calendar-day--\w+ \{[^}]*\}/g)].map((m) => m[0])
    for (const rule of tinted) {
      expect(rule).toMatch(/background: (var\(--color-canvas\)|color-mix\()/)
    }
    // A heatmap is a tint, so the ramp may not introduce a second accent.
    expect(css).not.toMatch(/\.profile__calendar-day--\w+ \{[^}]*#[0-9a-fA-F]/)
  })

  it('keeps the counts, the greeting, and the profile free of add triggers', () => {
    const source = ['Welcome.tsx', 'QuickStats.tsx', 'ProfileGate.tsx', 'Profile.tsx'].map((file) =>
      readFileSync(join(ROOT, 'src', 'renderer', 'components', file), 'utf8'),
    )
    for (const text of source) {
      // The column header owns the one add trigger per column. A second one in
      // any of these bands is a duplicate, and a form submit is not one.
      expect(text).not.toMatch(/addLabel|Add task|Add reminder/)
    }
    // A destructive control in a report surface would be a modal asking a
    // question, which the system forbids.
    const profile = readFileSync(join(ROOT, 'src', 'renderer', 'components', 'Profile.tsx'), 'utf8')
    expect(profile).not.toContain('onDelete')
    expect(profile).not.toContain('confirm')
  })

  it('keeps the composer on the primitives its fields are documented with', () => {
    const source = readFileSync(join(ROOT, 'src', 'renderer', 'components', 'AddForm.tsx'), 'utf8')
    // Priority is a choice group: three plain words in a row.
    expect(source).toContain('<PillGroup')
    // Repeat is a closed set of three words, so it stays a native select.
    expect(source).toContain('<select')
    // The Dropdown primitive exists but must not creep into a form field.
    expect(source).not.toContain('Dropdown')
  })

  it('draws the session clock and the session cat once each, inside the ring', () => {
    const source = readFileSync(
      join(ROOT, 'src', 'renderer', 'components', 'FocusSessionTimer.tsx'),
      'utf8',
    )
    // A second clock beside the ring is the same figure twice, and the two can
    // disagree the moment a tick lands between them.
    const clocks = source.match(/className="focus-session__clock"/g) ?? []
    expect(clocks).toHaveLength(1)
    expect(source).toContain('focus-session__ring-content')
    // Same reasoning for the illustration: the ring is where it lives, so the
    // session face must not also print it above the phase.
    const sessionFace = source.slice(source.indexOf('function SessionPanel'))
    expect(sessionFace).not.toContain('focus-session__animation"')
  })

  it('uses the bare animation class only on the idle and complete faces', () => {
    const source = readFileSync(
      join(ROOT, 'src', 'renderer', 'components', 'FocusSessionTimer.tsx'),
      'utf8',
    )
    // `.focus-session__animation` is the large 120px picture, and it belongs to
    // the idle face and the complete face. Inside the ring the icon is the
    // small `--ring` modifier of the same class, which is why the session face
    // carries the pair and never the bare class. So the large illustration
    // above the phase label cannot come back without failing this.
    const bare = source.match(/className="focus-session__animation"/g) ?? []
    expect(bare).toHaveLength(2)
    expect(source).toContain('className="focus-session__animation focus-session__animation--ring"')

    const idleFace = source.slice(
      source.indexOf('function IdlePanel'),
      source.indexOf('function SetupPanel'),
    )
    expect(idleFace).toContain('focus-session__animation"')
  })
})

/**
 * DESIGN.md is the documentation of record. These tests make it impossible for
 * the document and the executable tokens to drift apart in either direction.
 */
describe('DESIGN.md is in sync with tokens.css', () => {
  const TOKEN_FAMILY =
    /^--(color|font|type|spacing|rounded|elevation|control|input|icon-button|badge|tab|container|content|motion)-/

  const defined = [
    ...new Set([...tokens.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1] as string)),
  ].filter((name) => TOKEN_FAMILY.test(name))

  const documented = [
    ...new Set([...design.matchAll(/(--[a-z0-9-]+)/g)].map((m) => m[1] as string)),
  ].filter((name) => TOKEN_FAMILY.test(name))

  it('defines tokens in every family the system needs', () => {
    expect(defined.length).toBeGreaterThan(70)
    for (const family of [
      '--color-',
      '--font-',
      '--type-',
      '--spacing-',
      '--rounded-',
      '--elevation-',
      '--control-',
    ]) {
      expect(
        defined.some((name) => name.startsWith(family)),
        family,
      ).toBe(true)
    }
  })

  it('documents every defined token, with no invented ones', () => {
    const undocumented = defined.filter((name) => !documented.includes(name))
    const invented = documented.filter((name) => !defined.includes(name))
    expect({ undocumented, invented }).toEqual({ undocumented: [], invented: [] })
  })

  it('reproduces every hex value exactly, with no new ones', () => {
    const hexes = (source: string) =>
      [
        ...new Set([...source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase())),
      ].sort()
    expect(hexes(design)).toEqual(hexes(tokens))
  })

  it('carries no branding or terminology from any other product', () => {
    const forbidden = [
      'cal.com',
      'calcom',
      'booking',
      'event type',
      'webhook',
      'calendly',
      'oauth',
      'stripe',
    ]
    const lower = design.toLowerCase()
    const found = forbidden.filter((word) => lower.includes(word))
    expect(found).toEqual([])
  })

  it('documents the whole Personal Planner screen', () => {
    for (const section of [
      'Overview',
      'Colors',
      'Typography',
      'Layout',
      'Elevation & Depth',
      'Shapes',
      'Components',
      'Interaction & States',
      'Responsive Behavior',
      'Design Principles',
      "Do's and Don'ts",
      'Implementation Rules',
      'Known Gaps',
    ]) {
      expect(design, section).toContain(`## ${section}`)
    }
    for (const component of [
      'App Title',
      'Session Timer',
      'Planner Layout',
      'Buttons',
      'Inputs',
      'Pickers',
      'Inline Composer',
      'Task Item',
      'Task Group',
      'Reminder Card',
      'Priority',
      'Completion',
      'Remaining Time',
      'Badges',
      'Tabs / Filters',
      'Empty State',
      'Welcome',
      'Quick Stats',
      'Onboarding',
      'Bottom Navigation',
      'Update Banner',
    ]) {
      expect(design, component).toContain(`### ${component}`)
    }
  })

  it('points at every class it names, and every class it defines', () => {
    const definedClasses = new Set(
      ['base.css', 'ui.css', 'app.css'].flatMap((file) =>
        [
          ...readFileSync(join(ROOT, 'src', 'renderer', 'styles', file), 'utf8').matchAll(
            /^\.([a-zA-Z0-9_-]+)/gm,
          ),
        ].map((m) => m[1] as string),
      ),
    )
    const named = [
      ...new Set([...design.matchAll(/`\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1] as string)),
    ]
    expect(named.filter((name) => !definedClasses.has(name))).toEqual([])
  })
})
