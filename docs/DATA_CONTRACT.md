# Korat Tan Phai / โคราชทันภัย Data Contract

Source cleanup checkpoint: 2026-10-03. This document describes the working
source contract; [HANDOFF.md](HANDOFF.md) records deployment evidence separately.

## Actual / Forecast Boundary

[ACTUAL_FORECAST_SEPARATION.md](ACTUAL_FORECAST_SEPARATION.md) owns the source audit,
eligibility contract and open source-integration gates for the parked Actual work.
The active [forecast-only contract](FORECAST_ONLY_RESTORATION.md) supersedes its
routing rules. See [HANDOFF.md](HANDOFF.md) for release evidence. The archive
persistence model below remains active; it is not an actual-data store.

- In the parked operational implementation, `period` is the valid month. Trusted server time in Asia/Bangkok
  resolves past/current to actual and future to forecast. Current-month actual is
  partial-period; coverage-through must come from source records, never be invented.
- Archive `target` / saved `target_period` still mean origin T, with forecast target
  T+h, with or without `mapLayer=forecast-archive`. Bare legacy links retain
  their exact forecast origin/horizon. Retired `period` is never a forecast origin.
- Actual kind, metric/classification, crop scope, geographic version, review,
  publication, coverage and revision are separate fields. Do not apply forecast
  0/1/2 semantics or fan out district/province actuals to tambons without an approved
  metric/aggregation contract. Missing, withheld, pending and request error differ.
- Operational forecasts require an exact eligible vintage with verified issuance
  and publication/freshness policies. Rev03 source T is not proof of a historical
  first-publication date; an ingest timestamp cannot supply that proof.
- `GET /api/operational-context` currently returns only server clock/policy and
  empty source catalogs, with `private, no-store`. No actual transport is connected.
  Active forecast routes do not call it. Parked operational requests must not
  fall back to archive values. Supabase forecast revision checks remain in force.
- Existing followed areas remain geographic bookmarks. Actual selections cannot
  be serialized into forecast saved filters. No database schema or ACL changed.

## Persistence Model

Supabase Auth supplies identity. `VITE_DATA_BACKEND=supabase` selects published
forecast rows and owner-only saved workspaces. Isolated `static` builds remain
available for regression verification; they are not a database-error fallback.
Original normalization and lineage are documented in `DROUGHT_REV03_NORMALIZATION.md`
and `DROUGHT_REV03_CUTOVER.md`.

The retained canonical source artifacts are:

- `src/data/canonical/nakhon_ratchasima/admin_hierarchy.json`: real province,
  district and subdistrict identities, labels and navigation slugs.
- `src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json`:
  source-backed archive used for verification and isolated static builds.

`src/data/catalog.ts` derives geographic locations from the hierarchy only.
Generated summary/T+1 projections come from rev03, not a second forecast source.
The retired source registry, research/rainfall stubs, synthetic nationwide data
and rev02 archive/builders are no longer runtime inputs or bundled references.
Their historical documentation is not evidence that those feeds are connected.

## Published Reference Registry

`shared/cmsResources.mjs` is the allowlist used by CMS bootstrap, the Vite
reference plugin and seed preparation. `VITE_REFERENCE_BACKEND=cms` requires
the Supabase forecast backend and disables bundled reference fallbacks.

| Resource key | Purpose | Startup payload |
| --- | --- | --- |
| `canonical/nakhon_ratchasima/admin_hierarchy` | Real area identity/navigation | Preloaded |
| `generated/forecast-archive-summary` | Generated archive metadata | Preloaded |
| `geodata/nakhon-ratchasima-subdistricts` | Local subdistrict polygons | On demand |
| `geodata/nakhon-ratchasima-boundary` | Local province outline | On demand |
| `geodata/thailand-adm1` | Neighboring province context | On demand |

All five are read-only system resources (`editable: false`). The HTTP resource
handler denies clone/edit/publish for inactive or unknown keys as well as these
read-only resources. This does not disable the separate forecast draft/import/
publish workflow. Historical stored reference versions remain readable through
existing get/history operations; the source cleanup neither deletes database
rows nor changes their published pointers.

Bootstrap requires all five active heads, pins their IDs, and requests only the
two preload payloads. Extra retired catalog/bundle rows cannot become runtime
dependencies. Geometry reads use pinned IDs; failed reads expose retry.

## Database and Canonical Models

Forecast persistence includes `ktp_districts`, `ktp_subdistricts`,
`ktp_forecast_datasets`, `ktp_forecast_runs`, `ktp_forecast_values` and
`ktp_research_crosswalk`. The crosswalk name is retained for source lineage;
it does not activate retired research panels. `ktp_followed_areas` and
`ktp_saved_filters` remain owner-scoped with RLS.

CMS stores original uploads, forecast drafts, validation/publication history and
reference versions separately. Its account session/membership checks are
independent of visitor login. Browser roles cannot directly write published
forecast tables. Model-input ingestion/storage is a separate validated backend;
an accepted input does not automatically publish a rev03 forecast.

Frontend models in `src/types.ts` cover real hierarchy, archive selections,
forecast values and supported preferences. A parked generic agricultural panel
may retain an input type; this is not an active feed or seeded agricultural value.
Removed personas, runtime alerts and synthetic evidence are not user state.

## Coverage Contract

- Active geography: one province (`TH-P29`, administrative code `30`), 32
  districts and 289 subdistricts, or 322 location nodes in total.
- Original rev03: 289 mapped source IDs, 127 source months, six horizons and
  220,218 forecast-vintage slots. Counts describe baseline integrity; published
  metadata supplies current visible counts and selectable periods.
- Map source artifacts: subdistrict geometry, the generated local province
  outline and Thailand ADM1 for neighboring province context. All 289 local
  codes must join to the hierarchy. ADM1 context is not a nationwide risk feed.
- No-data, out-of-scope and risk zero remain distinct. Removing a stale source
  entry must not turn an unknown value into available data or zero risk.

## Retired Research Data

The old monthly research panel, source matrix, readiness metrics, rainfall
coverage stubs and demo source list have been removed from the active graph.
References to earlier research periods or station audits in historical reports
are provenance only. They must not be used to claim current observations,
forecast accuracy, live provider access or a publication state.

## Nakhon Ratchasima Drought Forecast Archive

### Time Semantics (User Confirmed 2026-09-06)

The user confirmed that every workbook `Year`/`Month` row is the forecast origin/base
month T. T+1 through T+6 are the following six calendar months. This decision
supersedes the earlier product convention that treated the source month as a
fixed target and calculated issue months backwards. Normalize only the original
`Drought_T1-6_rev03.xlsx` using this definition, never the superseded normalized
workbook or other prediction providers.

- The original rev03 source months T span `2015-06` through `2025-12` (127 months).
  Published CMS revisions supply the selectable months; do not hard-code the latest month in UI.
- Runtime projection uses `issueMonth = sourcePeriod` and
  `targetMonth = sourcePeriod + horizon` with calendar-month arithmetic.
- Source `2015-06` forecasts `2015-07` through `2015-12`; source `2025-12`
  forecasts `2026-01` through `2026-06`. T+6 targets therefore span `2015-12`
  through `2026-06`. The source month T is not an additional T+0 risk value.
- Rev03 canonical data, normalized files and database values trace to the
  original workbook and use forward dates. Legacy fields `targetMonths` and
  `packedRiskByTargetMonth`, URL query `target`, and saved `target_period` still
  identify the source month T. Their names do not define the displayed target
  date. Database `origin_period = source_year_month`, and `target_period` is
  generated by adding the horizon to that origin.
- Existing and new links/saved filters retain the same source-row/horizon
  selection. Rev03 supplies corrected source values; no saved-filter or
  followed-area rows are rewritten by the forecast cutover.

### Display Semantics

- User-facing coverage is `(no risk + moderate + high) / expected tambons`.
  Matched rows, including explicit null, measure import completeness only.
- Six chart slots show the six forward target months T+1-T+6 from one selected
  source month T. All six share the same origin month; changing the selected
  horizon changes the displayed target month while preserving T.
- Each chart slot retains in-scope, explicit out-of-scope and missing counts.
  An all-unavailable slot must not become a green zero. Do not connect/fill
  across unavailable slots; a fully unavailable series has no risk graph.
- Single-tambon UI reports the record status directly, without population
  counts or a link back to the same tambon. Null and missing remain distinct.

The Supabase provider reconstructs the same full/T+1 archive shapes from
normalized rows, without a static fallback. Original Year/Month, row lineage
and location names are preserved. The new dataset time-role marker is
`CONFIRMED_SOURCE_IS_ORIGIN`. Baseline normalization verifies the approved
original workbook hash, normalized manifest/file hashes and canonical projection.
Later no-code imports or edits require validation, an explicit CMS publication
and retained source/audit history; they do not silently replace that provenance.

FACT: `drought_forecast_archive_rev03.json` is the source-backed T+1 through
T+6 drought forecast archive built from `Drought_T1-6_rev03.xlsx` through
`data/normalized/drought-rev03/`. It is the current public
drought prediction source used by the province, district, and subdistrict
workspace surfaces. The baseline dataset version is
`drought-rev03-a3be44486c8e`. Runtime reads the current validated publication
revision, including approved CMS edits; older retained datasets are not a fallback.

Loading contract:

- Database mode checks `ktp_latest_forecast_revision` before cache reuse and
  reads `ktp_load_forecast_slice` for the requested area and source month.
  The overview requests T+1; the drought workspace requests six horizons.
  Cache identity includes user, published dataset revision and requested scope.
- Focus/visibility and periodic revalidation check for a newer publication.
  Logout/account changes dispose protected forecast caches. Departed or stale
  requests cannot replace the active selection. See `FORECAST_SCOPED_LOADING.md`.
- Database builds exclude both raw archive assets. Errors show retry, without
  substituting bundled JSON, another provider or a synthetic forecast.
- In isolated static mode, `?url` emits the canonical archive as a content-hashed
  asset whose bytes are checked by `npm run check:bundle`. Overview uses the
  generated T+1-only projection; six-horizon routes load the full archive on demand.
- `forecast-overview-t1.json` and `forecast-archive-summary.json` are generated
  by `npm run generate:forecast-summary` before dev/build. Do not edit them manually.
- CMS reference mode pins only the five active resources for the document.
  It preloads hierarchy and summary, then loads the three map geometries on demand.
  Missing active reference data is an error; there is no static geometry fallback.
- Pending, failed and timed-out initial loads must not render forecast counts
  or green map states. Retry preserves source month T and horizon. Previously
  loaded same-scope data may stay visible with explicit revalidation feedback;
  failed Excel revalidation blocks download.

Source and mapping contract:

- Source/location sheet: `Master_Data_Drought_Final`.
- Original workbook lineage: `Drought_T1-6_rev03.xlsx`.
- Workbook source rows: 58,312.
- Deduplicated source rows: 36,703.
- Exact duplicate source rows collapsed for forecasts: 21,609; all original
  occurrences remain in `source_row_lineage.csv`.
- Mapped source IDs: 289 of 289.
- Mapped canonical subdistricts: 289 of 289.
- Forecast vintage identity: `subdistrictCode + sourcePeriod + horizon`.
  Legacy archive/URL/storage keys named `targetMonth`, `target` or
  `target_period` preserve that source-period identity.
- Workbook `Year`/`Month` is the origin/base month T, confirmed by the user on
  `2026-09-06` for the entire archive.
- Runtime dates: `issueMonth = sourcePeriod`;
  `targetMonth = sourcePeriod + horizon`.
- Equal numeric values across T+ horizons remain separate forecast vintages.
- Every database value retains `source_first_row` and `source_row_count`.
- User-confirmed geography correction: ID 222 is Nong Rawiang, Phimai
  (`301512`); ID 5 is Nong Rawiang, Mueang Nakhon Ratchasima (`300106`).
  Original names remain untouched; mapping corrections are separate metadata.
- Irrigation is independent of risk: `Collecting` means unknown irrigation,
  `RainFed` means rain-dependent/no irrigation, and `Irrigation` means access to
  irrigation. Do not infer a risk value from this attribute.

Risk value contract:

- `0` means no detected forecast risk signal.
- `1` means moderate forecast risk.
- `2` means high forecast risk.
- Blank workbook cells are represented as `null` and mean out of scope for the
  archive, not no risk and not missing evidence.
- Missing records after a join failure are a separate `PENDING_SOURCE` problem
  and must not be collapsed into blank/out-of-scope or green/no-risk.

UI contract:

- Drought archive modules use the selected source/base month T plus a single
  T+ selector. Actual target month is derived from that pair.
- Province, district, and subdistrict drought maps use the same published source
  and the same map status semantics.
- Archive map legends show no-risk, moderate risk, high risk, and out-of-scope
  states. Out-of-scope areas use a muted hatched treatment.
- Tooltip/detail copy must identify the actual target month, origin/base month
  T, T+ horizon, numeric risk value, and semantic label.
- Archive forecasts are not official damage figures and are not observed
  historical drought impacts.
- The overview starts at the latest available source month T and fixes T+1
  (the original rev03 baseline ends at `2025-12` T, forecasting `2026-01`).
  Changing district scope updates map focus, counts and high-risk links.
  Counts use canonical subdistrict codes, with null/out-of-scope and missing
  records kept separate. Synthetic agricultural rai and confidence have been
  removed from the Korat source records and hidden from Home/drought UI. Their
  shared component and styling remain available for source-backed data only;
  missing data must not render as zero or an empty replacement card.

Original rev03 baseline validation examples (not hard-coded current UI totals):

- Source month T `2025-12` (`ธ.ค. 2568`) is archive forecast data, not the old
  cleared historical map panel. Its target months are January-June 2026.
- T+1 from `2025-12`, targeting `2026-01`, has 117 in-scope subdistricts,
  172 out-of-scope subdistricts, 0 no-risk, 117 moderate-risk, and 0 high-risk
  subdistricts.
- Ban Kao (`300806`) remains a useful validation example: source month T
  `2025-12` has forecast risks `[1, 1, 1, 2, 2, 2]` across T+1 through T+6,
  targeting `2026-01` through `2026-06`, all with origin month `2025-12`.

## Future Rainfall Integration Guards

No live rainfall reading is supplied by the active dashboard. The former
station/proxy JSON stubs are retired. `RAINFALL_SOURCE_AUDIT.md` remains
historical source research and a checklist for a future verified integration,
not a live inventory or authorization to restore fabricated observations.

Any future adapter must preserve these distinctions:

- A direct station reading and nearest-station representative context are
  different. A proxy needs station identity, distance, source timestamp,
  confidence and an explicit indication that it is not a direct local reading.
- Rainfall units and accumulation window must be explicit, for example `mm`
  over `24h`; source timezone and coverage-through must come from evidence.
- Missing, stale, withheld and request errors are not `0 mm`, low risk or normal.
- National/regional context cannot become a subdistrict observation by joining
  the same value to every administrative code.

## Provenance and Map Semantics

`REAL` requires verified source lineage; `DERIVED` requires reproducible inputs
and transformations. Any retained historical synthetic type or fixture used by
isolated tests does not authorize synthetic production forecasts. Source acronyms
may remain in English when they identify an actual source or format.

The active map supports forecast-risk coloring and workbook irrigation coloring.
Risk comes from the selected published T/horizon; irrigation comes from the same
source location metadata and is independent of risk. Missing values remain
unavailable. There is no runtime multi-hazard layer catalogue or automatic
weather/water/soil feed behind these controls. The retired `Normal`/`Watch`/
`Warning`/`Severe` demo taxonomy is not the rev03 `0`/`1`/`2` contract.

## Geographic Area Model

`TH-P29` remains the only Nakhon Ratchasima province object. Its 32 districts and
289 subdistricts derive from `admin_hierarchy.json`. Preserve existing IDs,
district slugs and subdistrict paths for deep links, search and saved workspaces.

Join by `provinceCode`, `districtCode` and `subdistrictCode`, never by display
name or route slug. Real model-input validation derives its allowed code set
from this same hierarchy. Do not fabricate values for unmatched areas.

The source geometry files are:

- `public/geodata/nakhon-ratchasima-subdistricts.geojson` (GISTDA local extract).
- `public/geodata/nakhon-ratchasima-boundary.geojson` (dissolved local outline).
- `public/geodata/thailand-adm1.geojson` (neighboring province context).

Regenerate the local outline with `npm run generate:nr-boundary`; do not edit
its coordinates by hand. CMS builds load published versions through authenticated
reference RPCs and omit public-file fallback. Static regression builds use these
same source files. The unused country underlay and nationwide demo map are removed.

## Local Storage, Session and Caches

- `korat-tan-phai-preferences-v1` persists only `language` and `selectedMonth`.
  The initial month is empty until an actual archive supplies available periods;
  language normalizes to Thai. Toasts are transient.
- If the new key is absent, `korat-tan-phai-demo-state-v1` is read for supported
  preferences only. Retired workflow fields are ignored, not replayed. The old
  snapshot is not deleted or overwritten by this migration.
- Initial mount and transient notices do not rewrite stored preferences.
  Malformed values recover to defaults with a visible storage notice. Storage
  errors use document-lifetime memory, not a false durable-save result.
- `korat-tan-phai-login-user` is a retired demo-auth key and is not a session.
  Supabase SDK manages auth token persistence independently.
- Followed areas/saved filters are owner-scoped database rows, not imported
  from legacy browser workflow state. Logout/account changes dispose protected
  archive/saved-row caches. Failed database saves never claim local success.

## API Boundaries

- Supabase Auth owns visitor sessions; CMS uses its independent admin scope.
- Forecast reads use `ktp_latest_forecast_revision` and
  `ktp_load_forecast_slice`. Owner-scoped saved workspaces use PostgREST/RLS.
- Reference reads use `ktp_cms_reference_catalog`, `ktp_cms_reference_bundle`
  and `ktp_cms_reference_read` with the active resource allowlist.
- `/api/admin-data` owns no-code import, validation, drafts, publication and
  historical resource reads under admin membership checks.
- `/api/model-inputs` accepts validated machine inputs into its separate store.
  `/api/operational-context` returns policy/source-gap metadata for parked work.
- `/api/health` and `/api/telemetry` implement operational checks/technical events.
  Implemented handlers are not evidence of configured feeds, schedules or alerts.
- The old `/api/risk-fusion` synthetic explanation endpoint is removed.

## Source Precedence and Compatibility

Current user decisions, code/tests and verified source/publication metadata take
precedence over historical design notes. The original rev03 workbook, normalized
lineage/hashes and approved CMS publication history remain auditable; source
registry prose does not substitute for an actual connection.

Preserve geographic IDs, existing district/subdistrict deep links, legacy
`/nakhon-ratchasima/...` aliases and origin-T meanings of saved `target` keys.
Do not rewrite followed areas or saved filters during source cleanup. Preserve
stored CMS versions, originals and audit history even when their former resource
key is no longer active or editable.

Critical requests retain deadlines, retry and stale-response protection. A
failed active database/CMS read must not silently fall back to old bundled data.
Do not hard-code visible forecast counts, latest source dates, freshness,
publication state, operator identity or approval status. Stable administrative
codes, format/risk enums, calendar arithmetic and verified baseline assertions
are contracts, not fabricated live values.
