# RELEASE.md — shipping an update

Follow this whenever the user says "release", "ship the update", or
"publish a new version". Do the steps in order and don't skip any.

## Hard rules

- **Never run `npm run publish` or any `electron-builder --publish` command.**
  Publishing needs the user's GitHub token, which you must never ask for,
  read, or handle in any form. Hand the user the commands (Step 6) and stop.
- Never force-push. Never commit secrets. Never touch DESIGN.md tokens as
  part of a release.
- Only ship what the user asked for. A release is not the time to add
  features or refactor.

## Step 0 — Find out what is being shipped

The user does NOT have to list the changes; work them out yourself:

- Find the last released tag (`git describe --tags --abbrev=0`) and run
  `git log <last-tag>..HEAD --oneline` and `git diff <last-tag> --stat`.
- Run `git status` for uncommitted or untracked work.
- Give the user a short plain summary grouped by area (features, fixes,
  design, docs/tests), including anything uncommitted.
- Flag anything that looks unfinished, half-landed, or experimental (dead
  code, tests expecting something not built, TODOs). Ask whether it should
  ship or be left out. Never ship half-finished work silently.
- If the changes are large, say so; it affects the version choice below.

## Step 1 — Decide the version

- Read the current `version` in `package.json`.
- Choose by size of the changes found in Step 0: **patch** (1.0.0 → 1.0.1)
  for fixes and small tweaks; **minor** (1.1.0) if there are new features or
  several notable changes. Propose the number and confirm with the user in
  one line before changing anything.
- The new version MUST be higher than the last published one, or installed
  apps will not treat it as an update.

## Step 2 — Verify

- Run `npm run verify` (typecheck + lint + tests). It must be fully green.
- Run `npm run build` and confirm it succeeds.
- If this release touches anything that loads assets (images, fonts, icons),
  check it in a **packaged** build, not only the dev server — asset paths
  that work in dev can break under `file://`.

## Step 3 — Bump and document

- Update `version` in `package.json` (and `package-lock.json` if it carries
  the version).
- If test counts, file lists, or behavior changed, update `PROJECT_MAP.md`
  so it stays accurate.

## Step 4 — Commit and push

- If there is a lot of uncommitted work, group it into a few logical
  commits (e.g. one per feature/fix) rather than one giant commit, then a
  final `release <version>` commit for the version bump. Never stage
  secrets, build output, or `node_modules`.
- Write the final commit message as short release notes: a one-line title
  plus a few bullets of what changed. GitHub shows it as the release
  description.
- `git push origin main`.
- This must happen BEFORE publishing, so the release tag lands on the right
  commit.

## Step 5 — Check the working tree

- `git status` must be clean and local `main` must equal `origin/main`.
- Report the commit hash to the user.

## Step 6 — Hand over to the user (STOP HERE)

Tell the user to run this themselves in PowerShell:

```powershell
$env:GH_TOKEN = "ghp_..."     # their own token, never shared with you
npm run publish
```

If it fails with `EPERM ... win-unpacked.tmp`, use this instead (PowerShell
syntax, `$env:TEMP` — not `%TEMP%`; it does not run vite, so run
`npm run build` first):

```powershell
npx electron-builder --win --publish=always --config.directories.output=$env:TEMP\pp-dist
```

Then tell them what to check on
`github.com/Gadoo916/Personal-Planner/releases`:

- Exactly ONE release for the new version, marked **Latest**, not Draft.
- It contains `latest.yml`, `Personal-Planner-Setup-<version>.exe`, and
  `Personal-Planner-Setup-<version>.exe.blockmap`.
- If the upload created **duplicate draft releases** (it has happened
  before): move all assets into one release, delete the other, and publish
  it. You cannot see drafts without auth, so the user has to check this.

Wait for the user to say the release is published.

## Step 7 — Verify the published release (unauthenticated)

After the user confirms:

- `releases/tags/v<version>` returns 200 with `draft=false`,
  `prerelease=false`.
- `refs/tags/v<version>` points at the commit you pushed in Step 4.
- Assets include `latest.yml`, the Setup exe, and the blockmap.
- `releases.atom` has an entry for the new version.
- Report any mismatch plainly; don't guess.

## Step 8 — Tell the user what to expect

- Installed copies on an older version will show the update banner the next
  time the app is opened (one check per launch).
- The portable exe (`Personal-Planner-<version>.exe`) does NOT auto-update;
  only the Setup installer does.
- First-run Windows SmartScreen warnings are expected because the app is
  unsigned ("More info" → "Run anyway").

## Ask before proceeding if

- `verify` fails, or the build fails, and the cause isn't obvious.
- The user's requested change would need a new design token, hex value, or
  dependency.
- Anything in the git state is unexpected (uncommitted files you didn't
  create, diverged branches).