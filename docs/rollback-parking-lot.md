# Rollback Parking Lot

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
  - district/subdistrict forecast graph modules fed by the official ThaiWater
    rainfall snapshot;
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
  - ThaiWater/rainfall/water-level evidence that still appears as context in
    the province overview and forecast/readiness surfaces;
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
