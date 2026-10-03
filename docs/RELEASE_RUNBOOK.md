# Korat Tan Phai / โคราชทันภัย Release Runbook

## Permission Guardrail

Do not commit, push, deploy, migrate, or touch production data unless the current
user task explicitly instructs it.

When authorized, release from a scoped worktree under `/Users/point/korattanphai`.
Preserve the current production revision before building a release candidate.

## Forecast-Only Release Scope

The owner parked Actual routing on 2026-09-20. Follow
[FORECAST_ONLY_RESTORATION.md](FORECAST_ONLY_RESTORATION.md) and the latest
[handoff](HANDOFF.md). The older Actual separation notes are historical, not a
requirement to reactivate that experience.

- Require the protected build, exposure and unchanged bundle-budget gates.
- Test bare routes, old source-T/horizon links and explicit archive links at
  province/district/tambon levels. No live route calls the operational clock.
- Verify month/horizon synchronization, search/bookmarks, missing-origin recovery,
  retained graph/export/map fixes and Supabase revision revalidation.
- Use an isolated tracked-source candidate with production configuration.
  All required CI jobs and authenticated read-only candidate smoke must pass
  before promotion; then verify the production alias.
- Keep Actual code/contracts parked. Future activation needs corrected owner
  requirements, approved sources and adapter/UAT evidence.
- No migration, ACL changes, iOS setup or unrelated UAT/research files are included.

## Local Checks

Inspect scope:

```bash
git status --short
git diff --stat
git diff --check
```

Install dependencies if needed:

```bash
npm install
```

Build:

```bash
npm run build
npm run build:protected
```

Unit/data tests:

```bash
npm test
```

E2E smoke:

```bash
# Codex: start this in an outside-sandbox terminal first
npm run dev:e2e

# Codex: run this outside the sandbox too
npm run test:e2e:attached
```

Local port binding and Chromium launch are blocked by the Codex sandbox, so keep
`npm run dev:e2e` running in a separate outside-sandbox terminal and then run
`npm run test:e2e:attached` outside the sandbox too. Outside Codex,
`npm run test:e2e:managed` starts Vite automatically.

The `dev`, `preview`, and `test:e2e*` npm scripts include local-runtime
preflight guards. If a command is accidentally run inside the Codex sandbox,
the guard should print the required outside-sandbox command instead of a raw
`listen EPERM` or Chromium Mach port stack trace.

Known non-fatal warning:

- Vite may warn that the JS chunk is larger than 500 kB because canonical JSON
  is bundled into the client.

Production builds:

- Vercel uses `npm run build:protected` from `vercel.json`.
- `build:protected` runs the normal TypeScript/Vite build, obfuscates generated
  JavaScript assets in `dist`, rewrites the final asset hash, and runs the
  production exposure and bundle-budget checks. A failing gate blocks release.

## Production Deploy

Build a production-configured candidate without moving the production alias:

```bash
vercel --prod --skip-domain --yes
```

Expected production alias:

- `https://korattanphai.vercel.app`

Vercel project link lives locally in `.vercel/project.json` and is ignored by
git. After required CI and authenticated read-only candidate smoke pass,
recheck the production revision and promote this exact deployment with
`vercel promote <candidate-url> --yes`.

## Production Smoke Checks

After deploy:

1. Open `https://korattanphai.vercel.app`.
2. Log in with an admin-provisioned Supabase email/password account; follow
   `docs/AUTH_SETUP.md`. Do not use test-only fake build values for deployments.
3. Confirm Thai-only visible UI and Korat Tan Phai / โคราชทันภัย brand title.
4. Confirm no console errors and no failed network requests.
5. Confirm the visitor sidebar shows `ภาพรวม`, its `ภัยแล้ง` subitem and
   database-mode `ส่งออก Excel`. In `/admin`, confirm the separate sidebar shows
   only `จัดการข้อมูล`, `รายการนำเข้าและฉบับร่าง` and `นำเข้าข้อมูล`, with all
   destinations under `/admin`. Visitor search, bookmarks and export must not
   appear in the Admin shell. Verify the Admin drawer on mobile as well.
6. Confirm the authenticated CMS geometry bundle supplies the province boundary,
   district boundaries and 289 subdistrict boundaries. No retired country-context
   layer or static-file fallback is expected in the protected deployment.
7. Confirm `/api/health` returns the process-health response with `no-store`.
8. Confirm retired research/source/station resources are absent from the active
   Admin catalog, while original files and history remain readable.
9. Confirm the API functions include `admin_hierarchy.json`, used by the real
   district/subdistrict catalog, in their deployment bundles.
10. Check desktop and mobile widths for no horizontal overflow.
11. Confirm `/`, `/drought`, `/wang-nam-khiao`, and
    `/wang-nam-khiao/t-302504` load after login.
12. Confirm legacy `/nakhon-ratchasima/...` URLs still load for old links.
13. Confirm `/wang-nam-khiao/t-302504` does not show station, rainfall,
    water-level, reservoir, or irrigation detail panels.
14. Confirm forecast values and missing values follow the published rev03
    data on province, district and subdistrict routes; missing values must not
    render as normal/low-risk.
15. Confirm forecast source-month/horizon labels and provenance remain readable,
    and desktop/mobile zoom reveals district and subdistrict map labels.
16. Confirm the root province overview does not show a `กลับแผนที่ประเทศ`
    route-back button.
17. Confirm timestamp/timezone wording remains visible where shown.
18. Confirm public-safety copy does not imply guaranteed outcomes.

Useful Playwright production smoke pattern:

```bash
node -e '/* use Playwright chromium to open production URL, inspect console, and screenshot key pages */'
```

Keep generated screenshots outside git unless intentionally documenting a visual
baseline.

## Rollback / Recovery

If the last commit is bad:

```bash
git revert <commit-sha>
npm run build
npm run build:protected
npm test
npm run test:e2e
vercel --prod --yes
```

Alternative:

- Use Vercel dashboard rollback to promote the previous good deployment.

After rollback:

- Smoke `https://korattanphai.vercel.app`.
- Confirm map loads.
- Confirm root `/` and local drill-down routes load.
- Document the rollback in `docs/HANDOFF.md`.

## Required Approval Gates

Commit:

- User has asked for commit or release.
- Scope is intentional.
- Checks pass or failures are disclosed.

Push:

- User has asked for push or release.
- Branch is known.
- No unrelated local work is staged.

Production deploy:

- User has asked for deploy.
- Normal build, protected build, tests, and e2e have passed.
- Public-safety copy and provenance are not degraded.
- Production smoke will be run after deploy.

## Docs-Only Changes

For docs-only work:

```bash
git status --short
git diff --check
```

Run build/tests only if docs affect published runtime behavior or executable
snippets.
