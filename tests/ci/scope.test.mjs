import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkDocumentationDiff, collectChangedFiles, findVerifiedBaseline, isDocumentation, isVerifiedBaseline, regressionJobs, selectScope } from '../../scripts/ci-scope.mjs';
import { validateRegressionGate } from '../../scripts/ci-regression-gate.mjs';

const baseSha = 'a'.repeat(40);
const headSha = 'b'.repeat(40);
const repository = 'example/project';
const input = { eventName: 'push', baseSha, headSha, changedFiles: ['docs/RELEASE_RUNBOOK.md'], baselineVerified: true };
const run = { id: 42, run_number: 10, run_attempt: 1, head_sha: baseSha, status: 'completed', conclusion: 'success', path: '.github/workflows/quality.yml', event: 'push', repository: { full_name: repository } };
const jobs = [...regressionJobs, 'regression'].map(name => ({ name, conclusion: 'success' }));
const needs = mode => ({ scope: { result: 'success', outputs: { mode, baseline_run: '42', base_sha: baseSha } }, ...Object.fromEntries(regressionJobs.map(name => [name, { result: mode === 'docs' ? 'skipped' : 'success' }])) });
const baselineApi = (runs = [run], attempt = { total_count: jobs.length, jobs }, current = run) => endpoint => {
  if (endpoint.includes('/workflows/')) return { total_count: runs.length, workflow_runs: runs };
  if (endpoint.includes('/jobs?')) return attempt;
  return current;
};

test('only known internal Markdown paths qualify', () => {
  for (const path of ['README.md', 'PROJECT_MAP.md', 'AGENTS.md', 'docs/nested/a.md']) assert.equal(isDocumentation(path), true, path);
  for (const path of ['src/help.md', 'public/help.md', '.github/workflows/quality.yml', 'package-lock.json', 'docs/example.mjs', 'docs/../src/help.md', 'docs\\a.md', '', null]) assert.equal(isDocumentation(path), false, String(path));
});

test('docs-only push and PR require passing exact-base evidence', () => {
  assert.equal(selectScope(input).mode, 'docs');
  assert.equal(selectScope({ ...input, eventName: 'pull_request' }).mode, 'docs');
  assert.equal(selectScope({ ...input, baselineVerified: false }).mode, 'full');
});

test('manual, empty, unavailable, new-branch, and mixed changes run everything', () => {
  for (const change of [
    { eventName: 'workflow_dispatch' }, { eventName: 'unknown' }, { changedFiles: [] }, { changedFiles: undefined },
    { baseSha: undefined }, { baseSha: '0'.repeat(40) }, { headSha: 'bad' }, { headSha: baseSha },
    { changedFiles: ['README.md', 'src/App.tsx'] }, { changedFiles: ['scripts/ci-scope.mjs'] },
    { changedFiles: ['docs/guide.md', 'tests/example.test.ts'] },
  ]) assert.equal(selectScope({ ...input, ...change }).mode, 'full', JSON.stringify(change));
});

test('renaming runtime code into docs still reports the runtime deletion', () => {
  const directory = mkdtempSync(join(tmpdir(), 'korat-ci-scope-'));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.name', 'CI scope test');
  git('config', 'user.email', 'ci-scope@example.invalid');
  mkdirSync(join(directory, 'src'));
  mkdirSync(join(directory, 'docs'));
  writeFileSync(join(directory, 'src/example.md'), 'runtime input\n');
  git('add', '.');
  git('commit', '-qm', 'initial');
  const before = git('rev-parse', 'HEAD').trim();
  git('mv', 'src/example.md', 'docs/example.md');
  git('commit', '-qm', 'move');
  const after = git('rev-parse', 'HEAD').trim();
  const changedFiles = git('diff', '--no-renames', '--name-only', '-z', before, after).split('\0').filter(Boolean);
  assert.deepEqual(changedFiles, ['docs/example.md', 'src/example.md']);
  assert.equal(selectScope({ ...input, baseSha: before, headSha: after, changedFiles }).mode, 'full');
});

test('baseline requires the exact successful workflow, repository, gate and jobs', () => {
  assert.equal(isVerifiedBaseline(run, jobs, baseSha, repository), true);
  for (const change of [{ head_sha: headSha }, { status: 'in_progress' }, { conclusion: 'failure' }, { event: 'pull_request' }, { path: '.github/workflows/other.yml' }, { repository: { full_name: 'other/repository' } }]) {
    assert.equal(isVerifiedBaseline({ ...run, ...change }, jobs, baseSha, repository), false);
  }
  for (const badJobs of [jobs.slice(1), [...jobs, jobs[0]], jobs.map(job => ({ ...job, conclusion: job.name === 'regression' ? 'skipped' : job.conclusion })), jobs.map(job => ({ ...job, conclusion: job.name === 'built-browser' ? 'cancelled' : job.conclusion }))]) {
    assert.equal(isVerifiedBaseline(run, badJobs, baseSha, repository), false);
  }
});

test('previous verified docs runs remain a valid transitive baseline', () => {
  const docsJobs = [{ name: 'scope', conclusion: 'success' }, ...jobs.map(job => ({ ...job, conclusion: job.name === 'regression' ? 'success' : 'skipped' }))];
  assert.equal(isVerifiedBaseline(run, docsJobs, baseSha, repository), true);
  assert.equal(isVerifiedBaseline(run, docsJobs.slice(1), baseSha, repository), false);
  assert.equal(isVerifiedBaseline(run, docsJobs.map(job => job.name === 'contracts' ? { ...job, conclusion: 'success' } : job), baseSha, repository), false);
});

test('API evidence rejects truncated job lists and missing success', () => {
  assert.equal(findVerifiedBaseline(repository, baseSha, baselineApi()), 42);
  assert.equal(findVerifiedBaseline(repository, baseSha, baselineApi([run], { total_count: jobs.length + 1, jobs })), null);
  assert.equal(findVerifiedBaseline(repository, baseSha, baselineApi([])), null);
  assert.equal(findVerifiedBaseline(repository, baseSha, () => ({ total_count: 2, workflow_runs: [run] })), null);
  assert.equal(findVerifiedBaseline('invalid', baseSha, () => { throw Error('must not call'); }), null);
});

test('newer failed or pending runs supersede older green baselines', () => {
  for (const status of [{ status: 'completed', conclusion: 'failure' }, { status: 'in_progress', conclusion: null }, { status: 'queued', conclusion: null }]) {
    const newer = { ...run, id: 43, run_number: 11, ...status };
    assert.equal(findVerifiedBaseline(repository, baseSha, baselineApi([run, newer])), null);
  }
});

test('latest attempt and a rerun started during evidence collection block stale success', () => {
  const retry = { ...run, run_attempt: 2, status: 'in_progress', conclusion: null };
  assert.equal(findVerifiedBaseline(repository, baseSha, baselineApi([run, retry])), null);
  assert.equal(findVerifiedBaseline(repository, baseSha, baselineApi([run], { total_count: jobs.length, jobs }, retry)), null);
  const failedRetry = { ...retry, status: 'completed', conclusion: 'failure' };
  assert.equal(findVerifiedBaseline(repository, baseSha, baselineApi([run, failedRetry])), null);
  const endpoints = [];
  assert.equal(findVerifiedBaseline(repository, baseSha, endpoint => { endpoints.push(endpoint); return baselineApi()(endpoint); }), 42);
  assert.ok(endpoints.includes('repos/example/project/actions/runs/42/attempts/1/jobs?per_page=100'));
  assert.ok(endpoints.every(endpoint => !endpoint.includes('status=success')));
});

test('PR-only evidence cannot validate the exact tested base revision', () => {
  assert.equal(findVerifiedBaseline(repository, baseSha, baselineApi([{ ...run, event: 'pull_request' }])), null);
});

test('changed-file discovery requires proven ancestry before inspecting paths', () => {
  const calls = [];
  assert.deepEqual(collectChangedFiles(baseSha, headSha, args => { calls.push(args); return args[0] === 'diff' ? 'docs/a.md\0' : ''; }), ['docs/a.md']);
  assert.deepEqual(calls[0], ['merge-base', '--is-ancestor', baseSha, headSha]);
  assert.equal(collectChangedFiles(baseSha, headSha, () => { throw Error('unrelated or shallow history'); }), undefined);
  assert.equal(selectScope({ ...input, changedFiles: undefined }).mode, 'full');
});

test('documentation whitespace errors fail instead of returning a successful scope', () => {
  const directory = mkdtempSync(join(tmpdir(), 'korat-ci-docs-'));
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '-q']);
  git(['config', 'user.name', 'CI scope test']);
  git(['config', 'user.email', 'ci-scope@example.invalid']);
  writeFileSync(join(directory, 'README.md'), 'initial\n');
  git(['add', '.']);
  git(['commit', '-qm', 'initial']);
  const before = git(['rev-parse', 'HEAD']).trim();
  writeFileSync(join(directory, 'README.md'), 'trailing space \n');
  git(['add', '.']);
  git(['commit', '-qm', 'documentation']);
  const after = git(['rev-parse', 'HEAD']).trim();
  assert.deepEqual(collectChangedFiles(before, after, git), ['README.md']);
  assert.throws(() => checkDocumentationDiff(before, after, git));
  assert.doesNotThrow(() => checkDocumentationDiff(before, before, git));
  assert.equal(collectChangedFiles(after, before, git), undefined);
});

test('gate accepts complete full coverage and explicitly verified docs skips', () => {
  assert.equal(validateRegressionGate(needs('full')).ok, true);
  assert.equal(validateRegressionGate(needs('docs')).ok, true);
});

test('gate rejects failed, cancelled, missing and wrongly skipped required jobs', () => {
  for (const mode of ['full', 'docs']) for (const name of regressionJobs) for (const result of ['failure', 'cancelled', undefined, mode === 'full' ? 'skipped' : 'success']) {
    const state = needs(mode);
    state[name].result = result;
    assert.equal(validateRegressionGate(state).ok, false, `${mode}/${name}/${result}`);
  }
});

test('gate rejects scope failure, unknown mode, and missing baseline proof', () => {
  assert.equal(validateRegressionGate({}).ok, false);
  const failedScope = needs('full');
  failedScope.scope.result = 'failure';
  assert.equal(validateRegressionGate(failedScope).ok, false);
  assert.equal(validateRegressionGate(needs('unexpected')).ok, false);
  for (const key of ['base_sha', 'baseline_run']) {
    const state = needs('docs');
    delete state.scope.outputs[key];
    assert.equal(validateRegressionGate(state).ok, false);
  }
});

test('gate rejects unknown required jobs instead of ignoring future coverage', () => {
  assert.equal(validateRegressionGate({ ...needs('full'), 'new-security-job': { result: 'failure' } }).ok, false);
  const state = needs('full');
  delete state.contracts;
  assert.equal(validateRegressionGate(state).ok, false);
});
