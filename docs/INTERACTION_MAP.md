# Korat Tan Phai / โคราชทันภัย Interaction Map

## Active Product Journeys

Current navigation and ownership are in `APP_MAP.md`. The actual/archive split
below is deployed; see [release evidence](HANDOFF.md). Actual and operational
forecast feeds remain unconfigured, as recorded in
[ACTUAL_FORECAST_SEPARATION.md](ACTUAL_FORECAST_SEPARATION.md).

1. Supabase login restores the requested internal route and query without changing
   whether it describes operational valid month or explicit archive intent.
2. Operational Home/province/district/tambon routes have one valid-month selector.
   Server time chooses actual for past/current and forecast for future. Actual has
   no T+ strip. Source gaps stay unavailable; failed requests have retry, not a
   fabricated empty/zero-risk result. Current actual is labelled partial-month.
3. Changing month or browser Back/Forward updates one request context. Departed
   requests abort; late responses cannot recolor the new period. The shared map
   keeps its camera on period/family changes; geographic navigation can refit it.
4. Explicit archive entry retains origin T and horizons 1-6, deriving target T+h.
   Compact archive Home uses T+1; explicit later horizons open the full archive view.
   Missing origins do not substitute latest. Returning to operational exits archive
   criteria; no archived prediction becomes actual.
5. Archive map filters select risk and workbook irrigation; coloring can
   show forecast risk or irrigation status. Area previews lead to district or
   tambon routes. The locate-style icon returns to the area view, not device GPS.
6. Archive province/district graphs switch percent/count; tambon pages show one status.
   Risk-summary, attention and guidance disclosures open one at a time.
7. Saved workspaces persist owner-only areas and named archive filters in Supabase.
   Actual pages can follow an area but cannot save actual criteria as forecast filters.
8. Excel export explicitly opens the archive dialog, checks current revision and exports
   all six horizons; optional comparison aligns the same target calendar months.
   See `FORECAST_EXCEL_EXPORT.md` for workbook and cancellation behavior.

Agriculture/research panels require actual records; cleared/synthetic datasets
do not make them active. The nationwide, field-verification, farmer and delivery
journeys below describe retained prototype contracts, not available services.

## Retained Prototype Journeys

### Resident / Farmer Alert Journey

1. Operator publishes an approved advisory.
2. Runtime creates a farmer alert for `FARM-001`.
3. Farmer persona sees the alert card.
4. Farmer taps the alert to mark it read.
5. Farmer sees the top recommended actions from the advisory.

Current limitation: This is local demo state only. No real notification,
identity, acknowledgement receipt, or server audit exists.

### Local Operator Risk Review Journey

1. Operator opens Overview or Risk events.
2. Operator filters by month, hazard, crop, or province.
3. Operator selects a risk event.
4. Event detail shows severity, confidence, time window, owner, evidence,
   recommended actions, workflow state, and audit trail.
5. Operator opens field work or advisory workspace from the event.

### Nakhon Ratchasima Local Drill-Down Journey

Historical prototype flow below. Current paths/controls are the active product
journey above and `APP_MAP.md`; do not restore old data/readiness panels from
this description.

1. Operator opens `/nakhon-ratchasima` directly or from the nationwide map area
   profile.
2. Supabase login returns the operator to the requested internal route after email/password authentication.
3. Province view shows 32 districts, 289 navigable subdistricts, local layer
   selector, source freshness, and provenance guardrails.
   The visible layer selector hides water, flood, reservoir, weather, and
   rainfall layers while those catalog/data entries remain parked in source for
   future ingest and prediction work.
4. Operator opens a district, for example
   `/nakhon-ratchasima/wang-nam-khiao`.
5. District view shows child subdistricts and inherited province/regional
   context.
6. Operator opens a subdistrict, for example
   `/nakhon-ratchasima/wang-nam-khiao/t-302504`.
7. Subdistrict view shows drought status, data-readiness context, inherited
   evidence counts, and an explicit no-data state where local evidence is not
   seeded.

### Province Placeholder Journey

1. Operator opens the nationwide map and selects a province that is not yet
   locally seeded.
2. The preview/detail action opens `/{province-slug}` from canonical province
   routing data.
3. The workspace shows province-level filters and containers for situation,
   agriculture, and data readiness.
4. Placeholder copy must make the missing local evidence explicit. It must not
   translate missing district/subdistrict data into normal, low-risk, or zero
   rainfall states.

### Field Team Verification Journey

1. Open Field work.
2. Review assigned task and checklist.
3. Submit field observations.
4. Reducer marks `FV-0825-NE-01` as `Submitted`.
5. Reducer raises main event confidence to `High`.
6. Event status becomes `Verified / Advisory Ready`.

### Advisory / Approval Journey

1. Field verification must be submitted first.
2. Officer edits advisory actions if needed.
3. Officer submits advisory for review.
4. Supervisor approves or requests changes.
5. Approved advisory enables publication.

### Publication Journey

1. Open Alerts after advisory approval.
2. Choose channels.
3. Publish.
4. Reducer creates deterministic delivery records.
5. Reducer creates farmer alert linked to `ADV-2026-824`.
6. Main event status becomes `Published / Monitoring`.

## Admin / Operator Journeys

FACT: Admin behavior is simulated through personas. There is no secure role
enforcement.

Operator persona expectations:

- National officer: overview, event prioritization, publication readiness.
- เจ้าหน้าที่จังหวัด/อำเภอ: ตรวจสอบพื้นที่และแก้ไขคำแนะนำ.
- Extension officer: field task submission.
- Analyst: model/data registry and forecast reasoning.
- หน่วยงานน้ำ: ดำเนินการด้านชลประทานและบริหารจัดการน้ำ.
- Supervisor: approval or changes requested.

## Form Flows

Field verification form:

- File: `WorkflowSection` in `src/AuthenticatedApp.tsx` (legacy).
- Seed values come from `FieldTask.seedObservation`.
- Submit action: `submitVerification`.
- Disabled after task status is `Submitted`.

Advisory action textareas:

- File: `WorkflowSection` in `src/AuthenticatedApp.tsx` (legacy).
- Runtime list: `runtime.advisoryActions`.
- Update action: `updateAdvisoryAction`.
- Submit review enabled only when task is submitted and advisory is `Draft Ready`
  or `Changes Requested`.

Publication channel checkboxes:

- File: `AlertsSection` in `src/AuthenticatedApp.tsx` (legacy).
- Runtime list: `runtime.selectedChannels`.
- Disabled after publication.

## Auth / Session Flow

FACT:

- Supabase Email + Password replaces the retired username gate. The SDK owns
  session restore, token refresh and persistence; `src/useAuth.ts` subscribes
  to auth changes with cleanup and stale-result protection.
- The old `korat-tan-phai-login-user` value is removed, never accepted as auth.
- Login preserves internal `next` paths including query/hash, even if the
  login page is refreshed. External return URLs are rejected.
- Persona selection is persisted display context, not account permissions.
- See `AUTH_SETUP.md` for test-only mocks, logout error states and Preview checks.

PROPOSAL:

- Independently verify real-account authentication and backend settings before operational use.
- Role-sensitive actions must move to backend authorization.

## Error / Loading / Empty States

Current states:

- Map loading state: `กำลังโหลดแผนที่...`.
- Map error state: `ไม่สามารถโหลดแผนที่ได้`.
- No event matches filters.
- No urgent actions for current filters.
- No seeded drill-down for unseeded areas.
- Review disabled until field verification is submitted.
- Publish disabled until advisory approval.
- No delivery records before publication.
- No farmer alert before publication.
- Nakhon Ratchasima local map loading state for
  `/geodata/nakhon-ratchasima-subdistricts.geojson`.
- Nakhon Ratchasima local map error state if the subdistrict geometry file
  cannot load.
- Nakhon Ratchasima unseeded subdistrict no-data state: local evidence missing
  does not mean normal or low risk.

needs audit:

- Add failed delivery states before real notifications.
- Add stale data and offline banners before operational use.

## Navigation Behavior That Must Not Regress

- Sidebar section buttons must keep keyboard and pointer access.
- Control-band filters must preserve selected section.
- The visible app is Thai-only; do not reintroduce a TH/EN toggle without an
  explicit product decision.
- Farmer persona must not expose officer-only workflow surfaces.
- Reset Demo Data must restore deterministic state.
- Toasts must be dismissible.
- Map zoom/pan must stay bounded inside the map canvas so long-press or
  touchpad dragging cannot reveal page-level horizontal overscroll or move
  Thailand out of focus.
- Province, district, subdistrict, and future Bangkok district/subdistrict
  equivalents (`เขต`/`แขวง`) share the same wheel/touchpad zoom contract:
  vertical wheel input over the map zooms around the pointer quickly, while
  horizontal wheel input is contained so the page cannot drift sideways.
- Map province shapes must support click and keyboard Enter/Space selection.
- The initial province context must not render as a map selection. A thin halo
  appears only after explicit click or keyboard selection on a province shape.
- Desktop pointer users see a compact province preview card on hover before
  choosing a province. Clicking the polygon pins the province and updates the
  full detail panel.
- Touch users see the same lightweight preview as a compact bottom sheet on tap.
  The full detail panel changes only after tapping `ดูรายละเอียด`.
- Nakhon Ratchasima map shapes are buttons and navigate to district/subdistrict
  routes. Their evidence status is visual support only; source/evidence cards
  carry the operational wording.
- When the rainfall layer is selected, map preview actions may open subdistricts
  with direct station or nearest-station coverage. Other layers should preserve
  their existing no-data/action gating.
- Nakhon Ratchasima breadcrumbs must remain usable on mobile and should not
  require the nationwide filter band.
- Active hierarchy-back actions are deterministic: province drought returns to
  Home, district to province drought, and tambon to its parent district. Home
  has no nationwide back action. Do not use arbitrary browser history for this
  hierarchy.

## Emergency-Use Interaction Requirements

FACT: The current app is a prototype.

For production readiness, public-safety interactions must:

- Show timestamp and timezone on alert data.
- Show severity and what changed since the last update.
- Provide clear action steps, not only risk labels.
- Avoid relying on color alone.
- Remain readable at mobile widths and browser zoom.
- Communicate uncertainty and source freshness.
