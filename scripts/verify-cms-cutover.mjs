import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { prepareReferenceSeed } from './prepare-cms-reference-seed.mjs';

// Production-safe read-only checks. Never publish synthetic test data here.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.equal(url, 'https://dihchjflzhcekywarhxd.supabase.co');
assert.ok(key?.startsWith('sb_publishable_'));
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const client = createClient(url, key, options);
const anonymous = createClient(url, key, options);
const report = { checkedAt: new Date().toISOString(), references: [], denied: [] };
try {
  const { data, error } = await client.auth.signInWithPassword({ email: process.env.SMOKE_AUTH_EMAIL, password: process.env.SMOKE_AUTH_PASSWORD });
  assert.ok(!error && data.session, 'Real account login failed');
  const rpc = async (name, args = {}) => {
    const result = await client.rpc(name, args).abortSignal(AbortSignal.timeout(30000));
    assert.ok(!result.error, `RPC failed: ${name}`); return result.data;
  };
  const heads = await rpc('ktp_cms_reference_catalog');
  const { resources } = await prepareReferenceSeed();
  assert.equal(heads.length, resources.length);
  for (const resource of resources) {
    const head = heads.find(item => item.resource_key === resource.key);
    assert.ok(head, `Missing reference: ${resource.key}`);
    assert.equal(head.original_sha256, resource.hash, `Original hash mismatch: ${resource.key}`);
    const actual = await rpc('ktp_cms_reference_read', { p_id: head.id });
    assert.ok(isDeepStrictEqual(actual, resource.payload), `Payload mismatch: ${resource.key}`);
    report.references.push({ key: resource.key, originalHashMatches: true, allFieldsMatch: true });
  }
  const required = resources.filter(item => item.preload);
  const bundle = await rpc('ktp_cms_reference_bundle', { p_ids: required.map(item => heads.find(head => head.resource_key === item.key).id) });
  assert.equal(Object.keys(bundle).length, required.length);
  for (const resource of required) assert.ok(isDeepStrictEqual(bundle[resource.key], resource.payload), `Bundle mismatch: ${resource.key}`);
  report.bootstrapBundleResources = required.length;
  for (const [name, args] of [['ktp_cms_reference_catalog', {}], ['ktp_cms_reference_read', { p_id: heads[0].id }],
    ['ktp_cms_reference_bundle', { p_ids: [heads[0].id] }]]) {
    assert.ok((await anonymous.rpc(name, args)).error, `Anonymous access allowed: ${name}`);
    report.denied.push(`anonymous:${name}`);
  }
  for (const name of ['ktp_cms_operation', 'ktp_cms_forecast', 'ktp_cms_resource_operation']) {
    assert.ok((await client.rpc(name, { p_actor: data.user.id, p_operation: 'access', p_args: {} })).error, `Browser bypass allowed: ${name}`);
    report.denied.push(`browser:${name}`);
  }
  for (const table of ['ktp_cms_operators', 'ktp_cms_drafts', 'ktp_cms_audit', 'ktp_cms_forecast_publications', 'ktp_cms_resources', 'ktp_cms_resource_audit', 'model_input_batches']) {
    assert.ok((await client.from(table).select('*').limit(1)).error, `Private table exposed: ${table}`);
    report.denied.push(`table:${table}`);
  }
  const output = process.env.CMS_VERIFY_OUTPUT_DIR ?? 'artifacts/cms-verification';
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ references: report.references.length, bootstrap: report.bootstrapBundleResources, denied: report.denied.length, passed: true }));
} finally { await client.auth.signOut({ scope: 'local' }); }
