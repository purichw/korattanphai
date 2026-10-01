import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHandler } from '../../server/model-inputs/handler.mjs';
import { createFileStore } from '../../server/model-inputs/storage.mjs';
import { runUatCli, uatBaseUrl, verifyModelInputUat } from '../../scripts/test-model-input-uat.mjs';

const writerToken = 'uat-test-writer-not-real-00000000000000000000';
const readerToken = 'uat-test-reader-not-real-00000000000000000000';
const sourceId = 'uat-contract-test';
const baseUrl = 'https://uat-contract.example.invalid';
const config = { baseUrl, writerToken, readerToken, sourceId };
const env = { MODEL_INPUT_UAT_WRITER_TOKEN: writerToken, MODEL_INPUT_UAT_READER_TOKEN: readerToken,
  MODEL_INPUT_UAT_SOURCE_ID: sourceId };

async function fixture() {
  await mkdir('artifacts/model-input-tests', { recursive: true });
  const directory = await mkdtemp('artifacts/model-input-tests/uat-harness-');
  const store = createFileStore(join(directory, 'store'));
  const handler = createHandler({ token: writerToken, readToken: readerToken, sourceId, store, log() {} });
  const calls = [];
  // The real handler/store are exercised in process. No network or remote writes occur.
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, baseUrl);
    assert.equal(options.redirect, 'error');
    calls.push({ method: options.method, query: parsed.search, body: options.body && JSON.parse(options.body) });
    let responseBody;
    const responseHeaders = new Headers();
    const response = { statusCode: 200, setHeader(name, value) { responseHeaders.set(name, value); }, end(value) { responseBody = value; } };
    const requestHeaders = Object.fromEntries(new Headers(options.headers));
    await handler({ method: options.method, url: parsed.pathname + parsed.search, headers: requestHeaders,
      ...(options.body ? { body: JSON.parse(options.body) } : {}) }, response);
    return new Response(responseBody, { status: response.statusCode, headers: responseHeaders });
  };
  return { directory, store, calls, fetchImpl };
}

test('UAT URL validation rejects production aliases, non-HTTPS and credential-bearing/non-origin targets', () => {
  for (const url of ['https://korattanphai.vercel.app', 'https://KORATTANPHAI.vercel.app./',
    'https://www.korattanphai.vercel.app', 'http://uat.example.test', 'https://user:pass@uat.example.test',
    'https://uat.example.test/api/model-inputs', 'https://uat.example.test/?token=secret', 'https://uat.example.test/#secret',
    'https://uat.example.test:444', undefined]) assert.throws(() => uatBaseUrl(url));
  assert.equal(uatBaseUrl('https://uat.example.test/'), 'https://uat.example.test');
});

test('real handler accepts the bounded synthetic flow, preserves values after failures, and never resets storage', async () => {
  const f = await fixture();
  const report = await verifyModelInputUat({ ...config, fetchImpl: f.fetchImpl });
  assert.equal(report.status, 'passed');
  assert.equal(report.checks.length, 11);
  assert.ok(report.checks.every(check => check.passed));
  assert.equal(report.confirmedCreatedBatches, 1);
  assert.equal(report.writeOutcomeUncertain, false);
  assert.equal(report.pagination, 'not_needed_no_next_page');
  const rows = await f.store.list(sourceId, { limit: 10 });
  assert.equal(rows.length, 1);
  const original = await f.store.get(sourceId, report.batchId);
  assert.equal(original.observations[0].value, 0.625);
  assert.equal(original.observations[0].product, 'SYNTHETIC-UAT-NDVI-NOT-OBSERVED');
  assert.ok(f.calls.every(call => ['GET', 'POST'].includes(call.method)));
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 5);
  const text = JSON.stringify(report);
  assert.ok(!text.includes(writerToken) && !text.includes(readerToken));
  assert.ok(!text.includes('observations') && !text.includes('Authorization'));
});

test('a repeated run uses a new batch ID and exercises metadata cursor pagination without extra seed writes', async () => {
  const f = await fixture();
  const first = await verifyModelInputUat({ ...config, fetchImpl: f.fetchImpl });
  const second = await verifyModelInputUat({ ...config, fetchImpl: f.fetchImpl });
  assert.equal(first.status, 'passed'); assert.equal(second.status, 'passed');
  assert.notEqual(first.batchId, second.batchId);
  assert.equal(second.checks.length, 12);
  assert.ok(second.checks.find(check => check.name === 'reader_follows_cursor')?.passed);
  assert.equal((await f.store.list(sourceId, { limit: 10 })).length, 2);
});

test('status-only success with the wrong API error code fails before any write', async () => {
  let count = 0;
  const report = await verifyModelInputUat({ ...config, fetchImpl: async () => {
    count++;
    return new Response(JSON.stringify({ error: { code: 'not_found', message: writerToken } }), {
      status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store',
        'x-request-id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    });
  } });
  assert.equal(report.status, 'failed'); assert.equal(count, 1);
  assert.equal(report.checks[0].code, 'response_contract_mismatch');
  assert.ok(!JSON.stringify(report).includes(writerToken));
});

test('a forged receipt hash is rejected and request/response secrets remain absent from reports', async () => {
  const f = await fixture();
  const report = await verifyModelInputUat({ ...config, fetchImpl: async (...args) => {
    const response = await f.fetchImpl(...args);
    if (response.status !== 201) return response;
    const body = await response.json();
    body.batch.contentHash = '0'.repeat(64);
    return new Response(JSON.stringify(body), { status: 201, headers: response.headers });
  } });
  assert.equal(report.status, 'failed');
  assert.equal(report.checks.at(-1).name, 'synthetic_satellite_created');
  assert.equal(report.checks.at(-1).code, 'response_contract_mismatch');
  assert.equal(report.confirmedCreatedBatches, 0);
  assert.equal(report.writeOutcomeUncertain, true);
  assert.equal((await f.store.list(sourceId, { limit: 10 })).length, 1);
});

test('network failures and redirects fail closed with redacted fixed errors', async () => {
  const network = await verifyModelInputUat({ ...config, fetchImpl: async () => { throw new Error(`${writerToken} ${readerToken}`); } });
  assert.equal(network.checks[0].code, 'request_failed');
  assert.ok(!JSON.stringify(network).includes(writerToken));
  let calls = 0;
  const redirected = await verifyModelInputUat({ ...config, fetchImpl: async () => {
    calls++; return new Response(null, { status: 302, headers: { location: 'https://korattanphai.vercel.app' } });
  } });
  assert.equal(calls, 1); assert.equal(redirected.checks[0].code, 'redirect_rejected');
});

test('CLI reserves output exclusively before HTTP, writes redacted results and refuses duplicate/unknown flags', async () => {
  const f = await fixture();
  const output = join(f.directory, 'report.json');
  const printed = [];
  assert.equal(await runUatCli(['--base-url', baseUrl, '--output', output], env,
    { fetchImpl: f.fetchImpl, print: value => printed.push(value) }), 0);
  const content = await readFile(output, 'utf8');
  assert.equal(JSON.parse(content).status, 'passed');
  assert.equal((await stat(output)).mode & 0o777, 0o600);
  assert.ok(!content.includes(writerToken) && !content.includes(readerToken));
  assert.ok(!printed.join('').includes(writerToken));
  const count = f.calls.length;
  await assert.rejects(runUatCli(['--base-url', baseUrl, '--output', output], env, { fetchImpl: f.fetchImpl }), { code: 'output_unavailable' });
  assert.equal(f.calls.length, count);
  assert.equal(await readFile(output, 'utf8'), content);
  for (const args of [[], ['--base-url', baseUrl], ['--base-url', baseUrl, '--output', output, '--output', output],
    ['--base-url', baseUrl, '--output', output, '--token', writerToken]]) {
    await assert.rejects(runUatCli(args, env, { fetchImpl: f.fetchImpl }), { code: 'invalid_arguments' });
  }
  assert.equal(f.calls.length, count);
});

test('invalid credentials and production URLs prevent both artifact creation and HTTP', async () => {
  const f = await fixture();
  const output = join(f.directory, 'must-not-exist.json');
  await assert.rejects(runUatCli(['--base-url', 'https://korattanphai.vercel.app', '--output', output], env,
    { fetchImpl: f.fetchImpl }), { code: 'production_endpoint_rejected' });
  await assert.rejects(runUatCli(['--base-url', baseUrl, '--output', output], { ...env, MODEL_INPUT_UAT_READER_TOKEN: writerToken },
    { fetchImpl: f.fetchImpl }), { code: 'invalid_uat_credentials' });
  assert.equal(f.calls.length, 0);
  await assert.rejects(stat(output), { code: 'ENOENT' });
  // Existing report content is operator-owned and remains untouched.
  await writeFile(output, 'operator note', { flag: 'wx' });
  await assert.rejects(runUatCli(['--base-url', baseUrl, '--output', output], env,
    { fetchImpl: f.fetchImpl }), { code: 'output_unavailable' });
  assert.equal(await readFile(output, 'utf8'), 'operator note');
});
