# โคราชทันภัย Analytics and Operational Measurement

## Current Analytics State

Updated: **2026-09-09**. No external product analytics provider or remote
operational event stream is claimed configured. The repo now implements
privacy-safe operational measurement, disabled by default on both browser and
server. See [API.md](API.md#operational-endpoints) for the exact payload types,
mandatory rules and samples; [NFR runbook](NFR_OPERATIONS_RUNBOOK.md) covers activation.

The Planning/Analytics section displays fixture outcome metrics from
`src/data/canonical/outcome_analytics.json`.

There is no GA4 or product behavior SDK. `src/operationalTelemetry.ts` reports
fixed technical event codes to `POST /api/telemetry` only when explicitly enabled.
The optional `web-vitals` import reports LCP/INP/CLS without attribution data.

## Operational Events — Implemented, Activation Required

| Event | Codes | Business meaning — TH / EN |
| --- | --- | --- |
| `runtime_error` | `RENDER_FAILED`, `UNHANDLED_ERROR`, `UNHANDLED_REJECTION` | รู้ว่าหน้าจอทำงานผิดพลาดโดยไม่เก็บข้อความผิดพลาด / Detect runtime failure without exception text. |
| `resource_error` | `RESOURCE_FAILED` | รู้ว่าทรัพยากรที่หน้าเว็บต้องใช้โหลดไม่ได้ / Detect a required resource failing to load. |
| `forecast_load` | `LOAD_OK`, `LOAD_FAILED`, `LOAD_TIMEOUT` | รู้เวลาและปัญหาโหลดข้อมูลพยากรณ์ / Measure archive loading and failure. |
| `map_load` | `LOAD_OK`, `LOAD_FAILED`, `LOAD_TIMEOUT` | รู้เวลาและปัญหาโหลดแผนที่ / Measure geometry loading and failure. |
| `web_vital` | `LCP`, `INP`, `CLS` | วัดการแสดงผล การตอบสนอง และการขยับของหน้า / Measure rendering, responsiveness and layout stability. |

Browser protections: `VITE_OPERATIONAL_TELEMETRY_ENABLED=true` is required;
Do Not Track disables reporting. Each document sends at most 20 events, at most
four concurrently and at most one event/code/route combination. Successful load
and Web Vitals events use a 10% document sample; errors are not sampled.
Requests omit credentials/referrer, use the same origin and a five-second
deadline, and do not retry. A failed telemetry request never blocks the page.

Server protections: `OPERATIONAL_TELEMETRY_ENABLED=true`, explicit origin
allowlist, valid body ≤1 KiB and the durable quota migration are required.
The shared browser bucket permits 1,000 accepted events/minute and 50,000/day;
it contains no user/IP key. Client counters are not a security boundary.
Platform/WAF limits are still required against unauthenticated abuse.

Only route category and viewport category are retained; viewport is CSS width
`<768` as `mobile`, otherwise `desktop`, not physical-device identification.
Never collect full routes, district IDs, URLs, queries, user/account identifiers,
IP addresses, form contents, stack traces, DOM targets, resource names, Web
Vitals attribution or metric IDs. Server access logs have a separate platform
privacy and retention policy.

## Interpretation and Acceptance / การแปลผล

Event counts are **not unique users, sessions or all page views**. Deduplication,
10% success/performance sampling, DNT, network loss and quotas change the
denominator. Do not divide unsampled failures by sampled successes to report a
user failure rate. Compare count trends only with the same instrumentation and
traffic context; use controlled probes for availability.

LCP/INP values are milliseconds; CLS is unitless. A p75 of collected samples
grouped by route and viewport is a diagnostic distribution, not a complete
population Core Web Vitals claim. Record sample count, time window and sampling
policy with every report. There is no measured 2026-09-09 field-performance
improvement merely because these counters exist. Historical lab timings remain
in [NON_FUNCTIONAL_REQUIREMENTS.md](NON_FUNCTIONAL_REQUIREMENTS.md).
Use `npm run report:operations -- --file <exported-jsonl>` for a local fixed-schema
summary: API request/p95 counters and vital p75 by route/viewport. It emits
`insufficient_samples` below 20 samples; a representative longer period is still
needed for an SLO. Input is a regular file ≤16 MiB; the tool does not fetch logs
or configure an external provider.

Operational owner roles: frontend owns event meaning, platform owns log access,
retention and collection availability, and privacy owner approves activation.
**Draft retention:** 14 days for operational raw JSONL and 90 days for aggregate
reports; no automated retention/deletion or external log destination is enabled
by this change. Agree the platform access-log policy separately.

## Current Outcome Metrics

`OutcomeMetric` in `src/types.ts` includes:

- `riskEventId`
- `predictedHighRiskAreaRai`
- `verifiedAffectedAreaRai`
- `advisoryReachPct`
- `fieldVerificationCompletionPct`
- `avgApprovalHours`
- `forecastConfidenceAtIssue`
- `interventionCompletionPct`
- `farmerAcknowledgementPct`
- `observedOutcome`
- `provenance`

These are prototype metrics and must stay labelled as such.

## Future Event Taxonomy

PROPOSAL:

- `risk_event_viewed`
- `map_province_selected`
- `filter_changed`
- `field_verification_submitted`
- `advisory_submitted_for_review`
- `advisory_approved`
- `advisory_changes_requested`
- `advisory_published`
- `farmer_alert_viewed`
- `farmer_alert_acknowledged`
- `persona_changed`

Do not collect personally identifiable data without a privacy review.

Current product decision: visible UI is Thai-only, so do not add
`language_changed` unless a future task explicitly restores a language switch.

## Operational Audit vs Analytics

Analytics answers product questions. Audit logs prove operational actions.

Do not use analytics events as:

- Approval records.
- Publication records.
- Delivery receipts.
- Emergency acknowledgement proof.
- Source-ingest evidence.

## Privacy Requirements

Product analytics and any future extensions must:

- Avoid raw farm/resident identifiers where possible.
- Avoid precise location unless operationally necessary and approved.
- Separate resident behavior analytics from operator audit logs.
- Respect applicable opt-out/consent requirements for the real authenticated users.

## Verification

Current verification:

- Operational schema and origin/payload/quota failures are covered by
  `tests/operations/endpoints.test.mjs`; browser projection/sampling/DNT behavior
  is covered by `tests/operationalTelemetry.test.ts`. Current run evidence is
  recorded with the NFR regression, not implied by test-file existence.
- `npm test` covers outcome-data import indirectly through domain tests.
- `npm run test:e2e` covers the visible planning path only if expanded in
  future.

needs audit:

- Define analytics owner and dashboard requirements before adding a provider.
