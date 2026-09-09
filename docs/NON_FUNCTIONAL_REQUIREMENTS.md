# โคราชทันภัย Non-Functional Requirements

Updated: **2026-09-09**. This is the acceptance register for the website and its
input integration. Business meaning is bilingual so PO/BA and operators can
review the same requirements. **Implemented** means code is present; it does
not mean that a remote service, migration, monitor, or notification is enabled.
The NFR handlers were deployed to [production](https://korattanphai.vercel.app)
on 2026-09-09: public health returns 200; model-input ingestion and private
readiness remain unconfigured (503); telemetry POST returns 204 while disabled.
No remote migration, live feed/scheduler, monitoring, notification recipient or remote log
store was activated. V2 remains proposed. See [release evidence](HANDOFF.md).

## NFR Register / ทะเบียนข้อกำหนด

Owner names below are **roles to assign**, not a claim that a named person is on
call. Targets marked **draft** require agreement and measured evidence before
becoming a service commitment. See the [operations runbook](NFR_OPERATIONS_RUNBOOK.md)
for commands, activation, incident response, and restore drills.

| ID / Area | Business meaning — TH / EN | Accountable owner role | Measurable acceptance / เกณฑ์ตรวจรับ | Implementation and remaining evidence | Last verification |
| --- | --- | --- | --- | --- | --- |
| NFR-01 Availability | ทีมรู้เมื่อเว็บหรือฐานข้อมูลอ่านไม่ได้ / Detect loss of website or database access. | Platform operator | Monitor `/login` and risk API every 15 minutes when enabled; optional authenticated readiness verifies one published archive. **Draft:** monthly availability ≥99.5%, excluding agreed maintenance, after a complete observation window. | Bounded monitor and separate liveness/readiness routes implemented; schedule, secrets, external availability evidence and recipient delivery need activation. Process liveness alone is insufficient. | 2026-09-09 hosted liveness passed; readiness remains unconfigured and scheduled monitoring inactive. |
| NFR-02 Incident traceability | แจ้งรหัสเหตุการณ์แล้วทีมตามหาปัญหาได้ / Support can correlate an incident without exposing private data. | Platform operator | Every handled model-input/health request returns a generated request ID; completion logs contain only allowlisted fields. Inject storage/quota failure and correlate ID/status without token, payload, IP or exception leakage. | Structured API logs implemented; log drain, retention, alert destination and on-call assignment remain operator tasks. Not a business audit trail. | 2026-09-09 API targeted regression passed. |
| NFR-03 Data timeliness | รู้ว่าข้อมูลเก่า ขาด หรือเป็นข้อมูลย้อนหลัง / Distinguish stale, missing and historical evidence. | Data steward + model lead | Source owner confirms period, timezone, expected arrival and age policy. Missing thresholds yield `unknown`; historical mode stays historical; any stale record is counted. Never convert missing values to zero or low risk. | Per-job freshness report implemented. Live source connection, provider latency agreement and dashboard binding remain unconfigured; reports do not automatically block submission or publish forecasts. | 2026-09-09 policy/code review; source-specific thresholds unconfirmed. |
| NFR-04 Input integrity | ข้อมูลส่งซ้ำไม่ซ้ำซ้อนและแก้ไขย้อนหลังตรวจสอบได้ / Retries preserve one immutable batch and corrections stay identifiable. | Integration engineer + data steward | Identical batch ID/hash returns the existing receipt; changed content returns 409; malformed/oversized batches leave no partial data. Keep the original source evidence separately. | V1 validation, immutable file/Supabase adapters, 1 MiB/2,000-observation limits implemented; V2 raw-artifact pipeline and cross-batch model deduplication remain separate work. | 2026-09-09 API/storage targeted regression passed. |
| NFR-05 Access and quotas | แยกสิทธิ์คู่เชื่อมต่อและควบคุมภาระระบบ / Separate integration permissions and bound resource use. | Security/platform operator | Reader cannot POST; wrong source is 403; rotation preserves client quota; revoked key fails after new config deploy. Per identity defaults 60/minute and 10,000/day; exhausted quota returns 429 and retry delay. | Durable Supabase quota RPC and role/source-scoped keys implemented with prepared migration. Independent-connection load, WAF limits and remote activation remain required. Defaults are starter limits, not measured capacity. | 2026-09-09 API/SQL tests passed in local PGlite; single-connection limitation. |
| NFR-06 Job recovery | งานล้มแล้วตามต่อได้โดยไม่ต้องดึงหรือส่งข้อมูลใหม่มั่ว ๆ / Resume failures with the exact frozen input. | Integration operator | A run records its manifest, frozen batch/hash and attempts; successful receipt is required for completion. Resume preserves input and target. Same-host active lock prevents overlapping jobs; terminal errors stop retries. | Durable private local job history and resume implemented. A persistent worker host, scheduler and failure notification are not activated; not a distributed model-job service. | 2026-09-09 code review; operational schedule unverified. |
| NFR-07 Recovery | กู้ข้อมูลกลับได้และรู้ว่าครอบคลุมอะไร / Restore known data with an explicit recovery boundary. | Database/platform operator | Verify archive and every batch checksum before writing; restore to empty local target, preserve original receipt times and report measured duration. **Draft:** normalized input RPO ≤24h / RTO ≤4h; actual production loss is unknown until a full drill. | Source-scoped API export/local restore implemented. Whole Supabase database, Auth, forecast data, Storage objects and raw assets require separate backups and isolated restore evidence. | 2026-09-09 code review; no production RPO/RTO claim. |
| NFR-08 Performance and recovery | ผู้ใช้ไม่ติดหน้ารอไม่จบและกลับมาลองใหม่ได้ / Bound waits and offer recovery. | Frontend engineer | Critical forecast/geometry operations have a 30-second deadline covering fetch/SDK/body promises; failed result is retryable and old-session results cannot populate a new session. **Targets:** p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 with sufficient field samples. | Deadlines, load/error events and opt-in Web Vitals implemented. Historic lab evidence below is not current field evidence; no new speedup is claimed. | 2026-09-09 code review; current regression recorded in release evidence. |
| NFR-09 Accessibility and compatibility | อ่านความเสี่ยงและใช้ทางหลักได้หลายอุปกรณ์ / Use core paths across input methods and browsers. | Frontend/QA owner | Login → area → forecast → export remains usable on keyboard and narrow viewport; visible focus, named controls and text alternatives for color. Run selected Chromium/Firefox/WebKit compatibility cases and record failures. | Existing semantics/focus and new recovery/compatibility coverage support the checks. Complete screen-reader, forced-colors and physical-device audits remain unverified. | 2026-09-09 source review; current browser results belong in handoff/run artifacts. |
| NFR-10 Privacy-safe measurement | วัดปัญหาการใช้งานโดยไม่เก็บข้อมูลส่วนตัว / Measure technical failures without personal payloads. | Privacy/platform owner | Telemetry disabled by default on browser and server; DNT respected; allowlist rejects extra keys; no URLs/query/stack/user/IP/form values. Cap 20 events/document, four in flight, sample successful-load/vital events at 10%; server cap 1,000/minute, 50,000/day globally. | Opt-in same-origin telemetry endpoint implemented; approved origins, durable quota migration, log retention and privacy review need activation. Platform access logs have separate policy. | 2026-09-09 schema/code review; no remote event stream claimed. |
| NFR-11 Release reliability | ปล่อยรุ่นที่ตรวจแล้วและย้อนกลับได้ / Release verified artifacts with a recovery path. | Release owner | Required regression aggregate covers unit/data/API/operations checks and protected build/browser checks; retain failures and artifact identity. Recheck successful deployment and rehearse rollback. | CI checks are repository code. Branch protection, hosting deploy enforcement and remote rollback drill must be confirmed separately; no workflow can be called enforced merely because YAML exists. | 2026-09-09 Quality Gate passed on 88512c9; candidate and production smoke passed. See HANDOFF. |

### Verification boundary

Local regression evidence reported on **2026-09-09**: **197 unit tests in 23 files**,
**104 model-input tests**, **9 operational endpoint/tool tests**, and **11 database SQL
checks** passed. The separate API/quota suite is
`tests/model-inputs/api-operations.test.mjs`; ingest/recovery tests are
`tests/model-inputs/operations.test.mjs`. The protected static build with telemetry
enabled also passed; its startup bundle was about 110 KiB gzip and application
gzip 350,999 bytes. These are build measurements, not load-time improvements.
Built Chromium regression passed 135 cases (31 conditional skips), isolated
database-browser regression passed 38 cases, selected WebKit/Firefox checks
passed all six cases, and the real-account smoke on the new local Supabase build
passed 32 checks. Mobile-network lab medians were 1.35 seconds for login and
14.79–14.96 seconds for map readiness; these are not field Web Vitals. See the dated
[regression report](NFR_REGRESSION_2026-09-09.md) for scope and activation limits.

The checks covered roles, rotation, quotas, SQL permissions, queued requests,
immutable retries, payload boundaries and sanitized outages. PGlite executes PostgreSQL
SQL through one connection; it does not prove independent production connection
concurrency, traffic capacity, uptime, backup availability or notification
delivery. Broader run results should be recorded in [HANDOFF.md](HANDOFF.md)
and current test artifacts; this register does not turn pending checks into passes.

## Security

Current facts:

- Supabase Email + Password is real authentication; self-signup is disabled.
  Forecast reads and saved personal workspaces use separate database/RLS contracts.
  See [HANDOFF.md](HANDOFF.md), [AUTH_SETUP.md](AUTH_SETUP.md) and
  [SUPABASE_DATA_MIGRATION.md](SUPABASE_DATA_MIGRATION.md) for dated evidence.
  Test credentials must stay out of docs, logs, fixtures and bundles.
- The risk-fusion endpoint is read-only. Model-input, health and opt-in telemetry
  handlers are deployed; only public health liveness is enabled. Input ingestion
  and private readiness remain unconfigured, and telemetry remains disabled.
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

- Authentication accounts and per-user saved workspaces have real persistence;
  they need the platform's retention/access policies.
- Farmer/demo workflow fixtures must not contain real contact details.
- Legacy simulated workflow state remains in local browser storage; forecast
  reads and saved workspaces have a different Supabase persistence boundary.
- Operational telemetry projects only a fixed schema and honors browser DNT;
  no user identity is attached. Hosting access logs are not covered by this claim.

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

**Historical evidence, not the 2026-09-09 build:** first archive-loading pass,
2026-09-05 baseline against `440b707`, three samples per route:

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

### Historical Follow-Up Measurements — 2026-09-05

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

- Legacy advisory/approval/notification workflow state remains local simulation.
  Real Supabase account/forecast/personal workspace storage is separate.
- Model-input retries, immutable server storage adapters and a resumable local
  ingest job now exist. Delivery channels and V2 forecast publication remain
  unimplemented; input receipt does not prove model readiness or publication.
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
- Forecast and geometry loads have 30-second deadlines, retain explicit error
  states and emit optional operational counters. Session changes cancel old
  operations; a successful old-session response must not revive cleared state.

Requirements before operational use:

- Data freshness indicators for every live source.
- Stale data handling and degraded mode.
- Provider outage states for notifications.
- Server-side audit and replay-safe publication operations.

## Observability / Analytics

Current facts:

- No external product analytics provider or operational log destination is
  claimed configured. Privacy-safe server/browser instrumentation now exists
  and browser/server telemetry is off by default.
- Outcome analytics shown in the UI is fixture data.

Requirements:

- Track only privacy-safe events.
- Separate operational audit logs from product analytics.
- Never use analytics as delivery confirmation for life/safety alerts.

See [ANALYTICS.md](ANALYTICS.md).

## Backup / Restore

Current facts:

- Source code and fixtures are in git; uncommitted local work is not a remote backup.
- A real Supabase database exists; plan/retention/PITR and whole-database restore
  evidence must be verified by its operator.
- The new backup CLI exports normalized batches visible through one source's
  model-input API (at most 500 batches / 128 MiB). It excludes Auth, forecasts,
  personal workspaces, database schema and raw satellite/Storage assets.
- Restore verifies checksums in an empty local directory and preserves original
  `receivedAt`. Export age is not measured data loss; local restore time is not
  a production RTO. Retention inventory reports candidates and deletes nothing.

Requirements before relying on recovery:

- Define backup cadence for alert, advisory, source-ingest, and audit data.
- Test restore before relying on live operations.
- Keep rollback paths documented in [RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md).
- Follow the bounded input drill and the separate database/asset recovery plan
  in [NFR_OPERATIONS_RUNBOOK.md](NFR_OPERATIONS_RUNBOOK.md).

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
