# Working in Korat Tan Phai

Read [docs/RELEASE_RUNBOOK.md](docs/RELEASE_RUNBOOK.md) for release scope,
production configuration, required gates, and authorization. Preserve unrelated
working-tree changes and use an isolated checkout when the main checkout is dirty.
Confirm the intended source from current Git refs and deployment metadata: the
default branch is not necessarily the current product or workflow source.

## Proportionate verification

- For small copy, Markdown, style, or selector edits, inspect the owner files,
  run `git diff --check`, and use one focused visual check when the change is
  visible. Use the existing product design system.
- For runtime changes, run focused tests covering the changed behavior and its
  direct consumers. Auth, data/CMS, routing, shared configuration, and releases
  require the broader relevant gates.
- Before broad tests, state the depth, evidence needed, stop rule, and checks
  intentionally skipped. Stop once the touched risk has current evidence;
  finish requested docs and publishing work before claiming completion.
- For visible UI/document design, load the user's `ui-ux-expert` skill. Do not
  redesign internal runbooks or copy generic design tokens into this branded app.

## GitHub Actions usage and quality

Use [docs/ACTIONS_USAGE.md](docs/ACTIONS_USAGE.md) for the measured baseline and
scope policy. Keep `regression` as the required Quality Gate result. Its full mode
requires every existing contract, protected-build, database, CMS, and browser job
to succeed. Its docs mode requires proven ancestry, passing latest exact-base
run/attempt evidence, a whitespace-clean docs diff, and intentional skips of all
five heavy jobs. Newer failed or pending baselines supersede older green results;
PR run metadata is not accepted as exact-base evidence. Never treat an unexpected
skip as success.

Only `README.md`, `PROJECT_MAP.md`, `AGENTS.md`, and Markdown under `docs/` may use
the docs fast path. Manual dispatch, workflow/test/script/configuration changes,
unknown paths, incomplete history, or unavailable baseline evidence run full.
Do not add `[skip ci]` to avoid this gate, remove assertions, weaken budgets,
silence authentication failures, or remove browser/backend modes to reduce usage.
When changing scope/gate logic, run `node --test tests/ci/*.test.mjs` and validate
the workflow; verify the exact resulting remote run when publishing is authorized.

Batch known fixes before an authorized push. Track push acceptance, CI, build,
and promotion separately. Investigate causal errors immediately; investigate
delays at the runbook checkpoint using current step/log progress. Do not repeat
pushes or deploys to escape waits. One unchanged diagnostic rerun is allowed only
for an evidenced transient cause; repeated causes require a revised diagnosis.
Do not force-push, cancel unrelated runs, create duplicate deployments, or bypass
required gates. Work only in this chat unless the user explicitly authorizes
specific cross-chat activity.
