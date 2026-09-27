# โคราชทันภัย Design System

## Brand / Tone / Visual Direction

The UI should feel calm, formal, Thai-first, operational, and trustworthy.

Primary audience:

- Residents who need understandable public risk information.
- Local operators and field teams who need quick action cues.
- Administrators who need review, approval, and publication controls.

Do not make the app feel like a marketing landing page. It is an operational
alert and decision-support prototype.

### Brand Assets

- Primary sidebar lockup: `public/brand/korat-tan-phai-sidebar-logo.webp`
  (`640x585`). `SidebarBrand` owns its responsive presentation. Never stretch,
  crop, recolor or redraw the artwork.
- Compact emblem: `public/brand/korat-tan-phai-emblem.png` (`768x768`), with a
  WebP counterpart. Use it with live brand text when the full lockup is too small.
- Browser favicon: `public/brand/korat-tan-phai-favicon.png` (`512x512`).
- The iOS shell uses the same unmodified Korat emblem. Legacy `kaset-*` files
  are not the current product identity and must not be used in new Korat UI.
- The supplied artwork contains gradients, highlights, and fine raster detail;
  do not auto-trace it to SVG. Re-export from the original design source only if
  a true vector master becomes available.

## Typography

Current font stack is defined in `src/styles.css`:

```css
"Google Sans", "Noto Sans Thai", "Noto Sans", system-ui, -apple-system,
BlinkMacSystemFont, "Segoe UI", sans-serif
```

`index.html` loads Google Fonts for Google Sans.

Rules:

- Visible product UI is Thai-only. Do not add a TH/EN toggle unless the product
  owner explicitly reopens that decision.
- Thai text must be readable without English knowledge.
- English can remain only for necessary codes, source acronyms, URLs, API terms,
  GeoJSON, SMS, LINE, and internal IDs.
- Avoid heavy 800/900 weights for dense Thai UI.
- Avoid viewport-based font scaling.
- Use line height generously for Thai body text.
- Prevent long labels from overflowing cards or panels.

## Color / Tokens

Current CSS custom properties live in `src/styles.css`.

Core roles:

- `--bg`: page background.
- `--surface`: cards/panels.
- `--surface-muted`: quiet nested surface.
- `--ink`: primary text.
- `--muted`: secondary text.
- `--line`, `--line-strong`: borders.
- `--primary`, `--primary-strong`: actions/nav.
- `--teal`, `--amber`, `--red`, `--yellow`: risk and evidence accents.
- `--nr-rain-direct`, `--nr-rain-proxy`: Nakhon Ratchasima rainfall
  layer states for direct station and nearest-station representative context.
- `--green-soft`: low-emphasis status background.
- `--radius`: 8px panel radius.

Severity colors are also defined in `src/components/RiskMap.tsx`.

Do not rely on color alone; always pair severity colors with labels.

## Web And iOS CI

CI means corporate identity here. Web and iOS are the same Korat Tan Phai
product, not separate visual brands. `src/styles.css`, `index.html` and the
current Korat assets are the source of truth; do not introduce a new palette,
typeface or logo for the native app.

- Native semantic colors and typography live in `apps/mobile/src/theme.ts`.
  All current native text and surface styles use these roles. The native
  parity test checks them against the web and compares the emblem file hash.
- Google Sans static regular, semibold and bold faces ship as local app assets
  through `@expo-google-fonts/google-sans`. Do not depend on a runtime Google
  Fonts request. The font package includes its OFL license and Thai glyphs.
- Adapt safe areas, touch targets, text scaling and spacing to iOS; do not
  copy desktop pixel dimensions. Use the same icon meanings and state wording.
- Reuse platform-independent domain logic. Native views cannot reuse DOM
  components directly; share native primitives when real repeated consumers
  exist. Future dropdowns should preserve searchable lists and selection
  behavior while fitting native sheets, keyboard and accessibility.
- Risk colors must come from the actual forecast legend, not generic accent
  tokens. Native forecast views, maps and charts reuse the shared forecast
  domain and preserve missing-data and out-of-study distinctions. Current
  functionality and verification gaps are recorded in
  `apps/mobile/NATIVE_PARITY.md`.

Run `npm run test:brand` in `apps/mobile` with Node 24 and the repository root
dependencies installed whenever web or native CI tokens/assets change. This
guards source drift; Simulator screenshots still verify actual rendering.

## Asset Locations

### Shared web surface theme

`src/brand-theme.css` adds the reference-led ivory, forest-green and antique-gold
surface treatment to the existing web components. It is imported once by
`src/main.tsx`. Use its `--brand-*` roles for decorative surfaces; the original
semantic/risk tokens, font metrics and component geometry remain authoritative.
The shared decorative illustration is `public/brand/korat-rice-landscape.webp`.
It is illustrative brand art, not satellite imagery or evidence of field conditions.
See [surface-theme contract](BRAND_SURFACE_THEME.md) for reuse, asset provenance
and the geometry-preservation verification.

- Static map: `public/geodata/thailand-adm1.geojson`
- Static regional-country underlay:
  `public/geodata/thailand-neighbor-context.geojson`
- Nakhon Ratchasima subdistrict map:
  `public/geodata/nakhon-ratchasima-subdistricts.geojson`
- Nakhon Ratchasima local province outline:
  `public/geodata/nakhon-ratchasima-boundary.geojson`
- Primary product logo and compact emblem: `public/brand/`.
- Icons come from `lucide-react`.
- Screenshots used for handoff should live outside git unless intentionally
  added under a documented snapshots folder.

## Responsive Rules

Current priorities:

- Officer/admin surfaces: desktop-first, dense but readable.
- Farmer/resident alert surface: mobile-first, plain Thai.

Rules:

- No horizontal overflow at 390px mobile width.
- Controls must keep usable touch targets.
- Dense metric grids must collapse before text becomes narrow word columns.
- Map must remain usable on desktop and provide readable selected-area context on
  mobile.
- Nakhon Ratchasima local workspace must stack route controls, hero, map,
  inspector, and evidence cards on mobile before labels become squeezed.
- Rainfall station/proxy panels must fit at 390px without clipped station IDs,
  narrow word columns, or color-only meaning.
- Map zoom and pan must keep Thailand in focus; regional country context should
  stay soft, lightly blurred, and must not compete with Thai province risk
  colors.
- Toasts must not cover primary actions permanently.

## Screenshot QA Expectations

Use `$snapshot` for visible UI work.

Minimum visual evidence for UI changes:

- Desktop around 1440px wide.
- Mobile around 390px wide.
- Affected route/surface.
- Console/network error check when a browser is practical.
- DOM overflow check for pages with dense cards or long Thai copy.

## Do Not Regress UI Decisions

- Thai default and Thai-complete primary UI.
- No visible EN web version.
- Formal public-safety wording.
- Data provenance visible near risk/evidence/model surfaces.
- Layer state must distinguish no data, source unavailable, unsupported layer,
  low risk, and available data.
- No text spilling outside right panels.
- No compressed word-by-word columns in risk or crop detail panels.
- No generic hero/landing page replacing the operational first screen.
- No fabricated official-looking values.
