# CMS Cutover Checkpoint

Owner approval: 2026-09-28, Asia/Bangkok, migrate only after detailed before/after
checks using the existing test account. No new accounts or password changes.
The owner subsequently required a separate `/admin/login` browser session,
while retaining the same Supabase provider/accounts and shared frontend design.

## Recovery Baseline

- Live deployment before this work: `dpl_DqWq6D7Y5Vn1654QKGGtCCdLeWjk`,
  `https://korattanphai-lx77ernvs-purich-w.vercel.app`.
- Release source starts at `92c6963`, including the deployed `e6d8623` graph
  softness and brand theme. Unrelated dirty checkout changes are excluded.
- Supabase: `dihchjflzhcekywarhxd`. Original publication remains immutable;
  the migration must not rewrite any of its 220,218 forecast cells.
- Before checks: real-account full/T+1 projections, nine scoped reads, source
  digest and anonymous denial passed. Desktop/mobile production smoke: 39 checks
  passed, including source-exact map/Excel data and irrigation interactions.
- Local full-size publish and restoring original values as another immutable
  revision passed (220,218 cells; publication about 5.1 seconds in local WASM,
  not a claim about production latency).
- Physical backup API reports no available backup and PITR disabled. Before
  remote writes, a private logical snapshot captured all 442,862 rows from the
  eight original public tables, schema, policies, grants and function definitions.
  It excludes Auth credentials. An isolated restore and additive migration
  rehearsal verified every original field and active publication unchanged.

## Activation Gates

The CMS candidate uses `VITE_DATA_BACKEND=supabase` and
`VITE_REFERENCE_BACKEND=cms`. Server-only credentials are
`CMS_SUPABASE_URL` and `CMS_SUPABASE_SECRET_KEY`; never put them in browser env.

Applied migrations: `20260909010000`, `20260927010000`, `20260927020000`,
`20260927030000`, and the publication guard fix `20260928010000`. These are
registered in the remote migration ledger. Other pending migrations were not
applied; no unrelated service configuration was changed.

Full-size transaction-only production rehearsal found the existing publication
trigger exceeding 60 seconds when checking a newly cloned dataset. Migration
`20260928010000` pre-aggregates scoped value counts before joining runs, keeping
all completeness and immutability guards. The fresh production rehearsal passed
in 14,367 ms with all 220,218 forecast values unchanged. It explicitly rolled
back: two original datasets remain, with no new forecast publication.

Required: logical checkpoint, schema/row parity, all 45 reference payloads,
real Auth/operator/anonymous permission checks, protected bundle budgets,
required CI jobs, candidate smoke, then production smoke and integrity check.
Database migration and web promotion are complete. Production now points to
runtime `2a84a0e`, deployment `dpl_HK4g5ZzWBGwSf8AYoRSgVLhDi2Qz`,
`https://korattanphai-3wlhsnc9s-purich-w.vercel.app`. Both production backend
flags are configured. [Quality Gate](https://github.com/purichw/korattanphai/actions/runs/36341840804)
passed all six jobs on that exact runtime. The main alias was verified to still
be the recovery baseline immediately before promotion, and to be the candidate
afterwards. `reference-backend.json` confirms `backend: cms`, `fallback: false`.

The earlier `b405fe1` candidate `dpl_FBLsEfdCxXjM1xWpFtRcVY7jMsXV` passed its
39 visitor checks but was never promoted: the owner then requested independent
Admin sessions. The replacement shares the login/empty-state UI primitives while
isolating persisted SDK sessions and broadcast channels, preserving visitor keys.

## Verification Evidence

Private artifacts: `artifacts/cms-cutover-20260928/` in the original checkout.
These files are ignored, not published through the website or committed.

- `recovery/`: source snapshot, successful isolated restore, and remote
  comparison confirming every original row unchanged after migration.
- `reference-import/report.json`: 45 resources were uploaded in private draft
  fragments, each serialized SHA-256 verified, then published together in one
  transaction. The initial oversized request failed before importing anything.
- `after/references/report.json`: all 45 payloads/fields and original hashes
  match their source files; the 34-resource authenticated bootstrap matches;
  13 anonymous, direct-table and service-RPC bypass checks deny access.
- `after/database/report.json`: full 220,218-value digest, T+1/T+6 projections
  and nine province/district/tambon scopes match the pre-migration source.
- `candidate-final/cms/`: real-account desktop/mobile CMS, search, pagination,
  custom filters, revision conflict, original retention, audit, JSON and Excel.
  Excel's 1,734 rows match every field, including nulls, with Cordia New and
  centered/middle data alignment. Runtime reads use CMS RPCs, not GeoJSON files.
- One labelled verification draft `0414a977-22b3-43db-ae00-80a6ca6fff38` retains
  unchanged December 2025 values and two audit entries. It is not published;
  no synthetic observation or forecast was accepted into visitor-facing data.
- `candidate-admin-auth/cms/` and `production/cms/`: real separate Admin login,
  same-scope multi-tab logout, opposite-scope session survival and successful
  real refresh-token calls after logout. Both desktop/mobile also verify CMS
  filters, history and unchanged JSON/Excel exports. Final ready-state snapshots
  wait for fonts, logos and forecast controls; provenance is recorded alongside.
- `candidate-admin-auth/browser-ready/` and `production/browser-confirmed/`:
  all 39 authenticated visitor checks passed on each, including scope, null/zero,
  monthly selection, graph units, source-exact Excel, irrigation reset and saved
  workspace reads. No raw archive fallback or parked Actual UI was activated.
- `production/references/`: all 45 resources match every source field/hash,
  the 34-resource bootstrap matches, and all 13 denied-access probes pass.
- `production/database/`: 220,218 forecast cells retain digest
  `44cfcd55c251d9c95f169d3b391040de435b3b6462139f501559a155456e5fd1`;
  T+1/T+6 and nine scoped projections match their original values.
- `recovery/comparison-1790535854905.json`: after promotion, every original
  field in all 442,862 rows across the eight captured public tables is unchanged.

The project's existing new-format secret key returned `Invalid API key` in
real preflight. The existing service-role credential passed Auth and operator
checks and is configured only in the sensitive server environment. No key was
generated, rotated, committed, or exposed in a browser variable. The first
rejected candidate was never promoted.

CI initially exposed stale tests expecting three nav controls/geometry files.
Tests now explicitly cover the CMS control and four geometry resources. The
live smoke also waits for map readiness (bounded 30 seconds) before counting
polygons; CMS cold-start network reads must finish, not just DOM navigation.
Targeted desktop/mobile static regression passed all four cases.

The first post-promotion visitor pass encountered one failed mobile forecast
load. Its screenshot is retained under `production/browser/`; the exact upstream
cause was not established, and no error was silently treated as empty data.
`production/forecast-cold/` records five successful cold-route repeats (2.1-2.9s)
with RPC status/timing and a controlled read-only network failure followed by
successful real-service retry. The complete subsequent production run passed.
This is bounded recovery evidence, not a promise that external reads cannot fail.
The smoke harness now waits for map readiness before irrigation interactions
and preserves failure screenshots/RPC failures rather than relying on a 5s
expectation immediately after navigation. No application deadline was relaxed.

## Recovery Procedure

If the new UI fails after promotion, re-promote the baseline deployment above.
Keep additive CMS tables and immutable history. The baseline uses the original
reference files and does not call CMS RPCs. Before any forecast publication,
check the old publication still matches the captured digest. Reverting an app
deployment is not permission to drop tables or erase reviewed publications.

The first cutover seeds identical reference data; it does not publish edited
forecasts or fabricated observations. Feature limitations remain documented in
[ADMIN_CMS.md](ADMIN_CMS.md), including new origins, geometry replacement,
binary workbook retention, and UI restore.
