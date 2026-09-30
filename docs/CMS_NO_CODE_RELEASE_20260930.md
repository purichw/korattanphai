# No-code CMS and rev3 import release

## Production release checkpoint

The owner authorized push/deploy for this chat only. Runtime source
`7d5ee904c5e2a5b61cf32ea8bad87ec0e02ad1e4` is pushed on
`fix/cms-no-code-20260930`. The isolated checkout is
`artifacts/cms-no-code-20260930`; the unrelated primary checkout was not edited
or staged.

Production changed during preparation. The deployed checkpoints were merged:
`a639f2e` (forecast attention/sidebar/security patch) and `6791d75` (branded page
loading/search), then `d984513` (workspace-access compatibility foundation).
The CMS reference-screen conflict preserves its loading hook
alongside the new Thai read-only tables and explicit editing controls. Other
runtime files match the latest production baseline. There are no API, SQL,
authentication, model, forecast-data or native-app changes in the release diff.

The candidate was created from `git archive` of the committed source, with a
fresh hosted install and production environment. `--prod --skip-domain` leaves
the public alias unchanged:

- Candidate: <https://korattanphai-34eokh15q-purich-w.vercel.app>
- Quality Gate: <https://github.com/purichw/korattanphai/actions/runs/36690289008>
- Previous production / recovery target: `dpl_J95CbHDWJRFS5ada4ja371u2jsdn`,
  <https://korattanphai-5piolegin-purich-w.vercel.app>, source `d984513`.

**Promoted on 2026-09-30.** All six Quality Gate jobs passed on the exact merged
source. The final candidate passed all 39 real-account read-only desktop/mobile
smoke checks, CMS catalogue reads and both template-download checks. The guard
re-read the production alias immediately before promotion and verified that its
source `d984513` was included. The public alias then resolved to the verified
candidate `dpl_Erah1mrD3atdpDNXvcPS3KCDMR4b`. Production then passed all 39
real-account desktop/mobile smoke checks, CMS catalogue reads and exact-byte
CSV/XLSX template downloads. The owner-supplied credentials were used only in
memory, without saving passwords or provisioning accounts.

## Verified evidence

- Hosted protected build, exposure scan and unchanged bundle limits pass.
  CSV/XLS/XLSX share one worker reader; browser-native codepage decoding avoids
  a second ExcelJS copy and the full legacy encoding tables. Unsupported older
  encodings fail with a conversion instruction, without guessing characters.
  CMS assets are 2,109,798 bytes / 618,765 gzip bytes; application gzip is
  226,176 bytes. Database builds contain no static forecast fallback assets.
- 18 import/workbook/normalization unit checks pass after reader consolidation;
  existing XLSX export/import equality is covered. The merged presentation and
  loading tests pass all 10 checks.
- After merging `d984513`, all 69 focused access-policy/provider, CMS presentation
  and file-reader checks pass. The release diff against that deployed baseline
  changes no access, auth, API, model or forecast-data runtime files.
- The final candidate's first smoke stopped after 28 checks when the forecast
  database RPC returned HTTP 500 on mobile. Direct read-only checks of the affected
  district/tambon subsequently returned HTTP 200. A fresh unchanged harness run
  passed all 39 checks; the failed report is retained as `candidate-v6-smoke`,
  and the passing report is `candidate-v6-recheck-smoke`. No assertion or timeout
  was relaxed. The cause of the earlier server error was not established.
- Authenticated candidate CMS reads confirm all 127 origin months, all eight
  supported resource views and preservation of 45 underlying resources. Draft
  listing succeeds; unauthenticated catalogue reads remain HTTP 401.
- Production repeats those CMS checks and all 39 visitor checks successfully,
  including source-matched forecast results, 1,734 province export values and
  36 district export values. The real browser confirms the Thai CMS list and
  import dialog, all 12 field descriptions/examples and both download links.
  Visual proof is `artifacts/release/production-import.png`; no live draft was
  created, edited or published during these checks.
- The hosted reference manifest reports `cms`, `fallback: false`. A request to
  the CMS catalogue without application authentication returns HTTP 401
  `sign_in_required`. The candidate Admin login renders in the real browser.
- The pre-merge CMS CI job passes **29 checks with one intentional mobile map skip**,
  including imports, reference data, independent authentication and database
  page loading. Stale heading assertions were aligned with the new Thai title.
- A local protected mobile acceptance/reload case exhausted its existing time
  limit twice while waiting for fixture data; the same case passed on hosted CI.
  Timeouts and production behavior were not weakened to hide this evidence.
- CI uncovered old shell/loading expectations and two responsive test branches
  that inspected visibility before the branded loading boundary released the
  page. Tests now explicitly wait for visible content; the merged chart test
  retains hidden/inert and chart-height assertions. No assertion timeout,
  retry policy, bundle budget or production behavior was weakened.
- Manual candidate import-dialog inspection confirmed the Thai guide, CSV/XLS/XLSX
  choices and both template links. The optional native file-picker trial was
  stopped when browser use changed; no file or draft was saved. Actual import,
  validation and publication journeys run against the isolated CI database.

Earlier candidates `dpl_4yfdS5G5puMCVmuRPTSk6cDEWwjT` (bundle failure) and
`dpl_FBgyKt8ik3XU9mjvDU231Fs5okgW` (before the newer production merge) are not
release targets. No database writes, account provisioning, migrations or
permission changes were used in this verification.

Ignored logs and test evidence live under `artifacts/release/` in the isolated
checkout, including `production-state.json`, `production-smoke/report.json`,
`production-cms-read.json` and `production-template-check.json`.
No native-app, physical-device or unrelated integration tests were added to
this web/CMS release. See [CMS workflow](CMS_NO_CODE_20260930.md) and
[import contract and templates](CMS_REV3_IMPORT_20260930.md) for product scope.
