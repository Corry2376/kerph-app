# Working agreement for this repo

Kerph (kerphplans.com) — static multi-page HTML/CSS/JS app with a Supabase
Auth/Postgres/Storage backend. **There is no CI/CD.** Pushing to `origin/main`
*is* deploying to production — there is no build step, staging environment,
or review gate in between.

## Standing authorization — minimize stoppages

The user has explicitly asked to reduce how often work gets interrupted for
permission during a session. The following are pre-authorized as routine,
so don't stop to ask before doing them:

- **`git add` / `git commit` / `git push` for routine work.** Once a change
  is made and (where practical) verified, commit and push it as the normal
  way of finishing the task — don't ask "should I commit/push this?" first.
  Still write real, accurate commit messages (see repo-wide CLAUDE.md
  conventions elsewhere in this file/session for style), and still follow
  the non-destructive-git rules below.
- **Running scripts written into the session scratchpad** (PowerShell,
  build/verification scripts, etc.) — these are Claude's own working files,
  not third-party code, and don't need a fresh approval every time.
- **Reading, searching, and inspecting** anything in the repo or the browser
  preview (already covered by `.claude/settings.json`).

## Still pause and ask first

Pre-authorization above is for *routine* work, not a blank check. Still stop
and confirm before:

- Force-push, `git reset --hard`, `git clean`, deleting a branch, rewriting
  published history, or any other destructive/irreversible git operation.
- Any SQL run directly against the production Supabase project that drops,
  truncates, or alters data outside of an additive `create table if not
  exists` / `insert ... where not exists` pattern.
- Deleting files the user didn't create this session, or anything outside
  the repo/scratchpad.
- Entering credentials anywhere, or any action already covered by the
  categorical safety rules (financial transactions, permanent deletion,
  account creation, etc.) — those apply no matter what this file says.
- Anything that seems genuinely unusual or higher-stakes than the routine
  edit-verify-commit-push loop this project normally runs on.

When in doubt on something not covered above, a brief one-line heads-up
in the response (not a blocking question) is better than silently doing it
*and* better than stopping to ask — say what you did and why, and keep going.

## Never stage files by wildcard

**Always `git add` explicit file paths.** Never `git add -A`, `git add .`,
`git add -u`, or a glob like `git add -- '*.html'`.

The repo root is a working directory as much as a source tree: it holds
launch reports, financial documents, beta plans, scripts, spreadsheets and
scratch HTML alongside the actual site, and Cloudflare's `assets.directory`
is `"."` — so anything that lands in git lands on kerphplans.com. On
2026-09-01 a `git add -A -- '*.html'`, run to commit a one-line change across
29 pages, also swept in four untracked working documents (an internal domain
checklist, an overnight change report, a plan-comparison doc and a video
script) and published them on the newly-public site.

`.assetsignore` already excludes business documents by extension (`*.pdf`,
`*.xlsx`, `*.docx`, `*.csv`), but that cannot save you for `.html` — `*.html`
*is* the site. Individually-named internal HTML files are listed at the
bottom of `.assetsignore` and in `.gitignore`; add to both when a new one
appears.

Before committing, run `git status --porcelain` and confirm every staged path
is one you meant. If a change genuinely spans many files, list them
explicitly (`git add a.html b.html c.html`) or stage them in a loop over a
filtered list you have actually read — never a bare wildcard.
