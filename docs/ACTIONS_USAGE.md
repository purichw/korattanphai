# GitHub Actions usage and coverage

## Audit source and measured baseline

The 2026-10-03 review used the latest observed Preview source,
`fix/legacy-cleanup-20261003` at `e9605e7d26e5650fa05be794959f36a41b6546c3`.
That commit changes release documentation and used `[skip ci]`; its parent,
`f1359369c44f49357ad25513d1a6343897bfd9f7`, passed the full
[Quality Gate run 37121917888](https://github.com/purichw/korattanphai/actions/runs/37121917888).
The default `main` branch did not contain these workflow files. The newest
Production deployment reported by that GitHub query was `ce9d98b` on 2026-10-01.
That observation was incomplete: the [handoff](HANDOFF.md) records the later
production verification of `f1359369` at 19:32 Asia/Bangkok on October 3.
Preview source, GitHub Production metadata, and the served production alias
are separate facts; the Actions audit did not revalidate or promote production.

The usage patch was published as `e60716cc816cc28b99dc2f039d7a07404255b8fc` to
the authorized `fix/legacy-cleanup-20261003` branch. It did not merge newer
application changes into `main` or promote a production build. Recheck current
branch and deployment revisions before a future release.

## Verified rollout — 2026-10-03

[Quality Gate 37128487838](https://github.com/purichw/korattanphai/actions/runs/37128487838),
attempt 1, passed on exact `e60716c` in full mode at 14:18:44 UTC. Scope,
contracts, database-browser, built-browser, browser-compatibility, cms-browser
and final `regression` all succeeded. Workflow elapsed time was 12m07s;
summed job time was 32m22s. These are duration measurements, not billing charges.
The automatic [Preview](https://korattanphai-arh6mk5cy-purich-w.vercel.app)
reported success; no production promotion was performed by this Actions work.

Local validation passed 16 selector/gate tests, actionlint and whitespace checks,
and confirmed preservation of the five heavy-job bodies. Hosted docs-mode
selection still awaits a genuine eligible docs push; a passing full run does
not prove that shortcut has executed. The shorter full run cannot be attributed
to a docs-only selector, especially across the private-to-public transition.
Raw receipts are kept in the primary checkout's ignored
`.tools/usage-audit-20261003/` directory.

## Historical usage window

From 2026-09-03 through 2026-10-03 13:34:18 UTC, GitHub returned 288 runs and
690 job records across all attempts. Of these, 520 executed jobs used
**3,396.58 summed job-minutes**. Rounding each executed job up separately gives
an estimate of **3,679 minutes**; this is not an account invoice or a statement
of remaining allowance. Korat was private at baseline collection time and was
subsequently confirmed public through GitHub's repository API on 2026-10-03.
The exact visibility-transition time has not been verified. Current public
visibility does not retroactively classify the historical usage as free or
erase it; a monetary interpretation requires the relevant billing records.

| Workflow | Runs | Executed jobs | Summed job-minutes | Per-job rounded estimate |
| --- | ---: | ---: | ---: | ---: |
| Quality Gate | 117 | 513 | 3,387.02 | 3,668 |
| Deployment Smoke | 171 | 7 | 9.57 | 11 |

Quality Gate accounts for 99.7% of observed job time. Its runs ended in 60
successes, 26 failures, and 31 cancellations. Across all workflows, failed jobs
used 568.33 minutes and cancelled jobs 535.80 minutes; these figures identify
cost concentration, not automatically removable work. Diagnose failures and
batch known fixes before pushing again. The 165 skipped Deployment Smoke events
allocated no runner, so hiding them would not meaningfully save minutes.
September accounts for 2,354 rounded minutes; October through the cutoff adds
1,325. The thirty-day window crosses calendar billing months.

At collection time, 22 active artifacts occupied 1,108,589,425 bytes (about
1.03 GiB), chiefly failure traces retained for seven days. This snapshot is not
storage GB-hours or a billing calculation. Keep these diagnostics; no historical
artifact deletion or reduction in failure evidence is part of this fix.

The latest five successful runs with the same six-job layout were
[37121917888](https://github.com/purichw/korattanphai/actions/runs/37121917888),
[37115361058](https://github.com/purichw/korattanphai/actions/runs/37115361058),
[37113423177](https://github.com/purichw/korattanphai/actions/runs/37113423177),
[36920194740](https://github.com/purichw/korattanphai/actions/runs/36920194740), and
[36915299968](https://github.com/purichw/korattanphai/actions/runs/36915299968).
They averaged **55m 25s summed job time**, ranging from **40m 29s to 66m 55s**,
with an average per-job rounded estimate of 58.4 minutes. Their average job times
were database-browser 23m 33s, built-browser 18m 09s, CMS 8m 05s, contracts 3m 09s,
compatibility 2m 25s, and regression 3s.

The newest full successful run in the pre-change baseline cohort, measured
from job start/end timestamps:

| Job | Runner time | Browser installation | Purpose retained |
| --- | ---: | ---: | --- |
| `built-browser` | 17m 52s | 27s | Protected build, generated-data drift, full Chromium desktop/mobile suite |
| `database-browser` | 12m 24s | 29s | Supabase-mode development browser flows and protected database build |
| `cms-browser` | 5m 40s | 30s | Full archive publication, CMS build, admin/CMS browser contracts |
| `contracts` | 2m 45s | — | Unit, model input, operational, admin, dependency audit, database contracts |
| `browser-compatibility` | 1m 45s | 57s | WebKit mobile and Firefox recovery behavior |
| `regression` | 3s | — | Required final result |

This run used **40m 29s of summed job time** and **18m 02s of workflow elapsed
time**. These are observed durations, not billing totals: account pricing,
rounding, retries, and other workflows affect actual charges. Five `npm ci`
steps together took 33s; four browser installation steps took 2m 23s. Browser
tests dominate this run. The repeated test files exercise different backend,
build, or browser modes and are not interchangeable coverage.

## Implemented scope policy

Every push and pull request still starts `Quality Gate`. A small `scope` job
runs dependency-free selector/gate tests, then chooses one of two modes:

| Mode | Conditions | Required result |
| --- | --- | --- |
| `docs` | Only allowlisted internal Markdown changed after a proven ancestor; the exact base's latest eligible Quality Gate run/attempt passed with verified required jobs, and the docs diff has no whitespace errors | `scope` succeeds, all five heavy jobs intentionally skip, and `regression` verifies the explicit docs mode and baseline ID |
| `full` | Any runtime/configuration/test/workflow/unknown path; manual dispatch; missing/empty comparison; new branch; unavailable API/history; missing passing baseline | All five existing heavy jobs must succeed before `regression` passes |

The allowlist is `README.md`, `PROJECT_MAP.md`, `AGENTS.md`, and `docs/**/*.md`.
Markdown in `src`, `public`, or unknown locations still runs full. Rename
detection is disabled when collecting paths so moving runtime input into docs
cannot hide its deletion. A mixed docs/runtime change runs full.

For pushes, the comparison base is the event's `before` SHA. For pull requests,
it is the PR base SHA, compared with the tested merge revision. The scope job
uses checkout depth 2; if a multi-commit push needs older unavailable history,
or Git cannot prove that the base is an ancestor, it runs full instead of
downloading the entire repository history. Baseline lookup uses read-only
Actions access and examines the latest exact-base push or manual run and its
latest attempt. A newer failed, pending, queued, or cancelled run/attempt blocks
reuse of older green evidence. PR runs are excluded as baselines because their
reported head SHA can differ from the tested merge revision. The lookup verifies
the repository, workflow, successful gate, and every required job for the exact
attempt, then rechecks run state to detect a concurrent rerun. Incomplete API
pages or attempt coverage select full. A previous verified docs
pass may serve as the next baseline, preserving the same runtime evidence
through a chain of documentation changes. Missing or incomplete evidence runs
full. After docs scope is selected, `git diff --check` validates the exact base
and head; whitespace errors fail `scope` and therefore `regression`, rather than
silently succeeding or falling back. The baseline run ID and comparison SHA
appear in the scope job summary. No new Markdown link-lint policy is introduced.

There is no top-level `paths-ignore`, broad `[skip ci]`, skipped required gate,
removed test, relaxed assertion, weaker exposure/bundle budget, or reduced
authentication coverage. Existing job names, events, concurrency, timeouts,
failure artifacts, and full-mode test commands are retained. The new `scope`
job has a separate three-minute limit; the final `regression` job remains one
minute. No cache of credentials, application data, `node_modules`, or browser
binaries was introduced.

A qualifying docs run avoids the five heavy jobs, approximately **55m 22s of
job work** using the five-run mean (40m 26s on the newest run), less the small
scope/gate cost. This is an
estimate per eligible docs run, not a claim about monthly savings. New branches
and docs after an unverified `[skip ci]` revision deliberately run full.
Measure actual scope/gate overhead and docs frequency after rollout.

## Checks and future optimizations

Before publishing CI changes, run:

```bash
node --test tests/ci/*.test.mjs
git diff --check
```

Validate `.github/workflows/quality.yml` with the available YAML/Actions tooling,
inspect the final diff, then verify all full-mode jobs on the exact pushed SHA.
The workflow-changing patch's first hosted run selected `full` and passed,
as recorded above. Future workflow changes must also select `full`.
Verify the next genuine docs-only change uses `docs` with a matching baseline;
do not make an extra push merely to benchmark it. A green workflow with omitted
required work is not evidence unless the scope/gate explicitly verifies docs.

Do not merge builds across the bundled, Supabase, and CMS configurations.
Reusing an artifact is valid only when every build flag and generated output
matches. Current install time is small relative to tests; browser caching or
additional artifact transfer needs measured net benefit before adding cache
storage and invalidation complexity. No open pull requests were observed in the
review, so push/PR deduplication was not introduced without evidence of duplicate
usage, and the thirty-day history contains no duplicate Quality Gate push
groups. Deployment Smoke remains required for production authentication checks;
Preview event skips in that workflow are intentional and consume no smoke job.

## Diagnostic checkpoints

Use the newest 3–5 comparable successes and distinguish summed runner time from
workflow wall time. Inspect elapsed phases beyond
`max(1.5 × normal, normal + 2 minutes)`. Using the five-run job means, investigate
built-browser near 27m, CMS near 12m, contracts near 5m, and compatibility near
4m 30s. The database mean would place this threshold beyond its unchanged 30m
job limit, so inspect progress at 28m before that limit. These are initial
checkpoints, not an SLA; the newest database run was substantially faster.
Use the current step/log timestamps to decide whether work is healthy and
recalibrate when the software or workflow changes. Production smoke has only
one successful comparison (3m 55s), giving a provisional checkpoint near 6m.

Inspect a failed assertion, auth error, wrong SHA, missing required check, or
unexpected cancellation immediately. For no baseline, investigate at 10m; for
a small push with no progress use 2m, a missing expected workflow after push
use 3m, and queued/no-progress work use 5m. Inspect pending promotion 2m after
the exact build and required checks are ready. Read step names, log timestamps,
queue/concurrency state, and first causal errors before calling work stalled.
These are diagnostic triggers, not reasons to increase timeouts, cancel healthy
work, bypass gates, or create another deployment.
