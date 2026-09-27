# CMS Cutover Checkpoint

Owner approval: 2026-09-28, Asia/Bangkok, migrate only after detailed before/after
checks using the existing test account. No new accounts or auth changes.

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
- Physical backup API reports no available backup and PITR disabled. A scoped
  logical recovery snapshot must be completed and verified before remote writes.

## Activation Gates

The CMS candidate uses `VITE_DATA_BACKEND=supabase` and
`VITE_REFERENCE_BACKEND=cms`. Server-only credentials are
`CMS_SUPABASE_URL` and `CMS_SUPABASE_SECRET_KEY`; never put them in browser env.

Only migrations `20260909010000`, `20260927010000`, `20260927020000`, and
`20260927030000` plus the reviewed reference seed are authorized for this
cutover. Do not run every pending migration or change unrelated services.

Full-size transaction-only production rehearsal found the existing publication
trigger exceeding 60 seconds when checking a newly cloned dataset. Migration
`20260928010000` pre-aggregates scoped value counts before joining runs, keeping
all completeness and immutability guards. A fresh rehearsal is required before
opening CMS publication. The failed rehearsal rolled back without a new dataset.

Required: logical checkpoint, schema/row parity, all 45 reference payloads,
real Auth/operator/anonymous permission checks, protected bundle budgets,
required CI jobs, candidate smoke, then production smoke and integrity check.
Current status: preparation, not deployed. Update this record with terminal
results before describing migration as complete.

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
