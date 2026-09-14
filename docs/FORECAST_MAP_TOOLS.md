# Nakhon Ratchasima Forecast Map Tools

Released on 2026-09-14 at https://korattanphai.vercel.app. These
features use the existing rev03/Supabase data and the 289 local administrative
polygons only. They do not add ThaiWater, crop damage, observed drought,
irrigation infrastructure, nationwide GIS layers or new forecast records.

## Release Evidence

- Production runtime: `e72fc201ce03151b56bbeae16b6b34a09afcc4d0`, deployment
  `dpl_7hxc83Ya1pNNRsM2th89F4msMixq`. The deployment was built from a clean
  Git archive, checked before promotion, then verified at the primary URL.
- [Quality Gate](https://github.com/purichw/korattanphai/actions/runs/34775293679)
  passed all jobs on `01d8f813f6b9f8ffa77630efd5c8005e8824c9d2`. Only two E2E
  test files differ from the deployed runtime; no runtime/build/data difference.
- Authenticated candidate and primary smoke each passed 32 existing checks
  plus 14 map/loading checks on desktop and mobile. Evidence is gitignored at
  `artifacts/forecast-map-tools/release/{verified-candidate,production}/`:
  `report.json`, `map-loading-report.json`, screenshots and downloaded exports.
- Primary Excel verification matched 1,734 forecast values across 289 tambons
  and 32 district summaries; mobile district export matched all 36 values.
  Live Supabase projections, categorical map colors and null semantics matched
  canonical rev03. There were no production database writes or migrations.
- Includes the authorized cold-entry loading work from the task
  "โคราชทันภัย BE". Startup contains no account/forecast values; protected
  application and analysis dependencies remain deferred.
- `AppSelect` is the sole product combobox/listbox implementation. Source
  regression checks reject native select/datalist or duplicate listboxes.
  Desktop floating menus and mobile custom sheets share selection, keyboard,
  nested Escape and focus-restoration behavior. Tool dialogs work in fullscreen
  and lock background scrolling.
- Physical iOS/Android devices were not tested. Browser automation covers
  desktop/mobile Chromium gestures plus the existing WebKit/Firefox suite.
  PDF output remains rasterized, not searchable text/vector GIS.

## User Flows

1. Map search accepts district/tambon names and administrative codes within the
   current route. Select a result to focus the existing map. A filter-excluded
   result is reported explicitly instead of changing the filters implicitly.
2. Coordinate lookup accepts latitude/longitude in WGS84 decimal degrees. Turf's
   point-in-polygon implementation respects holes and rejects ambiguous matches.
   Outside-province and outside-route coordinates return different errors. The
   marker and readout describe the containing tambon's forecast, never a point
   or farm assessment. Markers are transient and can be cleared.
3. Map export produces a dynamically paginated portrait A4 report as PNG or PDF. By default
   it fits the entire route scope with export-specific collision-aware labels;
   users can alternatively choose the current zoomed camera. It does not change
   the live map's camera. The header names the area and separates origin, target
   and horizon. The map uses the displayed layer's colors, legend and filters;
   notes and workbook/sheet, version, full source hash and timestamp appear at
   the bottom. Measured text uses Thai word segmentation and grapheme-safe
   wrapping for long identifiers. Headings stay with their first lines, maps
   stay with their legends, and headers/page numbers repeat on continuation pages.
   Long content creates additional pages; it is never truncated to force one page.
   Multi-page PNG output is a ZIP of separate page images. No account details are
   exported. PDF is rasterized, not searchable text or GIS/vector.
4. Analysis opens a shared six-horizon table. Province/district routes default
   to district summaries; tambon routes contain that tambon only and do not show
   a district-population chart. Each district cell includes known/total counts.
   Users can search, filter by district and forecast pattern, choose row level,
   and sort by administrative code, name or the selected horizon's risk.
5. District bars show moderate/high counts and valid/total coverage. Percentages
   use valid forecasts within the analysis filters, not land area or all
   administrative tambons. District routes remain district-scoped; province
   routes enable actual cross-district comparison. No valid values means no
   percentage, not 0%.
6. Round comparison accepts only other available origins whose six-month windows
   include the active target calendar month. It compares the same tambon code
   and target, even when the horizon number differs. Missing/out-of-scope pairs
   remain not comparable. The map action uses a separate change legend.
7. Risk patterns are any high forecast within six months, three consecutive
   moderate/high slots, or a confirmed first-risk horizon. Gaps break runs;
   unknown earlier slots prevent claiming when risk first began. These describe
   a single forecast vintage, not observed multi-month drought.
8. Play walks forward through six horizons of the selected origin, stops at the
   last frame, and updates the page's existing selection. Pause, opening tools,
   changing scope/origin or hiding the document stops it. Home keeps its T+1
   contract and has no Play control.

## Data And State Boundaries

- Tables reuse `buildForecastExport`, `summarizeExportRisks` and
  `buildForecastComparison`, including their source/scope validation. District
  severity is the maximum known risk. Five zeros plus one moderate is moderate.
- Analysis reads only the selected area/origin, six horizons. Home still reads
  one horizon on initial load; full data is requested only on opening analysis.
- Database reads always use `createSupabaseForecastLoader`. Its revision check
  applies even on a cache hit. Dialog-owned cancellation never aborts the main
  page's loader. On a failed check, analysis output is withheld with Retry.
- An open analysis checks again on focus/visibility and every 60 seconds. It
  cannot apply a newer dataset to a map still showing an older revision. The
  existing page loader independently adopts new publication revisions.
- An explicit map filter/comparison action changes only the map display, with
  a labeled clear action. Page KPI denominators and the existing page-wide
  irrigation filter are not secretly changed. The old map-only risk filter is
  reset so the analysis result is not accidentally intersected with it.
- Changing origin, horizon, data revision or irrigation/color mode invalidates
  temporary analysis overlays. Saved workspaces and Excel export are unchanged.
- No writes to Supabase, canonical archives, normalized workbooks or geometry.

## Verification

- `tests/forecastAnalysis.test.ts`: all 32 district/horizon aggregates against
  normalized slots, source-aligned comparisons for 289 tambons, null/missing
  semantics, pattern gaps, search scope, polygon holes and boundary ambiguity.
- `e2e/forecast-map-tools.spec.ts`: isolated Supabase fixtures on desktop/mobile;
  four route levels, lazy loading, filters/map colors, same-target comparison,
  coordinates, playback, downloadable PNG/PDF, failures and new publications.
  Shared interaction journeys exercise page scrolling, mouse zoom/drag, real
  Chromium touch long-press/pan/pinch, month-menu scrolling without camera
  movement, modal background scroll lock/focus restoration, and analysis inside
  fullscreen. Closing tools/fullscreen retains the route and map instance; Reset
  returns the same fitted camera. These are automated browser gestures, not a
  claim of physical iOS/Android device coverage.
- Map/tool frames reserve filter/status space while preserving a minimum plot
  height; wide tambon plots reserve proportionate height. Adjacent desktop charts
  share the map's stable frame height. Tool dialogs lock background scrolling and restore focus
  without scrolling the document.
  The filter-status slot reserves one line in wide cards and two in narrow
  cards, so selecting irrigation (including no matches) does not resize the map.
  Narrow legends reserve space for either layer. The province/district desktop
  map spans the compact chart and KPI rows; empty results preserve its last
  populated height at the same width. Resizing invalidates that measurement.
- Existing model/export/map-interaction regression tests remain applicable.
- PNG/PDF export is tested with production's `img-src 'self' data:` policy;
  rendering uses a self-contained data image without broadening CSP.
- `check-bundle-budget.mjs` keeps the existing login/raw application ceilings;
  shared searchable filters and compact forecast composition use a 375 kB core
  gzip ceiling (production baseline 372 kB; measured about 371 kB on Node 24). It
  separately bounds the lazy analysis, Turf and report dependencies at 1.85 MB
  raw / 480 kB gzip. Static imports into those tools fail the gate. The database
  browser runner includes these cases and prebundles optional writers for tests.
  CI also exercises optional telemetry: its deferred SDK has a separate 20 kB
  raw / 6 kB gzip cap and cannot be statically imported. Application telemetry
  wiring still counts against core. This does not enable telemetry in production.
  Compare gzip budgets on Node 24, matching CI/Vercel; other Node/zlib versions
  can report different compressed sizes for identical emitted JavaScript.
- `tests/reportLayout.test.ts` covers Thai text, long identifiers, keep-with-next,
  flexible figure heights and lossless pagination. Browser stress tests exercise
  actual font metrics and multi-page PDF/PNG ZIP output with long metadata.

Library references: [Turf point containment](https://turfjs.org/docs/api/booleanPointInPolygon)
and [jsPDF](https://github.com/parallax/jsPDF). Neither is a data source.
