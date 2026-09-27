# Korat web surface theme

## Design contract

The owner's 2026-09-27 reference establishes forest green, warm ivory, restrained
gold accents, botanical rice details and a softly painted agricultural landscape.
The owner explicitly prohibited changing component layout or size. The reference's
outer masthead, device frame and alternate mobile arrangement are therefore not
added to the product. Existing page composition and real content remain in place.

- One owner: `src/brand-theme.css`, loaded by `src/main.tsx`.
- Shared consumers: app/startup shell, navigation, page headings, page filters,
  `AppSelect`, account/bookmark controls, forecast summary cards, map tools,
  horizon/chart view controls, body/fullscreen dialog portals and the login surface.
- Rules change only paint: color, background, border color, shadow and decoration.
  No width, height, padding, margin, gap, grid, order, font size or line-height
  overrides. No new DOM wrappers, focus targets, interactions or data sources.
- New surfaces should use the existing semantic component and the corresponding
  `--brand-*` roles. Add a paint selector here only for a genuinely new owner.
  Do not copy route-specific theme rules into each page.
- Forecast map fills, chart risk colors, missing/out-of-scope semantics, original
  corporate-identity tokens, logo artwork and fonts are unchanged. Native styling
  is outside this web-only decoration change.
- Background art is decorative and does not intercept input or convey a status.
  Solid colors remain readable if the illustration fails to load.

## Illustration provenance

Asset: `public/brand/korat-rice-landscape.webp`, 1536 × 1024, 118,484 bytes.
Created using the built-in `image_gen` tool, then encoded as WebP quality 80.
The same file is cached and reused with CSS crops for the sidebar, page heading,
overview context band, empty-attention surface and login page. It is illustrative
art, not a real location photograph, satellite image or forecast input.

Generation prompt:

> Use case: stylized-concept. Create a production website decorative brand asset,
> NOT a UI mockup. Wide landscape illustration, 1536 x 1024. A refined hand-painted
> Thai agricultural landscape inspired by the Khorat plateau: softly layered
> distant hills, rice fields and scattered indigenous trees, delicate golden rice
> panicles and rich olive-green long leaves framing the bottom left and bottom
> right corners. Elegant botanical engraving meets watercolor, subtle detailed
> paper grain. Restrained forest green, sage, warm ivory #faf7ee and antique gold.
> Morning haze, calm dignified public-service identity, premium but quiet.
> Composition: upper 65 percent is near-empty warm ivory sky with extremely faint
> hill silhouettes; all clearly visible hills, fields and foliage concentrated in
> bottom 35 percent. Rice stems along side edges curl into the lower corners, not
> the center. Richest forest green and gold details at the very bottom edge;
> distant landscape low contrast. This will be reused as a subtle background
> behind text in a data dashboard, so the upper and central areas MUST be very
> quiet. No typography, no logos, no frames, no website controls, no map, no people,
> no watermark.

## Local verification

Evidence: `artifacts/brand-refresh-20260927/`. Authenticated Chrome, Supabase
provider, source December 2025 / T+1; 1440 × 960 and 390 × 844 viewports.
Before disables only the newly added theme module in the same source and state.
After uses the final theme. The mockup is an illustrative direction, not a
pixel-parity target; comparison crops remove its presentation/device framing.

- Overview, province, Soeng Sang district and Bot tambon: 181 visible component
  rectangles compared (x/y/width/height), with no differences over 0.5 CSS px.
  Forecast map fill sets match the baseline across all eight route/viewport pairs.
- Desktop/mobile account menus, search results, dropdowns, analysis, map color
  modes and playback were exercised. Escape restores focus for the inspected
  menus/dialogs; no page errors or horizontal overflow. Additional overflow
  checks at 1024 and 320 px. Decorative art decodes successfully.
- Build and three native brand-parity checks passed. Full unrelated regression
  suites, physical-device checks and production deployment were not performed.
- Current desktop/mobile full-page captures and contextual interaction captures
  were personally inspected; comparisons are saved alongside the evidence.
- One capture attempt encountered an unavailable forecast response; the final
  repeat completed all eight route/viewport pairs with populated data. No loader
  or error-recovery behavior was changed as part of the theme.

The local checkpoint above precedes the production release below.

## Production release (2026-09-27)

Runtime `c03cd7e` on `release/brand-theme-20260927-v2` is deployed at
`https://korattanphai.vercel.app`, artifact
`dpl_9nxHr9FT9iYDkGQSYV95WUmontem`. This adds only the six theme files to
the `e11c59f` production baseline, retaining its already-released Plus Code
feature. UAT/research/API edits and local budget changes remain excluded.

All five [CI jobs](https://github.com/purichw/korattanphai/actions/runs/36317441953)
passed on the exact runtime commit, including protected builds and unchanged
bundle/exposure gates. Candidate and production each passed 39 authenticated
read-only smoke checks and eight route/viewport checks against the preceding
production version: 181 component rectangles and font/padding/gap values match;
map risk fill sets are unchanged. The hosted illustration decodes and its bytes
match the committed asset. Production desktop/mobile captures were inspected.

Evidence: `artifacts/brand-release-20260927/release-v2-state.json`,
`production-v2/` and `comparison-v2-*.png`. Physical-device checks and unrelated
UAT/API integration testing were not run. No database or native changes.
Recovery artifact: `dpl_Aq5RepuAFryPMtc7Taa8zm4owaW6`.
