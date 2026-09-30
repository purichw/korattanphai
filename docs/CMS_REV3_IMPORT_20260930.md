# Rev3 CSV and Excel import

Local implementation on `fix/cms-no-code-20260930`, continuing the no-code CMS
cleanup. No commit, production write, migration or deployment was performed.

## Operator workflow

1. Open **จัดการข้อมูล → นำเข้าข้อมูล** and choose the forecast correction type.
2. Download the Excel template with its Thai descriptions, examples and area
   directory, or the equivalent CSV template. Both prepare the exact 289 source
   IDs and current Thai area names. Year/month are unset; risk cells say
   `ยังไม่กรอก`, so an untouched template cannot create plausible no-risk values.
3. Fill the origin year/month and six forecast results. The workbook has risk
   dropdowns. Example risks are explicitly fictional and live in a helper tab.
4. Upload CSV, XLSX or actual binary XLS. Headers from rev3 and the Thai template
   match automatically. Other column names can be selected beside a Thai field
   description, an accepted example and up to three values found in the file.
5. Select one origin month, review, and save a draft. Existing validation,
   correction, conflict handling and explicit publication remain authoritative.

CSV has one table; its descriptions are on the screen and in the Excel template.
The Excel tabs are `ข้อมูลพยากรณ์`, `ตัวอย่าง`, `คำอธิบาย`, `รายชื่อพื้นที่`.
When the main named template tab exists, the three helper tabs are excluded.
The template's area labels/IDs contain no actual forecast results.

## Contract and limits

- The 12 fields in `src/admin/rev3Fields.json` cover Year, Month, ID, TAMBON_E,
  AMPHOE_E, Irrigation_Status and Pred_Risk_T+1 through Pred_Risk_T+6. Names and
  irrigation remain import evidence; this workflow does not change their master
  registries. Source IDs use the existing approved database crosswalk.
- Year/month denote origin T; target is T+h. Only current published origins are
  supported. This change does not authorize adding a new model run or month.
- Risk 0/1/2 and their Thai labels retain their exact meaning. Blank or explicit
  out-of-scope means null. Missing areas/columns cannot become blank predictions.
  Unknown risk values are retained for visible correction. `ยังไม่กรอก` blocks
  preparation. Exact duplicates collapse and conflicts remain unresolved.
- CSV supports comma, semicolon or tab separators, escaped quotes and multiline
  text. Ragged rows, malformed quotes, duplicate/unsafe headers and ambiguous
  header matches require correction. Identifiers remain strings until their
  explicit field conversion; there is no general numeric/date guessing.
- UTF-8 is the CSV default. Thai Windows-874 requires an explicit operator choice
  and re-reads the same selected file. Excel dates are not guessed from serials.
- Files are capped at 20 MB, 100,000 rows and 100 columns per sheet. Parsing runs
  in the existing cancellable worker with a 60-second deadline. XLSX and XLS
  formula/error cells are rejected; formulas/macros are never executed. This does
  not add XLSM, XLSB or password-protected workbook support.
- The original evidence contract (SHA-256, sheet, original row values/positions)
  is unchanged, as are authorization, archive scope, publication and SQL/API
  contracts. Uploaded file binaries are not retained.

## Implementation and dependency

`readDataFile.ts` routes CSV, XLS and the existing ExcelJS XLSX reader. Legacy XLS
uses SheetJS CE 0.20.3 from the official CDN tarball, pinned with package-lock
integrity. Extended codepages enable older Thai files. The official installation
source is <https://docs.sheetjs.com/docs/getting-started/installation/nodejs/>.
The public npm-registry build was not used. The dependency is loaded in the
user-triggered worker; the normal page does not eagerly import the XLS parser.

`normalizedForecastImport.ts` owns automatic/manual matching and field-specific
normalization. `AdminImport.tsx` presents guidance, downloads and previews. The
assets are `src/assets/rev3-import-template.xlsx` and its UTF-8 BOM CSV equivalent.
The reproducible builder is `scripts/build-rev3-import-template.mjs`; renders
are under `artifacts/rev3-import`. Authoring uses the bundled Artifact Tool
runtime. Run the builder with that runtime's Node executable and set
`KTP_ARTIFACT_NODE_MODULES` to its node_modules path from
`load_workspace_dependencies`; no authoring package is installed into the app.

## Verification

- Targeted unit checks: **17 passed**, covering CSV quoting, delimiters, encodings, malformed rows,
  genuine BIFF8 XLS with Thai text, a real XLS formula fixture, corrupt Excel,
  original XLSX compatibility, manual/ambiguous mappings, all template IDs,
  placeholders, null/zero and exact T+h dates. The XLS formula fixture was made
  with xlwt because SheetJS's BIFF8 writer drops formula expressions.
- Browser checks: **12 passed** across 1440×960 desktop and 390×844 mobile.
  Actual CSV/XLSX/XLS uploads save 1,734 cells each, with original source values
  retained. CSV exercises malformed-file recovery, template-download hash,
  manual matching, validation and reload. Existing import/repair/export/conflict,
  original workbook and immutable publication checks also passed.
  After the final error-message adjustment, the two desktop/mobile CSV journeys
  were rerun successfully and their screenshots refreshed.
- TypeScript and the CMS test build passed. The worker grew to about 2.03 MB
  uncompressed due to legacy XLS support and stays off the main thread. Normal
  Vite chunk advisories remain. No release, whole-site or native suites were run.
- The four workbook sheets and current upload dialogs were visually inspected.
  Screenshots use localhost and an isolated fixture database, not production.
  See `artifacts/rev3-import/desktop-upload.png` and `mobile-upload.png`.

Downloadable copies (identical to the application assets) are in
`outputs/cms-rev3-import-20260930/Korat_rev3_template.xlsx` and
`outputs/cms-rev3-import-20260930/Korat_rev3_template.csv`.
