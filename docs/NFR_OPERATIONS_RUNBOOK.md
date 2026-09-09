# โคราชทันภัย NFR Operations Runbook

Updated: **2026-09-09**. Audience: platform/integration operators, model lead,
database owner and PO/BA. This runbook operates the implemented NFR tools. It
does not authorize deployment, production writes or remote migrations.

The website already has real Supabase authentication, forecast reads and saved
personal workspaces. New model-input/health/telemetry code and prepared quota
migrations are local implementation until separately activated. Scientific model
execution and V2 forecast publication remain the team's future integration.

## What Each Signal Proves / อ่านสัญญาณให้ตรงขอบเขต

| Signal | Meaning — TH / EN | Does not establish |
| --- | --- | --- |
| Public `/api/health` | processตอบได้ / The handler executed. | Database, user login, source freshness, forecast quality. |
| Private readiness | อ่าน metadata archive ที่เผยแพร่ได้หนึ่งชุด / One published dataset metadata record is readable. | Full row integrity, all-user RLS, live source readiness or publication SLA. |
| Web/API monitor | หน้าloginและriskAPIตอบตามรูปแบบ / Login document and risk API returned the expected shape. | Interactive authenticated journey or model result correctness. |
| Ingest `submitted` | ได้receiptที่ตรวจhash/identityแล้ว / An input receipt was validated. | Feature completeness, cross-batch deduplication or forecast publication. |
| `observationStatus` | อายุของช่วงข้อมูลตามpolicy / Timeliness under the source policy. | Hazard severity, scientific QA or provider availability. |
| Restore `restored` | เขียนและตรวจbatchในlocaltargetแล้ว / Local normalized batches were restored and verified. | Whole Supabase recovery, Storage/raw assets, production RPO/RTO. |

## Activation and Owner Assignment

The [NFR register](NON_FUNCTIONAL_REQUIREMENTS.md) assigns accountable **roles**;
the service owner must fill in actual names and a reachable escalation channel.
No recipient or external log destination is configured by these files.

1. **Platform owner:** select a test deployment/database, configure server-only
   secrets, execute prepared migrations there, and verify roles/quota behavior
   across independent connections. Approve limits against the source workload.
2. **Data steward + model lead:** confirm source units, timezone, interval,
   provider publication lag, correction/version policy and per-source freshness.
   No threshold means unknown; do not silently mark it fresh.
3. **Integration operator:** choose one persistent worker host/private state
   directory, scheduler, run cadence and a retry queue procedure. Do not store a
   queue in serverless `/tmp`. Keep source artifacts outside the normalized
   receipt archive with hashes, product/processing versions and access rights.
4. **Platform/privacy owners:** activate browser and server telemetry together
   only after approving exact origins, logs access/retention and unauthenticated
   WAF limits. Keep credentials out of Vite variables and shared reports.
5. **Incident owner:** set repository `OPERATIONAL_MONITOR_ENABLED=true` and
   notification recipients, then run an intentional failing test target and
   demonstrate delivery. Enable archive readiness separately after its endpoint
   and token are configured. GitHub scheduled runs are best effort, not exact
   15-minute guarantees or an independent SLA-grade uptime service.
6. **Release owner:** confirm required branch check `regression` and hosting
   deployment enforcement. YAML presence does not configure either setting.
   Record the released commit/artifact and complete deployed smoke separately.

See [typed environment values](MODEL_INPUT_DATA_MAPPING.md#nfr-controls).
Prepared files are `supabase/migrations/20260909010000_model_input_batches.sql`
and `20260909020000_model_input_api_quota.sql`; no remote application is claimed.

## Routine Checks and Interpretation

```bash
npm run check:health
npm run report:operations -- --file artifacts/operations/exported-logs.jsonl
```

`check:health` uses `OPERATIONAL_MONITOR_URL` (default project production origin),
a 10-second deadline per probe and at most 64 KiB per response. It accepts only
the exact `https://korattanphai.vercel.app` origin or localhost (no preview
wildcard), follows no redirects, writes a
sanitized JSON report and exits nonzero on failure. Add
`OPERATIONAL_CHECK_READINESS=true` and the dedicated health token to include the
private published-archive check. No source/model-ready claim follows from success.
Readiness filters for published metadata with confirmed source-origin timing
and `normalized_rev03_original_workbook`, then verifies the bounded response;
it does not accept an arbitrary published dataset as proof of readiness.

`report:operations` is local read-only: input must be a regular JSONL file ≤16 MiB.
It emits allowlisted route request counts, 5xx/429 counts and request p95 latency,
plus Web Vitals p75 by route and CSS viewport category. Fewer than 20 samples
is `insufficient_samples`; 20 is only a preliminary floor, not a representative
SLO window. Errors are unsampled while successful loads/performance use 10%
sampling. Do not turn their ratio into a user error rate. Request logs are not
uptime, user counts, business approvals or alert-delivery receipts.

The opt-in [monitor workflow](../.github/workflows/operational-monitor.yml) has a
best-effort 15-minute schedule and a manual entrypoint, both gated by the enable
variable. Failed runs contain safe probe results in workflow logs. GitHub
notification preferences and recipient delivery still need a drill; no Slack,
email or SMS sender was added.

## Incident Response / เมื่อเกิดเหตุ

The following times are **draft response targets to agree**, not measured service
promises. Do not place user passwords, bearer keys, full input files or raw
exceptions in tickets or chat.

| Severity | Trigger / อาการ | Owner and draft response | Immediate action / สิ่งที่ทำ |
| --- | --- | --- | --- |
| SEV1 | ผู้ใช้หลักเข้าไม่ได้หรือข้อมูลที่เผยแพร่มีปัญหาความถูกต้อง / Core access outage or suspected published-data integrity issue. | Platform + data/model lead; acknowledge within 15 minutes, review every 30 minutes. | เช็กweb/API/readinessแยกกัน เก็บrequestIDและรุ่นเว็บ ใช้กระบวนการhold/correctionของเจ้าของข้อมูล / Isolate the failing layer, retain IDs/release, involve publication owner. |
| SEV2 | แหล่งข้อมูลล่าช้า งานติดค้าง หรือdependencyบางส่วนเสีย / Stale source, pending ingest or partial dependency outage. | Integration/data steward; acknowledge within 1 hour. | ตรวจrun/policy/receipt รอRetry-After แล้วresumeชุดเดิม / Inspect run/policy/receipt, honor delay, resume the frozen batch. |
| SEV3 | errorเป็นช่วง ๆ หรือความเร็วถดถอยโดยยังใช้งานได้ / Intermittent errors or degraded latency with usable core paths. | Frontend/platform; next working day triage. | รวมเหตุการณ์ตามช่วงเวลาและviewport พร้อมจำนวนsample / Compare time windows and viewport groups with sample counts. |

For every incident record: detected time, impacted scope, safe request/run IDs,
release identifier, owner, mitigation, recovery evidence and a next review time.
Confirm recovery with the failed probe **and** the affected user path. If access
is restored but data remains stale, keep the data incident open. Completion logs
cannot replace human approval or immutable publication/correction records.

### Token Rotation and Quota Failure

Keep one stable client ID; add the new token to its second slot, deploy that
configuration, switch the caller, verify read/write scope, then remove the old
slot and deploy. Verify the previous token returns 401 and both slots previously
shared one quota. Never rotate by moving secrets into a URL or JSON batch.

429 means wait the `Retry-After` seconds. A 503 `rate_limit_unavailable` is a
fail-closed dependency failure; do not bypass durable quotas with local memory.
For 409, compare retained identities/hashes and issue a new batch ID only for an
actual correction. A timed-out POST may have succeeded; replay the exact body.

<a id="input-jobs-and-replay"></a>
## Input Jobs and Replay

Examples below target an **already configured local demo API** with source
`local-demo`; its secret comes from the private environment. They are not
instructions to connect a real provider or write production data.

```bash
npm run model-inputs:job -- --config examples/model-inputs/local-csv.config.json --state-dir .local/input-jobs/local-demo --submit http://127.0.0.1:8787/api/model-inputs
```

The wrapper runs once. It writes append-only `manifest.json`, frozen
`pending.json`, numbered attempt-started/failed files and `complete.json` only
after a valid receipt. The state contains the normalized input, input checksum,
policy and endpoint hash, not the bearer token or raw endpoint. Treat it as
private source data, back it up on the worker and keep it out of git.

Resume using the emitted run ID:

```bash
npm run model-inputs:job -- --resume 20260909T060000000Z-e9a2cc02-6f2f-4c57-a97a-9d7a33c5b421 --state-dir .local/input-jobs/local-demo --submit http://127.0.0.1:8787/api/model-inputs
```

The run ID is illustrative; use a real existing run. Resume refuses another
target or altered frozen input and reuses the original policy. A failed
collection has no frozen batch; correct the source/config and start a new run.
Default three attempts, at most four per invocation and 1,000 per retained run.
Terminal 400/401/403/404/405/409/413/415/422 errors stop retries. On 429 or a server
retry delay over five seconds, the wrapper returns `submission_deferred` with
`retryNotBeforeAt`; resume before that time performs no submission. Wait until
it is due and let the scheduler/operator resume the frozen batch. This is a
due-time guard, not a background scheduler.

The append-only lock permits one job per state directory. `--recover-lock true`
is for a confirmed crashed local owner: a recorded owner must be on the same
host and its PID absent; interrupted owner-file creation requires the built-in
age guard. Do not remove locks or use recovery against a live/other-host worker.

### Source-Specific Freshness

| Source family | Age to measure / เวลาที่ใช้ | Policy before operational use |
| --- | --- | --- |
| Station rainfall | เวลาobservedAtและช่วงสะสม / Observation end plus accumulation interval. | Confirm timezone, missing/QC conventions and expected cadence; a 24h rolling sum is not a calendar-month total. |
| Satellite/composite | วันเริ่ม–จบ composite และเวลาผู้ผลิตปล่อย / Composite interval and provider publication lag. | Confirm product/QA/native support; monthly V1 uses exclusive next-month UTC boundary, not acquisition/publication time. |
| Crop/DOAE | รอบรายงาน ฤดูเก็บเกี่ยว และนิยามผลผลิต / Reporting/harvest interval and production definition. | Confirm Buddhist/Gregorian year, round, denominator and lag. Monthly arrival is not minute-level freshness. |
| Historical archive | เป้าหมายคือข้อมูลย้อนหลังที่ตรวจสอบรุ่นได้ / Reproducible historical evidence. | Use historical mode; do not label old observations as a broken live feed or fill gaps with zeros. |

Store/compare observation, provider publication, collection, receipt, model run
and website publication times separately when those are actually available.
The current local report cannot manufacture missing provider/model/publication
timestamps. Freshness is a report, not an automatic alert gate; the model team
must decide required-input readiness before operational inference/publication.

## Backup and Restore Drill

**Draft objectives:** normalized input RPO ≤24 hours and RTO ≤4 hours, contingent
on an agreed daily backup schedule and successful full-sized restore. They are
not measured commitments. Whole Supabase recovery needs its own approved targets.

| Coverage | Implemented evidence | Separate operator work |
| --- | --- | --- |
| One source's normalized input batches | API export, checksums, original receivedAt, local verified restore. | Schedule/export destination, access, encryption/off-host copy and realistic-size drill. |
| Supabase database/Auth/forecast/saved workspaces | Existing application persistence only; no full backup tool added here. | Confirm provider backup/PITR plan, retention and restore into an isolated project; verify RLS/Auth/application access. |
| Storage objects / raw satellite and original source artifacts | Not in normalized API export. | Separate object backup/versioning, metadata/checksum catalog and retrieval drill. |
| Job state / mapping / model artifacts | Private local input-job history; repo code/config examples. | Durable worker volume backup; retain raw inputs, policy versions, feature/model lineage and approved artifacts. |

Export a local source to a **new** archive path whose parent already exists:

```bash
npm run model-inputs:backup -- --endpoint http://127.0.0.1:8787/api/model-inputs --source local-demo --output .local/backups/input-demo-20260909.json
npm run model-inputs:restore -- --archive .local/backups/input-demo-20260909.json --verify-only true
npm run model-inputs:restore -- --archive .local/backups/input-demo-20260909.json --target-dir .local/restore-drills/input-demo-20260909
```

Use a source-scoped reader key via `--token-env` for export. Budget metadata
pages plus one GET per batch against its request quota. Export fails rather
than truncating beyond **500 batches / 128 MiB**, and never publishes a partial
archive. It captures a source-scoped paginated view/high watermark, not a
transaction-consistent snapshot of the entire database. Review provider backup
tools when the dataset exceeds this bounded utility.
429/503 responses allow at most three attempts per read, each wait ≤60 seconds
and total waits ≤600 seconds per export. A longer delay or exhausted budget
returns a safe deferred failure without publishing a partial archive; schedule
a new export after the delay. These wait bounds are not an overall export RTO.

Restore validates all checksums before creating its target, requires an empty
local directory and never writes to a remote API. It preserves original batch
`receivedAt`, writes a local restore report and verifies every batch after
writing. To resume a partial drill, use the **same archive** and
`--resume true`; mismatching existing files or unrelated content are refused.
Do not clear or overwrite a target to make a mismatch pass.

Record archive hash, source, batch count, capture window, verified count, elapsed
local restore time, operator and application-read verification. A report's
`recoveryPointAgeSeconds` is time since export; actual production data loss
remains null. `measuredRestoreSeconds` excludes production deployment, user
authentication, raw assets and real traffic recovery.

Retention inventory is read-only:

```bash
npm run model-inputs:backup -- --inventory .local/backups --retention-days 30
```

**Draft:** keep daily input exports 30 days, with an independently verified copy
and source/model lineage retained under the source agreement. The CLI only
reports candidates (`deletedCount: 0`); it does not enforce retention. Never
delete the only verified recovery point or an artifact required for reproducibility.

<a id="typed-cli-parameters"></a>
## Typed CLI Parameters / ชนิดและตัวอย่างค่า

CLI flags take strings; `true` below is the literal string parsed as boolean.
M/C/O and nullability follow [data mapping conventions](MODEL_INPUT_DATA_MAPPING.md).
No CLI argument accepts JSON null.

| Tool / Flag | Input type → meaning | M/C/O | Nullable | Sample / Default | Business meaning / Condition — TH / EN |
| --- | --- | --- | --- | --- | --- |
| job `--state-dir` | string → directory | M | N | `".local/input-jobs/local-demo"` | เก็บbatchค้างและประวัติบนworkerถาวร / Private persistent job directory. |
| job `--submit` | string → URL | M | N | `"http://127.0.0.1:8787/api/model-inputs"` | ปลายทางรับinput; HTTPSยกเว้นloopback / Input endpoint; no userinfo/query/fragment. |
| job `--config` | string → file path | C | N | `"examples/model-inputs/local-csv.config.json"` | บังคับรอบใหม่ ห้ามพร้อมresume / Required for a new run; incompatible with resume. |
| job `--resume` | string → run ID | C | N | `"20260909T060000000Z-e9a2cc02-6f2f-4c57-a97a-9d7a33c5b421"` | ใช้รอบเดิมแทนconfig/policyใหม่ / Replay an existing frozen run. |
| job `--policy` | string → JSON file path | O | N | `".local/policies/rainfall.json"` | เกณฑ์เวลาเฉพาะsource; ห้ามพร้อมresume / Versioned freshness policy, new runs only. |
| job/backup `--token-env` | string → environment-variable name | O | N | `"MODEL_INPUT_READ_TOKEN"`; default `"MODEL_INPUT_API_TOKEN"` | ชื่อenv ไม่ใช่ค่าsecret; jobต้องใช้writer / Credential reference; job needs writer role, backup can use reader. |
| job `--attempts` | string(integer) → integer | O | N | `"3"` (default) | จำนวนครั้งสูงสุดต่อinvocation 1–4 / Bounded attempts per invocation. |
| job `--recover-lock` | string(boolean) → boolean | O | N | `"true"`; omitted = false | ใช้เมื่อownerเดิมหยุดแล้วตามกติกา / Explicit crash-lock recovery with absent owner safeguards. |
| backup `--endpoint` | string → URL | C | N | `"http://127.0.0.1:8787/api/model-inputs"` | บังคับโหมดexport ไม่ใช้ในinventory / Required for export, forbidden with inventory. |
| backup `--source` | string → source ID | C | N | `"local-demo"` | sourceที่คาดว่าจะได้รับและตรวจทุกbatch / Export source identity checked against every response. |
| backup `--output` | string → new file path | C | N | `".local/backups/input-demo-20260909.json"` | ไฟล์ใหม่เท่านั้น ห้ามทับของเดิม / Exclusive output; existing parent directory required. |
| backup `--inventory` | string → directory | O | N | `".local/backups"` | เปลี่ยนเป็นโหมดรายงานretentionไม่เรียกAPI / Read-only inventory mode, mutually exclusive with export arguments. |
| backup `--retention-days` | string(integer) → integer | O | N | `"30"` (default) | ใช้เฉพาะinventory 1–3650วัน ไม่ลบไฟล์ / Inventory threshold only; deletes nothing. |
| restore `--archive` | string → file path | M | N | `".local/backups/input-demo-20260909.json"` | คลังที่จะตรวจ/กู้ / Archive to validate or restore. |
| restore `--target-dir` | string → directory | C | N | `".local/restore-drills/input-demo-20260909"` | บังคับเมื่อกู้ ต้องว่างหรือเป็นresumeตรงคลังเดิม / Empty local restore target, or exact matching resume target. |
| restore `--resume` | string(boolean) → boolean | O | N | `"true"`; omitted = false | ต่อdrillเดิมโดยไม่ทับไฟล์ / Continue the same archive's partial restore. |
| restore `--verify-only` | string(boolean) → boolean | O | N | `"true"`; omitted = false | ตรวจอย่างเดียว ห้ามtarget/resume / Validate without a restore target or resume flag. |
| log summary `--file` | string → JSONL file path | M | N | `"artifacts/operations/exported-logs.jsonl"` | logที่exportมา ≤16MiB / Regular exported JSONL file; read-only. |

### Monitor and Log Summary Results

| Output field | JSON type | M/C/O | Nullable | Sample | Business meaning / Conditions — TH / EN |
| --- | --- | --- | --- | --- | --- |
| Monitor `schemaVersion` | integer | M | N | `1` | รุ่นreport / Report version. |
| Monitor `checkedAt` | string(datetime) | M | N | `"2026-09-09T06:00:00.000Z"` | เวลาตรวจ / Check timestamp. |
| Monitor `target` | string | M | N | `"https://korattanphai.vercel.app"` | originที่ตรวจ ไม่มีuserinfo/query/secret / Checked origin without private URL components. |
| Monitor `status` | string | M | N | `"failed"` | passedเมื่อทุกprobeผ่าน / passed or failed; all probes must pass. |
| Monitor `scope` | string | M | N | `"web_api_and_archive"` | web_and_api_only หรือ web_api_and_archive / Declares which probe set ran. |
| Monitor `checks` | array<object> | M | N | `[{"name":"risk_api","status":"passed","durationMs":80}]` | รายการผลตรวจแต่ละส่วน / Per-probe results. |
| `checks[].name` | string | M | N | `"published_archive_readiness"` | login_document/risk_api/published_archive_readiness / Fixed probe name. |
| `checks[].status` | string | M | N | `"passed"` | ผลprobeนั้น / passed or failed for that probe. |
| `checks[].durationMs` | integer | M | N | `80` | เวลาตั้งแต่เริ่มจนจบหรือtimeout / Elapsed probe duration in milliseconds. |
| `checks[].code` | string | C | N | `"probe_failed"` | มีเฉพาะprobeล้มเหลว / Safe code on failure only. |
| Summary `schemaVersion` | integer | M | N | `1` | รุ่นสรุป / Summary version. |
| Summary `api` | array<object> | M | N | `[]` | กลุ่มAPIที่พบในlog; ว่างได้ / Aggregates for routes present in retained logs. |
| `api[].route` | string | M | N | `"/api/model-inputs"` | เส้นAPIคงที่ / Allowlisted static API route. |
| `api[].requests` | integer | M | N | `100` | จำนวนlogคำขอ ไม่ใช่uniqueusers / Retained request count, not unique users. |
| `api[].errors5xx` | integer | M | N | `2` | จำนวนservererrorในlog / Logged 5xx count. |
| `api[].limited429` | integer | M | N | `3` | จำนวนคำขอที่ติดquotaในlog / Logged 429 count. |
| `api[].latencyP95Ms` | integer | M | N | `240` | p95เวลาrequestที่บันทึก / p95 retained request duration. |
| Summary `webVitals` | array<object> | M | N | `[]` | กลุ่มsampleperformanceที่พบ / Groups present in sampled events. |
| `webVitals[].route` | string | M | N | `"overview"` | ประเภทหน้า ไม่ใช่URL / Coarse route category. |
| `webVitals[].viewport` | string | M | N | `"mobile"` | CSSwidthcategoryไม่ใช่รุ่นอุปกรณ์ / mobile or desktop CSS category. |
| `webVitals[].metric` | string | M | N | `"LCP"` | ตัววัด LCP/INP/CLS / Metric identity. |
| `webVitals[].samples` | integer | M | N | `12` | จำนวนsampleใช้ตีความความน่าเชื่อถือ / Sample count for interpretation. |
| `webVitals[].p75` | number | M | N | `2200` | p75ของsample; msยกเว้นCLS / Sample p75; milliseconds except unitless CLS. |
| `webVitals[].target` | number | M | N | `2500` | LCP2500ms, INP200ms, CLS0.1 / Comparison target for the selected metric. |
| `webVitals[].assessment` | string | M | N | `"insufficient_samples"` | insufficient_samples/within_target/above_target; ไม่ใช่ผลรับรองSLO / Preliminary comparison, not SLO certification. |
| Summary `ignoredLines` | integer | M | N | `1` | จำนวนบรรทัดที่ไม่ใช่รูปแบบรองรับ / Lines ignored as unsupported or invalid. |
| Summary `limitations` | array<string> | M | N | `["API figures describe retained request logs, not uptime."]` (excerpt) | ข้อจำกัดการใช้ผลรายงาน / Full interpretation notes accompany the summary. |

These result tables describe successful tool execution. Invalid monitor
configuration emits the smaller `{"status":"failed","code":"monitor_configuration_invalid"}`
and exits nonzero; those two string keys are mandatory/non-null. CLI parsing,
unsafe paths or malformed archives may instead emit a safe stderr message and
nonzero exit rather than a success-shaped report.

## Regression and Release Evidence

Current workflow jobs are `contracts`, `built-browser`, `database-browser` and
`browser-compatibility`, followed by stable aggregate `regression`. Repository
tests use controlled credentials/network fixtures; do not replace them with
real account secrets. The new API tests include quota/role SQL checks in
PGlite; the ingest tests include frozen retries, freshness and local restore.

```bash
npm test
npm run test:model-inputs
npm run test:operations
npm run test:database
npm run build:protected
npm run test:e2e:built
npm run test:e2e:database
npm run test:e2e:compat
```

Select checks for the actual risk; this implementation requested full regression.
Compatibility covers selected Firefox/WebKit paths, not every page or physical
device. Database-browser tests prove the isolated adapter/RLS contract, not
production backup or current-account provisioning. Record run date, tested
commit/worktree, failures/skips, browser/environment and artifact locations in
[HANDOFF.md](HANDOFF.md). Verify the deployed URL separately when deployment is
authorized. Historical 2026-09-05 performance tables are preserved as historical
evidence, not this build's measured outcome.
