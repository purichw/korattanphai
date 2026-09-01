# Korat Tan Phai / โคราชทันภัย

Nakhon Ratchasima-only subset of the Kaset Tan Phai public flood, drought, and
agricultural water-risk alert prototype. The site brand is Korat Tan Phai /
โคราชทันภัย; the data scope is จังหวัดนครราชสีมา.

## Where To Start

1. Read [PROJECT_MAP.md](PROJECT_MAP.md) for the full repo map, current state,
   guardrails, and maintainer reading order.
2. Read [docs/APP_MAP.md](docs/APP_MAP.md) before changing routes, navigation,
   or user-facing surfaces.
3. Read [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md) before changing canonical
   JSON, runtime state, alert payloads, or map joins.
4. Read [docs/RELEASE_RUNBOOK.md](docs/RELEASE_RUNBOOK.md) before commit, push,
   deploy, or production smoke work.

## Main Surfaces

The app is a Thai-only single-page application. For this subset, the primary
sidebar starts with only the overview entry, and `/` opens the Nakhon Ratchasima
workspace directly.

- Province overview: `/`
- Drought tab: `/drought`
- District: `/{district-slug}`
- Subdistrict: `/{district-slug}/{subdistrict-slug}`
- Legacy aliases under `/nakhon-ratchasima/...` are still accepted for old links.

## Demo Login

Use username `pointy` or `somsak` to enter the local prototype. Matching is
case-insensitive. The login page does not list accepted usernames. Login is a
frontend-only demo gate stored in `localStorage`; it is not secure
authentication.

## Commands

```bash
npm install
npm run dev
npm run build
npm run build:protected
npm test
npm run test:e2e
```

The `dev`, `preview`, and `test:e2e*` scripts run through local-runtime guards.
When the Codex sandbox blocks localhost binding or Chromium launch, they fail
fast with the outside-sandbox commands to use instead of a raw Vite/Chromium
stack trace.

Codex/sandbox E2E workflow:

```bash
# terminal 1, run outside the Codex sandbox
npm run dev:e2e

# terminal 2, run outside the Codex sandbox
npm run test:e2e:attached
```

In the Codex sandbox, local port binding and Chromium launch both require an
outside-sandbox run. Playwright is configured to attach to the already-running
Vite server there instead of spawning it. Outside the sandbox, use
`npm run test:e2e:managed` for a one-command run that starts Vite automatically.

Production target: [https://korattanphai.vercel.app](https://korattanphai.vercel.app)

Do not commit, push, deploy, migrate, or touch production data unless the current
user task explicitly authorizes it.

## Canonical Docs

- [PROJECT_MAP.md](PROJECT_MAP.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/APP_MAP.md](docs/APP_MAP.md)
- [docs/INTERACTION_MAP.md](docs/INTERACTION_MAP.md)
- [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md)
- [docs/RAINFALL_SOURCE_AUDIT.md](docs/RAINFALL_SOURCE_AUDIT.md)
- [docs/NON_FUNCTIONAL_REQUIREMENTS.md](docs/NON_FUNCTIONAL_REQUIREMENTS.md)
- [docs/RELEASE_RUNBOOK.md](docs/RELEASE_RUNBOOK.md)
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- [docs/HANDOFF.md](docs/HANDOFF.md)
- [docs/ALERTING.md](docs/ALERTING.md)
- [docs/NOTIFICATION_CONTRACT.md](docs/NOTIFICATION_CONTRACT.md)
- [docs/OPERATIONS.md](docs/OPERATIONS.md)
- [docs/API.md](docs/API.md)
- [docs/ANALYTICS.md](docs/ANALYTICS.md)
- [docs/SEO.md](docs/SEO.md)

## Data Contract Snapshot

- Province-month coverage: 77 provinces x 22 months = 1,694 records.
- Demo period: January 2025 through October 2026.
- Main demo chain: `ARE-2026-0825-NE` -> `FV-0825-NE-01` ->
  `ADV-2026-824` -> `FARM-001`.
- Source registry and map-layer provenance live in
  `src/data/canonical/source_registry.json` and
  `src/data/canonical/map_layer_catalog.json`.
- Runtime workflow state is stored in browser `localStorage` under
  `korat-tan-phai-demo-state-v1`.
- The static Thailand ADM1 map file is
  `public/geodata/thailand-adm1.geojson`.
- The map also uses `public/geodata/thailand-neighbor-context.geojson` as a
  non-interactive regional-country orientation underlay from Natural Earth
  1:110m Admin 0 countries.
- Nakhon Ratchasima local drill-down data lives under
  `src/data/canonical/nakhon_ratchasima/` and preserves `TH-P29` as the existing
  province with admin province code `30`, 32 districts, and 289 subdistricts.
- Nakhon Ratchasima rainfall fixtures add 49 DWR EWS station points, 29
  direct-station subdistricts, and 260 nearest-station coverage records.
  `official_water_snapshot.json` adds a point-in-time REAL ThaiWater province
  snapshot for rainfall, water level, reservoir, temperature, warnings, and
  forecast context. It is not a live browser API call and must not be treated as
  an official subdistrict risk score.
- Nakhon Ratchasima local geometry is served from
  `public/geodata/nakhon-ratchasima-subdistricts.geojson`.
- The visible Nakhon Ratchasima local province outline is generated from that
  same subdistrict source and served from
  `public/geodata/nakhon-ratchasima-boundary.geojson`.
- Local Nakhon Ratchasima joins must use admin codes, not Thai names or route
  slugs. Missing local evidence must render as no-data/insufficient evidence,
  not low risk.

Province and local risk scores are synthetic prototype data unless explicitly
labelled as official context. Public-safety wording must keep uncertainty,
freshness, and recommended actions visible.
