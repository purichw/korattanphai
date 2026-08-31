# เกษตรทันภัย API Contract

## Current API State

FACT: The repo has one read-only Vercel API route.

Network activity:

- The browser fetches `/geodata/thailand-adm1.geojson`.
- The browser fetches `/geodata/thailand-neighbor-context.geojson`.
- The browser fetches `/geodata/nakhon-ratchasima-subdistricts.geojson` for the
  Nakhon Ratchasima local workspace.
- In production, the browser fetches `/api/risk-fusion?eventId=...` for the
  risk-fusion explanation shown in the risk detail panel.
- Google Fonts may be requested by the browser from the stylesheet in
  `index.html`.
- Nakhon Ratchasima water/rainfall data is bundled as static JSON imports from
  `src/data/canonical/nakhon_ratchasima/`; no live rainfall API is called by the
  browser. `official_water_snapshot.json` is a point-in-time ThaiWater province
  snapshot, not a client-side live integration.

There are no database clients, mutation endpoints, secrets, or environment
variables in the app code.

## Static Asset Contract

Rainfall fixtures:

- `rainfall_source_audit.json`: source audit for ThaiWater, DWR EWS, and TMD.
- `rainfall_stations.json`: 49 DWR EWS station points for Nakhon Ratchasima.
- `subdistrict_rainfall_coverage.json`: 289 subdistrict coverage records.
- `rainfall_observations_24h.json`: current-observation schema with zero
  imported observations.
- `official_water_snapshot.json`: ThaiWater province snapshot for rainfall,
  water level, reservoir, temperature, warning/storm, and forecast context.
- `rainfall_monthly_history.json`: national/regional context only.

These are not network endpoints. They are bundled at build time through
`src/data/catalog.ts`.

`GET /api/risk-fusion?eventId=:id`

Purpose:

- Returns the derived risk-fusion explanation for the selected event.
- Keeps the production browser bundle from calling this derivation directly.

Expected shape:

- `RiskFusionBreakdown` from `src/types.ts`.
- Unknown or omitted `eventId` falls back to the main demo event.

Constraints:

- Read-only.
- No credentials or secrets.
- `Cache-Control: private, no-store`.
- This is not real authorization and does not protect public data from being
  requested; it only moves this derivation out of direct client execution.

`GET /geodata/thailand-adm1.geojson`

Purpose:

- Provides Thailand ADM1 province boundaries for `RiskMap`.

Expected shape:

- GeoJSON `FeatureCollection`.
- 77 features.
- Each feature has `properties.shapeName` and `properties.shapeISO`.

Tests:

- `tests/domain.test.ts` checks 77 features and province-name joins.

`GET /geodata/thailand-neighbor-context.geojson`

Purpose:

- Provides low-emphasis regional country context for `RiskMap`.
- This is an orientation underlay only, not a risk layer.

Expected shape:

- GeoJSON `FeatureCollection`.
- Current fixture includes 11 Natural Earth Admin 0 country geometries around
  Thailand.
- Each feature has `properties.shapeName` and `properties.shapeISO`.

`GET /geodata/nakhon-ratchasima-subdistricts.geojson`

Purpose:

- Provides subdistrict boundaries for the Nakhon Ratchasima drill-down
  workspace.
- This is geometry/context only; it is not a risk score source.

Expected shape:

- GeoJSON `FeatureCollection`.
- 289 features for province code `30`.
- Each feature has `properties.Admin_code`, `P_code`, `A_code`, `T_code`,
  `P_Name_T`, `A_Name_T`, `T_Name_T`, and source metadata.

Tests:

- `tests/domain.test.ts` checks all 289 subdistrict codes match
  `src/data/canonical/nakhon_ratchasima/district_subdistrict_matrix.json`.

## Future API Principles

PROPOSAL:

- Use typed request/response schemas before adding endpoints.
- Include source timestamp and timezone in all risk/evidence responses.
- Include data provenance and confidence in alert responses.
- Keep public read endpoints separate from operator mutation endpoints.
- Make publish operations idempotent.
- Require server authorization for approval and publication.
- Add append-only audit entries for every mutation.

## Candidate Future Endpoints

These do not exist yet, except for the already-implemented
`GET /api/risk-fusion` read endpoint described above:

- `GET /api/risk-events`
- `GET /api/risk-events/:id`
- `GET /api/geographies/:id`
- `GET /api/advisories/:id`
- `POST /api/field-verifications`
- `POST /api/advisories/:id/submit-review`
- `POST /api/advisories/:id/approve`
- `POST /api/advisories/:id/request-changes`
- `POST /api/advisories/:id/publish`
- `GET /api/farmer-alerts`
- `POST /api/farmer-alerts/:id/acknowledge`

Do not cite these as current implementation.

## API Data Requirements For Public Safety

Future responses should include:

- Stable ID.
- Human-readable Thai title.
- Severity.
- Confidence.
- Geography.
- Valid period.
- Issued timestamp.
- Source data timestamp.
- Timezone.
- Source/provenance.
- Recommended action.
- Version or revision.
- Audit/publication status.

## Compatibility Rules

- Do not change IDs without migration.
- Keep alert/advisory revisions addressable.
- Treat publication as immutable after send; corrections should create a new
  version or correction record.
