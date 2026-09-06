# Korat Tan Phai / โคราชทันภัย App Map

## Routing Model

FACT: The app is served by Vite/Vercel as a React single-page app with
client-side route handling in `src/App.tsx`. In this Nakhon Ratchasima-only
subset, `/` opens the local province workspace directly and the primary sidebar
starts with only `ภาพรวม`.

Routes:

- `/login`: Supabase Email + Password; internal-only return paths preserve query/hash.
- `/`: province-level Nakhon Ratchasima overview.
- `/drought`: province-level drought context page.
- `/{district-slug}`: district-level drill-down.
- `/{district-slug}/{subdistrict-slug}`: subdistrict-level drill-down.
- `/nakhon-ratchasima/...`: legacy alias accepted for old links.

Other province placeholder routes are not part of this subset's primary
navigation.

## User-Facing Surfaces

Primary user-facing surface:

- `NakhonRatchasimaWorkspace`: province -> district -> subdistrict operational
  drill-down for canonical province `TH-P29`, with 32 districts and 289
  subdistricts. Its visible map selector is scoped to agriculture risk, drought,
  planning, operations, and data-readiness layers; water, flood, reservoir,
  weather, and rainfall catalog entries are retained in source but hidden from
  the current product UI.
- Drought pages at province, district, and subdistrict level include the shared
  source-backed forecast archive experience: origin/base month T selection, one T+
  horizon selector, archive summary metrics, shared map filters, the local
  Nakhon map, trend context, readiness, and source/limitation disclosures. These
  pages use the same archive fixture and semantics across all three geography
  levels.

Inherited nationwide/workflow components remain in source for later extraction
or reuse, but they are not exposed through the initial Korat Tan Phai sidebar.

Database mode adds a shared bookmark control in the desktop/mobile account
toolbar, not a new route. Its modal lists followed areas and saved filters for
the authenticated user. Restoring an item preserves source month T, horizon,
area and map risk, including restoration on the same pathname. Existing and new
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

- Sidebar/nav starts with only `ภาพรวม` for this subset.
- Visible UI is Thai-only; there is no language switch in the product surface.
- Reset Demo Data restores seed state through `resetDemo`.
- Login redirects unauthenticated direct links to `/login`, then returns to the
  requested path after accepted username entry.
- Opening `/` hides the inherited nationwide filter band; the local workspace
  owns its layer selector and breadcrumbs.
- Nakhon Ratchasima local controls mirror the nationwide select component:
  province/district views show month, hazard, crop, and subdistrict filters;
  subdistrict views show month, hazard, and crop only.
- Drought archive controls use source/base month T + T+ horizon as the primary
  navigation state, following the user's 2026-09-06 confirmation that source
  rows are forecast origins. Changing T+ preserves T and changes the actual
  target month to T+horizon. Selectable T spans June 2015-December 2025; for
  December 2025, T+1-T+6 target January-June 2026. A no-data/out-of-scope archive
  combination must remain visibly distinct from no-risk.
- Nakhon Ratchasima route slugs are navigation-only. Data joins must use admin
  codes.
- Nakhon Ratchasima rainfall layer navigation may open subdistrict detail for
  both direct-station and nearest-station records. The detail screen must label
  nearest-station data as representative context, not as a local gauge.
- Legacy `/nakhon-ratchasima/...` links may load directly, but in-app route
  actions should generate the shorter Nakhon Ratchasima-only paths.

## Screens / Components By Surface

- App shell: `AppShell` in `src/App.tsx`.
- Navigation and filters: `AppShell` in `src/App.tsx`.
- Overview: `OverviewSection`.
- Risk events: `RisksSection`.
- Map: `MapSection` plus `RiskMap` in `src/components/RiskMap.tsx`.
- Forecast: `ForecastSection`.
- Crops: `CropsSection`.
- Field workflow: `WorkflowSection`.
- Alerts and publication: `AlertsSection`.
- Farmer view: `FarmerExperience`, `FarmerCard`.
- Planning/analytics: `PlanningAnalyticsSection`.
- Data/model registry: `DataModelsSection`.
- Nakhon Ratchasima workspace: `NakhonRatchasimaWorkspace` in
  `src/components/NakhonRatchasimaWorkspace.tsx`.
- Drought forecast archive: `DroughtForecastArchivePanel`,
  `DroughtForecastArchiveHorizonSelector`,
  `DroughtForecastArchiveSummaryMetrics`, `DroughtForecastArchiveMapFilters`,
  and `NakhonRatchasimaLocalMap` in
  `src/components/NakhonRatchasimaWorkspace.tsx`.

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
