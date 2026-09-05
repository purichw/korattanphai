# Home Overview v4

## Scope And Evidence

Local implementation of `/`, following the two Homepage Live Overview Interaction
v4 documents and three PNGs supplied on 2026-09-05. Earlier Live Overview ZIPs
are not authoritative. Image-only visual reference with written interaction
requirements; no executable prototype, CSS viewport, DPR or browser zoom supplied.
No commit, push or deployment in this task.

Reference filenames in `/Users/point/Downloads/`:
- `Korat_Tan_Phai_Homepage_Live_Overview_Interaction_MANIFEST_v4.json`
- `Korat_Tan_Phai_Homepage_Live_Overview_Interaction_SPEC_v4 (1).md`
- `ChatGPT Image Sep 5, 2026, 01_51_48 PM (1).png`: desktop, 1586x992.
- `ChatGPT Image Sep 5, 2026, 01_51_48 PM (2).png`: tablet-like, 1448x1086,
  including simulated OS chrome which is not product UI.
- `ChatGPT Image Sep 5, 2026, 01_51_49 PM (3).png`: mobile, 863x1822,
  content approximately x=77..785. CSS width unknown; adapt at 390px.

All supplied text and images inspected before edits. Baseline screenshots:
`tmp-snapshots/home-v4-before-1bg388`, local development source including the
previous drought task's uncommitted changes. Desktop page height 1476px at
1586x992; mobile 2399px at 390x844.

SHA-256 identities (manifest, spec, desktop, tablet, mobile respectively):
```text
eb1520f7f98ee06a562477674dddc71031cc6d8440588ecaccb1aee73cc0d409
9899bbda399ba3a871ebbe1563185ca9dacb0af898ea7175c76bcc95d278f3c7
b394684f085acafbd136c986b2b53cd3d44cc98a21ddb1ca33925b7d58b82456
c9cba43785df8dfd9e2149e4ec2d40d4f4c8b48632449bc8fff58ce3c535daa4
e860b0b57674ef9b50a4722f71149c217087ee2e3c758a791733d7bb167b5a1f
```

## Component / Decision Ledger

| Surface | Decision / Ownership | Verification |
| --- | --- | --- |
| Shell / identity | Adopt compact reference proportions, retain existing logo, Google Sans, account and navigation | Desktop/tablet/mobile captures, menu and account checks |
| Filters | Extend existing OperationalFilters with an opt-in compact variant; AppSelect, fixed drought/rice and T+1, mobile edit sheet | Month/district, reload, Escape/focus, wheel isolation |
| Situation strip | Read-only MetricGrid with real forecast status and separately identified agriculture context | No navigation controls, no invented live timestamp/confidence |
| Map + situation panel | Existing shared local SVG, real counts and 3 high-risk items, equal-height desktop frame | Geometry, pan/zoom/selection, no forced navigation, counts |
| All high-risk areas | In-place disclosure retaining every area link, sorted by existing administrative code | Expand/collapse, last item reachable, no navigation on expansion |
| Agriculture | Existing MetricGrid facts with optional expandable details | Values/provenance unchanged, no false district breakdown |
| Readiness | Existing calculation/gauge with headline and expandable breakdown/map action | Readiness never interpreted as severity, same map with explicit return |
| Archive | Compact real link to `/drought`; scoped detail link retains selected target/T+1 | Navigation and archive lazy loading |
| Sources / limitations | In-place disclosure, no new policy/contact destination invented | Reachable keyboard and mobile |

Visual anchor measurements from image 1 (approximate image pixels): sidebar213;
main x238; filter y111/h65; situation y190/h87; map+panel y291/h463;
map width815 and panel width498; bottom support y768/h167. These are provisional
calibration landmarks, not recovered CSS. Tolerances: desktop map/panel top and
bottom within2px; main landmarks within~30px where real content permits; no
horizontal page/KPI overflow; controls and selected features inside map bounds.

## Preserved Contracts / Exceptions

- Home still uses the lightweight T+1 archive, not the full T+1-T+6 download.
  Real archive target/issue month replaces invented live date/time. Archived
  model output is not a current situation report or official warning.
- Exact risk semantics remain 0/1/2/null; missing joined records stay distinct.
  Keep real geography, source provenance and high-risk names instead of image
  examples. No ThaiWater restoration.
- Agricultural rai/confidence are a separate province dataset with its own month
  and provenance, not derived from the forecast or fabricated for a district.
- Mobile screenshot and existing product put counts before map; use that
  observable order. The document's map-first order is a preferred flow, not a
  requirement to discard the supplied mobile arrangement.
- Rice/drought and T+1 are honest fixed context, not fake selectable menus.
  Preserve editable target/district and the shared mobile filter sheet.
- Reference card framing is translated to restrained full-width bands/unframed
  sections; individual metrics and operational map remain framed.
- Written v4 default-readiness headline takes precedence over the images' open
  breakdown. The four unchanged categories are available on expansion. Keep
  their provenance visible even while collapsed.
- Mobile uses readable type and touch targets rather than shrinking the entire
  screenshot to 390px. This increases document height relative to a uniform
  scaling of the framed bitmap; no exact pixel/DPR equivalence is claimed.
- The scale is approximate east-west distance at the visible map center,
  calculated from the existing projection and zoom, not a fixed decorative ruler.
- Unseen hover/focus/loading/error/expanded behavior is product-owned, not
  inferred as no-op. Reference privacy/contact links have no established product
  destinations and are not fabricated.

## Verification / Acceptance Status

Implemented and locally verified on 2026-09-05. No commit, push or deployment.
Current protected build: `tmp-snapshots/home-v4-verified-build`.
Build index SHA-256:
`bfee98193ad4d52ea3718d9d2ce3b524dd5a6130d2e989e0be2e9060c21a3bd1`.
Current screenshots and `metrics.json`: `tmp-snapshots/home-v4-accepted-3eatug`.

Capture conditions: Chromium 151.0.7922.34, DPR1, reduced motion, demo user
`pointy`, target2025-12/T+1, default province scope, forecast map, no selected
area, page at scrollY0. Google Sans and logo loaded in all five viewports.
No page errors, HTTP4xx/5xx responses or horizontal page overflow recorded.
All four summary values measured centered at each viewport.

| Viewport | Current page height | Prior page height | Evidence |
| --- | ---: | ---: | --- |
| Desktop 1586x992 | 1002px | 1476px | `desktop.png`, `comparison-desktop.png` |
| Reference tablet 1448x1086 | 1086px | Not captured | `tablet-reference.png`, `comparison-tablet.png` |
| Landscape tablet 1024x768 | 1194px | Not captured | `tablet-landscape.png` |
| Portrait tablet 768x1024 | 1206px | Not captured | `tablet-portrait.png` |
| Mobile 390x844 | 1799px | 2399px | `mobile.png`, `comparison-mobile.png` |

Measured desktop landmarks: main x230; filters y111.97/h68.48; situation
y192.45/h86; map y290.45/h472/w819.33; side panel w502.66 with the same top and
bottom as the map; support y774.45/h164. These satisfy the calibrated tolerance,
without claiming pixel-exact reproduction of the raster images.

Comparison sheets contain full-page coverage. Desktop columns uniformly scale
to530px and tablet columns to660px. Mobile reference is cropped in image space
to x77..785/y0..1822 and uniformly scaled to390px; before/development use an
actual390px CSS viewport. Reference originals remain untouched. Unknown source
DPR and intentional readable mobile sizing mean these are visual comparisons,
not pixel-difference assertions.

Expanded agriculture/readiness, readiness-map mode, fullscreen and the mobile
filter sheet have separate captures in the same directory. Fullscreen entered
and exited successfully, with a992px SVG filling the viewport. In-place
disclosures retain the URL; selecting readiness reuses the existing SVG map and
provides an explicit return to the forecast layer.

Checks:
- `npm test`: all63 unit/data tests passed across8 files.
- Protected build: TypeScript, Vite, exposure checks, bundle references/budgets
  and canonical archive byte identity passed. Startup107,787gzip bytes; total
  JavaScript2,979,998bytes /328,384gzip bytes. Existing large-chunk warning remains.
- Full protected-build E2E run:53 passed,3 failed,6 configured skips. The failures
  were obsolete assertions for editable hazard/crop and a mobile hydration race
  in test setup; the relevant tests now assert fixed context and wait for the
  filter band. Product selectors and canonical count expectations remain tested.
- Final protected-build focused rerun:25 passed,1 configured skip, covering Home,
  overview loading/failure/retry, custom-dropdown keyboard/wheel behavior and
  province/district/subdistrict drilldown. All56 active scenarios passed across
  the full run and focused rerun, not in a single final full-suite run.
- Six configured skips comprise five existing environment/legacy cases and one
  desktop skip for the mobile-only filter-sheet scenario.

No observed blocker remains in the checked surfaces. Real Safari, production,
new network benchmarks and another full-suite repetition were intentionally
skipped after the highest-risk shared interactions passed. These local results
do not imply a deployment or proof of browser behavior outside Chromium.
