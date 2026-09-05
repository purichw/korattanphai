# Korat Tan Phai Shared Components

This document is the living reuse map for the Korat Tan Phai / โคราชทันภัย UI.
Read it before adding a new shared-looking component, duplicated stat card,
dropdown, map preview, provenance marker, dashboard section, or map control.

The current code remains the source of truth when this document drifts. Update
this document in the same change whenever a shared component contract changes.

## Public Shared Components

These components are exported from `src/components/` and may be reused across
files.

| Component | File | Use For | Current Contract |
| --- | --- | --- | --- |
| `AppSelect` | `src/components/AppSelect.tsx` | Product dropdowns, filters, listbox controls | Center-aligned trigger text by default, mobile bottom-sheet menu from CSS, keyboard/typeahead support, option badges support `good`, `watch`, `danger`, and `muted`, and `align="start"` only when scan-left text is intentionally needed. |
| `MetricCard` | `src/components/PageSummary.tsx` | Individual stat-only cards | Centered content by default; use `tone`, `icon`, `detail`, and `provenance` instead of one-off stat tile classes. |
| `MetricGrid` | `src/components/PageSummary.tsx` | Groups of stat cards | Variants: `default`, `segmented`, `compact`; use for repeated KPI/stat groups instead of custom grids. |
| `PageSummary` | `src/components/PageSummary.tsx` | Top summary panels with copy plus metrics | Use for high-level overview summaries where a short narrative and metrics share one surface. |
| `DataProvenanceChip` | `src/components/DataProvenanceChip.tsx` | Provenance dots/chips | Supported kinds: `REAL`, `CANONICAL_SYNTHETIC`, `DERIVED`, `RUNTIME_STATE`, `PROXY`, `PENDING_SOURCE`. Do not invent parallel provenance pills. |
| `DataProvenanceLegend` | `src/components/DataProvenanceChip.tsx` | Provenance legends | Use the same provenance semantics as chips. |
| `AuditTrailFootnotes` | `src/components/AuditTrail.tsx` | Evidence/source footnotes | Use when showing source notes, freshness, and audit trail sections. |
| `OperationalFilters` | `src/components/OperationalFilters.tsx` | Page-wide operational filters | Desktop field band plus mobile compact summary and edit bottom sheet. Opt-in `compactOverview` keeps target/district editable and drought/rice/T+1 passive; other consumers retain existing behavior. Use for page/dashboard filters, not map-only filter rails. |
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
and failed loads use one shared workspace state with overview navigation and
retry. The province overview fetches `forecast-overview-t1.json`, a generated
T+1-only projection of every target month. It uses the same loader, map and
summary functions with a separate cache; it must not fetch the full archive.
Forecast components retain the existing
target-month/T+ selection and risk semantics once data is ready.

Nakhon-specific primitives now live in `src/components/nakhon-ratchasima/`.
They are exported for reuse across province, district, and subdistrict routes;
do not duplicate them in view files. `NakhonRatchasimaWorkspace.tsx` only composes
the route, filters and loading state.

| Owner | Responsibility |
| --- | --- |
| `forecastModel.ts` | Target/T selection, archive records, counts and trend calculations. |
| `workspaceModel.ts` | Local map types/geometry, research selectors and display helpers. |
| `NakhonRatchasimaLocalMap.tsx` | Map rendering, gestures, previews, wheel isolation and geometry loading. |
| `ForecastControls.tsx` | Shared archive selectors, filters and summary metrics. |
| `DroughtForecastWorkspace.tsx` | Shared compact forecast, chart, map and archive context sections. |
| `DroughtOperationalWorkspace.tsx` | Shared drought identity, five context/filter slots, operational disclosures and single-map readiness presentation. |
| `src/drought-workspace.css` | Scoped compact layout for drought/district/subdistrict routes; does not restyle the root overview. |
| `src/home-overview.css` | Home-only v4 composition, compact context, map/situation panel and expandable support. |
| `SharedPanels.tsx`, `ResearchPanels.tsx` | Reused local sections and research/evidence panels. |
| `ProvinceView.tsx`, `DistrictView.tsx`, `SubdistrictView.tsx` | Level-specific composition, retaining the same shared forecast workspace. |

`src/components/AppErrorBoundary.tsx` and `StorageNotice.tsx` provide application
recovery feedback. Neither resets persisted state automatically.

| Primitive | Use For |
| --- | --- |
| `OfficialMetricCard` | Nakhon-specific metric cards backed by `MetricCard`. |
| `ProvinceDashboardHeading` | Province heading with source/readiness context. |
| `ProvinceSituationCards` | Legacy province current-state facts; not used as forecast evidence in the overview. |
| `ProvinceForecastOverview` | Compact Home context, read-only situation/MetricGrid, map plus four risk counts, three high-risk links with in-place all-items expansion, readiness disclosure and archive navigation. Source/limitations footer disclosure removed; inline provenance and forecast caveats remain. Defaults to latest available target + T+1. District scope filters map, counts and readiness; agriculture design remains province-wide but hidden without a REAL record. Drilldowns preserve target/horizon and selected area. Mobile order is context, counts, map, area links, details. |
| `DashboardSection` | Standard titled Nakhon dashboard section shell. |
| `DashboardAccordionSection` | Compact disclosure section for source/detail content. |
| `DashboardDetailPanel` | Always-visible passive preview plus a labeled toggle button with `aria-expanded`/`aria-controls`, persistent provenance and hidden/revealed detail body. Reused by compact agriculture and readiness; clicking a stat preview does not navigate or expand. |
| `DataGovernanceGuardrailList` | Guardrail list explaining readiness/source caveats. |
| `DataGovernanceGuardrailAccordion` | Compact guardrail disclosure. |
| `DroughtWorkspaceHeader` | Shared province/district/subdistrict drought identity, scope and back navigation. District back goes to `/drought`, subdistrict back goes to its district, and province drought back goes to `/`; forecast navigation preserves the selected target and T+. |
| `DroughtWorkspaceFilters` | Forecast month, fixed drought/rice context, area navigation and T+ using the same selection as the chart/map. Desktop has five slots; mobile has three plus two. Actual dropdowns reuse `AppSelect`, including its keyboard, typeahead and mobile menus. |
| `DroughtOperationalDisclosure` | Shared expandable operational content. Short titles and icons stay visible; historical evidence, agriculture, readiness and caveats remain reachable. |
| `useDroughtReadinessMap` | Opens readiness on the existing forecast map instance. An explicit return button restores the forecast; changing target or primary T+ also returns to it. |
| `ResearchStatGrid` | Local grid wrapper for research metric groups. |
| `DroughtForecastTrendGraph` | Shared drought forecast/historical trend chart. Accepts an active T+ horizon so the archive selector can highlight the matching archive point without changing target-month semantics. Threshold text/value lives in the wrapping legend outside the SVG plot; only its dashed reference line stays inside the plot. |
| `DroughtCompactForecastWorkspace` | Shared compact drought forecast workspace used by province, district, and subdistrict drought surfaces. Owns the primary T+ selector, context row, forecast KPI strip, chart card, map card, and detail disclosure so every level reads the same target month + horizon state. |
| `DroughtForecastWorkspaceContext` | Shared target month, issue month, crop and record coverage. Scope remains in the page identity and selected summary. |
| `DroughtForecastWorkspaceKpiStrip` | Adapter onto `MetricGrid`/`MetricCard`, not a second stat-card implementation. No-risk, moderate, high, out-of-scope and missing records stay distinct. Percentages use all expected administrative codes. Short labels/values are centered; no horizontal KPI scrolling on mobile. |
| `DroughtForecastWorkspaceChart` | Province/district chart card showing the selected archive target month's 6-horizon trend and highlighting the selected T+ slot. Subdistrict workspaces omit the subdistrict-count chart and give the map the full row; forecast selectors, KPIs and details remain available. |
| `DroughtForecastWorkspaceMapCard` | Shared local map card for province, district, and subdistrict forecast archive views. Keeps the existing `NakhonRatchasimaLocalMap` behavior and forecast archive map filters. |
| `DroughtForecastArchivePanel` | Shared historical drought forecast archive module for province, district, and subdistrict drought pages. It takes the selected target month plus T+ horizon, never fabricates missing vintage data, and can hide its own horizon selector when nested inside `DroughtCompactForecastWorkspace`. |
| `DroughtForecastArchiveHorizonSelector` | Shared single-choice T+ selector for archive mode. Use exactly one selector per archive module. |
| `DroughtForecastArchiveSummaryMetrics` | Shared archive summary metric grid using `MetricGrid`/`MetricCard`. Its overview variant displays high, moderate, no-risk and out-of-scope counts, plus a separate missing count when necessary; detail retains coverage and subdistrict values. |
| `DroughtForecastArchiveMapFilters` | Shared forecast archive map filter rail using `AppSelect` for target month and forecast status. Month options use month/year only from `forecastModel`; open map menus rise above the legend and lift their map container out of clipping until closed. Preserve dropdown wheel isolation from map zoom. |
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
| `ResearchAreaAgricultureImpactPanel` | District/subdistrict agriculture facts panel. |
| `PredictionReadinessPanel` | Readiness summary and breakdown panel, optional `compact` gauge/headline with expandable breakdown and map action. Accepts a scoped readiness calculation and optional source-backed reference month; never means hazard severity or model accuracy. Do not borrow dates from synthetic agriculture records. |
| `NakhonRatchasimaLocalMap` | Shared local SVG map across province, district, and subdistrict levels. Supports normal/research criteria maps and drought forecast archive mode keyed by target month + T+ horizon, including no-risk, moderate, high, and out-of-scope map states. |
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
  the visible month and T+ to their actual forecast selection. Both reuse
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
  keeps secondary archive details in a disclosure with
  `DroughtForecastArchivePanel showHorizonSelector={false}`. Use
  `DroughtForecastArchiveMapFilters` inside the map. The archive selection is
  target month + T+ horizon; changing T+ must not silently switch target month,
  and no-data combinations must stay no-data. The rev02 archive maps numeric
  values as `0` no-risk, `1` moderate risk, `2` high risk, and blank workbook
  cells as out-of-scope with a muted hatched map style. Keep one shared
  province/district/subdistrict implementation path unless the breakpoint
  composition genuinely needs to differ.
  Desktop aligns map and chart, followed by full-width stat cards. Mobile puts
  all risk counts and coverage before chart then map. Subdistrict pages omit the
  count chart at every breakpoint, with a full-width map and no empty chart slot.
  `pathWithForecastSelection`
  preserves the active target/horizon through area filters and map drilldowns.
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
