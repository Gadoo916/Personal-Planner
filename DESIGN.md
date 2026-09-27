# Personal Planner Design System

> **Authoritative documentation for the Personal Planner visual system.**
> Executable values live in `src/renderer/styles/tokens.css`. This document is
> the source of documentation, intent, and rules. If this file and the code
> disagree, the code is wrong — see [Implementation Rules](#implementation-rules).

---

## Overview

Personal Planner is a local-first desktop app for a student who needs to see
**what is due** and **how much time is left** without navigating away from their
work. Every visual decision follows from that one job.

The system is deliberately quiet: a near-monochrome neutral scale carries the
interface, hairline borders and pill shapes provide separation, and colour is
spent only where it carries meaning — priority, completion, and overdue. The
brand pink is the single colour of consequence and it appears only where the user
is meant to act, because in a planner a screen full of colour reads as a screen
full of alarms.

**Design character:** calm, dense, scannable, and unhurried. It should feel
closer to a well-set notebook than to a dashboard.

**What this system is not:** it is not a theming framework. There is one theme,
one direction (LTR), and one locale (English). Dark surfaces exist as tokens for
future use but are not part of the shipped screen.

**Coverage:** the app has **three views** — **Home**, **Profile**, and
**Focus Session** — and one persistent [Bottom Navigation](#bottom-navigation)
bar that is on screen for all three.

| View | What it holds |
| --- | --- |
| Home | The planner: the Tasks column and the Reminders column, and the [update banner](#update-banner) above them |
| Profile | The productivity report, which used to be an anchored overlay over Home and is now a view of its own |
| Focus Session | **Nothing but the [session panel](#session-timer)**, and the nav bar |

Switching between them is **in-app state, not routing**: no URL, no history
entry, no page transition. The app is one offline window with no address bar and
no back button, so a view that required a URL would be a view with nothing to
push against. Above all three sits the first-run **Onboarding** gate, which still
replaces everything until the document has a name to address the user by.

**One view is a full view, not a panel inside another.** The Focus Session view
is the deliberate case: a running clock is the one thing in this app that must
not be competing for a glance with a task list, so it gets the whole screen to
itself rather than a slot in a column. Every component listed here is reachable
from one of the three views or from the nav bar.

### Source files

| File | Responsibility |
| --- | --- |
| `src/renderer/styles/tokens.css` | Every visual value. Nothing else may define one. |
| `src/renderer/styles/base.css` | Reset, document defaults, focus ring, `.sr-only`. |
| `src/renderer/styles/ui.css` | Reusable component classes shared app-wide. |
| `src/renderer/styles/app.css` | Composition of the planner screen, plus responsive rules. |
| `src/renderer/components/ui.tsx` | React primitives that map onto `ui.css` classes. |
| `src/renderer/components/BottomNavigation.tsx` | The three-item bar, and the only writer of the current view. |
| `src/renderer/components/UpdateBanner.tsx` | The update notice at the top of Home, and the only writer of `Install and restart`. |
| `src/renderer/styles.test.ts` | Enforces this document against the code. |

---

## Colors

All 25 colour tokens. Values are exact; never substitute, never "eyeball" one.

### Brand & Accent

| Token | Value | Role |
| --- | --- | --- |
| `--color-primary` | `#b16e97` | The brand pink. Primary button fill, `badge-pill--strong`, strong emphasis text. |
| `--color-primary-active` | `#64295c` | Primary button hover and pressed: the same pink, one step darker. |
| `--color-brand-accent` | `#111111` | The single accent. Badge tints, the app icon. Never a button fill. |

**Rule:** exactly one accent, and it is the ink, not the brand pink. The pink is
`--color-primary` because the primary action is the one thing on a screen that
should carry the brand; the accent is what tints, marks, and identifies. Keeping
them apart is what stops the pink appearing everywhere, because a token that
fills buttons is spent on those and nothing else. If a new feature seems to need
a second colour, it needs a semantic token instead — see
[Semantic](#semantic).

### Surface

| Token | Value | Role |
| --- | --- | --- |
| `--color-canvas` | `#ffffff` | Page background, card wells, input fills. |
| `--color-surface-soft` | `#f8f9fa` | Row hover, Today group. |
| `--color-surface-card` | `#ececec` | Group panels, the add form, reminder cards, empty states. |
| `--color-surface-strong` | `#e5e7eb` | Disabled control fill. |
| `--color-surface-dark` | `#101010` | Reserved. Unused. |
| `--color-surface-dark-elevated` | `#1a1a1a` | Reserved. Unused. |
| `--color-hairline` | `#e5e7eb` | Every border and the hairline elevation. |
| `--color-hairline-soft` | `#f3f4f6` | Reserved. Unused. |

**Surface hierarchy in this app** is three levels deep, no more:
`canvas` (page) → `surface-card` (panel) → `surface-soft` (interactive tint).
Depth between them comes from hairline borders, not from shadow.

### Text

| Token | Value | Role |
| --- | --- | --- |
| `--color-ink` | `#111111` | Headings, task titles, focused borders. |
| `--color-body` | `#374151` | Default badge text, `.t-body`. |
| `--color-muted` | `#6b7280` | Field labels, metadata, unselected tabs. |
| `--color-muted-soft` | `#898989` | Placeholders, disabled text, low priority, completed titles. |
| `--color-on-primary` | `#ffffff` | Text on `--color-primary` and on the success fill. |
| `--color-on-dark` | `#ffffff` | Text on dark surfaces. Reserved. |
| `--color-on-dark-soft` | `#a1a1aa` | Secondary text on dark. Reserved. |

Text hierarchy is four steps: `ink` → `body` → `muted` → `muted-soft`. Do not
introduce a fifth grey. Body copy is always `ink` or `body`; `muted` and
`muted-soft` are for supporting information only.

### Semantic

| Token | Value | Used for |
| --- | --- | --- |
| `--color-success` | `#10b981` | Completion fill, `badge-pill--success`. |
| `--color-warning` | `#f59e0b` | Medium priority, `badge-pill--warning`. |
| `--color-error` | `#ef4444` | High priority, overdue, destructive actions. |

Semantic colours are **reserved for meaning**. `--color-error` is the only
colour allowed to appear next to a destructive action, and `--color-success`
only ever signals that something is finished. They are never used decoratively.

Four further tokens exist for category chips and are currently unused:
`--color-badge-orange` `#fb923c`, `--color-badge-pink` `#ec4899`,
`--color-badge-violet` `#8b5cf6`, `--color-badge-emerald` `#34d399`.

Tinted badge backgrounds are produced with `color-mix`, never new hex values:

```css
background: color-mix(in srgb, var(--color-error) 12%, var(--color-canvas));
```

Mix ratios are fixed per tone: accent 12%, success 14%, warning 18%, error 12%.

---

## Typography

### Font Family

| Token | Value |
| --- | --- |
| `--font-display` | `'Cal Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |
| `--font-ui` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |

The display stack leads with **Cal Sans**, which is not publicly licensed, so
**Inter 600 is the shipped substitute**. Inter is already second in the display
stack, meaning the fallback is automatic and needs no `@font-face` and no
network request. The app must work fully offline, so **no web fonts are ever
loaded**. `--font-ui` is Inter first because the licensed display face is not
available in production.

`--type-code` exists for monospaced technical text
(`400 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace`) and is currently
unused, because a planner shows no code.

### Hierarchy

Every entry is a complete `font` shorthand. Apply it whole; never restate size,
weight, and line-height separately.

| Token | Shorthand | Tracking | Applied to |
| --- | --- | --- | --- |
| `--type-display-xl` | `600 64px/1.05` | `-2px` | Unused at this density. |
| `--type-display-lg` | `600 48px/1.1` | `-1.5px` | Unused at this density. |
| `--type-display-md` | `600 36px/1.15` | `-1px` | **The session clock, inside the ring.** |
| `--type-display-sm` | `600 28px/1.2` | `-0.5px` | **App title.** |
| `--type-title-lg` | `600 22px/1.3` | `-0.3px` | **Column headings** (Tasks, Reminders) and the session timer heading. |
| `--type-title-md` | `600 18px/1.4` | — | **Task titles, reminder titles, day labels, picker month name, empty-state titles.** |
| `--type-title-sm` | `600 16px/1.4` | — | Reserved. |
| `--type-body-md` | `400 16px/1.5` | — | **Input text, picker trigger values.** |
| `--type-body-sm` | `400 14px/1.5` | — | **Reminder date line, empty-state body.** |
| `--type-caption` | `500 13px/1.4` | — | **Badges, field labels, remaining time, timer setup labels and caption, form errors, delete confirmation.** |
| `--type-button` | `600 14px/1` | — | **All button labels.** |
| `--type-nav-link` | `500 14px/1.4` | — | **Unselected option labels, text links.** |
| `--type-tab-selected` | `600 14px/1.4` | — | **The selected option in any choice group.** Same size as `--type-nav-link`, so choosing a value never reflows the row. |
| `--type-code` | `400 14px/1.5` mono | — | Unused. |

Matching tracking tokens exist for the large steps and must be used with their
shorthand rather than hand-tuned letter-spacing:
`--type-display-xl-tracking`, `--type-display-lg-tracking`,
`--type-display-md-tracking`, `--type-display-sm-tracking`, and
`--type-title-lg-tracking`.

### Principles

1. **Weight carries hierarchy, not size.** Every heading is `600`. Scale does the
   rest. There are no `700` or `800` weights anywhere in the system.
2. **16px is the floor for readable text.** `--type-body-md`. Anything smaller is
   metadata and must be `--type-caption`.
3. **Titles truncate by wrapping, never by ellipsis.** Task and reminder titles
   use `overflow-wrap: anywhere`, because a cut-off task name is a lost task.
4. **Tight leading for large text, relaxed for small.** `1.05` at 64px down to
   `1.5` at 16px.
5. **One font per role.** Display stack for the app title and column headings,
   UI stack for everything the user reads or types.

---

## Layout

### Spacing System

An 8px base with a 4px half-step. Every gap, pad, and offset is a token.

| Token | Value | Typical use |
| --- | --- | --- |
| `--spacing-xxs` | `4px` | Pill track padding, icon gaps, tightest internal gaps |
| `--spacing-xs` | `8px` | Field label gap, badge row gap, reminder card gap |
| `--spacing-sm` | `12px` | Task item padding, list gaps, icon-to-body gap |
| `--spacing-md` | `16px` | Form row gap, column internal gap, header gap |
| `--spacing-lg` | `24px` | Panel padding, grid gap, app shell padding |
| `--spacing-xl` | `32px` | Reserved. The screen no longer has an outer frame to pad. |
| `--spacing-xxl` | `48px` | Wide-viewport shell padding |
| `--spacing-section` | `96px` | Bottom breathing room below the fold, and the clearance under the fixed [navigation bar](#bottom-navigation) |

**Rule:** if a spacing value is not on this scale, it does not belong. There is
no arbitrary pixel spacing. Three exceptions exist and are structural, not
visual: a `-2px` optical nudge on the completion toggle, the `2px` active
hairline under a selected option in a choice group or in the
[bottom navigation](#bottom-navigation), and a `6px` priority dot, all specified
below.

### Control Sizing

| Token | Value | Use |
| --- | --- | --- |
| `--control-height` | `40px` | Every text input, select, and picker trigger |
| `--control-height-compact` | `36px` | Reserved. Nothing is compact enough to need it. |
| `--control-radius` | `var(--rounded-md)` | Every control |
| `--control-padding-block` | `12px` | Button padding, block axis |
| `--control-padding-inline` | `20px` | Button padding, inline axis |
| `--control-popover-width` | `280px` | The day picker; the time picker's minimum width |
| `--control-form-width` | `420px` | The onboarding panel, which is one field and needs a measure rather than the full content width |
| `--control-ring-size` | `176px` | The session ring's box |
| `--control-ring-stroke` | `6px` | The session ring's track and arc |
| `--control-ring-circumference` | `534.07px` | The session ring's arc length, `2 * pi * 85` |
| `--input-padding-block` | `10px` | Text input padding, block axis |
| `--input-padding-inline` | `14px` | Text input padding, inline axis |

`--control-popover-width` is the width of an anchored popover, not a control: it
exists so the calendar and the clock share one width and cannot drift apart as
either grows.

The three ring tokens are one geometric fact, not three choices. A `176px` ring
with a `6px` stroke leaves a radius of `85`, and the arc is drawn by shortening
a dash of `534.07px`. Change the size or the stroke and the circumference must be
recalculated with it, or the ring closes early and never reaches 100%.

### Grid & Container

```
.app-shell                     min-height 100vh, flex column, gap 16px
  padding: 24px 24px 96px      var(--spacing-lg) var(--content-padding-inline) var(--spacing-section)

  HOME VIEW
  .planner-grid                grid, minmax(0,7fr) minmax(0,3fr), gap 24px, align-items start
    .planner-main              flex column, gap 16px, min-width 0
      .welcome                 the greeting and the app title
      .quick-stats             the four counts
      .planner-column (Tasks)  flex column, gap 16px, min-width 0
    .planner-side              flex column, gap 16px, min-width 0
      .planner-column (Reminders)

  PROFILE VIEW
  .profile                     the report, max-width 1200px, centred

  FOCUS SESSION VIEW
  .focus-session               the session panel, max-width 1200px, centred

  .bottom-nav                  position fixed, bottom 0, inset-inline 0
```

The two-column split is **7fr work to 3fr glance**. The wide track gets the
tasks, because the task list grows without limit and needs room for a title plus
its badges, together with the two summary bands that sit above it. The narrow
track gets the reminder column, because a reminder is a short line with one
countdown and is read at a glance rather than worked in. `minmax(0, …)` is
mandatory on both tracks so long titles shrink the column instead of overflowing
the grid. `align-items: start` stops the shorter column from stretching to match
the taller one.

The session panel **used to** sit at the head of the narrow track above the
reminders. It is now the whole of the [Focus Session view](#focus-session-view)
and appears nowhere on Home, which is why `.planner-side` holds one column
instead of two. Its `width: 100%; max-width: var(--container-max);
margin-inline: auto` is what lets it drop into a full-width view with no
container of its own.

`.planner-main` and `.planner-side` are **grid children that exist only to own a
column's stack**. They carry no visual treatment of their own — no panel, no
background, no border — because they are an alignment device, not a surface. The
two `PlannerColumn` components inside them are the real columns and still own
their headers and their single add trigger.

`--container-max` bounds `.app-title`, `.focus-session` and `.planner-grid`
alike, so the three share one measure and the screen reads as one column of
content. It bounds `.profile` for the same reason: a view that floated in a sea of
white at 1440px would read as a dialog rather than a page.


### Whitespace Philosophy

1. **Grouping is done with space before borders.** The 12px and 16px gaps do most
   of the separating; hairlines confirm what spacing already implied.
2. **Panels are padded generously; rows are padded tightly.** Panels get 24px
   (`--spacing-lg`), task rows get 12px (`--spacing-sm`). Dense rows inside
   generous panels is what makes the screen scannable.
3. **Whitespace is never decorative.** No filler margins, no centring of text
   blocks. The one exception is `.empty-state`, which is left-aligned so it
   reads as an instruction rather than a poster.
4. **96px below the fold exists on purpose.** `--spacing-section` lets the last
   card scroll clear the viewport edge instead of being clipped by it.
5. **Actions appear on approach, not permanently.** Row actions sit at
   `opacity: 0` and reveal on hover or focus. Permanent actions would give every
   row the visual weight of an edit form.

---

## Elevation & Depth

| Token | Value | Use |
| --- | --- | --- |
| `--elevation-flat` | `none` | Default. Currently unused as an explicit class. |
| `--elevation-hairline` | `0 0 0 1px var(--color-hairline)` | **The app's primary depth cue.** |
| `--elevation-subtle` | `0 1px 2px rgb(17 17 17 / 4%), 0 8px 24px rgb(17 17 17 / 6%)` | Reserved. |
| `--elevation-pill-active` | `0 1px 2px rgb(17 17 17 / 8%)` | Reserved. The choice groups stopped being pills, so nothing needs to lift off a track. |
| `--elevation-control-active` | `inset 0 1px 2px rgb(17 17 17 / 10%)` | Pressed buttons and icon buttons. |

**The defining characteristic of this system is that it uses hairlines, not
shadows.** The one two-layer drop shadow in the file is deliberately unused. A
planner is a reference tool, not a stack of floating cards, and drop shadows
would make rows compete for attention.

Depth is therefore expressed as a small, closed set:

- **Hairline** — a 1px ring used on the Today group, overdue reminder cards,
  the row being edited, the add form, the onboarding panel, the Profile panel,
  and every control border.
- **Inset** — a pressed control is *pushed in*, never lifted out. This is the
  standard tactile metaphor for a button going down.
- **Pill lift** — `--elevation-pill-active` is reserved and **unused**. The
  choice groups stopped being pills, so no surface has to read as raised. It is
  listed here to say that the set is closed, not to invite a use.

---

## Shapes

### Border Radius Scale

| Token | Value | Applied to |
| --- | --- | --- |
| `--rounded-xs` | `4px` | Unused. |
| `--rounded-sm` | `6px` | Unused. |
| `--rounded-md` | `8px` | **Controls** (via `--control-radius`), task rows, calendar days, unselected tabs. |
| `--rounded-lg` | `12px` | **Panels** — task groups, the session timer, reminder cards, the composer, empty state, picker popovers. |
| `--rounded-xl` | `16px` | Reserved. The screen has no outer frame, so nothing needs the outermost radius. |
| `--rounded-pill` | `9999px` | Badges, remaining time, checkbox, icon buttons. |
| `--rounded-full` | `9999px` | Fully circular elements. Alias-equivalent to `--rounded-pill`. |

**The shape rule that matters:** radius communicates containment.

- **8px** for things you type into or press. Small, dense, utilitarian.
- **12px** for containers holding many things. Panels and cards.
- **Pill** for anything carrying a short label. Badges, tabs, checkboxes.
- **16px** is reserved. It was the outer frame of the screen; the frame is gone,
  so nothing consumes it. Do not reintroduce it as a card radius.

Never mix radii inside a containment chain in the wrong direction. An inner
element's radius must be less than or equal to its parent's minus the padding
gap. Pills and circles are exempt, since they are fully rounded by intent.

---

## Components

Every component below exists in the code. Purpose, structure, typography,
colours, spacing, radius, states, and usage rules are given for each.

### App Title

**Purpose.** Name the app, once, and get out of the way.

**Visual structure.** A single `--type-display-sm` line with
`--type-display-sm-tracking` in `--color-ink`, `max-width: --container-max`,
centred.

**Usage rules.** The title itself carries no metadata, no counts, and no actions.
A clock, a date line, or an item total beside the title is clutter competing with
the session timer for the same glance. The `<h1>` lives here, on the Home view,
and it is the **only** one: every other heading in the system is an `h2`, so
navigating to Profile or Focus Session replaces the single `h1` with an `h2` and
never leaves a view with two of them. The greeting that sits around it belongs to
[Welcome](#welcome), not to the title, and it must not be folded into it.

### Welcome

**Purpose.** Address the user by the name they gave, and name the app it belongs
to. Nothing else: it is a heading band, and a heading band that starts doing work
stops being one.

**Visual structure.** A `.welcome` flex column, `gap: --spacing-xxs`, holding
exactly two things in this order: `.welcome__greeting`, then the shared
`.app-title` `<h1>`. It carries **no panel treatment** — no background, no
border, no padding — because it is a heading band, not a card.

- **Greeting** — `.welcome__greeting`, `--type-body-sm` in `--color-muted`,
  reading `Welcome, Hisham`. It is supporting information, so it is `muted` and
  never `ink`: the title owns the emphasis.
- **Title** — the shared `.app-title`, see above.

**Usage rules.**

- The greeting is a name and nothing else. No date, no clock, no streak, no
  count — those are [Quick Stats](#quick-stats) or the Profile, and a heading
  band that grows a paragraph stops being a heading band.
- **The band carries no action at all.** It used to hold a `Profile` button, and
  that button is gone: the [Bottom Navigation](#bottom-navigation) is the one
  way into the Profile view, and a second trigger in the band would be a
  duplicate of it for no gain. The same is true of an add trigger — the column
  headers own those, see [Planner Layout](#planner-layout).
- Onboarding renders its own `.app-title` in the same step. That is the same
  class used twice across two mutually exclusive surfaces, not two titles.

### Update Banner

**Purpose.** Say that a new version exists, and offer to install it. It is the one
piece of the app that reports something the user did not ask about, so it is also
the one piece that has to be quiet, dismissible, and impossible to mistake for
something that needs doing now.

**Visual structure.** A `.update-banner` block, the first child of the Home view's
wide track and above the welcome band, so it is the first thing on screen when it
is there and costs the stack nothing when it is not. It reuses the composer's and
the Profile's outlined treatment rather than inventing one: `flex` row,
`align-items: center`, `gap: --spacing-sm`, `flex-wrap: wrap`, padding
`--spacing-md`, radius `--rounded-lg`, background `--color-canvas`,
`--elevation-hairline`. It is a **block in the flow, not a toast**: no
`position: fixed`, no overlay, no backdrop, because the system has none of those
and a notice that floats over the planner would be a new layer invented for one
message.

- **Body** — `.update-banner__body`, a flex column, `gap: --spacing-xxs`,
  `flex: 1 1 auto`, `min-width: 0`, so a long version string wraps instead of
  pushing the controls off the row.
- **Title** — `.update-banner__title`, `--type-title-md` in `--color-ink`. A noun:
  `Update available` or `Update ready`.
- **Note** — `.update-banner__note`, `--type-body-sm` in `--color-muted`: one
  sentence, the version number and what is happening to it.
- **Actions** — `.update-banner__actions`, a flex row, `gap: --spacing-xs`,
  `flex: 0 0 auto`. A primary `Button` and one `IconButton`; nothing else.

**States.**

| State | Title | Note | Action |
| --- | --- | --- | --- |
| Found, still downloading | `Update available` | `Version 1.1.0 is downloading.` | dismiss only |
| Ready to install | `Update ready` | `Version 1.1.0 is ready. Restart to install it.` | `Install and restart`, then dismiss |
| Closed | — | — | dismissed for the rest of the launch |

The banner is a `role="status"` region, so a download finishing announces itself
without anything moving.

**Usage rules.**

- **Nothing is installed without a press.** The install control appears only once
  the download is finished, and the one press of a button labelled `Install and
  restart` is the whole confirmation. There is no second confirmation step: a
  `.confirm-row` is for destroying something, and restarting into a new version
  does not destroy the document, which is written to disk before it is asked
  about.
- The install button is the **only** primary button on Home — the column Add
  triggers are `.button-secondary` — so the brand pink marks exactly one thing
  the user may act on. It is never a fourth icon in a row of icons, and it
  carries its label in words.
- Dismissing is an `IconButton` labelled `Dismiss the update notice`, because a
  close glyph that names what it closes is a control and an unlabelled one is a
  mystery. It hides the banner for the rest of the launch and changes nothing on
  disk.
- It appears on the **Home view only**, and only when the main process has
  reported an update. There is no version number, no "up to date" state, and no
  check button: the app looks once per launch and says nothing when there is
  nothing to say.
- It carries no second action, no countdown, and no progress bar. A notice that
  grows a second line of controls is a dialog, and the system has none.
- Never let an update failure reach this surface. A check that cannot reach GitHub
  is logged in the main process and shown nowhere, because being offline is this
  app's normal state.

### Quick Stats

**Purpose.** Answer "how am I doing" in four numbers, read off the document that
is already open.

**Visual structure.** A `.quick-stats` flex row, `gap: --spacing-xs`,
`flex-wrap: wrap`, above the tasks column. Each figure is a `.quick-stat` flex
column, `gap: --spacing-xxs`, holding a label and a value. Four of them:
`Today's Tasks`, `Completed Today`, `All Tasks`, `Next Reminder`.

- **Label** — `.quick-stat__label`, `--type-caption` in `--color-muted`. It
  carries the unit, because a bare number is not a figure.
- **Value** — `.quick-stat__value`, `--type-title-md` in `--color-ink` with
  `tabular-nums`, so a changing count does not shift the row.
- **Note** — `.quick-stat__note`, `--type-caption` in `--color-muted-soft`, on
  the reminder figure only: the remaining time, or `Nothing scheduled`.

**Usage rules.**

- Every figure is **derived from the rows below it**, never stored separately, so
  a count can never disagree with the list it describes. There is no history and
  nothing to click: a number is here because the rows already exist.
- **No colour.** A count is not a status. `--color-error` and `--color-success`
  are reserved for a destructive action and for something finished, and a
  percentage is neither.
- Keep it to four figures. A strip that grows to eight stops being a glance.
- This is a count band, and the **only** one. The column headers still count
  nothing; see [Planner Layout](#planner-layout).

### Onboarding

**Purpose.** Ask once, on first launch, for the name the welcome line reads. No
account, no email, no password: the planner has no backend to authenticate
against, and a name is all the greeting will ever show.

**Visual structure.** A `.onboarding` form filling `.app-shell`, centring a
`.onboarding__panel` of `max-width: --control-form-width` (420px). The panel is
a flex column, `gap: --spacing-md`, `align-items: stretch`, background
`--color-canvas`, radius `--rounded-lg`, padding `--spacing-lg`, and
`--elevation-hairline`. Top to bottom it holds the shared `.app-title`, an
`.onboarding__greeting`, one `Field`, and the `.onboarding__actions` row.

- **Greeting** — `.onboarding__greeting`, `--type-title-lg` in `--color-ink`.
- **Field** — the shared `Field` and `.text-input`, labelled `Your name`. It is
  the only control on the screen.
- **Actions** — a `Button` submit reading `Start planning`, and the shared
  `.form-error` for the failure, in that order, so the message never pushes the
  button.

**Usage rules.**

- An empty submit sets the `role="alert"` message rather than disabling the
  button, exactly as the composer does. The user is told what is wrong instead
  of being left with a dead control.
- The name is trimmed and capped at 200 characters, the same bound a task title
  carries.
- **The gate is a state, not a screen.** It renders instead of the planner while
  the document holds no name, and it never appears again once a name is saved.
  It is not a route and it cannot be dismissed.

### Session Timer

**Purpose.** Run one study session. The user chooses how much focus time it holds
and how long the breaks run; the panel does the arithmetic and shows the block
that is running.

**The panel has five faces, and only one of them is a clock.** It is the whole
of the [Focus Session view](#focus-session-view), and the view modifier on
`.focus-session` decides which face is on screen.

| View | Modifier | What it shows |
| --- | --- | --- |
| Idle | `.focus-session--idle` | The heading, then the `Focus` button under it |
| Setup | `.focus-session--setup` | The three lengths, the `Breaks` choice, and `Start` |
| Break setup | `.focus-session--breakSetup` | One `Wheel` of break minutes, and `Start Break` |
| Session | `.focus-session--session` | The running clock, centred |
| Complete | `.focus-session--complete` | Completion heading, complete GIF, the session summary, and a `Done` button |

Idle, complete, and break setup tighten the panel to `gap: --spacing-md`; the
session face keeps the full `gap: --spacing-xl`, so the ring owns the space
instead of sharing it with a form.

**Idle.** The panel is already a column, so the title, the animation, and the
button stack without a wrapper of their own: the `h2` first, the
`.focus-session__animation` image, then a primary `Focus` button. `.focus-session--idle`
adds `align-items: center`, so they sit centred in the band like every other
face, and `gap: --spacing-md` separates them. There is deliberately **no clock,
no ring, no progress, and no line of guidance** in this state: a timer showing
`25:00` before the user has asked for a session is a timer they did not start,
and an idle panel that explains itself is doing the work of the button.

`.focus-session__title` therefore carries **no margin at all** — it is typography,
nothing else. A cross-axis `auto` margin outranks `align-items`, so a
`margin-right: auto` left over from the bar layout would silently pin the title to
the left edge of an otherwise centred face.

`.focus-session__bar` is the setup, break setup, and session faces only: exactly two
children, the title and that face's one action, held apart by
`justify-content: space-between`.

**Setup.** `.focus-session__setup` is a `fieldset` — so it is a real named group, not
a `div` with a role — reset to `margin: 0; padding: 0; border: 0`, then a flex
column, `align-items: center`, centred in the middle of the panel. Its `legend`,
`.focus-session__setup-title`, is `Focus session` in `--type-title-md`, and that legend
is the group's accessible name. It carries, top to bottom:

- `.focus-session__setup-title` — the legend above.
- `.focus-session__setup-lengths` — the two `Wheel` columns, side by side: the
  session's hours and its minutes, each a `fieldset` with its own `legend`
  reading `Hours` or `Minutes`, so both lengths are still named groups. Each
  column is the chosen value alone, in `--type-display-sm`, with the plus
  `IconButton` stacked **above** it and the minus **below** it rather than either
  of them beside it, which is what makes the pair read as a wheel. No other number
  is drawn in a column, so the value is the only thing there to read. Hours step by **60** minutes and
  minutes by **5**, and the two move independently. A button is disabled exactly
  when its result would leave the `25`-to-`720` minute range, so the panel can
  never display a length it will not honour. There is no `input[type="number"]`
  and no native select anywhere in it. The value is `02` and `00`, never `2h` and
  `0m`: the column's legend is the unit.
- The **Breaks** choice — a `.focus-session__row` whose `--type-caption`
  `.focus-session__row-label` reads `Breaks` and whose `PillGroup` is labelled `Breaks`,
  offering `On` and `Off`. It is a `PillGroup` and not a switch because the design
  system has no switch and inventing one would be a new primitive; two words in a
  row say the same thing with a control that already exists.
- The two break lengths — a `.focus-session__row`, holding a
  `--type-caption` `.focus-session__row-label` and a `PillGroup`: `5m` / `10m` and
  `15m` / `30m`. **These two rows are removed from the tree while Breaks is
  `Off`**, not merely hidden, so a screen reader never walks a length that has no
  effect. Turning Breaks back on restores the previous two choices rather than
  resetting them: a toggle that forgets what you set is a second decision.
- `.focus-session__summary` — the plan in one line, `5 focus blocks · 2h 30m with
  breaks`, so the cost of the choice is visible before it is made. With Breaks
  `Off` the plan is a single continuous block, so the line drops the block count
  and the "with breaks" clause entirely and reads `2h focus session`: reporting
  `Block 1 of 1 · 2h focus left · 2h total` would be the same number three times.
- `Start` — the only primary button on this face.

There is a `Cancel` text button in the bar, so the setup can always be backed out
of, and the bar's action is never the only way forward.

**Session.** `.focus-session__centre` is a flex column, `align-items: center`,
`gap: --spacing-md`:

- **Phase** — `Focus`, `Short break`, `Long break`, or `Break`, in
  `--type-title-md` in `--color-ink`. Plain text, not a pill: the ring below it is
  already the only shape on this face. `.focus-session__phase--break` switches the label
  to `--color-warning`, the one place the warning tint means "you are on a break"
  rather than "something is wrong".
- **Ring** — `--control-ring-size` square, `place-items: center`, carrying
  `role="progressbar"` with `aria-valuenow` in percent. The track is a full
  circle on `--color-surface-strong`; the arc is
  `stroke: --color-primary`, `stroke-linecap: round`, and
  `stroke-dashoffset: calc(--control-ring-circumference * (1 - --progress))`, so
  the arc grows from twelve o'clock to the whole circle as the session completes.
  On a break the arc switches to `--color-warning`. Inside the ring,
  `.focus-session__ring-content` houses the state-mapped `.focus-session__animation` (with
  `.focus-session__animation--ring`) vertically stacked above the `.focus-session__clock`.
- **Clock** — `--type-display-md` with `--type-display-md-tracking` in
  `--color-ink`, `font-variant-numeric: tabular-nums` so the digits do not jitter,
  centred in the ring. Shows `25:00`, or `1:05:00` once a block is an hour or
  longer. It appears **once**, inside the ring.
- **Controls** — one centred row of three icon-only `IconButton`s, equal in size
  and in a single `.focus-session__controls` group: **Pause/Resume**, **Skip**,
  **Reset**. There is no text on this face's controls, so each button's name is
  its `aria-label` and nothing else: `Pause session` / `Resume session`,
  `Skip this block`, `Reset the session`. Glyphs alone are not labels, and a
  `title` is not one either; the accessible name is the whole contract. The three
  are one `Button`-family group rather than three scattered buttons, so the row
  reads as a single cluster at every panel width.
- **Pause, Resume, and Skip all stay live during a manual break.** A manual break
  borrows the session face, so the face's controls keep working on it rather than
  greying out. **Pause** freezes the **break's** countdown, not the focus
  block's, and Resume continues that same break from where it stopped; the focus
  block underneath is untouched either way. **Skip** ends the break early and
  resumes the focus block from the point it was holding. Both are live because
  both are the two things a person actually does when a break is going wrong: stop
  it for a moment, or cut it short. A control that goes dead on the face the user
  is looking at reads as a broken panel, not as a considered state.
- **Paused stopwatch** — while the clock is paused, a `--type-caption`
  `--color-muted` line reading `Paused for 4:07` sits between the controls and the
  block caption, and counts up once a second. It is in the caption treatment and
  not in the clock's `--type-display-md` on purpose: the clock is frozen and there
  is nothing to read there, while a second display-sized number would compete with
  the ring and turn a caption into a second headline. It appears **only** while
  paused, and it is gone the moment the clock runs again. It counts time the user
  spent deliberately paused, and **never** counts toward focus time: a pause is the
  absence of work, and a summary that reported it as focus would be lying about
  the one number the panel exists to get right.
- **Reset is confirmed, inline, in its own slot.** Pressing `Reset` replaces
  **only the Reset button** with the two-button `.confirm-row` used for task and
  reminder deletion — `Yes, reset` and `No, keep going` — and nothing else on the
  face moves. Pause and Skip stay exactly where they were, so a mis-click is one
  press of `No` away from nothing. This is deliberately **not** a `modal`, a
  dialog, a route, or a centred overlay: a destructive action on a clock must not
  cost the user the clock they are watching. `Yes` returns to block one, paused.
- **Take a Break** — a secondary `Button` **below** the icon row, centred, with
  its label spelled out. A break is offered whether or not the plan scheduled one,
  and it is offered even with Breaks `Off`, because the two are independent:
  turning the planned breaks off says "do not interrupt me on this schedule", not
  "I will never stop". It is a secondary button and not a fourth icon, because
  unlike Pause, Skip, and Reset it is an **addition** to the plan rather than a
  control over the block already running, and an icon with no label would make
  the user read three glyphs correctly before they could take a break. It is
  disabled while a manual break is running, because a second break on top of the
  first is not a state the design has a meaning for.
- **Caption** — `--type-caption` in `--color-muted`, reading
  `Block 1 of 5 · 2h focus left · 2h 30m total`. `Block n of m` counts **focus**
  blocks, not every block, so a two-hour session reads `Block 1 of 5`. A break
  reports the block it follows, so the counter only moves forward. With Breaks
  `Off` it reads `2h focus session` instead, for the reason given on the setup
  face. The paused stopwatch is a separate line above this one, never folded into
  it, so a caption about work is never also a caption about not working.
- **Change session** — a text button in the bar that opens the setup again. It
  exists because re-planning is a feature, not a favour: without it a session
  could be started and never adjusted. Opening it is also a **pause**: the clock
  must not keep counting behind a panel the user is still deciding on.

**A manual break borrows the session face, it does not get one of its own.** While
it runs, the ring and the clock show the **break's** remaining time and the phase
reads `Break`, but the focus block's clock is held exactly where it was and resumes
from that point. The alternative — draining the focus clock to buy break time — would
mean the user finishes a two-hour session having only ever focused for an hour and
forty-five, which is not what they asked for. The ring's progress is the break's own
share, so the arc measures what is on screen. The break modifiers on both the
phase label and the ring arc are taken from the phase the face is **actually
showing**, so a manual break can never inherit the focus colour by reading state
that is no longer on screen. `Take a Break` is disabled while a manual break is
running, because a second break on top of the first is not a state the design has
a meaning for; **Pause**, **Resume**, and **Skip** are not, because pausing and
ending a break early are both real acts a user performs on a break. The break
time a manual break banks is measured from the break's own planned length, so a
paused break resumes on the second it left and banks only the seconds it actually
ran.

**Break setup.** `.focus-session--breakSetup` is the smallest face in the system, and it
reuses the setup face's `fieldset` rather than inventing a structure:

- `.focus-session__setup` — the same `fieldset` and the same `legend` treatment, reading
  `Take a break`, so the group is named rather than a `div` with a role.
- A single `Wheel` labelled `Minutes`, the same primitive the session length uses,
  starting at `05` and clamped to `5`-`60` minutes, stepping by **5**. The range
  starts at **5**, not 1, and steps in fives rather than ones, because a break
  length here is a *plan*, and the same five-minute granularity the session length
  already uses is the one the user has just been reading. A one-minute dial would
  also spend three more clicks to express a value this panel can already show.
  One column, because there is
  one number: a `Wheel` is a column, and a wheel with two would be asking about an
  hour nobody is planning a break in. A `Wheel` and not an `input[type="number"]`,
  for the same reason the session length uses one.
- `Start Break` — the only primary button, and the bar's `Cancel` sits beside it.

`Cancel` returns to the session **running from the same point**, because opening the
picker pauses the clock and backing out of a pause should not silently keep it
paused. The manual break's minutes are held in component state, not in the plan: a
manual break is not part of the session shape, so re-planning must not disturb it.

**States.** Running and paused differ only by the pause button's glyph and
accessible name, because the clock itself never stops formatting. When the last
block finishes, the panel switches to the dedicated Complete face
(`.focus-session--complete`) rather than showing an exhausted session face.

**The complete face is a summary, not a congratulation.** It keeps the
`/assets/focus-session/complete.gif` celebration animation (alt `Session complete
celebration animation`) and its `--type-title-md` heading, `Session complete`, and
then reports what the session was actually worth:

- `.focus-session__summary-card` — a centred card on `--color-canvas`, outlined by
  `--elevation-hairline` at `--rounded-lg`, holding three figures in
  `--type-title-md` in `--color-ink`: the **focus time** the session accumulated, the
  **break time** it spent, and the **time it spent paused**, each formatted by
  `formatDuration` and each with a `--type-caption` `--color-muted` label above it.
  It is a plain block with a
  border, not a dialog: there is no `role="dialog"`, no backdrop, no focus trap, and
  no second screen, so the user is still looking at the panel their session lived
  in. The two time figures are **combined** — every focus block and every break
  summed into one total each — because the panel has always tracked one focus total
  and one break total, and splitting the breaks into short and long would be a
  distinction the summary has no use for. **Paused time is a third figure and is
  never added to the focus figure**, because a pause is time the user was not
  working and folding it in would report two hours of focus for a session that
  contained a twenty minute coffee break.
- `Done` — the only control, and a primary `Button`, since dismissing the summary
  is the only thing left to do. It returns the panel to **idle** and clears the run
  totals, so a second session starts from zero rather than reporting the first one
  again.

A `Reset` pressed on a *running* face still returns to block one, paused, and it
keeps the run totals: re-arming the clock is not the same act as ending the run,
and a user who resets twice should still be told they focused for an hour.

**Usage rules.**

- **The session is never persisted.** It lives in memory only, so closing the app
  forgets it. A saved timer would come back claiming time the user did not spend.
- The clock is driven by an absolute end time, never by counting ticks, so a slow
  frame or a backgrounded window cannot make a 25-minute block run long.
- Changing any length re-plans from block one. The blocks the user just watched
  are no longer the blocks they asked for.
- **The run totals only ever go up.** Focus seconds, break seconds, paused seconds,
  and completed
  focus blocks accumulate across pause, skip, `Reset`, and re-planning, and are
  cleared in exactly two places: the session finishing, and the user pressing
  `Done`. `Reset` re-arms the clock; it does not erase the session, so a user who
  resets twice is still told they focused for an hour.
- **Paused time is tracked in its own column and never in the focus column.** The
  three accumulators are written by different transitions on purpose: focus is
  banked when a **focus block** ends, break time when a **break** ends, and paused
  time on every tick of a stopwatch that only runs while the clock is stopped. A
  single shared accumulator would have to guess which of the three it was looking
  at, and guessing is how paused minutes end up reported as focus.
- Never add a second timer, a sound, or a notification to this panel. The ring
  reaching empty is the whole notification.
- Never show a running clock in the idle or setup state. The idle face is a
  title and a button, and that button is the feature.
- Never put a second element beside the idle `Focus` button. If the idle face
  needs explaining, the setup is one press away; the panel does not grow a
  paragraph of guidance to avoid a click.
- Never centre a face with a `margin: auto` hack. Centring is `align-items` on
  the face, or `justify-content: space-between` on a row that has two ends.

### Planner Layout

**Purpose.** Frame the two columns and give each one an identity and a way in.

**Visual structure.** `.planner-grid` is the grid described above.
`.planner-column` is a flex column with `gap: --spacing-md` and `min-width: 0`.

- **Column header** — flex row, `gap: --spacing-sm`, and **no `flex-wrap`**. The
  `--type-title-lg` title in `--color-ink`, then the Add button pushed right with
  `margin-left: auto`. Those two are the whole header: the row must not break, or
  the Add drops under the title in the narrower reminders column, and **nothing
  counts the items beside a title** — the list below is the count.
- **Composer slot** — the inline composer, rendered under the header of the column
  that opened it, and only while it is open.

**Usage rules.** Both columns are the same `PlannerColumn` component, so the tasks
and the reminders can never drift apart. Each column owns exactly one add
trigger, it sits in that column's header beside the title, and it is labelled with
what it adds: `Add task`, `Add reminder`. There is no global add button anywhere in
the app, and no counter beside a column title.

### Bottom Navigation

**Purpose.** Move between the app's three views, and stay put while doing it.
The bar is the whole of the navigation: the app has no route to lose, no history
to go back through, and no URL, so a view is a piece of component state and the
bar is the only thing that changes it.

**Visual structure.** `.bottom-nav` is a single row pinned to the bottom of the
window: `position: fixed`, `inset-inline: 0`, `bottom: 0`, `z-index: 2`,
`display: flex`, `align-items: stretch`, `justify-content: center`,
`gap: --spacing-xxl`, padding `--control-padding-block` /
`--content-padding-inline`, a `1px` `--color-hairline` top border, and
`--color-canvas` behind it. It is **fixed rather than sticky** so it cannot
scroll away under a thirty-day Profile calendar, and the hairline top border
rather than a shadow, because a shadow on a bar that sits on the canvas would be
the only depth in the system with no panel to cast it.

- **Item** — `.bottom-nav__item`, a `<button>` of the user's own text, not the
  `Button` primitive: it is a destination, not an action, and the `Button`
  family's fills and radii are for things that do something. It repeats
  `.category-tab` exactly — `padding: --tab-padding-block /
  --tab-padding-inline`, `border: 0`, transparent, `--type-nav-link` in
  `--color-muted`, `cursor: pointer`, `transition: color var(--motion-fast)`,
  hover to `--color-ink`.

**States.** The current view is `aria-current="page"`, and it takes the shared
choice-group treatment: `--type-tab-selected` in `--color-ink` with a
`2px inset 0 -2px 0 currentColor` hairline in the word's own colour. **No fill,
no pill, and no `--elevation-pill-active` shadow**, exactly as
[Tabs / Filters](#tabs-filters) prescribes. The hairline reads as emphasis rather
than as a pressed button, and because the type step is the same 14px in both
states, switching views never reflows the bar.

**Usage rules.**

- The bar carries **exactly three** items — `Home`, `Profile`, `Focus Session` —
  in that order, and it renders on all three views. It is chrome, not content, so
  it is never conditional on the current view and never has an item added to it.
- It is a `<nav>` with an accessible name, and each item is a real `<button>`,
  so the current view is announced rather than merely coloured.
- **It navigates; it never chooses a value and never triggers an action.** This is
  the line between the bar and a choice group, and it is why the two share a
  treatment but not a component.
- The shell reserves `--spacing-section` of bottom padding at every width, so the
  last row of any view clears the bar rather than hiding behind it.
- It does not render over [Onboarding](#onboarding): the gate is a state of the
  app with no view of its own, and there is nowhere on it to navigate to.

### Buttons

Three variants plus one icon-only form, all built from the `Button` and
`IconButton` primitives in `ui.tsx`.

| Variant | Class | Background | Text | Border |
| --- | --- | --- | --- | --- |
| Primary | `.button-primary` | `--color-primary` | `--color-on-primary` | transparent |
| Secondary | `.button-secondary` | `--color-canvas` | `--color-ink` | `--color-hairline` |
| Text | `.button-text-link` | transparent | `--color-ink` | none |
| Icon | `.button-icon-circular` | `--color-canvas` | `--color-ink` | `--color-hairline` |

- **Typography** — `--type-button` for all three variants; `--type-nav-link` for
  `.text-link`.
- **Sizing** — `--control-height` (40px) tall, padding
  `--control-padding-block` / `--control-padding-inline` (12px / 20px),
  `gap: --spacing-xs` between icon and label, `white-space: nowrap`.
- **Radius** — `--control-radius`, which resolves to `--rounded-md` (8px).
- **Text variant** overrides height to `auto` and padding to `0`, so it sits on
  a text baseline rather than a button box.
- **Icon variant** — `--icon-button-size` (36px) square, `flex: 0 0` so it never
  collapses, `--rounded-full`.

**States.** Hover changes fill: primary → `--color-primary-active`, secondary →
`--color-surface-soft`, text → underline. Pressed applies
`--elevation-control-active` (inset) and keeps the hover fill. Disabled fills
`--color-surface-strong` with `--color-muted-soft` text, no border, no shadow,
`cursor: not-allowed`.

**Transition.** `background-color`, `color`, and `border-color` over
`--motion-fast` (`120ms ease`). No transform, no scale, no bounce.

**Usage rules.**

- `IconButton` **must** be used for icon-only controls. Never hand-write
  `<button className="button-icon-circular">`; the primitive owns the class list
  and sets both `aria-label` and `title` from one `label` prop.
- Icon-only controls are never unlabelled. `label` is mandatory and must read
  as the action, including its target: `Delete "Read chapter 4"`, not
  `Delete`. This is what makes the row readable to a screen reader.
- Destructive icon buttons take `tone="danger"`, which adds `.danger-link` and
  `--color-error`.
- Exactly one primary button per form. Secondary and text are for everything else.

### Inputs

`text` and `select` share one treatment. `date` and `time` are **not** native
inputs — see [Pickers](#pickers).

| Property | Value |
| --- | --- |
| Height | `--control-height` (40px) |
| Padding | `--input-padding-block` (10px) / `--input-padding-inline` (14px) |
| Radius | `--control-radius` → `--rounded-md` |
| Border | `1px solid var(--color-hairline)` |
| Background | `--color-canvas` |
| Text | `--type-body-md`, `--color-ink` |
| Placeholder | `--color-muted-soft` |
| Width | `100%` for text; intrinsic for `select` |

**States.** Focus removes the outline and promotes the border to `--color-ink`,
so focus is a dark 1px line rather than a coloured glow. Disabled fills
`--color-surface-strong` with `--color-muted-soft` text.

The global `:focus-visible` rule in `base.css` supplies a `2px solid
--color-ink` outline at `2px` offset for anything that is not an input, so
keyboard focus is always visible and always the same ink.

**Usage rules.** Every input is wrapped in `Field`, which supplies the label.
`Field` is a flex column with `gap: --spacing-xs`; the label is
`--type-caption` in `--color-muted`. An input without a visible label is not
acceptable — if the label would not fit, the control is in the wrong layout.

`.text-input` is the only full-width flexible field in a form; other fields size
to content and the title field carries `field--grow` (`flex: 1 1 200px`).

### Stepper

**Purpose.** Change a number without a number field. The app's own control for
the hour and the minute of a time. A quantity that deserves to be read as a
wheel rather than as a row — the session length — is [Wheel](#wheel) instead.

**Visual structure.** A `fieldset` with a `legend`, so the row is a real named
group rather than a `div` with a role. `.stepper-row` is
`display: flex; align-items: center; gap: --spacing-sm` with
`margin: 0; padding: 0; border: 0` — the browser's own fieldset box is switched
off, because a bordered box around a number is exactly the system chrome the app
refuses elsewhere.

- **Legend** — `.stepper-row__label`, `--type-caption` in `--color-muted`,
  `white-space: nowrap`, and it is the group's accessible name.
- **Buttons** — `IconButton`s either side of the value, in a `.stepper`. The
  minus comes first, the plus last.
- **Value** — `.stepper__value`, `--type-title-md` in `--color-ink`,
  `min-width: --icon-button-size`, `text-align: center`,
  `font-variant-numeric: tabular-nums` so a changing number does not shift the
  row. The value carries no unit: the legend above it says what it is.

**States.** A stepper that would leave its legal range takes `disabled` on that
one button, never on both: one direction is usually still available.

**Usage rules.**

- The caller's arithmetic lives in the domain, not here. `onStep` is handed
  `-1` or `1` and the caller decides what that means: `shiftClock` for a time,
  `stepSession` for a session length. The primitive never knows the range.
- `canDecrease` and `canIncrease` are independent, so the button that would break
  a rule locks while the other one still works.
- **Never `input[type="number"]`.** Spinners drawn by the operating system are
  not this app's, and a number field invites typing a value the plan cannot
  honour.
- Every accessible name is explicit (`Decrease minute`, `Add an hour`), because
  the icon alone says nothing.
- A stepper is a **row**. If the quantity is one a person reads as a clock face
  rather than as a field, use `Wheel`; do not restyle this one into a column.

### Wheel

**Purpose.** Read one part of a quantity as a wheel, the way a phone reads an
alarm time: the chosen value in the middle, a plus above it and a minus below. It
is the session length's only control, and it exists because hours and minutes are
read as a pair.

**Visual structure.** A `fieldset` with a `legend`, so the column is a real named
group, exactly as a stepper's row is. `.wheel` is
`display: flex; flex-direction: column; align-items: center; gap: --spacing-xxs`
with `margin: 0; padding: 0 --spacing-sm; border: 0`. The column is a **stack**:
legend, then the plus, then the value, then the minus.

| Part | Class | Treatment |
| --- | --- | --- |
| Legend | `.wheel__label` | `--type-caption` in `--color-muted`, `padding: 0` |
| Value | `.wheel__value` | `--type-display-sm` with `--type-display-sm-tracking` in `--color-ink`, `min-width`/`min-height: --control-height`, `tabular-nums` |
| Plus | `IconButton` | the shared `.button-icon-circular`, above the value |
| Minus | `IconButton` | the shared `.button-icon-circular`, below the value |

- **The chosen value is the only number.** The group's accessible name is the
  legend, and its text content is the value and nothing else.
- **The two controls bracket the value vertically**, not beside it. A plus above
  and a minus below, with a value between them, is what makes the column read as a
  wheel instead of as a row with extra decoration. This is the order a phone stacks
  a wheel in, and it is not to be flipped: the value grows towards the top.
- **No box, no card, no radius.** A wheel is a number on the surface it is on. The
  only line in it is the `--color-hairline` hairline a second column carries on its
  inline-start border, so a pair reads as one control.
- **A pair of columns is one control.** `.wheel + .wheel` draws the divider, and
  the container's own gap is only a hair's width, because each column brings its
  own padding and the divider has to stay on the centre of the pair.
- **The chosen value settles in** on `wheel-settle`, a `--motion-fast` opacity
  fade, because the value is keyed by its own number and therefore mounts afresh
  on every step. Nothing moves and nothing is measured.

**States.** A button whose press would leave the legal range is `disabled`, which is
the whole of what a column at the end of its range has to say.

**Usage rules.**

- **Never `input[type="number"]`, never a native time input, never a dropdown,
  never a segmented control.** A wheel is the whole point: the value is chosen by
  moving up and down its column, not by typing or by picking from a list.
- **Never draw a second number in a column.** A value above or below the chosen one
  is context, and context here is noise: it competes with the one number the
  person came to read, and it can only ever be a value a press does not reach. The
  scale of a column is a matter for its step, not for its face.
- Values are zero-padded to two digits, so a wheel writes `02` the way a clock
  does.
- The caller's arithmetic still lives in the domain: `onStep` is handed `-1` or
  `1`, `canDecrease` and `canIncrease` come from the caller's range, and the
  primitive knows nothing about `25`-to-`720`.

### Pickers

**Purpose.** Let the user choose a day and a time without handing the task over
to the operating system.

**Visual structure.** Both are the same two-part shape: a `.picker-trigger`
button that looks like an input and carries the current value, and a
`.picker-popover` anchored beneath it. The popover is a flex column,
`gap: --spacing-sm`, padding `--spacing-md`, radius `--rounded-lg`, background
`--color-canvas`, `box-shadow: --elevation-hairline`, width
`--control-popover-width` (280px). The compact time variant keeps that as its
minimum width instead of a fixed one, so it hugs its content.

- **Trigger** — `--control-height` tall, `--type-body-md` in `--color-ink`,
  `1px solid --color-hairline`, radius `--control-radius`, `gap: --spacing-xs`
  between a 16px glyph and the value. Carries `aria-haspopup="dialog"`,
  `aria-expanded`, and, while open, `aria-controls`.
- **Day popover** — head with previous/next month `IconButton`s and the month name
  in `--type-title-md`; a weekday row of `--type-caption` initials; a
  7-column grid of `--icon-button-size` cells; a footer with a Today shortcut.
  The grid is always 42 cells, so it cannot change height as months are paged.
- **Time popover** — the shared `Stepper` for hours and minutes, and an AM/PM
  `PillGroup`, in `.picker-row` rows. The value is read in 12-hour form with a
  meridiem pill, because that is how the user thinks, while storage stays
  24-hour.

**States.**

| State | Treatment |
| --- | --- |
| Closed | Trigger at rest, hairline border |
| Open | `.picker-trigger--open` promotes the border to `--color-ink` |
| Day outside the month | `--color-muted-soft` text |
| Day is today | `--color-hairline` border |
| Day selected | `--color-primary` fill, `--color-on-primary` text |
| Day beyond the ceiling | `disabled`, `--color-muted-soft`, `cursor: not-allowed` |

**Usage rules.**

- **Never `input[type="date"]` or `input[type="time"]`.** A native control brings
  the system's chrome, its own locale, and a different visual language into a
  screen that is otherwise entirely this app's. The pickers exist to be the
  opposite of that.
- The popover is an **anchored popover, not a modal**: no backdrop, no focus
  trap, no scroll lock. It closes on `Escape` and on a press outside itself, via
  the shared `useDismiss` hook. Choosing a value closes it; paging months does
  not.
- The `role="dialog"` on the popover carries an `aria-label` of what it is
  choosing (`Choose a day`), because the trigger's own label already says `Day`.
- The time picker steps in five minutes and wraps around midnight. The default
  reminder time is the next five-minute boundary at least half an hour away, so
  it is always in the future and always reachable by the stepper.
- Days are capped one year out with `--color-muted-soft` and `disabled` rather
  than hidden, so the boundary is visible instead of surprising.

### Dropdown

**Purpose.** Choose one value from a list too long to lay out as a row of words.
It exists in the primitive set and is fully specified, but **nothing on the
shipped screen consumes it** — see [Known Gaps](#known-gaps). The composer's
priority and repeat fields deliberately do not, per
[Inline Composer](#inline-composer).

**Visual structure.** It reuses the picker's own parts rather than inventing
parallel ones: a `.picker-anchor` wrapper, a `.picker-trigger` button carrying
`aria-haspopup="dialog"` / `aria-expanded` / `aria-controls` and
`.picker-trigger--open` while open, and a `.picker-popover` with
`.picker-popover--menu` — the one variant that tightens the popover padding to
`--spacing-xs` and drops the fixed width, because a list sizes to its longest
option.

- **Option** — `.dropdown-option`, a full-width flex row, `gap: --spacing-xs`,
  padding `--input-padding-block` / `--input-padding-inline`, radius
  `--control-radius`, `--type-body-md` in `--color-ink`, transparent background,
  hover `--color-surface-soft`. The selected one adds
  `.dropdown-option--selected`, which takes `--type-tab-selected` and nothing
  else — the same bold-word treatment a [choice group](#tabs-filters) uses.
- **Mark** — `.dropdown-trigger__dot` / `.dropdown-option__dot`, the same 6px
  `--rounded-full` dot the [priority badge](#priority) uses, with
  `--high` / `--medium` / `--low` modifiers in `--color-error`,
  `--color-warning` and `--color-muted-soft`. An option without a tone simply
  has no dot.

**Usage rules.**

- **Prefer a `PillGroup` for three or four plain options.** A choice group is a
  row of words and costs no popover; a dropdown is for a set that genuinely
  cannot fit a row.
- The `role="dialog"` carries an `aria-label` naming what is being chosen, and
  the trigger is a real `button` with an `id` so a `Field` can label it.
- It closes on `Escape` and on a press outside, via the shared `useDismiss`,
  exactly as a picker does. Choosing a value closes it.
- **Never use it to replace a native `select` in a form field.** The composer
  keeps `select` for repeat, and that is the rule this primitive must not
  erode.

### Task Item

**Purpose.** One task: complete it, read its urgency, act on it.

**Visual structure.** A flex row, `align-items: flex-start`,
`gap: --spacing-sm`, padding `--spacing-sm`, radius `--rounded-md`,
background `--color-canvas`. Three zones: completion toggle, body, actions.

- **Completion toggle** — see [Completion](#completion).
- **Body** — flex column, `gap: --spacing-xxs`, `flex: 1 1 auto`, `min-width: 0`
  so long titles wrap instead of pushing the actions off-row.
  - *Title* — `--type-title-md`, `--color-ink`, `overflow-wrap: anywhere`.
  - *Meta* — flex row, `gap: --spacing-xs`, `flex-wrap: wrap`. Holds the
    priority badge, a repeat badge when repeating, and an Overdue badge when the
    day is past and the task is open.
- **Actions** — flex, `gap: --spacing-xxs`, `opacity: 0`, revealing on
  `.task-item:hover` and `.task-item:focus-within`. Edit and Delete icon buttons,
  replaced in place by the inline confirmation row while confirming.

**States.**

| State | Treatment |
| --- | --- |
| Rest | `--color-canvas` background |
| Hover | `--color-surface-soft` background |
| Editing | `--color-canvas` + `--elevation-hairline` |
| Completed | transparent background; title in `--color-muted-soft` with `line-through` in `--color-hairline` |

**Usage rules.** A completed task keeps its row and its position. It is never
removed from the list — seeing what you finished is part of the record. Because
the title is struck through and dropped to `--color-muted-soft`, a completed row
reads as recessed without needing to move.

### Completion

**Purpose.** The single most-used control in the app. It must be findable and
unambiguous in both directions.

**Visual structure.** A circle, `--icon-button-size` (36px), `flex: 0 0` so it
holds its place, radius `--rounded-full`, `1px solid --color-hairline`,
background `--color-canvas`, with a `margin-top: -2px` optical nudge to centre
it against an 18px title. A 16px check glyph sits inside at
`color: transparent` when unchecked.

**States.**

| State | Fill | Border | Glyph |
| --- | --- | --- | --- |
| Open | `--color-canvas` | `--color-hairline` | invisible |
| Open, hover | `--color-canvas` | `--color-muted` | invisible |
| Done | `--color-success` | `--color-success` | `--color-on-primary` |

**Accessibility.** `aria-pressed` carries the boolean state, and `aria-label`
inverts with it: `Mark "Read chapter 4" as done` becomes
`Mark "Read chapter 4" as not done`. The label always names the task, so the
control is unambiguous when several rows are on screen.

**Usage rules.** This is a toggle, not a checkbox: it is a `<button>` with
`aria-pressed`, not an `<input type="checkbox">`. Its width matches
`--icon-button-size` rather than the 18px glyph, because the target must stay
comfortable for rapid repeated use.

### Priority

**Purpose.** Communicate urgency at a glance, without reading the title.

**Visual structure.** A standard pill badge carrying a 6px dot
(`6px × 6px`, `--rounded-full`, `flex: 0 0 6px`) followed by the capitalised
priority name. Dot size is a deliberate 6px literal, not a token: it is a mark
inside a badge, not a layout step.

| Priority | Dot colour | Token |
| --- | --- | --- |
| High | red | `--color-error` |
| Medium | amber | `--color-warning` |
| Low | grey | `--color-muted-soft` |

**Priority options are colour coded with the same three colours as the badge.**
`.category-tab--high`, `.category-tab--medium`, and `.category-tab--low` put
their 2px inset line on the **selected** state, in `--color-error`,
`--color-warning`, and `--color-muted-soft` respectively, so the active line wears
the priority's colour and the unselected options stay plain `--color-muted`
words. The same three tokens, no fourth colour, and the colour is always beside
the word.

**Usage rules.** The dot is redundant with the text label on purpose. It is what
survives when a row is scanned at speed; the word is what survives when a screen
reader reads it. Do not drop either.

### Repeat

**Purpose.** Show that a task recurs, so a completed one is not mistaken for a
finished obligation.

**Visual structure.** A neutral pill badge: repeat glyph plus the word `Daily`
or `Weekly`. Rendered only when `repeat !== 'none'`.

### Task Group

**Purpose.** Partition tasks by day, and mark today as the active day.

**Visual structure.** A panel with `gap: --spacing-sm`, padding
`--spacing-lg`, radius `--rounded-lg`, background `--color-surface-card`.

- **Header** — flex, `align-items: baseline`, `space-between`,
  `gap: --spacing-sm`. Day label is `--type-title-md` in `--color-ink`; the
  spelled-out date beside it is `--type-caption` in `--color-muted`.
- **List** — flex column, `gap: --spacing-xxs`. A deliberately tight 4px gap:
  rows within a day are one unit, separated from other days by 24px of panel
  padding.

**Day labels.** Today reads `Today`, the next day `Tomorrow`, and anything
further out is formatted `Thu, Oct 8`.

**States.** `.task-group--today` — the emphasised variant — switches the panel to
`--color-surface-soft` and adds `--elevation-hairline`. Exactly one group can
hold it, the one whose key equals today.

**Usage rules.** The Today emphasis is not decoration; it is how the user finds
the current day without reading every label. Day order is ascending, so past
days sit above today and the user scrolls up to review them.

### Reminder Card

**Purpose.** Carry a deadline and, above all, how much time is left.

**Visual structure.** A panel, `flex-direction: column`, `gap: --spacing-xs`,
padding `--spacing-lg`, radius `--rounded-lg`, background `--color-surface-card`.

- **Head** — flex, `align-items: flex-start`, `space-between`,
  `gap: --spacing-sm`: title on the left, actions on the right
  (`flex: 0 0 auto` so they never compress).
- **Title** — `--type-title-md`, `--color-ink`, `overflow-wrap: anywhere`.
- **Meta** — flex, `gap: --spacing-xs`, `flex-wrap: wrap`,
  `--type-body-sm` in `--color-muted`. Reads `Sat, Sep 27 · 9:00 AM` —
  human-readable date, middot, 12-hour clock. Followed by the remaining-time
  pill.

**States.** `.reminder-card--overdue` — for a moment that has passed — switches
the background to `--color-canvas` and adds `--elevation-hairline`, so an
overdue card becomes the most prominent thing in its column, and recolours its
remaining time to `--color-error`.

**Usage rules.**

- A past reminder is **never hidden or sorted away**. It keeps its chronological
  position and gains emphasis. A deadline you missed is still information, and
  hiding it would quietly remove a real obligation.
- Reminders have no completion state. A reminder is a moment, not a job; the
  moment either arrives or it does not.
- Use 12-hour time with a meridiem suffix (`9:00 AM`) in the meta line. 24-hour
  time is storage only, behind the time picker.

### Remaining Time

**Purpose.** Answer "how long until this?" in the fewest words possible. This is
the app's signature element.

**Visual structure.** An inline-flex pill: padding
`--badge-padding-block` / `--badge-padding-inline` (4px / 12px), radius
`--rounded-pill`, background `--color-canvas`, text `--type-caption` in
`--color-ink`, `white-space: nowrap`.

**Buckets.** Produced by `Intl.RelativeTimeFormat`, so the output is properly
localised rather than hand-concatenated. The largest unit that still reads
naturally wins.

| Distance | Output | Overdue |
| --- | --- | --- |
| Under a minute | `now` | yes, if past |
| Under an hour | `in 30 minutes` | yes, if past |
| Under a day | `in 5 hours` | yes, if past |
| One day | `tomorrow` / `yesterday` | yes, if past |
| 2–13 days | `in 3 days` | yes, if past |
| 14–44 days | `in 2 weeks` | yes, if past |
| 45–329 days | `in 2 months` | yes, if past |
| 330+ days | `next year` | yes, if past |

**States.** Default is `--color-ink` on `--color-canvas`. Inside an overdue card
it becomes `--color-error`. There is no warning or success variant; the past is
binary.

**Usage rules.** Never show a countdown for a task. Countdowns belong only to
moments in time. Never write "in 0 days" — the one-day case is `tomorrow`,
because that is what a person actually says.

### Badges

**Purpose.** Attach a short, scannable qualifier to a row or card.

**Visual structure.** Inline-flex, `gap: --spacing-xxs`, padding 4px / 12px,
radius `--rounded-pill`, background `--color-surface-card`, text
`--type-caption` in `--color-body`, `white-space: nowrap`.

**Tones.** `neutral` is the default and takes no modifier class. The tinted
tones mix a semantic colour into the canvas:

| Tone | Background | Text |
| --- | --- | --- |
| `neutral` | `--color-surface-card` | `--color-body` |
| `accent` | accent @ 12% | `--color-ink` |
| `success` | success @ 14% | `--color-ink` |
| `warning` | warning @ 18% | `--color-ink` |
| `error` | error @ 12% | `--color-ink` |
| `strong` | `--color-primary` | `--color-on-primary` |

**Usage rules.** A badge is a noun, never a sentence. The app currently uses
`neutral` for repeat and `error` for Overdue; the remaining tones are available
but unused. Keep badges on one line and never put more than three on a row.

### Tabs / Filters

**Purpose.** Choose one value from a small set of closely related options. Used
for priority (High / Medium / Low), for the session timer's break lengths, and for
the time picker's AM/PM.

**This is not a segmented control.** The options are labels, so the group is a
row of words, not a row of segments: `.nav-pill-group` is inline-flex with
`gap: --spacing-sm` and **no track, no fill and no radius**. There is no
`--color-surface-soft` pill behind the group and no `border-radius` on it, because
a filled container around a single selected value is the pill-heavy look this
component exists to avoid.

`.category-tab` is transparent, `--type-nav-link` weight in `--color-muted`, at
padding `--tab-padding-block` / `--tab-padding-inline` (8px / 14px).

**States.**

- Hover moves the label to `--color-ink` and changes nothing else.
- Selected (`aria-selected="true"`) takes `--type-tab-selected` — **bold**, at the
  same size as the unselected label, so selecting never reflows the row — plus
  `--color-ink` text and a 2px `inset 0 -2px 0 currentColor` line: a hairline
  under the word, in the word's own colour. **No background fill, no heavy
  bottom border, and no `--elevation-pill-active` shadow.** A selection should
  read as emphasis, not as a button being pressed.

**Usage rules.** `role="tablist"` with `aria-label` on the group and
`role="tab"` plus `aria-selected` on each option, so the selection is announced
rather than merely coloured. Tabs **choose a value**; they never navigate and
never trigger an action. A tab is therefore never an alternative way to spell the
[bottom navigation](#bottom-navigation): the bar moves between the app's three
views while a tab picks one of a column's values, and the two are told apart by
their roles rather than by their looks. `PillOption` takes an optional
`className` for a BEM modifier, which is how the priority options colour their
own active line.

### Empty State

**Purpose.** Say that a column is empty and what to do about it.

**Visual structure.** Flex column, left-aligned, `gap: --spacing-sm`, padding
`--spacing-lg`, radius `--rounded-lg`, background `--color-surface-card`.

- **Title** — `--type-title-md`, `--color-ink`.
- **Body** — `--type-body-sm`, `--color-muted`. One sentence, no more.

`EmptyState` takes a title and a body and nothing else. It has no action slot,
because the column header is already the add trigger and a second one here would
be a duplicate.

**Usage rules.**

- The empty state is **suppressed until the document has loaded** and suppressed
  again while that column's composer is open, so it can never flash over real
  content or duplicate the composer's own submit button.
- It carries **no action of its own**. The column header's Add button is the one
  way in, and two add triggers for the same thing is a defect.
- Keep it left-aligned. Centred empty states read as an apology.
- Write the body as an instruction, not a reassurance.

### Profile

**Purpose.** Report on the work already in the document: the name, the streak,
the focus time, and a thirty-day calendar of it. It reads only stored data, so
every figure survives a restart.

**Visual structure.** A `.profile` panel of `max-width: --container-max`,
centred by the shell, radius `--rounded-lg`, background `--color-canvas`,
padding `--spacing-lg`, `--elevation-hairline`. It is a flex column,
`gap: --spacing-lg`, holding five bands. It is a **view, not a layer**: there is no
overlay wrapper, no scrim, and no `role="dialog"`, so nothing is composited over
the shell and the system is left with no backdrop at all.

- **Title** — `.profile__title` in `--type-title-lg` in `--color-ink`, alone on
  its own row. `.profile__bar` and its `Close` button are gone: the
  [bottom navigation](#bottom-navigation) is the way out of this view, and a
  second control that does nothing but leave is a duplicate of it.
- **Name** — `.profile__name` in `--type-title-md` in `--color-ink`, with a text
  `Button` reading `Edit` beside it. Editing swaps in the shared `Field` and
  `.text-input` inside `.profile__name-edit`, with one `Button` reading `Save`.
- **Streak** — `.profile__streak`, a two-up row of `.profile__streak-item`:
  `.profile__streak-value` in `--type-title-lg` in `--color-ink` over
  `.profile__streak-label` in `--type-caption` in `--color-muted`.
- **Stats** — `.profile__stats`, a wrapping row of `.profile__stat`, the same
  label-over-value shape as [Quick Stats](#quick-stats) at
  `.profile__stat-value` / `.profile__stat-label`.
- **Comparison** — `.profile__comparison`, one line of
  `.profile__comparison-text` in `--type-title-md` in `--color-ink` over
  `.profile__comparison-detail` in `--type-body-sm` in `--color-muted`. Words
  first, then the number.
- **Calendar** — `.profile__calendar` with a `.profile__calendar-title` in
  `--type-title-md`, holding a `.profile__calendar-grid`: thirty
  `.profile__calendar-day` cells, each a flex column holding
  `.profile__calendar-date` in `--type-caption` and `.profile__calendar-focus`,
  plus a `.profile__calendar-tasks` count when the day closed any task.

**Calendar intensity.** A cell's shade is the day's focus time, and the ramp is
one accent mixed into the canvas — no second accent, no extra grey, no new hex.
The accent is the ink, so the ramp reads as a grey heatmap and the pink stays out
of a report that is only reporting:

| Class | Meaning | Fill |
| --- | --- | --- |
| `.profile__calendar-day--empty` | no focus time | `--color-canvas` |
| `.profile__calendar-day--light` | under an hour | accent @ `8%` |
| `.profile__calendar-day--medium` | one to two hours | accent @ `18%` |
| `.profile__calendar-day--strong` | over two hours | accent @ `30%` |

Cells are `--rounded-md` with a `--color-hairline` border, so a pale cell still
has an edge. The ramp is fixed per step, like the badge mix ratios, and the
band's own name is never a colour: a day is identified by its date and its
`title` text, so the shade is redundant rather than load-bearing.

**Usage rules.**

- **This is a report, not a confirmation, and not a layer.** It is reached from
  the [bottom navigation](#bottom-navigation) like any other view and left the
  same way. Destructive confirmation stays inline with the row it came from, per
  [Delete Confirmation](#delete-confirmation); nothing is ever asked over a
  backdrop, because the system has no backdrop.
- It creates nothing and deletes nothing, so it holds **no add trigger** and no
  destructive control.
- Every figure is derived, never stored twice, so the view cannot disagree with
  the rows it summarises.
- The calendar is thirty days and no more. A longer range is a different
  component, not a wider grid.
- Focus minutes are shown with the shared `formatDuration`, so a figure reads
  the same here as it does in the session caption.

### Inline Composer

**Purpose.** Create or edit an item, in the column it belongs to, without leaving
the screen or opening a dialog.

**Visual structure.** `.add-form` is a panel, flex column, `gap: --spacing-sm`,
padding `--spacing-md`, radius `--rounded-lg`, background `--color-canvas`, with
`--elevation-hairline`. It sits under the header of the column that opened it.

- **Fields** — flex row, `gap: --spacing-sm`, `flex-wrap: wrap`,
  `align-items: flex-end`. The title field is `field--grow`
  (`flex: 1 1 200px`); the rest size to content. Aligning to `flex-end` puts
  controls of different heights on one baseline with their labels above.
- **Actions** — flex, `gap: --spacing-sm`, `flex-wrap: wrap`. Submit, Cancel, and
  the error message, in that order, so the message never pushes the buttons.

**Fields by column.** The column decides which set is shown, so there is no type
selector to get wrong.

| Field | Tasks column | Reminders column |
| --- | --- | --- |
| Title | text input | text input |
| Date | [DatePicker](#pickers), labelled **Day** | DatePicker, labelled **Date** |
| Priority | [choice group](#tabs-filters), colour coded | not shown |
| Repeat | select | not shown |
| Time | not shown | [TimePicker](#pickers) |

Priority and Repeat are task-only because a reminder is a moment and has neither
an urgency nor a recurrence. Priority uses the shared `PillGroup`, so it gets the
minimal treatment: a bold word with a hairline under it, its active line in its
own colour. Repeat stays a **native `select`**: it is a closed set of three plain
words that are never read at a glance, and the operating system's own control is
the lighter choice for it. **Neither field uses the `Dropdown` primitive** — see
[Dropdown](#dropdown) for why, and for the rule that keeps it that way.

**States and rules.**

- The composer is **one component for both columns and for both create and
  edit**. Its `aria-label` names both the action and the kind — `Add task`,
  `Add reminder`, `Edit task`, `Edit reminder` — which is how tests and assistive
  technology tell the four apart.
- It is keyed on the target so switching between adding and editing remounts it
  with the right values, instead of leaving a stale title behind.
- Title and date are required. An empty submit sets a `role="alert"` message
  rather than disabling the button, so the user is told what is wrong instead of
  being left with a dead control. The message is `--type-caption` in
  `--color-error`.
- Title is trimmed and capped at 200 characters.
- After a successful add it clears to a fresh state and the column closes it, so
  the next item is one click away. After an edit it closes as well.
- Cancelling discards the change entirely.
- **Only one composer exists at a time.** Opening the other column's add closes
  this one, so the screen can never show two forms at once.

### Delete Confirmation

**Purpose.** Make a destructive action reversible by requiring a second, local
decision.

**Visual structure.** `.confirm-row` replaces the row's icon buttons **in place**
— inline, flex, `gap: --spacing-sm`, `flex-wrap: wrap`, `--type-caption` in
`--color-muted`. Reads `Delete?  Yes  No`, with Yes and No as text buttons.

**Usage rules.** No modal, no native `confirm()`, and no separate dialog. The
prompt appears exactly where the action was, keeps the row's own dimensions, and
uses `danger-link` styling on the delete control for the destructive moment.
Choosing No restores the icon buttons with no change to the data.

---

## Interaction & States

**Motion.** One duration for everything: `--motion-fast`, `120ms ease`.
Properties that may animate are `background-color`, `color`, `border-color`, and
`opacity`. There are **no transforms, no scale, and no layout animation** in this
system. A planner should respond instantly and without drawing attention.

**Focus.** Global `:focus-visible` gives `outline: 2px solid var(--color-ink)`
at `2px` offset. Inputs instead promote their border to `--color-ink` and drop
the outline. Focus is never signalled by colour alone — a focus ring is always a
shape change.

**Hover.** Hover is an enhancement, never the only path. Every hover-revealed
control (row actions) is also revealed by `:focus-within`, so keyboard users are
never locked out of an action. Below 768px row actions are permanently visible,
because there is no hover to reveal them.

**Selection.** Choice groups carry `aria-selected`, toggles carry
`aria-pressed`. State is always in the accessibility tree, never only in a colour.
The session panel is a state machine with five views — idle, setup, breakSetup,
session, complete — and
`aria-selected` is not involved: the running clock is announced by
`role="progressbar"` with `aria-valuenow`, and the setup is a `fieldset` whose
`legend` names it. The only `PillGroup`s on it are the `Breaks` choice and the two
break lengths, and those are legitimately a tablist because they are choices
within a form, not navigation.

**The session ring is the only shape that animates.** It is driven by
`stroke-dashoffset` from `--progress`, updated once a second by the timer's own
tick, and it carries **no CSS transition** on purpose: a smoothing curve would
lag behind the clock it is supposed to be following.

**Icons.** Every icon is decorative and carries `aria-hidden="true"` with
`focusable="false"`. The accessible name always comes from real text or an
`aria-label` on the control. Icons are drawn on a 16×16 grid with a 1.5 stroke,
`round` caps and joins, and inherit `currentColor`.

**Destructive actions.** Error colour, inline confirmation, and a two-word
choice. Never a lone trash icon that deletes on first click.

**Optimistic, never blocking.** Every mutation updates the screen immediately and
persists in the background. No spinner, no disabled state, no save indicator.
The app is local, so a write that fails is logged rather than surfaced mid-task.

---

## Responsive Behavior

Three breakpoints, all in `app.css`.

| Breakpoint | Change |
| --- | --- |
| `> 1440px` | Shell padding-inline rises to `--spacing-xxl` (48px), so the 1200px content does not float in a sea of white. |
| `≤ 1024px` | `.planner-grid` collapses to a single column, `minmax(0, 1fr)`. The two tracks stack whole: welcome, quick stats, tasks, then reminders. The bottom navigation is untouched, because it is fixed rather than part of the flow. |
| `≤ 768px` | Shell padding drops to `--spacing-md`, **keeping `--spacing-section` at the bottom edge** so the last row still clears the navigation bar; the session timer clock steps down to `--type-display-sm`; the timer's controls drop `margin-left: auto` so they sit under the clock instead of fighting it for the row; every composer field becomes `flex: 1 1 100%`; row actions become permanently visible; the Profile's streak and stat cards each take a full row, and its calendar falls to the narrowest cell that still holds a date. |

**Principles.** The single column stacks in reading order — the work first,
because that is the primary track at every width, and reminders after it. The
session panel is no longer in that stack at any width, because it has a view of
its own, so reflow never has the job of keeping a running clock in sight. Nothing
is hidden at small widths; only reflowed. Forms go full-width rather than
scrolling horizontally, since a narrow field is unusable on touch.

The window minimum is 680×560, so the single-column layout is the floor, not an
edge case.

---

## Design Principles

1. **Colour is meaning.** The interface is near-monochrome. Colour appears only
   for priority, completion, and overdue. A screen where everything is coloured
   tells the user nothing.
2. **One accent, used sparingly.** `--color-brand-accent` is the ink, and it is
   for badge tints and the app icon, never a button fill. The primary action
   carries the brand pink instead — one fill per screen, not a pink palette.
3. **Depth comes from hairlines, not shadows.** A planning tool should read flat
   and calm. `--elevation-subtle` exists and is deliberately unused.
4. **Radius encodes containment.** 8px controls, 12px panels, pills for labels,
   16px only on the outermost frame.
5. **Space groups before borders do.** Padding and gap are the primary
   separators; hairlines confirm.
6. **Dense rows, generous panels.** 12px inside a row, 24px inside a panel.
   This is what makes a long list scannable.
7. **Type weight carries hierarchy.** Everything is 600 or 500 or 400, chosen
   deliberately. There are no bolder or lighter steps.
8. **Show the state of the world.** Past reminders stay visible and emphasise
   themselves. Completed tasks stay in place. Nothing is hidden to make a screen
   look tidier than it is.
9. **Words over colour, always.** The priority dot is paired with the word
   High, Medium, or Low. The icon is paired with an `aria-label`. Colour and
   glyphs are always redundant with text.
10. **Instant, not animated.** 120ms on colour and opacity. Nothing moves.

---

## Do's and Don'ts

**Do**

- Reach for a token before writing any value: `var(--color-ink)`,
  `var(--spacing-md)`, `var(--rounded-lg)`.
- Add a semantic token when a new state needs colour, rather than reusing an
  existing one or adding a hex.
- Use the `Button`, `IconButton`, `Badge`, `PriorityBadge`, `PillGroup`, `Field`,
  `Stepper`, `Wheel`, `Dropdown`, and `EmptyState` primitives rather than
  re-deriving their class names.
- Keep text in `--color-ink` or `--color-body`; reserve `muted` and `muted-soft`
  for supporting information.
- Pair every colour and glyph with text, and every control with an accessible
  name.
- Test a change in both columns, both composer modes, and at 680px width.
- Test the session panel in all three of its views: idle, setup, and running.
- Test every view, not only the one the change is in, and check that a running
  session survives a trip through the [navigation bar](#bottom-navigation) and
  back.

**Don't**

- Don't write a hex, a `px` value for spacing, a radius, or a shadow outside
  `tokens.css`. `styles.test.ts` fails the build if you do.
- Don't add an inline `style` with a visual value. Every value has a token, the
  single sanctioned exception being the session ring's measured `--progress`
  ratio, which is data and not a design decision.
- Don't introduce a second accent colour or a fifth text grey.
- Don't use `--color-error` for anything that is not destructive, and
  `--color-success` for anything that is not finished.
- Don't add a drop shadow to make something stand out; use a hairline, or space.
- Don't truncate a task or reminder title with an ellipsis. Wrap it.
- Don't hide overdue or completed items.
- Don't use a tab to trigger an action, and don't use a modal for confirmation.
- Don't install an update the user did not ask for, and don't turn the
  [update banner](#update-banner) into a toast, a layer, or a dialog.
- Don't put a "check for updates" control anywhere, and don't show a version
  number, a last-checked line, or an up-to-date state. The app looks once per
  launch and stays quiet.
- Don't put a fill, a track, or a border behind a choice group. A selected option
  is a bold word with a hairline under it, nothing more.
- Don't show a running clock, a ring, or a progress value in the session panel
  before the user has pressed `Start`.
- Don't add a second add trigger for the same column, and don't put an add
  trigger in the welcome band, the quick stats, or the Profile. The column header
  owns the title and the Add, and it counts nothing.
- Don't add a **global** header, count, or date line spanning both columns. The
  one count band is [Quick Stats](#quick-stats), it sits inside the wide track
  above the tasks it describes, and the column headers still count nothing.
- Don't let a column header wrap. If the title and the Add no longer fit on one
  row, the label is too long, not the row.
- Don't reach for `input[type="date"]` or `input[type="time"]`, and don't build a
  second calendar or clock instead of extending the pickers.
- Don't swap a `PillGroup` or a native `select` for the `Dropdown` primitive in a
  composer field, and don't use a `Dropdown` where three or four options fit in
  a row.
- Don't give the [Profile](#profile) view a create, delete, or confirm control.
  It is a report; a question asked over a backdrop is a modal, and a modal for
  confirmation is forbidden.
- Don't add an item to the [bottom navigation](#bottom-navigation), and don't
  let a second control do the same job — a `Close` on the Profile or a Profile
  button in the welcome band is the bar's duplicate.
- Don't use the navigation bar to choose a value or to trigger an action, and
  don't turn a choice group into a way of moving between views.
- Don't introduce a component that restates tokens locally, and don't create a
  third stylesheet layer.

---

## Implementation Rules

1. **`tokens.css` is the only place a visual value may be defined.** No hex, no
   raw spacing, no radius, no shadow, no font stack, no type size, no weight, no
   letter-spacing, anywhere else.
2. **`DESIGN.md` is the documentation and rules.** `tokens.css` is the
   executable truth. They must be changed together, in the same commit.
3. **A new token requires updating this document first**, then `tokens.css`, then
   the CSS that consumes it. No exceptions for "just this once".
4. **Components consume tokens; they do not restate them.** A component file
   contains class names and structure, never visual values.
5. **`styles.test.ts` enforces this.** It fails the build on a stray hex, a
   missing required token, an inline visual value, a drifted window background, a
   choice group that grows a fill, or a session panel that loses one of its three
   views. If a new rule is needed here, add a test that proves it.
6. **New UI goes through the existing primitives.** If a primitive genuinely
   cannot express something, extend the primitive — do not bypass it. Bypassing
   `IconButton` with a raw `<button className="button-icon-circular">` is the
   exact failure this rule exists to prevent.
7. **One stylesheet layer.** `base.css` resets, `ui.css` holds reusable
   component classes, `app.css` composes the screen. A class that belongs to no
   component does not go in `ui.css`.
8. **CSS is excluded from Biome** and stays hand-authored, so the design system
   is not silently reformatted by a tool.

---

## Known Gaps

Documented honestly rather than papered over. None of these are MVP work; each
is a deliberate state of the current system.

**Tokens defined but not yet used (14).** They are part of the system and
available, but no shipped component consumes them:

`--color-badge-orange`, `--color-badge-pink`, `--color-badge-violet`,
`--color-badge-emerald`, `--color-surface-dark`, `--color-surface-dark-elevated`,
`--color-hairline-soft`, `--type-code`, `--rounded-sm`, `--rounded-xl`,
`--elevation-flat`, `--elevation-subtle`, `--elevation-pill-active`,
`--control-height-compact`.

**The `Dropdown` primitive has no consumer.** It is specified, styled, and
exported, but the shipped screen does not use it: the composer's priority is a
`PillGroup` and its repeat is a native `select`, and the Profile has no field
that needs one. It is the one primitive in `ui.tsx` with no call site. Either it
earns a consumer or it goes; keeping an unused primitive "just in case" is the
same duplication `.text-link` already is, and it is documented here rather than
pretended away.

**Dark surfaces are inert as a theme.** `--color-surface-dark-elevated`,
`--color-on-dark`, `--color-on-dark-soft` and the `.dark-surface` /
`.dark-surface__soft` classes exist, but the app ships one light theme only and
there is no `prefers-color-scheme` support. Nothing consumes
`--color-surface-dark` either: the Profile scrim was its only use, and now that
the Profile is a view the whole dark-surface family is unused.

**Large display steps are partly unused.** `--type-display-xl` and
`--type-display-lg` and their tracking tokens are defined for a marketing surface
this app does not have. `--type-display-sm` is the app title and
`--type-display-md` is the session clock; the two largest steps have no consumer.

**The `t-` prefixed typography utilities are unused.** `ui.css` defines `.t-display-xl`,
`.t-display-lg`, `.t-display-md`, `.t-display-sm`, `.t-title-lg`, `.t-title-md`,
`.t-title-sm`, `.t-body-md`, `.t-body-sm`, `.t-caption`, `.t-button`,
`.t-nav-link`, `.t-muted`, `.t-muted-soft`, and `.t-body`. Every shipped
component applies its type through a type token in `app.css` instead, so these
utilities are redundant today. They remain the intended API for any future
surface that needs type without owning a component class. Note the duplication: a
type decision can currently be made in either place, which is a smell to resolve
when the second consumer appears.

**`.text-link` duplicates the `text` button variant.** `.button-text-link` is
the live implementation; `.text-link` is unreferenced. The primitive,
`Button variant="text"`, is the one to use.

**Unused badge tones.** `accent`, `success`, `warning`, and `strong` are
available on the `Badge` primitive but the app only uses `neutral` and `error`.
A completed-task success treatment is the obvious candidate.

**Breakpoints are not tokenised.** `1024px`, `768px`, and `1440px` are literals
inside media queries. Tokenising them is not possible in plain CSS without a
custom-property indirection that browsers do not resolve in query context, so
this is a known and accepted limit of the token system.

**The window background is a literal.** `BrowserWindow`'s `backgroundColor`
lives outside the CSS cascade and cannot read `var(--color-canvas)`. `src/main/index.js`
holds a single `CANVAS` constant, and `styles.test.ts` pins it to the token so
the two cannot drift. This is the only sanctioned duplicate colour in the
repository.

**`--rounded-pill` and `--rounded-full` are identical.** Both are `9999px`. They
are kept as separate names so intent is readable at the call site; consolidate
only if the design ever needs a true full-circle value distinct from a pill.

**The session ring's progress ratio is the one inline value in the renderer.**
`--progress` is a measured ratio, `0` to `1`, and a ratio is data rather than a
design decision: a token would have to enumerate every value the timer can reach.
It only ever sets the arc's `stroke-dashoffset`; the ring's size, stroke, radius,
colours, and the circle's own `cx`/`cy`/`r` are tokens and geometry, never
inline. `styles.test.ts` allows this one `style={{ '--progress': … }}` and fails
on any other inline value, so the exception cannot spread.

**The session length has no minute-level precision below five minutes.** The
wheel moves in 5-minute and 60-minute steps, so `27m` is not reachable, and the
25-minute floor is only reachable by subtraction. A `1`-minute step was not
offered because a 25-minute floor and a 1-minute grid make the first press after
landing on a preset feel broken. The manual break reads on the same five minute
grid for the same reason, which is why its floor is `5` and not `1`.

**The wheel cannot be dragged or flicked.** The columns are moved by their two
buttons only, because a scroll-driven picker needs a scroll position to bind to,
and the one inline value the renderer is allowed to write is the ring's measured
`--progress` ratio. The wheel is composed rather than scrolled, which is also why
nothing in it moves.

**Manual-repeat limitation.** Repeat offers `none`, `daily`, and `weekly` only.
There is no monthly, weekday-only, or custom-interval option, and no "every N
days". This is a product decision, not a missing token.
