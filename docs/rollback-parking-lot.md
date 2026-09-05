# Rollback Parking Lot

## 2026-09-05 - Remove Synthetic Korat Metrics, Preserve Components

- Request: delete the synthetic numbers and remove their UI, keeping the
  component design hidden for future source-backed data.
- Checkpoint: Git branch `checkpoint/nr-synthetic-metrics-removal-20260905`
  at `4139250f8a94f3be079d0d7ba170fac5ee1597f3`. The worktree was clean before
  this change; no untracked files or database state are involved.
- Status: intentionally hidden, accepted by the user; no restoration pending.
- Removed: 22 TH-P29 synthetic monthly records from
  `src/data/canonical/province_monthly_risk.json`, and their agriculture/rai/
  confidence metrics from Home and the province drought disclosure.
- Retained: `AgricultureImpactPanel`, `AgricultureVisibilityPanel`, shared
  MetricCard/MetricGrid design, their CSS, and the source-backed rendering path.
  Missing or non-REAL agriculture records now render nothing, not zero.
- Untouched: Excel rev02 canonical archive, generated T+1 projection, all
  forecast values, administrative geography, readiness evidence, and unrelated
  legacy records for other provinces.
- Restore only on an explicit future request with verified source-backed
  agriculture data and its reference period; do not restore synthetic records
  from the checkpoint into public UI. Verify source guard, component rendering,
  responsive layouts, and unchanged archive counts.
- Verification: 50 focused unit/data tests, TypeScript/Vite build, and 8
  desktop/mobile E2E scenarios passed (Home and all three drought scopes).
  Canonical archive and both generated projections/summaries match the
  checkpoint byte-for-byte. Screenshot checks found no horizontal overflow or
  page errors; readiness navigation and all four Home forecast counts remain
  intact. Evidence: `tmp-snapshots/no-synthetic-metrics/`.
  Unrelated concurrent navigation/chart edits were preserved. No push/deploy.

## 2026-09-05 15:31 +07:00 - Remove Duplicate Forecast Narrative

- Request: explicitly remove the large six-horizon narrative/timeline panel
  after reviewing its duplication of the chart and KPI strip.
- Checkpoint: `tmp-snapshots/rollback-checkpoints/remove-forecast-narrative-2026-09-05T08-31-48-948Z/`
  contains pre-edit owner files, working/staged diffs, status, and untracked
  inventory. No untracked files are involved in this removal.
- Status: intentional removal accepted by the user; no restoration pending.
- Removed: `DroughtForecastNarrativeDetail` and its shared live call on
  province, district, and subdistrict drought routes.
- Preserved: chart, KPI strip, map, target/T+ selection, archive context and
  source caveats under the existing details disclosure. Data and shared model
  helpers are unchanged; historical styling is not part of this cleanup.
- Restore only on an explicit new request: selectively restore the component
  and call from the checkpoint, reconcile the shared-component docs and route
  assertions, then verify disclosure behavior on all three scopes. Do not
  overwrite unrelated in-progress changes with the full checkpoint patch.
- Verification passed: 13 focused forecast unit tests and live local checks
  for all three route scopes (province/district desktop, subdistrict mobile).
  Chart/map/KPIs, T+ selection, archive context/caveats, and disclosure keyboard
  toggle remain working. Snapshot: `tmp-snapshots/forecast-narrative-removed-1440.png`.
  Full-site tests and deployment were not run for this scoped removal.

## 2026-09-04 23:08 +07:00 - Remove Retired Water-Provider Data From Web

- Request: remove all retired external water-provider data from the website,
  including bundled fixtures, source IDs, URLs, ingest tooling, public API
  payloads, and product documentation that could reintroduce that provider.
- Checkpoint:
  `/tmp/codex-rollback-checkpoints/korattanphai-remove-retired-water-provider-data-20260904-230833/`
- Checkpoint branch:
  `checkpoint/before-retired-water-provider-removal-20260904-230833`
- Release status: verified locally before the requested push/deploy.
- Removed from live app:
  - retired provider forecast fixture and province water snapshot fixture;
  - retired provider ingest script;
  - source-registry, source-matrix, rainfall audit, map-layer, API, and
    risk-fusion references to the retired provider;
  - public drought trend wiring that depended on the removed current-provider
    forecast fixture.
- Will keep in the app:
  - rev02 drought forecast archive as the public prediction source;
  - DWR EWS station/source coverage metadata;
  - TMD regional/monthly context metadata;
  - empty current rainfall observation schema until an approved live source and
    station/admin-code crosswalk exist.
- Restore checklist:
  - restore the removed fixture/import/script files from the checkpoint branch
    only if a future product decision explicitly reintroduces that provider;
  - re-add source registry/source matrix/API references intentionally rather
    than by partial rollback;
  - rerun unit tests, build, protected build, full managed e2e, production
    exposure scan, and production route smoke before release.

## 2026-09-02 18:46 +07:00 — Clear Remaining Local Map Research Data

- Request: remove all remaining historical data that feeds the local map,
  including the previously retained `2025-12` period, while keeping the then
  separate prediction fixtures intact.
- Checkpoint:
  `/tmp/codex-rollback-checkpoints/korattanphai-clear-remaining-map-data-20260902-184626/`
- Release status: verified locally before production deployment for the fully
  cleared local research map dataset.
- Will remove from live data:
  - all local research map periods from
    `normalized_research_monthly_panel.json`;
  - latest district/subdistrict research summaries, province monthly summaries,
    attention lists, conflict lists, and top rainfall rows from
    `normalized_research_panel_summary.json`.
- Will keep in the app:
  - the then separate drought forecast fixtures and point-in-time water snapshot
    data;
  - OPSMOAC prediction-readiness data and canonical nationwide month contracts;
  - Nakhon Ratchasima admin hierarchy, GeoJSON geometry, and map rendering
    components.
- Restore checklist:
  - restore the two normalized research JSON files from the checkpoint if the
    parked `2025-12` map dataset is needed for comparison or rollback;
  - rerun domain tests, typecheck, lint, build, e2e, and route smoke before
    release.

## 2026-09-02 12:19 +07:00 — Clear Historical Local Map Research Data

- Request: remove historical data that feeds the map/month selector before
  loading a new dataset, while keeping the then separate prediction fixtures
  intact.
- Checkpoint:
  `/tmp/codex-rollback-checkpoints/korattanphai-clear-historical-map-data-20260902-121928/`
- Release status: verified locally for the local research map dataset cleanup.
- Will remove from live data:
  - local research map periods before `2025-12` from
    `normalized_research_monthly_panel.json`;
  - historical province research summary rows before `2025-12` from
    `normalized_research_panel_summary.json`.
- Will keep in the app:
  - the latest local research map period, all 289 subdistrict records, district
    and subdistrict latest summaries;
  - the then separate prediction fixtures and point-in-time water snapshot data;
  - OPSMOAC prediction-readiness and canonical nationwide month contracts.
- Restore checklist:
  - restore the two normalized research JSON files from the checkpoint if the
    historical map periods are needed again;
  - rerun domain tests, typecheck, lint, build, and route smoke before release.

## 2026-08-31 22:43 +07:00 — Hide Technical Source Names From User-Facing Copy

- Request: remove end-user-facing references to the previous water-data provider
  and Excel-style source filenames while keeping the demo data and internal
  provenance records intact.
- Checkpoint: archived local checkpoint path from the 2026-08-31 copy-removal
  cleanup.
- Release status: parked for the Nakhon Ratchasima-only demo UX; restore only
  if source/file provenance needs to be exposed in the public UI again.
- Will remove from live UI:
  - source/file names in province drought forecast copy;
  - source/file names in district and subdistrict forecast remarks;
  - source/file names in data-limit accordions, fallback notices, and no-data
    explanations;
  - placeholder copy that exposed upstream water-data source acronyms.
- Will keep in the app:
  - canonical JSON, source registry, ingest lineage, internal TypeScript names,
    and documentation needed to preserve provenance;
  - forecast and historical data behavior, with only the visible copy changed.
- Restore checklist:
  - restore the visible source/file copy in the province, district, and
    subdistrict panels;
  - restore e2e expectations for the source-specific text;
  - rerun targeted route snapshots before release.

## 2026-08-31 21:42 +07:00 — Remove Visible Water UI From Korat Tan Phai

- Request: remove water/rain graphs and water-related evidence panels from the
  province overview, district, and subdistrict pages in the Nakhon
  Ratchasima-only Korat Tan Phai site.
- Checkpoint:
  `/tmp/codex-rollback-checkpoints/korattanphai-remove-visible-water-ui-20260831-214232/`
- Earlier scoped checkpoint:
  `/tmp/codex-rollback-checkpoints/korattanphai-remove-water-area-panels-20260831-214144/`
- Release status: intentionally parked for this Nakhon Ratchasima-only release
  per the current product direction; restore only if the water/rain surface is
  explicitly reopened later.
- Will remove from live UI:
  - province overview rainfall, water-level, forecast-rain, station coverage,
    water readiness, and official-water panels;
  - district/subdistrict forecast graph modules fed by the official rainfall
    snapshot then in use;
  - district/subdistrict rainfall history panels;
  - district/subdistrict rainfall station/readiness panels;
  - visible map-layer/filter affordances that expose rainfall or water-system
    views;
  - water-related helper docs/e2e expectations that treated those panels as
    visible page content.
- Will keep in the app:
  - district/subdistrict routes and map drill-down;
  - agricultural risk, drought, crop/context, and prediction readiness surfaces;
  - shared data/domain functions where water/rain evidence still supports
    province overview or prediction semantics.
- Restore checklist:
  - restore the parked UI calls in `ProvinceView`, `DistrictView`, and
    `SubdistrictView`;
  - restore area-page and overview e2e expectations for rainfall/water panels
    and layer options;
  - rerun unit, build, e2e, and route snapshots before release.

## 2026-08-31 21:19 +07:00 — Remove Province Water Page From Korat Tan Phai

- Request: remove the `/water` page and page-specific water code from the
  Nakhon Ratchasima-only Korat Tan Phai site.
- Checkpoint:
  `/tmp/codex-rollback-checkpoints/korattanphai-remove-water-page-20260831-211931/`
- Release status: intentionally parked for this Nakhon Ratchasima-only release
  per the current product direction; restore only if the water page is
  explicitly reopened later.
- Will remove from live routes:
  - the province-level `/water` route;
  - the visible `น้ำ` tab and tab-specific navigation target;
  - route/test/docs contracts that say `/water` is a primary surface.
- Will keep in the app:
  - rainfall/water-level evidence that still appeared as context in the
    province overview and forecast/readiness surfaces;
  - shared map layer and prediction semantics that still depend on water/rain
    evidence.
- Restore checklist:
  - restore route/tab contracts in `src/domain.ts` and
    `src/components/NakhonRatchasimaWorkspace.tsx`;
  - restore `/water` docs and e2e expectations;
  - rerun unit, build, e2e, and production smoke before release.

Previous Korat Tan Phai bootstrap note: the older item below is retained as
upstream provenance from the source project snapshot and is not part of the
current `/water` removal scope.

## 2026-08-30 17:22 +07:00 — Nakhon Ratchasima Mapping Cleanup

- Request: remove obsolete or confusing old code/data names that could make
  future work confuse local names with the province hierarchy.
- Checkpoint: `/tmp/codex-rollback-checkpoints/Kaset-Tan-Phai-20260830-172203/`
- Scope being cleaned from live source:
  - legacy `korat-*` layer IDs, class names, data attributes, tests, and source
    IDs owned by this project;
  - scattered app route checks now replaced by the route resolver in
    `src/domain.ts`;
  - stale docs suggesting legacy selectors or local nicknames are acceptable as
    province-level naming.
- Kept intentionally:
  - the real `ตำบลโคราช` administrative record under district code `3018`;
  - the official `koratpao.go.th` source URL because it is the publisher URL;
  - existing nationwide routes, workflows, source provenance classes, and the
    `TH-P29` canonical province object.
- Restore checklist:
  - apply `git-diff.patch` from the checkpoint if this cleanup needs to be
    reversed;
  - restore untracked source files from `untracked/`;
  - rerun `git diff --check`, `npm test`, `npm run build`, and route snapshots.
