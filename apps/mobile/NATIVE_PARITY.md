# Native Forecast App

## Product Direction

Native-first iPhone workflow. Three destinations: forecast, analysis, saved.
Do not reproduce desktop cards or embed the website in a WebView. Preserve the
Korat emblem, Google Sans and semantic colors; reuse native UI in `src/ui.tsx`.
User direction on 2026-09-21 explicitly keeps Actual / historical Archive UI
hidden, matching the forecast-only website. Existing forecast-origin selection
still means source month T, never observed damage or a current/live forecast.

Alignment follows the web's semantic roles, not its desktop dimensions:
brand/login headings, section and sheet titles, selected filter values, periods,
summary counts and standalone statuses are centered. `ui.tsx` owns balanced
heading action slots and selected-value alignment. Inputs, searchable option
lists, area result rows and explanatory paragraphs remain leading-aligned for
reading and scanning. Do not center every `AppText` globally.

## Feature Parity Acceptance

Owner direction on 2026-09-21 requires equivalent **features and behavior**,
not only matching branding or visible controls. Native navigation may differ,
but the same selected area, source month, horizon and filters must produce the
same result. Use only the web's currently mounted forecast product as the
baseline (`docs/APP_MAP.md`); parked Actual/Archive and inherited demo/admin
surfaces are excluded. A shared domain import proves reuse, not a completed
end-to-end native workflow.

Source comparison on 2026-09-21 identified these open gaps:

| Web contract / authority | Native status / required closure |
| --- | --- |
| Global search, aliases, type/district/topic filters and per-account history (`workspaceSearch.ts`, `WorkspaceSearchContent.tsx`) | Area search exists; this full search workflow is missing. |
| Analysis district filter, sorting, consecutive-risk details, district percent/count comparison (`ForecastAnalysisDialog.tsx`) | Six-month rows and risk patterns exist; these controls/details are incomplete. Tambon-only analysis must not offer a misleading district aggregate. |
| Analysis and same-target comparison results on the map (`ForecastAnalysisOverlay`) | Missing. Native row navigation is not equivalent to a filtered/comparison overlay. |
| Scoped coordinate lookup, visible pin and pin removal (`ForecastMapTools.tsx`) | Point-in-polygon validation is shared; native currently navigates straight to a tambon instead of preserving a scoped pin/result. |
| Map report PDF/PNG, current camera vs whole scope, dynamic pagination (`mapImageExport.ts`) | Missing. Excel is not a replacement for map reports. |
| Excel preview, coverage/exclusion/comparison counts, cancellation, workbook and native share (`ForecastExcelExport.tsx`) | Writer/model are shared; native lacks preview and full cancellation parity. Runtime evidence is recorded separately below. |
| Saved areas/filters and exact selection restoration (`WorkspaceBookmarks.tsx`, `savedWorkspaces.ts`) | Implemented with shared owner-scoped API; mutations and restoration still need a disposable-record end-to-end test. |
| Playback stops at T+6 and restarts from T+1 on an explicit replay (`ForecastMapTools.tsx`) | Corrected in native source; verify against the runtime checkpoint below. |
| Forecast selection, loading/retry/freshness, native navigation and touch controls | Shared data rules are implemented and sampled in Simulator; physical-device interaction/accessibility coverage remains incomplete. |

Do not mark feature parity complete while any required gap or unverified
critical flow remains. Password recovery/account administration are not active
web login features in the inspected baseline, so they are future scope, not
requirements inferred from dormant code. No test credentials belong in this file.

## Implemented Source

| Feature | Native owner / shared authority |
| --- | --- |
| Sign in, session persistence, local sign out | `App.tsx`, `Login.tsx`, `backend.ts`, `sessionStorage.ts`; existing Supabase Auth |
| Area/month search, province/district/tambon | `Workspace.tsx`, `ui.tsx`; canonical Korat administrative hierarchy |
| T+1 to T+6 and playback | `Workspace.tsx`; shared `forecastPeriod.ts` |
| Risk/irrigation map, tap selection, zoom, pan, reset, expand | `ForecastMap.tsx`; existing public Korat geometry and source-backed colors |
| Coverage, risk counts, six-month percent/count chart | `ForecastChart.tsx`, shared `summarizeExportRisks` |
| Monthly risk patterns, district maximum, tambon results, empty reset | `Analysis.tsx`; shared `forecastAnalysis.ts` |
| Same-target-month forecast comparison | `Analysis.tsx`; shared `buildForecastComparison`, revision checked on both sides |
| Followed areas and named filters, recall/remove | `Saved.tsx`; shared owner-only `createSavedWorkspaceClient` |
| Excel export and iOS share sheet | `ExcelExport.tsx`; shared model, workbook template and writer, Cordia New, filters/charts/pivots/traceability |

Every forecast read uses the existing scoped Supabase loader. It checks the
published revision before returning an in-memory cached slice. Refresh occurs
on area/month changes, pull-to-refresh and app resume. A failed refresh is
explicitly labelled; wrong-area/month data is not retained under new criteria.
No static risk dataset is imported by runtime code. Geometry is public and
bundled; canonical forecast data is imported only by test fixtures.

Export files are temporary in app cache and removed after the share operation.
Closing the export screen prevents an outstanding job from opening another share
sheet. Workbook generation currently runs on the JS thread; large province
exports require performance verification on a physical phone.

## Checks

From `apps/mobile`, Node 24:

```sh
npm run typecheck
npm run test:domain
npm run test:brand
npm run check:dependencies
npm run export:ios
```

Root domain tests can be run without modifying the website:

```sh
npx vitest run tests/forecastAnalysis.test.ts tests/forecastExportModel.test.ts tests/forecastArchive.test.ts tests/savedWorkspaces.test.ts
```

Native build/install instructions are in `README.md`. Native modules added in
this iteration require rebuilding the development client, not only restarting
Metro. The GeoJSON transformer keeps coordinates in a JSON string to avoid
building an enormous compiler AST. Metro aliases only platform dependencies:
browser telemetry is a native no-op, ExcelJS uses its polyfill-free browser build,
and the workbook template is supplied as native asset bytes.

Do not use ExcelJS's regular browser build: its global Promise polyfill causes
recursive promise rejection on the SDK 57/Hermes runtime. Use `exceljs.bare.min.js`.
Expo already provides `structuredClone`; no global core-js override is needed.
`expo-crypto` supplies native `getRandomValues` / `randomUUID` before loading
ExcelJS, which needs UUIDs for PivotTables. See the
[Expo Crypto API](https://docs.expo.dev/versions/latest/sdk/crypto/).
Load the writer with an in-function static `require`, not a dev split import
whose outside-app-root chunk URL is misresolved by Metro.

## Remaining Parity / QA

- Native map report/PDF/image export is not implemented. Coordinate lookup uses
  the shared Korat point-in-polygon validator, without requesting GPS permission.
- Auth remains the active web's provisioned-account flow. Recovery/account
  administration would require separate product scope, not dormant demo menus.
- Device deep links and native stack back gestures need a dedicated pass.
- Interactive physical-iPhone flows, Dynamic Type/VoiceOver and two-finger
  pinch need verification. Installation and the login screen are checked below.
- Saved-workspace mutations must be tested with disposable account-owned records;
  do not alter existing user records for screenshots.
- TestFlight/App Store signing/distribution is not configured or requested.

Do not describe this as complete web/native parity based on typecheck or a
successful bundle. Record live Simulator checks separately below.

## Simulator Verification: 2026-09-21

Environment: iPhone 17 / iOS 27, development build, authenticated Supabase
account. No test password is stored in this repository. Existing saved user
records were not modified. Production website and database schema were not changed.

- Sign-in and Keychain session restoration after a cold process launch passed.
- Province, Wang Nam Khiao district and Wang Mi tambon navigation passed.
  December 2025 / T+1: province coverage 117/289 (40%), district 4/5 (80%).
- T+4 in Wang Nam Khiao: normal 1, moderate 1, high 2, outside scope 1.
  Six-month risk percentages: 100, 100, 100, 75, 0, 0.
- Map polygon selection, zoom-in preserving selection, tambon drilldown and
  district back navigation passed.
- Scoped analysis and the T+3 risk filter passed (4/5 tambons).
- No Actual / historical Archive destination is present. Forecast-origin
  choices remain source T values, not actual observations.
- TypeScript, 5 native domain/storage tests, 3 brand tests, Expo dependency
  compatibility and iOS JS production bundling passed. Shared root domain
  suites passed 65 tests; scoped/revision cache suite passed 12 tests.
- Native rebuild with ExpoCrypto passed (`artifacts/ios-native-crypto-build.log`),
  installed and restored the authenticated province forecast successfully.
- Excel runtime issues found during live testing were corrected: avoid the
  Promise polyfill, use a static lazy writer import and supply native crypto.
  At this checkpoint the final export/share retry was **not verified**: macOS locked after the
  rebuilt app loaded. Resume by unlocking the Mac, opening Export, creating
  the province workbook and checking the share sheet plus generated XLSX.
  The later live retry below supersedes this blocker for province/all-status
  generation and opening the share sheet, not for every export criterion.

Screenshots and build logs are local ignored evidence in `artifacts/`.
Dependency audit currently reports 12 moderate findings; no forced downgrade
was applied. Reassess before distribution.

## Physical iPhone Checkpoint: 2026-09-21

Environment: iPhone 13 / iOS 26.6.2, Release configuration with owner-authorized
Apple Development signing. This is a direct local test installation, not a
TestFlight/App Store release. No device IDs, signing account credentials or
private keys are stored in the maintained source.

- Native Release build passed; `codesign --verify --deep --strict` passed.
- Installation and process launch passed for `th.korattanphai.development`.
- The app embeds `main.jsbundle` and assets; its Release launch does not use
  the development Metro server. Supabase access still requires internet.
- The installed, non-placeholder app icon retrieved from the phone is the
  Korat emblem. A physical-device screenshot confirms the branded native login
  screen, Google Sans and visible controls within the screen's safe areas.
- The local provisioning profile expires on 2026-09-28 at 14:33 ICT. Renew
  signing and reinstall after expiry; do not confuse this with certificate expiry.
- Device Hub reports screen sharing requires iOS 27 or later, so interactive
  sign-in, authenticated forecasts and Excel sharing were not tested on this
  iOS 26 device. No OS upgrade was performed. Complete these checks directly
  on the phone; retain the separate Simulator results above.

Local ignored evidence: `artifacts/ios-device-release-build.log`,
`artifacts/ios-device-install-20260921.json`,
`artifacts/ios-device-launch-20260921.json`, `artifacts/ios-device-icon.png`,
and `artifacts/ios-device-first-launch.png`.

### Alignment Follow-Up: 2026-09-21

Centered the native brand/login, headings, selected filter values, periods,
summary counts, analysis cells and standalone status text through the existing
native components. Preserved leading alignment for inputs, result lists and
explanatory prose. No web source or forecast calculations changed.

TypeScript and all 3 brand checks passed. The updated Release build, signature
verification, device install and launch passed. Current evidence:
`artifacts/ios-alignment-forecast.png` (authenticated province forecast in the
iPhone 17 Simulator, 117/289 and 40%) and `artifacts/ios-device-alignment.png`
(centered login on the physical iPhone 13). The new sheet alignment is not
visually verified: Device Hub UI actions intermittently failed with
`noWindowsAvailable`, including after the owner unlocked the Mac. No broader
web, data, accessibility or interaction regression pass was run for this visual
change.

## Feature Parity Runtime Follow-Up: 2026-09-21

Used the owner-provided test account already authenticated in the iPhone 17 /
iOS 27 Simulator. No passwords were written to source, docs or artifacts.

- Native playback now uses the web's 1600 ms step and stops at T+6 instead of
  wrapping automatically. Live check: T+5 -> Play -> T+6 with the button back
  in the stopped state. Explicit replay starts another sequence; opening a
  workspace sheet pauses it. TypeScript passed. This follow-up source change
  has not been rebuilt onto the physical phone; the last installed phone build
  is the alignment checkpoint above.
- Province / December 2025 / all irrigation statuses generated an XLSX and
  opened the actual iOS share sheet. Dismissal returned to the app with
  289 tambons / 32 districts and removed its temporary cache file. No external
  sharing destination was selected.
- The copied generated workbook parsed successfully with ExcelJS: 9 sheets,
  32 district rows, 289 tambon rows and 1,734 pivot input records (289 x 6).
  The XLSX contains real chart, PivotTable and pivot-cache XML parts. T+1 input
  counts match the native view: 117 moderate and 172 out of scope, 289 total.
  This does not certify Excel formula recalculation, every comparison/filter,
  or physical-device sharing.
- Centered account and export sheets could now be opened in the standalone
  Simulator window; this supersedes the prior sheet-action blocker for those
  two sheets only.

Evidence: `artifacts/ios-parity-excel-share.png` and
`artifacts/ios-parity-export-20260921T084317121Z.xlsx`. The feature parity gap
table remains open; these sampled checks are not a full parity sign-off.

## Map Camera Performance Follow-Up: 2026-09-21

`ForecastMap` now uses the shared `useMapCamera` controller for inline and
expanded maps at every geographic level. The old gesture path updated React
state and all 289 polygon props on each move. Camera movement now writes only
the native SVG group's matrix, coalesces touch updates to one animation frame,
and keeps geometry/data props unchanged during movement. Common boundaries
use one non-scaling outline path; the selected boundary is a separate overlay.
Coordinates and risk/irrigation data are not simplified or reclassified.

Zoom buttons animate for 220 ms and respect Reduce Motion. Pinch zoom anchors
to the touch midpoint, rebases when fingers change, and preserves the visible
center after panning. Touch bounds use React-root coordinates for inline and
modal consistency. Zoom remains bounded to 1x-8x. This is still a JS-driven
camera with native SVG drawing, not a claim of fully UI-thread-driven gestures.

TypeScript and all 9 native domain/camera tests pass. The province map in the
iOS 27 Simulator passed zoom-in, consecutive +/-, and reset-to-fit checks.
Automated dragging failed at the Device Hub control layer (`AXError.cannotComplete`),
so pinch/pan, selection after dragging, and measured frame rate on hardware
remain manual checks. A screenshot alone is not smoothness evidence.

Evidence is under `artifacts/ios-map-camera-*` and
`artifacts/ios-device-map-camera-*`. No web code, backend data, dependencies,
signing settings or generated native source was changed for this fix.

The final physical Release build, signature check, in-place installation and
launch passed (`ios-device-map-camera-final-*`). This binary also includes the
playback follow-up above; it supersedes that section's pending rebuild note.
The Simulator was shut down after camera checks to reduce build memory pressure.
