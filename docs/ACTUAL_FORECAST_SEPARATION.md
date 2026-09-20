# Actual / Forecast Separation

Local implementation, 2026-09-20. Not a production release or an actual-feed activation.
Authority: `Korat_Tan_Phai_Actual_vs_Forecast_Codex_Handoff_v1.md` supplied by the owner.
The owner's rev03 definitions override the handoff's incidental older-revision reference.

## Evidence And Source Gaps

| Source | Evidence in this repository | Primary actual eligibility |
| --- | --- | --- |
| `drought_forecast_archive_rev03.json` | Source month is origin T; 0/1/2 are predictions, null is explicit out-of-study scope. Last origin 2025-12, targets through 2026-06. | Not actual. Preserve the complete archive. |
| `normalized_research_monthly_panel.json` | Empty periods; live period/packed-row counts zero; cleared-for-refresh status. | No observations available. |
| `normalized_research_panel_summary.json` | Normalized row count zero; province/district/tambon arrays empty. | No published actual catalog. |
| `rainfall_observations_24h.json` | Zero confirmed tambon observations. | Not a drought assessment source. |
| `rainfall_monthly_history.json` | Regional context, no tambon monthly totals. | Never distribute regional observations to tambons. |
| `opsmoac_monthly_reports.json` | Province-level document index; parsing and geographic/crop normalization pending. | An indexed report is not a normalized eligible observation. |
| Model-input API / proposed V2 pipeline | Input integration and design contracts, not a configured published drought-actual feed. | Not activated by this work. |

These canonical files are under `src/data/canonical/nakhon_ratchasima/`.
No external collection, database migration, permissions, scheduler, or production
configuration was changed. Removed readiness/synthetic features were not restored.

## Ownership Map

| Owner | Boundary |
| --- | --- |
| `src/operationalLocation.ts` | Valid-month versus explicit archive URL intent; legacy T+h projection. |
| `src/data/operationalPolicy.mjs` | Shared server/client policy version and Bangkok calendar classification. |
| `api/operational-context.js`, `server/operations/operational-context.mjs` | Validated no-store clock/catalog metadata, not observation ingestion. |
| `src/useOperationalContext.ts` | Request lifecycle, stale-response isolation, boundary/focus revalidation. |
| `src/operationalData.ts` | Future-adapter eligibility/revision contracts; no scoring or live transport. |
| `src/components/NakhonRatchasimaWorkspace.tsx` | Intent branch before mounting the appropriate workspace/loader. |
| `src/components/nakhon-ratchasima/OperationalDroughtWorkspace.tsx` | Shared operational composition; scoped styles in `src/operational-workspace.css`. |
| `src/components/nakhon-ratchasima/NakhonRatchasimaLocalMap.tsx` | Existing camera/geometry/preview renderer with a neutral unavailable variant. |
| `src/savedWorkspaceRoutes.ts`, `src/components/WorkspaceBookmarks.tsx` | Independent geographic following and exact archive-filter restoration. |

Navigation: [App map](APP_MAP.md), [architecture](ARCHITECTURE.md),
[interactions](INTERACTION_MAP.md), [shared components](SHARED_COMPONENTS.md).
Read [release gates](RELEASE_RUNBOOK.md#actual--forecast-release-scope) before
shipping this work; updating these docs does not authorize a deployment.

## Runtime Contract

- `GET /api/operational-context` supplies server time, Asia/Bangkok month boundary,
  policy version and source-availability metadata. It contains no protected records.
- With no actual catalog, a bare operational route selects the server's current month.
  No browser-clock or archive-latest fallback is used. A failed clock request is an
  error, not a confirmed empty dataset.
- `period=YYYY-MM` is the **valid/data month**. Past/current means actual family;
  future means forecast family. Current actual is partial-period, not a completed month.
- Empty source catalogs remain empty. The browser validates this integration-gap
  contract and fails closed if a newer feed/contract appears without its reviewed adapter.
  It does not pretend that an unimplemented observation transport is live.
- The browser uses no persistent operational cache. Requests use `no-store`, abort
  on context departure and ignore late responses. Request generation, scope, and
  period key the result. Focus, visibility and a 60-second check revalidate; the
  next Bangkok boundary schedules a check. Account changes unmount this context.
- Map, heading, status, geographic denominator and source disclosure receive the
  same context. Pending/error periods do not retain risk values from a former context.
- `operationalData.ts` contains the integration resolver contract and eligibility
  tests for future real adapters. It is not a claim of completed ingestion. It keeps
  actual/forecast families, review, coverage, publication, scope, source revision,
  and request failures separate. Explicit supersession prevents revival of a
  withdrawn replacement; ambiguous duplicates are excluded, never max/voted.
- Eligible forecasts require exact target/horizon/product/run identity, verified
  origin basis, approved publication/freshness policy IDs and explicit expiry.
  Rev03 does not supply proof of historical first-publication timing; no such proof
  is inferred from dataset upload time. Reforecasts are not operational issued runs.
- `comparableActual` only determines whether a matching protocol could be applied;
  it never computes accuracy. Scoring and complete-period comparison protocols remain
  unconfigured. No forecast archive record is edited when actual differs.

## Routes And Shared UI

`/`, `/drought`, district and tambon routes use the same
`OperationalDroughtWorkspace` in operational intent. It composes existing
`MonthSelect`, `AppSelect`, `MetricGrid`, `DroughtOperationalDisclosure` and
`NakhonRatchasimaLocalMap`. Tambon has no added bar chart.
The legacy `OperationalFilters` composition hardcodes rice/source-month semantics;
the new composition reuses its underlying shared controls without carrying those
forecast-specific assumptions into actual. No second select or map engine is added.

The visible selector offers current-minus-24 through current-plus-6 months;
this is a control range, not source coverage. A valid direct URL outside that range
is retained and added to the options. There is one primary month owner, no actual
T+ controls, no duplicated map month selector and no zero-risk fabricated KPI.
Map unavailable is neutral grey, distinct from forecast green and outside-study hatch.
The existing zoom, pan, fullscreen and area-preview renderer is reused. Changing
primary period/family does not remount the map; geographic navigation can refit it.

`operationalUnavailable` is a deliberately narrow shared-map variant. It overrides
old readiness/research fallbacks, legends and preview semantics. It is **not** an
available-actual renderer. Approved actual metric/classification metadata and its
renderer/aggregation policy must be implemented before exposing actual values.

Archive rules:

- Explicit `mapLayer=forecast-archive&target=T&horizon=h` retains archive intent.
- Legacy `target` continues to mean **origin**, never target/valid month.
- A legacy link without explicit archive intent resolves valid month `T+h` and
  canonicalizes to `period`; it cannot silently force historical forecast as actual.
- Explicit T+2..T+6 on the overview URL uses the existing full six-horizon workspace,
  not the overview's T+1-only payload. Missing origins and invalid horizons do not
  fall back to latest/T+1. The user can explicitly choose another archive period.
- Existing Supabase Auth/RLS and archive access are unchanged. No staff-only policy
  was introduced. Publication of an operational run is distinct from archive access.
- Archive retains issue-centric six-target charts, filters, analysis, irrigation,
  exports and original risk calculations. The horizon strip is the interaction owner;
  the duplicate page horizon dropdown and map month selector are removed.
- `FORECAST_ARCHIVE` provenance labels say predictions, not actual observations.
- Search retains operational valid month when selecting another area. The dedicated
  forecast-search result explicitly enters the archive. Area bookmarks remain area
  bookmarks; existing saved forecast filters continue to express archive intent.
  The shared bookmark dialog can follow an actual area without a forecast selection.
  Actual periods cannot be saved as forecast filters. Overview T+2..T+6 bookmarks
  use the existing drought-view storage contract and retain the exact horizon;
  no schema or permissions change is needed.
- Excel remains forecast-archive export, explicitly titled accordingly; Cordia and
  the workbook data are unchanged. No actual export/print dataset or unsupported
  accuracy export is invented. Operational printing retains period and unavailable
  labels. No source data or permission is embedded in the clock API.

## Initial Local Validation

Executed locally using authenticated test fixtures, never live writes:

- Vitest: 313 tests passed, including 35 domain/calendar/URL cases and 3 context-hook
  tests for stale response, boundary re-resolution and retry.
- Node operational-context API tests: 3 passed (server cutoff, query rejection,
  no-store metadata, no records, method validation).
- Playwright separation suite: 9 passed on desktop 1440x960, mobile 390x844 and a
  768x1024 tablet case (one duplicate tablet case intentionally skipped on mobile).
  Samples: overview/province; Wang Nam Khiao and Phimai; tambons 302503 and 301503.
  Tested empty actual without forecast RPC, date changes, legacy T+h, back/forward,
  retained map instance and zoom transform, error/retry, explicit archive T+6,
  legacy district scope and nonexistent archive month. Targeted bookmark recheck
  also verifies actual-area following controls and Escape on desktop/mobile.
- Screenshots: `artifacts/actual-forecast-{desktop,mobile}.png` and
  `artifacts/archive-preserved-{desktop,mobile}.png`; local test-account/source-fixture
  evidence, not a deployed-production snapshot.
- TypeScript/Vite build and protected-source exposure checks passed. At that
  checkpoint the protected build was **not release-ready**: the gate reported 3,502,667
  raw / 381,459 gzip bytes against 3,500,000 / 375,000. This is the combined dirty
  workspace measurement, not an attribution of every byte to this change. Limits
  were not raised for this work. The reduction was completed in the subsequent
  authorized release pass below.

The safety separation and unavailable paths are implemented. **Actual ingestion,
actual category rendering, actual aggregation/history, and operational forecast
publication are not ready** until source ownership, transport, metric definition,
canonical geography/version, review/publication policy, and temporal proof are supplied.
This is an explicit source gap, not a completed live actual feature.

### Authorized Release Verification

The owner subsequently requested push/deploy for this task. Scope excludes the
uncommitted API UAT/research work. No database migration or feed activation is included.
The protected build now uses the supported `mangled-shuffled` identifier generator,
retaining the existing string protection and exposure checks. The measured database
core was 321,374 gzip bytes and the static/telemetry core was 322,272 gzip bytes;
both passed the unchanged gates. The isolated Node 24 candidate passed at 321,254
gzip bytes; the hosted production-config build passed at 321,139 gzip bytes.
Archive browser tests now enter explicit archive URLs and primary navigation has
its own clock/unavailable/legacy-link coverage. Release-pass local checks passed
314 unit tests, 104 model-input tests, 12 operations tests and 11 local database
integrity/RLS checks. No remote database was migrated or written.

Candidate `dpl_5v26dDKrV3zMCJzr99rCNJJd4tTW` and the promoted production alias each
passed 39 real-account read-only checks at 1440x960 and 390x844. Evidence:
`artifacts/separation-release/{candidate,production}/report.json` and associated
screenshots/downloads. Checks cover server time/no-store policy, actual
unavailable at three geographic levels without forecast RPC, scoped archive RPC
parity and map colors, both graph units, irrigation filters/empty reset, saved
workspace reads, logout, assets and security headers. Downloaded Excel workbooks
verify 1,734 province and 36 district values, district summaries, native charts
and PivotTables. This proves the archive, not a live actual feed.

Runtime `8357b02` and test-only follow-up `d2b7695` are pushed. All five jobs in
[Quality Gate](https://github.com/purichw/korattanphai/actions/runs/35508515552)
passed before promotion: browser compatibility, contracts, database browser,
protected built browser and regression. The primary URL resolves to the same Ready
candidate, not a rebuild. See the latest handoff for counts and recovery policy.
Actual-feed UAT remains out of scope because no eligible source is connected.
Shared dropdown regression
checks additionally cover mobile menu bounds and subdistrict filter grids after
removal of duplicate temporal controls.

Rollback must not restore forecast-as-actual. Keep separation and show unavailable
if an adapter fails. Archive access can remain available under its existing policy.
