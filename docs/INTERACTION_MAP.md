# เกษตรทันภัย Interaction Map

## Main User Journeys

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

1. Operator opens `/nakhon-ratchasima` directly or from the nationwide map area
   profile.
2. Login gate returns the operator to the requested route after username entry.
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

- File: `WorkflowSection` in `src/App.tsx`.
- Seed values come from `FieldTask.seedObservation`.
- Submit action: `submitVerification`.
- Disabled after task status is `Submitted`.

Advisory action textareas:

- File: `WorkflowSection` in `src/App.tsx`.
- Runtime list: `runtime.advisoryActions`.
- Update action: `updateAdvisoryAction`.
- Submit review enabled only when task is submitted and advisory is `Draft Ready`
  or `Changes Requested`.

Publication channel checkboxes:

- File: `AlertsSection` in `src/App.tsx`.
- Runtime list: `runtime.selectedChannels`.
- Disabled after publication.

## Auth / Session Flow

FACT:

- The app has a frontend-only username gate in `src/auth.ts`.
- Use username `pointy` for local and production smoke checks.
- Accepted login state is persisted in
  `localStorage: korat-tan-phai-login-user`.
- Persona switching still simulates operational role and scope after login.
- Persona selection is persisted in `localStorage`.
- Persona fixture data does not contain passwords; the current login gate only
  checks the demo usernames in `src/auth.ts`.

PROPOSAL:

- Real auth must be added before operational use.
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
- Nakhon Ratchasima route bar exposes one deterministic hierarchy-back action:
  province returns to the nationwide map with Nakhon Ratchasima selected,
  district returns to the province workspace, and subdistrict returns to its
  parent district. Do not use browser history for this hierarchy.

## Emergency-Use Interaction Requirements

FACT: The current app is a prototype.

For production readiness, public-safety interactions must:

- Show timestamp and timezone on alert data.
- Show severity and what changed since the last update.
- Provide clear action steps, not only risk labels.
- Avoid relying on color alone.
- Remain readable at mobile widths and browser zoom.
- Communicate uncertainty and source freshness.
