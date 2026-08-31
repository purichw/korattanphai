# เกษตรทันภัย Analytics

## Current Analytics State

FACT: No analytics provider is configured.

The Planning/Analytics section displays fixture outcome metrics from
`src/data/canonical/outcome_analytics.json`.

There is no GA4, product analytics SDK, server analytics endpoint, or production
event stream in the current repo.

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

Future analytics must:

- Avoid raw farm/resident identifiers where possible.
- Avoid precise location unless operationally necessary and approved.
- Separate resident behavior analytics from operator audit logs.
- Respect opt-out/consent requirements once real users exist.

## Verification

Current verification:

- `npm test` covers outcome-data import indirectly through domain tests.
- `npm run test:e2e` covers the visible planning path only if expanded in
  future.

needs audit:

- Define analytics owner and dashboard requirements before adding a provider.
