# Korat Tan Phai / โคราชทันภัย Handoff

## Current State

FACT: The repo contains the Nakhon Ratchasima-only drought and water-risk
dashboard. Supabase provides Auth, the verified Excel forecast archive and
per-account followed areas/saved filters. The site brand is Korat Tan Phai /
โคราชทันภัย.

- Repo: `/Users/point/korattanphai`
- Production: `https://korattanphai.vercel.app`
- Primary release branch: `main`
- Source snapshot: copied from Kaset Tan Phai commit
  `0f16794bb57d5dec93b7c6312de7d9362bb97013`.

The app is Thai-only for visible product UI and responsive. Remaining demo
workflow state/preferences still use `localStorage`; they are not part of the
scoped database migration. Recent changes below are chronological checkpoints;
the newest release supersedes earlier statements about production state.

## Recent Changes

Cold-entry loading repair (2026-09-13, local only):

- The reported “กำลังเปิดโคราชทันภัย...” screen was the outer `App.tsx`
  Suspense fallback, shown after auth while the full `AuthenticatedApp` chunk
  downloaded. Existing archive skeletons could only appear after that chunk.
- Added an eager `AppStartup` with the shared sidebar brand and neutral Home
  skeleton; session checking outside `/login` also uses it. Heavy application
  imports and data access still wait for sign-in. Explicit login, denied access,
  redirect/session restoration and the failed-chunk recovery path remain intact.
- Split pure forecast loading presentation from the heavy drought header.
  Existing overview and drought loaders use the same primitives. No forecast
  values or user details appear in startup placeholders.
- Auth unit checks: 27 passed; existing forecast-loading unit checks: 10 passed.
  Browser evidence covers six startup cases, ten existing auth cases and eight
  existing data-loading cases across desktop/mobile. Initial mobile test failures
  were selector/timing issues: hidden toolbar placeholders and the transition
  between startup and data-loading skeletons. Corrected tests pass.
- Verified a protected build over HEAD `8501e40` plus the scoped startup files
  in `artifacts/startup-loading-20260913/isolated-source`; startup gzip 117,293 B
  remains below the 125,000 B budget. Exposure/chunk-reference checks passed.
  The shared checkout initially had a concurrent, unrelated TypeScript error
  in newly added `src/mapPoint.ts`; that work was preserved, not included in the
  isolated verification or repaired here.
- Screenshots/results live in `artifacts/startup-loading-20260913/`.
  Evidence uses local static data with mocked auth and held/failed chunk requests;
  it does not prove live network latency or Supabase integration. No commit,
  push, deployment, production data write, or whole-site regression was done.

Excel export upgrade production release (2026-09-09):

- Pushed runtime `1404e49d55c8ca2062e35baf01c9c8c8018dca7a` and test-runner
  follow-up `2b6bc4b12629aa9d2a352cd74372c0c112765923` on
  `fix/nr-map-zoom-performance`. Export now previews scope/revision before
  download, supports real worker cancellation and bounded generation, adds
  typed machine data and a TH/EN business dictionary, and compares different
  origin rounds by the same tambon and target month. Original seven sheets,
  native chart/Pivot parts and source-risk semantics remain intact.
- [Quality Gate](https://github.com/purichw/korattanphai/actions/runs/34346764768)
  passed all four jobs and the aggregate: 246 unit, 104 model-input/API/jobs,
  9 operations, 11 SQL/integrity/RLS, 135 built-browser cases (35 conditional
  skips), 41 database-browser cases (one mobile full-province duplicate skip),
  and 6 WebKit/Firefox cases. Dependency audit reported no vulnerabilities.
- The first CI run exposed a cold-cache Vite optimizer race: discovering lazy
  Excel worker dependencies replaced React modules under a concurrent retry
  test. The follow-up prebundles those three dependencies in the database test
  runner only. All assertions remain; five concurrent fresh-cache cases passed,
  then remote CI passed. Runtime/dependencies/build files are identical between
  the two commits, so the verified deployment artifact was reused.
- Built the production candidate from clean Git archive
  `artifacts/excel-release-2f9i8ezz`, excluding local artifacts and Python cache.
  Vercel protected build/exposure/bundle checks passed with Supabase configured
  and no static forecast archive assets. Promoted the verified candidate after
  CI passed: `dpl_6Tui6Ae7R5ZHrmM8sQGzVnxQyTji`,
  `https://korattanphai-q7tf1zc1v-purichwc-1517s-projects.vercel.app`.
  Primary-origin inspection confirms `https://korattanphai.vercel.app` serves
  that deployment and entry `index-cbf7ae1fc5.js`.
- Candidate and primary production each passed 32 authenticated desktop/mobile
  smoke checks plus seven hosted endpoint cases, with no failures. Real Excel
  downloads retain 1,734 source-equal province values and 36 district values.
  Supplemental desktop/mobile exports on both origins verify 36 typed machine
  rows, 30 same-target comparison pairs (60 source values), 82 dictionary
  definitions, fresh revision reads, and native chart/Pivot/OOXML relationships.
  Production desktop/mobile screenshots were reviewed.
- Evidence: `artifacts/excel-upgrade/release/metadata.json`,
  `quality-release.{json,log}`, `release-{candidate,production}/`,
  `comparison-live-2026-09-09T11-30-52-815Z/` (candidate), and
  `comparison-live-2026-09-09T11-52-37-287Z/` (production). Prior ONLYOFFICE
  reading/recalculation evidence and Microsoft Excel platform limits remain
  documented in [FORECAST_EXCEL_EXPORT.md](FORECAST_EXCEL_EXPORT.md).
- No migrations, application-data writes, canonical/geodata edits, or live-feed
  activation. Input/readiness remain unconfigured; telemetry remains off.
  Credentials and Vercel cookies were held in process memory only. Recovery:
  promote prior verified `dpl_CV1XnFCt3p3wgyaw1A252DtLAEkJ`, then smoke the
  primary origin; no database rollback is required.

Operational hardening production release (2026-09-09):

- Pushed runtime `abfa101233f6ccba87e78f2700c3b9a7b13a1ea8` and test-only
  follow-up `88512c9b993c0737c4ee40761279f23d28967ccf` on
  `fix/nr-map-zoom-performance`. The only follow-up difference is the forecast
  fault-injection test: it lets Vite's `?import&url` module load while holding
  the actual data fetch. Timeout/error/retry/selection assertions remain intact.
- [Quality Gate](https://github.com/purichw/korattanphai/actions/runs/34333473547)
  passed all four jobs and the `regression` aggregate on the follow-up commit:
  197 unit, 104 model-input/API/jobs, 9 operations, 11 SQL/integrity/RLS checks,
  135 built Chromium cases (31 conditional skips), 38 database-browser cases
  and 6 WebKit/Firefox cases. The first CI attempt exposed the Vite import
  interception issue and was superseded; it is not counted as a pass.
- Created the protected Supabase candidate from clean Git archive
  `artifacts/nfr-release-2ojt6rlh`, excluding the incidental Python cache and
  local artifacts. Vercel Node24 build/exposure/bundle checks passed with no
  static forecast archive assets. The tested follow-up has identical runtime,
  dependency, build and deployment files, so the verified artifact was reused.
- Deployment `dpl_CV1XnFCt3p3wgyaw1A252DtLAEkJ` is Ready at
  `https://korattanphai-438zljgad-purichwc-1517s-projects.vercel.app`.
  Promoted that exact artifact after CI and candidate verification. Direct
  deployment lookup and the alias listing confirm
  `https://korattanphai.vercel.app` resolves to this deployment.
- Candidate and primary production each passed 32 authenticated desktop/mobile
  smoke checks plus 7 hosted operational endpoint cases. Login/logout, scoped
  source equality, map colors, month/T+, irrigation/reset, saved reads, assets,
  security/cache headers and real Excel exports passed with no failures.
  Excel checks retained 1,734 source-equal values on desktop and 36 on mobile,
  including native chart/PivotTable parts. Desktop/mobile screenshots reviewed.
- Hosted status: public `/api/health` returns 200; invalid/method checks return
  their expected 400/405; private readiness returns 503 `not_configured`;
  `/api/model-inputs` returns 503 `service_not_configured`; disabled telemetry
  POST returns 204 and GET returns 405. These prove deployed handlers and
  disabled configuration boundaries, not an activated live data pipeline.
- Evidence is in `artifacts/nfr-regression/`: `release-metadata.json`,
  `quality-release.json`, `quality-release-full.log`, `deploy-candidate.json`,
  `production-inspection-confirmed.json`, and `release-{candidate,production}/`
  with `report.json`, `operational-endpoints.json` and screenshots.
- No migrations, live feed/scheduler, monitoring/recipient/log-store activation,
  forecast changes or application-data writes. Browser telemetry remains off.
  GitHub smoke secrets/variables are absent; preview-event smoke workflows were
  skipped and production verification used the local authorized harness.
  No passwords or Vercel session cookies were saved to source or reports.
- Recovery: promote prior verified `dpl_BmFJqbxy4eE66KdXiV16yxQCULV1`, then
  smoke the primary origin; no database rollback is required by this release.
  Field performance/SLA, physical-device/assistive-technology coverage,
  independent-connection capacity and whole-database restore remain unverified.

Local NFR implementation and regression (2026-09-09; not deployed):

- Added operational health/readiness, request IDs/log summaries, opt-in bounded
  browser telemetry, scoped integration identities, key rotation and durable
  quota SQL. Both opaque Supabase secret keys and legacy service-role JWTs are
  supported by server adapters. New migrations remain prepared, not applied.
- Added frozen resumable input jobs, deferred retries, source-specific freshness
  reports, source-scoped backup/local restore and report-only retention. Synthetic
  CLI restore retained exact receipts; this is not a whole-database recovery tool.
- Forecast and map loads now have 30-second deadlines and retry recovery; map
  retry preserves source month, T+ and selected area. Added skip navigation,
  compatibility cases and separate CI jobs with a stable `regression` aggregate.
- Local verification: 197 unit, 104 model-input, 9 operations, 11 SQL, 135 built
  Chromium cases (31 conditional skips), 38 isolated database-browser cases and
  6 selected WebKit/Firefox cases and 32 real-account checks against the new
  local protected Supabase build passed.
  Canonical/generated/geodata files (47) remain identical to HEAD.
- Current outcome, browser/performance evidence and limits are in
  [NFR_REGRESSION_2026-09-09.md](NFR_REGRESSION_2026-09-09.md). Operational activation,
  real source scheduling, log recipients, whole-database recovery and hosted
  verification follow [NFR_OPERATIONS_RUNBOOK.md](NFR_OPERATIONS_RUNBOOK.md).
- No commit, push, deploy, remote migration or application-data write in this
  checkpoint. Existing uncommitted integration work was preserved. The previous
  production release below remains the deployed state.

Exclusive forecast-action accordion release (2026-09-08):

- Pushed runtime `eabcefa3c54971fd78a7eb62ddf9df2af4f6cf19` on
  `fix/nr-map-zoom-performance`. This release includes only the six files for
  this task: shared operational/workspace components, styles, focused unit
  and browser tests, and shared-component documentation.
- Province/district action cards share `DroughtOperationalDisclosureGroup`:
  at most one section opens, the other two collapsed cards stay side by side
  above it, and the expanded section occupies the full row. Desktop/mobile,
  keyboard focus, close-all, mounted content and conditional item removal
  are covered. Subdistrict standalone guidance retains its existing behavior.
- [Quality Gate](https://github.com/purichw/korattanphai/actions/runs/34243218988)
  passed for the exact runtime commit: 185 unit tests, 11 isolated
  migration/integrity/RLS checks, 129 built-browser tests (31 conditional
  skips), 38 database-browser tests, protected builds, exposure/bundle limits
  and generated-data drift. The clean protected build also passed all six
  focused accordion browser cases locally. CI took 19m47s against its
  20-minute limit; no workflow changes are included in this release.
- Deployment used clean Git archive `artifacts/accordion-release-3tfjTc`,
  excluding unrelated working-tree changes. Verified Supabase Preview:
  `dpl_FgxAUauCp3ajd3og5TZDPf9WsU7m`,
  `https://korattanphai-mymdk1zye-purichwc-1517s-projects.vercel.app`.
  Preview received existing public browser Auth configuration per build;
  the automatic static-backend Preview was not used as release evidence.
- Production is Ready at `dpl_BmFJqbxy4eE66KdXiV16yxQCULV1`,
  `https://korattanphai-lv08sk5n0-purichwc-1517s-projects.vercel.app`.
  Deployment inspection confirms `https://korattanphai.vercel.app` points to
  this exact artifact with the Supabase backend and no static forecast assets.
- Preview and primary production each passed 32 authenticated smoke checks
  plus four province/district accordion checks across Chromium desktop/mobile.
  These verify exclusivity, the collapsed pair above the expanded card,
  keyboard focus, close-all, stable map dimensions and unchanged URLs.
  Existing checks retain login/logout, scoped RPC/source equality, map colors,
  month sync, percent/count charts, irrigation/empty/reset states, saved reads,
  assets/API/headers and no browser errors or horizontal overflow. Real Excel
  downloads retain 289 tambons, 32 district summaries and 1,734 source-equal
  values on desktop; mobile verifies six tambons, one district and 36 values,
  plus native chart/PivotTable parts.
- Evidence: `smoke-results/accordion-{preview,production}/report.json`,
  `accordion-report.json` and `*-{province,district}-attention-open.png`.
  No forecast/normalized changes, remote migrations, application-data writes,
  Auth/protection changes or credentials saved in reports. Unrelated pending
  model-input API, collection scripts, migration and configuration edits are
  deliberately uncommitted and excluded from the production snapshot.
- Limits: Chromium only; Safari, Firefox, physical devices and native Excel
  were not retested. Recovery: promote prior verified deployment
  `dpl_DLXCqgLHJvL46SyupsdkjnQ7Jrmr`; leave Supabase schema/data unchanged.

Combined irrigation-layout and forecast-terminology release (2026-09-08):

- Pushed runtime `5f1e62550cfd0eca75579eb5032f2c56bae3f005` and test-only
  follow-up `b7b40b5b9a467827de31c99e2633e7108605f457` on
  `fix/nr-map-zoom-performance`, combining the two authorized tasks. The
  follow-up only updates an obsolete archive-test tab selector to the new
  accessible label; all source-value and map-color assertions remain intact.
- Empty irrigation results now keep the district/province map in its existing
  desktop grid column instead of expanding across the chart. Overview and
  drought workspaces share `IrrigationEmptyState` and already share the map,
  month/status filters and irrigation selector. Their distinct outer layouts,
  subdistrict layout and mobile stacking remain intentional.
- Shared forecast labels use `ล่วงหน้า N เดือน`, with compact `N เดือน` tabs
  and chart axes. Mobile horizon dates consistently wrap month/year. Numeric
  horizons, forward-month calculations, source keys, URLs, user-authored saved
  names and Excel T+1-T+6 fields/formulas are unchanged.
- [Quality Gate](https://github.com/purichw/korattanphai/actions/runs/34238131931)
  passed for `b7b40b5`: 183 unit tests, 11 isolated migration/integrity/RLS
  checks, 123 built-browser tests (31 conditional skips), 38 database-browser
  tests, protected builds, exposure/bundle limits and generated-data drift.
  The corrected source-integrity browser spec also passed all eight cases
  locally against a protected build before the successful CI rerun.
- Clean Git archive candidate `dpl_DLXCqgLHJvL46SyupsdkjnQ7Jrmr` was built
  from `5f1e625` using Production settings and `--prod --skip-domain`.
  Candidate URL: `https://korattanphai-fsz1waxeh-purichwc-1517s-projects.vercel.app`.
  The later promotion request reported that this was already current
  production (409); deployment inspection and alias listing independently
  confirmed `https://korattanphai.vercel.app` points to this exact artifact.
  The test-only follow-up does not change deployed runtime bytes.
- Candidate and primary-production authenticated smoke each passed 32 checks
  on Chromium desktop/mobile. Coverage includes scoped RPC/source equality,
  map colors, month synchronization, percent/count charts, irrigation states
  and empty/reset frame stability across Overview/district/subdistrict,
  saved-workspace reads, login/logout, API/assets/headers, and no browser
  errors or horizontal overflow. Real Excel downloads verify 289 tambons,
  32 district summaries and 1,734 source-equal values on desktop; mobile
  verifies six tambons, one district and 36 values, plus chart/PivotTable parts.
- Evidence: `smoke-results/irrigation-terminology-{candidate,production}/report.json`
  and screenshots, including `desktop-empty-irrigation-district.png` and
  `mobile-empty-irrigation-district.png`. No forecast/normalized edits, remote
  migration, application-data writes or Auth/protection changes. Credentials
  and deployment-access cookies are not saved in reports. Unrelated
  `scripts/__pycache__/` remains untouched and uncommitted.
- Limits: Chromium only; Safari, Firefox, physical devices and native Excel
  were not retested. Recovery: promote previous verified deployment
  `dpl_2ssjqfeeLknkTUxL9Fi3Ud1YULfs`, without changing Supabase schema/data.

Inline forecast month-loading production release (2026-09-08):

- Pushed and released runtime `e6611d95e312379d219a4075db3f540a79ef2786`
  on `fix/nr-map-zoom-performance`. Only the month-loading UI, shared-component
  documentation and focused regressions changed; unrelated lock/cache files
  remain untouched and uncommitted.
- Shared `ForecastMonthSelect` shows an in-place spinner in page/map month
  controls, including the Home mobile editor. The long top paragraph is now
  an assistive-technology announcement outside the busy content. Loaded dates,
  map and metrics stay synchronized until success; late responses, retry,
  reduced motion and background Supabase revision checks remain supported.
- [Quality Gate](https://github.com/purichw/korattanphai/actions/runs/34220940871)
  passed for the exact runtime commit: 177 unit tests, isolated database checks,
  109 built-browser tests (31 conditional skips), 38 database-browser tests,
  protected builds, exposure/bundle limits and generated-data drift checks.
  The unchanged local implementation also passed 12 focused unit/lifecycle
  tests and 10 desktop/mobile scoped-loading browser tests before release.
- Built clean Git archive candidate `dpl_2ssjqfeeLknkTUxL9Fi3Ud1YULfs` with
  Production settings and `--prod --skip-domain`, then promoted that same
  artifact after CI and candidate smoke passed. Primary alias inspection
  confirms `https://korattanphai.vercel.app` serves this deployment.
  Candidate: `https://korattanphai-3hohrvn3z-purichwc-1517s-projects.vercel.app`.
- Candidate and production each passed 28 existing authenticated smoke checks
  plus four targeted Home/district month-change checks across desktop/mobile.
  Targeted checks delay only delivery of an unchanged, source-equal live
  Supabase response: no heading movement, old values/colors retained while
  pending, and spinner/announcement cleared once the new month is loaded.
  Full smoke retains five route scopes, source-equal map/RPC/Excel checks,
  login/logout, irrigation, saved-workspace reads, assets/API/headers and
  no browser errors or horizontal overflow.
- Evidence: `smoke-results/month-loading-{candidate,production}/report.json`,
  `month-loading-report.json`, and `*-home-pending.png` / `*-district-pending.png`.
  No forecast/normalized changes, migrations, application-data writes,
  credentials in reports, or Auth/protection-setting changes. Chromium only;
  Safari, Firefox and physical devices were not retested for this UI release.
  Recovery: promote previous verified deployment
  `dpl_GvGMGxBQEKgn74xbmwvdhDWhnKjy`; leave Supabase schema/data unchanged.

Forecast Excel export and overview cleanup production release (2026-09-07):

- Released runtime `ccf506c0b2a382e7a69281e1258f3dc0bf18b21c` and pushed
  `e7ced247e9aa5f3eff58a74dd65399e6a6aaac86` on
  `fix/nr-map-zoom-performance`. The latter updates only an obsolete test
  expecting a derived-readiness badge; it now requires absent readiness UI
  and all four real-forecast provenance indicators. Runtime bytes are unchanged.
- Combined both tasks: shared filtered Excel export with district/tambon
  T+1-T+6, editable native charts/PivotTable and traceable provenance; removal
  of supporting-readiness UI/map actions/loading slots; clearer Home empty
  attention state and summary-heading forecast navigation without duplicate
  archive cards. Forecast values, irrigation rules and geometry are unchanged.
- [Quality Gate](https://github.com/purichw/korattanphai/actions/runs/34126361083)
  passed: 175 unit tests, 11 isolated migration/integrity/RLS checks, 109
  built-browser tests (31 conditional skips), 38 database-browser tests,
  protected builds, exposure/bundle budgets and generated-data drift checks.
  Local tests exclude ignored `artifacts/**` and `tmp-snapshots/**` copies;
  no product test is omitted by that exclusion.
- Candidate `dpl_GvGMGxBQEKgn74xbmwvdhDWhnKjy` was built from a clean Git
  archive of `ccf506c` with Production settings and `--prod --skip-domain`.
  After candidate smoke and passing CI, the same artifact was promoted to
  `https://korattanphai.vercel.app`; alias inspection confirms this deployment.
  Candidate URL: `https://korattanphai-c5t8t0qbj-purichwc-1517s-projects.vercel.app`.
- Authenticated candidate and production smoke both passed on desktop/mobile:
  five route scopes, source-equal scoped RPCs and map colors, forward months,
  chart units, irrigation, unavailable states, saved-workspace reads,
  login/logout, API/assets/security headers and no overflow/browser errors.
  Real downloads contain 32 districts/289 tambons/1,734 source-equal values
  on desktop and one district/six tambons/36 values on mobile, with district
  maximum-risk summaries, chart/PivotTable parts and dataset provenance.
  Evidence: `smoke-results/excel-overview-{candidate,production}/report.json`.
- No remote migration, forecast/normalized edits, application-data writes or
  Auth/protection-setting changes. Candidate smoke used the project's existing
  authorized automation access; credentials/cookies were not saved in reports.
  Spreadsheet lock and Python cache files remain untouched and uncommitted.
- Residual limits: Chromium only, not Safari/Firefox/physical devices; native
  Microsoft Excel was not available (ONLYOFFICE was exercised during feature
  development). Pivot may require Refresh All. The pinned ExcelJS fork's uuid
  dependency retains a moderate advisory outside the v4-only paths used here;
  see `FORECAST_EXCEL_EXPORT.md`. Recovery: promote previous verified deployment
  `dpl_B477wzpSX4kBhxVgcJCriFbfzCF1`, without changing Supabase schema/data.

Overview map month and bookmark production release (2026-09-07):

- Pushed runtime `7e7f3ecc5b3dd6f820c8ab2795ac67a0eb095269` on
  `fix/nr-map-zoom-performance`. `05bf09b` narrows the existing Home test's
  month selector; runtime, data and deployment configuration are identical.
- Home enables the existing shared map month dropdown, synchronized with the
  top filter, URL and T+1 summary. Included the concurrent bookmark redesign:
  shared buttons, fixed dialog header/tabs, internal scrolling, empty/error
  states, inline delete confirmation and restored focus on close.
- [Quality Gate](https://github.com/purichw/korattanphai/actions/runs/34119431352)
  passed: 171 unit tests, isolated database/RLS checks, 109 built-browser tests
  (27 conditional skips), 34 database-browser tests, protected builds,
  exposure/bundle budgets and generated-data drift checks. Local targeted
  desktop/mobile flows also passed, including mocked bookmark writes.
- Built clean commit archive `7e7f3ec` using Production settings with
  `--prod --skip-domain`. After candidate smoke and CI, promoted the same
  artifact without rebuilding. Production alias inspection confirms
  `dpl_B477wzpSX4kBhxVgcJCriFbfzCF1` at
  `https://korattanphai-9c7y4x9ca-purichwc-1517s-projects.vercel.app`.
- Authenticated candidate and production smoke passed on desktop/mobile:
  month synchronization both ways, bookmark reads/keyboard/focus, five route
  scopes, source-equal scoped RPCs/map colors, chart units, irrigation and
  unavailable states, login/logout, assets/API/security headers and overflow.
  Evidence: `smoke-results/combined-ui-{candidate,production}/report.json`,
  `*-overview-month-filter.png` and `*-saved-filters.png`.
- No Supabase migrations, application-data writes, auth changes or forecast
  data edits. New in-progress work started during CI remains uncommitted and
  was not included; spreadsheet lock and Python cache files remain untouched.
  Chromium only; Safari/Firefox/physical devices were not checked.
- Recovery: promote previous verified deployment
  `dpl_61UY2UeoW9vKE4bMofVvuof1SXDn`; leave Supabase data/schema unchanged.

Shared forecast bar graph production release (2026-09-07):

- Pushed runtime `b96340fc35a65403b3076219375babccca68ef6f` on
  `fix/nr-map-zoom-performance`. `f7ef591` corrects the loading test for static
  versus database providers; runtime/data/configuration match `b96340f` exactly.
- Province and every district reuse `ForecastRiskBarGraph.tsx` through
  `DroughtForecastWorkspaceChart`. Full-width percent/count controls, readable
  six-horizon labels, four-item responsive legend, coverage strip and
  hover/focus/tap details follow the supplied desktop/mobile references.
  Subdistricts still omit the population chart. Risk/date/denominator semantics,
  map state and archive values are unchanged.
- [Quality Gate](https://github.com/purichw/korattanphai/actions/runs/34116923885)
  passed for `f7ef591`: 171 unit tests, isolated database/integrity/RLS checks,
  109 built-browser tests (23 conditional skips), 30 database-browser tests,
  protected builds, exposure/bundle budgets and generated-data drift checks.
  Local chart evidence also covers all six requested desktop/mobile sizes.
- Candidate `dpl_61UY2UeoW9vKE4bMofVvuof1SXDn` was built from a clean archive of
  `b96340f`, using Production settings and `--prod --skip-domain`. After CI and
  authenticated candidate smoke, the same artifact was promoted without a
  rebuild to `https://korattanphai.vercel.app`. Verified deployment URL:
  `https://korattanphai-mniipewgq-purichwc-1517s-projects.vercel.app`.
- Candidate and production real-account smoke passed on desktop/mobile:
  login/logout, five route scopes, source-equal scoped RPCs and map colors,
  chart units, all-null handling, irrigation/reload/reset, saved-workspace
  reads, assets/API/headers and no overflow or page errors. Additional Soeng
  Sang checks confirm the new legend and keyboard/touch detail behavior.
- Evidence: `smoke-results/bar-graph-{candidate,production}/report.json`,
  `shared-chart-report.json`, and `desktop-shared-chart.png` /
  `mobile-shared-chart.png`. Local reference comparison:
  `artifacts/bar-graph-v1/reference-development.png`.
- No remote migration, application-data writes, Auth settings or normalized
  source changes. Concurrent uncommitted bookmark design changes and the
  existing spreadsheet lock/Python cache were excluded from this release.
  Chromium only; Safari/Firefox/physical devices were not checked. The existing
  large-chunk advisory remains within the enforced budget.
- Recovery: promote `dpl_BtffbjmaXRzBPLNt1Wffp9R7W7gX`, the previous verified
  combined forecast release. Keep Supabase schema/datasets unchanged.

Subdistrict inspection workspace production release (2026-09-07):

- Released runtime `ccd04d75dd842e64ade37bda2cd39ef18413209e` after the separate
  Rev03 deployment finished and its production smoke passed. The base includes
  `d8286dd`, `8b149dc` and the cutover documentation `fffe3c9`; see
  `docs/DROUGHT_REV03_CUTOVER.md`. No new remote migration or data writes here.
- Subdistrict desktop/tablet now use a dominant map and result/context/guidance
  rail. The context card stretches so collapsed guidance ends exactly at the
  map bottom. Mobile stacks the same shared components. Six T+ tabs fill the
  intro width; duplicate page/map month and page/strip horizon controls remain
  intentionally synchronized. Forward T+ semantics and Rev03 values are intact.
- Single-area map fitting opts into a geometry-bounded 28x maximum and readable
  labels. Other scopes retain 7.2x. The existing renderer, irrigation controls,
  account/bookmarks and navigation remain; neutral loading follows the layout.
- Local gate: 160 unit tests, 37 targeted desktop/mobile browser tests (one
  duplicate matrix skip), ten responsive sizes, protected Supabase build,
  exposure/bundle checks and no generated-data drift passed. Exact-commit CI
  passed every required step, including both built-browser suites and isolated
  migration/RLS checks: https://github.com/purichw/korattanphai/actions/runs/34047516946 .
- Candidate `dpl_ufZBassRXtWfk7i3UVoeqeG5GbFD` was built from clean detached
  source `artifacts/subdistrict-v2/release-ccd04d7/` with real Production settings
  and `--prod --skip-domain`. After CI and endpoint checks, the same artifact was
  promoted to `https://korattanphai.vercel.app`. Deployment URL:
  `https://korattanphai-acbri7qqw-purichwc-1517s-projects.vercel.app`.
- Candidate and public endpoint checks each passed 11 resources: HTML, all
  three JS/two CSS chunks, backend marker, three geometry files and API. Public
  bytes match the candidate; CSP/MIME/cache headers pass and backend remains
  Supabase without static forecast assets. Reports are in
  `artifacts/subdistrict-v2/{candidate,production}-endpoints.json`.
- Real production Chrome used the existing authenticated session. All six
  horizons retain the source month and synchronize the dropdown/context; map
  category totals match Rev03 and the selected area's risks are 1/1/1/2/2/2.
  Home-key selection and Enter/Space guidance toggling passed. Desktop 1440x900,
  tablet 768x1024 and mobile 390x844 have no horizontal overflow. Map/guidance
  bottoms match exactly: 877.992px desktop and 1089.281px tablet. Desktop and
  mobile screenshots were inspected inline; browser error logs were empty.
- No fresh password login, live bookmark writes/restoration, Safari or physical
  device checks in this UI release. Auth/bookmarks have isolated CI coverage;
  previous Rev03 real-account smoke is recorded separately. Unrelated rollback
  notes, spreadsheet lock and Python cache files remain uncommitted/excluded.
  Recovery deployment is the verified Rev03 release
  `dpl_J9kqETDCpFdFaD1AcSFigN81cGvW`; preserve its schema and immutable dataset.

Forward forecast semantics and UI terminology production release (2026-09-06):

- Released runtime `8cfa2824f81b9bb886b7479ef9d36a0c6dbcdf41` to
  `https://korattanphai.vercel.app`; pushed `fix/nr-map-zoom-performance`
  without merging `main`.
- The user confirmed that Excel `Source_YearMonth` is origin T for every
  source month, including June 2015. Runtime `issueMonth = T` and
  `targetMonth = T + horizon`: June 2015 forecasts July-December 2015;
  December 2025 forecasts January-June 2026. This supersedes the previous
  fixed-target/backwards-reference product convention below. The original
  normalized workbook's `UNCONFIRMED` marker remains historical provenance.
- `src/forecastPeriod.ts` owns shared calendar-month arithmetic;
  `forecastModel.ts` projects dates for Home, province, district, subdistrict,
  graphs and maps. UI consistently distinguishes `เดือนตั้งต้น (T)` from
  `เดือนที่พยากรณ์`, including filters, map previews, loading placeholders,
  guidance, and saved-selection descriptions. The final copy follow-up removes
  `พยากรณ์` from T+ tab subtitles, leaving only the forward month/year.
- Immutable canonical/generated JSON and published database/RPC payloads are
  unchanged. Legacy `targetMonths`, `packedRiskByTargetMonth`, URL `target`,
  and saved `target_period` still identify the source row T. Old saved links
  retain the same source/horizon/risk while displaying forward dates. No data
  migration is needed. Active contracts are updated in DATA_CONTRACT,
  ARCHITECTURE, APP_MAP, SHARED_COMPONENTS and SUPABASE_DATA_MIGRATION.
- Local gate: 154 unit tests, a fresh protected build and 16 built-browser
  drought-workspace checks passed after the final tab-copy change. Tests cover
  preservation of all 220,218 source/horizon/subdistrict values across 127
  months. Exact-runtime Quality Gate
  `https://github.com/purichw/korattanphai/actions/runs/34037950815` passed:
  154 unit tests, 10 isolated migration/integrity/RLS checks, both protected
  static and Supabase builds, 90 built-browser tests (10 conditional skips),
  four database UI tests, exposure/bundle guards and no generated-data drift.
  The existing Vite chunk-size advisory remains within enforced budgets.
- Deployment `dpl_CNfArLjRBvsG2kX5Bjx2hSVX9RAK` came from a clean detached
  checkout (227 uploaded source files), used the actual production Supabase
  configuration, and was promoted unchanged after candidate checks and CI.
  Deployment URL:
  `https://korattanphai-eytyko48m-purichwc-1517s-projects.vercel.app`.
  Candidate and public production each passed 10 endpoint checks with matching
  bytes/hashes, MIME types, CSP and cache headers. The backend marker remains
  Supabase; no static forecast archive assets or source maps were emitted.
- Real production Chrome checks used an existing authenticated session:
  Home T+1, province Dec-2025/T+6 and Jun-2015/T+6, and subdistrict
  Dec-2025/T+4 all showed forward dates. All 289 map risk colors matched the
  canonical source/horizon values in each checked state. The month selector
  offered 127 origins back to June 2015; saved-filter descriptions used forward
  dates. Desktop and true 390px mobile screenshots were inspected, with no
  horizontal overflow or browser errors.
- Evidence: `tmp-snapshots/forward-forecast-release-e2e-20260906/`,
  `tmp-snapshots/forward-forecast-candidate-check-20260906/report.json`,
  `tmp-snapshots/forward-forecast-production-check-20260906/report.json`, and
  `tmp-snapshots/forward-forecast-production-ui-20260906/report.json`.
  Production screenshots include `desktop-subdistrict-dec2025-t4.png`,
  `desktop-june2015-t6.png` and
  `mobile-subdistrict-dec2025-t4-verified.png` in the production UI directory.
  The initial mobile capture retained a desktop viewport and is excluded from
  evidence; the verified capture confirms a settled 390px viewport.
- No fresh password login was exercised for this release. The signed-in
  account had no saved filters, so live restoration was not exercised; isolated
  database UI tests cover restoration. No application-data writes, auth/schema
  changes, remote migrations, Safari, physical-device or load tests. Recovery
  deployment: `dpl_xXNKf2hDWCYGu8e3TktWCQHSnLTJ` (runtime `922e28a`).

Shared operational-card alignment production release (2026-09-06):

- Released runtime `922e28aef6e62f0a531ba47bda6efee80285d739` to
  `https://korattanphai.vercel.app`; pushed `fix/nr-map-zoom-performance`
  without merging `main`. Includes the preceding subdistrict-card colors.
  `DroughtOperationalSummary` reuses `MetricCard`; it and the existing native
  disclosure share a centered heading layout across applicable drought scopes.
  Short copy centers on both axes; long header descriptions can opt into start
  alignment, and expanded prose stays start-aligned. Counts, unavailable states,
  navigation, keyboard toggling and focus behavior are unchanged.
- Local gate: 151 unit tests passed, reusing the current-source build and eight
  targeted browser checks plus desktop/tablet/mobile visual geometry evidence.
  Exact-runtime Quality Gate `34034466561` passed: 151 unit tests, isolated
  database checks, 86 built-browser checks (10 conditional skips), four database
  UI checks, both protected builds, exposure/bundle guards and no generated-data
  drift. The existing Vite chunk-size advisory remains; bundle budgets pass.
- Deployment `dpl_xXNKf2hDWCYGu8e3TktWCQHSnLTJ` came from a clean detached
  checkout (226 uploaded source files), was verified as a production-config
  candidate, then promoted unchanged. Deployment URL:
  `https://korattanphai-pa5asyxg9-purichwc-1517s-projects.vercel.app`.
  Public entry `index-d3fcf64c1c.js`, main CSS `index-DgUoUktb.css`, loading CSS
  `AuthenticatedApp-Ca5_jlRf.css` and `data-backend.json` returned HTTP 200.
  The backend marker is Supabase; no static forecast archive assets were emitted.
- Fresh real-account candidate and public smoke each passed 20 checks across
  five desktop/mobile routes, irrigation filters/reset/reload and saved-workspace
  reads. The actual full/T+1 RPC payloads match the canonical Excel archive;
  map colors/counts match source, and there is no static fallback. Each run
  recorded 30 successful RPC/workspace reads and no browser errors. Additional
  deployed assertions verified centered card copy, Enter/Space toggling,
  retained focus/URL and start-aligned expanded guidance. Desktop/mobile and
  expanded-guidance screenshots were visually inspected.
- Evidence: `tmp-snapshots/operational-cards-centered-20260906/`,
  `smoke-results/operational-cards-candidate-verified-20260906/`
  (2026-09-06T12:56:55.246Z) and
  `smoke-results/operational-cards-production-20260906/`
  (2026-09-06T13:06:24.339Z). Initial temporary diagnostics needed correction:
  the desktop wrapper uses `display: contents`, so screenshot crops use its
  visible children; the backend marker key is `backend`, not `provider`.
  Both probes passed after matching the existing contracts, with no app edits
  or weakened behavior assertions. The first candidate report is retained.
- No auth settings, schema, migrations or application-data writes. No Safari,
  physical-device or load tests; full local E2E was not duplicated because CI
  covered the exact runtime. Recovery artifact:
  `dpl_3QjrznVqYQFLRTEWHpoxujhJTJH7`.

Subdistrict forecast-card colors production release (2026-09-06):

- Released runtime `dfc25ee0f0ac5889e6f1e0741fc583f317e04c02` to
  `https://korattanphai.vercel.app`; pushed `fix/nr-map-zoom-performance`
  without merging `main`. The single subdistrict forecast card now uses
  green/amber/red surfaces for no-risk/moderate/high, neutral gray for
  out-of-scope, and a dashed neutral border for missing records. Status text,
  icons and provenance remain explicit; aggregate cards are unchanged.
- Local gate: 147 unit tests, protected build/typecheck/exposure/bundle guards,
  unchanged generated data, and 12 built drought-workspace browser checks
  passed. Earlier targeted visual checks covered all five states and mobile.
  Exact-runtime Quality Gate `34033707957` passed: 147 unit tests, isolated
  database checks, 86 built-browser checks (10 conditional skips), four
  database UI checks and both protected builds.
- Deployment `dpl_3QjrznVqYQFLRTEWHpoxujhJTJH7` was built from a clean
  detached checkout (226 uploaded source files), checked as a production-config
  candidate, then promoted unchanged. Candidate/public checks confirmed
  the expected CSS palette, headers, geodata, read-only API and Supabase mode.
  Public entry: `index-328ce87869.js`; main CSS: `index-dne0t-rj.css`;
  authenticated app: `AuthenticatedApp-b4d0d1bb7b.js`. No static forecast
  archive assets were emitted.
- Fresh public UI inspection used the existing authenticated Chrome session
  in a separate tab: desktop 1440x960 showed the high-risk red card; selecting
  T+1 changed the status to moderate, and mobile 390x844 showed the amber card
  fitting the page. Screenshots were inspected in the task, and captured browser
  error logs were empty. The existing user tab/session was preserved and the
  temporary viewport was reset. The browser tool's computed-style selector
  reads timed out after reload, so deployed visual proof uses its successful
  native screenshots/AX reads plus the exact served CSS; local computed-style
  checks remain in the five-state evidence.
- Evidence: `tmp-snapshots/subdistrict-forecast-colors-20260906/`,
  `tmp-snapshots/release-forecast-colors-e2e-20260906/`,
  `smoke-results/forecast-colors-candidate-20260906/report.json` and
  `smoke-results/forecast-colors-production-20260906/assets-report.json`.
  The full fresh-login smoke harness was not rerun: this task had no supplied
  smoke password, so public UI verification used the existing logged-in browser.
  No auth settings, schema, data writes, physical-device or Safari tests.
- Recovery artifact: `dpl_ANiaDLyVAHN3LNnsvsyTEBfRgHMQ`. New concurrent
  local edits appeared after the release checkout was frozen; they were left
  intact and are not included in runtime `dfc25ee` or this release evidence.

Combined loading and compact UI production release (2026-09-06):

- Released runtime `cf522816bfd49309ea03792f7c51a30c1e16377c`, including all
  work confirmed at the task 2/3/4 release freeze: equal map dropdowns, shared
  route-aware loading/error UI, smaller T+ labels, and removal of subdistrict
  supporting-data readiness. Pushed `fix/nr-map-zoom-performance`; no main merge.
- Quality Gate `34032847073` passed for that exact commit: 147 unit tests,
  isolated database tests, 86 built-browser checks (10 conditional skips), 4
  database UI checks, both protected builds, exposure/bundle guards and no
  generated-data drift.
- Built from a clean detached checkout (226 source files, no local artifacts
  or credentials uploaded). Production-config candidate
  `dpl_ANiaDLyVAHN3LNnsvsyTEBfRgHMQ` was verified before promoting the same
  artifact to `https://korattanphai.vercel.app`. Deployment URL:
  `https://korattanphai-l663tcia8-purichwc-1517s-projects.vercel.app`.
  Public entry `index-0a68bf2664.js`, main CSS `index-rNBiO4qe.css`, loading
  CSS `AuthenticatedApp-Ca5_jlRf.css`, and `data-backend.json` all returned
  HTTP 200 with the expected Supabase mode. No static forecast assets emitted.
- Real-account candidate and public production smoke passed 20 checks each:
  five routes on desktop/mobile, all source-matched map colors/counts, three
  irrigation categories, empty-filter/reset, saved-workspace reads, no static
  fallback, valid assets and no overflow. Each run recorded 30 successful
  RPC/personal-workspace reads and no browser errors. Held real RPC requests
  additionally verified the deployed Home desktop and drought mobile loading
  layout; actual T+ sizes and absent subdistrict readiness were asserted.
- Evidence: `smoke-results/combined-release-candidate-verified-20260906/`
  (2026-09-06T12:24:13.096Z) and
  `smoke-results/combined-release-production-20260906/`
  (2026-09-06T12:32:26.592Z). Screenshots were visually reviewed. The first
  candidate diagnostic attempt had a request-release race in temporary
  screenshot instrumentation; fixed its cleanup ordering before the successful
  rerun, without changing app code or smoke assertions.
- Read-only archive integrity evidence is recorded below. No auth settings,
  schema, migrations or application-data writes. Physical-device, Safari and
  load tests were not run. Recovery artifact:
  `dpl_4DWNAUdkYi6kCWyiBhsES4E5aubr`.
- A NEW task 4 request after the freeze added subdistrict forecast-card colors
  locally in `DroughtForecastWorkspace.tsx`, `drought-workspace.css`, and the
  corresponding `SHARED_COMPONENTS.md` entry. Its owner confirmed this later
  scope is complete locally but not committed/deployed. Those edits are
  preserved, intentionally excluded from this verified runtime and closeout
  commit; do not describe them as present in production.

Combined loading and compact UI release preparation (2026-09-06):

- The user authorized pushing/deploying all pending work from Korat tasks 2,
  3 and 4. Their owners confirmed the scope and stopped concurrent edits.
  Includes the already-deployed, unpushed `f9865d1` map dropdown change, the
  shared loading UI below, removal of supporting-data readiness only from the
  subdistrict view, and smaller T+ labels (14px desktop, 13px mobile). Loading
  labels now match those ready-state sizes. Shared readiness components and
  Home/province/district readiness remain intact.
- Local combined gate: 147 unit tests, protected static build/exposure/bundle
  checks, unchanged generated data, and 38 built desktop/mobile/tablet E2E
  scenarios passed. Evidence: `tmp-snapshots/combined-release-e2e-final-20260906/`.
  Initial run had 37 passes and a map-color assertion during the 140ms fill
  transition; trace confirmed the early read. The assertion now polls the
  same exact colors for every polygon; no expected values were relaxed.
- Read-only real-account verification at 2026-09-06T12:17:51.448Z confirmed
  the only published dataset, original/normalized/canonical hashes, exact T+1
  and T+1-T+6 RPC projections, all 220,218 source values and denied anonymous
  access. Evidence: `smoke-results/database-integrity/report.json`.
- No auth/schema/data writes or migrations. CI, candidate verification and
  production promotion remain pending at this preparation checkpoint. Previous
  good artifact: `dpl_4DWNAUdkYi6kCWyiBhsES4E5aubr`.

Shared forecast loading UI (2026-09-06, local work; not deployed):

- Home, province drought, district and subdistrict now compose
  `ForecastOverviewLoading` / `DroughtWorkspaceLoading` from
  `ForecastArchiveLoading.tsx`. Route identity/back navigation remain visible;
  neutral skeletons follow each route's desktop/mobile layout. Subdistrict has
  one status placeholder and no population chart or attention list.
- One accessible loading announcement, reduced-motion support, and shared
  compact failure/retry state replace the sparse full-page loading messages.
  No forecast values, risk colors, map geometry or selected-area assumptions are
  fabricated during loading. Auth, requests, caches, archive validation and
  Supabase/database data are unchanged.
- Verification: build, 31 focused unit tests (excluding ignored release
  checkouts), and 18 desktop/mobile loading E2E checks passed. Held/failed
  requests prove pending/ready/error/retry and leaving/returning while pending;
  retry preserves target/T+, and heading positions remain stable. Final images
  and capture context: `smoke-results/forecast-loading/`.
- No push/deploy, production data writes, full release suite, physical-device
  or load testing was requested for this UI pass. Local authenticated preview
  uses `http://127.0.0.1:5176`; the test-only server on port 5178 was stopped
  after verification.

Equal-width Home map dropdown follow-up (2026-09-06, deployed separately):

- Runtime `f9865d1` changes the shared single-filter map rail to equal `1fr`
  columns with its existing 32px reset column. This local commit is still ahead
  of the remote branch; the release owner deployed without pushing.
- Clean deployment `dpl_4DWNAUdkYi6kCWyiBhsES4E5aubr` is Ready on the public
  alias, with `index-eb04ae25bc.js` / `index-BVO-2F5g.css`. The loading UI above
  is not included. Candidate evidence:
  `smoke-results/equal-map-dropdowns-candidate-ready/report.json`.
- Targeted real-account checks passed default/unknown/rainfed on desktop and
  mobile: desktop fields both 331.421875x38px, mobile stacking preserved, no
  reset overlap or horizontal overflow, unchanged URL and no browser errors.
  The first attempt used a short 5s readiness assertion; the bounded 30s check
  passed with HTTP 200 RPC reads. This CSS-only release did not rerun the full
  archive/database suite or change Supabase. Recovery is the prior good
  `dpl_4h4XtWn25ATQWhVZ32cuoi4HR1aQ` artifact.

In-map irrigation controls production release (2026-09-06):

- Runtime `b4fcc194136e46a134e5d2de5fda77e7a6ccd184` is pushed to
  `fix/nr-map-zoom-performance`, without merging `main`. Shared irrigation
  controls now live inside the map on Home, province, district and subdistrict
  views. Selection filters the whole workspace without changing the URL or
  history length; reload, explicit area navigation and saved filters retain it.
  Map encoding uses blue/purple/gray for irrigation metadata, independently of
  the unchanged drought risk values and chart colors.
- Exact-commit Quality Gate `34022249917` passed: 139 unit tests, 10 isolated
  database checks, 76 built browser tests (10 conditional skips), four database
  UI tests, both protected builds, exposure/bundle checks and generated-data
  drift checks. The follow-up fixes an obsolete top-filter test selector and
  preserves mobile Home plot height after moving the controls into the map.
- Deployment `dpl_4h4XtWn25ATQWhVZ32cuoi4HR1aQ`
  (`https://korattanphai-imtjgzzqh-purichwc-1517s-projects.vercel.app`) was
  built from a clean detached checkout of that runtime with Production
  configuration. Candidate smoke passed before promoting the same artifact.
  The public alias confirms this Ready deployment, `/assets/index-7e6dd13fdd.js`
  and backend `supabase`.
- Real-account candidate and public production smoke both passed all 20 check
  entries across desktop/mobile: five base routes, exact irrigation source
  groups 20/97/172 and colors, whole-page risk counts, unchanged URL/history,
  reload, empty/reset, both actual archive RPC projections, saved reads,
  login/logout, assets/headers and no static fallback. Evidence:
  `smoke-results/irrigation-map-candidate-clean-verified/report.json` and
  `smoke-results/irrigation-map-production/report.json`; both have zero failures.
  Production evidence is dated 2026-09-06 09:49:45 UTC. All 30 tracked production
  RPC/saved requests finished HTTP 200, with no browser or visible UI errors.
  Fresh desktop/mobile production screenshots were inspected at scroll zero.
- Earlier candidate runs recorded saved-read/map-wait failures and intermittent
  `ERR_CONNECTION_CLOSED` from Supabase. Those reports remain preserved. A
  bounded Node/Chromium transport diagnostic subsequently returned the exact
  full archive, followed by passing full candidate and production runs. No
  assertions, timeouts or production settings were weakened to pass the gate.
- Release hygiene: do not deploy from a worktree containing ignored test
  artifacts. Earlier unpromoted candidates included them as private build
  source; filename inspection found no actual `.env` files. The promoted clean
  deployment contains no `tmp-snapshots`, `smoke-results`, test output or actual
  `.env` files in its uploaded source. Use a clean checkout for future releases.
- No archive, SQL migration, Auth, RLS, dependency or environment changes were
  made in this release; concurrent migration work was left intact. Recovery:
  promote previous good deployment `dpl_Eo1sitfh7j4nBT6AJvagFg1VJn9j`, leaving
  Supabase and personal records intact. Physical Safari, load/SLO testing and
  live personal-record writes were not run. Only documentation closeout follows
  the deployed runtime.

Irrigation status filter production release (2026-09-05):

- Runtime `bd3edcd96e1acc34ad8fd0201886cb8aae41635a` and test-only follow-up
  `7d0b69dca2c4c76c8690120b3bf50c6e30d3fc69` are pushed to
  `fix/nr-map-zoom-performance`, without merging `main`. Shared filters cover
  Home, province, district and subdistrict views; source counts are 20 irrigated,
  97 rain-fed and 172 unknown. Unknown irrigation is not missing forecast data.
- Migration `20260906010000` was applied after a dry run containing only that
  additive migration. History matches, the existing saved record defaults to
  `all`, and owner RLS remains enabled. No forecast import/publication or Auth,
  environment, policy or prediction changes were made.
- Quality Gate `33972914037` passed: 136 unit tests, 10 isolated database
  checks, 74 built browser tests (10 conditional skips), four database UI tests,
  both protected builds, exposure/bundle checks and no generated-data drift.
  The first run found an outdated three-dropdown assertion; the test-only
  follow-up checks four dropdowns and the new default. Its focused desktop and
  mobile regression also passed against the matching static-provider build.
- Deployment `dpl_Eo1sitfh7j4nBT6AJvagFg1VJn9j`
  (`https://korattanphai-g1471zzi1-purichwc-1517s-projects.vercel.app`) was
  built from the clean runtime commit with Production configuration. The
  follow-up changes only `e2e/app.spec.ts`; runtime, build configuration, smoke
  harness and source archive are identical. Candidate smoke passed and the
  same artifact was promoted without rebuilding. The production alias confirms
  this Ready deployment, `/assets/index-0e9ee1ef70.js` and backend `supabase`.
- Real-account candidate and production smoke passed five base routes plus all
  three irrigation groups and empty/reset behavior at 1440x960 and 390x844, including
  both exact source RPC projections, map codes/counts, login/logout, existing
  saved-filter reads, API/assets/headers and no overflow/static fallback.
  Evidence: `smoke-results/irrigation-candidate/report.json` and
  `smoke-results/irrigation-production/report.json`, both with zero failures.
  Desktop/mobile production screenshots were inspected with no observed
  toolbar, map-control or page overflow. An authenticated explicit
  `select('irrigation_criterion')` from PostgREST returned HTTP 200 with the
  existing record set to `all`, confirming the refreshed API schema.
- Read-only archive verification at 14:39 UTC confirms 220,218 unchanged cells,
  the pinned published version, both exact projections, anonymous access denied
  and digest `9352f69f7e86d1e8c549b03bc0b2e96ad1a46c7f3ef1ffa3bd09afd79175d01b`.
  Evidence: `smoke-results/database-integrity/report.json`.
- Recovery: promote `dpl_ALcUSdWNLxzaUKFp8ULLAR1mRA9L` and rerun smoke. Leave
  the additive column and personal records intact; old clients use `all`.
  No live personal-record writes, physical Safari or load/SLO tests are part
  of this release. See `IRRIGATION_FILTER.md` for the source and UI contracts.

Site-wide semantic UX production release (2026-09-05):

- Runtime `7d3bbfb2cd3f033287741b9b453c2b4f82b438da` is pushed to
  `fix/nr-map-zoom-performance`, without merging `main`. F01-F10 below are live.
- Exact-commit Quality Gate passed in 7m18s: 126 unit tests across 14 source
  files, 10 isolated database checks, 68 built browser tests (10 conditional
  skips), four separate database UI tests, both protected builds, exposure and
  bundle budgets, and unchanged generated data. CI:
  `https://github.com/purichw/korattanphai/actions/runs/33970845966`.
  The earlier local count of 228 also included 102 old tests from the ignored
  `tmp-snapshots/release-ui-cleanup-source` checkout; 126 is the release suite.
- Deployment `dpl_ALcUSdWNLxzaUKFp8ULLAR1mRA9L`
  (`https://korattanphai-10nrwwd3u-purichwc-1517s-projects.vercel.app`) was built
  from the clean runtime checkout using Production configuration. Candidate
  smoke passed before promotion; the same artifact was promoted without a
  rebuild. Inspection of `https://korattanphai.vercel.app` confirms this Ready
  deployment, `/assets/index-931658f70c.js` and backend `supabase`.
- Real-account candidate and production smoke passed all five routes at
  1440x960 and 390x844: Home, province, district, single high-risk tambon and
  all-null district. Both actual RPC projections exactly match canonical data;
  all 289 polygon risk classes match per route. Login/logout, saved-filter
  reads (including the prior test record), API, assets, cache/security headers,
  single full-width status, absent duplicate/demo panels, neutral unavailable
  graph and no horizontal overflow passed. Reports:
  `smoke-results/semantic-candidate/report.json` and
  `smoke-results/semantic-production/report.json` (zero failures).
- Fresh read-only API verification confirms one approved published dataset,
  source/normalized/canonical hashes, 220,218 unchanged cells and anonymous
  access denied. Ordered digest remains
  `9352f69f7e86d1e8c549b03bc0b2e96ad1a46c7f3ef1ffa3bd09afd79175d01b`.
  Evidence: `smoke-results/database-integrity/report.json` at 14:05 UTC.
  No database writes, imports, schema changes or external prediction sources.
- Production screenshots under `smoke-results/semantic-production/` were
  inspected. Additional in-app production checks confirmed one readiness
  status, no count gauge, map-mode roundtrip preserving T+4, and empty browser
  warning/error logs. Physical Safari and load/SLO testing were not run.
- Recovery: promote prior `dpl_yzioYF6cfvDjBN7dNkY4Rg3EyjHX` and rerun smoke;
  leave database data and configuration intact. No rollback was needed.
- Concurrent irrigation-filter work remains local and is not in this artifact.
  Only a documentation closeout commit follows the deployed runtime.

Site-wide semantic UX repair (2026-09-05, local/unreleased):

- Implemented F01-F10 from `SITEWIDE_SEMANTIC_AUDIT_2026-09-05.md`: unavailable
  forecasts no longer draw as zero-risk; coverage excludes null; chart copy
  describes fixed-target horizons and count-based references.
- Single-tambon shared variants show one forecast/evidence status, without
  population counts or self-links. Duplicate forecast details, empty historical
  analytics and unavailable area facts are hidden; designs remain in source.
- Readiness copy distinguishes supporting evidence from forecast quality;
  account menu hides demo personas/reset; Home area icons do not imply ranking.
- Canonical/generated archive data, Supabase schema/RLS and bookmarks contracts
  are unchanged. No push/deploy in this pass; production remains `ff01bd9`.
- Verification/remaining limitations are recorded in the audit closeout below
  its original findings. Local database-mode preview: `http://127.0.0.1:5176`.

Scoped archive and saved-workspace migration (2026-09-05):

- User authorized migration of only the approved Excel/normalized forecast
  archive and personal followed areas/saved filters, plus push/deploy and
  before/after data verification. No external data ingestion, ThaiWater,
  synthetic agriculture metrics, roles or notification workflows were added.
- Remote migrations `20260905110000` and `20260905124000` are applied, with
  matching migration history. The latter preserves publication/immutability
  guards while supporting the archive's explicit target-month convention;
  origin-based datasets retain their original six-horizon guard. Workbook time
  role remains unconfirmed, not retroactively asserted to be authoritative.
- Published version `drought-rev02-9b299cefc704` contains 220,218 source cells,
  762 runs, 127 target months and 289 locations. Counts are unchanged: 44,474
  no-risk, 27,670 moderate, 22,830 high and 125,244 explicit null/out-of-scope.
  Source workbook, normalized workbook, canonical JSON and generated projection
  hashes match the pinned inputs. Ordered remote prediction SHA-256:
  `9352f69f7e86d1e8c549b03bc0b2e96ad1a46c7f3ef1ffa3bd09afd79175d01b`.
  Import/publication evidence:
  `tmp-snapshots/archive-migration-eH6Tjy/verification.json`.
- Real authenticated API verification deep-compares both complete T+1 and
  T+1-T+6 RPC projections with source, confirms exactly one approved published
  dataset and denies anonymous reads. Archive tables deny browser writes;
  personal rows use owner-only RLS. Read-only real role/claim checks verified
  owner reads and cross-owner isolation. Evidence:
  `smoke-results/database-integrity/report.json`.
- Shared desktop/mobile bookmarks save area, target, horizon, dataset and map
  risk; restore works on the same pathname. Two smoke-account records remain:
  followed area Ban Kao (`300806`) and filter
  `ทดสอบ migration บ้านเก่า T+4`. They are personal records, not forecast data.
- Initial full CI rejected a URL-keyed workspace remount that closed the mobile
  filter sheet on keyboard selection. Runtime `ff01bd9f45f0c6e558620d904cd7e6dba853eba7`
  limits remounting to explicit saved-item restoration; the existing failing
  E2E test is unchanged and passed four focused desktop/mobile repetitions.
  Unit tests: 217 passed. Isolated PostgreSQL contract tests: 10 passed.
  Database-mode UI tests: four passed. Both static/database protected builds,
  exposure scans, bundle budgets and unchanged generated data passed locally.
- Runtime is pushed to `fix/nr-map-zoom-performance`, without merging `main`.
  Final full CI passed in 7m24s: unit/database tests, both UI suites, protected
  static/database builds, exposure/bundle checks and generated-data drift.
  Run: `https://github.com/purichw/korattanphai/actions/runs/33966743592`.
  Candidate `dpl_yzioYF6cfvDjBN7dNkY4Rg3EyjHX`
  (`https://korattanphai-lo1hs1kpa-purichwc-1517s-projects.vercel.app`) uses actual
  Production configuration and `VITE_DATA_BACKEND=supabase`. New database builds
  exclude both raw forecast assets and never fall back to static predictions.
- Candidate real-account smoke passed all four routes at 1440x960 and 390x844,
  with complete actual RPC/source comparisons and all 289 rendered map risk
  classes checked per route, saved-filter reads across fresh logins, no static
  fallback, login/logout, assets/API/security headers and no horizontal overflow.
  Evidence: `smoke-results/database-candidate-final/report.json`; screenshots
  were inspected. Hosted mobile keyboard selection keeps the filter sheet open;
  restoring the saved filter applies Dec-2025/T+4/high-risk correctly.
- After CI and candidate smoke passed, the candidate was promoted without
  rebuilding. Vercel inspection confirms `https://korattanphai.vercel.app`
  serves `dpl_yzioYF6cfvDjBN7dNkY4Rg3EyjHX`; `/data-backend.json` reports
  `supabase`. Production smoke then passed the same four routes at both sizes,
  actual full/T+1 RPC equality, all map risk classes, saved-record reads,
  login/logout, assets/API/cache/security headers and no browser errors or
  horizontal overflow. Evidence: `smoke-results/database-production/report.json`
  (zero failures), with inspected desktop/mobile screenshots. Production is
  complete; only the following documentation commit is newer than the artifact.
- Recovery: promote prior static-provider deployment
  `dpl_4SnrKbuepdKwJw7ZEZkAuzSUwgL3`
  (`https://korattanphai-qox5qsvrz-purichwc-1517s-projects.vercel.app`) and rerun
  smoke. Leave additive schema, immutable archive and personal records intact.
  No rollback performed. Older public archive asset URLs are not revoked.
  Real Safari, load/latency SLOs and unrelated operational-domain migrations
  are outside this release.

Combined UI cleanup production release (2026-09-05):

- User authorized push/deploy of completed work from both tasks, with care not
  to mix in the active Supabase migration. The migration owner confirmed no
  remote database mutations or runtime data-provider changes at this checkpoint.
  Migration files and subsequent runtime wiring remain local and outside this
  release. Forecast data still loads the static canonical archive; existing
  Supabase Auth is unchanged. No SQL/imports or remote settings were changed
  by this release.
- Includes district back navigation to `/drought` with target/T+ preserved,
  removal of the subdistrict-count chart only at subdistrict level, removal of
  source/limitations footer disclosures across all four page types, and the
  other task's accepted removal of synthetic Korat agriculture values while
  retaining their component design behind a REAL-only data gate.
- Local verification: 102 unit tests, normal/protected build, exposure and
  bundle-budget checks passed. Canonical archive and generated projections have
  no diff. The full built E2E run passed 64 tests with 6 existing skips; two
  drilldown cases still expected the removed subdistrict chart text. Their
  assertions now verify out-of-scope versus no-risk KPIs, and both desktop and
  mobile passed the focused rerun without runtime changes.
- Runtime commit: `089c0abca4b4e84d07e3a8392f9718346d9d4921`, pushed to
  `fix/nr-map-zoom-performance`; no merge into `main`. The full CI run for this
  exact commit passed 102 unit tests, protected build, exposure/bundle checks,
  generated-data drift and all 66 active E2E cases (6 existing skips):
  `https://github.com/purichw/korattanphai/actions/runs/33963294020`.
- Built from the clean detached checkout
  `tmp-snapshots/release-ui-cleanup-source`, with actual Vercel Production
  configuration and `--prod --skip-domain`. Candidate
  `dpl_4SnrKbuepdKwJw7ZEZkAuzSUwgL3`
  (`https://korattanphai-qox5qsvrz-purichwc-1517s-projects.vercel.app`) passed
  login-page, API, geometry and security-header checks before promotion.
  Vercel inspection confirms `https://korattanphai.vercel.app` now serves this
  Ready deployment; the browser loads `/assets/index-5c5e263482.js`.
- Production verification used an existing real authenticated Chrome session:
  home, province drought, two districts and a subdistrict load 289 polygons;
  source/limitations panels and synthetic agriculture numbers are absent.
  District back returns to `/drought`, subdistrict back returns to its district,
  and target `2025-12` / T+4 survive both actions. The subdistrict chart is
  absent and its map spans the full 1188px body; province/district charts remain.
  At the observed 1440x694 viewport, no horizontal overflow or broken visible
  images were found; browser warning/error logs were empty. Screenshots were
  inspected in the release task.
- Hosted routes, hashed JS/CSS, both forecast JSON assets, GeoJSON and API
  returned HTTP 200 with expected content types and cache policies; CSP and
  nosniff passed. Fresh credential login/logout and authenticated candidate
  smoke were not rerun: credentials were unavailable and Auth is unchanged.
  The browser viewport override did not take effect, so hosted mobile is not
  claimed; responsive coverage is the exact-commit desktop/mobile CI suite.
  Real Safari and Supabase database authorization checks are outside this UI
  release.
- Local evidence: `tmp-snapshots/release-ui-cleanup-build`,
  `tmp-snapshots/release-ui-cleanup-e2e`, and
  `tmp-snapshots/release-ui-cleanup-drilldown`.
- Recovery deployment captured before release: `dpl_BBDCsEEYmYdLAGnZRbBk2mEYsrS9`
  (`https://korattanphai-9anrsjid7-purichwc-1517s-projects.vercel.app`).
  No rollback performed. Keep the isolated checkout pinned; the primary working
  tree now contains the other task's in-progress Supabase provider/bookmark
  implementation. Do not deploy that working tree or change Production data
  flags until the separate migration approval and release gate are complete.

Combined Supabase Auth and UI production release (2026-09-05):

- Runtime commit: `15275fd2c0393fa8e50b933aafa0da1da44265be`, pushed to
  `fix/nr-map-zoom-performance`. Production was promoted to
  `dpl_BBDCsEEYmYdLAGnZRbBk2mEYsrS9` and verified through
  `https://korattanphai.vercel.app`; no merge into `main` was performed.
- Full CI for this runtime passed: 96 unit tests, protected build, exposure,
  bundle budgets, generated-data drift and 66 E2E tests with 6 existing skips.
  Run: `https://github.com/purichw/korattanphai/actions/runs/33957336832`.
- Real-account smoke passed on the protected candidate and then the public
  production alias: login/logout, refresh/navigation, four routes at desktop
  1440x960 and mobile 390x844, 289 polygons, forecast counts/context, API,
  asset/cache/security headers, visible images and no horizontal overflow.
  Evidence: `smoke-results/combined-auth-ui-candidate` and
  `smoke-results/combined-auth-ui-production`; both reports have zero failures.
- Vercel's Production URL variable incorrectly held the Supabase dashboard
  URL. Corrected only `VITE_SUPABASE_URL` to the project's HTTPS API origin;
  the existing publishable key was valid and unchanged. The first candidate
  build rejected the invalid URL before publishing; the retry passed.
- The user disabled self-signup. Read-only Auth settings verification returned
  `disable_signup: true` and email provider enabled. No tables, RLS, data,
  accounts or passwords were modified by the release.
- Protected-candidate smoke now accepts an authorized, host-scoped Vercel
  session in memory, with input validation, redirect rejection and redaction.
  It does not bypass Supabase login or persist either session/credentials.
  The follow-up changes only this harness and release documentation, not the
  runtime artifact already promoted. Two negative input-guard checks passed.
- Real Safari, SMTP/recovery and database/RLS authorization audits are outside
  this release. GitHub smoke-account secrets remain unconfigured; the real
  deployment smoke was run locally with session-only credentials.

Pre-release evidence and scope:

- The user now authorizes commit, push and production deployment of both
  tasks on `fix/nr-map-zoom-performance`. No merge into `main` or database
  mutation is implied. This supersedes the earlier local-only authorization.
- Includes the shared month-only options, unclipped map dropdowns, borderless
  map controls, compact fullscreen filters, centered horizon tabs, chart label
  spacing, formal stat descriptions and accepted duplicate-panel removal.
- Unit tests: 96 passed. Protected build, exposure scan, bundle budgets and
  generated-data drift check passed; production dependency audit found zero
  vulnerabilities. Build: `tmp-snapshots/release-combined-auth-ui`.
- Combined protected-build E2E: 65 passed, 6 existing skips, one mobile
  drilldown flow exceeded its 60-second test budget. The identical test/build
  passed two isolated runs (48.1s and 25.8s), without timeout or code changes.
  Evidence: `tmp-snapshots/release-combined-e2e` and
  `tmp-snapshots/release-drilldown-recheck`. This local run was not clean;
  the later complete CI run above passed all 66 active scenarios.
- Hosted real-account verification remains separate from local mock evidence.
- Vercel inspection found both Supabase variables in Production only, not
  Preview. Use `vercel --prod --skip-domain --yes` to prepare a candidate with
  actual configuration, verify it, then promote without rebuilding fixtures.
- Pre-release recovery: `dpl_DURL6bv3X7RmiPPcmCTPwVVSM127`, serving
  `https://korattanphai.vercel.app` before this release. No rollback performed.

Supabase Auth implementation details:

- Email/password login now uses the Supabase SDK, not demo usernames. Shared
  client configuration, session loading/refresh, stale-result guards, safe
  logout errors and internal-only return paths are covered by local tests.
- Account identity is the Supabase name/email; persona is display context only.
- Only the retired demo-login key is cleared. Static data remains public and
  no SQL, RLS or forecast provider is changed.
- Exact HTTPS Supabase origin added to CSP. Missing config denies entry;
  privileged keys fail the build. Production exposure checks remain active.
- Browser fixtures mock Supabase only on localhost. Real credentials are now
  required for deployment smoke; GitHub secrets are not set by this change.
- Local mocked auth checks do not verify the user's account, RLS or providers.
  `docs/AUTH_SETUP.md` contains the Preview checklist and SMTP recovery caveat.

Compact dashboard release checkpoint (2026-09-05):

- User authorized commit, push and production deployment of the Home v4 and
  shared compact drought/district/subdistrict work described below. Publish
  branch: `fix/nr-map-zoom-performance`; no merge into `main` is implied.
- Final release build: `tmp-snapshots/release-compact-20260905-build`.
  TypeScript, protected assets, exposure and bundle-budget checks passed.
  Its index and JS/CSS/JSON assets are byte-identical to the Home v4 build
  already inspected across desktop, tablet and mobile. Canonical source data,
  generated archive data and GeoJSON have no changes in this release.
- Final full protected-build E2E:56 passed,6 configured skips,0 failures in1.5m.
  Output: `tmp-snapshots/release-compact-20260905-e2e`. This supersedes the
  earlier combined-run evidence below. Unit/data evidence:63 passed on the
  same source/dependencies. Existing large-chunk warning remains non-fatal.
- Production target: `https://korattanphai.vercel.app`. After publication, run
  the read-only smoke harness with output at
  `smoke-results/release-compact-20260905`; local build results alone are not
  evidence that the production alias has been updated.
- Pre-release production recovery deployment: `dpl_Ddjv9NnwyRsXoUFFhuAHvDAfmVrs`
  (`https://korattanphai-o2ajhjjmi-purichwc-1517s-projects.vercel.app`, Ready
  before this release). Previous source: `2117253ce3a49c8bb2805c93f83d89190c0db1f6`.
  Recovery would promote that deployment and rerun production smoke; no
  rollback is requested or performed. Earlier parked water/history removals
  remain intentional and unchanged.
- Real Safari and new network benchmarks are outside this release pass.

Home Overview v4 (2026-09-05, local; not pushed/deployed):

- `/` now follows the supplied v4 interaction documents and three image
  references: compact filters, a passive situation strip, aligned map/risk panel,
  three high-risk area links, agriculture/readiness disclosures and archive link.
  Mobile shows counts before the map, then area links and expandable details.
- Reuses `OperationalFilters`/`AppSelect`, `MetricGrid`/`MetricCard`, the existing
  agriculture/readiness panels and the shared SVG map. New `DashboardDetailPanel`
  separates its explicit disclosure button from passive preview statistics.
  Opt-in Home variants leave drought/district/subdistrict defaults intact.
- Short stats/dropdown values remain centered; long descriptions remain left
  aligned. All high-risk areas are reachable in-place, with context-preserving
  drilldown. Readiness switches the same map instance and has a return action.
- Real T+1 archive target/issue dates, risk semantics, provenance and no-data
  behavior are preserved. No live timestamp, district rai, model confidence or
  ThaiWater data was invented/restored. Agriculture has separate province-wide
  scope and provenance. The Home loader still avoids the full forecast archive.
- Unit/data tests:63 passed. Full protected-build E2E:53 passed,3 failed,6 skips;
  obsolete filter assertions and a test hydration race were corrected. Final
  focused protected-build rerun:25 passed,1 skip. All56 active scenarios passed
  across the full run and focused rerun, not one final full-suite execution.
- Final build: `tmp-snapshots/home-v4-verified-build`. TypeScript, exposure,
  bundle/reference checks and canonical archive identity passed. Startup107,787
  gzip bytes; the existing large-chunk warning remains.
- Screenshots/metrics: `tmp-snapshots/home-v4-accepted-3eatug`. Desktop, reference
  tablet, both tablet orientations and mobile have no horizontal overflow, with
  fonts/logo loaded and no page errors or HTTP4xx/5xx responses. Fullscreen and
  disclosure states were also checked. Desktop height1476 ->1002px; mobile
  height2399 ->1799px, through disclosure rather than information removal.
- See `HOME_OVERVIEW_PARITY.md` for reference identities, measured landmarks,
  visual exceptions, comparison provenance and exact verification scope. Real
  Safari, production and new network benchmarks were intentionally not run.

Compact drought operational workspace (2026-09-05, local; not pushed/deployed):

- `/drought`, district and subdistrict routes share one compact forecast
  composition, header, real forecast filters and expandable operational details.
  The retired historical-month filter is no longer the primary page filter.
- Short stat labels/values and dropdown values center. Main statistics reuse
  `MetricGrid`/`MetricCard`; all dropdowns reuse `AppSelect`. Mobile shows every
  risk count without horizontal scrolling, then coverage, chart and map.
- Desktop map/chart align, with full-width statistics below. Sources, limitations,
  agriculture, historical evidence and readiness remain accessible. Empty
  historical data is unavailable, not a reassuring zero-count state.
- Area navigation now carries target/horizon. Readiness switches the existing
  map instance and provides a return action. Compact camera fitting respects the
  global maximum zoom and keeps the selected subdistrict inside the viewport.
- Canonical forecast/geodata bytes and root T+1 overview behavior are unchanged.
  No ThaiWater or invented low-risk data was restored. Reference decisions and
  visual exceptions: `DROUGHT_WORKSPACE_PARITY.md`.
- Verification: 60 unit/data tests passed. The full protected-build E2E run
  passed 48 scenarios, failed one compact-map popup containment scenario and
  retained five existing skips. After fixing popup bounds, the final targeted
  run passed all 10 scenarios (popup actions, shared compact routes and dropdown
  wheel isolation). All 49 active scenarios therefore passed across the full
  run and focused rerun, not in one final full-suite run.
- Final protected build passed TypeScript, exposure, bundle/reference checks and
  canonical archive byte identity. Output: `tmp-snapshots/drought-parity-closeout-build`.
  Startup is 107,905 gzip bytes; the existing large-chunk warning remains.
- Current screenshots and `metrics.json`:
  `tmp-snapshots/drought-parity-accepted-wLeXFO`. All nine captures loaded the
  font, had no horizontal page overflow, and measured centered KPI labels/values.
  Capture recorded no page errors or HTTP 4xx/5xx responses. Fullscreen entered
  and exited successfully with a visible 1,002px-high SVG.
- At 1586x992 the province page is 1,022px tall (previously 1,684px); at 390x844
  it is 2,096px (previously 2,885px). District/subdistrict mobile heights fell
  from 6,438/4,846px to 2,077/2,137px through disclosure, not data removal.
- Chromium desktop/mobile and both tablet orientations were checked. Real
  Safari, production and a new network benchmark were intentionally skipped.
  Earlier deployment checkpoints below do not mean this local UI was deployed.

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
- Supabase real-account login/logout and closed self-signup are verified.
  User-reported tables/RLS remain unaudited. No database data provider,
  notification delivery or live data ingestion is implemented.
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
