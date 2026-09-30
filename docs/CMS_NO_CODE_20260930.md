# CMS operator clarity — 2026-09-30

Status: local implementation on `fix/cms-no-code-20260930`, based on production
source `7bfeb6d` in an isolated checkout. No production migration, data deletion,
publication, account change or deployment is part of this pass.

The supplied screenshot showed a generic inventory of 45 internal resources,
including retained English-named demo data and empty stubs. The operator's task
is now visible as forecast correction, file import, resume work and inspect
explained real/reference data. The existing Korat brand and shared controls stay.

## Resource decisions

| Resource family | Operator view | Why |
| --- | --- | --- |
| Published forecasts | Primary review/edit workflow | Current source-backed website values |
| Administrative hierarchy | Thai district/tambon table | Used for search, geography and joins |
| Four geometry resources | Named area tables, read-only | Used by the actual map loader |
| Source registry | Thai descriptions with revisioned form editing | Real source references; not live ingestion |
| Rainfall stations and station coverage | Read-only Thai tables | Real locations/proxy metadata; not rainfall observations |
| Duplicated code matrices, derived summaries | Internal runtime only | Not separate operator-owned content |
| Old demos, empty schemas, illustrative content, rev02 | Removed from normal inventory | Not current operational data |
| Exact unpublished cutover verification draft | Omitted from normal work list | Audit artifact, not an operator task |

The complete registry, migrations and data readers are unchanged. Original values,
null semantics, code joins, authorization, publication constraints and history
remain authoritative. Reintroduce an operator view only with a real dataset,
its current consumer/use and a suitable named form; do not re-enable a raw JSON
tree merely because a file is imported somewhere.

## Verification scope

Targeted tests cover curated inventory versus actual source resources, source
row identity, zero/out-of-scope/unresolved forecast cells, import/repair/reload,
conflicts, original retention, accepted payloads, reference publication and
failure without static fallback. Browser checks use an isolated PGlite database
and localhost-only test Auth, never production credentials or writes.

Screenshots under `artifacts/admin-no-code/` show the actual local CMS build at
1440×960 and 390×844. This is fixture-backed UI evidence, not production smoke.
The fixtures seed the real canonical reference payloads and the production SQL
operation code. Whole-site, native and live-feed checks are outside this change.

## Results

- TypeScript and Vite build passed with the CMS/Supabase test configuration.
  This artifact uses localhost test Auth and is not a production deployment.
  The existing large Excel-worker chunk advisory remains; release-budget gates
  were not run because this is an undeployed CMS change.
- Seven presentation tests passed, including actual names from all four geometry
  schemas, preservation of source row identity, and zero/null distinctions.
  Nine existing workbook, normalized-import, unsaved-change and dialog tests
  also passed in the targeted run.
- Seven backend contract/resource tests passed: original retention, revision
  conflicts, permissions, immutable publication and the complete resource set.
- Browser suite: **17 passed, 1 intentionally skipped** across desktop and mobile.
  Map-loader integration runs once on desktop; responsive CMS flows run on both.
  Covered opening references without creating drafts, no-code risk edits with
  reload, source edits/publication, station Excel reimport, original workbook
  conflicts, draft export/acceptance and failure without bundled fallback.
- `git diff --check` passed. No runtime registry, source payload, database
  migration, authentication policy or production record was changed.

## Visual evidence

`artifacts/admin-no-code/before-after.png` compares the supplied 2880×2744 image
with the full local `/admin` page. The supplied image has a different viewport
height and a real account; the local image uses a test staff account and one
forecast origin. It proves the information hierarchy and labels, not production
data parity. Both images preserve their aspect ratios.

`desktop-home.png`, `mobile-home.png`, `desktop-forecast-form.png` and
`mobile-forecast-form.png` were captured from the final built artifact and visually
inspected. Desktop viewport is 1440×960 at DPR 1. Mobile is Chromium Pixel 5 at
390×844 (DPR 2.75), with no page-level horizontal overflow in the exercised flow.
The form screenshots show a selected out-of-scope value before saving; browser
tests separately verify persisted null and zero values. `forecast-forms.png`
presents the desktop and mobile adaptations together.

The work is isolated at
`/Users/point/korattanphai/artifacts/cms-no-code-20260930`; the original checkout's
unrelated changes were preserved. No commit, push or deployment was performed.
