# เกษตรทันภัย Data Contract

## Persistence Model

FACT: There is no database. Current data sources are static JSON files and
browser `localStorage`.

Static source files:

- `src/data/canonical/advisory.json`
- `src/data/canonical/crop_profiles.json`
- `src/data/canonical/data_model_registry.json`
- `src/data/canonical/data_period.json`
- `src/data/canonical/event_detail_enrichment.json`
- `src/data/canonical/farmer_profile.json`
- `src/data/canonical/field_verification_tasks.json`
- `src/data/canonical/historical_analogues.json`
- `src/data/canonical/locations.json`
- `src/data/canonical/long_term_climate_illustrative.json`
- `src/data/canonical/map_layer_catalog.json`
- `src/data/canonical/national_monthly_backbone.json`
- `src/data/canonical/outcome_analytics.json`
- `src/data/canonical/province_monthly_risk.json`
- `src/data/canonical/risk_events.json`
- `src/data/canonical/source_registry.json`
- `src/data/canonical/users.json`
- `src/data/canonical/nakhon_ratchasima/admin_hierarchy.json`
- `src/data/canonical/nakhon_ratchasima/district_subdistrict_matrix.json`
- `src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev02.json`
- `src/data/canonical/nakhon_ratchasima/dwr_ews_station_coverage.json`
- `src/data/canonical/nakhon_ratchasima/evidence_records.json`
- `src/data/canonical/nakhon_ratchasima/local_subset.json`
- `src/data/canonical/nakhon_ratchasima/map_layers.json`
- `src/data/canonical/nakhon_ratchasima/opsmoac_monthly_reports.json`
- `src/data/canonical/nakhon_ratchasima/rainfall_source_audit.json`
- `src/data/canonical/nakhon_ratchasima/rainfall_stations.json`
- `src/data/canonical/nakhon_ratchasima/rainfall_observations_24h.json`
- `src/data/canonical/nakhon_ratchasima/rainfall_monthly_history.json`
- `src/data/canonical/nakhon_ratchasima/source_matrix.json`
- `src/data/canonical/nakhon_ratchasima/subdistrict_rainfall_coverage.json`
- `src/data/canonical/nakhon_ratchasima/temporal_matrix.json`
- `src/data/canonical/nakhon_ratchasima/validation.json`

Typed imports and derived lists are in `src/data/catalog.ts`, except the full
drought forecast archive, which is loaded on demand by `src/data/forecastArchive.ts`.

## Database Collections / Tables / Documents

FACT: None exist.

PROPOSAL for a future backend:

- `riskEvents`
- `riskEventEvidence`
- `geographies`
- `fieldVerificationTasks`
- `fieldSubmissions`
- `advisories`
- `publicationBatches`
- `notificationReceipts`
- `farmerAlerts`
- `operatorAuditLog`
- `dataSourceIngestRuns`

Do not document any future collection as current until it exists in code and
deployment configuration.

## Canonical Models

See `src/types.ts`.

Key models:

- `ProvinceMonthRisk`
- `LocationNode`
- `RiskEvent`
- `EventEnrichment`
- `FieldTask`
- `Advisory`
- `UserPersona`
- `FarmerProfile`
- `CropProfile`
- `NationalMonthlyBackbone`
- `OutcomeMetric`
- `ModelRegistryRecord`
- `DataClass`
- `SourceRegistryRecord`
- `MapLayerRecord`
- `LayerAvailability`
- `RiskFusionBreakdown`
- `NakhonRatchasimaHierarchy`
- `NakhonRatchasimaDistrict`
- `NakhonRatchasimaSubdistrict`
- `NakhonRatchasimaDroughtForecastArchive`
- `NakhonRatchasimaEvidenceRecord`
- `NakhonRatchasimaMapLayer`
- `NakhonRatchasimaMatrixRow`
- `NakhonRatchasimaRainfallSourceAudit`
- `NakhonRatchasimaRainfallStation`
- `NakhonRatchasimaRainfallCoverageRecord`
- `NakhonRatchasimaRainfallObservations24h`
- `NakhonRatchasimaRainfallMonthlyHistory`
- `RuntimeState`
- `AppState`
- `DeliveryRecord`
- `FarmerAlert`

## Coverage Contract

Current facts:

- Provinces: 77.
- Months: 22.
- Month range: `2025-01` through `2026-10`.
- Province-month records: 1,694.
- Seeded deeper locations: 14.
- Nakhon Ratchasima canonical province: `TH-P29`.
- Nakhon Ratchasima admin province code: `30`.
- Nakhon Ratchasima local hierarchy: 32 districts and 289 subdistricts.
- Nakhon Ratchasima drought forecast archive rev02: 289 mapped Source_IDs,
  127 target months from `2015-06` through `2025-12`, 6 horizons per target
  month, and 220,218 canonical forecast vintages.
- Naming contract: "Nakhon Ratchasima" is the province. Local nicknames and
  district/local names must not be used as province-level synonyms.
- Nakhon Ratchasima seeded local subset: 8 districts and 11 subdistricts with
  richer evidence or source capability.
- Nakhon Ratchasima DWR EWS station/source coverage: 30 subdistricts in 13
  districts, derived from 49 station options and 130 station/covered-village
  rows captured from the public DWR EWS station-point page on `2026-08-27`.
- Nakhon Ratchasima OPSMOAC monthly report matrix: 22 canonical months aligned
  to `2025-01` through `2026-10`; 18 months have monthly report posts visible
  on the first index page, 12 of those months expose linked attachment paths,
  `2025-04` is related-warning-only in that first index, and `2026-08` through
  `2026-10` remain current/forecast targets rather than observed report rows.
- Nakhon Ratchasima subdistrict GeoJSON: 289 features.
- Nakhon Ratchasima rainfall station coverage: 49 REAL DWR EWS station points,
  29 direct-station subdistricts, 260 nearest-station coverage records, and 0
  `no_source_available` subdistricts in the current matrix.
- Nakhon Ratchasima current 24-hour rainfall observations fixture:
  `rainfall_observations_24h.json` remains the station-observation schema and is
  intentionally empty until a station-specific live ingest is implemented.
- Nakhon Ratchasima monthly rainfall history: current fixture has only
  national/regional context records, not subdistrict monthly totals.
- Risk events: 9.
- Field tasks: 2.
- Model registry records: 7.
- Source registry records: 9 audited source families.
- Map layer catalogue: 12 layer records with provenance/no-data metadata.

Tests in `tests/domain.test.ts` enforce province/month coverage, GeoJSON join
coverage, source/layer provenance, canonical workflow chain, and farmer-alert
gating.

## Nakhon Ratchasima Research Period

The nationwide canonical period remains `2025-01` through `2026-10` inclusive,
and `temporal_matrix.json` must still have one row per canonical month in the
same order. The Nakhon Ratchasima local research map bundle was intentionally
cleared on `2026-09-02` for a dataset refresh: live local map data currently
has no active research period and no subdistrict hazard rows.

Historical local map periods, including the formerly retained `2025-12` period,
are parked outside the live app in the rollback checkpoints noted in
`docs/rollback-parking-lot.md`. Do not restore or reintroduce those map periods
unless a new source-backed dataset refresh explicitly requires it.

Source coverage and observed impact are intentionally separate:

- DWR EWS station/source coverage can be shown as capability metadata across the
  canonical period, but a monthly hazard state requires a warning/readings record
  for that specific month.
- DOAE farmer-registration report capability can support crop exposure research
  by production year, province, district, subdistrict, and crop filters, but no
  crop-area values are current until a period-specific query is captured and
  normalized.
- OPSMOAC Nakhon Ratchasima monthly situation posts can support monthly disaster
  report research, but the index alone cannot assign affected districts,
  subdistricts, crops, or rai.
- `opsmoac_monthly_reports.json` is a prediction-readiness/source-validation
  input. It must not be rendered as a district/subdistrict risk score until
  individual reports are parsed, geocoded, and normalized against canonical
  admin codes and crop/exposure fields.

For local maps, missing local evidence remains `no-data`, never low risk or
normal. A source pathway may reduce “unknown source coverage” without reducing
“unknown local hazard/impact.”

## Nakhon Ratchasima Drought Forecast Archive

FACT: `drought_forecast_archive_rev02.json` is the source-backed T+1 through
T+6 drought forecast archive built from
`Drought_T1-6_rev02_Normalized_ArchiveReady(1).xlsx`. It is the current public
drought prediction source used by the province, district, and subdistrict
workspace surfaces.

Loading contract:

- Keep the canonical archive unchanged. `?url` emits a content-hashed JSON asset
  whose bytes are checked against the canonical file by `npm run check:bundle`.
- Login and province overview do not fetch the full archive. The overview map
  fetches `src/data/generated/forecast-overview-t1.json`, the T+1-only projection
  of all 127 target months, as a separate content-hashed asset. Counts and map
  statuses use the same forecast helpers as the full archive. The tiny
  `forecast-archive-summary.json` remains available for entry summaries. Both
  are regenerated by `npm run generate:forecast-summary` before dev/build;
  do not edit them manually.
- Drought, district, and subdistrict pages fetch the archive on demand and share
  an in-memory result for the current document. A reload starts a new loader;
  the content-hashed asset can use the existing immutable HTTP cache policy.
- Pending, failed, and timed-out loads must not render forecast counts or map
  risk states. Retry preserves the requested target month and T+ horizon.
- Failed requests are not cached; leaving a loading view cannot update the
  departed view. The shared request can finish for subsequent navigation.

Source and mapping contract:

- Source sheet: `Forecast_Archive_Long`.
- Location sheet: `Location_Master`.
- Original workbook lineage: `Drought_T1-6_rev02.xlsx`.
- Workbook source rows: 58,312.
- Deduplicated source rows: 36,703.
- Exact duplicate source rows removed: 21,609.
- Mapped source IDs: 289 of 289.
- Mapped canonical subdistricts: 289 of 289.
- Forecast vintage identity: `subdistrictCode + targetMonth + horizon`.
- `Source_YearMonth` is interpreted as `targetMonth`.
- `issueMonth = targetMonth - horizon`.
- Equal numeric values across T+ horizons remain separate forecast vintages.

Risk value contract:

- `0` means no forecast risk.
- `1` means moderate forecast risk.
- `2` means high forecast risk.
- Blank workbook cells are represented as `null` and mean out of scope for the
  archive, not no risk and not missing evidence.
- Missing records after a join failure are a separate `PENDING_SOURCE` problem
  and must not be collapsed into blank/out-of-scope or green/no-risk.

UI contract:

- Drought archive modules use the selected target month plus a single T+
  selector.
- Province, district, and subdistrict drought maps use the same archive fixture
  and the same map status semantics.
- Archive map legends show no-risk, moderate risk, high risk, and out-of-scope
  states. Out-of-scope areas use a muted hatched treatment.
- Tooltip/detail copy must identify target month, issue month, T+ horizon,
  numeric risk value, and semantic label.
- Archive forecasts are not official damage figures and are not observed
  historical drought impacts.
- The overview starts at the latest available target month and fixes T+1.
  Changing district scope updates map focus, counts and high-risk links.
  Counts use canonical subdistrict codes, with null/out-of-scope and missing
  records kept separate. Agricultural rai and confidence remain supplemental
  data with their own reference month, not outputs from the forecast archive.

Latest validated target month in the archive:

- Target month `2025-12` (`ธ.ค. 2568`) is archive forecast data, not the old
  cleared historical map panel.
- T+1 for `2025-12` has 142 in-scope subdistricts, 147 out-of-scope
  subdistricts, 0 no-risk, 129 moderate-risk, and 13 high-risk subdistricts.
- Ban Kao (`300806`) remains a useful validation example: target month
  `2025-12` has forecast risks `[1, 1, 1, 2, 2, 2]` across T+1 through T+6,
  with issue months `2025-11` through `2025-06`.

## Nakhon Ratchasima Rainfall Contract

FACT: Rainfall is currently represented as station/source coverage for all 289
subdistricts plus empty current-observation schemas. It is not yet a live
rainfall feed and has no bundled province water-provider snapshot.

Source files:

- `rainfall_source_audit.json`: source URLs, access method, fields, timestamp
  semantics, usage notes, and known limitations for DWR EWS and TMD context.
- `rainfall_stations.json`: 49 DWR EWS station points with REAL provenance.
- `subdistrict_rainfall_coverage.json`: one coverage record for every
  subdistrict code.
- `rainfall_observations_24h.json`: current-observation schema with zero
  imported observations.
- `rainfall_monthly_history.json`: national/regional TMD context records only.

Rules:

- Direct station: `coverageStatus === "direct_station"` means at least one DWR
  station point is inside or directly assigned to that subdistrict.
- Nearest station: `coverageStatus === "nearest_station_proxy"` means the
  selected station is representative context, not a direct local measurement.
- Nearest-station records must include station ID, distance, confidence, source
  timestamp, and `notLocalReading: true`.
- No source: `coverageStatus === "no_source_available"` is allowed by schema and
  must render as no-data, never as low risk.
- Unit for rainfall values is `mm`; accumulation window must be explicit, such
  as `24h`.
- Timezone for source timestamps is `Asia/Bangkok` unless a source response says
  otherwise.
- Station-specific live rainfall values for `rainfall_observations_24h.json`
  remain absent until a live ingest is implemented. Do not hard-code `0 mm` or
  use synthetic values as a fallback.

See [RAINFALL_SOURCE_AUDIT.md](RAINFALL_SOURCE_AUDIT.md) before adding any live
rainfall ingest, rainfall chart, or rainfall-driven risk score.

## Data Class Contract

Current values:

- `REAL`: real source context or source-family metadata.
- `DERIVED`: computed/risk-fusion output from multiple inputs.
- `CANONICAL_SYNTHETIC`: seeded prototype fixture values.
- `RUNTIME_STATE`: local browser state created by interactions.

Rules:

- Derived agricultural risk must not be labelled as an official source score.
- Synthetic local/province values must remain visibly marked as prototype/demo
  data.
- Source acronyms such as TMD, GISTDA, RID, DWR, OAE, LDD, DOAE, and DDPM may
  remain in English when they are official or operational acronyms.

## Map Layer Contract

The canonical map layer catalogue lives in
`src/data/canonical/map_layer_catalog.json`.

Layer groups:

- `risk`
- `agriculture`
- `hydrology`
- `weather`
- `planning`
- `operations`

Every layer must define:

- source IDs linked to `source_registry.json`
- data class
- Thai label and Thai description
- geography and time granularity
- access mode
- limitation
- no-data meaning
- source-unavailable meaning
- unsupported-layer meaning

Availability semantics:

- `available`: selected state has data that can be shown.
- `low-risk`: selected state has an explicit available low-risk/normal record.
- `no-data`: no seeded data exists for the selected area/filter.
- `source-unavailable`: the layer represents a source that is not currently
  available in the prototype.
- `unsupported`: selected filter combination does not match the layer's valid
  hazard/crop/time scope.

Never treat missing/null layer data as low risk.

## Severity Taxonomy

Current severity values:

- `Normal`
- `Watch`
- `Warning`
- `Severe`

Ordering is defined in `src/domain.ts` as:

```text
Normal < Watch < Warning < Severe
```

Public copy must pair severity with recommended action and uncertainty. Do not
present severity as a guaranteed prediction.

## Hazard Taxonomy

Current hazards in canonical data:

- Agricultural Water Stress
- Crop Stress
- Disease Risk
- Dry Spell / Rainfall Deficit
- Dry-season Irrigation Pressure
- Flash Flood
- Flood / Excess Rainfall
- Heat Stress
- Heavy Rainfall
- Multi-Hazard Seasonal Transition
- River Flood / Waterlogging
- Seasonal Transition
- Storm / Strong Wind

Thai labels live in `src/i18n.ts`.

## Geographic Area Model

`LocationNode` supports:

- `country`
- `province`
- `district`
- `subdistrict`
- `village`
- `farm`

Province IDs use values such as `TH-P17`. The main farmer demo farm is
`FARM-001`.

Map join rules:

- ADM1 GeoJSON is `public/geodata/thailand-adm1.geojson`.
- Regional-country context is
  `public/geodata/thailand-neighbor-context.geojson` and is rendered as a
  non-interactive orientation underlay, not as a risk layer.
- Nakhon Ratchasima subdistrict geometry is
  `public/geodata/nakhon-ratchasima-subdistricts.geojson`.
- The visible Nakhon Ratchasima local province outline is
  `public/geodata/nakhon-ratchasima-boundary.geojson`, generated from the same
  289 subdistrict geometries with `npm run generate:nr-boundary`.
- `normalizeName` in `src/domain.ts` removes `Province`, whitespace, casing, and
  non-alpha characters for joins.
- Tests require all 77 canonical provinces to join to GeoJSON.
- For Nakhon Ratchasima local data, join business/evidence records by
  `provinceCode`, `districtCode`, and `subdistrictCode` only. Do not join by
  Thai name, English name, or route slug.
- `TH-P29` must remain the only Nakhon Ratchasima province object. Local
  districts and subdistricts are child locations.
- Do not collapse the province into a local nickname in UI, docs, fixtures, or
  prompts. Province-level labels must remain explicit.

Do not fabricate local drill-down data for unseeded provinces.
Do not fabricate local values for unseeded Nakhon Ratchasima subdistricts.
No-data means insufficient evidence, not normal/green/low-risk.

## Local Storage / Session / Cache Keys

Current keys:

- `korat-tan-phai-demo-state-v1`
- `korat-tan-phai-login-user`: retired and removed during auth initialization;
  never used as a session. Supabase SDK owns its separate auth-token storage.

Stored shape:

- `AppState`, including language, persona, section, filters, selected IDs,
  explicit map selection (`mapSelectedProvinceId`), map layer, and
  `RuntimeState`. The map selection starts as `null`; the initial province
  context must not appear as a user-selected map province.
- Transient toast messages are not persisted. Older snapshots containing a toast
  are accepted, but that toast is not restored.

Migration rule:

- Bump the storage key when persisted runtime state becomes incompatible.
- Keep `createInitialState()` deterministic.
- Reset Demo Data should remain safe and should not clear unrelated localStorage
  keys.

## API Payloads

FACT: There are no network API payloads except fetching the static GeoJSON file.

Static fetch:

- `GET /api/risk-fusion?eventId=:id`
- `GET /geodata/thailand-adm1.geojson`
- `GET /geodata/thailand-neighbor-context.geojson`
- `GET /geodata/nakhon-ratchasima-subdistricts.geojson`
- `GET /geodata/nakhon-ratchasima-boundary.geojson`

`GET /api/risk-fusion` returns `RiskFusionBreakdown` for the selected event in
production. It is read-only, has no credentials, and must not be treated as real
authorization.

PROPOSAL: Future APIs must include explicit source timestamps, timezone,
provenance, confidence, and audit IDs.

## Source-Of-Truth Precedence

1. Current user instruction.
2. Current code and tests.
3. Canonical JSON in `src/data/canonical/`.
4. Current docs.
5. Older attached specs or chat history.

Data provenance precedence:

- Real official context must remain distinct from synthetic prototype layers.
- Derived data must be reproducible from canonical input.
- Runtime state is local demo state only.

## Fallback / Cache Rules

Current code:

- If a province-month record is missing, UI falls back to empty/not-seeded states.
- If event enrichment is missing, `getEventEnrichment` falls back to the main
  event enrichment.
- Persisted state is validated before use. Malformed JSON falls back to initial
  state; invalid nested fields fall back individually while valid edits survive.
  A visible notice reports recovery. Initial mount does not rewrite the stored
  snapshot; subsequent user edits save recovered state without transient toasts.
- Unavailable or full browser storage uses document-lifetime memory and displays
  a warning. It is not durable storage: reload may lose changes and require login.
  Neither error-boundary retry nor ordinary navigation clears persisted data.

needs audit:

- Add explicit error UI for failed GeoJSON fetch.
- Add live-data stale/fallback banners before production operations.

## Migration / Compatibility Rules

- Do not change record IDs unless all references and tests are updated.
- Keep the main demo chain stable unless the product owner approves a new
  canonical chain.
- Keep old localStorage keys isolated when bumping demo state versions.
- Add tests before changing geography normalization or severity taxonomy.

## What Must Never Be Hard-Coded If A Database/CMS Exists

If live backend/CMS is added, do not hard-code:

- Active alert content.
- Data freshness timestamp.
- Severity/confidence values.
- Delivery counts or acknowledgement counts.
- Operator identity or approval state.
- Notification channel configuration.
- Official source URLs.
- Jurisdiction permissions.
- Public-safety disclaimers.
