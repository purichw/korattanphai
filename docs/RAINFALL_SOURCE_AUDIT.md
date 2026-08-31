# เกษตรทันภัย Rainfall Source Audit

## Current State

FACT: This repo now has an incremental rainfall research/data patch for Nakhon
Ratchasima only. It is additive to the existing nationwide architecture and does
not replace any risk-event, field-verification, advisory, publication, or farmer
alert workflow.

Current fixture files:

- `src/data/canonical/nakhon_ratchasima/rainfall_source_audit.json`
- `src/data/canonical/nakhon_ratchasima/rainfall_stations.json`
- `src/data/canonical/nakhon_ratchasima/rainfall_observations_24h.json`
- `src/data/canonical/nakhon_ratchasima/rainfall_monthly_history.json`
- `src/data/canonical/nakhon_ratchasima/subdistrict_rainfall_coverage.json`
- `src/data/canonical/nakhon_ratchasima/official_water_snapshot.json`

Current UI surface:

- `/`
- `/water`
- `/drought`
- `/{district-slug}`
- `/{district-slug}/{subdistrict-slug}`
- Legacy `/nakhon-ratchasima/...` aliases for old links.
- Layer selector option: `ปริมาณฝนและสถานี`

## Source Audit

FACT: The v1 source audit inspected these starting sources:

- ThaiWater Standard: `https://standard.thaiwater.net/`
- ThaiWater rainfall resource documentation: `https://standard.thaiwater.net/data-resource/ข้อมูลน้ำฝน-rainfall/`
- ThaiWater station resource documentation: `https://standard.thaiwater.net/data-resource/ข้อมูลสถานี-stationinfo/`
- TMD province weather reference page:
  `https://www.tmd.go.th/en/weather/province/kanchanaburi`
- DWR EWS Nakhon Ratchasima station page:
  `http://ews1.dwr.go.th/ews/province-stn-point?FilterProvince=%E0%B8%99%E0%B8%84%E0%B8%A3%E0%B8%A3%E0%B8%B2%E0%B8%8A%E0%B8%AA%E0%B8%B5%E0%B8%A1%E0%B8%B2`

Observed source facts:

- ThaiWater standard documentation defines rainfall/station resource families,
  including station IDs, timestamps, values, units, and quality fields. The
  production-access method still needs audit before live ingest.
- TMD province pages expose rainfall windows such as 15 minutes, 1 hour, and
  from 07:00, all in millimeters. This is used as field-semantics context, not
  as a bulk Nakhon Ratchasima province subdistrict dataset.
- DWR EWS public station page for Nakhon Ratchasima exposed 49 station options
  and 130 station/covered-village rows during the fixture capture. This is used
  as REAL station metadata and coverage evidence.

needs audit:

- ThaiWater production terms, authentication, rate limits, and endpoint query
  filters for Nakhon Ratchasima station/rainfall bulk import.
- DWR station-specific live reading URL parameters. A generic `select-data`
  page exposed rainfall fields but did not reliably select the requested Nakhon Ratchasima
  station through the tested URL parameters.
- TMD API/open-data terms before using TMD as a production station feed.

## Coverage Matrix

FACT: `subdistrict_rainfall_coverage.json` covers all 289 Nakhon Ratchasima
subdistricts by admin code.

Current counts:

- 32 districts.
- 289 subdistrict coverage records.
- 49 DWR EWS station points.
- 29 subdistricts have at least one direct station in the captured DWR station
  metadata.
- 260 subdistricts use the nearest station as representative context.
- 0 subdistricts are `no_source_available` in the current station-coverage
  matrix.

Join rules:

- Join by `provinceCode`, `districtCode`, and `subdistrictCode`.
- Do not join rainfall or station data by Thai names, English names, or route
  slugs.
- Preserve `TH-P29` as the only Nakhon Ratchasima province object.

## Proxy Policy

FACT: A nearest-station record is not a direct subdistrict rainfall
measurement.

Rules:

- Show nearest-station coverage as `สถานีใกล้สุด` or `ข้อมูลตัวแทน`.
- Always keep `distanceKm`, `confidence`, source timestamp, and station ID
  visible when using nearest-station coverage.
- Do not label nearest-station values as `สถานีในพื้นที่`.
- Do not convert no-data or proxy coverage into green/normal/low-risk states.
- Do not use rainfall station coverage as a DERIVED risk score until a
  documented risk-fusion rule is implemented and tested.
- Do not join ThaiWater rain readings to subdistrict coverage by Thai names.
  Use a station/admin-code crosswalk only.

Distance method:

- Haversine distance from the subdistrict geometry coordinate-average centroid
  to the DWR EWS station point.

## Current Rainfall Values

FACT: `official_water_snapshot.json` now contains a point-in-time ThaiWater
province/station snapshot, including 24-hour station rainfall summary values.
It is static fixture data and is not a live ingest.

FACT: The latest snapshot was refreshed from ThaiWater public provincial
dashboard endpoints on 2026-08-30 at 17:01 Asia/Bangkok. For water-situation
values in this page, ThaiWater values prevail over older static fixture values
when the two conflict.

FACT: No station-specific live 24-hour rainfall observation values are imported
into `rainfall_observations_24h.json`.

FACT: The ThaiWater public `rain24` endpoint returned 104 station readings for
province code `30`, but those station IDs did not overlap with the 49 DWR EWS
station IDs currently used by `subdistrict_rainfall_coverage.json`. Because the
rainfall response did not provide a confirmed subdistrict admin-code join in the
tested payload, those readings stay as province/station context in
`official_water_snapshot.json` and are not copied into subdistrict coverage.

`rainfall_observations_24h.json` intentionally contains:

- `unit`: `mm`
- `accumulationWindow`: `24h`
- `observationCount`: `0`
- `status`: `THAIWATER_SNAPSHOT_AVAILABLE_NO_CONFIRMED_SUBDISTRICT_CROSSWALK`

The UI may show ThaiWater snapshot values as province/station context. It must
not copy those values into every subdistrict, show `0 mm`, `ปกติ`, `ฝนน้อย`, or
any synthetic station reading as a fallback.

## Historical And Monthly Context

FACT: The patch preserves seven REAL DWR historical rainfall-warning samples
from existing evidence records. These are examples for station context, not
current rainfall readings.

FACT: Monthly rainfall history currently has only national/regional TMD context
records. There are no subdistrict monthly rainfall totals in the current
fixtures.

FACT: A Jan 2025 onward historical import was attempted against the public
Nakhon Ratchasima ThaiWater dashboard endpoints on 2026-08-30. The tested public
provincial endpoints did not provide a confirmed historical range:

- `rain24_graph` accepted `start_date` and `end_date` but still returned the
  same latest seven-day station series.
- `rain1d` and `rainfall_month` accepted date parameters but still returned the
  latest provincial maximum.
- ThaiWater Standard-style `/Rainfall` and `/StationInfo` paths were documented
  in the public standard, but were not exposed at the tested public
  `thaiwater30` API base and returned `404 Request to an unknown service`.

Therefore this patch does not add Jan 2025+ historical rainfall records as REAL
data. The next implementation step is to use the agency-provided ThaiWater
Standard API base/auth/export for `/Rainfall` with `latest=false`,
`startDatetime`, `endDatetime`, and an explicit interval such as `P-Daily` or
`P-Monthly`.

## UI Requirements

- The Nakhon Ratchasima layer selector must include `ปริมาณฝนและสถานี`.
- Province view should summarize direct-station coverage, nearest-station
  coverage, station count, and live-observation status.
- District view should summarize coverage for its child subdistricts.
- Subdistrict view should show direct station or nearest station, distance,
  confidence, station timestamp, and the no-direct-reading warning.
- Mobile must avoid horizontal overflow, clipped station IDs, and ambiguous
  color-only meaning.

## Verification

Required checks before commit/push/deploy:

```bash
npm run build
npm test
npm run test:e2e
```

Regression expectations:

- 77 provinces, 22 months, and 1,694 province-month records remain intact.
- Nakhon Ratchasima remains `TH-P29`.
- 32 districts and 289 subdistricts remain navigable.
- Rainfall coverage has 289 records with status `direct_station`,
  `nearest_station_proxy`, or `no_source_available`.
- Nearest-station records have station ID, distance, confidence, source
  timestamp, and explicit `notLocalReading: true`.
- Farmer alert remains gated behind publication.

## Future Work

PROPOSAL:

1. Confirm ThaiWater and DWR production access rules.
2. Build a small ingest script that captures station readings with timestamp,
   unit, quality flag, and accumulation window.
3. Add an immutable import manifest for every rainfall capture.
4. Add a rainfall trend chart only after monthly totals are source-backed.
5. Add risk-fusion tests before rainfall affects severity or advisory copy.
