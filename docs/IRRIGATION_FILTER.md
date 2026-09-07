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

- `src/irrigation.ts` owns mapping, labels, categorical colors and intersection
  with administrative scope. `IrrigationStatusSelect` reuses `AppSelect` inside
  the shared map toolbar, not the page filter band or Home mobile editor.
  Default is `all` (ทุกสถานะ).
- The selected set drives forecast map eligibility, summary counts, the six
  fixed-target horizon comparisons and attention lists. Counts/denominators use
  the matching tambons, not the unfiltered provincial/district population.
  The map risk dropdown remains a separate map-only intersection.
- Supporting-data readiness UI has been removed sitewide. Forecast availability
  is still displayed separately; hidden legacy research/agriculture data is not
  substituted with irrigation-based estimates.
- Nonmatching map features are muted and cannot be selected, rather than
  reclassified as no-risk or missing. A zero-match selection displays an empty
  filter state with an explicit reset, not a green result or missing forecast.
- Choosing a status does not change the URL, history length or route. Live
  selection is held in React and `history.state.ktpIrrigation`; refresh and
  month/T+/risk updates retain it. Existing deep links still initialize from
  `irrigation=irrigated|rainfed|unknown` when no live state exists. `all` also
  overrides an older query value without rewriting that URL. Explicit area
  navigation and saved links encode the active selection. Copying the address
  alone does not capture later local filter changes; use saved filters for that.
- Map color buttons switch between drought forecast and irrigation metadata.
  Choosing an irrigation criterion activates irrigation colors: blue `#397fc5`
  (irrigated), purple `#9262b7` (rainfed), gray `#87939e` (unknown). Heading,
  accessible feature labels and legend match the encoding. Underlying source
  risk values/classes stay unchanged; charts/KPIs keep their hazard colors.
  Switching colors alone does not filter data. Selecting all while viewing
  irrigation shows all three categories. Map risk reset only clears map risk.
- Subdistrict pages still omit aggregate charts. Their source irrigation label
  remains available in the map preview independently of the selected criterion.

## Map-Control Correction (Local Checkpoint)

The UI contract above reflects the follow-up correction after the hosted release
below. No archive, SQL migration, Auth, RLS or production setting is changed by
this correction. This local checkpoint is superseded by the map-control
production release recorded at the end of this document.

- 18 targeted unit tests passed: source partitions and all-period risk totals,
  live history state, unchanged URL/history length, reset, deep links and saved
  selection precedence.
- Protected Supabase-mode build passed TypeScript, exposure checks and budgets;
  entry `index-897c68b4e4.js`, no static forecast payload. The usual large-chunk
  advisory remains; enforced budgets pass.
- 12 built browser tests passed on Chromium desktop (1440x960) and mobile
  (390x844). They cover whole-page counts/charts, map/risk intersection, exact URL
  stability, reload, explicit area navigation, empty subdistrict reset, keyboard
  selection, all 289 categorical fills, readiness filtering, bookmark save/restore
  from live state rather than a stale URL, and database failure/retry.
- Final screenshots: `tmp-snapshots/irrigation-map-proof/`; desktop/mobile maps
  and the 1024x900 tablet adaptation were inspected. Home mobile puts irrigation
  on its own row to avoid long-label overlap. Browser Auth/RPC are localhost-only
  mocks using canonical data, not production verification.
- `git diff --check` passed; canonical/generated data and `supabase/` have no
  diff. Whole-site/static-provider E2E, real Safari and remote database checks
  were intentionally not rerun at this checkpoint. Hosted verification follows
  below.

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

## Map-Control Production Release (2026-09-06)

Runtime `b4fcc194136e46a134e5d2de5fda77e7a6ccd184` is pushed to
`fix/nr-map-zoom-performance`. Quality Gate `34022249917` passed with 139 unit
tests, 10 isolated database checks, 76 built browser passes (10 conditional
skips), four database UI passes and both protected builds. The final correction
also retains sufficient mobile Home map height and updates the old top-filter
regression to assert the control's new map location.

The clean-checkout Production candidate `dpl_4h4XtWn25ATQWhVZ32cuoi4HR1aQ`
passed real-account smoke and was promoted without rebuilding. Public
`https://korattanphai.vercel.app` serves this Ready deployment, entry
`index-7e6dd13fdd.js` and the Supabase provider. Uploaded source inspection
confirmed no ignored test/smoke artifacts or actual `.env` files; future CLI
releases should likewise use a clean checkout.

Candidate and production reports each contain 20 passed entries and zero
failures:

- `smoke-results/irrigation-map-candidate-clean-verified/report.json`
- `smoke-results/irrigation-map-production/report.json`

Both cover desktop/mobile Home, province, district, single-tambon and unavailable
district views, actual in-map dropdown interactions, exact source groups and
categorical fills, filtered risk totals, unchanged URL/history, reload,
empty/reset, saved reads, exact full/T+1 RPC projections and no static fallback.
Production diagnostics record 30 HTTP 200 finished requests and no browser or
visible UI errors. Fresh production screenshots in the same directory were
visually inspected, with scroll normalized before capture.

Earlier failed attempts remain recorded separately, including transient
connection closures and map waits. Direct Node and Chromium transport checks
returned the exact full archive before the successful complete reruns. No
assertions or timeouts were relaxed. No SQL, archive, Auth, RLS, environment or
personal records were changed. Physical Safari, load/SLO tests and real saved
record writes were not exercised. Recovery is the prior good frontend
`dpl_Eo1sitfh7j4nBT6AJvagFg1VJn9j`, with Supabase left intact.
