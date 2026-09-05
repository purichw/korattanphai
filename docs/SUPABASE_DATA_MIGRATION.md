# Forecast Archive And Saved Workspaces

## Scope

Only the approved rev02 forecast archive and per-account followed areas/saved
filters are in this migration. No ThaiWater, rain observations, synthetic
agricultural metrics, persona permissions or legacy localStorage workflow state
is imported. Geometry and unrelated local context remain in their current files.

## Audited Baseline

Read-only SQL against `dihchjflzhcekywarhxd` on 2026-09-05 confirmed:

| Table | Rows | Access |
| --- | ---: | --- |
| `ktp_districts` | 32 | authenticated SELECT |
| `ktp_subdistricts` | 289 | authenticated SELECT |
| `ktp_forecast_datasets` | 0 | authenticated SELECT of published rows |
| `ktp_forecast_runs` | 0 | authenticated SELECT through published dataset |
| `ktp_forecast_values` | 0 | authenticated SELECT through published dataset |
| `ktp_research_crosswalk` | 0 | no browser grants |

All six have RLS enabled. There are no anon grants on these tables. The
reconstruction in `supabase/baseline/20260905_existing.sql` is for isolated
tests/new environments, NOT a migration to run against the linked database.

## Source Identity

`scripts/lib/forecast-migration.mjs` pins the original workbook, normalized
workbook and canonical artifact SHA-256 values from the prior complete source
audit. A changed workbook/artifact stops the importer and requires a new audit.
There is no arbitrary source URL, provider fallback or score transformation.

- Version: `drought-rev02-9b299cefc704`.
- Dataset ID: `9b299cef-c704-4139-8085-18664253cc80`.
- 289 canonical codes, 127 months, 6 horizons, 220,218 vintages.
- Risk 0: 44,474; risk 1: 27,670; risk 2: 22,830; explicit null: 125,244.
- `source_year_month` preserves `Source_YearMonth` verbatim.
- The normalized workbook does NOT confirm whether this is issue or target
  month. `source_time_role = UNCONFIRMED_PRODUCT_USES_TARGET` records that fact.
- Existing product interpretation is retained: target = source month;
  `origin_period` = derived issue month = target minus horizon. Do not describe
  this interpretation as confirmed by the workbook.
- Crosswalk evidence preserves Source_ID, irrigation metadata, mapping method,
  flags and the known ID 222 correction. Admin codes remain the join keys.
- Manifests store unchanged full/T+1 metadata; actual predictions live only in
  the normalized values table. The security-invoker read RPC reconstructs the
  existing archive shape and obeys table RLS, including unpublished isolation.

## Import Safety

New SQL is additive. Import creates a draft and resumes idempotently without
overwriting existing records. A duplicate with different values fails the
subsequent digest comparison; it is never silently replaced. Publish locks the
archive tables briefly and checks every prediction via an ordered SHA-256,
all run dates, counts, manifests and crosswalk before changing status atomically.
The importer rejects the wrong linked project. Generated SQL/evidence is under
the ignored `tmp-snapshots/archive-migration-*` directory, without credentials.

```bash
FORECAST_WORKBOOK_DIR=/Users/point/Downloads node scripts/migrate-forecast-archive.mjs check
# After CLI login, linking, schema review and approval to apply the migration:
# supabase db query --linked --file supabase/migrations/20260905110000_archive_and_saved_workspaces.sql
FORECAST_WORKBOOK_DIR=/Users/point/Downloads node scripts/migrate-forecast-archive.mjs import
node scripts/migrate-forecast-archive.mjs verify
FORECAST_WORKBOOK_DIR=/Users/point/Downloads node scripts/migrate-forecast-archive.mjs publish
```

Do not execute commands merely because they appear here. Publishing the
dataset is distinct from enabling a frontend provider or deploying the app.
Prefer `supabase db push --linked` after inspecting its dry run and migration
history. If the SQL Editor/Management API is used instead, record the verified
application with `supabase migration repair --linked --status applied
20260905110000` before a later `db push`; never mark an unapplied schema applied.
No archive metadata, risk values or personal state is writable through an
anonymous client. Browser clients never receive a service key or DB password.

## Saved Data

- `ktp_followed_areas`: owner UUID + canonical province/district/subdistrict
  code. Generated FK columns reject unknown areas. Opening a followed area
  selects that area with the page's latest available archive month.
- `ktp_saved_filters`: explicit name, view, area, dataset ID, target, horizon,
  risk status. Foreign keys require a real vintage. Overview only permits T+1
  and province/district scope. Drought/rice are fixed product context.
- RLS uses `auth.uid() = user_id` for all read/write operations. UUIDs are not
  derived from the display persona or mutable user metadata.
- No arbitrary redirect URLs, auth tokens or legacy demo state are saved.
- Each authenticated provider has isolated, disposable memory. Failed requests
  show errors and retry; they do not silently save to localStorage instead.

## Verification Status

Local runtime wiring is gated by `VITE_DATA_BACKEND=supabase`; default/missing
is `static`, and invalid values fail the build. Supabase mode requires real
browser auth configuration, excludes the two raw forecast JSON assets from
new builds, and has no silent static fallback. The tiny legacy entry summary
and public geometry are unchanged. Older public deployments still contain
their original static assets; this change does not revoke old deployment URLs.

`WorkspaceBookmarks` is composed once per visible desktop/mobile account
toolbar, using the existing shared buttons and compact modal. Saving records
target, T+, area, dataset and map risk. `mapRisk` now round-trips through URLs;
explicit navigation remounts only the route workspace, preserving provider
caches while applying a saved selection even on the same route. Ordinary
in-place dropdown changes do not remount the workspace.

```bash
npm run test:database
npm run test:e2e:database
```

The UI harness runs a separate local Vite server with a fake Supabase host and
source-backed archive responses. Personal records are test-only network
fixtures. It never reaches the real project or saves credentials.

Local isolated PostgreSQL/PGlite: all 220,218 values imported and checked;
full and T+1 RPC results deep-equal canonical projections; anonymous reads and
authenticated archive writes denied; two simulated Auth users cannot read,
insert, transfer, update or delete each other's saved records. This does not
yet prove remote PostgREST/RLS, production latency or hosted UI behavior.

Local checks at this checkpoint: 217 unit tests passed; nine isolated database
checks passed; four desktop/mobile database UI scenarios passed, including
same-route saved-filter restoration, reload, confirmed removal, RPC retry and
absence of static archive fallback. The protected database build passed exposure
and bundle checks, including absence of both raw forecast JSON assets.
Fourteen additional desktop/mobile static-provider regression scenarios passed
for Home, province/district/subdistrict filters/maps, area navigation, session
refresh and logout failure. Canonical/generated archive files remain unchanged.
Screenshots: `tmp-snapshots/database-workspaces/desktop-saved-filter.png` and
`mobile-saved-filter.png` (test-only account, canonical forecast data).

Remote schema migration `20260905110000` was applied with `supabase db push`
after its dry run on 2026-09-05. CLI migration history matches the local file.
The existing `target_period` is GENERATED ALWAYS from origin + horizon; the
importer omits it, and the isolated baseline now reproduces that constraint.
The first import stopped before inserting predictions when this distinction
was detected; the corrected importer resumes without overwriting any values.
It batches twelve independently transactional months per CLI request.

At this source checkpoint, the approved dataset is being imported as a draft.
Production still uses the previous static-provider deployment. Publication,
real API verification and deployment remain separate gates, not implied by a
successful migration. `scripts/verify-database-archive.mjs` authenticates with
session-only smoke credentials and compares both complete RPC projections to
canonical data, confirms the only published source, and denies anonymous reads.
It records no credentials and never changes predictions or personal records.
