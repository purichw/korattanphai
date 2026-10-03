# Legacy cleanup — 3 October 2026

The initial cleanup was verified locally. The owner subsequently authorized
push/deploy; release preparation and final evidence are recorded below. No
database migration or production data mutation is part of this release.

## Scope and recovery

- Worktree: `/Users/point/korattanphai/artifacts/legacy-cleanup-20261003`
- Branch: `fix/legacy-cleanup-20261003`
- Baseline: `ce9d98ba021f087675ce61c8645d30c233472bae`
- Approved proposal: `../legacy-audit-20261003/cleanup-review.md` (relative to
  the worktree directory); user approved deletion explicitly.
- Backup: `/Users/point/korattanphai/artifacts/legacy-audit-20261003/before-cleanup.tar`.
  Captured 613 tracked entries before editing; preserve it for selective recovery.
- Manifest check: 51 deleted paths, zero deletions outside the approved list.
  `OperationalFilters.tsx` was retained and refactored after confirming it is
  used by the current Overview. It now requires real owner-supplied months.

## Result

Removed national/demo risk fixtures, rev02, unused research/station reference
catalogs, hard-coded agency presentation, persona/advisory/task simulation,
the fake risk-fusion API, old map/readiness branches, two obsolete builders and
three old-brand binaries. Dead type, translation and CSS branches were pruned.

CMS startup now accepts only five active resources: administrative hierarchy,
forecast archive summary and three geometry resources. Only the first two are
preloaded. Retired resources are neither seeded nor required at startup. Missing
active resources still fail closed. The Admin API rejects clone/edit/publish for
unknown, retired or read-only resources; original-download/history remains.

Rev03, hierarchy, both generated forecast artifacts and all three active
geometries match the baseline byte-for-byte. Import validation now derives its
289 tambon codes from the genuine hierarchy instead of the removed matrix.

Current preferences contain language/month only. Migration reads only those
supported fields, preserves old raw snapshots and does not persist toast text.
Real Auth, account menus, saved workspaces, forecast selection/export and no-code
CSV/Excel import remain. The map retains geometry, camera, pinch/zoom, labels,
fullscreen, risk/irrigation filters and forecast details.

## Verification

- TypeScript passed; final production-mode protected build passed exposure and
  unchanged bundle-budget gates. No static forecast assets are emitted in the
  database build. Log: `../legacy-audit-20261003/final-build.log`.
- Unit run: 459 passed, one exhaustive forecast-coverage test hit its unchanged
  five-second limit while other work ran. Isolated rerun passed unchanged with
  map interaction checks (32 tests, 4.35 seconds for the two suites). Additional
  focused data/bootstrap/geometry, preferences and parked-agriculture tests passed.
- Backend resource authorization/history and hierarchy-based ingestion contract
  tests passed; no remote database was used.
- 18 desktop/mobile Overview, account and login/storage recovery scenarios passed.
- Built CMS preview: 23 Admin scenarios passed; one duplicate mobile loader test
  is intentionally skipped by its existing configuration. Covers catalog/detail,
  retained history, actual drafts, CSV/Excel workflows, resume and alignment.
- Six built-preview map label scenarios passed across province/district/tambon,
  desktop/mobile. Final mobile province zoom/pinch check passed again after the
  final CSS build. Real published-data fixtures drive these tests.
- Initial browser attempt used incompatible static tests against a CMS-only
  dev server. After diagnosis they ran against their intended static fixture.
  Two Admin Excel attempts were interrupted by dev-server reloads from generated
  trace HTML; both passed unchanged on the stable built preview. No assertions,
  timeouts or production guards were weakened.
- CSS AST comparison found zero declaration changes for retained selectors;
  cleanup removes only obsolete branches and preserves parked component styles.
- `git diff --check` passed. No unrelated checkout files were edited.

Evidence directory:
`/Users/point/korattanphai/artifacts/legacy-audit-20261003/`.
Browser screenshots are local preview with isolated test accounts and data,
not production screenshots. Native builds, remote CI and production smoke were
not run because this approved step is local cleanup only.

Final images: `qa-admin-final/desktop-admin-final.png` and
`qa-admin-final/mobile-admin-final.png` in the evidence directory. The adjacent
`report.json` records desktop 1440×960, mobile 390×844, no overflow/page errors,
and final build index SHA256
`b84cac1b96f4c96ed3e9329eb593a26fc51916919135af0d416024b1aefea869`.
Final mobile map labels are in `qa-final-map/`; six-scope/device label checks
are in `qa-map-labels/`. Independent review found no actionable regression and
confirmed all 289 geometry-to-hierarchy joins without missing identities.

## Intentional retained items

- Valid schema/admin codes, risk 0/1/2/null, horizon 1–6, source hashes and genuine
  geometry are domain contracts, not fabricated business data.
- Spreadsheet sample values/descriptions and old Excel codepages are required
  by the import workflow. Isolated test fixtures and the local ingestion demo
  are test tooling, never runtime fallback data.
- Old URL aliases, old-login cleanup, provenance guards and the disabled static
  archive alias preserve compatibility/security and fail-closed behavior.
- Parked Actual and generic REAL-only agriculture components remain by prior
  user direction; they are not attached to removed catalogs.
- The exact migration-verification draft suppression remains until a separately
  reviewed archival policy handles that real stored record. This cleanup does
  not delete users' drafts, published rows, originals or audit history.

See `rollback-parking-lot.md` for selective restore instructions. Do not extract
the checkpoint over current work or restore synthetic data to the public UI.

## Release preparation

- Full unit rerun passed: 48 files, 460 tests, with unchanged limits.
- Preserved production runtime `3df31e873d2eb7476fa0be5df78630230580acf5`
  (unified Admin area registry and map) by merging it before release.
  Both active catalog groups remain; removed agency-reference sources stay absent.
- Post-merge protected build, exposure and unchanged bundle budgets passed.
  Area/dialog/CMS units passed (17 tests), presentation units passed (8 tests),
  and 12 built Admin scenarios passed across desktop/mobile.
- Both server functions now package `admin_hierarchy.json`, matching their
  hierarchy-based validation contract. The obsolete matrix is not packaged.
- Production candidate, exact-SHA CI, read-only hosted checks and promotion
  remain required before this release is reported complete.
