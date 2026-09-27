# PROJECT_MAP

Single source of truth for the Personal Planner codebase. Everything listed here
exists and works; nothing is aspirational.

**Verification state, 2026-09-27.** `npm run typecheck` and `npm run lint` pass
clean. `npm test` is 337 of 337 passing across 12 files, and `npm run build`
succeeds. A paused block now banks its focus once, whole, at the moment the block
ends, so pausing and resuming a block cannot count the pre-pause segment twice;
the previously noted paused-time accounting gap is closed and nothing is
known-red.

The packaged artifacts in `release/` are older than any of this: they were
produced by an earlier `npm run dist` run and a smoke test that launches the
packaged executable and confirms the window opens with no error log. Packaging
was out of scope for the three-view work below, so the artifacts predate it.

## [TECH_STACK]

| Concern | Choice | Version | Why |
| --- | --- | --- | --- |
| Shell | Electron | 44.4.5 | Desktop target; `sandbox: true` keeps the renderer isolated. |
| UI | React + ReactDOM | 19.3.0 | Component model that matches the design system directly. |
| Bundler | Vite | 8.3.1 | Fast, and `base: './'` makes `dist/` loadable over `file://`. |
| React plugin | `@vitejs/plugin-react` | 6.1.1 | Official Fast Refresh integration. |
| Language | TypeScript | 7.0.2 | Strict renderer types; `checkJs` types the main process. |
| Linter + formatter | Biome | 2.5.14 | One tool for both; replaces ESLint + Prettier. |
| Tests | Vitest + jsdom | 5.0.2 / 30.1.1 | Shares Vite's transform pipeline, so no extra build config. |
| DOM assertions | Testing Library | RTL 16.3.3 | Queries by role/label, matching how a user reads the screen. |
| Packaging | electron-builder | 26.15.3 | Emits an NSIS installer and a portable binary. |
| Runtime dependencies | none | — | Every package above is a devDependency; the shipped app has an empty tree. |

Deliberately **not** used, and why:

- **ESLint / typescript-eslint** — the TypeScript 7 beta sits outside their
  supported peer range, so Biome covers linting instead.
- **electron-vite** — stable releases do not yet support Vite 8. The main and
  preload processes are plain JavaScript, so no second bundler is needed.
- **Tailwind, Redux/Zustand, a date library, SQLite, electron-store** — all
  would add surface area the design system and the data model do not need.
  State is one `useReducer`; dates are `YYYY-MM-DD` strings; storage is one
  JSON file behind a two-method port.

Icon generation is in-repo (`scripts/make-icon.mjs`) because the app is offline
and no image library is installed: it draws a 7-size `.ico` by rasterising a
rounded square and a check mark at 4x4 supersampling, then encodes PNG by hand
with `node:zlib`. It reads `--color-brand-accent` out of `tokens.css` rather than
hardcoding it, so the icon cannot drift from the design system.

## [SYSTEM_FLOW]

```
npm run dev:desktop
  scripts/dev-desktop.mjs ──> vite (node API, port 5273) ──> watches src/renderer
                       └──> spawn electron.cmd "."
                                    │
      ┌─────────────────────────────┴──────────────────────────────┐
      │  MAIN  src/main/index.js                                   │
      │   BrowserWindow { sandbox: true, contextIsolation: true,    │
      │                     nodeIntegration: false, preload:        │
      │                     src/preload/index.cjs }                  │
      │   loads dist/index.html  (dev: http://localhost:5273)       │
      └─────────────────────────────┬──────────────────────────────┘
                                    │ contextBridge
      ┌─────────────────────────────┴──────────────────────────────┐
      │  RENDERER  window.planner = { load, save }                  │
      │                                                             │
      │   usePlanner ──load()──> IPC ──> dataFile.js ──>            │
      │      │                              userData/               │
      │      │                              planner-data.json       │
      │      │                              (tmp ──rename, atomic)  │
      │      │                                                    │
      │      ├── reduce(action) ──> domain/mutations.ts             │
      │      │                      (pure AppData -> AppData)       │
      │      │                                                    │
      │      └── 300 ms debounce ──save()──> IPC ──> dataFile.js    │
      │                                                             │
        │   App ──> domain/model.ts  (normalize, sort, group)         │
        │        ──> domain/focusSession.ts (pure session planning)   │
        │        ──> lib/dates.ts, lib/relativeTime.ts                │
        │        ──> hooks/useFocusSession (in-memory session state)  │
        │        ──> components/*    (styles/tokens.css only)         │
       └─────────────────────────────────────────────────────────────┘
```

`App` owns two pieces of state that sit above the three views: which view is on
screen (`home`, `profile`, or `focus`) and the focus session's clock. The view is
component state rather than a route, because there is no router, no URL, and no
history to go back through. The clock is lifted out of `FocusSessionTimer` and
held in `App` for the same structural reason: a running session must not stop
merely because the user went to look at their tasks, so the state that describes
a session cannot be scoped to the component that draws it.


The Focus Session timer is deliberately **outside** that flow. It reads no document,
writes no document, and shares no reducer with the planner, so nothing a user
does to a session can disturb a task and nothing a user does to a task can
disturb the running clock.

Write path in detail:

1. A click dispatches a plain object such as `{ type: 'task/toggle', id }`.
2. `usePlanner` reduces it with a function from `domain/mutations.ts`, which
   returns a **new** `AppData`. It never mutates and never touches IO.
3. The new document replaces React state, so the screen re-renders.
4. A 300 ms debounced effect hands the document to `storage.save`.
5. Electron routes it to `planner:save`; `dataFile.js` writes
   `planner-data.json.tmp` and renames it over `planner-data.json`, so a crash
   mid-write cannot truncate the real file.

Read path: `planner:load` returns the parsed document, or `null` if there is no
file. A file that cannot be parsed is moved aside to
`planner-data.corrupt-<timestamp>.json` and the app starts empty instead of
crashing.

Data flow invariants:

- **Dates are local.** `YYYY-MM-DD` strings are parsed with `new Date(y, m, d)`,
  never `new Date('2026-09-26')`, which would parse as UTC and can shift the day
  for users west of Greenwich. All date arithmetic goes through `lib/dates.ts`.
- **Readiness is explicit.** `usePlanner` exposes `ready`, and both lists hide
  their empty state until it is true, so a first-frame flash of "No tasks yet"
  can never overwrite a loaded document.
- **Ordering is total.** Tasks sort by day, then priority, then open-before-done,
  then `createdAt`. Reminders sort by date, then time. Two identical tasks always
  land in a stable order, so a re-render never shuffles the list under the cursor.
- **Every read is defensive.** `normalizeAppData` trims titles, rejects bad
  dates, times, and enum values, drops records without an id, and de-duplicates
  repeated ids. A file hand-edited into an invalid state degrades to a valid one.

## [ARCHITECTURE]

### Layering

Dependencies point inward only. `domain` and `lib` never import React, and
`storage` never imports `domain`.

```
components/  App.tsx  ──>  domain/  ──>  storage/types
     │                          │
     └──>  hooks/usePlanner ────┘
              │
              └──> storage/{port,electron,web}

     └──>  hooks/useFocusSession ──>  domain/focusSession.ts  (no storage, ever)

hooks/useDismiss  ──>  (DOM events only, shared by both pickers)

lib/  dates, relativeTime, log  ──>  (leaf utilities, no internal deps)
```

### Files

| File | Lines | Role |
| --- | --- | --- |
| `src/renderer/storage/types.ts` | 74 | The schema: `Task`, `Reminder`, `AppData`, `PRIORITIES`, `REPEATS`, `SCHEMA_VERSION`. |
| `src/renderer/storage/port.ts` | 22 | `PlannerStorage { load, save }` and `createStorage()`, which prefers the Electron bridge and falls back to localStorage. |
| `src/renderer/storage/electron.ts` | 25 | Port implementation over `window.planner` IPC. |
| `src/renderer/storage/web.ts` | 38 | Port implementation over `localStorage`, for `npm run dev` in a browser. |
| `src/renderer/domain/model.ts` | 303 | `normalizeAppData`, `createTask`, `createReminder`, `nextOccurrence`, the comparators, and `groupTasksByDay` with its `isToday` flag. |
| `src/renderer/domain/mutations.ts` | 127 | Every write, as a pure `AppData -> AppData` function. |
| `src/renderer/domain/focusSession.ts` | 319 | Pure session planning: `buildPlan`, `planProgress`, `remainingFocusMinutes`, `formatClock`, `formatDuration`, `phaseLabel`, `focusBlockCount`, the session-length stepper (`sessionLength`, `canStepSession`, `stepSession`), the manual-break stepper on its own five minute grid (`normalizeManualBreakMinutes`, `canStepManualBreak`, `stepManualBreak`), the `FOCUS_SESSION_GIFS` map, and the step and break-length constants. No React, no timers, no IO. |
| `src/renderer/domain/productivity.ts` | 294 | The stored focus record and everything derived from it: `FocusSessionResult`, the per-day merge, `profileStats`, streak calculation, `focusIntensity`, and the adaptive-comparison growth copy. |
| `src/renderer/hooks/usePlanner.ts` | 207 | The single reducer, hydration, debounced save, and `pagehide`/`blur` flush. |
| `src/renderer/hooks/useFocusSession.ts` | 634 | The in-memory session: the face state machine (`idle`, `setup`, `breakSetup`, `session`, plus `finished`), block transitions, an absolute end time so the clock cannot drift, the run totals that survive a reset (focus, break, **and** paused seconds, each in its own column), re-planning rules, and the logging. A paused block banks its focus once at block end, and `settlePause`/`pauseTick` keep paused time out of focus. `focusSessionReducer` and `initialTimerState` are exported so the sequence of states is unit-testable. Never touches storage. Owned by `App`, not by the panel. |
| `src/renderer/hooks/useDismiss.ts` | 30 | Escape and outside-press dismissal, shared by both pickers. |
| `src/renderer/lib/dates.ts` | 218 | Local date maths, ISO validation, 12-hour clock formatting, day labels, the calendar grid, and the time-picker helpers. |
| `src/renderer/lib/relativeTime.ts` | 52 | `remainingTime` via `Intl.RelativeTimeFormat`, plus `isOverdue` and `isPastDay`. |
| `src/renderer/lib/log.ts` | 40 | `info`/`warn`/`error` over `console`, with `ref()` truncating ids so no title, date, or time is ever logged. |
| `src/renderer/components/ui.tsx` | 496 | Design-system primitives: `Button`, `IconButton`, `Badge`, `PriorityBadge`, `PillGroup`, `Stepper`, `Wheel`, `Field`, `EmptyState`, `Dropdown`, and the icon set. |
| `src/renderer/components/DatePicker.tsx` | 118 | The app's own month-grid day control, anchored as a popover. Replaces `input[type="date"]`. |
| `src/renderer/components/TimePicker.tsx` | 92 | Hour / minute / meridiem controls in a popover, built on the shared `Stepper`. Replaces `input[type="time"]`. |
| `src/renderer/components/PlannerColumn.tsx` | 56 | One column: the title and its own Add on a single header row, and the inline composer slot. Both columns are this component. |
| `src/renderer/components/BottomNavigation.tsx` | 36 | The whole of the app's navigation: a `<nav>` of exactly three destinations (Home, Profile, Focus Session), each a bare `<button>` marking itself with `aria-current="page"`. Exports the `AppView` union that `App` holds. |
| `src/renderer/components/FocusSessionTimer.tsx` | 470 | The session panel in five faces: `IdlePanel` (the title, `idle.gif` animation, and a `Focus` button), `SetupPanel` (the session length as two `Wheel` columns, then the break choices), `BreakSetupPanel` (one `Wheel` on the five minute grid), `SessionPanel` (state-mapped GIF animation in the ring, ring, clock, three icon-only controls — Pause, Skip, and the inline reset confirmation, all live on a manual break — a `Paused for m:ss` line shown only while stopped, and `Take a Break` below them), and `CompletePanel` (the summary card with its focus, break, and paused figures, the completed block count, and `Done`). A renderer: it takes a `FocusSession` rather than owning one. |
| `src/renderer/components/AddForm.tsx` | 168 | The inline composer, contextual to its column, for both adding and editing. |
| `src/renderer/components/TaskList.tsx` | 145 | Day groups, completion toggle, edit, and two-step delete. |
| `src/renderer/components/ReminderList.tsx` | 106 | Reminder cards with countdown and overdue state. |
| `src/renderer/components/Welcome.tsx` | 13 | The greeting and the `h1`, as a heading band. Holds no action: the bar is the only way to the Profile. |
| `src/renderer/components/QuickStats.tsx` | 44 | The four derived counts above the tasks they describe. Colourless by design. |
| `src/renderer/components/Profile.tsx` | 169 | The name, streak, focus figures, comparison copy, and the thirty-day heatmap. A view rather than a layer: no backdrop, no `role="dialog"`, no Close, and no internal scroll of its own. |
| `src/renderer/components/ProfileGate.tsx` | 60 | First-run onboarding: one field for a name, then the planner. Short-circuits `App` before the shell, so the bar never renders for it. |
| `src/renderer/App.tsx` | 161 | Composition: the current view, the lifted focus-session clock, the three view bodies, the composer open/close state, and the navigation bar. |
| `src/renderer/main.tsx` | 18 | React mount. |
| `src/renderer/styles/tokens.css` | 121 | The only place a hex, radius, or spacing value may appear. |
| `src/renderer/styles/base.css` | 59 | Reset, page shell, and font stack. |
| `src/renderer/styles/ui.css` | 596 | Reusable component classes, including the pickers, the stepper rows, the wheel columns, and the choice groups. |
| `src/renderer/styles/app.css` | 909 | Screen composition — the shell, the navigation bar, the session panel, the 7:3 grid, the Profile, the columns, the composer — and the responsive breakpoints. |
| `src/renderer/styles.test.ts` | 571 | Enforces the token rules, the session panel's five faces, its length wheels, the summary card, the column header's single row, the navigation bar's fixed treatment, the Profile's lack of a layer, and keeps `DESIGN.md` in sync with `tokens.css`. |
| `src/main/index.js` | 95 | Window lifecycle, single-instance lock, navigation lockdown, and the two IPC handlers. |
| `src/main/dataFile.js` | 77 | Atomic read, write, and corrupt-file quarantine. |
| `src/main/logger.js` | 82 | Appends to `planner-error.log` in `userData`; never logs content. |
| `src/preload/index.cjs` | 13 | Exposes exactly `load` and `save`. |
| `scripts/dev-desktop.mjs` | 31 | Starts Vite via its Node API, then spawns Electron. |
| `scripts/make-icon.mjs` | 198 | Draws and encodes `build/icon.ico` from the accent token. |
| `build/icon.ico` | 5 KB | Seven sizes, 16 through 256. Committed, because electron-builder needs it. |
| `DESIGN.md` | 1776 | The authoritative design-system document: every token, every component, and the rules. |
| `public/assets/focus-session/` | 5 files | Local GIF assets for the Focus Session state machine (`idle.gif`, `focus.gif`, `break.gif`, `complete.gif`) and the completion sound (`session-complete.mp3`). |

### Design System

`DESIGN.md` is the authoritative documentation for the Personal Planner visual system.

`tokens.css` contains the executable design tokens.

All renderer UI components must consume the centralized design tokens and follow `DESIGN.md`.

No component may introduce a new visual token without first updating the design system.

### Design system compliance

`DESIGN.md` documents all 86 tokens with their exact values, the full component
contract for every surface across the app's three views, and the interaction
states. It is
kept honest by tests rather than by discipline: `styles.test.ts` reads the
document and fails if a token goes undocumented or invented, if a hex value
differs from `tokens.css`, if a named CSS class does not exist, if a required
section disappears, or if third-party branding enters the file.

`tokens.css` is the single source of visual truth. No component file contains a
hex colour, a pixel radius, a shadow, or a font stack, and no component writes
an inline visual value. CSS is excluded from Biome entirely, so the design
system stays hand-authored rather than machine-reformatted.

This is enforced, not just documented. `src/renderer/styles.test.ts` fails the
build if a hex literal appears anywhere in `src/` or `scripts/` outside
`tokens.css`, if a required token goes missing, if a renderer component writes
`style={{ ...: '#...' }}`, or if the window background constant drifts from
`--color-canvas`. That last one is the single sanctioned exception: a
`BrowserWindow` background lives outside the CSS cascade, so `src/main/index.js`
holds a literal `CANVAS` and a test pins it to the token.

Concretely: `Button`/`IconButton` cover every button, `PriorityBadge` renders
the three priorities from the same tokens, `PillGroup` is the choice group for
priority and for the break lengths, `Stepper` is the only way the clock's hour and
minute are nudged, `Wheel` is the only way the session length is, `Field` is the
only label-plus-control wrapper, and `DatePicker`/`TimePicker` are the only date
and time controls. No `input[type="date"]`, `input[type="time"]`, or
`input[type="number"]` remains in the renderer, and a test asserts their class
names are gone from the CSS, because the operating system's picker is the one
thing that would break the screen's visual language. Icons are decorative and
carry `aria-hidden`, so every control's accessible name comes from real text or
an `aria-label`.

### Session planning

A session of N focus minutes is split into 25-minute focus blocks, with the last
block trimmed to whatever focus time is left, and a break between two consecutive
blocks. Every fourth break is long, the rest are short, and there is no break
after the final block. With the defaults, a 2-hour session is
`25, 5, 25, 5, 25, 5, 25, 15, 20` minutes across nine blocks: 120 minutes of
focus, which is what the user asked for, and 150 minutes of elapsed time, which
is what the clock counts down.

Those rules live in `domain/focusSession.ts` as pure functions, so the block list is
a unit test rather than a timer assertion. `useFocusSession` adds only the mechanics:
a 1-second tick, an absolute `endsAt` per block so a slow frame cannot stretch a
block, auto-advance, and re-planning from block one whenever a length changes.

The panel itself is a face state machine, and the clock is not one of the idle
faces. (These faces are not the app's views: a view is a whole screen chosen from
the bar, and the Focus Session view holds this panel.) It opens idle, with the
`Focus Session` title and a single `Focus` button
stacked under it, both **centred in the panel** — `align-items: center` on
`.focus-session--idle`, never a `margin: auto` hack, because a cross-axis auto margin
outranks `align-items` and would pin the title to the left of an otherwise centred
face. There is **no clock, no ring, no progress, and no line of guidance** in that
state: the panel is a band, not an alert surface, and a guidance paragraph would
be doing the work of the button. `Focus` opens the setup in the same container —
no page, no modal, no tab — where the session length is two `Wheel` columns side
by side, hours and minutes, read the way a phone reads an alarm time: the chosen
value in the middle of each column in the display step, the plus stacked above it
and the minus below rather than either beside it, and no other number in the
column at all. Hours step by 60 minutes and minutes by 5, within a 25-to-720
minute range, so a button that would leave the range is disabled rather than
clamped silently. The two break lengths are chosen from `PillGroup`s. Only `Start`
begins the session, at
which point the ring and the clock appear. The two faces that carry an action in
the bar keep `justify-content: space-between` — title at one end, action at the
other — because a two-item row is the one shape that is not a column to centre.
`Change session` returns to the setup with the plan intact, because a running
session with no way to replan would be the one way to get the feature wrong, and
opening it pauses, so a session cannot run itself to the end behind a panel the
user is still deciding on.

The running face's three controls are icon-only `IconButton`s — pause/resume,
skip, and reset — so each one is named by its `aria-label` and nothing on screen
repeats it as text. `Take a Break` is a secondary `Button` **below** that row,
because it adds to the plan rather than steering the block already running.
`Reset` is the one destructive act on the face, so it takes a two-button
`.confirm-row` in its own slot, the same inline pattern the task and reminder
deletion uses: a dialog or a modal would cost the user the clock they are
watching. `Pause`, `Resume`, and `Skip` stay **live during a manual break** —
pausing freezes the break's own countdown and Resume continues that same break,
while Skip ends it early and resumes the focus block underneath; only `Take a
Break` is disabled then, because a second break on top of the first is a state
with no meaning. A control that went dead on the face the user is looking at
would read as a broken panel rather than a considered state.

While the clock is stopped, a caption-type line reads `Paused for 4:07` between
the controls and the block caption. It is tracked in its **own** accumulator
(`pausedSecondsAccumulated`, folded in by a `pauseTick` and settled by
`settlePause` on whichever control ended the pause), and it is **never added to
focus time**: a pause is the absence of work. The block that was running banks
its time once, whole, when it actually ends, so pausing and resuming a block
cannot count the pre-pause segment twice. The end of a session is a **summary,
not a congratulation**: the complete face keeps `complete.gif` and adds
`.focus-session__summary-card`, one outlined block holding the combined focus,
break, **and paused** figures the run actually banked — three figures, with
paused time beside focus rather than inside it — plus the completed block count
and a single `Done`. `Done` is the only place the run totals are cleared. The
focus, break, and paused seconds survive `Reset` and re-planning (which bank the
block in progress on the way out), because re-arming a clock is not the same act
as ending the run.

The session is **never persisted**. It lives in memory, so closing the app forgets
it, and a saved timer would come back claiming time the user did not spend.

### Date and time controls

Both pickers are the app's own, anchored as popovers rather than modals, and both
close on `Escape` or a press outside via `useDismiss`. The calendar renders a
fixed 42 cells so it cannot change height as months are paged, and disables days
beyond a year out rather than hiding them, so the ceiling is visible. The clock
steps in five minutes, wraps around midnight, and shows 12-hour time with a
meridiem pill while storage stays 24-hour. The default reminder time is the next
five-minute boundary at least half an hour away, so it is always in the future
and always reachable by the stepper.

### Repeat semantics

Completing a repeating task does two things at once: it marks the current
occurrence `done`, and it appends a fresh record for the next occurrence
(`daily` → +1 day, `weekly` → +7 days, both via `nextOccurrence`). Toggling a
task that is already done only un-completes it, so the roll-forward can never
run twice for one completion. A repeating task therefore always shows exactly
one open occurrence, and history is preserved rather than overwritten.

### Remaining-time buckets

`remainingTime` picks the largest unit that still reads naturally, and reports
`overdue` whenever the target is in the past:

| Distance | Output |
| --- | --- |
| under a minute | `now` |
| under an hour | `in 30 minutes` |
| under a day | `in 5 hours` |
| 1 day | `tomorrow` / `yesterday` |
| 2–13 days | `in 3 days` |
| 14–44 days | `in 2 weeks` |
| 45–329 days | `in 2 months` |
| 330+ days | `next year` |

Past reminders are never hidden. They keep their place in the list and gain an
`--overdue` treatment, because a deadline you missed is still information.

### Security posture

- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.
- The preload bridge exposes two functions and nothing else. No `ipcRenderer`,
  no `require`, no filesystem handle reaches the renderer.
- The renderer has zero runtime dependencies, so there is no third-party
  JavaScript running with access to the UI.
- Navigation and `window.open` are refused in the main process, so the app
  cannot be navigated to remote content.
- No `nodeIntegration` fallback, no remote module, no eval of stored content.

### Test coverage

337 tests across twelve files, all passing. The paused-time cases assert that
paused seconds are banked in their own column and never as focus, that a
paused-then-resumed block banks its focus exactly once, and that Pause, Resume,
and Skip all work on a manual break.

| File | Tests | Covers |
| --- | --- | --- |
| `domain/mutations.test.ts` | 25 | Every mutation, purity, referential no-ops, and the roll-forward rules. |
| `domain/model.test.ts` | 25 | Normalization, enums, grouping, Today marking, and comparator totality. |
| `domain/productivity.test.ts` | 26 | The stored Focus Session record, its merge, and every derived day figure. |
| `lib/dates.test.ts` | 37 | Leap days, month rollovers, ISO validation, 12-hour formatting, the 42-cell grid, and the clock helpers. |
| `App.test.tsx` | 63 | Both user flows end to end, screen composition, the navigation bar and the three views, a running session surviving navigation, the Profile as a view, the session panel's five faces, the length wheels, the reset confirmation, the column headers, ordering, and persistence. |
| `domain/focusSession.test.ts` | 37 | Block splitting, the fourth-break rule, trimming, progress, formatting, the session-length stepper, the manual-break stepper's five minute grid, and the focus-block count. |
| `hooks/useFocusSession.test.ts` | 42 | The state machine alone: when a clock starts and stops, absolute-deadline countdowns, auto-advance, the manual break, pausing and skipping a manual break, paused-time accounting in its own column, and when the run totals are banked or forgotten. |
| `components/FocusSessionTimer.test.tsx` | 11 | The GIF state mapping in the DOM, the manual break reading as a break, Pause and Skip staying live on a manual break, the paused counter appearing only while paused, the summary's three figures, and the summary plus `Done`. A local harness owns the clock, since the panel only renders one. |
| `components/pickers.test.tsx` | 19 | No native inputs, the month grid, month paging, dismissal, and every stepper. |
| `lib/relativeTime.test.ts` | 15 | Every countdown bucket, past and future. |
| `styles.test.ts` | 31 | Design-system enforcement, the 7:3 grid, the ring's geometry, the idle face's centred column, the summary card's tokens, the length wheels, the column header's single row, the choice groups' minimal treatment, the bar's fixed treatment, the Profile having no layer, and `DESIGN.md` staying in sync with the tokens. |
| `storage/web.test.ts` | 6 | Round trip, corrupt input, and a rejected write. |

The integration suite asserts on roles and labels rather than CSS classes, so it
fails if the app stops being usable, not merely if markup moves. Time is passed
explicitly to `remainingTime` in the unit tests, so no test depends on the wall
clock.

### Packaging output

`npm run dist` produces, in `release/`:

| Artifact | Size | Notes |
| --- | --- | --- |
| `Personal Planner Setup 1.0.0.exe` | 106.2 MB | NSIS installer, per-user, lets the user pick a folder. |
| `Personal Planner 1.0.0.exe` | 106.0 MB | Portable, runs from anywhere with no install. |
| `Personal Planner 1.0.0.exe.blockmap` | 0.1 MB | Differential-update metadata. |
| `win-unpacked/` | — | Unpacked build used for the launch smoke test. |

Data lives in `%APPDATA%\Personal Planner\planner-data.json`, created on the
first change rather than at first launch.

### Verification commands

```
npm run typecheck   # tsc on the renderer (strict) and checkJs on main/preload
npm run lint        # biome check
npm test            # vitest run
npm run verify      # all three
npm run build       # vite build
npm run dist        # build + NSIS installer + portable binary
```

One environment caveat, not a project defect: on this machine an AV or indexer
holds a handle on the freshly extracted `release\win-unpacked.tmp` tree, so the
staging rename inside `npm run dist` fails with `EPERM`. Plain renames in
`release\` work, and the identical build succeeds when staged elsewhere, so the
workaround is to build to a temporary output directory and copy the artifacts in:

```
npx electron-builder --win --config.directories.output=%TEMP%\pp-dist
```

The committed artifacts in `release/` were produced that way and the unpacked
build passes the launch smoke test.

## [ORPHANS & PENDING]

Nothing. Every file in this map is reachable from the app, and every MVP
requirement is implemented and covered:

| Requirement | Where it lives | Test |
| --- | --- | --- |
| Three views moved between from a fixed bottom bar | `BottomNavigation.tsx`, `App.tsx` | `App.test.tsx` |
| The bar holds exactly Home, Profile and Focus Session, and is on every view | `ITEMS` in `BottomNavigation.tsx` | `App.test.tsx` |
| The current view is announced, not merely coloured | `aria-current="page"` | `App.test.tsx` |
| The bar reuses the choice-group treatment: bold word, 2px hairline, no fill | `.bottom-nav__item` | `styles.test.ts` |
| The bar is not offered before a name is stored | `ProfileGate` short-circuit in `App.tsx` | `App.test.tsx` |
| A running session survives leaving the Focus view and coming back | `useFocusSession` lifted into `App.tsx` | `App.test.tsx` |
| Home is the tasks and the reminders, and no session panel | `App.tsx` | `App.test.tsx` |
| The Focus view is the panel and the bar, and nothing else | `App.tsx` | `App.test.tsx` |
| The Profile is a view, not a dialog: no backdrop, no Close | `Profile.tsx` | `App.test.tsx`, `styles.test.ts` |
| The welcome band holds no Profile shortcut | `Welcome.tsx` | `App.test.tsx` |
| Session panel with idle, setup, break-setup, running, and complete views | `FocusSessionTimer.tsx`, `useFocusSession`, `domain/focusSession.ts` | `App.test.tsx`, `focusSession.test.ts`, `useFocusSession.test.ts`, `FocusSessionTimer.test.tsx` |
| Idle face is the title and a stacked `Focus` button, no clock | `IdlePanel`, `.focus-session--idle` | `App.test.tsx`, `styles.test.ts` |
| Focus Session content centred in its own container | `.focus-session--idle`, `.focus-session__bar` | `styles.test.ts` |
| Session length 25–720 minutes, read as two wheel columns, no native input | `Wheel`, `stepSession` | `App.test.tsx`, `focusSession.test.ts`, `styles.test.ts` |
| Every fourth break is long | `buildPlan`, `LONG_BREAK_EVERY` | `focusSession.test.ts` |
| Running face is three icon-only controls, each named for a screen reader | `SessionPanel`, `IconButton` | `App.test.tsx` |
| Reset is confirmed inline, in its own slot, never in a dialog | `SessionPanel`, `.confirm-row` | `App.test.tsx` |
| `Take a Break` is a labelled button below the icon row | `SessionPanel` | `App.test.tsx` |
| Manual break 5–60 minutes on a five minute grid, in one wheel column | `stepManualBreak`, `MANUAL_BREAK_STEP_MINUTES` | `App.test.tsx`, `focusSession.test.ts` |
| A manual break is coloured and measured as a break, not as the focus block | `SessionPanel`, `.focus-session__phase--break` | `FocusSessionTimer.test.tsx` |
| Pause, Resume, and Skip all work during a manual break | `SessionPanel`, `focusSessionReducer` (`pause`/`play`/`skip`) | `FocusSessionTimer.test.tsx`, `useFocusSession.test.ts` |
| A paused clock shows a running `Paused for m:ss` counter | `SessionPanel`, `pausedSeconds` | `FocusSessionTimer.test.tsx` |
| Paused time is tracked separately and never counted as focus | `pausedSecondsAccumulated`, `settlePause`, `RunTotals` | `useFocusSession.test.ts` |
| Pausing and resuming a block banks its focus exactly once | `focusSessionReducer` (`pause`, `tick`) | `useFocusSession.test.ts` |
| Session end is a summary of the run, dismissed with `Done`, not a dialog | `CompletePanel`, `.focus-session__summary-card` | `FocusSessionTimer.test.tsx`, `styles.test.ts` |
| Run totals survive a reset and are cleared only by `Done` | `useFocusSession`, `focusSessionReducer` | `useFocusSession.test.ts`, `App.test.tsx` |
| Add a task | `AddForm.tsx`, `addTask` | `App.test.tsx` |
| Add a reminder | `AddForm.tsx`, `addReminder` | `App.test.tsx` |
| Edit either kind | `AddForm.tsx`, `updateTask`, `updateReminder` | `App.test.tsx` |
| Delete either kind, with confirmation | `TaskList.tsx`, `ReminderList.tsx` | `App.test.tsx` |
| Complete and reopen a task | `toggleTask` | `App.test.tsx` |
| Daily and weekly repeat | `nextOccurrence`, `toggleTask` | `App.test.tsx` |
| Three priorities, colour coded | `storage/types.ts`, `PriorityBadge`, `PillGroup` | `App.test.tsx` |
| Grouped by day, Today/Tomorrow labels | `groupTasksByDay`, `formatDayLabel` | `App.test.tsx` |
| Remaining time and overdue | `remainingTime`, `isOverdue` | `relativeTime.test.ts` |
| Own date and time controls, no native pickers | `DatePicker.tsx`, `TimePicker.tsx`, `Stepper`, `useDismiss.ts` | `pickers.test.tsx`, `App.test.tsx` |
| One composer per column, no global add | `PlannerColumn.tsx`, `AddForm.tsx` | `App.test.tsx` |
| Column header is the title and its own Add, no counter | `PlannerColumn.tsx`, `.planner-column__header` | `App.test.tsx`, `styles.test.ts` |
| Local-first persistence, survives restart | `dataFile.js`, `usePlanner` | `App.test.tsx` |
| Documented design system, no token drift | `DESIGN.md`, `tokens.css` | `styles.test.ts` |
| No network, no backend | — | verified by the dependency-free build |

Known non-goals, decided deliberately rather than deferred: no sync or
accounts, no notifications outside the app, no subtasks or tags, no date-range
views, no import or export, and no reusable session templates — a session is
planned from its own duration and break lengths rather than saved and re-run. A
session is not persisted either, and there is no sound or notification when a
block ends; the ring reaching empty is the whole notification. Adding any of the
others means a new milestone and a new `schemaVersion`.
