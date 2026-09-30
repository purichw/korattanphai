# CMS import control alignment

## Scope

Runtime `69c61db1c4ed230142f38df6e5925ca363b80b2c`, pushed on
`fix/cms-no-code-20260930`, changes only `AdminImport.tsx` and `admin.css`.
File selection and the data-type dropdown share a 44 px height and bottom edge.
The two template downloads have outlined button styling, equal widths and a
centered group; mobile stacks them at full width. Import dropdown values and
options are centered with balanced space for the selected checkmark.

Download links retain their native download semantics. Import parsing, file
contents, validation, draft/publication behavior, authorization and database
contracts are unchanged. The isolated checkout preserves unrelated primary
worktree changes and all previously deployed source.

## Release checkpoint

- Source candidate: <https://korattanphai-pmlcok2rd-purich-w.vercel.app>,
  `dpl_68X1eyYErhBwjmnZupoBwL6nH1Jc`.
- Required CI: <https://github.com/purichw/korattanphai/actions/runs/36700737716>.
- Previous production / recovery: `dpl_Erah1mrD3atdpDNXvcPS3KCDMR4b`,
  runtime `7d5ee90`.
- Promoted on 2026-09-30 after all six exact-source CI jobs and 39 authenticated
  candidate checks passed. The public alias was re-read immediately before
  promotion and verified afterward; its previous deployed source is an ancestor
  of this release.

## Evidence

- Local Chrome desktop/mobile download/import checks pass against the isolated
  test database. The final centering change also passes the desktop journey.
  Both layout screenshots were inspected; no broader local suite was repeated.
- Hosted protected build, exposure and unchanged bundle gates pass. CMS assets
  are 2,110,506 bytes / 618,724 gzip bytes; application gzip is 225,657 bytes.
- The hosted CMS stylesheet contains the centered download group, outlined
  buttons and aligned file control. Read-only authenticated CMS checks confirm
  127 origin months, eight supported views, 45 retained underlying resources
  and accessible drafts. Unauthenticated catalogue access remains HTTP 401.
- Browser smoke uses the repository harness with installed Chrome because the
  matching bundled Playwright browser is unavailable locally. Assertions,
  timeout values and application behavior are unchanged.
- Production read-only CMS checks and byte-identical CSV/XLSX downloads pass.
  The real production Admin session shows a centered download group (0 px
  center offset), outlined download buttons and matching 44 px file/select
  controls with 0 px top/bottom difference. All four dropdown option labels
  are centered. At 390 px, download buttons are 292 px wide / 44 px high with
  no horizontal overflow. No console errors or warnings were observed.
- Production screenshots: `artifacts/release/ui-polish-production-desktop.png`
  and `ui-polish-production-mobile.png`; measurements are in
  `ui-polish-production-layout.json`. Post-promotion checks focus on the changed
  CMS surface; the 39-route/data checks passed on the exact candidate before
  promotion, and the full required suites passed in hosted CI.

Ignored evidence is under `artifacts/release/ui-polish-*`. No application-data
writes, account provisioning, migrations or permission changes are used for
hosted verification. Native and physical-device checks are outside this
two-file web layout change.
