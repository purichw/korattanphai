# เกษตรทันภัย Notification Contract

## Current Notification Model

FACT: Notifications are simulated.

Publication channels in `src/App.tsx`:

- Web portal
- Farmer app
- Push
- SMS
- Email
- LINE-like channel
- PDF bulletin
- Voice / IVR

Selected channels are stored in `runtime.selectedChannels`.

Publishing:

- Requires advisory status `Approved`.
- Dispatches `publishAdvisory`.
- Creates demo `DeliveryRecord` rows.
- Creates one farmer alert linked to `ADV-2026-824` and `ARE-2026-0825-NE`.

## Delivery Guarantees

FACT: There are no real delivery guarantees.

The current UI shows demo delivery counts after publication. These counts must
not be interpreted as real sends, views, or acknowledgements.

Operational requirement:

- Each provider must return delivery status, failure reason, retry status, and
  timestamp.
- Acknowledgement must be separated from delivery and view.
- Analytics events must not be used as emergency delivery proof.

## Notification Payload Requirements

Future payloads should include:

- Alert ID.
- Advisory ID.
- Risk event ID.
- Severity.
- Geography.
- Valid from/to.
- Issued at with timezone.
- Source data timestamp.
- Public action text.
- Language.
- Channel.
- Version/hash of message content.

## Channel Rules

- SMS: short Thai text, no dependency on rich formatting.
- Push/farmer app: concise title, action-first body, deep link.
- LINE-like channel: concise summary and official follow-up link.
- PDF bulletin: printable, timestamped, versioned.
- Voice/IVR: plain language, no tables.
- Web portal: full detail with provenance and recommended actions.

needs audit:

- Which providers are actually approved for public alerts.
- Rate limits, retry windows, opt-out/consent model, and accessibility
  obligations.

## Retry / Failure Rules

FACT: Not implemented.

Future rules:

- Retry transient provider failures.
- Escalate partial-failure channels to operators.
- Never mark an alert as acknowledged only because it was delivered.
- Preserve failed payloads for audit with privacy controls.

## Do Not Hard-Code

If real notifications are added, do not hard-code:

- Provider credentials.
- Recipient lists.
- Delivery counts.
- Acknowledgement counts.
- Channel availability.
- Opt-in/opt-out status.
- Alert content outside source-of-truth advisory records.
