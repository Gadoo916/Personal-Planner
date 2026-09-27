# AGENTS.md — Personal Planner

Read this before doing ANY work on this repo. It exists so you don't burn
tokens rediscovering things that are already documented.

## Ground truth files (read these first, in this order)

1. **`PROJECT_MAP.md`** — where every file and feature lives, tech stack,
   data flow, architecture, test coverage. If you need to find "where does X
   happen" or "which file owns Y", it is already answered in this file's
   tables. Do not grep or explore the repo to (re)discover something this
   file already documents — just read the relevant table.
2. **`DESIGN.md`** — the entire visual system: every color token, type
   scale, spacing rule, component primitive, and explicit Do's/Don'ts. This
   is **locked**. Treat it as read-only unless a task explicitly asks for a
   design change.

## Hard rules

- **Never add a hex color, a `px` spacing/radius value, a shadow, or a font
  stack anywhere outside `src/renderer/styles/tokens.css`.**
  `styles.test.ts` fails the build on any of these — that check is
  intentional, don't work around it or edit the test to pass.
- **Never introduce a new component class or bypass an existing primitive.**
  Use `Button`, `IconButton`, `Badge`, `PriorityBadge`, `PillGroup`, `Field`,
  `Stepper`, `Wheel`, `EmptyState`. If one genuinely can't express what's
  needed, extend that primitive — don't hand-roll a parallel one.
- **A design change goes: `DESIGN.md` first, then `tokens.css`, then the CSS
  that consumes it — same commit, in that order.** No "just this once."
- **Don't touch the design system unless the task explicitly asks for a
  visual/design change.** For feature or logic work, stay inside `domain/`,
  `hooks/`, `storage/`, and consume the existing UI classes as they are.
- **One stylesheet layer only:** `base.css` (reset), `ui.css` (reusable
  component classes), `app.css` (screen composition). Nothing else, no
  fourth layer, no component restating tokens locally.
- No inline `style` values, with the single sanctioned exception documented
  in `DESIGN.md` (the session ring's `--progress` ratio).

## Before finishing any task

Run:

```
npm run verify
```

(typecheck + lint + all tests, including `styles.test.ts`, which checks
that `DESIGN.md` and `tokens.css` haven't drifted apart). A task is not done
until this passes with no new violations.

## When you're not sure where something lives

Check `PROJECT_MAP.md`'s file tables first. Every file, its line count, and
its role are already listed there. Only search the codebase directly if the
map genuinely doesn't cover it — and if it doesn't, that's a gap worth
flagging, not a reason to spend a long time exploring.
