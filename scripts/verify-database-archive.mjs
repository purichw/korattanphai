import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { buildForecastOverviewArchive } from './generate-forecast-summary.mjs';
import { forecastImport, inspectArchive, sha256 } from './lib/forecast-rev03-migration.mjs';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.SMOKE_AUTH_EMAIL;
const password = process.env.SMOKE_AUTH_PASSWORD;
assert.equal(url, `https://${forecastImport.project}.supabase.co`, 'Wrong Supabase project');
assert.ok(key?.startsWith('sb_publishable_') && email && password, 'Supply public configuration and smoke credentials in memory');
const bytes = await fs.readFile('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json');
assert.equal(sha256(bytes), forecastImport.canonicalSha, 'Canonical source changed');
const archive = JSON.parse(bytes);
const expected = inspectArchive(archive);
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const client = createClient(url, key, options);
const anonymous = createClient(url, key, options);
const report = { checkedAt: new Date().toISOString(), project: forecastImport.project, version: forecastImport.version, checks: [], failures: [] };
try {
  const { data: login, error } = await client.auth.signInWithPassword({ email, password });
  assert.ok(!error && login.session, 'Smoke account authentication failed');
  const datasets = await client.from('ktp_forecast_datasets').select('dataset_id,version_label,source_sha256,normalized_sha256,canonical_sha256,status').eq('dataset_id', forecastImport.datasetId);
  assert.ok(!datasets.error, 'Dataset read failed');
  assert.equal(datasets.data.length, 1, 'Unexpected published dataset/source');
  assert.deepEqual(datasets.data[0], {
    dataset_id: forecastImport.datasetId, version_label: forecastImport.version,
    source_sha256: forecastImport.originalSha, normalized_sha256: forecastImport.normalizedSha,
    canonical_sha256: forecastImport.canonicalSha, status: 'published',
  });
  for (const horizons of [1, 6]) {
    const start = performance.now();
    const result = await client.rpc('ktp_load_forecast_archive', { p_version: forecastImport.version, p_horizon_count: horizons }).abortSignal(AbortSignal.timeout(30_000));
    assert.ok(!result.error, `Archive RPC T+${horizons} failed: ${result.error?.code ?? 'unknown'}`);
    assert.ok(isDeepStrictEqual(result.data, horizons === 1 ? buildForecastOverviewArchive(archive) : archive), `RPC T+${horizons} differs from canonical projection`);
    report.checks.push({ horizons, exactProjectionMatch: true, milliseconds: Math.round(performance.now() - start) });
  }
  const revision = await client.rpc('ktp_latest_forecast_revision').abortSignal(AbortSignal.timeout(30_000));
  assert.ok(!revision.error, 'Published revision RPC failed');
  const { publishedAt, ...revisionMeta } = revision.data ?? {};
  assert.ok(Number.isFinite(Date.parse(publishedAt)), 'Published revision must have a publication time');
  assert.deepEqual(revisionMeta, archive.meta, 'Latest published revision differs from the audited source');
  report.checks.push({ latestRevisionMatch: true, publishedAt });
  for (const [area, origin, horizons] of [
    ['30', '2015-06', 1], ['30', '2025-12', 1],
    ['30', '2015-06', 6], ['30', '2025-12', 6],
    ['3008', '2015-06', 6], ['3008', '2025-12', 6],
    ['300806', '2025-12', 6], ['300106', '2025-12', 6], ['301512', '2025-12', 6],
  ]) {
    const args = { p_version: forecastImport.version, p_area_code: area, p_origin_period: origin, p_horizon_count: horizons };
    const start = performance.now();
    const result = await client.rpc('ktp_load_forecast_slice', args).abortSignal(AbortSignal.timeout(30_000));
    assert.ok(!result.error, `Scoped RPC ${area}/${origin}/T+${horizons} failed`);
    const expectedSlice = forecastSlice(horizons === 1 ? buildForecastOverviewArchive(archive) : archive, args);
    assert.deepEqual(result.data, expectedSlice, `Scoped RPC differs from source: ${area}/${origin}/T+${horizons}`);
    report.checks.push({ area, origin, horizons, scopedProjectionMatch: true,
      riskCells: expectedSlice.locations.length * horizons, milliseconds: Math.round(performance.now() - start) });
  }
  for (const [name, args] of [
    ['ktp_latest_forecast_revision', {}],
    ['ktp_load_forecast_slice', { p_version: forecastImport.version, p_area_code: '300806', p_origin_period: '2025-12', p_horizon_count: 6 }],
  ]) {
    const denied = await anonymous.rpc(name, args).abortSignal(AbortSignal.timeout(30_000));
    assert.ok(denied.error, `Anonymous RPC access must be denied: ${name}`);
    report.checks.push({ rpc: name, anonymousAccessDenied: true });
  }
  const denied = await anonymous.rpc('ktp_load_forecast_archive', { p_version: forecastImport.version, p_horizon_count: 6 });
  assert.ok(denied.error, 'Anonymous archive access must be denied');
  for (const table of ['ktp_forecast_values', 'ktp_saved_filters', 'ktp_followed_areas']) {
    const result = await anonymous.from(table).select('*').limit(1);
    assert.ok(result.error, `Anonymous access must be denied: ${table}`);
  }
  report.checks.push({ anonymousAccessDenied: true, ...Object.fromEntries(Object.entries(expected).filter(([key]) => !key.includes('anifest'))) });
} catch (error) {
  let message = error.message;
  for (const secret of [email, password, key].filter(Boolean)) message = message.replaceAll(secret, '[redacted]');
  report.failures.push(message);
  process.exitCode = 1;
} finally {
  await client.auth.signOut({ scope: 'local' });
  const reportDirectory = process.env.DATABASE_VERIFY_OUTPUT_DIR ?? 'smoke-results/database-integrity';
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(`${reportDirectory}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
