# Sidebar Account Release

## Scope

Runtime `fea0a2fd849525d513e99eff79a9c2e8762c7197` on
`release/sidebar-account-20260929` moves the existing shared account control to
the bottom of the left sidebar. It has one instance across desktop and mobile,
an upward desktop popup and a mobile account sheet after opening navigation.
Keyboard focus, Escape, outside dismissal and short-screen navigation are covered.

The release starts at the completed CMS checkpoint `9d5b5c9`; only account UI,
its tests and documentation are added. Visitor/Admin session ownership, CMS
references, forecast data, charts and export semantics are unchanged. Unrelated
dirty work in the primary checkout is excluded. No migration, environment change,
account provisioning or application-data write is part of this release.

## Evidence

- TypeScript and `git diff --check` pass; 16 focused desktop/mobile account,
  authentication and separate Admin-session cases pass locally.
- All six [Quality Gate jobs](https://github.com/purichw/korattanphai/actions/runs/36491550106)
  pass on the exact runtime commit, including built browser, CMS/database browser,
  contracts and Firefox/WebKit compatibility. Hosted protected build, exposure
  checks and unchanged bundle budgets pass.
- Candidate passes 39 authenticated read-only smoke checks: province/district/
  tambon, filters, risk values, map/graph behavior, Excel values/charts/PivotTables,
  saved records, logout, assets, overflow and security/cache headers.
- Real-account desktop/mobile sidebar checks pass: one trigger, on-screen popup,
  Escape focus, Admin login still separate, Admin logout leaves visitor session
  usable, and visitor logout completes. No credential storage or tracing.
- Backend manifests confirm `supabase` data and `cms` references with
  `fallback: false`. Production alias was unchanged immediately before promotion.
- Promoted the same Ready candidate, `dpl_8eHZVnwYySq4uUDBgBeiJqk1Abjq`,
  `https://korattanphai-3o1amjxpb-purich-w.vercel.app`, to
  `https://korattanphai.vercel.app` and verified the alias deployment ID.
- Post-promotion smoke passes all 39 checks with zero failures. The focused
  real-account sidebar and separate Admin-session checks also pass on production
  at both viewports. Desktop/mobile production screenshots were visually reviewed.

Ignored evidence lives under `artifacts/sidebar-release/` in the reused release
checkout `artifacts/cms-cutover-20260928/source/`: `tests/`, `candidate-smoke/`,
`candidate-sidebar-ready/`, `production-smoke/` and `production-sidebar/`.
Screenshots are private and
may show the authorized test identity. Physical-device/native checks and a new
full database migration audit were skipped because those surfaces did not change.

## Recovery

Previous production is `dpl_HK4g5ZzWBGwSf8AYoRSgVLhDi2Qz` /
`https://korattanphai-3wlhsnc9s-purich-w.vercel.app` (runtime `2a84a0e`).
If a regression requires recovery, re-promote that known CMS-ready deployment
with owner approval; do not roll back data or remove CMS migrations. A UI release
does not authorize database restoration or edits to the primary dirty checkout.
