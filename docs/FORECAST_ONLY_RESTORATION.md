# Forecast-Only Product Contract

Owner decision, 2026-09-20: restore the forecast website with a new commit and
deploy it. `bcbcd33` was docs-only; selectively undo the live Actual integration
from `8357b02`, not the whole commit. Preserve shared UI fixes and source data.

## Active Routes

- `/`: compact province/district-filtered T+1 forecast overview.
- Home omits `mapLayer`, `target` and `horizon` when displaying the latest
  archive origin at T+1, so the default URL is `/`. Successful legacy default
  links normalize with `replaceState`; other filters and hashes remain intact.
  Historical months and T+2..T+6 keep explicit parameters. A fresh `/` or reload
  resolves the latest published origin, while saved-filter links pin their origin.
  The displayed clean-Home origin is retained in that history entry for bookmarks,
  Excel export and search; explicit URL selections take precedence.
- `/drought`, district and tambon paths: existing six-horizon forecast workspace.
- `target=YYYY-MM` is origin T; `horizon=1..6` is a forward lead time.
  Plain legacy URLs and `mapLayer=forecast-archive` URLs mean the same thing.
- Explicit root T+2..T+6 opens the full workspace and retains `district` scope.
- No origin supplied selects the latest published origin. Retired `period` is
  ignored, never reinterpreted as an origin; canonical forecast URLs remove it.
- Missing origins and invalid horizons show recovery rather than latest/zero data.
- Login, global search, area navigation and saved filters preserve the forecast
  origin/horizon. Existing Supabase Auth/RLS and dataset freshness checks remain.

## Shared UI

Reuse `ProvinceForecastOverview` and `DroughtCompactForecastWorkspace`. Remove
the Actual/Archive banner and return link. Restore page horizon and map month
controls using the existing shared selects and selection state. Keep searchable
dropdowns, charts, selected-month headings, subdistrict layout, empty states,
analysis, reports, Cordia Excel export and map interactions. Forecast provenance
remains `FORECAST_ARCHIVE`, not actual observation `REAL`.

## Parked Work

`OperationalDroughtWorkspace`, `useOperationalContext`, operational policy/model,
metadata API and their unit contracts remain available for future redesign but
are not mounted by the product. Forecast pages make no operational-context request.
This restoration does not create an actual feed, alter rev03 rows, migrate a
database, reset Git history, or include the paused untracked iOS setup.

Recovery and reactivation requirements are in `rollback-parking-lot.md`.
The default-route browser suite remains `e2e/actual-forecast-separation.spec.ts`
for continuity, now asserting forecast-only restoration and legacy compatibility.
Release evidence belongs in `HANDOFF.md`; local tests are not production proof.
