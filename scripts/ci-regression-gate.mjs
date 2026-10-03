import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { regressionJobs } from './ci-scope.mjs';

export function validateRegressionGate(needs) {
  if (needs?.scope?.result !== 'success') return { ok: false, reason: 'Scope selection did not succeed.' };
  const expectedJobs = ['scope', ...regressionJobs];
  if (Object.keys(needs).length !== expectedJobs.length || !Object.keys(needs).every(name => expectedJobs.includes(name))) {
    return { ok: false, reason: 'Required dependency list is missing or contains an unknown job.' };
  }
  const { mode, baseline_run: baselineRun, base_sha: baseSha } = needs.scope.outputs ?? {};
  if (!['docs', 'full'].includes(mode)) return { ok: false, reason: 'Missing or unknown coverage mode.' };
  if (mode === 'docs' && (!/^[1-9]\d*$/.test(baselineRun ?? '') || !/^[a-f0-9]{40}$/.test(baseSha ?? '') || /^0+$/.test(baseSha))) {
    return { ok: false, reason: 'Documentation scope lacks a verified baseline.' };
  }
  const expected = mode === 'docs' ? 'skipped' : 'success';
  const invalid = regressionJobs.filter(name => needs[name]?.result !== expected);
  if (invalid.length) return { ok: false, reason: `Expected ${expected} for ${mode} scope: ${invalid.join(', ')}.` };
  return { ok: true, reason: mode === 'docs' ? `Documentation-only pass; unchanged runtime inherited from verified base ${baseSha} (run ${baselineRun}).` : 'Every required regression job passed.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateRegressionGate(JSON.parse(process.env.CI_NEEDS ?? '{}'));
  console.log(result.reason);
  process.exitCode = result.ok ? 0 : 1;
}
