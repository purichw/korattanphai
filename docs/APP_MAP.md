# Korat Tan Phai / โคราชทันภัย App Map

## Routing Model

FACT: The app is served by Vite/Vercel as a React single-page app with
client-side route handling in `src/App.tsx`. In this Nakhon Ratchasima-only
subset, `/` opens the local province workspace directly and the primary sidebar
starts with only `ภาพรวม`.

Routes:

- `/login`: frontend-only username gate.
- `/`: province-level Nakhon Ratchasima overview.
- `/water`: province-level water situation tab.
- `/drought`: province-level drought context tab.
- `/{district-slug}`: district-level drill-down.
- `/{district-slug}/{subdistrict-slug}`: subdistrict-level drill-down.
- `/nakhon-ratchasima/...`: legacy alias accepted for old links.

Other province placeholder routes are not part of this subset's primary
navigation.

## User-Facing Surfaces

Primary user-facing surface:

- `NakhonRatchasimaWorkspace`: province -> district -> subdistrict operational
  drill-down for canonical province `TH-P29`, with 32 districts and 289
  subdistricts. It includes the `ปริมาณฝนและสถานี` layer for DWR EWS station
  coverage and nearest-station representative context.

Inherited nationwide/workflow components remain in source for later extraction
or reuse, but they are not exposed through the initial Korat Tan Phai sidebar.

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
- `/login` is a separate demo username gate. Current province and drill-down
  routes can also load directly as public prototype pages.
- Opening `/` hides the inherited nationwide filter band; the local workspace
  owns its layer selector and breadcrumbs.
- Nakhon Ratchasima local controls mirror the nationwide select component:
  province/district views show month, hazard, crop, and subdistrict filters;
  subdistrict views show month, hazard, and crop only.
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
- Public/resident alert copy must remain action-oriented and low-jargon.
