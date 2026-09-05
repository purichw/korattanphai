# Drought Operational Workspace Parity

Local implementation on 2026-09-05, based on commit `2117253` plus this task's
uncommitted changes. No commit, push or production deployment is authorized by
this pass. The older Live Overview ZIP is not an implementation target.

## Evidence And Authority

Mode: image-only visual reference plus the supplied drought SPEC/manifest.
All five current reference files were inspected. The PNGs establish composition,
not data correctness or executable behavior. Reference bitmap dimensions are
1586x992, 1448x1086 and 853x1844; CSS viewport, DPR and capture zoom are unknown.
Desktop comparison uses the two bitmap widths as a practical calibration. Mobile
is an adaptation at 390 CSS pixels, not a claim that 853 bitmap pixels are CSS.

Inputs in `/Users/point/Downloads/`, SHA-256:

| File | SHA-256 |
| --- | --- |
| `Korat_Tan_Phai_Drought_Page_Operational_Workspace_SPEC_v1.md` | `ce9f1c317b556d31734053c154bc87615e90145be7998eecb05de9f67a4abcc7` |
| `Korat_Tan_Phai_Drought_Page_Operational_Workspace_MANIFEST_v1.json` | `57af18ef9fa6f592835764eb18ccc0a6d66f319cb8cf58a535fa026ae900647c` |
| `ChatGPT Image Sep 5, 2026, 01_24_53 PM (1).png` | `efb356200d8597d3966b8cecc3e7a2eacbc3189f3685cb53f2f7cd16950f94ea` |
| `ChatGPT Image Sep 5, 2026, 01_24_53 PM (2).png` | `2f47a8e27c9aa6f523a5132d6100c521a64906f751e44d4632f71d9371321b43` |
| `ChatGPT Image Sep 5, 2026, 01_24_54 PM (3).png` | `174fdf5006add4da5c38a49d94ee2e3fefa8dd5b664d9530468e3011a16a3640` |

## Decisions

These preserve the product contracts discussed before implementation:

- One `DroughtCompactForecastWorkspace` across all three geographic levels.
  Shared header, filters and disclosure shell; stat cards use the existing
  `MetricGrid`/`MetricCard`, dropdowns use `AppSelect`. Descriptions remain
  left-aligned; short stat labels/values and selected dropdown values center.
- The top month now selects the actual forecast target, not an unavailable
  historical observation period. T+ controls the same map, chart point, issue
  month and counts. The map's existing month/status/reset controls are retained.
- Area selection remains route navigation, with target/horizon query retained.
  Subdistrict pages offer sibling selection and return to their district.
  The province back action still opens the existing overview, whose fixed T+1
  contract remains unchanged.
- History, agricultural evidence, readiness and limitations are not deleted.
  They move into shared expandable sections. Empty historical data is explicitly
  unavailable rather than two reassuring zero-count cards.
- Readiness uses the same SVG instance, with an explicit return-to-forecast
  action. Map geometry, hit targets, pan, zoom, preview, fullscreen and admin-code
  joins are retained. Fit zoom may not exceed the shared interaction maximum.
- Desktop map/chart align top and bottom; statistics span their combined width.
  Mobile order is filters, T+, context, all risk counts, coverage, chart, map.
  Tablet portrait stacks readable plots instead of two narrow columns.

## Deliberate Exceptions

- Do not restore ThaiWater, introduce a low-risk class, invent dates/counts,
  reproduce malformed generated geography, or show unavailable source APIs.
- Canonical values remain 0=no risk, 1=moderate, 2=high, null=out of scope.
  Missing joined records are separate. Record coverage is not in-scope coverage.
- T+1 to T+6 are issue vintages for one fixed target month, not a fabricated
  future six-month series. The chart's half-area reference line is not an
  official warning threshold; its colors express count proportion, not the
  forecast risk class of each polygon.
- Risk colors, source text, names and geometry therefore differ materially from
  the illustrative PNGs. Drought and rice are fixed context fields, not fake
  selectors. Mobile does not imitate an OS status bar.
- Map and chart retain a 330px desktop frame to accommodate real month/status
  controls and legend without obscuring geometry. This is taller than the
  roughly 298px frame in reference 1. Exact pixel parity is not claimed.

## Verification

Baseline evidence: `tmp-snapshots/drought-reference-audit-P3GNRq` for province and
`tmp-snapshots/drought-shared-before-TjAgST` for district/subdistrict.
Early and final capture directories are separate; only the latest evidence
listed in HANDOFF is the current implementation.

Acceptance tolerances: map/chart desktop top and height difference <=2 CSS px;
no page-wide horizontal overflow; no KPI horizontal overflow; selected subdistrict
bounds must remain inside the SVG viewport and be visibly nonzero; control
changes must retain exact canonical values and query context. Image ratios and
vertical density are compared approximately because reference DPR is unknown.

Automated coverage lives in `e2e/drought-workspace.spec.ts`, existing app/map,
forecast-loading, forecast-overview and reliability tests, and
`tests/droughtWorkspace.test.tsx` / `tests/forecastModel.test.ts`.
The matrix includes desktop 1440/1448/1586, tablet 1024x768 and 768x1024, and
mobile 390x844 in Chromium. Real Safari and production are intentionally untested.
Stop after these scoped surfaces and preserved root contracts pass; no separate
network benchmark is required because the archive loading/caching contract is
unchanged. Terminal results and final measurements are recorded in HANDOFF.

## Final Local Evidence

Current capture: `tmp-snapshots/drought-parity-accepted-wLeXFO`, produced from
`tmp-snapshots/drought-parity-closeout-build` with target `2025-12`, T+1.
The capture's temporary preview server has been closed; the local development
server remains available at `http://127.0.0.1:5173/drought`.

| Surface | Current Measurement / Result | Reference Comparison |
| --- | --- | --- |
| Desktop shell at 1586px | Sidebar 208px; filters y=140.4px, height 58.6px | Reference 1 sidebar 208px; filters approximately y=135px, height 70px |
| T+ and context | Both y=255.2px, height 64px | Approximately y=264px, height 61px in reference 1 |
| Map and chart | Both y=329.2px, height 330px; alignment delta 0px | Approximately y=338px, height 298px; deliberate control-space exception |
| Shared statistics | Centered text at all nine viewport/route captures; no horizontal scrolling | Requested centered adaptation; real categories retained |
| Mobile order at 390px | Filters, T+, context, four categories, coverage, chart, map | Matches operational sequence; two-column categories preserve readability |
| Scoped geometry | District and selected subdistrict visible within plot; pan/zoom/preview retained | Real canonical geometry replaces illustrative reference geography |
| Secondary content | Five compact desktop entries; expanded details and sources remain available | Compact disclosure follows reference hierarchy without deleting existing evidence |

All nine captures loaded the font and fit the viewport width. Page heights:
1586px province 1,022px; 1448px province/district/subdistrict 1,086px (viewport
height); 1024px tablet 1,392px; 768px tablet 1,795px; 390px province/district/
subdistrict 2,096/2,077/2,137px. No capture page errors or HTTP 4xx/5xx responses.
Fullscreen had a visible 1,002px SVG and exited successfully.

Verification: 60 unit/data tests, protected build and canonical archive checks
passed. All 49 active E2E scenarios passed across the full run and final targeted
rerun; five existing configured skips remain. The only failure in the full run
was compact-map preview containment, fixed and covered by the final 10-case
rerun. This is verified local visual/behavioral adaptation, not pixel-identical
parity or a production release.
