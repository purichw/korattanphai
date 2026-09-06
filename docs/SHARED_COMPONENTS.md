# Korat Tan Phai Shared Components

This document is the living reuse map for the Korat Tan Phai / โคราชทันภัย UI.
Read it before adding a new shared-looking component, duplicated stat card,
dropdown, map preview, provenance marker, dashboard section, or map control.

The current code remains the source of truth when this document drifts. Update
this document in the same change whenever a shared component contract changes.

## Public Shared Components

Database migration (enabled in production): `WorkspaceBookmarks` is
the shared account-toolbar control on desktop/mobile for followed areas and
saved filters across all Korat routes. It renders only within
`DatabaseWorkspaceProvider` (`VITE_DATA_BACKEND=supabase`). Loading, errors,
confirmed removal, keyboard tabs and navigation use one implementation. It
must receive the raw app navigation callback, not a forecast wrapper that
overwrites a saved source-month/horizon selection. Legacy `target` URL and
`target_period` saved keys retain the source month T. See
`SUPABASE_DATA_MIGRATION.md`.

These components are exported from `src/components/` and may be reused across
files.

| Component | File | Use For | Current Contract |
| --- | --- | --- | --- |
| `AppSelect` | `src/components/AppSelect.tsx` | Product dropdowns, filters, listbox controls | Center-aligned trigger text by default, mobile bottom-sheet menu from CSS, keyboard/typeahead support, option badges support `good`, `watch`, `danger`, and `muted`, and `align="start"` only when scan-left text is intentionally needed. |
| `IrrigationStatusSelect` | `src/components/IrrigationStatusSelect.tsx` | Location irrigation filter inside Home/drought/district/subdistrict maps | Reuses `AppSelect`; all/irrigated/rainfed/unknown labels and matching come from `src/irrigation.ts`. Lives in the shared map toolbar, not page filters or the Home editor. Selection updates the whole page without changing URL. Unknown irrigation never implies missing or zero-risk forecasts. |
| `MetricCard` | `src/components/PageSummary.tsx` | Individual stat-only cards | Centered content by default; use `tone`, `icon`, `detail`, and `provenance` instead of one-off stat tile classes. |
| `MetricGrid` | `src/components/PageSummary.tsx` | Groups of stat cards | Variants: `default`, `segmented`, `compact`; use for repeated KPI/stat groups instead of custom grids. |
| `PageSummary` | `src/components/PageSummary.tsx` | Top summary panels with copy plus metrics | Use for high-level overview summaries where a short narrative and metrics share one surface. |
| `DataProvenanceChip` | `src/components/DataProvenanceChip.tsx` | Provenance dots/chips | Supported kinds: `REAL`, `CANONICAL_SYNTHETIC`, `DERIVED`, `RUNTIME_STATE`, `PROXY`, `PENDING_SOURCE`. Do not invent parallel provenance pills. |
| `DataProvenanceLegend` | `src/components/DataProvenanceChip.tsx` | Provenance legends | Use the same provenance semantics as chips. |
| `AuditTrailFootnotes` | `src/components/AuditTrail.tsx` | Evidence/source footnotes | Use when showing source notes, freshness, and audit trail sections. |
| `OperationalFilters` | `src/components/OperationalFilters.tsx` | Page-wide operational filters | Desktop field band plus mobile compact summary and edit bottom sheet. Opt-in `compactOverview` keeps source month T/district editable and drought/rice/T+1 passive; other consumers retain existing behavior. Use for page/dashboard filters, not map-only filter rails. |
| `MapPreviewFooter` | `src/components/MapPreviewFooter.tsx` | Map hover/selection preview footer | Renders the shared action button or centered fallback note. Do not hand-code `.map-preview-action` or `.map-preview-note` directly. |
| `ContentSection` | `src/components/ContentSection.tsx` | Generic titled content shell | Use for generic section containers outside the specialized Nakhon workspace panels. |
| `RiskMap` | `src/components/RiskMap.tsx` | Inherited national/province SVG risk map | Keep for the nationwide/legacy map surface; local Nakhon maps use `NakhonRatchasimaLocalMap`. |
| `NakhonRatchasimaWorkspace` | `src/components/NakhonRatchasimaWorkspace.tsx` | Main province/district/subdistrict workspace | Owns the local route hierarchy, data joins, local map, and Nakhon-specific dashboard modules. |
| `NakhonRatchasimaWorkspaceSummary` | `src/components/NakhonRatchasimaWorkspaceSummary.tsx` | Compact entry summary for the Nakhon workspace | Use for a small landing/entry card that points into the local workspace. |
| `ProvinceWorkspacePlaceholder` | `src/components/ProvinceWorkspacePlaceholder.tsx` | Route-backed placeholder for other canonical provinces | Keeps missing local evidence visible without rendering it as normal or low risk. |

Helper exports:

| Export | File | Use For |
| --- | --- | --- |
| `AppSelectOption` | `src/components/AppSelect.tsx` | Shared option shape for `AppSelect` and filter controls. |
| `SummaryMetric`, `MetricCardProps` | `src/components/PageSummary.tsx` | Shared metric/card typing. |
| `DataProvenanceChipKind`, `dataProvenanceChipKindFromText` | `src/components/DataProvenanceChip.tsx` | Provenance typing and text-to-kind mapping. |
| `AuditTrailItem`, `AuditTrailSection` | `src/components/AuditTrail.tsx` | Audit trail data typing. |
| `MapPreviewFooterAction` | `src/components/MapPreviewFooter.tsx` | Shared map preview action typing. |
| `provinceOptionsForMonth` | `src/components/OperationalFilters.tsx` | Province option list helper for operational filters. |

## Local Shared Primitives

The workspace loads the full archive on demand with `useForecastArchive` and
passes it to the existing province/district/subdistrict forecast views. Pending
and failed loads use the shared `ForecastArchiveLoading.tsx` presentation:
`ForecastOverviewLoading` and `DroughtWorkspaceLoading` retain route identity,
compose layout-matched neutral skeletons, and share one loading announcement and
error/retry state. No data values, risk colors, interactive placeholder controls,
or synthetic chart/map data appear while pending. Subdistrict loading has one
status placeholder and a full-width map, never population charts or lists.
Skeleton motion respects reduced motion. Back navigation reuses the ready-state
`DroughtWorkspaceHeader`; its archive label is optional until data is available.
Request ownership, authentication, cache, retry, and source validation stay in
the existing loaders. The province overview uses a generated
T+1-only projection of every source month T. It uses the same loader, map and
summary functions with a separate cache; it must not fetch the full archive.
Forecast components retain the existing
source-row/T+ selection and risk semantics once data is ready.

The user confirmed on 2026-09-06 that `Source_YearMonth` is the origin/base month
T across the entire archive. Components select T, then display actual target
month T+horizon. Six chart slots run forward from T+1 to T+6 with the same origin;
for December 2025 they are January-June 2026. This supersedes the earlier
fixed-target/backwards-reference convention. Raw archive/RPC fields
`targetMonths` and `packedRiskByTargetMonth` remain source-month keys, and their
legacy calculated `issueMonth` must not drive product dates. See
`DATA_CONTRACT.md` for source provenance and the immutable storage contract.

Nakhon-specific primitives now live in `src/components/nakhon-ratchasima/`.
They are exported for reuse across province, district, and subdistrict routes;
do not duplicate them in view files. `NakhonRatchasimaWorkspace.tsx` only composes
the route, filters and loading state.

| Owner | Responsibility |
| --- | --- |
| `forecastModel.ts` | Source-month/T+ selection, forward origin/target projection, archive records, counts and trend calculations. |
| `src/forecastPeriod.ts` | Shared calendar-month arithmetic and T+horizon target derivation for forecast views and saved selections. |
| `workspaceModel.ts` | Local map types/geometry, research selectors and display helpers. |
| `NakhonRatchasimaLocalMap.tsx` | Map rendering, gestures, previews, wheel isolation and geometry loading. |
| `ForecastControls.tsx` | Shared archive selectors, filters and summary metrics. |
| `DroughtForecastWorkspace.tsx` | Shared compact forecast, chart, map and archive context sections. |
| `DroughtOperationalWorkspace.tsx` | Shared drought identity (also during loading), five context/filter slots, operational disclosures and single-map readiness presentation. |
| `ForecastArchiveLoading.tsx`, `src/forecast-loading.css` | Shared neutral loading/error presentation for Home and every drought route; separate compositions reuse skeleton, filter, metric, map and recovery primitives. |
| `src/drought-workspace.css` | Scoped compact layout for drought/district/subdistrict routes; does not restyle the root overview. |
| `src/home-overview.css` | Home-only v4 composition, compact context, map/situation panel and expandable support. |
| `SharedPanels.tsx`, `ResearchPanels.tsx` | Reused local sections and research/evidence panels. |
| `ProvinceView.tsx`, `DistrictView.tsx`, `SubdistrictView.tsx` | Level-specific composition, retaining the same shared forecast workspace. Subdistrict pages omit the supporting-data readiness disclosure and its map action; Home, province and district readiness remain available. |

`src/components/AppErrorBoundary.tsx` and `StorageNotice.tsx` provide application
recovery feedback. Neither resets persisted state automatically.

| Primitive | Use For |
| --- | --- |
| `OfficialMetricCard` | Nakhon-specific metric cards backed by `MetricCard`. |
| `ProvinceDashboardHeading` | Province heading with source/readiness context. |
| `ProvinceSituationCards` | Legacy province current-state facts; not used as forecast evidence in the overview. |
| `ProvinceForecastOverview` | Compact Home context, read-only situation/MetricGrid, map plus four risk counts, three high-risk links with in-place all-items expansion, readiness disclosure and archive navigation. Source/limitations footer disclosure removed; inline provenance and forecast caveats remain. Defaults to latest available source month T + T+1 (December 2025 forecasting January 2026). District scope filters map, counts and readiness; agriculture design remains province-wide but hidden without a REAL record. Drilldowns preserve source month/horizon and selected area. Mobile order is context, counts, map, area links, details. |
| `DashboardSection` | Standard titled Nakhon dashboard section shell. |
| `DashboardAccordionSection` | Compact disclosure section for source/detail content. |
| `DashboardDetailPanel` | Always-visible passive preview plus a labeled toggle button with `aria-expanded`/`aria-controls`, persistent provenance and hidden/revealed detail body. Reused by compact agriculture and readiness; clicking a stat preview does not navigate or expand. |
| `DataGovernanceGuardrailList` | Guardrail list explaining readiness/source caveats. |
| `DataGovernanceGuardrailAccordion` | Compact guardrail disclosure. |
| `DroughtWorkspaceHeader` | Shared province/district/subdistrict drought identity, scope and back navigation. District back goes to `/drought`, subdistrict back goes to its district, and province drought back goes to `/`; forecast navigation preserves the selected source month T and T+. |
| `DroughtWorkspaceFilters` | Origin/base month T, fixed drought/rice context, area navigation and T+. Five slots; irrigation is in `DroughtForecastArchiveMapFilters`. Actual dropdowns reuse `AppSelect`, including its keyboard, typeahead and mobile menus. |
| `DroughtOperationalSummary` | Forecast-summary adapter onto `MetricCard`, shared by province/district via the compact workspace. Accepts horizon and existing risk/in-scope counts; preserves unavailable vs zero-risk semantics. Shares the centered `nr-operational-card-heading` layout with disclosure triggers, reserving equal icon/trailing columns so short copy is centered on the card itself. |
| `DroughtOperationalDisclosure` | Shared native details/summary for attention, guidance, historical evidence and readiness across drought scopes. Uses the same centered card-heading layout; short titles/descriptions center on both axes, including stretched rows. Use `descriptionAlign="start"` for long header descriptions; expanded prose/lists stay start-aligned. Native keyboard toggle, focus and per-instance open state are preserved. |
| `useDroughtReadinessMap` | Opens readiness on the existing forecast map instance. An explicit return button restores the forecast; changing source month T or primary T+ also returns to it. |
| `ResearchStatGrid` | Local grid wrapper for research metric groups. |
| `DroughtForecastTrendGraph` | Shows six forward calendar target months T+1-T+6 from one selected origin month T. Each point carries in-scope, out-of-scope and missing counts. Unavailable horizons have no risk dot and no connecting line or fill across the gap. The reference is half the administrative tambon count (rounded up), not land area, model severity or an official warning threshold; its label stays outside the plot. |
| `DroughtCompactForecastWorkspace` | Owns one selected source month/horizon for context, chart, map and KPIs; actual target month follows T+horizon. No duplicate archive detail panel. Subdistrict omits aggregate chart, repeated summary and self-link attention list. Attention lists exist only for actual risk records. |
| `DroughtForecastWorkspaceContext` | Shared origin/base month T, actual target month T+horizon, crop and in-scope forecast coverage. Single-area variant omits the population coverage count. Dates follow the user-confirmed forward meaning; they do not use the legacy manifest's backwards reference month. |
| `DroughtForecastWorkspaceKpiStrip` | Adapter onto `MetricGrid`/`MetricCard`. Province/district show in-scope coverage and distinct risk/out-of-scope/missing counts. An all-unavailable scope is neutral, never green. `level="subdistrict"` consumes `selectedRecord` and shows one status, not 0/1 population counts. Its `is-forecast-status` card uses green/amber/red tinted surfaces for no-risk/moderate/high, neutral gray for out-of-scope, and a dashed neutral border for a missing record. Text and icons accompany color; aggregate cards retain their existing styling. |
| `DroughtForecastWorkspaceChart` | Province/district forward forecast from one source month T, highlighting the selected T+ and its actual target month. Availability is derived across all six points, independently of the active horizon. An entirely unavailable series shows a neutral status instead of a zero graph. |
| `DroughtForecastWorkspaceMapCard` | Shared local map card for province, district, and subdistrict forecast archive views. Keeps the existing `NakhonRatchasimaLocalMap` behavior and forecast archive map filters. |
| `DroughtForecastArchivePanel` | Retained archive detail design, no longer composed into the product because it repeats the primary context and totals. |
| `DroughtForecastArchiveHorizonSelector` | Shared single-choice T+ selector for archive mode. Use exactly one selector per archive module. |
| `DroughtForecastArchiveSummaryMetrics` | Shared archive summary metric grid using `MetricGrid`/`MetricCard`. Its overview variant displays high, moderate, no-risk and out-of-scope counts, plus a separate missing count when necessary; detail retains coverage and subdistrict values. |
| `DroughtForecastArchiveMapFilters` | Shared map toolbar using `AppSelect` for source month T, forecast status and page-wide irrigation. Its segmented color control changes encoding only; irrigation selection activates the categorical palette. Narrow layouts wrap fields within the map. Month options use month/year only from `forecastModel`; open menus rise above the legend. Preserve dropdown wheel isolation from map zoom. |
| `ResearchDroughtSituationPanel` | Province drought status summary. |
| `ResearchDroughtDistrictPanel` | District ranking/status module. |
| `ResearchSubdistrictAttentionPanel` | Subdistrict attention/follow-up list. |
| `DataTransparencyPanel` | Retained source/limitations primitive; no longer composed into any page. Inline provenance and forecast caveats are unchanged. |
| `ResearchSourceLimitsPanel` | Retained source/freshness/limitations helper; removed from the province drought page. |
| `ResearchAreaHeading` | District/subdistrict identity header. |
| `ResearchAreaSituationPanel` | District/subdistrict situation strip. |
| `ResearchAreaMapSection` | District/subdistrict map section wrapper. |
| `ResearchAreaDroughtHistoryPanel` | District/subdistrict historical drought chart. |
| `ResearchAreaSubdistrictsPanel` | Subdistrict grid/list for an area. |
| `ResearchAreaAttentionPanel` | Area attention/watchlist module. |
| `ResearchSubdistrictProfilePanel` | Subdistrict profile/context module. |
| `ResearchSubdistrictDataGapPanel` | Subdistrict data-gap module. |
| `ResearchAreaSourceLimitsPanel` | Retained area-specific source limits helper; removed from district and subdistrict pages. |
| `ProvinceDashboardMapCard` | Province dashboard map surface; optional scoped target, `compactOverview` layout and `readinessMode` with explicit close action. Home switches the same SVG between forecast/readiness instead of adding a second map. |
| `AgricultureVisibilityPanel` | Agriculture facts/KPI panel. |
| `AgricultureImpactPanel` | Province agriculture impact panel, optional `compact` reusing its existing facts/MetricGrid with disclosure and explicit separate-source context. Design is preserved, but missing or non-REAL records render nothing; synthetic Korat rows have been deleted. Home agriculture metrics use the same REAL-only gate. |
| `ResearchAreaAgricultureImpactPanel` | Retained district/subdistrict facts design; requires actual scoped research records and an available period. Administrative tambon count is labeled as administrative scope, not assessed farmland. |
| `PredictionReadinessPanel` | Supporting-evidence readiness, distinct from Excel forecast coverage, accuracy and hazard severity. Percentages always describe the ready category. `scope="single"` shows one evidence status without population gauge/breakdown; `compact` retains the Home disclosure. Map action uses the existing map instance. |
| `NakhonRatchasimaLocalMap` | Shared local SVG map across province, district, and subdistrict levels. Supports normal/research criteria maps and drought forecast archive mode keyed by source month T + T+ horizon, with the derived actual target date and no-risk, moderate, high, and out-of-scope map states. |
| `NakhonRatchasimaBreadcrumbs` | Local route breadcrumbs. |
| `NakhonRatchasimaLayerInspector` | Layer/provenance inspector. |
| `SourceDecisionFootnotes` | Source-decision footnotes. |
| `SourceFreshness` | Freshness/source summary. |
| `PanelTitle` | Icon plus title label for local panels. |

## Reuse Rules

- **Stat cards:** use `MetricCard` and `MetricGrid` for stat-only cards. In the
  Nakhon workspace, prefer `OfficialMetricCard` when the surrounding file is
  already using it. Stat card content is centered unless a richer narrative card
  needs a different layout.
- **Dropdowns:** use `AppSelect` for visible product dropdowns and filter
  selects. The trigger text is centered by default and the mobile bottom-sheet
  behavior is shared through its CSS. Do not add native `<select>` controls for
  new product filters unless there is a concrete accessibility or platform
  reason.
- **Page filters:** use `OperationalFilters` for generic page-wide filters and
  the root overview. Drought detail routes use `DroughtWorkspaceFilters` to bind
  the visible origin month T and T+ to their actual forecast selection. Both reuse
  `AppSelect`; fixed hazard/crop values are not fake editable menus. Local map
  filters live in `NakhonRatchasimaLocalMap` but still use `AppSelect`.
- **Map preview cards:** use `MapPreviewFooter` for preview actions and fallback
  notes. Preview cards must sit above lower sections when they overlap and the
  fallback note must remain centered.
- **Maps:** use `RiskMap` for inherited national map behavior and
  `NakhonRatchasimaLocalMap` for province/district/subdistrict local maps. Do
  not duplicate SVG map interaction logic; shared math and labels live in
  `src/mapInteraction.ts`, `src/mapLabels.ts`, and
  `src/useFullscreenTarget.ts`.
- **Forecast workspace/archive:** use `DroughtCompactForecastWorkspace` as the
  top drought forecast module for province, district, and subdistrict pages.
  It owns the single primary `DroughtForecastArchiveHorizonSelector`, passes the
  selected T+ horizon to the archive trend chart and forecast archive map, and
  omits duplicate secondary archive totals. Use
  `DroughtForecastArchiveMapFilters` inside the map. The archive selection is
  source month T + T+ horizon; changing T+ preserves T and changes the actual
  target date to T+horizon. No-data combinations must stay no-data. The rev02
  archive maps numeric values as `0` no-risk, `1` moderate risk, `2` high risk,
  and blank workbook cells as out-of-scope with a muted hatched map style. Keep one shared
  province/district/subdistrict implementation path unless the breakpoint
  composition genuinely needs to differ.
  Desktop aligns map and chart, followed by full-width stat cards. Mobile puts
  all risk counts and coverage before chart then map. Subdistrict pages show one
  status before a full-width map at every breakpoint, with no empty chart slot.
  `pathWithForecastSelection`
  preserves the active source month/horizon through area filters and map drilldowns
  using the backward-compatible `target` query key.
  `compactForecast` opts these routes into map fitting that reserves space for
  zoom controls and respects `localMaxZoom`; controls and legend are outside the
  plot. Home separately opts into `overviewLayout` for compact fitting, left-side
  controls, a projection/zoom-aware approximate distance scale, preview clearance
  and explicit geometry-load recovery. Archive/default consumers keep their own
  layout and interaction behavior.
- **Provenance:** use `DataProvenanceChip` and `DataProvenanceLegend`. Missing
  evidence must not be rendered as normal, green, or low-risk.
- **Section shells:** use `DashboardSection` or `DashboardAccordionSection`
  inside the Nakhon workspace, and `ContentSection` for generic app sections.
- **Data guardrails:** keep agricultural figures clearly separated from
  official damage figures, and keep data readiness separate from hazard
  severity.

## Interaction Contracts To Preserve

- Irrigation status narrows forecast counts, denominator, map eligibility,
  horizon comparison, attention lists and supporting readiness together. Keep
  this selection through explicit area navigation and saved filters. Choosing
  irrigation updates React state and the current history entry's state, never
  the URL or route. Month/risk URL writes preserve that state; bookmarks read it
  before old query values. Zero matching areas
  are an empty filter, not a no-risk or missing-forecast result. The map-only risk
  dropdown intersects the irrigation set. See `IRRIGATION_FILTER.md` for source
  mappings and the already-applied additive saved-filter migration.
- Map color mode is independent of page-wide filtering: forecast colors retain
  hazard semantics; irrigation colors are blue `#397fc5`, purple `#9262b7`, gray
  `#87939e`, with matching labels and legend. Choosing irrigation activates its
  color mode. Toggling back to forecast colors does not change counts or filters.

- Cleared historical datasets must not mount empty analytics, administrative
  watchlists, or a green quality-check result. Keep the designs in source and
  gate route composition on actual records. Primary area selectors retain
  administrative navigation independently of research-data availability.
- The production account menu exposes identity/logout, not display personas or
  the legacy local demo reset. `AccountControl.demoActions` defaults to false;
  no current product shell enables it. Auth/RLS permissions are unchanged.
- Home high-risk links use area icons, not numbered urgency ranks. Ordering is
  still administrative-code order, with context in the mobile/expanded list.

- Selecting an area on the province map is transient and can be cleared by
  clicking the selected feature again or the map background. Clearing selection
  should not immediately reopen a new hover preview while the map animates back.
  A route-selected subdistrict remains selected only while the user is on that
  subdistrict route.
- Hover/preview cards on district and subdistrict maps must use the same layout
  priority as the province map and must not be hidden behind following sections.
- The map footer fallback text is a centered shared component state, not a
  one-off text alignment fix.
- Desktop/tablet/mobile may compose the same information differently, but data
  values, readiness categories, source semantics, and route behavior must remain
  identical.

## Verification Defaults

For docs-only updates, run:

```bash
git diff --check
```

For shared UI or map component changes, run the relevant release-gate checks for
the touched surface. The usual minimum for this project is:

```bash
git diff --check
npm run build
npm test
```

When committing, pushing, or deploying, follow `docs/RELEASE_RUNBOOK.md`.
