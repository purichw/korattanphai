# Forecast Excel Export

## Entry and Scope

The shared `ForecastExcelExport` entry lives in the primary navigation, including
the mobile menu. It is available only inside `DatabaseWorkspaceProvider`.

- Filters: source/origin month T, province or district, irrigation status.
- Prefills the visible route. A tambon route defaults to its parent district so
  the district summary does not silently represent a single tambon.
- Always includes all risk states and T+1 through T+6. The map's selected horizon
  and risk filter do not truncate this multi-month report.
- Changing export filters does not navigate or change the map's filters.

## Data Contract

Opening the dialog loads the lightweight overview slice for available months.
Download uses `services.full.load({ areaCode, originPeriod })`: this checks the
latest Supabase revision on every attempt, including cache hits, and requests
only the selected scope and origin with six horizons. Offline/revision errors
block export instead of silently using stale data.

`forecastExportModel.ts` verifies the requested origin, all six horizons, valid
risk values, complete unique administrative locations and a nonempty irrigation
selection. It does not mutate the archive. Numeric 0/1/2 remain numbers; source
nulls and missing records have different explicit labels. District severity is
the maximum known tambon risk, never an average. The denominator for risk share
includes only 0/1/2. District total and filtered tambon count are both present.

Source ID, original names, source month and horizon allow tracing values to
`Drought_T1-6_rev03.xlsx`. The report includes source/normalized hashes and the
user-confirmed correction of Source ID 222 when applicable. No credentials,
internal filesystem paths, ThaiWater or synthetic forecast values are exported.

Cancel/unmount ignores late work. Session ownership is checked again immediately
before creating a browser download. The exporter never writes to Supabase.

## Workbook

1. **วิเคราะห์**: district/irrigation validation dropdowns, COUNTIFS-based monthly
   counts and risk share, native editable chart linked to those cells.
2. **สรุปอำเภอ**: snapshot of highest known risk per district, T+1–T+6 and real
   forecast-month headers, filtered/whole-district counts.
3. **รายตำบล**: raw wide-format forecast snapshot, typed values and source names.
4. **สถิติรายเดือน**: counts of every state, coverage and risk share per district
   and period, plus the selected-scope total.
5. **PivotTable**: native Excel pivot, district rows, horizon columns, sum of a
   constant-one count field, risk and irrigation report filters.
6. **ฐาน Pivot**: one row per tambon per horizon, AutoFilter table, trace key.
7. **ที่มาและนิยาม**: provenance, definitions, limitations and validation lists.

The chart responds to the two input cells. Ordinary table AutoFilters are
independent of that dashboard. Snapshot sheets are intentionally not presented
as live formulas. Editing the long-form analysis source affects the chart;
refresh the PivotTable after source edits. Summing across horizons counts
tambon-months, not unique tambons. Files never reconnect to Supabase.

Microsoft Excel can refresh the native PivotTable with **Data > Refresh All**;
the file requests refresh on open. Other spreadsheet viewers may not calculate
pivots, but the cached formula dashboard and snapshot sheets remain available.

## Implementation and Maintenance

`forecastExcelWriter.ts` is imported only on Download. `@protobi/exceljs`
4.4.0-protobi.10 is pinned for native pivot/page-filter support and preservation
of existing charts. Its pivot API is experimental: changes require the XLSX
structure, round-trip and spreadsheet-engine checks, not only a download test.
The export-only protected chunk has a separate 2.5 MB raw / 650 kB gzip cap;
existing login/application budgets are unchanged, and static imports of the
writer chunk are forbidden by the budget check.

`scripts/excel-template/build.mjs` uses the bundled artifact-tool runtime to
generate the data-free native chart template. The checked-in template contains
no forecast records. It normalizes the chart part's location for ExcelJS.
No Python or artifact-tool service is required in production.

The workbook finalizer updates chart caches to actual exported values and fixes
the fork's incorrect pivot record-count/fixed-refresh-date metadata using an XML
parser. Imported cell styles, including styled empty cells, are detached before
editing to avoid cross-cell number-format/font leakage.

Current dependency audit: the pinned fork brings uuid 9; npm reports a moderate
advisory for v3/v5/v6 with caller-provided buffers. The pivot writer uses only v4,
and this feature accepts no uploaded workbook or caller-provided UUID buffers.
Do not use this exporter as a general-purpose untrusted workbook parser.

## Targeted Verification

- `npx vitest run tests/forecastExport.test.ts`: all 1,734 selected-month values,
  month rollover, ID 222 mapping, district maximum, null/missing, scope rejection,
  native chart/pivot parts, XML relationships, cached formulas and cell formats.
- `DATABASE_TEST_PORT=5198 node scripts/test-database-ui.mjs --grep 'Excel export'`:
  desktop/mobile filters/download, no eager writer/full fetch, newer publication,
  offline rejection, empty irrigation selection, parent district default, cancel.
- `npm run build:protected`: isolated export budget, existing startup budgets,
  source-exposure checks and production compilation.
