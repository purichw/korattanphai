# Korat Tan Phai / โคราชทันภัย App Map

## Routing Model

FACT: The app is served by Vite/Vercel as a React single-page app with
client-side route handling in `src/App.tsx`. In this Nakhon Ratchasima-only
subset, `/` opens the local province workspace after login. Navigation exposes
`ภาพรวม`, its `ภัยแล้ง` subitem and `ส่งออก Excel` in database mode.

Routes:

- `/login`: Supabase Email + Password; internal-only return paths preserve query/hash.
- `/`: province-level Nakhon Ratchasima overview.
- `/drought`: province-level drought context page.
- `/{district-slug}`: district-level drill-down.
- `/{district-slug}/{subdistrict-slug}`: subdistrict-level drill-down.
- `/nakhon-ratchasima/...`: legacy alias accepted for old links.

Other province placeholder routes are not part of this subset's primary
navigation.

Local-only routing change (2026-09-20), not deployed:

- `NakhonRatchasimaWorkspace` resolves intent through `operationalLocation.ts`.
  Routes above without explicit archive intent render `OperationalDroughtWorkspace`.
- `period=YYYY-MM` means valid/data month; with no period the server supplies the
  current Bangkok month. Bare legacy `target=T&horizon=h` becomes valid month T+h.
- `mapLayer=forecast-archive` explicitly opens the retained source-month archive.
  Home's compact archive is T+1 only; explicit T+2..T+6 uses the full archive view
  without changing the requested vintage. Invalid/missing selections do not default.
- Actual and eligible future forecast feeds remain unconfigured. Current operational
  UI is the unavailable/error path, not a completed actual dashboard. See
  [Actual / Forecast Separation](ACTUAL_FORECAST_SEPARATION.md) for source/release gaps.

## User-Facing Surfaces

Primary user-facing surface:

- Global search: `WorkspaceSearch` opens a
  shared dialog from navigation/mobile controls across all authenticated routes.
  It finds repeated names across province/district/tambon levels and active tools,
  with aliases, topics, filters and clearable per-account browser history.
  See [Search behavior](SEARCH_BEHAVIOR.md). Existing scoped map search remains available.

- `NakhonRatchasimaWorkspace`: province -> district -> subdistrict operational
  drill-down for canonical province `TH-P29`, with 32 districts and 289
  subdistricts. Operational intent has one valid-month selector, neutral unavailable
  map and source-state disclosure. In archive intent, map coloring switches between archived forecast risk
  and workbook irrigation status. Catalog entries for other data families are
  not evidence of active map layers.
- Explicit archive pages at province, district, and subdistrict level include the shared
  source-backed forecast archive experience: origin/base month T selection, one T+
  horizon selector, archive summary metrics, shared map filters, the local
  Nakhon map and source/limitation wording. Province/district pages have a
  six-month percent/count bar graph; a tambon page shows its own forecast status,
  not a multi-tambon aggregate. Supabase supplies scoped rev03 data using the
  same semantics across all geography levels.
- Archive Home is a compact T+1 overview with district filtering, risk counts and links
  to high-risk tambons. Agriculture panels require real source records and are
  currently hidden; cleared research panels are not restored as placeholder data.
- `ForecastExcelExport` opens a filtered workbook dialog. It includes all six
  horizons, district/tambon sheets, formula-driven analysis, chart, PivotTable,
  typed data/dictionary and optional same-target comparison across origin rounds.
  See `FORECAST_EXCEL_EXPORT.md` for limits; it is not an online general BI tool.

Inherited nationwide/workflow components remain in source for later extraction
or reuse, but they are not exposed through the initial Korat Tan Phai sidebar.

Database mode adds a shared bookmark control in the desktop/mobile account
toolbar, not a new route. Its modal lists followed areas and saved filters for
the authenticated user. Following an area is independent of actual/archive intent;
named forecast filters require an explicit archive selection. Restoring a forecast
filter preserves source month T, horizon,
area, map risk and irrigation, including restoration on the same pathname. Existing and new
links/saved filters keep the same source-row values; legacy `target` query and
saved `target_period` keys still identify T, with forward dates derived at runtime.

## Admin / Internal Routes

FACT: There are no protected admin routes. Admin/operator roles are simulated
personas in the same SPA:

- National agricultural officer
- Provincial agricultural officer
- District agricultural officer
- Extension officer
- Analyst
- Water/irrigation authority
- Supervisor/approver
- Farmer

PROPOSAL: If real admin access is added, operator/admin routes should be
protected and separated from the public resident route.

## Hidden / Legacy / Compatibility Routes

FACT: `/nakhon-ratchasima`, `/nakhon-ratchasima/{district-slug}`, and
`/nakhon-ratchasima/{district-slug}/{subdistrict-slug}` remain supported as
legacy aliases so old Kaset Tan Phai links do not break.

## Indexing / Noindex Behavior

FACT:

- `index.html` does not currently include a `robots` noindex directive.
- There is no `robots.txt` in `public/`.
- There is no route-specific metadata system.

needs audit:

- Confirm whether `https://korattanphai.vercel.app` should be publicly indexed
  while it is a prototype.
- Add `robots.txt` or metadata only after that decision.

## Navigation Contracts

- Sidebar/nav exposes overview, drought and database-only Excel export.
- Visible UI is Thai-only; there is no language switch in the product surface.
- Reset Demo Data restores seed state through `resetDemo`.
- Login redirects unauthenticated direct links to `/login`, then returns to the
  requested path after successful Supabase email/password authentication.
- Opening `/` hides the inherited nationwide filter band; the local workspace
  owns its layer selector and breadcrumbs.
- Operational controls select valid month and area; actual has no T+ selector.
  Archive controls select origin month and area, with one horizon strip. Hazard `ภัยแล้ง`
  and crop `ข้าว` are fixed context, not working multi-hazard/multi-crop selectors.
  Province chooses districts; district/tambon views choose tambons in that district.
  Map controls also filter risk and irrigation, with an independent color mode.
- Drought archive controls use source/base month T + T+ horizon as the primary
  navigation state, following the user's 2026-09-06 confirmation that source
  rows are forecast origins. Changing T+ preserves T and changes the actual
  target month to T+horizon. Selectable T spans June 2015-December 2025; for
  December 2025, T+1-T+6 target January-June 2026. A no-data/out-of-scope archive
  combination must remain visibly distinct from no-risk.
- Nakhon Ratchasima route slugs are navigation-only. Data joins must use admin
  codes.
- Rainfall helpers remain parked. Any future reactivation must distinguish
  nearest-station context from a direct local gauge reading.
- Legacy `/nakhon-ratchasima/...` links may load directly, but in-app route
  actions should generate the shorter Nakhon Ratchasima-only paths.

## Screens / Components By Surface

- Login/history: `src/App.tsx`; authenticated shell: `src/AuthenticatedApp.tsx`.
- Operational routes: `src/components/nakhon-ratchasima/OperationalDroughtWorkspace.tsx`.
- Archive Home: `src/components/nakhon-ratchasima/ProvinceForecastOverview.tsx`.
- Shared drought layout: `src/components/nakhon-ratchasima/DroughtForecastWorkspace.tsx`.
- Shared controls: `ForecastControls.tsx` and `DroughtOperationalWorkspace.tsx`
  in the same directory; graph: `ForecastRiskBarGraph.tsx`; map:
  `NakhonRatchasimaLocalMap.tsx`.
- Excel dialog: `src/components/ForecastExcelExport.tsx`; saved-workspace dialog:
  `src/components/WorkspaceBookmarks.tsx`.
- Nakhon Ratchasima workspace: `NakhonRatchasimaWorkspace` in
  `src/components/NakhonRatchasimaWorkspace.tsx`.
- Legacy `OverviewSection`, `RisksSection`, `MapSection`, `ForecastSection`,
  `CropsSection`, `WorkflowSection`, `AlertsSection`, `FarmerExperience`,
  `PlanningAnalyticsSection` and `DataModelsSection` remain in
  `src/AuthenticatedApp.tsx`, but are not the current workspace route surfaces.

## Do Not Regress

- Thai labels must remain complete for all primary controls.
- Do not reintroduce an EN web version unless the product owner explicitly asks
  for it.
- Mobile navigation must avoid horizontal overflow.
- Map controls must remain keyboard reachable.
- Page sections must be reachable without relying on hover-only behavior.
- Nakhon Ratchasima unseeded subdistricts must show an explicit no-data state,
  not a normal/green state.
- Rainfall station coverage must not hide the no-data rule for local evidence:
  a subdistrict can have a nearest station and still have no local impact
  evidence.
- Forecast archive blank cells mean out of scope, not no-risk. Missing joined
  archive records are separate source/join problems and must not render as
  green, normal, or complete.
- Public/resident alert copy must remain action-oriented and low-jargon.
