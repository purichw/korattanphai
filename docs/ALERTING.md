# เกษตรทันภัย Alerting Contract

## Current Alerting Model

FACT: Alerting is simulated in frontend runtime state.

- Risk events live in `src/data/canonical/risk_events.json`.
- Event enrichment and recommended actions live in
  `src/data/canonical/event_detail_enrichment.json`.
- Advisory seed data lives in `src/data/canonical/advisory.json`.
- Farmer alert is created by `publishAdvisory` in `src/store.tsx`.
- Delivery records are deterministic demo records from `buildDeliveryRecords`.
- Data source families live in `src/data/canonical/source_registry.json`.
- Map layer provenance and no-data semantics live in
  `src/data/canonical/map_layer_catalog.json`.

There is no real broadcast, push notification, SMS, email, LINE, IVR, or receipt
system.

## Severity Taxonomy

Current levels:

- `Normal`: baseline or no current action required.
- `Watch`: monitor, prepare, or check local conditions.
- `Warning`: action is likely needed for affected areas.
- `Severe`: urgent action or prioritization needed.

Implementation:

- Type: `Severity` in `src/types.ts`.
- Ordering: `severityOrder` in `src/domain.ts`.
- Labels: `severityLabel` in `src/i18n.ts`.
- Map colors: `severityFill` in `src/components/RiskMap.tsx`.

Do not change taxonomy without updating tests, map colors, Thai labels, and
public copy.

## Geographic Area Model

Current alert geography can reference:

- Country
- Province
- District
- Subdistrict
- Village
- Farm

Public alert UI currently centers on province and seeded demo farm flows.
Nakhon Ratchasima adds local drill-down routes for the existing province
`TH-P29`, with 32 districts and 289 subdistricts as operational context.

Rules:

- Show the most specific trustworthy area.
- Do not imply district/subdistrict precision unless seeded or verified.
- For Nakhon Ratchasima local pages, use admin codes for joins and show
  inherited province/regional context separately from direct local evidence.
- Nakhon Ratchasima rainfall pages may show direct station coverage or nearest
  station representative context. Nearest-station context is not a direct
  subdistrict rainfall measurement.
- Missing local evidence must be described as not yet available; it must not be
  rendered as normal, green, or low risk.
- Keep province names in Thai in Thai mode.

## Source Data Freshness

Current facts:

- Header displays an as-of date of 25 Aug 2026 in Thai mode.
- Canonical data covers `2025-01` to `2026-10`.
- Data model registry exposes freshness labels per model record.

needs audit:

- Real source update cadence.
- Time of last ingest per official source.
- Station-specific live rainfall access for DWR EWS or another approved source
  before showing 24-hour rainfall values.
- Whether timestamps should be shown in Thai Buddhist year, Gregorian year, or
  both for official compliance.

## Data Provenance

Rules:

- Distinguish real context from synthetic prototype scores.
- Do not attach official source names to synthetic local scores as if official.
- Every public alert should expose source context, local assessment, and data
  mode/freshness where practical.

Current provenance is shown in:

- Risk event evidence summary.
- Map selected province notes.
- Map layer selector and selected-layer summary.
- Data/model registry.
- Crop presence rule note.

Availability wording must keep these states separate:

- no seeded data
- source unavailable
- layer unsupported by the selected filter
- explicit low risk
- available layer data
- direct rainfall station in area
- nearest rainfall station as representative context
- no confirmed current rainfall observation

## False-Positive / False-Negative Risk

Public-safety copy must acknowledge uncertainty.

False positive risk:

- Residents or operators may over-allocate resources or take unnecessary action.
- Mitigation: show confidence, local verification status, and practical
  confirmation steps.

False negative risk:

- People may miss a hazard if risk is understated or stale.
- Mitigation: show freshness, source limitations, and escalation paths.

Do not present prototype severity as a guaranteed prediction.

## Public-Safety Wording

Required alert content before operational use:

- What is happening.
- Where it applies.
- When it applies.
- Severity.
- Confidence/uncertainty.
- Source/freshness.
- Clear action.
- Who should act.
- Where to get official follow-up.

Style:

- Thai-first.
- Plain, formal, direct.
- Avoid jargon when residents are the audience.
- Avoid panic language.
- Avoid certainty where data is synthetic, stale, or unverified.

## Accessibility During Emergencies

- Pair colors with text labels.
- Keep messages short and scannable.
- Support mobile reading at narrow widths.
- Avoid hover-only disclosure for critical information.
- Ensure buttons and alerts are keyboard reachable.

## Offline / Low-Bandwidth Behavior

FACT: No offline support exists.

needs audit:

- Service worker and cached last-known alerts.
- Low-bandwidth text-only mode.
- Provider failover for notification channels.

## Timestamp / Timezone Display

Current app uses:

- Thai Buddhist year formatting in Thai mode for months.
- `formatAuditTime` in `src/i18n.ts` for audit timestamps.
- Header as-of date text.

Requirement:

- Operational alerts must show timezone explicitly, likely Asia/Bangkok.
- Do not mix generated runtime timestamp with official source timestamp.

## Audit Trail

Current facts:

- Seed audit trail lives in event enrichment JSON.
- Runtime audit trail is local in `RuntimeState.eventAuditTrail`.
- Actions are appended by reducer transitions.

Operational requirement:

- Audit trail must become append-only server data before real approvals or
  publications.
