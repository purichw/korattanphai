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
Database migration is complete; web promotion is pending the final candidate
and CI gates. Candidate source is `b405fe1` (runtime changes through `e51b0a7`),
deployment `dpl_FBLsEfdCxXjM1xWpFtRcVY7jMsXV`.
That candidate passed 39 visitor checks and the real CMS workflow but is held:
it predates the separate Admin-session requirement. A replacement candidate and
independent login/logout/tab/refresh verification are required before promotion.

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
