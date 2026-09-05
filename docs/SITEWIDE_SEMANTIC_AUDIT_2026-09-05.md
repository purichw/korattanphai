# Site-Wide Semantic UX Audit

Date: 2026-09-05. Original audit below; local implementation closeout follows.
The fixes are not pushed or deployed. Database records are unchanged.

## Scope And Evidence

- Production: https://korattanphai.vercel.app, runtime `ff01bd9`.
  Current browser observation confirmed `/assets/index-fc16d4f4a7.js`.
  Local checkout: `fe266a2` (documentation-only successor), initially clean.
- Inspected the login, shared account menu, bookmarks, Home, province drought,
  district and subdistrict templates, including expanded secondary sections.
- Live examples: province Dec-2025/T+4; Ban Kao Dec-2025/T+4 (high risk);
  Ban Lueam Dec-2025/T+1 (all out of scope); Nai Mueang Dec-2025/T+1
  (out of scope, mobile); Home province and filtered Dan Khun Thot T+1.
- Browser sizes: 1440x960 and 390x844. This is representative template/state
  coverage, not a claim to have clicked every district/subdistrict URL.
- Source-wide census covered all 32 districts, 127 target months and six
  horizons: 24,384 combinations. Of these, 1,404 are entirely out of scope,
  across Ban Lueam and Chok Chai. This is a canonical-data calculation;
  the latest Ban Lueam case was also reproduced on production.
- Fresh browser screenshots and DOM evidence were displayed in the audit task.
  Full-page Home evidence from the same production artifact and default state
  is available at `smoke-results/database-production/desktop-overview.png`.
  Current Home was rechecked against the same module, viewport and data state.
- No production records were created, edited or deleted. Account persona and
  reset actions were inspected but not activated.

Severity: P1 = potentially misleading decision-making information;
P2 = misleading scope, content or action; P3 = secondary clarity/polish.

## Findings

### F01 / P1: Out-Of-Scope Data Becomes A Green Zero Trend

Production Ban Lueam shows four out-of-scope tambons and zero in-scope tambons,
but draws six green zero points. Its chart explanation says the archive reports
no risk signal, and the attention summary says no signal in available forecasts.
Those claims are not supported by four null predictions. The same attention
copy appears for the out-of-scope single tambon Nai Mueang.

Cause: `forecastHasData` uses matched rows, including null rows. The trend model
discards in-scope/out-of-scope coverage, then maps zero risk count to `normal`.

Owners: [workspace](../src/components/nakhon-ratchasima/DroughtForecastWorkspace.tsx#L571),
[band](../src/components/nakhon-ratchasima/forecastModel.ts#L31),
[trend projection](../src/components/nakhon-ratchasima/forecastModel.ts#L310).

Recommendation: carry coverage into each trend point, distinguish unavailable
from measured zero, and render an explicit neutral out-of-scope state. Never
reclassify source null as zero. Cover all-null and partially covered scopes.

### F02 / P1: Six Forecast Horizons Are Presented As Six Calendar Months

The province title says `คาดการณ์ภัยแล้ง 6 เดือน`; chart accessible text and
hidden eyebrow repeat six-month language. Yet the graph holds the target month
fixed and compares T+1 through T+6 from different reference/issue months.
For Dec-2025, the labels run from Nov back to Jun, not six future target months.
The correct explanation exists only inside the collapsed guidance section.

Owners: [province title](../src/components/nakhon-ratchasima/ProvinceView.tsx#L66),
[chart](../src/components/nakhon-ratchasima/DroughtForecastWorkspace.tsx#L98),
[projection](../src/components/nakhon-ratchasima/forecastModel.ts#L310).

Recommendation: describe comparison of six forecast horizons for one target
month consistently, including chart title, accessible name and tooltip.
Do not change target/issue calculations or archive values to fit the old title.

### F03 / P2: A Tambon Page Still Uses An Aggregate Dashboard

Ban Kao shows four category counts of zero/one, `1/1 ตำบล` coverage, the same
counts again in expanded details, and a further single-status summary. Its
`ตำบลภัยแล้งที่ควรตรวจสอบ` contains a button back to Ban Kao itself; clicking
it was verified to retain the same tambon and selected forecast.

The numbers ARE scoped to one tambon, not accidentally all 289. The problem is
the many-area presentation. `DroughtForecastWorkspaceKpiStrip` accepts `level`
and `selectedRecord` in its type but only consumes `summary`. Readiness also
uses a population-style gauge/breakdown for one tambon.

Owners: [KPI strip](../src/components/nakhon-ratchasima/DroughtForecastWorkspace.tsx#L313),
[self-link list](../src/components/nakhon-ratchasima/DroughtForecastWorkspace.tsx#L691),
[scoped input](../src/components/nakhon-ratchasima/SubdistrictView.tsx#L65).

Recommendation: keep shared primitives, but add an explicit single-area variant:
one forecast status, reference context and availability. Omit the self-list and
population breakdown where there is only one entity. Preserve sibling-area
navigation and the ability to change target/horizon.

### F04 / P2: `100%` Coverage Measures Rows, Not Usable Forecasts

Ban Lueam says `4/4 ตำบล` and `100% มีรายการพยากรณ์`, while zero tambons have
a prediction value. Nai Mueang similarly shows 1/1 and 100% beside out-of-scope.
The calculation correctly counts matched explicit rows, but the headline
`ครอบคลุม` does not distinguish import completeness from forecasting coverage.
Home instead uses in-scope counts, so the two surfaces appear to disagree.

Owners: [context](../src/components/nakhon-ratchasima/DroughtForecastWorkspace.tsx#L263),
[KPI strip](../src/components/nakhon-ratchasima/DroughtForecastWorkspace.tsx#L320),
[summary](../src/components/nakhon-ratchasima/forecastModel.ts#L279).

Recommendation: use in-scope/total for user-facing forecast coverage; retain
matched-row completeness only as clearly named source/import diagnostics.
Do not discard the explicit out-of-scope records from the database.

### F05 / P2: `Half The Area` Is A Count, Not Land Area

The chart threshold is half the number of tambons, not half their land area or
agricultural area. Its band uses `>= 0.5` but says `เกินครึ่งพื้นที่`.
Khon Buri Dec-2025/T+1 has six risk tambons out of twelve: exactly half, not
more than half. This aggregate band also is not the Excel's 0/1/2 risk class.

Owners: [threshold](../src/components/nakhon-ratchasima/DroughtForecastWorkspace.tsx#L61),
[labels](../src/components/nakhon-ratchasima/DroughtForecastWorkspace.tsx#L144),
[classification](../src/components/nakhon-ratchasima/forecastModel.ts#L31).

Recommendation: call it a reference for half the tambon count, align the
boundary wording with the comparison, and distinguish this reference from
model severity or an official warning threshold. Removal is a product decision.

### F06 / P2: Cleared Historical Data Still Produces Large Empty Dashboards

The secondary `สถานการณ์ภัยแล้งตามข้อมูลพื้นที่` sections remain on province,
district and tambon pages although the research dataset has zero periods and
zero monthly rows (`CLEARED_FOR_DATASET_REFRESH_EMPTY`). They expand into
multiple repeated no-data cards, descriptions of unavailable analyses and empty
history panels. District attention lists select the first five administrative
areas even with no records, under a claim that they are ranked by drought.

Some empty-data outputs are affirmatively green/REAL: `ข้อมูลที่ต้องตรวจซ้ำ
ไม่พบ` or `0 ชุด`. District coverage copy even reads `0% ครอบคลุมทุกพื้นที่`.
That is not evidence of a completed quality check or full coverage.

Owners: [research heading](../src/components/nakhon-ratchasima/ResearchPanels.tsx#L297),
[situation](../src/components/nakhon-ratchasima/ResearchPanels.tsx#L360),
[attention list](../src/components/nakhon-ratchasima/ResearchPanels.tsx#L575),
[period gate](../src/components/nakhon-ratchasima/workspaceModel.ts#L535).

Recommendation: gate the analytical sections on actual records. Preserve their
design, retain genuinely useful administrative navigation, and show at most one
short unavailable-data notice. An unavailable quality check must not look passed.

### F07 / P2: Agriculture Scope Is Just The Administrative Count

District/tambon agriculture panels remain visible without agricultural data.
For Ban Lueam, `พื้นที่ในขอบเขตประเมิน 4 ตำบล` is followed by no-data metrics;
for Ban Kao it is always `1 ตำบล`. The value comes from the administrative scope,
not verified assessed agricultural coverage. The province/Home agriculture
panels already have a REAL-data gate, so this policy differs by page level.

Owners: [area agriculture](../src/components/nakhon-ratchasima/ResearchPanels.tsx#L1061),
[district composition](../src/components/nakhon-ratchasima/DistrictView.tsx#L106),
[tambon composition](../src/components/nakhon-ratchasima/SubdistrictView.tsx#L104).

Recommendation: apply the actual-data gate consistently, keeping the component
design. If administrative count is useful, label it as administrative scope,
not assessed agricultural area. No removed synthetic rai values were found here.

### F08 / P2: Expanded Forecast Details Duplicate The Summary

`ดูรายละเอียดเพิ่มเติม` repeats the same target, context and category totals;
the tambon case repeats aggregate counters and then adds the selected status.
It retains technical `ค่าที่พยากรณ์ = 0/1/2` text, despite the main KPI strip's
formal descriptions. Copy says `แผนที่ด้านล่าง` although the map is above it.

Owners: [detail composition](../src/components/nakhon-ratchasima/DroughtForecastWorkspace.tsx#L665),
[map-direction copy](../src/components/nakhon-ratchasima/DroughtForecastWorkspace.tsx#L226),
[duplicate metrics](../src/components/nakhon-ratchasima/ForecastControls.tsx#L55).

Recommendation: remove redundant summary output or replace it only with actual
additional insight/source context. Keep one shared vocabulary for risk states.

### F09 / P2: Readiness's Percentage Can Describe The Wrong Category

Filtered Home for Dan Khun Thot shows one tambon with source inputs, zero ready
tambons, then `มีข้อมูลตั้งต้น · ประมาณ 0% ของพื้นที่ทั้งหมด`. The percentage
is the ready share, while the adjacent label describes the highest available
category. The code pairs `readiestLevelLabel` with `readyPercent`.

Separately, readiness comes from static evidence/source-capability matrices,
not the loaded Excel archive's completeness or forecast accuracy. This is not
proof of invented predictions, but its generic wording is easy to misread
beside forecast coverage. The data provenance needs explicit separation.

Owners: [panel](../src/components/nakhon-ratchasima/ResearchPanels.tsx#L1120),
[calculation](../src/components/nakhon-ratchasima/workspaceModel.ts#L1449).

Recommendation: attach the percentage explicitly to the ready category, show
single-area readiness as a status, and label which supporting dataset is being
described. Do not recompute readiness from forecast values without a new contract.

### F10 / P2: Production Account Menu Still Exposes Demo Actions

The shared menu offers seven display personas and `คืนค่าข้อมูลเริ่มต้น`.
On the current Nakhon routes persona selection does not select another working
product workflow; the route branch wins over the persona-specific branch.
Reset calls the legacy local-state reset directly without a confirmation and
does not reset the Supabase archive or saved workspaces. Its broad label is
therefore especially confusing now that the app has real database persistence.

Owners: [menu](../src/AuthenticatedApp.tsx#L278),
[route precedence](../src/AuthenticatedApp.tsx#L512),
[reset implementation](../src/store.tsx#L249).

Recommendation: hide demo-only actions in production, or replace them with a
precisely scoped preference reset if required. Display personas are not an RLS
bypass or real authorization roles; do not conflate this UX issue with security.

## Secondary Clarity Issues / P3

- Home displays red numbered entries although all entries have the same high
  risk category and are sorted by administrative code. Desktop CSS hides the
  sentence explaining this; mobile shows it. Avoid implying an urgency ranking
  that is not calculated. Owners: `ProvinceForecastOverview.tsx:60`,
  `home-overview.css:56`.
- Month and horizon choices are repeated at several levels. Their synchronization
  is useful, but the single-tambon view could be simpler without losing either
  choice. Treat this as density/interaction design, not a data defect.
- Issue/reference months still follow the documented product convention while
  the workbook time role is unconfirmed. Do not present derived dates as newly
  independently verified issue dates. See `SUPABASE_DATA_MIGRATION.md:40`.

## What Is Working

- Main forecast summaries use scoped admin codes: one tambon, its district's
  tambons, or the whole province. No 289-tambon total leaked into the checked
  single-tambon KPI; the visible problem is the aggregate presentation.
- Home filtered to Dan Khun Thot shows 6 in scope / 16 total, not province totals;
  the bookmarks dialog identifies the same district.
- Selected target and horizon survive the checked drilldowns and the self-link.
- Single-tambon population trend chart is already removed; it was not restored.
- Map out-of-scope hatching and explicit out-of-scope KPI are correct in the
  reproduced cases. Their contradictory green chart/attention copy is F01.
- No horizontal overflow in the checked desktop Home or mobile tambon state.
- Main production uses the already verified database archive. This audit did
  not find a new forecast source, restore ThaiWater or alter archived values.

## Recommended Fix Sequence

1. Semantic data states: F01/F02/F04/F05. Test all-null, mixed scope, genuine
   zero, exact half, missing row and all horizons of one fixed target month.
2. Scope-aware shared composition: F03/F06/F07/F08/F09. Reuse primitives and
   add province/district/single-area variants; do not fork the data calculations.
3. Production-only cleanup: F10 and secondary copy. Retain auth/RLS boundaries,
   bookmark behavior, administrative navigation and the requested hidden designs.

No fixes were applied or published. No full regression suite, migration/import,
load benchmark, real Safari run or new database security audit was run: this
pass targets product semantics. Existing migration integrity evidence is not
being presented as new verification of every UI statement.

## Local Implementation Closeout

F01-F10 implemented on 2026-09-05, after approval to adjust the site:

- F01: trend points retain in-scope/out-of-scope/missing coverage. No risk dots,
  connections or filled segments cross unavailable horizons. All-null series
  show a neutral unavailable state; summary and KPI copy cannot imply no risk.
- F02/F05: fixed-target horizon comparison replaces six-calendar-month claims.
  Count-based half-scope reference includes exactly half, and is distinguished
  from land area, Excel severity and official alerts. Reference months are
  labeled calculated, without changing the existing month convention.
- F03/F04: shared single-tambon variants show one forecast and one evidence
  status, without population counters, repeated summaries or self-links.
  Aggregate coverage counts usable forecasts, not matched null rows.
- F06/F07: empty historical analytics/area facts are not composed into routes;
  designs remain in source. Unavailable quality checks are neutral, and an
  administrative count is no longer labeled assessed agricultural coverage.
- F08: removed the duplicate detail disclosure from every forecast workspace;
  its design remains available in source. Retained risk copy is formalized.
- F09: readiness percentages name the ready category and explicitly refer to
  supporting evidence, not Excel completeness or accuracy.
- F10: account menu retains authenticated identity/logout, hides demo personas
  and local reset. Home replaces numbered high-risk ranks with area icons;
  sorting stays administrative-code order, with mobile/expanded context.

### Verification

- `npm test`: 228 passed across 25 files. Coverage includes all 24,384
  district/target/horizon combinations, actual zero, null, missing, mixed
  coverage, exact half, unavailable chart gaps, single-area states and readiness.
- `npm run build`: passed. Existing large-chunk advisory remains; no new
  bundling, protection or deployment changes were requested.
- Full built-browser regression: 68 passed / 10 conditional skips. Four skipped
  database cases ran separately below; other skips concern legacy national-map
  flows and device-specific tests.
- Database-mode browser regression: 4 passed using isolated mocked Supabase
  responses, including bookmark save/restore/reload and no-static-fallback error
  recovery. No production writes were made by this harness.
- Final built shared-workspace regression: 12 passed after DOM reading-order
  and mobile single-card width fixes. This specifically caught CSS minification
  raising a grouped selector's specificity; the regression now asserts the
  single card spans its full container width in the built artifact.
- Read-only authenticated local preview against actual Supabase: Ban Lueam
  Dec-2025/T+1 shows unavailable with 0/4 in scope; Ban Kao Dec-2025/T+4 shows
  high risk; province T+4 has 4 no-risk, 56 moderate and 82 high. No browser
  warnings/errors in the checked session. No data were edited.
- `git diff --check` passed; `src/data` and `supabase` have no diff, including
  generated archive projections. This is not a new remote full-table audit.
- Fresh Chromium full-page evidence from the final local static build using
  canonical archive data and a mocked login:
  `tmp-snapshots/semantic-final/drought-workspace-compact--2a9cc--map-through-readiness-mode-mobile/subdistrict-without-count-trend.png`
  (390x844, Ban Kao Dec-2025/T+4), and
  `tmp-snapshots/semantic-final/drought-workspace-all-null-593bd-never-a-green-zero-forecast-desktop/all-null-district.png`
  (1440x960, Ban Lueam Dec-2025/T+1).
- Responsive layout checks include 390, 768, 1024, 1440, 1448 and 1586px widths.
  In-app browser checks supplemented these against actual database responses.

Not run: new migration/import, full remote integrity scan, security/RLS audit,
physical mobile/Safari QA, protected release builds, CI, push or deploy.
Production remains unchanged. Local database preview: http://127.0.0.1:5176.
