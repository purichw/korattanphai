# NFR implementation and regression — 2026-09-09

Release follow-up: the reviewed runtime was subsequently pushed and deployed on
2026-09-09. [HANDOFF.md](HANDOFF.md#recent-changes) records the successful CI,
exact production artifact, 32 authenticated and 7 operational checks per target,
and inactive integrations. The report below preserves the earlier local
pre-release evidence and its original verification boundary.

ปรับปรุงโค้ด NFR และทดสอบใน working tree ของ `/Users/point/korattanphai`
บน branch `fix/nr-map-zoom-performance` แล้ว เอกสารนี้แยกหลักฐานที่ตรวจแล้ว
ออกจากการตั้งค่าบนระบบจริง ซึ่งยังไม่ได้ deploy หรือ apply migration ในรอบนี้

This report describes local implementation and measured checks. It does not
claim that the new operational endpoints, schedules or database migrations
are enabled in production. Existing unrelated working-tree changes were preserved.

## Delivered / สิ่งที่เพิ่ม

| Area | Business outcome — TH / EN | Implementation |
| --- | --- | --- |
| Health and incident diagnosis | รู้ว่าส่วนไหนตอบไม่ได้และตามเหตุการณ์ด้วยรหัสได้ / Identify a failing layer and correlate requests. | Liveness, authenticated archive readiness, bounded monitor, structured request IDs/logs and local log summaries. |
| Integration security | คู่เชื่อมต่อมีสิทธิ์และโควตาแยกกัน / Scope integration access and resource use. | Reader/writer identities, source scope, two-slot key rotation, durable quota SQL, 429/Retry-After and fail-closed dependency errors. |
| Input recovery | งานสะดุดแล้วทำต่อด้วยข้อมูลชุดเดิมได้ / Resume a frozen input without duplicate publication. | Private persistent job state, locks, bounded retries, deferred due times, receipt/hash checks and source-specific freshness reports. |
| Backup and restore | ตรวจและกู้ข้อมูลรับเข้าตามขอบเขตที่ระบุได้ / Verify and restore the covered normalized input. | Bounded API export, checksums, empty-local-target restore, exact receipt preservation and report-only retention inventory. |
| Browser resilience | เมื่อโหลดค้าง ผู้ใช้ลองใหม่ได้โดยยังเลือกเดือนและ T+ เดิม / Recover a stalled load with the same selected forecast. | 30-second forecast/map deadlines, cancellation, in-place map retry, skip navigation and current-page semantics. |
| Performance evidence | วัดปัญหากับความเร็วโดยไม่ส่งข้อมูลผู้ใช้ / Measure operational failures and performance without personal payloads. | Opt-in allowlisted telemetry, DNT, sampling, event/payload/request caps, Web Vitals and viewport-level summaries. |
| Release regression | ตรวจโค้ด ข้อมูล และเส้นทางใช้จริงก่อนปล่อย / Verify contracts and user paths before release. | Parallel CI jobs with a required-result aggregate, protected builds, browser compatibility cases and exact-origin smoke safeguards. |

The [NFR register](NON_FUNCTIONAL_REQUIREMENTS.md),
[operations runbook](NFR_OPERATIONS_RUNBOOK.md), [API specification](API.md) and
[data mapping](MODEL_INPUT_DATA_MAPPING.md) contain owner roles, draft targets,
activation steps and bilingual typed fields with mandatory/null/sample values.

## Verified evidence / ผลที่ตรวจแล้ว

| Check | Result | Evidence under `artifacts/nfr-regression/` |
| --- | --- | --- |
| Unit regression | 197 passed in 23 files. | `unit.log` |
| Model input/API/jobs/recovery | 104 passed; no failures or skips. Includes both opaque Supabase secret keys and legacy JWT adapters. | `model-inputs.log` |
| Health/telemetry/monitor/log/smoke boundaries | 9 passed. | `operations.log` |
| SQL, integrity and RLS | 11 checks passed against isolated PGlite, including 220,218 forecast predictions. | `database.log` |
| Protected static build | Passed compilation, obfuscation, exposure and bundle checks with telemetry enabled. | `build-static.log` |
| Built Chromium desktop/mobile | 135 passed, 31 intentional backend/condition-specific skips. | `built-browser.log`, `built-results/` |
| Isolated database browser regression | 38 passed. | `database-browser.log` |
| Selected WebKit mobile / Firefox desktop compatibility | 6 passed on the protected static build: map/forecast timeout recovery and keyboard login/skip/T+ controls. | `compatibility-final.log`, `compatibility-final-results/` |
| Protected Supabase build | Passed; no static forecast fallback assets. | `build-supabase.log`, `live-build/` |
| Real-account regression on the new local Supabase build | 32 passed on desktop/mobile: login/logout, forecast scope/source values, map colors, month/T+, irrigation filters, saved reads and real Excel exports. Repeated after tightening the harness origin/network safeguards: all 32 passed again. | `live-account/report.json`, `guarded-live-account/report.json` |
| Existing production public probes | Login document and risk API passed. This is a single read-only observation of the existing deployment. | `live-health.log` |
| Canonical/generated/geodata preservation | All 47 checked files match HEAD. | `canonical-integrity.json` |
| Dependency audit | Zero reported vulnerabilities after the narrow Excel dependency override. Real Excel export passed. | `dependency-audit.json`; override is in `package.json`/lockfile. |
| Credential hygiene | No supplied password found in 118 changed/new text files and NFR logs/reports checked. | `credential-hygiene.json` |

Excel regression compared 1,734 values, 289 tambons and 32 district summaries
on desktop, and 36 values, six tambons and one district summary on mobile.
Both exports retained native chart and PivotTable parts. Native Microsoft Excel
was not launched. The authorized real account stayed in process memory;
credentials and auth responses were not written into reports or fixtures.

The local preview has no Vercel serverless runtime, so its real-account smoke
explicitly skips hosted API/header assertions. The new server handlers have
separate local tests; the public production probes do not validate those new routes.

The first compatibility pass found a keyboard-test assumption about macOS
WebKit. Its native Safari policy needs Option-Tab to include links when full
keyboard navigation is disabled. The test now uses the platform-appropriate
key and retains exact focus/Enter/arrow-navigation assertions. The corrected
keyboard case passed on all four browser projects, followed by the six-case
protected-build compatibility pass above. No application workaround was added.
The first database-browser runner also encountered an occupied local port;
the successful run used a different port and left the existing server untouched.

## Mobile-network lab measurement / ผลวัดการโหลด

Three cold-browser samples per route: Chromium 390×844, CPU slowed 4×,
1.6 Mbps download / 0.75 Mbps upload, 150 ms latency and compressed assets.
Fonts were isolated to a system fallback; Auth/database responses were controlled
fixtures. These conditions exclude actual Supabase latency and production fonts.

| Visible readiness | Median | Range |
| --- | --- | --- |
| Login heading | 1.35 s | 1.27–1.54 s |
| Overview map | 14.79 s | 14.35–15.28 s |
| Drought map | 14.96 s | 14.63–14.98 s |

All nine samples completed with zero page errors. Map readiness remains slow on
this constrained connection: the unchanged subdistrict geometry alone transfers
1,249,746 gzip bytes, with additional province/context geometry. This is a known
performance limitation, not a passed Core Web Vitals target. No comparable
current-HEAD baseline was measured, so no speedup is claimed. Field LCP/INP/CLS
and a production connection remain necessary before accepting the performance SLO.

Evidence: `performance/korattanphai-nfr-nfr-20260909.json` and `performance.log`.
The protected static login startup is 112,556 gzip bytes; application JS is
350,999 gzip bytes with the separate Supabase SDK at 99,179 gzip bytes. The
protected Supabase build has 112,442-byte startup and 347,057-byte application
gzip. Both remain within the existing bundle budgets.

## Restore drill / การทดลองกู้คืน

The synthetic local CLI drill collected, submitted, exported and restored one
batch with four observations. Replaying the same batch preserved byte-equivalent
stored content and its original receipt timestamp. The local restore measured
0.0251 seconds; this is not a production RTO or evidence of a full database backup.

Evidence: `artifacts/model-input-operations-drill/run-tED2sL/drill-report.json`.
Observation freshness correctly remained `unknown` without a confirmed source
cadence; no live provider or production input data was written.

## Activation boundary / ก่อนเปิดใช้จริง

1. Deploy the reviewed artifact and apply the two prepared model-input migrations
   in a selected test environment first; verify independent-connection quota
   behavior and production hosting headers separately.
2. Configure server-only integration/readiness secrets, permitted telemetry
   origins, log storage/retention and WAF limits. Telemetry defaults to off.
3. Assign incident recipients and enable the monitor only after a failed-probe
   notification drill. Repository YAML does not activate remote settings or
   enforce branch protection/hosting deployment gates.
4. Connect the agreed Thai source, confirm timing/units/QA policies, and run the
   collector on a persistent host with a scheduler. Freshness reports do not
   automatically decide model readiness or publish forecasts.
5. Configure independent backups for the whole Supabase database/Auth/forecast/
   saved-workspace data and raw/Storage objects. Rehearse an isolated full restore
   before claiming RPO/RTO targets.

No production deployment, remote migration, forecast publication or application
data update was performed. Real login/logout uses the provider's normal auth
session lifecycle. No source month, T+ calculation or canonical forecast was changed.

Full assistive-technology/forced-colors/physical-device audits, independent database
concurrency/load testing, field Web Vitals and a measured availability window
remain separate evidence requirements. The targeted compatibility cases do not
certify every page or WCAG conformance.
