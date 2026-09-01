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
- `src/data/canonical/nakhon_ratchasima/dwr_ews_station_coverage.json`
- `src/data/canonical/nakhon_ratchasima/evidence_records.json`
- `src/data/canonical/nakhon_ratchasima/local_subset.json`
- `src/data/canonical/nakhon_ratchasima/map_layers.json`
- `src/data/canonical/nakhon_ratchasima/official_water_snapshot.json`
- `src/data/canonical/nakhon_ratchasima/opsmoac_monthly_reports.json`
- `src/data/canonical/nakhon_ratchasima/rainfall_source_audit.json`
- `src/data/canonical/nakhon_ratchasima/rainfall_stations.json`
- `src/data/canonical/nakhon_ratchasima/rainfall_observations_24h.json`
- `src/data/canonical/nakhon_ratchasima/rainfall_monthly_history.json`
- `src/data/canonical/nakhon_ratchasima/source_matrix.json`
- `src/data/canonical/nakhon_ratchasima/subdistrict_rainfall_coverage.json`
- `src/data/canonical/nakhon_ratchasima/temporal_matrix.json`
- `src/data/canonical/nakhon_ratchasima/validation.json`

Typed imports and derived lists are in `src/data/catalog.ts`.

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
- Nakhon Ratchasima official water snapshot: point-in-time REAL ThaiWater
  province dashboard data for rainfall, water level, reservoir, temperature,
  public-warning, storm, and forecast context. It is bundled as static fixture
  data and is not a live browser API call.
- Nakhon Ratchasima current 24-hour rainfall observations fixture:
  `rainfall_observations_24h.json` remains the station-observation schema and is
  intentionally empty until a station-specific live ingest is implemented.
- Nakhon Ratchasima monthly rainfall history: current fixture has only
  national/regional context records, not subdistrict monthly totals.
- Risk events: 9.
- Field tasks: 2.
- Model registry records: 7.
- Source registry records: 10 audited source families.
- Map layer catalogue: 6 groups with provenance/no-data metadata.

Tests in `tests/domain.test.ts` enforce province/month coverage, GeoJSON join
coverage, source/layer provenance, canonical workflow chain, and farmer-alert
gating.

## Nakhon Ratchasima Research Period

The Nakhon Ratchasima local research bundle is aligned to the same canonical
period as `province_monthly_risk.json`: `2025-01` through `2026-10` inclusive.
`temporal_matrix.json` must have one row per canonical month in the same order.

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

## Nakhon Ratchasima Rainfall Contract

FACT: Rainfall is currently represented in two layers: station/source coverage
for all 289 subdistricts, plus a point-in-time ThaiWater province snapshot. It
is not yet a live rainfall feed.

Source files:

- `rainfall_source_audit.json`: source URLs, access method, fields, timestamp
  semantics, usage notes, and known limitations for ThaiWater, DWR EWS, and TMD.
- `rainfall_stations.json`: 49 DWR EWS station points with REAL provenance.
- `subdistrict_rainfall_coverage.json`: one coverage record for every
  subdistrict code.
- `rainfall_observations_24h.json`: current-observation schema with zero
  imported observations plus seven historical DWR rainfall-warning samples.
- `official_water_snapshot.json`: REAL ThaiWater province snapshot captured from
  public province endpoints; includes current 24-hour station rainfall summary,
  water-level station distribution, reservoir usable water, temperature,
  warning/storm status, and rain forecast context.
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
- ThaiWater snapshot values may be shown as province/station context only. They
  must not be copied into every subdistrict or converted into a DERIVED
  agricultural risk score without a documented fusion rule.
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
- Source acronyms such as TMD, GISTDA, RID, HII/ThaiWater, DWR, OAE, LDD, DOAE,
  and DDPM may remain in English when they are official or operational acronyms.

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

Current key:

- `korat-tan-phai-demo-state-v1`

Stored shape:

- `AppState`, including language, persona, section, filters, selected IDs,
  explicit map selection (`mapSelectedProvinceId`), map layer, toast, and
  `RuntimeState`. The map selection starts as `null`; the initial province
  context must not appear as a user-selected map province.

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
- If persisted localStorage is invalid, app resets to initial state.

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
