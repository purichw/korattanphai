# Korat Tan Phai / โคราชทันภัย Handoff

## Current State

FACT: The repo contains the Nakhon Ratchasima-only subset of the frontend-only
public flood, drought, and water-risk alert prototype. The site brand is Korat
Tan Phai / โคราชทันภัย.

- Repo: `/Users/point/korattanphai`
- Production: `https://korattanphai.vercel.app`
- Branch: `main`
- Source snapshot: copied from Kaset Tan Phai commit
  `0f16794bb57d5dec93b7c6312de7d9362bb97013`.

The app is Thai-only for visible product UI, responsive, and stores runtime demo
state in `localStorage`.

## Recent Changes

Recent completed work before this docs pass:

- Thai localization expanded across the app.
- Google Sans font stack added.
- Risk-event and crop text overflow fixed on desktop and mobile.
- Playwright smoke updated for Thai-first workflow.
- Production deploy completed and smoked.

Current incremental source/layer pass:

- Added source registry and map layer catalogue fixtures.
- Added data class, layer availability, and derived-risk fusion semantics.
- Replaced the visible EN language surface with Thai-only UI copy.
- Added layer selector/provenance/no-data handling to the map.
- Updated risk-event, crop, map, and data/model surfaces for clearer
  source-vs-derived wording.
- README, PROJECT_MAP, and dedicated docs updated for the new contract.

Current Nakhon Ratchasima research/data patch:

- Added `src/data/canonical/nakhon_ratchasima/` fixtures from the deep research
  bundle as additive local data.
- Added `public/geodata/nakhon-ratchasima-subdistricts.geojson` with 289
  subdistrict features for province code `30`.
- Preserved Nakhon Ratchasima as the existing canonical province `TH-P29`; no
  second province object was created.
- Naming correction: province-level UI/docs must say Nakhon Ratchasima
  province. Do not use local nicknames or district/local names as synonyms for
  the province.
- Added root-level Nakhon Ratchasima client routes: `/`, `/water`, `/drought`,
  `/{district-slug}`, and `/{district-slug}/{subdistrict-slug}`. Legacy
  `/nakhon-ratchasima/...` aliases remain accepted for old links.
- Added `NakhonRatchasimaWorkspace` for province, district, and subdistrict
  drill-down with source freshness, inherited context, local evidence, map layer
  selection, and explicit no-data states.
- Added regression coverage for 32 districts, 289 subdistricts, admin-code
  joins, GISTDA GeoJSON coverage, forecast/no-data semantics, Soeng Sang
  investigation limits, and route drill-down.

Current Nakhon Ratchasima rainfall patch:

- Added rainfall source audit and fixtures:
  `rainfall_source_audit.json`, `rainfall_stations.json`,
  `rainfall_observations_24h.json`, `rainfall_monthly_history.json`, and
  `subdistrict_rainfall_coverage.json`.
- Added `official_water_snapshot.json`, a point-in-time REAL ThaiWater province
  snapshot for rainfall, water level, reservoir, temperature, warning/storm, and
  forecast context. It is static fixture data, not a live browser API call.
- Added 49 REAL DWR EWS station points and a 289-subdistrict coverage matrix:
  29 direct-station subdistricts, 260 nearest-station representative records,
  and 0 no-source records in the current matrix.
- Added `ปริมาณฝนและสถานี` to the Nakhon Ratchasima layer catalogue and local
  workspace panels.
- Kept `rainfall_observations_24h.json` empty by design. The ThaiWater snapshot
  can show province/station rainfall context, but it must not be copied into
  every subdistrict or silently converted into agricultural risk.
- Preserved seven historical DWR rainfall-warning samples as context only; they
  are not current rainfall readings.
- Updated docs and tests to lock the proxy/no-data contract.

Current province workspace/navigation patch:

- National map detail actions now open canonical province workspace routes.
- `/nakhon-ratchasima` remains the seeded Nakhon Ratchasima province workspace;
  its district/subdistrict child routes are still owned by
  `NakhonRatchasimaWorkspace`.
- Other canonical provinces open `/{province-slug}` placeholder dashboards via
  `ProvinceWorkspacePlaceholder`.
- Placeholder dashboards include situation, water, rainfall, agriculture, and
  data-readiness containers, but they must not display missing local evidence as
  normal risk, zero rainfall, or a completed data-readiness feature.

## Open Risks

- The app is not operationally safe for real emergency alerting yet.
- No real auth, backend, database, notification provider, or live data ingestion
  exists.
- Vite build has a chunk-size warning due bundled canonical JSON.
- Map fetch has a loading state but no explicit error state.
- No real delivery guarantee or acknowledgement receipt exists.
- SEO/noindex decision is not confirmed.
- Official data source licensing and attribution need audit before live data use.
- ThaiWater/DWR station-specific live rainfall access still needs audit before
  importing current 24-hour rainfall readings.

## Known Bugs / Limitations

- Browser localStorage can contain stale demo state until Reset Demo Data or the
  current key (`korat-tan-phai-demo-state-v1`) changes again.
- Editing Thai-localized advisory textarea values may store Thai text in runtime
  even though canonical fixture actions are English strings.
- Production copy still includes necessary codes/acronyms such as TMD, GISTDA,
  ARE, ADV, FARM, SMS, LINE.
- This repo has no markdown lint command.

## Commands Run Recently

Known release commands from the latest production push/deploy:

```bash
git diff --check
npm run build
npm test
npm run test:e2e
git commit -m "Polish Thai responsive prototype UI"
git push origin main
vercel --prod --yes
```

Docs pass expected checks:

```bash
git status --short
git diff --check
npm run build
npm test
npm run test:e2e
```

Latest local verification for the source/layer Thai-only patch:

```bash
git diff --check
npm run build
npm test
npx playwright test
```

Latest local verification for the Nakhon Ratchasima patch:

```bash
npm run build
npm test
npm run test:e2e
```

Result: build passed, 17 unit/data tests passed, and 10 Playwright e2e tests
passed across desktop and mobile.

Latest local verification for the Nakhon Ratchasima rainfall patch:

```bash
npm test
```

Result: 20 unit/data tests passed.

Notes:

- `npm run test:e2e` initially failed inside the sandbox because Playwright could
  not bind the local Vite port (`listen EPERM 127.0.0.1:5173`), then
  `npx playwright test` passed when allowed to run local browser automation.
- Snapshot evidence was captured outside git under
  `/private/tmp/korattanphai-snapshots/`.
- Checked desktop 1440px and mobile 390px for Risk events, Crops, Map, and
  Data/Models; no horizontal document overflow was reported.

## Recommended Next Steps

1. Confirm whether the production prototype should be indexed or noindex.
2. Add a map fetch error state.
3. Add production smoke script for repeatable post-deploy checks.
4. Consider lazy-loading large canonical JSON.
5. Decide future backend boundaries before adding live alerts or real users.
6. Human-review public-safety copy before any operational launch.
7. Human-confirm whether GISTDA local geometry attribution/licensing wording is
   sufficient before operational/public-safety use.

## How Another Agent Should Continue Safely

- Start with `README.md`, then `PROJECT_MAP.md` when starting a fresh Codex
  task.
- Read the focused doc for the surface being changed.
- Check `git status --short` before editing.
- Do not use chat history as the source of truth when docs and code are present.
- Do not collapse Nakhon Ratchasima province into a local nickname in UI, docs,
  fixtures, prompts, or implementation notes.
- Do not commit, push, deploy, migrate, or touch production data unless the
  current user explicitly asks for it.
- Use `$release-gate` before any release action.
- Use `$snapshot` for visible UI changes.
