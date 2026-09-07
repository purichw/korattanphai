# Rev03 Forecast Cutover

The subsequent, deployed read/cache optimization is documented in
[FORECAST_SCOPED_LOADING.md](FORECAST_SCOPED_LOADING.md). It leaves this source
and normalization contract unchanged.

## Scope

Forecast data and its ingestion, projection, validation and regression tests
only. No UI layout/style, administrative geometry, account, followed-area or
saved-filter row changes. Existing unrelated working-tree UI changes remain
owned by their original work.

The only prediction and irrigation source is `Drought_T1-6_rev03.xlsx`, sheet
`Master_Data_Drought_Final`, SHA-256
`a3be44486c8e8039f5744674e261ee9b27306f0c78b46bd1ce62e8903d4915b4`.

## Interpretation

- Workbook Year/Month is origin T. Actual target is T plus 1-6 calendar months.
- 0: no risk signal; 1: moderate risk; 2: high risk; blank: out of study scope.
- Missing joined records are not blank cells and must not be colored green.
- Irrigation is a separate source attribute, never a derived risk category.
- The new SQL stores `origin_period = source_year_month` and the generated
  `target_period = origin_period + horizon`.
- Existing UI/URL keys named `target`, `targetMonths`, `packedRiskByTargetMonth`
  still identify T. They are compatibility names, not target-date calculations.

## Mapping And Traceability

Normalized source fields are immutable and unchanged. The runtime adapter joins
source district/tambon names to the existing administrative master/GeoJSON,
validates one-to-one coverage of all 289 codes, then uses codes at runtime.
This adds geography only; it does not introduce prediction values.

The user confirmed on 2026-09-06 that source ID 222 is Nong Rawiang, **Phimai**.
Its original district text remains `Mueang Nakhon Ratchasima` in normalized
files and `sourceAmphoeEn`; corrected geography is separate mapping metadata.
ID 5 maps to `300106`; ID 222 maps to `301512`.

Five existing GeoJSON English labels disagree with their Thai labels:
`300101`, `300113`, `301811`, `302401`, `302405`. Reviewed mapping labels are
checked against the Thai administrative master. No geometry file is changed.

Trace from a polygon:

1. Admin code -> runtime `locations.subdistrictCode` -> original `sourceId`.
2. Selected T + horizon -> normalized `forecast_values.csv` composite key.
3. `source_first_row` -> original Excel row; column `G` through `L` corresponds
   to `Pred_Risk_T+1` through `Pred_Risk_T+6`.
4. `source_row_lineage.csv` lists every original occurrence, including exact
   duplicate rows. It retains all 58,312 original rows.
5. Dataset manifest pins the original workbook and each normalized file hash.
   New database values include `source_first_row` and `source_row_count`.

The independent verifier reads Excel ZIP/XML, not the normalizer, and compares
both normalized data and the runtime projection to every original cell.

## Verified Local Evidence

- 349,872 original risk cells including duplicate rows: zero mismatches.
- 220,218 unique normalized forecasts, 762 runs, 289 locations: complete.
- Risk totals: 43,733 zero; 24,898 moderate; 20,523 high; 131,064 blank.
- Runtime SHA-256:
  `56ca64940332ef588bd163523428ae7e8330c3310d3a63f4f61407af989da592`.
- Evidence: `tmp-snapshots/rev03-runtime-original-integrity-20260906.json`.
- 157 unit tests passed with `--exclude 'tmp-snapshots/**'`. The first generic
  unit run incorrectly discovered historical backup copies; those are not
  current test sources. Their files/configuration were not modified.
- 10 isolated PGlite migration/integrity/RLS tests passed, including exact
  full/T+1 RPC projections and saved-filter source-month compatibility.
- 8 desktop/mobile map/source checks passed: Home, province, district,
  subdistrict; first/latest T; all six horizons; exact polygon class and fill.
- 4 isolated Supabase-provider bookmark/reload/failure browser checks passed.
- 14 desktop/mobile overview and irrigation browser regressions passed.
- Typecheck and static build passed. Existing chunk-size advisory remains.

### Original Workbook Random Sampling

Seed `20260906` selects one original Excel cell for each risk value (0, 1, 2,
blank) and horizon (1-6): 24 samples, 24 distinct areas, 22 distinct origin
months. Exact duplicate source rows are sampled once. Expected risk values
come directly from the original workbook XML, not the normalized risk data.

All 24 passed against the local rev03 build in Chromium: actual polygon class,
computed fill (or SVG hatch), legend definitions and forward target month.
No mismatches. The mobile duplicate of this sampling test is intentionally
skipped; separate desktop/mobile map integrity tests cover responsive routes.

| Original cell | ID / area | Origin T / horizon / target | Source value | Actual map fill |
| --- | --- | --- | --- | --- |
| G28175 | 138 / Makha, Non Sung | 2021-11 / T+1 / 2021-12 | 0 | Green `#5dae79` |
| G38739 | 190 / Thong Chai Nuea, Pak Thong Chai | 2023-01 / T+1 / 2023-02 | 1 | Yellow `#f1b84b` |
| G55448 | 274 / Laem Thong, Nong Bun Mak | 2022-03 / T+1 / 2022-04 | 2 | Red `#d95d59` |
| G9761 | 49 / Non Teng, Khong | 2021-03 / T+1 / 2021-04 | Blank | Gray hatch, background `#e2e8e4` |

Full trace and browser results:
`tmp-snapshots/rev03-original-sample-browser-20260906/forecast-original-samples--74c14-ap-colors-and-forward-dates-desktop/original-sample-browser-report.json`.
The adjacent `original-sample-map.png` captures the last sampled view.
This is local evidence, not a production cutover verification.

## Release Checkpoint (2026-09-06)

The user authorized push/deploy of this task only. Other working-tree UI work
and its new tests were excluded, including the UI hunk in the shared
`e2e/drought-workspace.spec.ts`. The isolated release source is
`tmp-snapshots/rev03-release-604df89cccfd/`; only release-status documentation
has changed since that tested tree. No component, stylesheet or map geometry
change is part of this release.

Published dataset: `a3be4448-6c8e-4039-b574-4674e261ee9b`, version
`drought-rev03-a3be44486c8e`.

Migration `20260906160000_rev03_origin_forecast.sql` was applied after a verified
forecast-only backup. It adds trace columns and an origin contract. Saved-filter
values already mean T, so their foreign key now references the source-month run
key. No saved-filter rows or RLS changed. The old published payload remains
compatible during staging.

- Backup: `tmp-snapshots/rev03-db-checkpoint-20260906/`; all four forecast tables
  verified by row count and ordered database digest, with per-file SHA-256.
  `RESTORE.md` records recovery without deleting or overwriting either dataset.
- Remote import/publication: 220,218 values, 762 runs, 289 locations; exact
  source ID/risk/origin/target/admin/row/duplicate-count digest
  `44cfcd55c251d9c95f169d3b391040de435b3b6462139f501559a155456e5fd1`.
  Evidence: `tmp-snapshots/archive-migration-1hsp6B/` and
  `tmp-snapshots/archive-migration-d8QOYw/`.
- Real-account full/T+1 RPCs exactly match the source-backed runtime projection;
  anonymous archive/personal-table access remains denied.
  Evidence: `smoke-results/database-integrity/report.json`.
- Personal-table counts and ordered hashes unchanged after publication:
  saved filters 0, followed areas 2. No personal contents were exported.
- Clean release source: 157 unit tests, 10 isolated migration/RLS tests, and
  98 desktop/mobile E2E tests passed (12 configured skips, including separate
  database-mode and original-workbook-sampling suites). Static and database
  protected builds, exposure checks and bundle gates passed. Database builds
  emit no static forecast archive assets.
- Added a regression for structurally valid but unapproved source metadata:
  rejected payloads are never cached and a fresh retry revalidates the source.

### Published Release

- Runtime commit `d8286ddfd6312ed6c539cf2628a79001bb13f0cf` is pushed to
  `fix/nr-map-zoom-performance`; no merge into `main`.
- Initial CI found a mobile keyboard-test setup race: the filter sheet's
  scheduled initial focus could arrive after the test had focused its month
  control. Test-only commit `8b149dce37e6aa73731ac4b210025541c39e11e5` waits for
  the intended initial focus before beginning keyboard input. No assertion was
  removed and no runtime/UI code changed. Ten focused mobile repetitions passed.
- Full CI for that test-only follow-up passed all required steps in 10m41s:
  https://github.com/purichw/korattanphai/actions/runs/34046251788 .
  This includes unit/data checks, migration/RLS checks, static and database
  protected builds, generated-data drift and both browser suites.
- Candidate `dpl_J9kqETDCpFdFaD1AcSFigN81cGvW` was built from the clean committed
  source at `tmp-snapshots/rev03-deploy-d8286dd/`, using actual Production
  variables and `--prod --skip-domain`. Its complete real-account desktop/mobile
  smoke passed before promotion, including full/T+1 actual RPC/source equality,
  all 289 map status classes on each route, irrigation categories, saved-list
  reads, API/assets/security checks, logout and no horizontal overflow/errors.
  The previously failing keyboard flow also passed on this hosted candidate.
- The verified candidate was promoted without rebuilding. Vercel inspection
  confirms `https://korattanphai.vercel.app` serves this Ready deployment;
  `/data-backend.json` reports `supabase`. Runtime is identical to the passing
  CI source; the later test-only change does not alter deployed assets.
- Production real-account smoke then passed the same five routes at 1440x960
  and 390x844, including unavailable-area behavior. Both RPC projections exactly
  match rev03, no static fallback occurs, and the reports contain zero failures.
  Candidate and production screenshots were visually inspected.
- Evidence: `smoke-results/rev03-candidate/`,
  `smoke-results/rev03-production/`, and `smoke-results/database-integrity/`.
- Recovery: promote previous deployment `dpl_CNfArLjRBvsG2kX5Bjx2hSVX9RAK`
  (`https://korattanphai-eytyko48m-purichwc-1517s-projects.vercel.app`). Preserve
  the additive schema and both immutable datasets. No rollback was performed.
- Real Safari and unrelated UI redesign/load testing are outside this release.

Old data remains retained only for recovery/older clients, not as a source or
fallback for the new app. Do not delete it while deployed clients still request
it. Any old-dataset saved-filter references must stop deletion, never cascade
into personal data. No old-data deletion has been performed.

The old canonical forecast file is currently unused by active runtime/import
paths but is not yet deleted. The old importer CLI is disabled; the generic
migration-library entry point now exports only the rev03 implementation.
