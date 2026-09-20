# Korat Tan Phai / โคราชทันภัย Release Runbook

## Permission Guardrail

Do not commit, push, deploy, migrate, or touch production data unless the current
user task explicitly instructs it.

When authorized, release from `/Users/point/korattanphai`.

## Actual / Forecast Release Scope

For changes to the actual/archive split, read
[ACTUAL_FORECAST_SEPARATION.md](ACTUAL_FORECAST_SEPARATION.md) and the latest
[handoff](HANDOFF.md) first. A working unavailable state is not completed actual
ingestion. State explicitly whether a candidate exposes only separation/source-gap
UI or a reviewed live feed; never claim the latter from fixture tests.

- Require a passing protected bundle budget, not just TypeScript/Vite and exposure
  checks. The initial 2026-09-20 checkpoint failed that gate; the authorized
  candidate fixed it using shorter obfuscated identifiers while retaining string
  protection. Remeasure each candidate; do not silently raise limits to pass.
- Migrate archive-focused legacy E2E URLs to explicit `mapLayer=forecast-archive`.
  Keep separate tests proving bare T/h links resolve operational valid month T+h.
- Verify server Bangkok time/month rollover, stale-response isolation, unavailable
  versus error/retry, geography/period navigation and exact archive horizons.
  Reuse `e2e/actual-forecast-separation.spec.ts` and its focused unit/API tests.
- Live actual or operational forecast activation additionally requires approved
  sources, metric/geography/crop definitions, review/publication/freshness policy
  and real adapter/UAT evidence. A clock endpoint does not meet those gates.
- Do not migrate ACLs or database data as an implicit part of a UI release.
  Separate local evidence from authorized candidate/production smoke results.

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

Authorized deploy command:

```bash
vercel --prod --yes
```

Expected production alias:

- `https://korattanphai.vercel.app`

Vercel project link lives locally in `.vercel/project.json` and is ignored by
git.

## Production Smoke Checks

After deploy:

1. Open `https://korattanphai.vercel.app`.
2. Log in with an admin-provisioned Supabase email/password account; follow
   `docs/AUTH_SETUP.md`. Do not use test-only fake build values for deployments.
3. Confirm Thai-only visible UI and Korat Tan Phai / โคราชทันภัย brand title.
4. Confirm no console errors and no failed network requests.
5. Confirm the primary sidebar shows `ภาพรวม`, its `ภัยแล้ง` subitem and
   database-mode `ส่งออก Excel`, with no unrelated legacy workflow navigation.
6. Confirm `/geodata/thailand-neighbor-context.geojson` loads.
7. Confirm `/geodata/nakhon-ratchasima-subdistricts.geojson` loads.
8. Confirm `/geodata/nakhon-ratchasima-boundary.geojson` loads.
9. Confirm `/api/risk-fusion?eventId=ARE-2026-0825-NE` returns JSON.
10. Check desktop and mobile widths for no horizontal overflow.
11. Confirm `/`, `/drought`, `/wang-nam-khiao`, and
    `/wang-nam-khiao/t-302504` load after login.
12. Confirm legacy `/nakhon-ratchasima/...` URLs still load for old links.
13. Confirm the Nakhon Ratchasima layer selector hides water, flood, reservoir,
    weather, and rainfall layers from the current product UI.
13. Confirm `/wang-nam-khiao/t-302504` does not show station, rainfall,
    water-level, reservoir, or irrigation detail panels.
14. Confirm an unseeded local route such as
    `/mueang-nakhon-ratchasima/t-300101` says local evidence
    is not yet available and does not render as normal/low-risk.
15. Confirm map layer selector displays provenance and separates no-data,
   source-unavailable, unsupported, low-risk, and available states.
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
