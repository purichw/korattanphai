import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const regressionJobs = ['contracts', 'built-browser', 'database-browser', 'cms-browser', 'browser-compatibility'];
const shaPattern = /^[a-f0-9]{40}$/;
const isSha = value => typeof value === 'string' && shaPattern.test(value) && !/^0+$/.test(value);

export function isDocumentation(path) {
  return typeof path === 'string' && !path.includes('\\') && !path.split('/').includes('..') && (
    ['README.md', 'PROJECT_MAP.md', 'AGENTS.md'].includes(path) || /^docs\/.+\.md$/.test(path)
  );
}

export function selectScope({ eventName, baseSha, headSha, changedFiles, baselineVerified = false }) {
  if (!['push', 'pull_request'].includes(eventName)) return { mode: 'full', reason: 'Manual or unknown event requires full coverage.' };
  if (!isSha(baseSha) || !isSha(headSha) || baseSha === headSha) return { mode: 'full', reason: 'No usable comparison revision.' };
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) return { mode: 'full', reason: 'No complete nonempty change list.' };
  if (!changedFiles.every(isDocumentation)) return { mode: 'full', reason: 'Runtime, configuration, test, or unknown paths changed.' };
  if (!baselineVerified) return { mode: 'full', reason: 'Documentation changed, but the exact base has no verified passing Quality Gate.' };
  return { mode: 'docs', reason: 'Only allowlisted Markdown changed after a verified passing Quality Gate.' };
}

export function isVerifiedBaseline(run, jobs, baseSha, repository) {
  if (!isSha(baseSha) || run?.head_sha !== baseSha || run?.status !== 'completed' || run?.conclusion !== 'success' ||
      run?.path !== '.github/workflows/quality.yml' || run?.repository?.full_name !== repository ||
      !['push', 'workflow_dispatch'].includes(run?.event)) return false;
  if (!Array.isArray(jobs) || jobs.length === 0) return false;
  const byName = new Map(jobs.map(job => [job.name, job]));
  // Reject ambiguous/missing metadata. A previous docs pass is safe transitively:
  // its gate required the same exact-base evidence and every heavy job skipped.
  if (byName.size !== jobs.length || byName.get('regression')?.conclusion !== 'success') return false;
  if (regressionJobs.every(name => byName.get(name)?.conclusion === 'success')) return true;
  return byName.get('scope')?.conclusion === 'success' && regressionJobs.every(name => byName.get(name)?.conclusion === 'skipped');
}

export function findVerifiedBaseline(repository, baseSha, api) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '') || !isSha(baseSha)) return null;
  // Never filter to successful runs: a newer failure or unfinished attempt must
  // supersede an older green result. PR runs may test a synthetic merge SHA.
  const result = api(`repos/${repository}/actions/workflows/quality.yml/runs?head_sha=${baseSha}&per_page=100`);
  if (!Array.isArray(result?.workflow_runs) || result.total_count !== result.workflow_runs.length) return null;
  const runs = result.workflow_runs.filter(run => run.head_sha === baseSha && ['push', 'workflow_dispatch'].includes(run.event));
  if (runs.some(run => ![run.id, run.run_number, run.run_attempt].every(value => Number.isSafeInteger(value) && value > 0))) return null;
  const run = runs.sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
  if (!run || run.status !== 'completed' || run.conclusion !== 'success') return null;
  // Bind jobs to this attempt. If rerunning only failed jobs leaves incomplete
  // coverage metadata, use full coverage rather than borrowing an older pass.
  const attempt = api(`repos/${repository}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`);
  if (attempt?.total_count !== attempt?.jobs?.length || !isVerifiedBaseline(run, attempt.jobs, baseSha, repository)) return null;
  // Catch a rerun started while evidence was being fetched.
  const current = api(`repos/${repository}/actions/runs/${run.id}`);
  if (current?.id !== run.id || current?.run_attempt !== run.run_attempt || !isVerifiedBaseline(current, attempt.jobs, baseSha, repository)) return null;
  return run.id;
}

const runGit = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export function collectChangedFiles(baseSha, headSha, git = runGit) {
  if (!isSha(baseSha) || !isSha(headSha)) return undefined;
  try {
    git(['merge-base', '--is-ancestor', baseSha, headSha]);
    // No rename detection: moving runtime code into docs must still include
    // the removed runtime path. Missing/shallow ancestry safely selects full.
    return git(['diff', '--no-renames', '--name-only', '-z', baseSha, headSha]).split('\0').filter(Boolean);
  } catch { return undefined; }
}

export function checkDocumentationDiff(baseSha, headSha, git = runGit) {
  if (!isSha(baseSha) || !isSha(headSha)) throw new Error('Documentation check requires exact revisions.');
  // Called only after docs scope is selected, outside the fallback catch:
  // whitespace errors must fail the scope job, never produce a docs success.
  git(['diff', '--check', baseSha, headSha]);
}

function main() {
  const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
  const eventName = process.env.GITHUB_EVENT_NAME;
  const baseSha = eventName === 'pull_request' ? event.pull_request?.base?.sha : event.before;
  const headSha = process.env.GITHUB_SHA;
  const changedFiles = collectChangedFiles(baseSha, headSha);
  let baselineRun;
  if (selectScope({ eventName, baseSha, headSha, changedFiles, baselineVerified: true }).mode === 'docs') {
    try {
      baselineRun = findVerifiedBaseline(process.env.GITHUB_REPOSITORY, baseSha, endpoint => JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'] })));
    } catch { /* Missing permission, API errors, or incomplete evidence run full. */ }
  }
  const scope = selectScope({ eventName, baseSha, headSha, changedFiles, baselineVerified: Boolean(baselineRun) });
  if (scope.mode === 'docs') checkDocumentationDiff(baseSha, headSha);
  const outputs = { ...scope, base_sha: isSha(baseSha) ? baseSha : '', baseline_run: baselineRun ?? '' };
  console.log(JSON.stringify({ ...outputs, changed_file_count: changedFiles?.length ?? null }));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([name, value]) => `${name}=${value}\n`).join(''));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Quality Gate scope: ${scope.mode}\n\n${scope.reason}\n\nComparison base: ${outputs.base_sha || 'unavailable'}. Verified baseline run: ${baselineRun ?? 'none'}.\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
