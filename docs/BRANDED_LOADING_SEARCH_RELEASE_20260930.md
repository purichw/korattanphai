# Branded Loading And Search Release

## Scope And Source

- Branch: `feature/branded-page-loading`.
- Runtime source: `6791d751e233e24189d769a1a22758e521c4d002`.
- CI source: `45f828b40eb4784062e87cfe395bcf3e4a922abc`. The diff from runtime
  is limited to three E2E test files and the handoff; application code, assets,
  dependencies and build configuration are identical.
- Visitor and Admin share the branded, indeterminate full-page loading state.
  Initial blocking reads keep incomplete content mounted but hidden and inert.
  Errors release into retry UI; cached updates, optional map context and CMS
  mutations do not block the whole page.
- Global search moves from primary navigation to the upper-right toolbar beside
  bookmarks. It reuses the green primary button, aligned 44px controls and a
  compact mobile icon. Account remains at the sidebar footer.
- No database migration, application-data write, auth policy/configuration
  change, native change or unfinished primary-checkout work is included.

## Preservation Guard

Production advanced during candidate verification. The exact deployed baseline,
`a639f2e405b29c03331060ea9802ac8b7cca75b4`, was merged without rewriting either
branch. Its scoped risk-attention lists, Admin sidebar sizing and removed
management navigation entry are preserved. The initial `0c7a031` candidate is
superseded and must not be promoted.

Before promotion the guard verified all six CI jobs passed on the pushed head,
runtime equality with the tested candidate, clean Git status, ancestry from the
latest production source, and the unchanged canonical production deployment ID
`dpl_F2n7g7EzjBxhXWbvovB2FeSKieJC`. No force push or primary-checkout edit was used.

## Verification

- TypeScript, 363 unit tests, focused static/CMS/browser checks, production
  dependency audit, protected build, exposure checks and existing bundle budgets
  pass. The final six targeted shell/chart cases also pass on desktop/mobile.
- All six [Quality Gate jobs](https://github.com/purichw/korattanphai/actions/runs/36680127202)
  pass, including built browser, database browser, CMS browser, contracts and
  Firefox/WebKit compatibility.
- Candidate passes all 39 authenticated read-only smoke checks, including source
  values, scoped maps, graphs, Excel charts/PivotTables, filters, bookmarks and
  logout. Backend manifests identify Supabase data and CMS references with
  `fallback: false`.
- Real-account candidate and production checks pass at 1440x960 and 390x844:
  initial bootstrap/forecast/Admin loading, hidden/inert unfinished content,
  reduced motion, green search/bookmark alignment, search focus/Escape return,
  independent Admin login, retained risk lists/sidebar sizing, overflow, and
  console/network health. Production screenshots were visually reviewed.
- Full post-promotion smoke passes all 39 checks with zero failures. Desktop
  province export verifies 1,734 forecast values across 289 tambons; mobile
  district export verifies 36 values across six tambons. Both retain native
  Excel charts and PivotTables. No application data was written.

## Deployment And Evidence

Promoted the same tested Ready candidate, `dpl_F2bJGovU3aK6bPhWx8832UDcErvo`,
`https://korattanphai-kkqx2w3wq-purich-w.vercel.app`, to
`https://korattanphai.vercel.app`. Post-promotion inspection confirms the canonical
alias points to that deployment ID.

Ignored evidence is under `artifacts/branded-loading-release/` in the isolated
release checkout `artifacts/cms-cutover-20260928/source/`: `candidate-v2-smoke/`,
`candidate-v2-loading/`, `shell-tests/`, `chart-loading-tests/`,
`production-loading/` and `production-smoke/`. Credentials were supplied only
through environment variables; no authenticated storage state or trace was saved.
Screenshots may show the authorized test identity and remain outside Git.

Native/device checks, CMS mutation exercises and a fresh migration audit were
not repeated because those surfaces did not change. The read-only production
checks do not authorize data writes.

## Recovery

Previous production is `dpl_F2n7g7EzjBxhXWbvovB2FeSKieJC` /
`https://korattanphai-31cwiieez-purich-w.vercel.app`, runtime `a639f2e`.
If recovery is needed, obtain owner approval to re-promote that deployment, then
verify the canonical alias and repeat smoke. Do not restore an older sidebar/CMS
deployment, revert another release, roll back data or edit the primary checkout.
