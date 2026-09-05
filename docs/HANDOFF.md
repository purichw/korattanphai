# Korat Tan Phai / โคราชทันภัย Handoff

## Current State

FACT: The repo contains the Nakhon Ratchasima-only subset of the frontend-only
public flood, drought, and water-risk alert prototype. The site brand is Korat
Tan Phai / โคราชทันภัย.

- Repo: `/Users/point/korattanphai`
- Production: `https://korattanphai.vercel.app`
- Primary release branch: `main`
- Source snapshot: copied from Kaset Tan Phai commit
  `0f16794bb57d5dec93b7c6312de7d9362bb97013`.

The app is Thai-only for visible product UI, responsive, and stores runtime demo
state in `localStorage`.

## Recent Changes

Combined release checkpoint (2026-09-05):

- The user authorized committing, pushing and deploying all work from both
  concurrent Korat tasks on `fix/nr-map-zoom-performance`.
- Province overview now displays the latest archived T+1 forecast, with month
  and district filters, scoped counts, high-risk area links and context-preserving
  drilldown. The shared forecast workspace remains available at province,
  district and subdistrict levels. This is archived prediction, not live data.
- The lightweight overview asset is generated from the unchanged canonical
  archive; the full T+1-T+6 archive loads only on detail routes. The release also
  includes the reliability, code-splitting, shared-component and CI work below.
- Release checks: 57 unit/data tests passed; protected build, exposure and
  bundle checks passed. All 39 active desktop/mobile E2E scenarios passed across
  the full run and focused reruns; five existing configured skips remain.
- One map test was corrected after trace evidence showed that deselection
  succeeded but camera movement opened a different hover preview under a
  stationary pointer. The test now checks selection removal, then moves the
  pointer outside the map before checking preview dismissal. It passed twice
  per viewport; product behavior was not changed for this correction.
- Verification artifact: `tmp-snapshots/release-combined-20260905`. Screenshots,
  traces and temporary builds are ignored, not release source files.
- Pre-release recovery deployment: `dpl_4uc1a42qX3rgxBSeJ2xAZm2TdBoi`, associated
  with the previously published work through `440b707`. Production publication
  and post-deploy smoke follow this checkpoint; these local checks alone do not
  prove deployment. Run `npm run smoke` against the published alias for evidence.

Non-functional follow-up (2026-09-05, local work; not deployed by this task):

- Added root/content error boundaries, storage-unavailable notices, in-document
  fallback storage and validation of persisted runtime records. Initial provider
  mount no longer rewrites a saved snapshot; toasts are not saved.
- Login is now a lightweight entry with a lazy `AuthenticatedApp` chunk.
  Login redirects retain query/hash, and ordinary internal content links retain
  the current document so blocked storage does not end the demo session.
- Extracted the large Nakhon workspace into `components/nakhon-ratchasima/`:
  archive calculations, map, forecast controls/workspace, shared research panels,
  and province/district/subdistrict views. The root is now route composition.
- Added startup and total-JS budgets plus static chunk-reference validation.
  `BUILD_OUT_DIR` supports isolated verification artifacts during concurrent work.
- Added GitHub quality/deployment-smoke workflows and a read-only smoke harness.
  Runbook: `PRODUCTION_SMOKE.md`. Workflows are not active until pushed; repository
  protections and Vercel deployment blocking are separate configuration.
- The concurrent T+1 overview changes were retained. Regression expectations for
  its primary map, area selection and context-carrying drilldown were updated;
  forecast counts and canonical archive bytes remain independently checked.
- Verification: 57 unit/data tests passed. All 37 active desktop/mobile E2E
  scenarios passed across the full run and targeted reruns after fixes; the five
  pre-existing skips remain. SVG click tests now wait for the camera to settle,
  and wheel zoom targets a hit-tested background instead of a hover preview.
- Protected build, exposure checks and bundle/reference checks passed in
  `tmp-snapshots/nfr-final2-20260905`. Read-only smoke also passed against the
  existing production deployment; that does not deploy these local changes.

Non-functional archive loading pass (2026-09-05, local work after `440b707`):

- Removed the full forecast archive from the synchronous catalog/domain import
  chain. `src/data/forecastArchive.ts` now fetches a content-hashed JSON asset
  on drought/district/subdistrict routes; login and overview do not fetch it.
- The overview summary is generated from the canonical archive before dev/build.
  Archive source bytes, counts, risk values, and target/T+ semantics are unchanged.
- Added loading/failure/retry handling that preserves the deep-link selection,
  a shared archive request/cache, and local geometry prefetch/cache to load map
  assets alongside the archive and reuse parsed geometry across navigation.
- Profiling caught startup work added by the obfuscator's base64 decoding and
  string-array rotation. Both options are now disabled; identifier obfuscation,
  string tables, source-map exclusion, and blocked-literal checks remain active.
- `npm run check:bundle` guards JS size and verifies emitted archive bytes.
  `npm run test:e2e:built` tests the current `dist`; `npm run measure:load -- label`
  records repeatable local measurements. See `NON_FUNCTIONAL_REQUIREMENTS.md`.
- No production deployment is part of this pass.
- Final local checks: 43 unit/data tests passed; protected build, exposure and
  bundle checks passed; built desktop/mobile E2E passed 25 tests with 5 existing
  configured skips (legacy national-map checks and mobile frame-count check).
  The suite covers unchanged forecast counts, deep links, month/horizon controls,
  drill-down, keyboard/dropdown wheel isolation, map previews/zoom, retry,
  navigation during loading, geometry reuse and optional-context failures.

Recent completed work before this docs pass:

- Thai localization expanded across the app.
- Google Sans font stack added.
- Risk-event and crop text overflow fixed on desktop and mobile.
- Playwright smoke updated for Thai-first workflow.
- Production deploy completed and smoked.

Current incremental source/layer pass:

- Added source registry and map layer catalogue fixtures.
- Added data class, layer availability, and derived-risk fusion semantics.
- Replaced the visible EN language surface with Thai-only UI copy.
- Added layer selector/provenance/no-data handling to the map.
- Updated risk-event, crop, map, and data/model surfaces for clearer
  source-vs-derived wording.
- README, PROJECT_MAP, and dedicated docs updated for the new contract.

Current Nakhon Ratchasima research/data patch:

- Added `src/data/canonical/nakhon_ratchasima/` fixtures from the deep research
  bundle as additive local data.
- Added `public/geodata/nakhon-ratchasima-subdistricts.geojson` with 289
  subdistrict features for province code `30`.
- Preserved Nakhon Ratchasima as the existing canonical province `TH-P29`; no
  second province object was created.
- Naming correction: province-level UI/docs must say Nakhon Ratchasima
  province. Do not use local nicknames or district/local names as synonyms for
  the province.
- Added root-level Nakhon Ratchasima client routes: `/`, `/drought`,
  `/{district-slug}`, and `/{district-slug}/{subdistrict-slug}`. Legacy
  `/nakhon-ratchasima/...` aliases remain accepted for old links.
- Added `NakhonRatchasimaWorkspace` for province, district, and subdistrict
  drill-down with source freshness, inherited context, local evidence, map layer
  selection, and explicit no-data states.
- Added regression coverage for 32 districts, 289 subdistricts, admin-code
  joins, GISTDA GeoJSON coverage, forecast/no-data semantics, Soeng Sang
  investigation limits, and route drill-down.

Current Nakhon Ratchasima rainfall patch:

- Added rainfall source audit and fixtures:
  `rainfall_source_audit.json`, `rainfall_stations.json`,
  `rainfall_observations_24h.json`, `rainfall_monthly_history.json`, and
  `subdistrict_rainfall_coverage.json`.
- Added 49 REAL DWR EWS station points and a 289-subdistrict coverage matrix:
  29 direct-station subdistricts, 260 nearest-station representative records,
  and 0 no-source records in the current matrix.
- Kept `ปริมาณฝนและสถานี` in the raw Nakhon Ratchasima layer catalogue, but the
  Korat Tan Phai product UI now hides water, flood, reservoir, weather, and
  rainfall layers until they are needed for a confirmed prediction workflow.
- Kept `rainfall_observations_24h.json` empty by design. Do not copy unjoined
  province/station values into every subdistrict or silently convert them into
  agricultural risk.
- Preserved seven historical DWR rainfall-warning samples as context only; they
  are not current rainfall readings.
- Updated docs and tests to lock the proxy/no-data contract.

Current province workspace/navigation patch:

- National map detail actions now open canonical province workspace routes.
- `/nakhon-ratchasima` remains the seeded Nakhon Ratchasima province workspace;
  its district/subdistrict child routes are still owned by
  `NakhonRatchasimaWorkspace`.
- Other canonical provinces open `/{province-slug}` placeholder dashboards via
  `ProvinceWorkspacePlaceholder`.
- Placeholder dashboards include situation, agriculture, and data-readiness
  containers, but they must not display missing local evidence as normal risk or
  a completed data-readiness feature.

Current Nakhon Ratchasima SVG map zoom performance patch:

- Confirmed the production map renders 590 paths under
  `g.nr-map-transform-layer`; button and wheel zoom previously updated React
  state on every animation frame, forcing repeated reconciliation of the large
  SVG layer while the transform was moving.
- Added an imperative transient transform path for zoom, wheel, drag, and pinch:
  the visible SVG matrix is written directly during interaction, then React
  state is committed once after the visual transform settles. The deferred
  state commit is cancelable so rapid follow-up input does not wait behind an
  older reconciliation pass.
- Added a separate intended button-zoom target so rapid repeated clicks stack
  the configured zoom step, clamp to the configured bounds, and do not animate
  toward stale partial transforms. Zoom in followed immediately by zoom out now
  returns to the prior intended transform.
- Memoized local feature path strings for the heavy map layers so the final
  React commit no longer recomputes every SVG path string from GeoJSON.
- Preserved GeoJSON, feature counts, risk/readiness semantics, colors, labels,
  route focus, reset/current-area behavior, pan clamping, wheel containment,
  drag/pinch, fullscreen, preview cards, Thai accessible labels, and responsive
  layout.
- Before measurement against production: one button zoom caused 4 React commits
  and the sampled transform tail lasted roughly 354-407 ms; wheel/reset cases
  showed tails around 1.3-1.5 s, and three rapid zoom-in clicks only advanced
  one zoom step.
- After measurement against a local production build (`npm run preview`):
  1440, 1024, 768, 430, and 390 px viewports all kept 590 transform-layer
  paths, showed button first response in 18-40 ms, button visual settlement in
  136-148 ms, rapid three-click zoom reached the full intended target, wheel
  zoom settled in roughly 155-174 ms where tested, reduced-motion zoom settled
  in roughly 11 ms, and no JavaScript errors or horizontal overflow were
  observed.
- Verification for this patch: `git diff --check`, `npm test`,
  `npm run build`, and `npm run test:e2e:managed`.

Current Nakhon Ratchasima local boundary patch:

- Confirmed a separate geometry issue from the zoom-performance issue: the 289
  colored local polygons came from
  `public/geodata/nakhon-ratchasima-subdistricts.geojson`, but the visible white
  province outline came from the separate ADM1 dataset. The two sources do not
  match exactly, so the outline visibly separated from the colored union when
  zoomed.
- Added `scripts/generate-nr-boundary.mjs` and `npm run generate:nr-boundary`
  to deterministically dissolve the 289 local subdistrict geometries into
  `public/geodata/nakhon-ratchasima-boundary.geojson`. The generated artifact
  records source metadata, all 289 Admin codes, source feature count, and bbox.
- Updated `NakhonRatchasimaWorkspace` so the local map fetches the generated
  boundary artifact for the visible Nakhon Ratchasima province outline.
  `thailand-adm1.geojson` remains in use only for national/neighboring-province
  context and labels.
- Removed the redundant province halo/base casing paths, removed the large
  province drop shadow, and now render one clipped white boundary after the
  colored subdistrict polygons. The stroke remains non-scaling, but the clip
  keeps the visible weight inside the dissolved local boundary.
- Audited district/subdistrict focus casing and reduced the focused-area white
  casing from the previous heavy treatment to a lighter non-scaling outline
  while preserving selection and preview halos.
- Added deterministic artifact validation in `tests/domain.test.ts` and browser
  contract coverage in `e2e/app.spec.ts` for artifact loading, removed casing
  layer, clipped province boundary, and focus-casing stroke weight.

Current shared UI and component-memory patch:

- Added `docs/SHARED_COMPONENTS.md` as the living inventory for exported shared
  components and local Nakhon workspace primitives.
- Created local Codex skills:
  `$korat-tan-phai-shared-components` for component reuse and
  `$korat-tan-phai-new-chat` for up-to-date fresh-chat onboarding.
- Expanded `AppSelect` with explicit `align` support and kept product dropdown
  trigger text centered by default across province, district, subdistrict, and
  map filter surfaces.
- Expanded `MetricCard`/`MetricGrid` contracts and routed stat-only agriculture
  and readiness cards through shared centered stat primitives.
- Added `MapPreviewFooter` and reused it from both `RiskMap` and the local
  Nakhon map so preview actions and fallback notes share one implementation.
- Fixed province-map transient selection so a selected feature can be cleared
  without refreshing, while route-selected subdistricts remain locked only on
  the matching route; clearing also suppresses immediate hover preview repaint
  while the map animates back.
- Raised local map preview card stacking and overflow behavior so district and
  subdistrict preview cards are not hidden behind following agriculture or
  readiness sections.
- Centered the shared preview fallback note, including the "insufficient data to
  open detail" state.

Current rev02 drought forecast archive patch:

- Added `src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev02.json`
  from `Drought_T1-6_rev02_Normalized_ArchiveReady(1).xlsx` using
  `scripts/build-nr-drought-forecast-archive.py`.
- The archive maps 289 Source_IDs to all 289 canonical subdistricts, spans 127
  target months from `2015-06` through `2025-12`, keeps horizons T+1 through
  T+6 as separate forecast vintages, and contains 220,218 canonical vintages.
- Product archive semantics: `Source_YearMonth` is the target month,
  `issueMonth = targetMonth - horizon`, and record identity is
  `subdistrictCode + targetMonth + horizon`.
- Risk values remain source semantics: `0` no forecast risk, `1` moderate
  forecast risk, `2` high forecast risk, and blank workbook cells are
  out-of-scope, not no-risk and not join failures.
- The existing local historical map panel data in
  `normalized_research_monthly_panel.json` and
  `normalized_research_panel_summary.json` remains cleared for the dataset
  refresh. Do not restore the old `2025-12` historical map periods unless a new
  source-backed refresh explicitly asks for it.
- Province, district, and subdistrict drought pages now share the same archive
  module family: `DroughtForecastArchivePanel`,
  `DroughtForecastArchiveHorizonSelector`,
  `DroughtForecastArchiveSummaryMetrics`, `DroughtForecastArchiveMapFilters`,
  and `NakhonRatchasimaLocalMap`.
- Latest production deployment after this patch: commit
  `18d4e9dcb28da78a99343d2e2bd7226905fddce0` (`feat: add rev02 drought
  forecast archive`) deployed to `https://korattanphai.vercel.app`.
- Latest release checks passed: `git diff --check`, `npm test`, `npm run build`,
  `npm run test:e2e:managed`, `npm run build:protected`, Vercel production
  build/protect/exposure check, and production smoke for `/`, `/drought`,
  `/dan-khun-thot`, `/dan-khun-thot/t-300806`, the legacy route, an unseeded
  route, geodata endpoints, and `/api/risk-fusion?eventId=ARE-2026-0825-NE`.

## Open Risks

- The app is not operationally safe for real emergency alerting yet.
- No real auth, backend, database, notification provider, or live data ingestion
  exists.
- Vite build has a chunk-size warning due bundled canonical JSON.
- Map fetch has a loading state but no explicit error state.
- No real delivery guarantee or acknowledgement receipt exists.
- SEO/noindex decision is not confirmed.
- Official data source licensing and attribution need audit before live data use.
- DWR or other approved station-specific live rainfall access still needs audit
  before importing current 24-hour rainfall readings.
- The rev02 drought forecast archive is static source-backed fixture data, not
  a live prediction service. Any future dataset replacement must preserve the
  target-month/T+ identity unless the data model is explicitly changed.

## Known Bugs / Limitations

- Browser localStorage can contain stale demo state until Reset Demo Data or the
  current key (`korat-tan-phai-demo-state-v1`) changes again.
- Editing Thai-localized advisory textarea values may store Thai text in runtime
  even though canonical fixture actions are English strings.
- Production copy still includes necessary codes/acronyms such as TMD, GISTDA,
  ARE, ADV, FARM, SMS, LINE.
- Local Codex skills live under `/Users/point/.codex/skills/` and are not part
  of the GitHub repository unless explicitly copied into project docs.
- This repo has no markdown lint command.

## Commands Run Recently

Known release commands from earlier production push/deploys:

```bash
git diff --check
npm run build
npm test
npm run test:e2e
git commit -m "Polish Thai responsive prototype UI"
git push origin main
vercel --prod --yes
```

Docs pass expected checks:

```bash
git status --short
git diff --check
npm run build
npm run build:protected
npm test
npm run test:e2e:managed
```

Latest local verification for the source/layer Thai-only patch:

```bash
git diff --check
npm run build
npm test
npx playwright test
```

Latest local verification for the Nakhon Ratchasima patch:

```bash
npm run build
npm test
npm run test:e2e
```

Result: build passed, 17 unit/data tests passed, and 10 Playwright e2e tests
passed across desktop and mobile.

Latest local verification for the Nakhon Ratchasima rainfall patch:

```bash
npm test
```

Result: 20 unit/data tests passed.

Latest verification for the rev02 drought forecast archive production deploy:

```bash
git diff --check
npm test
npm run build
npm run test:e2e:managed
npm run build:protected
```

Result: 34 unit/data tests passed; 15 managed Playwright checks passed and 5
were skipped by configured route scope; build and protected build passed. Vercel
production deployment `dpl_319gogrp1qzKLUApcjdGgQeuszLF` passed production
smoke with no console errors, failed requests, or horizontal overflow observed
on the checked pages.

Notes:

- `npm run test:e2e` initially failed inside the sandbox because Playwright could
  not bind the local Vite port (`listen EPERM 127.0.0.1:5173`), then
  `npx playwright test` passed when allowed to run local browser automation.
- Snapshot evidence was captured outside git under
  `/private/tmp/korattanphai-snapshots/`.
- Checked desktop 1440px and mobile 390px for Risk events, Crops, Map, and
  Data/Models; no horizontal document overflow was reported.

## Recommended Next Steps

1. Confirm whether the production prototype should be indexed or noindex.
2. Add a map fetch error state.
3. Add production smoke script for repeatable post-deploy checks.
4. Consider lazy-loading large canonical JSON.
5. Decide future backend boundaries before adding live alerts or real users.
6. Human-review public-safety copy before any operational launch.
7. Human-confirm whether GISTDA local geometry attribution/licensing wording is
   sufficient before operational/public-safety use.

## How Another Agent Should Continue Safely

- Start with `README.md`, then `PROJECT_MAP.md` when starting a fresh Codex
  task.
- Use `$korat-tan-phai-new-chat` for a fresh Codex chat and
  `$korat-tan-phai-shared-components` before changing shared UI primitives.
- Read the focused doc for the surface being changed.
- Check `git status --short` before editing.
- Do not use chat history as the source of truth when docs and code are present.
- Do not collapse Nakhon Ratchasima province into a local nickname in UI, docs,
  fixtures, prompts, or implementation notes.
- Do not commit, push, deploy, migrate, or touch production data unless the
  current user explicitly asks for it.
- Use `$release-gate` before any release action.
- Use `$snapshot` for visible UI changes.
