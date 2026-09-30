# No-code CMS and rev3 import release

## Candidate checkpoint

The owner authorized push/deploy for this chat only. Runtime source
`4e7cd59953c745cbe33f3fe55a76ececea851e74` is pushed on
`fix/cms-no-code-20260930`. The isolated checkout is
`artifacts/cms-no-code-20260930`; the unrelated primary checkout was not edited
or staged.

Production changed during preparation. Both deployed checkpoints were merged:
`a639f2e` (forecast attention/sidebar/security patch) and `6791d75` (branded page
loading/search). The CMS reference-screen conflict preserves its loading hook
alongside the new Thai read-only tables and explicit editing controls. Other
runtime files match the latest production baseline. There are no API, SQL,
authentication, model, forecast-data or native-app changes in the release diff.

The candidate was created from `git archive` of the committed source, with a
fresh hosted install and production environment. `--prod --skip-domain` leaves
the public alias unchanged:

- Candidate: <https://korattanphai-gzwji2mgk-purich-w.vercel.app>
- Deployment: `dpl_GUfeoxsq9QVuw9qegaBWG6xAHQ9C` (Ready)
- Quality Gate: <https://github.com/purichw/korattanphai/actions/runs/36683128183>
- Previous production observed: `dpl_F2bJGovU3aK6bPhWx8832UDcErvo`,
  <https://korattanphai-kkqx2w3wq-purich-w.vercel.app>, source `6791d75`.

**Not promoted.** CMS/browser compatibility/contracts CI jobs pass; built-browser,
database-browser and the final regression gate remain pending at this checkpoint.
Authenticated candidate verification is waiting for the owner to sign in on the
candidate above; no smoke credentials were available in this chat. Required CI
and authenticated candidate verification must complete before promotion.
Re-read the production alias immediately beforehand;
if it changed again, merge the deployed source and verify the resulting candidate.

## Verified evidence

- Hosted protected build, exposure scan and unchanged bundle limits pass.
  CSV/XLS/XLSX share one worker reader; browser-native codepage decoding avoids
  a second ExcelJS copy and the full legacy encoding tables. Unsupported older
  encodings fail with a conversion instruction, without guessing characters.
- 18 import/workbook/normalization unit checks pass after reader consolidation;
  existing XLSX export/import equality is covered. The merged presentation and
  loading tests pass all 10 checks.
- The hosted reference manifest reports `cms`, `fallback: false`. A request to
  the CMS catalogue without application authentication returns HTTP 401
  `sign_in_required`. The candidate Admin login renders in the real browser.
- The final CMS CI job passes **29 checks with one intentional mobile map skip**,
  including imports, reference data, independent authentication and database
  page loading. Stale heading assertions were aligned with the new Thai title.
- A local protected mobile acceptance/reload case exhausted its existing time
  limit twice while waiting for fixture data; the same case passed on hosted CI.
  Timeouts and production behavior were not weakened to hide this evidence.

Earlier candidates `dpl_4yfdS5G5puMCVmuRPTSk6cDEWwjT` (bundle failure) and
`dpl_FBgyKt8ik3XU9mjvDU231Fs5okgW` (before the newer production merge) are not
release targets. No database writes, account provisioning, migrations or
permission changes were used in this verification.

Ignored logs and test evidence live under `artifacts/release/` in the isolated
checkout. See [CMS workflow](CMS_NO_CODE_20260930.md) and
[import contract and templates](CMS_REV3_IMPORT_20260930.md) for product scope.
