# Forecast Excel Export

## Entry and Scope

The shared `ForecastExcelExport` entry lives in the primary navigation, including
the mobile menu. It is available only inside `DatabaseWorkspaceProvider`.

- Filters: source/origin month T, province or district, irrigation status, optional
  second origin whose six-month forecast window overlaps the selected origin.
- Prefills the visible route. A tambon route defaults to its parent district so
  the district summary does not silently represent a single tambon.
- Always includes all risk states and T+1 through T+6. The map's selected horizon
  and risk filter do not truncate this multi-month report.
- Changing export filters does not navigate or change the map's filters.

## Data Contract

Opening the dialog loads the lightweight overview slice for available months.
**ตรวจข้อมูลก่อนส่งออก** prepares a preview with the number of districts,
subdistricts and location-month records, missing/out-of-scope counts, the forecast
window and dataset revision. One record means one tambon in one target month;
neither missing nor out-of-scope records are counted as numeric risk zero.

The dialog owns isolated Supabase loaders. Prepare and Download both call
`full.load({ areaCode, originPeriod })`: this checks the
latest Supabase revision on every attempt, including cache hits, and requests
only the selected scope and origin with six horizons. Offline/revision errors
block export instead of silently using stale data. Download rechecks the preview
data and comparison. If either changes, it replaces the preview and requires a
second Download click after the user reviews the new values. It never silently
downloads a publication different from the preview.

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

Cancel aborts the dialog's data requests and terminates its workbook worker,
including template fetch and Excel/ZIP CPU work. It retains the chosen options
and preview for retry. Close, Escape, unmount and account changes stop the work
and discard the dialog. Map requests are owned separately and remain unaffected.
Data loads and the final session check each have a 30-second deadline; workbook
generation has a 90-second deadline. Errors preserve options and never download
partial files. Stages describe data checking, workbook creation and packaging.
Session ownership is checked immediately before download. The exporter never
writes to Supabase.

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
8. **ข้อมูลสำหรับระบบ**: one typed record per tambon and horizon. Stable English
   keys, Gregorian `YYYY-MM` origin/target, integer horizon, nullable numeric risk,
   separate value status, boolean correction flag and dataset/export provenance.
9. **พจนานุกรมข้อมูล**: Thai and English labels and business descriptions, type,
   M/C/O requirement, nullability, unit, sample value, blank meaning and mappings
   to the existing worksheets. Examples are explanatory values, not additional
   forecast records.
10. **เปรียบเทียบรอบ** (when selected): the same tambon and target calendar month
    across two origin rounds, with each round's horizon, risk, status and lineage.

Filenames contain the selected origin/area/irrigation, optional comparison origin,
bounded dataset version and source fingerprint, export format version `2.0.0`,
and a UTC export timestamp including milliseconds. Export time is also recorded
in the workbook with its timezone. The data revision and report-format revision
are separate concepts.

## Machine-readable data and comparison

The canonical typed field contract is `src/forecastExportDictionary.ts` and is
included for the tables present in each workbook. It covers every field of
`machineRows` and, when selected, `comparisonRows`; the writer adds mappings and definitions for the original
worksheet columns and computed measures.

| Field | Type / requirement | Sample | Business meaning / ความหมาย |
| --- | --- | --- | --- |
| `subdistrictCode` | string, M, non-null | `"300301"` | Administrative join key / รหัสตำบลสำหรับจับคู่ข้อมูล |
| `originPeriod` | string, M, non-null | `"2025-12"` | Forecast origin T / เดือนตั้งต้นที่ใช้พยากรณ์ |
| `targetPeriod` | string, M, non-null | `"2026-01"` | Month being predicted / เดือนที่ค่าพยากรณ์กล่าวถึง |
| `horizon` | integer, M, non-null | `1` | Whole months after T / จำนวนเดือนหลังเดือนตั้งต้น |
| `forecastRisk` | integer, C, nullable | `2` | Ordinal class 0/1/2, not probability / ระดับความเสี่ยง ไม่ใช่เปอร์เซ็นต์ |
| `forecastStatus` | string, M, non-null | `"VALID"` | VALID, OUT_OF_SCOPE or MISSING / ต้องอ่านเหตุที่ไม่มีตัวเลขจากสถานะนี้ |
| `sourceAdminCorrectionApplied` | boolean, M, non-null | `false` | Reviewed administrative correction used / มีการแก้การจับคู่พื้นที่ต้นทางหรือไม่ |
| `riskDelta` | integer, C, nullable | `1` | Selected-round risk minus comparison-round risk / ความเสี่ยงรอบที่เลือก ลบ รอบอ้างอิง |

M = mandatory, C = conditionally populated, O = optional. `forecastRisk` is
populated exactly when `forecastStatus` is VALID. Null exports as a genuinely
blank XLSX cell; never the string `"null"`, the text `"ไม่มีข้อมูล"` or numeric
zero in the numeric column. The adjacent status and bilingual labels preserve
the meaning of that blank. `riskDelta` is populated only when both risks are
VALID. Because classes are ordinal, a delta describes category movement, not an
increase in probability, damage or a model-accuracy score.

Comparison matches **administrative code + target month**, not equal horizon
numbers: December 2025 T+1 and November 2025 T+2 both refer to January 2026.
Only overlapping target months are compared; the original report still exports
all T+1–T+6. Both inputs must have identical metadata, area/irrigation scope and
administrative membership. Different publications or incompatible scopes fail
explicitly. INCREASED / DECREASED / UNCHANGED apply only to pairs with two numeric
risks; otherwise NOT_COMPARABLE retains each source status independently.

The chart responds to the two input cells. Ordinary table AutoFilters are
independent of that dashboard. Snapshot sheets are intentionally not presented
as live formulas. Editing the long-form analysis source affects the chart;
refresh the PivotTable after source edits. Summing across horizons counts
tambon-months, not unique tambons. Files never reconnect to Supabase.

Microsoft Excel can refresh the native PivotTable with **Data > Refresh All**;
the file requests refresh on open. Other spreadsheet viewers may not calculate
pivots, but the cached formula dashboard and snapshot sheets remain available.

## Implementation and Maintenance

`forecastExcelJob.ts` is dynamically imported only on Download. It starts a
dedicated `forecastExcelWorker.ts` which imports `forecastExcelWriter.ts`.
The writer, ExcelJS, JSZip and XML parser stay outside the main UI thread.
`@protobi/exceljs`
4.4.0-protobi.10 is pinned for native pivot/page-filter support and preservation
of existing charts. Its pivot API is experimental: changes require the XLSX
structure, round-trip and spreadsheet-engine checks, not only a download test.
The export-only worker graph has a separate 2.65 MB raw / 700 kB gzip cap
(including the portable XML parser and bilingual export schema);
existing login/application budgets are unchanged, and static imports of the
worker/writer chunks are forbidden by the budget check. The budget check also
resolves the emitted worker URL after build protection rewrites chunk names.

`scripts/excel-template/build.mjs` uses the bundled artifact-tool runtime to
generate the data-free native chart template. The checked-in template contains
no forecast records. It normalizes the chart part's location for ExcelJS.
No Python or artifact-tool service is required in production.

The workbook finalizer updates chart caches to actual exported values and fixes
the fork's incorrect pivot record-count/fixed-refresh-date metadata using an XML
parser (`@xmldom/xmldom` 0.9.12, usable inside workers). Imported cell styles,
including styled empty cells, are detached before
editing to avoid cross-cell number-format/font leakage.

The pinned fork's uuid dependency is overridden to 11.1.1; the dependency audit
after adding the worker-compatible XML parser reports zero vulnerabilities.
This feature accepts no uploaded workbook or caller-provided UUID buffers.
Do not use this exporter as a general-purpose untrusted workbook parser.

## Targeted Verification

- `npx vitest run tests/forecastExport.test.ts tests/forecastExportModel.test.ts tests/forecastExcelJob.test.ts`: all 1,734 selected-month values,
  month rollover, ID 222 mapping, district maximum, null/missing, scope rejection,
  native chart/pivot parts, XML relationships, cached formulas, typed read-back,
  dictionary coverage, same-target comparison, missing/out-of-scope transitions,
  real worker lifecycle cancellation and timeouts.
- `DATABASE_TEST_PORT=5198 node scripts/test-database-ui.mjs --grep 'Excel export'`:
  desktop/mobile filters/download, no eager writer/full fetch, newer publication,
  offline rejection, preview refresh, empty irrigation selection, parent district
  default, real worker cancellation/retry and comparison exports.
- `npm run build:protected`: isolated export budget, existing startup budgets,
  source-exposure checks and production compilation.

### Reading and compatibility evidence (2026-09-09)

- **53/53** targeted model, worker and workbook tests passed. Workbook read-back
  includes every selected source risk, typed machine cells, dictionary coverage,
  comparison alignment and all 32 comparison table headings including their
  deliberate Thai/English line breaks.
- **6/6** development browser tests passed on desktop/mobile. The protected
  database build passed **12/12** cases on Chromium desktop/mobile, Firefox and
  WebKit. After the final XML newline correction, its four comparison and real
  cancellation/retry cases passed again and all four files read back correctly.
  A final width-only correction passed the desktop comparison/download case;
  the same protected build also passed a full-province worker export checking
  all 289 tambons and all 1,734 forecast values.
- **ONLYOFFICE on macOS:** opened the downloaded comparison workbook without a
  repair warning. Changing the analysis irrigation dropdown from all to unknown
  recalculated January from four valid forecasts/two out-of-scope to zero valid
  forecasts/two out-of-scope, with no numeric risk-share substitute. Returning
  to all restored the values and native chart. Pivot Table > Refresh populated
  six records per horizon and 36 location-months in total. The viewer changes
  Pivot column widths on refresh; this is separate from the exported snapshots.
- **Readability:** reviewed all ten sheet views, Thai headings, wrapped business
  descriptions and the separate numeric/status columns. Added chart object title
  and description; the adjacent table supplies the same counts. Desktop/mobile
  preview checks cover horizontal overflow and visible download/cancel actions.
  Artifact-tool read/render checks supplement the native app; its importer does
  not display the preserved chart and is not used to certify chart rendering.
  ExcelJS read-back of the final comparison file found 48 formula cells and no
  stored cell/formula error values; this is not a Microsoft Excel recalculation
  result. The final two column-width changes were rendered and read back, but
  the Mac locked before their final native-app visual check. The same native
  workbook logic, chart recalculation and Pivot refresh were checked before
  those width-only changes.
- **Microsoft Excel Windows, Mac and Web, and Microsoft Accessibility Checker:**
  not executed. No installed Microsoft Excel app or connected Excel session was
  available. Automated XLSX/OOXML checks and ONLYOFFICE do not establish those
  platform results.

Evidence is under `artifacts/excel-upgrade/` (local, ignored): `browser-final`,
`built-browser`, `built-browser-comparison-final`, `protected-database`, and
`reader`, `final-desktop-reading`, and `province-worker`. Source data and geodata
were not changed. These local checks preceded the production release below.

### Production release — 2026-09-09

Runtime `1404e49d55c8ca2062e35baf01c9c8c8018dca7a` is deployed at
<https://korattanphai.vercel.app> as `dpl_6Tui6Ae7R5ZHrmM8sQGzVnxQyTji`.
The follow-up `2b6bc4b12629aa9d2a352cd74372c0c112765923` only prebundles lazy
worker dependencies in the database test runner to prevent a cold-cache Vite
reload race; application code and the deployed artifact are unchanged.
[CI passed](https://github.com/purichw/korattanphai/actions/runs/34346764768)
all jobs, including 246 unit, 135 built-browser, 41 database-browser and six
WebKit/Firefox cases.

Candidate and primary production each passed 32 authenticated smoke checks and
seven hosted endpoint checks. Downloads match all 1,734 province values and
36 district values. Supplemental desktop/mobile downloads on both origins
verify ten sheets, 36 typed machine rows, 30 same-target comparison pairs,
82 dictionary definitions, revision reads and native chart/Pivot XML parts.
Desktop/mobile production screenshots were reviewed. Evidence lives under
`artifacts/excel-upgrade/release/`; deployment and recovery details are in
[HANDOFF.md](HANDOFF.md). This hosted verification does not extend the Microsoft
Excel platform compatibility coverage described above.

### Microsoft Excel acceptance pass when available

Use the same downloaded file on each platform and record application version,
file SHA-256 and result. Open without a Repair/recovery warning; verify the
initial numeric cells and all Thai/English headings. Change both dashboard
dropdowns and verify counts, the valid-only denominator and native chart against
`ฐาน Pivot`. Refresh the native Pivot and check per-horizon and grand totals.
Check that missing/out-of-scope numeric blanks remain distinct from class zero,
that filters and frozen identity columns work, and that the dictionary explains
each field's unit and blank meaning. Inspect at 100% zoom and in print preview.
Run Review > Check Accessibility and inspect heading/table names, reading order,
chart alternative text and contrast. Record any engine-specific issue before
claiming compatibility. See [Microsoft's Accessibility Checker guidance](https://support.microsoft.com/en-gb/accessibility/office-accessibility/improve-accessibility-with-the-accessibility-checker).
