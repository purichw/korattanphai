# Forecast UI Release: 2026-09-14

## Scope

User authorization: push and deploy only this conversation's work.

- Shared searchable area/month dropdowns and long-list search, including Thai
  month names, Buddhist/Gregorian years, Thai digits, keyboard and mobile sheets.
- Scope-aware analysis titles, separate monthly-risk and first-risk filters,
  persistent modal shell/loading and actionable empty results. The latest request
  replaces fixed analysis height with content-sized height capped to the viewport,
  removing blank space below empty results and retaining internal result scrolling.
- Compact district/province charts with centered selected-month coverage and
  percentages; separately restored tambon map sizing; grouped playback period.
- Cordia New workbook typography and centered short fields with wrapped metadata.
- Irrigation empty results reuse the shared icon/heading/reset presentation on
  overview, province, district and tambon pages, matching the analysis empty state.

The initial isolated candidate started from `e5b056b`, the production baseline
at release start. Before promotion, primary changed to deployment
`dpl_FkUCpZxxxpX5Y5EzvzhFE8r2Yq2t` (runtime `f3f8f6d`). The candidate was not
promoted. The release incorporates that already-deployed baseline and its
test-only `f20803c` correction so existing production search is not rolled back.
The net new production delta is still this conversation's forecast UI work.
Unrelated dirty checkout work is preserved. No unrelated API/UAT/research work,
forecast data, geometry, database migrations or authentication changes ship here.

## Verification

- Latest modal follow-up: six targeted desktop/mobile checks pass for fitted
  empty results, scoped reset, searchable menus, long table/graph scrolling,
  visible header/close controls and background scroll containment. Native flex
  dialogs require `height: fit-content`; `auto` still stretches to the height cap.
  Empty-state bottom spacing is checked at 10-24px, with current screenshots.
- Unit suite: 272 tests passed after incorporating the new production baseline.
- Protected build, exposure checks and deferred-tool boundaries passed on Node 24.
  Core gzip budget is 375 kB (current production baseline: 372 kB); measured about
  371 kB for static mode and 373 kB for Supabase mode.
  Raw JavaScript, login, auth, Excel and map-tool caps are unchanged.
- Targeted Supabase-fixture browser suite: 46 desktop/mobile cases passed.
  New analysis, searchable-select and tambon-layout cases now run in database CI.
- Static protected-build layout suite: 16 desktop/mobile/tablet cases passed.
- Map scroll tests use a 720px-high desktop viewport so compact tambon pages
  still exercise actual document scrolling, instead of requiring excess height.
- Irrigation filters preserve the desktop map's populated frame, including empty
  and all-out-of-study results, invalidating the measurement on actual viewport
  width changes, not temporary scrollbar/overlay changes in the card width.
  No remembered desktop height applies on mobile.
  The compact desktop plot has a stable 220px height, preventing intrinsic SVG
  dimensions from changing the chart/map row after reset. Both viewport tests pass.
- Final protected static-build irrigation/layout suite: 38 tests passed, including
  overview, province, districts with/without irrigated areas, tambon and mobile.
- Candidate live Supabase smoke: 32 checks plus scoped analysis/search/empty-state
  checks on desktop and mobile passed. Exported province workbook contains 1,734
  values matching the source, native chart/PivotTable, Cordia New and centered styles.
- Initial mixed-mode local run was not release evidence: static-workspace cases
  lacked their static data, and the report stress case imports development source.
  These cases are rerun in their intended static/development environments.
- Physical devices are not tested; mobile evidence uses browser emulation.
- CI identified a scrollbar-width invalidation missed on macOS overlay scrollbars;
  regression coverage now changes the card width without resizing the viewport.
  The Excel browser assertion follows the requested Cordia New 18pt heading.
  The search-history test allows 60 seconds for three document loads while
  retaining every history isolation and persistence assertion.
- The map-frame test captures its actual viewport: CI traces show Chromium's
  full-page capture invalidates the viewport-dependent height between filtering
  and measurement. Dimension, reset, responsive and empty-state assertions remain
  unchanged; the candidate runtime is unchanged by this test-only correction.

## Deployment

Candidate and production verification are required before promotion/closeout.
Previous primary: `dpl_FkUCpZxxxpX5Y5EzvzhFE8r2Yq2t`,
`https://korattanphai-o8txvojte-purichwc-1517s-projects.vercel.app`.
Keep the previous deployment available as a rollback target; no database rollback
is needed because this release makes no schema or forecast-data changes.
