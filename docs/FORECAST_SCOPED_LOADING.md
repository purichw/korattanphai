# Scoped Forecast Loading

## Scope And Release State

This follow-up changes forecast reads and per-account memory caching, not
forecast values, normalization, geometry, risk calculations or personal rows.
Migration `20260907040000_scoped_forecast_reads.sql` is applied to the hosted
project; frontend deployment is pending release verification. The original
workbook/lineage contract remains documented in
[DROUGHT_REV03_CUTOVER.md](DROUGHT_REV03_CUTOVER.md).

## Read Contract

Database mode calls two authenticated, security-invoker RPCs:

1. `ktp_latest_forecast_revision()` discovers the newest published,
   confirmed-origin, source-traceable rev03-family dataset. Drafts, the old
   unconfirmed-origin dataset and other source families are not eligible.
2. `ktp_load_forecast_slice(version, origin, area, horizonCount)` reads only
   the selected source month and administrative codes. Existing indexed keys
   select the values; no risk is inferred from missing rows or null cells.

| View | Scope | Risk cells per response |
| --- | --- | ---: |
| Home overview | Province, selected T, T+1 | 289 |
| Province drought | Province, selected T, T+1 through T+6 | 1,734 |
| District drought | Only that district, selected T, T+1 through T+6 | 6 x its tambons |
| Tambon drought | Only that tambon, selected T, T+1 through T+6 | 6 |

The month catalog retains dates/labels for the dropdown and horizons but does
not include unrequested historic risk arrays or aggregate counts. The full
dataset metadata remains provenance metadata; `loadedSelection` identifies
the response scope. Components compute displayed results from that scope.
Province still receives all 289 tambons because its existing map, summaries
and drill-down lists require them. Geometry loading is unchanged.

## Cache And Freshness

- Caches are memory-only, per Auth user and horizon mode, capped at 16 slices.
  Logout/account changes abort requests and clear them. No protected prediction
  cache is written to localStorage or another persistent browser store.
- Every `load()` checks the server's published revision before reusing a slice.
  A cached province/district slice can be projected into a smaller child scope
  for the same month without another values RPC.
- An open, visible page checks every 60 seconds, on window focus and on return
  from a hidden tab. Routine checks run quietly without changing page layout.
- A changed dataset ID/version/source SHA invalidates prior slices. Only the
  currently requested scope/month is refetched; other slices reload on demand.
  Unchanged revisions do not refetch values. There is no row-delta endpoint.
- Published datasets are immutable. Future imports must create and validate a
  new dataset, maintain the source/normalization manifest and publish it through
  existing guarded procedures. Direct edits to published rows are prohibited.
  Newly published source months can enter the dropdown without a frontend
  date-range release, within the same 289-code source contract.
- Failed revision/value checks do not silently use static files or call cache
  fresh. A previously verified view stays visible with an error and retry.
  First-load failure uses the existing error/loading surface.
- Changing month keeps the previous verified month, map and counts together
  with a loading notice until validation succeeds. Late responses cannot
  replace the user's newer selection. Changing T+ needs no additional values
  request because all six horizons for that month are already present.
- Saved filters capture the displayed dataset identity. Restoring a filter
  keeps its source month/area/horizon selection but reads the latest approved
  publication, not a permanently frozen old dataset.

## Owners And Verification

- `src/data/supabaseForecastArchive.ts`: revision validation, authenticated
  RPCs, source/scope validation, bounded cache and stale-response guards.
- `src/data/forecastScope.ts`: canonical-code projection for reusable slices.
- `src/useForecastArchive.ts`: selected-query lifecycle and foreground checks.
- `src/components/ForecastArchiveRequest.tsx`: shared selection context and
  loading/error feedback for Home and province/district/tambon workspaces.
- `forecastModel.ts`: commits month/URL only after a validated response; keeps
  an already-valid initial URL unchanged. Risk formulas are not part of this
  loading change.

Local checks use isolated fixtures/database instances, never the hosted DB:

```bash
npm run test:database
DATABASE_TEST_PORT=5197 npm run test:e2e:database
npx vitest run tests/databaseArchive.test.ts tests/savedWorkspaces.test.ts tests/forecastArchive.test.ts --exclude 'tmp-snapshots/**' --exclude 'artifacts/**'
```

SQL parity covers all 127 months in full/T+1 mode, all 32 districts and 289
tambons for the latest month, and verifies that all 220,218 original stored
values/lineage are unchanged. RLS, unpublished isolation and owner-only personal
records remain tested. Browser checks cover source-backed map colors/counts,
month changes, stale responses, retries, bookmarks and publication refresh on
desktop/mobile. New publication scenarios use clearly test-only fixtures.

Verified on 2026-09-07: 11 isolated SQL/integrity/RLS checks, 56 targeted unit
tests and 22 desktop/mobile database browser scenarios passed. The protected
Supabase-mode build passed typecheck, exposure and bundle-budget checks and
emitted no raw forecast archive assets. The existing large-chunk advisory
remains; this work reduces data reads rather than redesigning code splitting.
Canonical, generated forecast, normalized and geometry files have no diff.
Route-query lifecycle tests additionally verify that a reused workspace reads
the new route's source month/default and does not carry a disabled loader's
failure into Home. The affected ten browser navigation/month/bookmark scenarios
were rerun after this guard, along with the protected build.

The browser cases retain screenshots under `test-results/forecast-scoped-*`,
including source-backed month transitions that keep the prior verified view
visible. These are local fixture-backed checks, not hosted latency evidence.

Keep the old full-archive RPC and immutable datasets for older clients and
integrity tools. The user authorized migration and subsequently push/deploy on
2026-09-07. Supabase migration history confirms `20260907040000` is applied;
it was not rerun after the interrupted CLI session.

## Hosted Migration Verification

- Project: `dihchjflzhcekywarhxd`; migration file SHA-256:
  `f282b477a074682e4a5e2d6881baecd06b4ddfdc5809051d280a4aa562355cc9`.
- Authenticated full/T+1 legacy RPCs still exactly match the canonical archive.
- Revision discovery selects the audited rev03 dataset. Nine real scoped RPC
  projections match the source: first/latest months, province/Home, district,
  tambon and both corrected Nong Rawiang source mappings.
- New functions remain stable security-invoker functions with authenticated
  execute only. Real anonymous calls are denied for both new RPCs.
- Before/after total forecast rows remain 440,436, including the retained older
  dataset for compatibility; active rev03 remains 220,218 source-backed rows.
  The legacy function definition hash and personal row counts/hashes match.
  No personal contents were exported.
- One real-account observation: old full RPC 2,731 ms; scoped province 526 ms,
  district 380 ms, single tambon 308 ms. These exclude the revision check and
  are individual API observations, not page-load benchmarks or an SLO.
- Evidence: `tmp-snapshots/scoped-migration-20260907/`, including
  `authenticated/report.json`; pre-migration source audit:
  `tmp-snapshots/archive-migration-Xvt4vt/verification.json`.

Frontend candidate/production verification remains separate from successful
database migration. Recovery can keep this additive migration and promote the
previous frontend, because the old RPC and immutable data remain available.
