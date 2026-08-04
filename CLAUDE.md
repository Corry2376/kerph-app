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
