# Production Smoke

## Scope And Safety

The smoke harness uses a real admin-provisioned Supabase test account in fresh,
isolated Chromium contexts. Set `SMOKE_AUTH_EMAIL` and `SMOKE_AUTH_PASSWORD`
securely in the runner environment; missing values fail before network access.
It signs in/out and reads pages, assets and the GET risk-fusion API. It never
edits application data, publishes advisories, resets demo state, changes account
settings or saves reusable browser credentials. Login affects Supabase auth
sessions/audit records but requires no application-data cleanup.

The target is restricted to localhost or this project's `korattanphai*.vercel.app`
deployments. Preview deployment protection must allow the runner; an access
denial is a failure, not evidence that the application passed. Do not disable
protection or add production credentials to source files to make the test pass.

For a protected candidate, the runner may receive `SMOKE_VERCEL_COOKIE` from
an authorized Vercel CLI session. Keep its `_vercel_jwt` value in process memory
only, never a file or CI artifact. The harness scopes it to the target host,
rejects localhost use and API redirects, and redacts it from failure reports.
This authenticates the runner to Vercel; Supabase login is still tested normally.

For database releases, set `SMOKE_DATA_BACKEND=supabase`. The harness compares
both actual app RPC projections to canonical source, checks the risk class of
every map polygon on all five routes, rejects static archive fallback and reads
the saved-workspace modal. `SMOKE_SAVED_FILTER_NAME` optionally verifies a known
saved record across fresh login sessions; the harness itself does not create
or delete personal records. Database-mode smoke also checks all three irrigation
groups by selecting the in-map dropdown: unchanged URL/history length,
categorical colors, canonical location codes, forecast counts and reload
persistence, plus a zero-match subdistrict/reset without false no-risk results.
It captures irrigation and
saved-filter desktop/mobile screenshots.
Run `scripts/verify-database-archive.mjs` separately with the real public Vite
configuration and smoke credentials for complete API/source and anonymous-access
verification. Both scripts redact credentials and keep sessions in memory.

## Run

```bash
npm run smoke
SMOKE_URL=https://korattanphai-<deployment>.vercel.app npm run smoke
```

Install the locked dependencies and Chromium first (`npm ci`,
`npx playwright install chromium`). For localhost, start a preview server on an
available port after `npm run build:protected`. The harness does not start or
deploy a server. Local Vite previews explicitly skip serverless API and hosting
header checks; deployed checks require them.

Checks cover login, overview, drought, district and subdistrict pages at 1440x960
and 390x844; 289 map polygons; latest T+1 overview counts and context;
T+1/T+4 selection; one full-width categorical status above the subdistrict map;
an all-null district with no false zero-risk graph; forward target months from
the selected source month T and date-only T+ tab subtitles; absence of
duplicate/unsupported panels and demo account actions;
visible images; horizontal
overflow; failed same-origin requests; page errors; asset MIME/cache headers;
hosting security headers; and the read-only API's response contract, no-store
policy and absence of the retired provider. Google-hosted font request failures
are not a same-origin availability failure; screenshots still require visual
review for typography.

Reports and desktop/mobile screenshots are written to ignored `smoke-results/`.
Treat screenshots as private: they may contain the test account's display name.
Do not capture password fields, auth response bodies or token-bearing traces.
Set `SMOKE_OUTPUT_DIR` to a separate artifact directory when checks run concurrently.
The process exits nonzero on failure. A green smoke run describes that target
at that time; it does not prove that an unpushed local change is deployed.

## CI

`quality.yml` runs unit/data tests, the protected build, exposure/bundle checks,
generated-data drift checks and desktop/mobile E2E against `dist` on pushes/PRs.
It builds with a fake Supabase URL/key and intercepts auth in Playwright; no
real Supabase request or production auth bypass is used. Failure traces contain
only fake test credentials and are retained for seven days. It does not deploy.

`deployment-smoke.yml` runs on successful Production deployment-status events
and also supports a manually supplied URL. It uploads smoke evidence for seven
days. These workflows must be pushed before GitHub can execute them; automatic
post-deploy execution also requires the hosting integration to emit GitHub
deployment-status events. CLI-only deploys without those events require the
manual workflow or local smoke command.

The deployment workflow also requires repository secrets `SMOKE_AUTH_EMAIL` and
`SMOKE_AUTH_PASSWORD` for a limited test account. They are not provisioned by
the auth implementation. Do not substitute fake E2E credentials or weaken
Supabase settings to make this check pass. See `AUTH_SETUP.md`.

When another task is building in the same checkout, use an isolated artifact and
test-output directory so one run cannot overwrite another's evidence:

```bash
VITE_SUPABASE_URL=https://ktp-auth-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_only BUILD_OUT_DIR=tmp-snapshots/verification-build npm run build:protected
BUILD_OUT_DIR=tmp-snapshots/verification-build npm run test:e2e:built -- --output=tmp-snapshots/verification-tests
```

Repository branch protections and Vercel deployment blocking are not configured
by these files. Require the `regression` check in repository protection rules
before calling CI a mandatory merge/release blocker. The configuration follows
the official [GitHub deployment event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#deployment_status)
and [GitHub setup-node action](https://github.com/actions/setup-node).
