# Irrigation Status Filter

## Source Representation

Verified against `Drought_T1-6_rev02.xlsx` (`Master_Data_Drought_Final`,
58,312 source rows) and `Drought_T1-6_rev02_Normalized_ArchiveReady(1).xlsx`
(`Location_Master!A1:H290`). Each of the 289 source IDs has one stable irrigation
status across all original rows. Normalized locations and canonical raw values
match exactly.

| Workbook value | Canonical location value | Filter key | Thai label | Tambons |
| --- | --- | --- | --- | --- |
| `Irragation` | `Irrigation` | `irrigated` | เข้าถึงชลประทาน | 20 |
| `RainFed` | `RainFed` | `rainfed` | พึ่งน้ำฝน (ไม่มีชลประทาน) | 97 |
| `Collecting` | `Collecting` | `unknown` | ยังไม่มีข้อมูลชลประทาน | 172 |

Meanings follow the user's domain clarification. `Collecting` means unknown
irrigation availability, not missing forecast data, zero risk, out-of-scope or
pending ingestion. Irrigation status is location metadata, not a monthly/T+
forecast and not a probability. The source spelling is retained separately in
`irrigationStatusRaw`; existing `irrigationStatus` normalizes the typo.

The published Supabase archive manifest already contains these same location
fields. The full and T+1 RPC projections preserve them, as do the static
canonical archive and generated T+1 projection. This change does not reimport
Excel, modify any archive values, or change the published dataset version.

## UI Contract

- `src/irrigation.ts` owns mapping, labels and intersection with administrative
  scope. `IrrigationStatusSelect` reuses `AppSelect` in both filter bands and the
  Home mobile editor. Default is `all` (ทุกสถานะ).
- The selected set drives forecast map eligibility, summary counts, the six
  fixed-target horizon comparisons and attention lists. Counts/denominators use
  the matching tambons, not the unfiltered provincial/district population.
  The map risk dropdown remains a separate map-only intersection.
- Supporting readiness uses the same matching locations; it remains distinct
  from forecast availability. Hidden legacy research/agriculture data is not
  substituted with irrigation-based estimates.
- Nonmatching map features are muted and cannot be selected, rather than
  reclassified as no-risk or missing. A zero-match selection displays an empty
  filter state with an explicit reset, not a green result or missing forecast.
- `irrigation=irrigated|rainfed|unknown` survives refresh, month/T+ changes,
  drilldown and parent navigation. `all` removes only this parameter. Explicit
  saved-item restoration uses the existing workspace navigation lifecycle.
- Subdistrict pages still omit aggregate charts. Their source irrigation label
  is visible independently of the currently selected filter.

## Saved Filters And Release

`20260906010000_saved_filter_irrigation.sql` adds only
`ktp_saved_filters.irrigation_criterion`, constrained to the four filter keys.
Existing records receive `all`; old clients can omit the column. New clients
accept pre-migration records and omit the field for all-status saves. Owner RLS,
forecast immutability and Auth are unchanged. Active irrigation selections are
saved/restored explicitly and never silently dropped.

After the user's push/deploy request, this migration was applied to the linked
production project `dihchjflzhcekywarhxd` with `supabase db push --linked`.
The dry run contained only `20260906010000`; remote migration history now
matches. Read-only SQL confirms the non-null `all` default, all four constrained
keys, the existing saved record backfilled to `all`, enabled owner RLS and
220,218 unchanged forecast cells. No archive import, publication, Auth or
environment changes were made. Hosted release evidence is recorded below and
in `HANDOFF.md`.

Recovery: promote the previous good frontend deployment and leave this additive
column intact. Old clients omit it and retain the `all` default; rollback does
not require deleting personal records or changing the forecast archive.

Verification owners: `tests/irrigation.test.ts`, `tests/savedWorkspaces.test.ts`,
the isolated `scripts/test-database-migration.mjs`, `e2e/irrigation.spec.ts` and
the saved-filter flow in `e2e/database-workspaces.spec.ts`. Browser fixtures are
localhost-only and do not provide evidence of a remote migration being applied.

## Local Verification

- 136 unique Vitest tests passed with nested `tmp-snapshots` worktrees excluded.
- 10 isolated database checks passed, including all 220,218 source cells,
  immutable archive projections, owner RLS, and saved-filter column defaults
  and validation. These checks do not connect to production.
- The protected Supabase-mode build passed TypeScript, exposure checks and
  bundle budgets. It contains no raw/static archive payload.
- 10 built Playwright cases passed across desktop and mobile: irrigation
  counts/map intersection, month/T+ and route persistence, Collecting with valid
  forecast values, zero-match subdistrict reset, saved-item restoration and
  database failure/retry without static fallback.
- Final screenshots are under `tmp-snapshots/irrigation-verified/`. Desktop and
  mobile filter layouts were inspected, including wrapped map toolbar counts
  and all zoom controls inside the map plot. Browser data/Auth/RPC are mocked
  locally from the canonical archive; these are not production screenshots.
- Canonical archive and generated data have no diff. At this local checkpoint,
  broader whole-site E2E, real Safari, remote SQL and production irrigation
  checks were not run. The authorized release follows this checkpoint.

## Hosted Release

Runtime `bd3edcd` was built as `dpl_Eo1sitfh7j4nBT6AJvagFg1VJn9j` using
Production configuration. Test-only `7d0b69d` corrects an old dropdown-count
assertion and verifies the irrigation default; it changes no runtime, build,
smoke or archive files. Quality Gate `33972914037` passed with 136 unit tests,
10 database checks, 74 built E2E passes (10 conditional skips), four database
UI passes and both protected builds.

Real-account candidate and production smoke passed the five base routes and all
irrigation groups on desktop/mobile, with exact source codes and risk counts. The same
artifact was promoted to `https://korattanphai.vercel.app`; alias inspection
confirms the deployment above, entry `index-0e9ee1ef70.js` and Supabase backend.
Reports are `smoke-results/irrigation-candidate/report.json` and
`smoke-results/irrigation-production/report.json`, both with zero failures.
Production desktop/mobile screenshots were visually inspected. An authenticated
explicit PostgREST
`select('irrigation_criterion')` returned HTTP 200 and the one existing record's
`all` value, confirming that the API recognizes the new column.

The archive verifier passed after the migration: full and T+1 projections,
220,218 cells and the pinned prediction digest are unchanged, with anonymous
reads denied. No real saved record was created, updated or deleted; save/restore
writes are covered by isolated database and mocked browser tests.
