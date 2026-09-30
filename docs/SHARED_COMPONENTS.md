# Korat Tan Phai Shared Components

This document is the living reuse map for the Korat Tan Phai / โคราชทันภัย UI.
Read it before adding a new shared-looking component, duplicated stat card,
dropdown, map preview, provenance marker, dashboard section, or map control.

The current code remains the source of truth when this document drifts. Update
this document in the same change whenever a shared component contract changes.

## Public Shared Components

Shared web surface styling is owned by `src/brand-theme.css`, imported once in
`src/main.tsx`. Existing shell, filters, `AppSelect`, metrics, map controls and
forecast cards consume its paint-only rules without new props or layout wrappers.
Do not copy these visual rules into individual route components. Component sizes,
spacing, fonts, responsive order, events and data ownership stay in their current
owners. See [BRAND_SURFACE_THEME.md](BRAND_SURFACE_THEME.md).

Active forecast-only composition (see [restoration contract](FORECAST_ONLY_RESTORATION.md)):
`NakhonRatchasimaWorkspace` mounts the shared forecast composition at every
geographic level. `OperationalDroughtWorkspace` and its neutral-map variant remain
parked, not live routes. `DataProvenanceChip.FORECAST_ARCHIVE` labels predictions
accurately without changing forecast values or calling them actual observations.
The page and map month controls share selection; the page horizon dropdown and
six-horizon strip stay synchronized. `AppStartup` uses overview placeholders on
the default route. `WorkspaceBookmarks` accepts both plain and explicit archive
forecast links; geographic following remains independent. Overview T+2..T+6 saves
use the existing drought-view contract and preserve horizon and district scope.

Database migration (enabled in production): `WorkspaceBookmarks` is
the shared account-toolbar control on desktop/mobile for followed areas and
saved filters across all Korat routes. It renders only within
`DatabaseWorkspaceProvider` (`VITE_DATA_BACKEND=supabase`). Loading, errors,
confirmed removal, keyboard tabs and navigation use one implementation. It
must receive the raw app navigation callback, not a forecast wrapper that
overwrites a saved source-month/horizon selection. Legacy `target` URL and
`target_period` saved keys retain the source month T. See
`SUPABASE_DATA_MIGRATION.md`.

The bookmark control reuses the shared `primary-button`, `secondary-button`,
and `icon-button` styles with scoped sizing in `src/saved-workspaces.css`.
Its native dialog keeps the heading and keyboard tabs visible while the panel
scrolls internally. Current selection, empty/populated lists, loading, errors,
and inline delete confirmation share one layout across desktop/mobile. Tab
changes clear prior success notices; closing calls the native dialog close
before unmounting so focus returns to the opener. Persistence and saved-route
semantics remain in the existing data/route helpers.

These components are exported from `src/components/` and may be reused across
files.

| Component | File | Use For | Current Contract |
| --- | --- | --- | --- |
| `LoginFrame` / `LoginPage` | `src/components/LoginScreen.tsx` | Visitor and Admin sign-in | Same brand, fields, password visibility, Enter submission, busy/error behavior. `scope` changes title/return link only; `App`/Auth own routing and independent sessions. |
| `WorkspaceEmptyState` | `src/components/WorkspaceEmptyState.tsx` | Shared empty/error presentation in CMS and irrigation | Icon, heading level, description and optional action; owner retains filtering/retry events and state. `IrrigationEmptyState` is the domain adapter, not a duplicate layout. |
| `AppStartup` | `src/components/AppStartup.tsx` | Branded full-screen loading for Visitor and Admin | Public emblem, centered brand, indeterminate bar and one live status. `path` changes the Admin caption; optional `message` names the startup phase. No session/data imports or fake progress. Offers page reload after 20 seconds; never dismisses itself on a timer. `index.html` uses the same CSS/brand for pre-JavaScript entry. |
| `PageLoadBoundary` / `usePageLoading` | `src/components/PageLoadBoundary.tsx` | Coordinate blocking page reads behind `AppStartup` | Readers register in layout effects; release on readiness, failure or unmount. Children stay mounted/measurable but hidden, inert and removed from the accessibility tree while pending. Covers nested load waterfalls without a skeleton flash. Cached refreshes, criteria changes and mutations stay local. `PageLoadPending` covers the lazy CMS chunk. |
| `SidebarBrand` | `src/components/SidebarBrand.tsx` | Logo in the live sidebar | Receives accessible `label` and `compactMobileLogo`; owns the existing responsive picture markup with unchanged image sizes/paths. |
| `WorkspaceSearch` / `WorkspaceSearchTrigger` | `src/components/WorkspaceSearch.tsx` | Authenticated global search across geographic levels and active tools | Shared desktop/mobile dialog; loads `WorkspaceSearchContent` only on open, with dismissible loading and scoped recovery. Formal Thai, aliases/topics, contextual results, Contains/Exact, filters, explicit history commits and per-account clearing. Receives `userId`, `includeExport`, navigation/export/close callbacks. See `SEARCH_BEHAVIOR.md`. |
| `ForecastLoadingPrimitives` | `src/components/nakhon-ratchasima/ForecastLoadingPrimitives.tsx` | Forecast recovery and local loading placeholders | Page placeholders mount behind `PageLoadBoundary`, not as the visible startup experience. Local analysis/modal placeholders remain scoped. `ForecastArchiveLoading` reexports the overview and retains the drought error/back-navigation header. |
| `AppSelect` | `src/components/AppSelect.tsx` | Product dropdowns, filters, listbox controls | Center-aligned trigger text by default, mobile bottom-sheet menu from CSS, keyboard/typeahead support. Lists with 8+ options are searchable automatically; `searchable` explicitly enables/disables it. Search matches labels, codes, groups and optional `searchText`, including Thai digits, without committing selection. Option badges support `good`, `watch`, `danger`, and `muted`; `align="start"` is only for intentional scan-left text. |
| `MonthSelect` | `src/components/MonthSelect.tsx` | Source/comparison month controls | Shared searchable `AppSelect` with full Thai/English month aliases and Buddhist/Gregorian years. Keeps existing labels and `YYYY-MM` values unchanged. Reused by `ForecastMonthSelect`, Excel export and analysis comparison; no forecast request/loading ownership of its own. |
| `ForecastMonthSelect` | `src/components/ForecastArchiveRequest.tsx` | Forecast source-month dropdowns in page filters, Home mobile editor and map toolbars | Reuses `AppSelect.loadingLabel` for an in-place, reduced-motion-aware spinner while the shared request changes month. The loaded month stays selected until success; controls remain usable for a later selection. `ForecastArchiveRequest` announces pending changes to assistive technology without adding a visible top paragraph. Background revision checks stay quiet; error/retry and Supabase freshness behavior are unchanged. |
| `IrrigationStatusSelect` | `src/components/IrrigationStatusSelect.tsx` | Location irrigation filter inside Home/drought/district/subdistrict maps | Reuses `AppSelect`; all/irrigated/rainfed/unknown labels and matching come from `src/irrigation.ts`. Lives in the shared map toolbar, not page filters or the Home editor. Selection updates the whole page without changing URL. Unknown irrigation never implies missing or zero-risk forecasts. |
| `IrrigationEmptyState` | `src/components/IrrigationEmptyState.tsx` | Zero matching irrigation areas in Home and all drought workspaces | Centered SearchX icon, heading, explanatory status and icon+text reset, aligned with analysis empty states. `onReset` clears irrigation through the existing selection owner. Optional `className` places it in the caller's grid. Never represents zero matching areas as zero risk. |
| `MetricCard` | `src/components/PageSummary.tsx` | Individual stat-only cards | Centered content by default; use `tone`, `icon`, `detail`, and `provenance` instead of one-off stat tile classes. |
| `MetricGrid` | `src/components/PageSummary.tsx` | Groups of stat cards | Variants: `default`, `segmented`, `compact`; use for repeated KPI/stat groups instead of custom grids. |
| `PageSummary` | `src/components/PageSummary.tsx` | Top summary panels with copy plus metrics | Use for high-level overview summaries where a short narrative and metrics share one surface. |
| `DataProvenanceChip` | `src/components/DataProvenanceChip.tsx` | Provenance dots/chips | Supported kinds: `REAL`, `FORECAST_ARCHIVE`, `CANONICAL_SYNTHETIC`, `DERIVED`, `RUNTIME_STATE`, `PROXY`, `PENDING_SOURCE`. Archive predictions never use the actual-observation label. Do not invent parallel provenance pills. |
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

All product dropdowns, including map tools, analysis and report dialogs, use
`AppSelect`; do not introduce a native select or a parallel custom listbox.
Escape dismisses an open menu first, then is left to the enclosing dialog when
the menu is already closed. Selection and explicit menu dismissal return focus
to the trigger without scrolling; outside clicks retain their intended target.
Search fields stay above the independently scrolling options. Arrow keys/Enter
choose from visible enabled results; Escape dismisses without changing the value,
and reopening clears the query. Desktop focuses search on open; mobile leaves the
keyboard closed until requested and fits the sheet above the visual viewport's
keyboard inset. Text editing and IME composition do not accidentally select.
Area controls are explicitly searchable even with fewer than 8 options. Other
long lists, including analysis patterns and search-topic filters, use the shared
threshold; short status, horizon, sort and view menus retain their compact form.
`WorkspaceDialog` supports Escape, its close button and backdrop dismissal,
locks background scroll and restores the opener without moving the page.
Its optional `closeLabel` defaults to the existing map-tool label; search supplies
`ปิดการค้นหา`. `ForecastExcelExport` accepts an optional increasing `openRequest`
number to open the same dialog from search, with its default navigation behavior unchanged.

| Export | File | Use For |
| --- | --- | --- |
| `AppSelectOption` | `src/components/AppSelect.tsx` | Shared option shape for `AppSelect` and filter controls. |
| `SummaryMetric`, `MetricCardProps` | `src/components/PageSummary.tsx` | Shared metric/card typing. |
| `DataProvenanceChipKind`, `dataProvenanceChipKindFromText` | `src/components/DataProvenanceChip.tsx` | Provenance typing and text-to-kind mapping. |
| `AuditTrailItem`, `AuditTrailSection` | `src/components/AuditTrail.tsx` | Audit trail data typing. |
| `MapPreviewFooterAction` | `src/components/MapPreviewFooter.tsx` | Shared map preview action typing. |
| `provinceOptionsForMonth` | `src/components/OperationalFilters.tsx` | Province option list helper for operational filters. |

## Local Shared Primitives

`AccountControl` in `src/AuthenticatedApp.tsx` has one instance in the shared
sidebar footer, not duplicate desktop/mobile account triggers. Desktop anchors
it to the bottom of the sidebar with an upward menu; mobile places it after the
scrollable navigation and retains the account bottom sheet. Its accessible name
includes the authenticated identity; the compact trigger shows the account label
and truncates long names, while the open menu shows full details. Escape restores
focus without scrolling, outside clicks dismiss, and arrow/Home/End keys navigate
menu actions. Identity and logout remain owned by the existing scoped auth callbacks.
Navigation scrolls independently so the footer stays reachable on short screens.

Admin uses the same desktop sidebar width and mobile logo dimensions as Home.
The public navigation omits the data-management entry; direct Admin URLs and
their independent authentication remain available.

Forecast UI uses `forecastHorizonLabel` from `src/forecastPeriod.ts`: full
labels read `ล่วงหน้า 1 เดือน`; six-slot tabs and chart axes use `1 เดือน`
through `6 เดือน`. Tab accessible names retain the full lead time and actual
target month. Headings, dropdowns, map previews, loading, bookmark-generated
copy and the export dialog use the same Thai terminology. This is presentation
only: numeric horizons, URL/saved keys, source `T+` fields and Excel workbook
formulas/labels remain unchanged. User-authored saved names are not rewritten.

The workspace loads the full archive on demand with `useForecastArchive` and
passes it to the existing province/district/subdistrict forecast views.
`PageLoadBoundary` shows one branded screen until the initial forecast and
essential subdistrict geometry have settled. Optional map context does not block
the page. Pending page skeletons remain hidden/inert; failed reads release the
gate into the existing error/retry presentation. No fabricated values or percent
complete appear. The same boundary waits for the CMS list/draft, forecast catalog
and reference catalog/resource; CMS write operations never register as page reads.
Reduced motion stops the loading-bar animation. Browser Back still abandons a
pending route. Cached month changes and background publication checks retain the
current content and existing inline month-control feedback.
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
| `DroughtOperationalWorkspace.tsx` | Shared drought identity (also during loading), five context/filter slots and operational disclosures. |
| `ForecastArchiveLoading.tsx`, `src/forecast-loading.css` | Shared neutral loading/error presentation for Home and every drought route; separate compositions reuse skeleton, filter, metric, map and recovery primitives. |
| `src/drought-workspace.css` | Scoped compact layout for drought/district/subdistrict routes; does not restyle the root overview. |
| `src/home-overview.css` | Home-only v4 composition, compact context, map/situation panel and expandable support. |
| `SharedPanels.tsx`, `ResearchPanels.tsx` | Reused local sections and research/evidence panels. |
| `ProvinceView.tsx`, `DistrictView.tsx`, `SubdistrictView.tsx` | Level-specific composition, retaining the same shared forecast workspace. Supporting-data readiness cards, disclosures and map actions are removed across Home and every area level. Actual agriculture evidence remains separately gated on source-backed records. |

`src/components/AppErrorBoundary.tsx` and `StorageNotice.tsx` provide application
recovery feedback. Neither resets persisted state automatically.

| Primitive | Use For |
| --- | --- |
| `OfficialMetricCard` | Nakhon-specific metric cards backed by `MetricCard`. |
| `ProvinceDashboardHeading` | Province heading with source/readiness context. |
| `ProvinceSituationCards` | Legacy province current-state facts; not used as forecast evidence in the overview. |
| `ProvinceForecastOverview` | Compact Home context, read-only situation/MetricGrid, map plus four risk counts, high/moderate risk toggle with a bounded scrolling list, and archive navigation in the summary heading. Readiness and source/limitations disclosures are removed; inline provenance and forecast caveats remain. Defaults to latest available source month T + T+1 (December 2025 forecasting January 2026). District and irrigation scope filter the summary and attention records together. Keys `ForecastRiskAttention` by source month, district and irrigation so each changed scope resets its risk choice and scroll position. Agriculture design remains province-wide but hidden without a REAL record. Duplicate archive/support rows and their loading placeholders are removed. Drilldowns preserve source month/horizon, irrigation and selected area. Mobile order is context, counts, map and area links. |
| `ForecastRiskAttention` | Home attention panel receiving the current `DroughtForecastArchiveSummary` and a caller-owned `hrefForSubdistrict`. Native buttons expose high/moderate counts and `aria-pressed`; initial choice is high when available, otherwise moderate when available, otherwise high. Filters the summary's scoped `recordsBySubdistrict` by the selected risk and sorts every matching row by subdistrict code in a labeled, keyboard-focusable scrolling region. No three-row limit or expand/collapse step. Null/out-of-scope and missing vintages never appear as risk records. Changing risk resets scroll to the top; the overview's scope key resets selection on month/district/irrigation changes. Empty selected levels remain selectable and distinguish zero matching risk from no in-scope forecast values. Uses each record's district/tambon identity and the supplied drill-down URL. |
| `DashboardSection` | Standard titled Nakhon dashboard section shell. |
| `DashboardAccordionSection` | Compact disclosure section for source/detail content. |
| `DashboardDetailPanel` | Always-visible passive preview plus a labeled toggle button with `aria-expanded`/`aria-controls`, persistent provenance and hidden/revealed detail body. Used by compact agriculture; clicking a stat preview does not navigate or expand. |
| `DataGovernanceGuardrailList` | Guardrail list explaining readiness/source caveats. |
| `DataGovernanceGuardrailAccordion` | Compact guardrail disclosure. |
| `DroughtWorkspaceHeader` | Shared province/district/subdistrict drought identity, scope and back navigation. District back goes to `/drought`, subdistrict back goes to its district, and province drought back goes to `/`; forecast navigation preserves the selected source month T and T+. |
| `DroughtWorkspaceFilters` | Archive origin/base month T, fixed drought/rice context and area navigation. Four slots; T+ is owned by the horizon strip, irrigation by `DroughtForecastArchiveMapFilters`. Dropdowns reuse `AppSelect`, including its keyboard, typeahead and mobile menus. |
| `DroughtOperationalSummary` | Forecast-summary adapter onto `DroughtOperationalDisclosure`, shared by province/district via the compact workspace. Accepts horizon, `DroughtForecastArchiveSummary` and optional controlled disclosure state. Its collapsed header retains the risk share; expansion reveals the unchanged risk counts and administrative coverage. Uses neutral informational styling, not an overall area-severity grade. Null share means unavailable, not 0%. Short copy and numeric details remain centered. |
| `DroughtOperationalDisclosure` | Shared native details/summary for risk summary, attention, guidance, historical evidence and source-backed agriculture across drought scopes. Short titles/descriptions center on both axes; `descriptionAlign="start"` supports long header descriptions. Expanded prose/lists stay start-aligned. Optional `open`/`onOpenChange` provide controlled grouping; standalone consumers retain independent native keyboard toggle and open state. |
| `DroughtOperationalDisclosureGroup` | Shared province/district forecast-action group. Accepts direct, stably keyed `DroughtOperationalDisclosure`/`DroughtOperationalSummary` children; owns at most one open item, initially none. Clicking the active trigger closes it. Places closed cards before the full-width open card in both DOM and visual order, with two closed cards side by side even on mobile. Restores trigger focus after reordering, keeps mounted content, and clears selection when a filtered-out item disappears. Subdistrict guidance stays standalone and no aggregate/self-link cards are introduced. |
| `ResearchStatGrid` | Local grid wrapper for research metric groups. |
| `DroughtForecastTrendGraph` | Owned by `ForecastRiskBarGraph.tsx`, re-exported by `DroughtForecastWorkspace.tsx`. Six stacked columns for forward calendar months T+1-T+6 from one selected origin month T. `unit="percent"` (default) or `"count"` changes the scale only. Amber segments count source risk 1 and red segments source risk 2; totals never determine severity color. Percentages divide by each month's in-scope 0/1/2 count. Null/out-of-scope and missing are excluded, never converted to green zero bars. Valid zero risk has a green baseline marker. Container-sized SVG preserves legible labels; the four-item legend uses short labels in narrow cards. Hover/focus/tap exposes category counts, percentages and coverage without selecting a horizon. Arrow keys/Home/End move between columns; Escape, outside pointer or blur dismiss details. SVG descriptions also expose all values. Selected T+ is highlighted. No 50% severity threshold. |
| `DroughtCompactForecastWorkspace` | Owns one selected source month/horizon for context, chart, map and KPIs; actual target month follows T+horizon. Desktop province/district composition keeps a map at least 600px tall on the left, with a compact chart and the existing selected-month KPI group stacked on the right. No duplicated KPIs or empty equal-height chart surface. Extra missing-data cards and wrapped copy may grow the map/summary rows rather than clip. At 900px and below, the existing KPI/chart/map order remains. Loading placeholders follow the same composition. No duplicate archive detail panel. Subdistrict omits aggregate chart, repeated summary and self-link attention list. Attention lists exist only for actual risk records. |
| `DroughtForecastWorkspaceContext` | Shared origin/base month T, actual target month T+horizon, crop and in-scope forecast coverage. Single-area variant omits the population coverage count. Dates follow the user-confirmed forward meaning; they do not use the legacy manifest's backwards reference month. |
| `DroughtForecastWorkspaceKpiStrip` | Adapter onto `MetricGrid`/`MetricCard`. Province/district show administrative coverage separately from distinct risk/out-of-scope/missing counts. Desktop adds an unframed selected forecast-month heading beside coverage, then two columns of individual risk cards. Coverage retains both x/y tambons and its percentage of all tambons in the selected area/irrigation scope. Risk-category details give percentages of tambons with values 0/1/2, not all administrative tambons. An all-unavailable scope is neutral, never green. `level="subdistrict"` consumes `selectedRecord` and shows one status, not 0/1 population counts. Its `is-forecast-status` card uses green/amber/red tinted surfaces for no-risk/moderate/high, neutral gray for out-of-scope, and a dashed neutral border for a missing record. Text and icons accompany color. |
| `DroughtForecastWorkspaceChart` | Shared by province and every district; forward forecast from one source month T, highlighting the selected T+ and its actual target month. Owns a full-width local percent/count segmented control, defaulting to percent; changing units does not navigate, refetch data or change map/T+/irrigation state. Selected unit survives in-place horizon/filter changes. Shows a compact coverage strip beneath the graph. Helper text is above the control on desktop and below it on mobile. Availability is derived across all six points, independently of the active horizon. An entirely unavailable series shows a neutral status instead of a zero graph. Subdistrict pages still omit the aggregate chart. |
| `DroughtForecastWorkspaceMapCard` | Shared local map card for province, district, and subdistrict forecast archive views. Keeps the existing `NakhonRatchasimaLocalMap` behavior and forecast archive map filters. |
| `DroughtForecastArchivePanel` | Retained archive detail design, no longer composed into the product because it repeats the primary context and totals. |
| `DroughtForecastArchiveHorizonSelector` | Shared six-slot T+ strip; roving keyboard selection supports arrows, Home and End. One strip per archive module; the page-level horizon dropdown remains synchronized with it. |
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
| `ProvinceDashboardMapCard` | Province dashboard map surface with optional scoped target and `compactOverview` layout. Forecast/irrigation encoding uses the same SVG. The former readiness mode and return action are removed from this card and `DroughtForecastWorkspaceMapCard`. |
| `AgricultureVisibilityPanel` | Agriculture facts/KPI panel. |
| `AgricultureImpactPanel` | Province agriculture impact panel, optional `compact` reusing its existing facts/MetricGrid with disclosure and explicit separate-source context. Design is preserved, but missing or non-REAL records render nothing; synthetic Korat rows have been deleted. Home agriculture metrics use the same REAL-only gate. |
| `ResearchAreaAgricultureImpactPanel` | Retained district/subdistrict facts design; requires actual scoped research records and an available period. Administrative tambon count is labeled as administrative scope, not assessed farmland. |
| `PredictionReadinessPanel` | Retained legacy supporting-evidence design, no longer composed into any page. Underlying evidence categories are unchanged; they are distinct from forecast coverage, accuracy and hazard severity. |
| `NakhonRatchasimaLocalMap` | Shared local SVG map across province, district, and subdistrict levels. Supports normal/research criteria maps and drought forecast archive mode keyed by source month T + T+ horizon, with the derived actual target date and no-risk, moderate, high, and out-of-scope map states. Geometry loads have a 30-second deadline including body parsing; every route level offers in-place retry preserving the selected area, source month, horizon and filters. Failed or late requests cannot populate the shared cache. |
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
  Active-option scrolling stays inside the list/menu, never page ancestors.
  Map filter fields use the shared container-query grid, including tambon pages;
  obsolete positional `nth-child` placement can create implicit columns after a
  control is removed. Test menu bounds against the configured mobile viewport,
  not just `innerWidth`, which mobile browsers can inflate after overflow.
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
  all risk counts and coverage before chart then map. Subdistrict pages use a
  65–70% map column and a result/context/guidance rail from 768px. Mobile stacks
  the full-width T+ strip, context, one status, map, and guidance. There is no
  population chart or empty chart slot. The intro explicitly owns its named grid
  areas so the shared `horizon` area cannot create an unintended extra column.
  The page horizon dropdown and both source-month dropdowns are intentionally
  retained per the user's 2026-09-06 follow-up; all bind to the existing selection.
  `pathWithForecastSelection`
  preserves the active source month/horizon through area filters and map drilldowns
  using the backward-compatible `target` query key.
  `compactForecast` opts these routes into map fitting that reserves space for
  zoom controls and respects `localMaxZoom`; controls and legend are outside the
  plot. Subdistrict inspection alone opts into a 28x maximum and geometry-bound
  padded fitting, using the same renderer, gestures, reset and fullscreen path.
  `clampLocalTransform` and `transformForLocalFocus` accept an optional maximum;
  the default 7.2x limit on other routes is unchanged. A scoped ResizeObserver
  compensates viewBox scaling for readable selected-place labels without resetting
  the camera on T+ changes. Home separately opts into `overviewLayout` for compact fitting, left-side
  controls, a projection/zoom-aware approximate distance scale, preview clearance
  and explicit geometry-load recovery. Archive/default consumers keep their own
  layout and interaction behavior.
  Home and drought already share `NakhonRatchasimaLocalMap`,
  `DroughtForecastArchiveMapFilters`, and `IrrigationStatusSelect`. Their outer
  cards remain separate because Home has an overview summary and distance scale,
  while drought composes the horizon chart and area context. When irrigation has
  no matching areas, both use `IrrigationEmptyState`. In two-column drought
  layouts, the empty state occupies the chart slot and preserves the map frame;
  it must not expand the map across both columns. Subdistrict and stacked layouts
  retain their existing composition.
- **Provenance:** use `DataProvenanceChip` and `DataProvenanceLegend`. Missing
  evidence must not be rendered as normal, green, or low-risk.
- **Section shells:** use `DashboardSection` or `DashboardAccordionSection`
  inside the Nakhon workspace, and `ContentSection` for generic app sections.
- **Data guardrails:** keep agricultural figures clearly separated from
  official damage figures, and keep data readiness separate from hazard
  severity.

## Interaction Contracts To Preserve

- Irrigation status narrows forecast counts, denominator, map eligibility,
  horizon comparison and attention lists together. Keep
  this selection through explicit area navigation and saved filters. Choosing
  irrigation updates React state and the current history entry's state, never
  the URL or route. Month/risk URL writes preserve that state; bookmarks read it
  before old query values. Zero matching areas
  are an empty filter, not a no-risk or missing-forecast result. The map-only risk
  dropdown intersects the irrigation set. See `IRRIGATION_FILTER.md` for source
  mappings and the already-applied additive saved-filter migration.
- Supporting-data readiness UI is removed sitewide, including generic province
  placeholders, map entry points and matching loading slots. Do not restore it
  through a legacy disclosure or map-mode toggle. This is a presentation change:
  canonical evidence, forecast coverage, out-of-scope/missing states, irrigation
  filters and risk calculations remain unchanged.
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

## Forecast Excel Export

`ForecastExcelExport` is the shared navigation action for overview, province,
district and tambon routes on desktop/mobile. Its dialog uses `AppSelect` and
the existing button styles. It keeps export month/area/irrigation independent of
map state. Prepare shows scope/coverage counts; Download revalidates the preview
and requires review again if data changed. Optional comparisons align the same
target month and administrative code across origins. The dialog owns cancellable
loaders and starts its XLSX worker only on Download; Cancel retains options for
retry while Close/Escape discard them. See `docs/FORECAST_EXCEL_EXPORT.md` for workbook
semantics, native chart/PivotTable support, provenance and regression checks.

## Local Map Tools And Analysis

All of these tools are **Nakhon Ratchasima only**. The shared
`NakhonRatchasimaLocalMap` mounts `ForecastMapTools` inside the optional `tools`
slot of `DroughtForecastArchiveMapFilters` across Home, province, district and
tambon. Existing route/month/irrigation ownership, camera and polygon rendering
remain in their original components. No legacy national page is enabled.

Map tool actions are centered. Filter summaries appear over the map's upper-left
corner when active, leaving no empty status row between the tools and the map.
Narrow legends reserve space for both forecast and irrigation layers. Changing
filters must not resize the frame. Province/district desktop maps, charts and their loading
or empty replacements use `--nr-forecast-desktop-panel-height`; mobile maps keep
a usable minimum plot height independently of the toolbar.

- `WorkspaceDialog` owns native modal lifecycle, Escape and focus restoration;
  it portals into the fullscreen target when one is active. Feature owners keep
  their own queries, async jobs, errors and loading states. Its opt-in `bounded`
  variant sizes analysis to its content with a viewport height cap and a scrolling
  body beneath a visible header. Other tools retain their existing sizing.
  The analysis shell stays mounted through lazy loading,
  with its scope name supplied by the map's existing administrative label.
- `ForecastMapTools` owns local administrative search, WGS84 / full Plus Code lookup,
  PNG/PDF download and an on-demand analysis entry point. Search and point results
  focus the existing camera; they never navigate outside the route's area or
  treat point coordinates as plot-level risk. The pin is transient, not saved.
  Both input modes reuse `mapPoint.ts` and the route-scope guard. Plus Codes
  decode locally with Open Location Code (no Google Maps API, key or geocoding
  request), then use the code area's center with the same polygon/hole/boundary
  checks. The UI explicitly labels this center-based lookup. Short codes are not
  guessed from the province center; they require a full code instead. Coarse
  codes with fewer than 10 significant characters are rejected. Existing risk
  values, map camera ownership and native-app behavior are unchanged.
- `ForecastAnalysisDialog` shares the existing Excel model for all six horizon
  values, district maxima, counts/denominators and same-calendar-target
  comparisons. `analysisHierarchy` sets province tables to districts (with an
  optional all-tambon detail view), district tables to their tambons, and tambon
  tables to the selected tambon, the current source-data leaf. District/tambon
  scopes cannot switch upward to a redundant district summary. Province charts
  retain district risk counts/shares; district charts compare each tambon's
  source 0/1/2 level at the selected horizon, never a per-tambon percentage.
  No finer-area forecasts or comparative chart are fabricated at leaf scope.
  It uses its own cancellable Supabase loader and revalidates on
  open, focus, visibility and every 60 seconds while open. New-revision data
  cannot overlay an older map. There is no static fallback in database mode.
  A matching complete page slice remains visible during revalidation, with a
  compact checking indicator and the map action disabled until verification.
  Local search/pattern/view changes do not refetch; comparison changes retain
  current results without showing a previous baseline under a new month label.
  Empty results share a centered icon/message across all analysis views. Their
  reset action clears only local search, district and risk-pattern filters,
  returns focus to search, and preserves the parent area, month and irrigation.
- `ForecastRiskValue` renders source values consistently in tables and search
  results. Null is out of study scope; undefined is missing, never zero.
- `forecastAnalysis.ts` owns matching, district grouping and forecast-pattern
  predicates. A missing/out-of-scope slot breaks a consecutive-risk run. A first
  risk horizon is only established when every earlier horizon is known zero.
  Monthly `risk-N` filters select level 1 or 2 at that horizon independently of
  onset. They are separate from `first-N`, which means the first risky horizon
  within this six-month forecast, not when a real-world drought started.
- Table filters apply to the analysis rows first. The explicit map action shows
  that set on the current map, resets the old map-only risk criterion and adds a
  clearable analysis notice. It does not silently rewrite page KPIs. The overlay
  is cleared by origin/horizon/revision/irrigation/color-mode changes.
- Same-target comparison maps have a distinct increase/decrease/unchanged/not
  comparable legend and preview fields. These are changes in ordinal forecasts,
  not probabilities, observed changes, accuracy or damage estimates.
- Timeline playback is opt-in through `onHorizonChange`, stopping at horizon 6,
  on page/month/scope changes, opening a tool, or hiding the document. Home stays
  T+1-only; merely rendering its tools never requests six-horizon data.
  Play/Pause and the current horizon/month form one fixed-size control group.
  Its period remains visible while paused; narrow map cards place the group on
  its own centered row. Starting/stopping playback must not resize the map.
- `mapImageExport.ts` snapshots SVG colors and the full legend, fitting the
  route's complete area by default or preserving the camera on request. Export
  labels use the existing geometry-based collision engine, independently of zoom.
- `mapReport.ts` measures and draws the shared A4 report. `reportLayout.ts` owns
  Thai word/grapheme wrapping, page flow and keep-with-next rules. Maps and legends
  stay together; headings retain their first lines and continuation pages repeat
  the header, scope and actual page count. PDF contains all pages; multiple PNG
  pages are delivered as ZIP. Heavy writers load only during export. These are
  snapshots of displayed data, not independent claims of latest publication.

Styling uses existing tokens, `AppSelect`, button classes and forecast colors
in `forecast-map-tools.css`. See [FORECAST_MAP_TOOLS.md](FORECAST_MAP_TOOLS.md)
for feature scope, data boundaries and verification.
