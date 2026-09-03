# Kerph deploy runbook

Short, and written to be read under pressure. If something is on fire, go straight to
[Rollback](#rollback).

---

## Rollback

**Production is broken and you want the previous version back.**

```bash
npx wrangler rollback --name kerph-app
```

This reverts the Worker to its previous deployment. It does **not** touch the database — any
data written since the bad deploy stays written.

To pick a specific earlier version instead of just the last one:

```bash
npx wrangler deployments list --name kerph-app
npx wrangler rollback <deployment-id> --name kerph-app
```

Then confirm the site is actually serving the older build:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L https://kerphplans.com/
```

**Rollback does not revert git.** The bad commit is still on the branch and will redeploy on
the next push. After rolling back, either revert the commit (`git revert <sha>`) or fix
forward — otherwise the next unrelated push silently reintroduces the problem.

---

## Staging

**https://kerph-app-staging.cjstalcup.workers.dev**

A complete second copy of the site, republished automatically on every push to `main`. Use it
to look at changes before anyone else can. It is a separate Cloudflare Worker
(`wrangler.staging.jsonc`, deployed by `.github/workflows/staging.yml`) and cannot affect
kerphplans.com.

Not gated on the smoke tests, on purpose — staging is where you go to look at work in
progress, and waiting two minutes for tests would defeat that. The suite still runs on the
same push in parallel, so the result is there when you want it.

**Staging shares the production database.** Anything that writes is writing real data: a
project saved on staging is a real project, a showcase post is a real post. Fine for layout,
wording and visual work. When testing something that changes how data is *stored* rather than
how it *looks*, give staging its own Supabase project first.

The normal loop:

1. Work on `main`, push. Staging updates in about a minute.
2. Look at staging, keep iterating.
3. Happy with it? Promote to `release` (below). That is what reaches customers.

## How a deploy happens

Cloudflare Workers Builds watches one branch and deploys every push to it. There is no build
step: the files in the repo are the files served, because `assets.directory` is `"."` in
`wrangler.jsonc`.

**Which branch is live is a Cloudflare dashboard setting**, not something in this repo:
Workers &rarr; `kerph-app` &rarr; Settings &rarr; Build &rarr; Production branch.

| Production branch | What a push to `main` does |
|---|---|
| `main` | Deploys to kerphplans.com immediately |
| `release` | Nothing. Only a push to `release` deploys |

Check which one is set before assuming a push is safe.

### Promoting when `release` is the production branch

```bash
git checkout release
git merge --ff-only main
git push origin release
```

Fast-forward only, deliberately: if it refuses, `release` has commits `main` does not, and
that needs looking at rather than merging blindly.

---

## Before you push

1. **`git status --porcelain` and read every staged path.** The repo root is a working
   directory as well as a source tree — launch reports, financial documents and scratch HTML
   live alongside the site, and anything committed is published. Never `git add -A`, `git add .`,
   or a glob. See `CLAUDE.md`.
2. **Check the smoke tests are green** for the commit you are promoting — GitHub &rarr; Actions
   &rarr; `smoke-tests`.

---

## Smoke tests

Run on every push and PR to `main` and `release`. They cover: every public page loading
without console errors, the plan gate redirecting a free visitor, board-foot arithmetic, the
planner board rendering, the 3D viewer building a WebGL canvas, the project designer's module
graph resolving, and Open Graph tags being present.

Run them locally (needs Node):

```bash
npm install
npx playwright install --with-deps chromium
npx playwright test
```

**A red run is not a deploy blocker by itself** — Cloudflare does not gate on GitHub checks.
It means *do not promote*. If it went out anyway, roll back.

### When a test fails

- Download the `playwright-report` artifact from the failed run for traces and screenshots.
- Network flake (unpkg or Supabase slow) is the most likely false positive; the suite retries
  once in CI, so a test that fails twice is probably real.
- If a failure is genuinely not Kerph's fault, fix the test rather than deleting it. A muted
  test is a check you no longer have.

---

## Useful checks

```bash
# Is the site up and ungated?
curl -s -o /dev/null -w "%{http_code}\n" -L https://kerphplans.com/

# Is a specific fix actually live? (grep the served HTML for something the fix introduced)
curl -s -L https://kerphplans.com/shop-3d-viewer | grep -c "applyWallMaterialMode"

# Recent deployments
npx wrangler deployments list --name kerph-app

# Live logs
npx wrangler tail --name kerph-app
```

---

## Where things live

| Thing | Where |
|---|---|
| Hosting / deploys | Cloudflare Workers, project `kerph-app` |
| Database, auth, storage | Supabase, project ref `qawfiktqeoarnvsarejo` |
| Payments | Lemon Squeezy (webhook &rarr; `subscriptions`) |
| Nightly backups | GitHub Actions `nightly-backup` &rarr; Backblaze B2 |
| Client errors + pageviews | `client_errors` / `analytics_events`, shown in `admin.html` |

**Errors are collected but nothing alerts on them.** Nobody is paged when the error rate
spikes — you have to open the admin dashboard and look. Until that changes, checking it is
part of the post-deploy routine.
