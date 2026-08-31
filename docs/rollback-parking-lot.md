# Rollback Parking Lot

Current Korat Tan Phai bootstrap status: no unresolved rollback parking-lot item
blocks this Nakhon Ratchasima-only release. The note below is retained as
upstream provenance from the source project snapshot.

## 2026-08-30 17:22 +07:00 — Nakhon Ratchasima Mapping Cleanup

- Request: remove obsolete or confusing old code/data names that could make
  future work confuse local names with the province hierarchy.
- Checkpoint: `/tmp/codex-rollback-checkpoints/Kaset-Tan-Phai-20260830-172203/`
- Scope being cleaned from live source:
  - legacy `korat-*` layer IDs, class names, data attributes, tests, and source
    IDs owned by this project;
  - scattered app route checks now replaced by the route resolver in
    `src/domain.ts`;
  - stale docs suggesting legacy selectors or local nicknames are acceptable as
    province-level naming.
- Kept intentionally:
  - the real `ตำบลโคราช` administrative record under district code `3018`;
  - the official `koratpao.go.th` source URL because it is the publisher URL;
  - existing nationwide routes, workflows, source provenance classes, and the
    `TH-P29` canonical province object.
- Restore checklist:
  - apply `git-diff.patch` from the checkpoint if this cleanup needs to be
    reversed;
  - restore untracked source files from `untracked/`;
  - rerun `git diff --check`, `npm test`, `npm run build`, and route snapshots.
