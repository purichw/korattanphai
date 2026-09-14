# Forecast UI Release: 2026-09-14

## Scope

User authorization: push and deploy only this conversation's work.

- Shared searchable area/month dropdowns and long-list search, including Thai
  month names, Buddhist/Gregorian years, Thai digits, keyboard and mobile sheets.
- Scope-aware analysis titles, separate monthly-risk and first-risk filters,
  stable modal height/loading and actionable empty results.
- Compact district/province charts with centered selected-month coverage and
  percentages; separately restored tambon map sizing; grouped playback period.
- Cordia New workbook typography and centered short fields with wrapped metadata.

The release branch starts from `e5b056b`, the documented production baseline
(runtime `e72fc20`, test correction `01d8f81`). It does not include the later
global workspace-search commits `6c2dc5d`, `f3f8f6d`, or `f20803c`.
The original dirty checkout is preserved. No unrelated API/UAT/research work,
forecast data, geometry, database migrations or authentication changes ship here.

## Verification

- Unit suite: 266 tests passed.
- Protected build, exposure checks and deferred-tool boundaries passed on Node 24.
  Core gzip budget is 375 kB (previously 370 kB); measured about 371 kB.
  Raw JavaScript, login, auth, Excel and map-tool caps are unchanged.
- Targeted Supabase-fixture browser suite: 46 desktop/mobile cases passed.
  New analysis, searchable-select and tambon-layout cases now run in database CI.
- Static protected-build layout suite: 16 desktop/mobile/tablet cases passed.
- Map scroll tests use a 720px-high desktop viewport so compact tambon pages
  still exercise actual document scrolling, instead of requiring excess height.
- Initial mixed-mode local run was not release evidence: static-workspace cases
  lacked their static data, and the report stress case imports development source.
  These cases are rerun in their intended static/development environments.
- Physical devices are not tested; mobile evidence uses browser emulation.

## Deployment

Candidate and production verification are required before promotion/closeout.
Previous primary: `dpl_7hxc83Ya1pNNRsM2th89F4msMixq`,
`https://korattanphai-g0r7luxo7-purichwc-1517s-projects.vercel.app`.
Keep the previous deployment available as a rollback target; no database rollback
is needed because this release makes no schema or forecast-data changes.
