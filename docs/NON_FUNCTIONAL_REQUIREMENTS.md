# เกษตรทันภัย Non-Functional Requirements

## Security

Current facts:

- No real auth, secrets, database, or server mutations exist.
- One read-only Vercel endpoint exists for production risk-fusion explanation.
- Persona switching is not authentication.
- Persona fixture data must not contain passwords.
- `.env` and `.env.local` are ignored by git.
- Production deploys use `npm run build:protected`, which disables source maps,
  obfuscates generated JavaScript assets after Vite build, and checks for
  blocked literals in `dist`.

Requirements before operational use:

- Add real authentication and authorization for operators.
- Server-enforce approval, publication, and notification permissions.
- Keep API keys and provider credentials out of the client bundle.
- Add append-only audit logs for operator actions.

## Privacy

Current facts:

- No real personal data should be stored.
- Farmer data is demo fixture data.
- Runtime state stays in local browser storage.

Requirements:

- Do not store real resident/farmer contact details in frontend fixtures.
- Minimize location precision for public users when precise farm data is not
  necessary.
- Define retention and deletion rules before adding real acknowledgement data.

## Performance

Current facts:

- Vite build succeeds.
- The client bundle currently includes large canonical JSON and emits a Vite
  chunk-size warning.
- The map is an inline SVG generated from static GeoJSON.

Requirements:

- Keep first usable render fast on mobile.
- Avoid blocking the alert view on heavy analytics/model panels.
- Consider lazy-loading canonical data or map data if bundle size becomes a
  measurable issue.
- Test mobile width and low-bandwidth conditions before operational launch.

## Accessibility

Requirements:

- Thai text must be readable, wrap safely, and not require English knowledge.
- Do not rely on color alone for severity.
- Map provinces must remain keyboard selectable.
- Controls need visible focus states and accessible labels.
- Public alerts must be understandable at mobile width and browser zoom.
- Emergency content should use direct action language and avoid dense jargon.

Current facts:

- Focus-visible styles exist in `src/styles.css`.
- Map paths support `role="button"`, `tabIndex`, click, and Enter/Space.
- Playwright covers desktop and mobile smoke flows.

needs audit:

- Screen-reader order for SVG map and dense data panels.
- Forced-colors and high-contrast mode.
- Full keyboard-only workflow for publication.

## Reliability

Current facts:

- All runtime workflow state is local to one browser.
- No delivery retries or server persistence exist.
- Reset Demo Data returns to deterministic seed state.

Requirements before operational use:

- Data freshness indicators for every live source.
- Stale data handling and degraded mode.
- Provider outage states for notifications.
- Server-side audit and replay-safe publication operations.

## Observability / Analytics

Current facts:

- No analytics provider is configured.
- Outcome analytics shown in the UI is fixture data.

Requirements:

- Track only privacy-safe events.
- Separate operational audit logs from product analytics.
- Never use analytics as delivery confirmation for life/safety alerts.

See [ANALYTICS.md](ANALYTICS.md).

## Backup / Restore

Current facts:

- Source code and fixtures are in git.
- Local runtime state can be reset.
- No production database exists.

Requirements before backend launch:

- Define backup cadence for alert, advisory, source-ingest, and audit data.
- Test restore before relying on live operations.
- Keep rollback paths documented in [RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md).

## Release Requirements

- Use `$release-gate` before commit, push, deploy, or release.
- Run `npm run build`, `npm run build:protected`, `npm test`, and
  `npm run test:e2e`.
- For UI changes, capture desktop and mobile evidence.
- For production deploys, smoke the deployed URL, not only local build.
- For alerting/public-safety copy, review severity, provenance, timestamp, and
  recommended actions before release.
