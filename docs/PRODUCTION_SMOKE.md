# Production Smoke

## Scope And Safety

The smoke harness uses the existing `pointy` front-end demo account in fresh,
isolated Chromium contexts. It reads pages, assets and the GET risk-fusion API.
It never edits server data, publishes advisories, resets the demo, changes real
accounts, or saves reusable browser credentials. No cleanup of production data
is necessary.

The target is restricted to localhost or this project's `korattanphai*.vercel.app`
deployments. Preview deployment protection must allow the runner; an access
denial is a failure, not evidence that the application passed. Do not disable
protection or add production credentials to source files to make the test pass.

## Run

```bash
npm run smoke
SMOKE_URL=https://korattanphai-<deployment>.vercel.app npm run smoke
SMOKE_URL=http://127.0.0.1:4173 npm run smoke
```

Install the locked dependencies and Chromium first (`npm ci`,
`npx playwright install chromium`). For localhost, start a preview server on an
available port after `npm run build:protected`. The harness does not start or
deploy a server. Local Vite previews explicitly skip serverless API and hosting
header checks; deployed checks require them.

Checks cover login, overview, drought, district and subdistrict pages at 1440x960
and 390x844; 289 map polygons; latest T+1 overview counts and context;
T+1/T+4 selection; visible images; horizontal
overflow; failed same-origin requests; page errors; asset MIME/cache headers;
hosting security headers; and the read-only API's response contract, no-store
policy and absence of the retired provider. Google-hosted font request failures
are not a same-origin availability failure; screenshots still require visual
review for typography.

Reports and desktop/mobile screenshots are written to ignored `smoke-results/`.
Set `SMOKE_OUTPUT_DIR` to a separate artifact directory when checks run concurrently.
The process exits nonzero on failure. A green smoke run describes that target
at that time; it does not prove that an unpushed local change is deployed.

## CI

`quality.yml` runs unit/data tests, the protected build, exposure/bundle checks,
generated-data drift checks and desktop/mobile E2E against `dist` on pushes/PRs.
Failure traces are retained for seven days. It does not deploy.

`deployment-smoke.yml` runs on successful Production deployment-status events
and also supports a manually supplied URL. It uploads smoke evidence for seven
days. These workflows must be pushed before GitHub can execute them; automatic
post-deploy execution also requires the hosting integration to emit GitHub
deployment-status events. CLI-only deploys without those events require the
manual workflow or local smoke command.

When another task is building in the same checkout, use an isolated artifact and
test-output directory so one run cannot overwrite another's evidence:

```bash
BUILD_OUT_DIR=tmp-snapshots/verification-build npm run build:protected
BUILD_OUT_DIR=tmp-snapshots/verification-build npm run test:e2e:built -- --output=tmp-snapshots/verification-tests
```

Repository branch protections and Vercel deployment blocking are not configured
by these files. Require the `regression` check in repository protection rules
before calling CI a mandatory merge/release blocker. The configuration follows
the official [GitHub deployment event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#deployment_status)
and [GitHub setup-node action](https://github.com/actions/setup-node).
