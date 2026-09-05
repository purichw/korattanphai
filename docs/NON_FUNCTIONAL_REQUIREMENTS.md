# เกษตรทันภัย Non-Functional Requirements

## Security

Current facts:

- Supabase Email + Password passed real-account production smoke on 2026-09-05;
  self-signup is disabled. Database/RLS remain unaudited. No data provider or
  privileged secrets are added.
- One read-only Vercel endpoint exists for production risk-fusion explanation.
- Persona switching is not authentication.
- Persona fixture data must not contain passwords.
- `.env` and `.env.*` are ignored by git except placeholder `.env.example`.
- Production deploys use `npm run build:protected`, which disables source maps,
  obfuscates generated JavaScript assets after Vite build, and checks for
  blocked literals in `dist`.
- Identifier obfuscation and string tables remain enabled. Base64 encoding and
  runtime string-array rotation are disabled because CPU profiling found costly
  startup decoding and allocation after changes to bundle composition. The
  existing source-map and blocked-literal exposure checks still apply.

Requirements before operational use:

- Verify real-account authentication and server-side authorization for operators.
- Server-enforce approval, publication, and notification permissions.
- Keep privileged keys and provider credentials out of the client bundle; only
  the Supabase browser publishable key belongs in Vite environment variables.
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
- Login is a separate startup chunk; the authenticated dashboard and its
  canonical imports load only after login. Startup JavaScript has a 125,000-byte
  gzip budget, including static transitive imports. Build checks also validate
  JavaScript chunk references after protection/renaming.
- The client bundle still includes other canonical JSON and emits a Vite
  chunk-size warning. The forecast archive is now a separate content-hashed
  JSON asset, fetched only for drought/district/subdistrict views.
- The concurrent overview update uses a generated T+1-only archive subset with
  its own cache. Full T+1 through T+6 data remains deferred to detail views.
- Protected builds enforce total JavaScript of 3,500,000 raw bytes, application
  gzip of 370,000 bytes and an additional bounded 105,000-byte gzip lazy
  Supabase SDK chunk. The SDK loads during session checking; it is additional
  to the static startup import budget. `npm run check:bundle` also verifies
  that the emitted archive exactly matches its canonical source.
- The map is an inline SVG generated from static GeoJSON.

Requirements:

- Keep first usable render fast on mobile.
- Avoid blocking the alert view on heavy analytics/model panels.
- Consider lazy-loading canonical data or map data if bundle size becomes a
  measurable issue.
- Test mobile width and low-bandwidth conditions before operational launch.

Repeatable local checks:

```bash
npm run build:protected
npm run test:e2e:built
npm run measure:load -- after
```

`test:e2e:built` serves the current `dist` on port 4174 and runs desktop/mobile
regressions against it, including deferred loading, failed-load retry and
navigation during a pending request. Build first; this command does not rebuild.
`measure:load` serves `dist` on port 4173, runs three fresh-browser samples for
login, overview and drought at 390x844 with CPU throttled 4x, and saves JSON plus
a drought screenshot under `/tmp/korattanphai-nfr-<label>*`. It measures visible
login/map readiness, not field Core Web Vitals. Network is localhost without
mobile bandwidth throttling by default. Both commands close their server/browser on exit
and require local port and Chromium permissions.

Set `NFR_ISOLATE_FONTS=1` for controlled CPU comparisons that serve an empty
Google Fonts stylesheet (system-font fallback on both builds), and
`NFR_DIST_DIR=/absolute/path/to/dist` to measure a separately built baseline.
Do not treat those screenshots as production font evidence. JSON reports also
include per-resource durations and Chrome CPU metrics to separate network waits
from script execution. Keep normal-font UI evidence separately.

Set `NFR_MOBILE_NETWORK=1` to simulate 1.6 Mbps download, 0.75 Mbps upload and
150 ms latency. That mode serves JS/CSS/JSON/GeoJSON with gzip so comparisons
measure compressed transfer instead of Vite's uncompressed preview responses.
It is a reproducible lab simulation, not a measurement on a physical phone.

First archive-loading pass, 2026-09-05 baseline against `440b707`, three samples per route:

| Metric | Before | After |
| --- | ---: | ---: |
| Protected JavaScript bytes | 4,914,168 | 3,005,909 |
| Protected JavaScript gzip bytes | 452,547 | 332,810 |
| Login visible, median | 423 ms | 317 ms |
| Overview map visible, median | 1,524 ms | 1,387 ms |
| Drought map visible, median | 1,527 ms | 1,512 ms |

Timing conditions: 390x844, CPU 4x, cold browser cache, localhost, external
font stylesheet replaced by an empty response on both builds. These are local
diagnostics, not real-device/low-bandwidth or field-performance guarantees.
The drought difference is too small to claim a speedup. The separate archive
adds 128,302 gzip bytes on forecast routes, so total cold forecast JS+archive
transfer is 461,112 bytes versus 452,547 before (about 1.9% more); the JS
reduction is an initial-load improvement for login/overview, not removal of data.
Geometry requests begin alongside the archive and reuse parsed results within
the document. Other canonical data remains in the authenticated chunk; further
splitting should be driven by route-specific measurements, not bundle warnings
alone. The follow-up pass adds the login split and mobile-network harness above.

### Follow-Up Measurements

Combined non-functional work versus `440b707`, 2026-09-05, three fresh-browser
samples per route: Chromium 390x844, CPU 4x, 1.6 Mbps download / 0.75 Mbps upload,
150 ms latency, gzip assets, system fonts on both builds. This is lab evidence,
not field Core Web Vitals. The overview also includes the concurrent T+1 feature
change, so its before/after content is not identical.

| Metric | Baseline | Follow-Up |
| --- | ---: | ---: |
| Login startup JS, gzip | 452,547 bytes | 107,791 bytes |
| Total JS, gzip | 452,547 bytes | 337,705 bytes |
| Login visible, median | 3,944 ms | 1,633 ms |
| Overview map visible, median | 17,312 ms | 17,932 ms |
| Drought map visible, median | 19,269 ms | 17,003 ms |

Login startup JS is 76.2% smaller. No overview speedup was demonstrated; samples
overlap substantially (baseline 15.0-18.7 s, follow-up 14.2-18.0 s). The local
subdistrict geometry alone transfers 1,249,746 gzip bytes and remains the main
cold-map network cost. Full forecast JS plus archive is 466,007 gzip bytes,
about 3% above baseline despite lower JS parsing/execution work. No canonical
geometry was simplified or removed for these measurements.

Evidence: `/tmp/korattanphai-nfr-baseline-mobile-network.json` and
`/tmp/korattanphai-nfr-final-mobile-network.json`. Both record zero page errors
and encoded/decoded resource sizes. Verified protected artifact:
`tmp-snapshots/nfr-final2-20260905`.

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
- Storage reads, writes and logout tolerate SecurityError and quota failures
  with a visible notice and in-memory fallback for the current document.
  Reloading while storage is unavailable requires logging in again; internal
  content navigation keeps the current document and authenticated session alive.
- Persisted data is validated before it reaches components: malformed nested
  records use defaults while valid edits are retained. Mounting the provider
  does not silently rewrite the original snapshot. A subsequent user edit saves
  the recovered state. Toasts are not persisted.
- Root and content error boundaries provide recovery without clearing saved
  state. Failed lazy imports retry by reloading the current URL; render failures
  can retry within the page or recover by navigating from the shell.

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
- `quality.yml` runs unit, protected-build and built desktop/mobile E2E checks.
  `deployment-smoke.yml` verifies successful Production deployments when the
  hosting integration emits a deployment-status event. Neither workflow changes
  branch protection or blocks Vercel deploys automatically. See
  [PRODUCTION_SMOKE.md](PRODUCTION_SMOKE.md) for commands, permissions and evidence.
- For alerting/public-safety copy, review severity, provenance, timestamp, and
  recommended actions before release.
