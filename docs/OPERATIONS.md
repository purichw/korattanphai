# เกษตรทันภัย Operations

## Current Operations Model

FACT: Operations are simulated in a frontend prototype.

There are no real operator accounts, permissions, provider dashboards, incident
queues, live monitoring, scheduled jobs, or production data writes.

## Operator Roles

Simulated personas from `src/data/canonical/users.json`:

- National agricultural officer
- Provincial agricultural officer
- District agricultural officer
- Agricultural extension officer
- Agricultural / climate analyst
- Water / irrigation authority
- Supervisor / approver
- Farmer

## Operational Workflows

Current workflow chain:

1. Risk event selected.
2. Field task submitted.
3. Advisory submitted for review.
4. Supervisor approves or requests changes.
5. Approved advisory is published.
6. Delivery demo records and farmer alert are created.

Key IDs:

- `ARE-2026-0825-NE`
- `FV-0825-NE-01`
- `ADV-2026-824`
- `FARM-001`

## Source Freshness Operations

Current facts:

- No ingest jobs exist.
- No source health monitoring exists.
- Freshness is fixture text in model/data records.
- Nakhon Ratchasima rainfall station coverage is static fixture data.
  `official_water_snapshot.json` is a point-in-time ThaiWater province/station
  snapshot; no live rainfall readings are ingested into the app yet.

Operational requirement:

- Track latest source ingest per provider.
- For rainfall, track station timestamp, accumulation window, unit `mm`, quality
  flag, and whether a value is direct or nearest-station representative context.
- Show stale banners when data exceeds accepted age.
- Freeze or downgrade alerts when evidence is stale.
- Keep source timestamps separate from publication timestamps.

## Admin Audit

Current facts:

- Runtime audit is local and resettable.
- Seed audit trail is fixture data.

Operational requirement:

- Use append-only server audit for verification, edit, approval, change request,
  publication, rollback, and cancellation.
- Include actor, role, jurisdiction, timestamp, before/after summary, and reason.

## Incident / Alert Operations

Before real public operations:

- Define alert owner.
- Define approval authority.
- Define escalation path.
- Define cancellation/correction path.
- Define how false positives and false negatives are reviewed.
- Define channel failover.

## Scheduled Jobs

FACT: None exist.

needs audit:

- Data ingest cadence.
- Model refresh cadence.
- Alert expiry/archival job.
- Delivery retry job.
- Dashboard aggregation job.

## Safe Production Work

- Do not deploy without explicit current-user instruction.
- Do not touch production data unless explicitly instructed.
- Run [RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md) before deploy.
- For public-safety wording, require human review before operational release.
- Record production smoke results in handoff notes when relevant.
