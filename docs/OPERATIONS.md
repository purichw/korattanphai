# โคราชทันภัย Operations

Updated: **2026-09-09**. Start with the [NFR operations runbook](NFR_OPERATIONS_RUNBOOK.md)
for checks, incidents, job replay, backup/restore and activation. Acceptance
targets and owner roles live in [NON_FUNCTIONAL_REQUIREMENTS.md](NON_FUNCTIONAL_REQUIREMENTS.md).

## Current Operations Model

The legacy advisory, approval and notification workflows below remain
simulated. Supabase login, forecast reads and personal saved workspaces have
separate real persistence; the simulated personas do not grant permissions.

The new machine-authenticated model-input API and legacy collector are locally
testable; see [API.md](API.md#model-inputs-local-system-bridge) for setup,
source mappings, immutable batch reads and the prepared Supabase migration.
Source-scoped quotas, request correlation, health probes, opt-in telemetry,
resumable input jobs and bounded backup/restore tools are now implemented.
No actual local/ThaiWater feed, provider dashboard, remote monitoring destination,
notification recipient or ingest schedule has been activated by this work.
Prepared migrations and environment settings still need operator activation.

## Actual NFR Ownership / ผู้รับผิดชอบงานระบบจริง

These are roles to assign, separate from the simulated personas below.

| Role | ความรับผิดชอบ / Responsibility | Operational evidence |
| --- | --- | --- |
| Platform operator | ระบบเปิดได้ โควตา log และการแจ้งเหตุ / Availability, quotas, logs and escalation wiring. | Monitor run + dependency check + tested recipient. |
| Integration operator | เก็บและส่งข้อมูลซ้ำอย่างถูกต้อง / Collector cadence, frozen job replay and retained evidence. | Run ID, input hash and verified API receipt. |
| Data steward | รับรองนิยามเวลา หน่วย พื้นที่ และคุณภาพ / Approve source timing, units, geography and quality policy. | Versioned source agreement and freshness thresholds. |
| Model lead | ตัดสินความพร้อมของ input และรับผิดชอบผลโมเดล / Feature readiness and team-operated model output. | Frozen input manifest and model validation; V2 is still a design. |
| Database operator | สำรองและซ้อมกู้ทั้งฐานข้อมูลและไฟล์ / Full database/asset backup and isolated restore. | Restore report with actual coverage and measured recovery time. |
| Release/QA owner | รับหลักฐาน regression และควบคุมการปล่อยรุ่น / Review regression evidence and release controls. | Artifact identity, required CI checks and deployment smoke. |

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

- A JSON/CSV collector, input API and one-shot resumable job wrapper exist; no
  live ingest job is scheduled.
- Job freshness reports separately evaluate observation-window age and fetch
  age. Missing thresholds mean `unknown`; historical mode is explicit.
- This local report is not yet connected to the dashboard's fixture provenance
  text and is not provider availability monitoring.
- Nakhon Ratchasima rainfall station coverage is static fixture data.
  No live rainfall readings or province water-provider snapshots are ingested
  into the app yet.

Operational requirement:

- Track latest successful run, input hash, source observation interval, fetch
  and receipt separately. Rainfall, satellite composite and crop statistics
  require different owner-approved arrival/freshness expectations.
- For rainfall, track station timestamp, accumulation window, unit `mm`, quality
  flag, and whether a value is direct or nearest-station representative context.
- Show stale banners when data exceeds accepted age.
- The model lead must hold live publication when required evidence fails its
  policy. Current input ingestion stores data and reports freshness; it does
  not implement an alert gate or silently downgrade hazard severity.
- Keep source timestamps separate from publication timestamps.

## Admin Audit

Current facts:

- Runtime audit is local and resettable.
- Seed audit trail is fixture data.
- Server completion logs and local ingest manifests are operational evidence;
  they are not append-only business approval/publication audit records.

Operational requirement:

- Use append-only server audit for verification, edit, approval, change request,
  publication, rollback, and cancellation.
- Include actor, role, jurisdiction, timestamp, before/after summary, and reason.

## Incident / Alert Operations

For website/dependency incidents use the NFR runbook severity, owner and
escalation steps. A passing liveness response only proves that the handler ran.
Private readiness checks one published archive metadata record; it does not
prove all rows, RLS user paths, current source freshness or forecast quality.

The opt-in repository monitor can fail a run and retain a sanitized report.
GitHub notification settings, recipient assignment and channel failover need
configuration and a delivery drill. No email, Slack or SMS incident delivery is
claimed by this implementation.

Before real public operations:

- Define alert owner.
- Define approval authority.
- Define escalation path.
- Define cancellation/correction path.
- Define how false positives and false negatives are reviewed.
- Define channel failover.

## Scheduled Jobs

No collector is scheduled automatically. Run `npm run model-inputs:demo` for a
synthetic local end-to-end check. For unattended operation use
`scripts/run-model-input-job.mjs` with a private persistent `--state-dir`, a
confirmed source config and freshness policy. The team's scheduler invokes
one run at the agreed cadence and observes the exit code. Failed submission
can resume using `--resume RUN_ID`; collection failure requires a new run because
there is no frozen batch yet. Full arguments and recovery rules are in the
[runbook](NFR_OPERATIONS_RUNBOOK.md#input-jobs-and-replay).

The job wrapper runs on one persistent worker host. It is not a Vercel `/tmp`
queue or a distributed scheduler. Never discard a pending batch because a POST
timed out; the receiver may already have persisted it.

needs audit:

- Data ingest cadence.
- Model refresh cadence.
- Alert expiry/archival job.
- Delivery retry job.
- Dashboard aggregation job.
- Source publication lag, independent raw-evidence retention, backup retention
  destination and quota budget for batch exports.

## Safe Production Work

- Do not deploy without explicit current-user instruction.
- Do not touch production data unless explicitly instructed.
- Run [RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md) before deploy.
- For public-safety wording, require human review before operational release.
- Record production smoke results in handoff notes when relevant.
