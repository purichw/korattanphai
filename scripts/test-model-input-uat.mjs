import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { hashBatch, SOURCE_ID, validateBatch, validateReceivedAt } from '../server/model-inputs/contract.mjs';
import { isValidToken } from '../server/operations/integration-auth.mjs';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const ERROR_CODES = new Set(['unauthorized', 'forbidden', 'not_found', 'invalid_batch', 'invalid_request',
  'invalid_query', 'batch_conflict', 'storage_unavailable', 'rate_limit_unavailable', 'service_not_configured', 'rate_limit_exceeded']);
const failure = code => Object.assign(new Error(code), { code });
const requireCheck = (condition, code = 'response_contract_mismatch') => { if (!condition) throw failure(code); };
const keys = (value, names) => value && typeof value === 'object' && !Array.isArray(value)
  && isDeepStrictEqual(Object.keys(value).sort(), [...names].sort());

export function uatBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw failure('invalid_base_url'); }
  const hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
  requireCheck(url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash
    && !url.username && !url.password && !url.port, 'invalid_base_url');
  requireCheck(hostname !== 'korattanphai.vercel.app' && hostname !== 'www.korattanphai.vercel.app', 'production_endpoint_rejected');
  return url.origin;
}

function configuration({ baseUrl, writerToken, readerToken, sourceId }) {
  const origin = uatBaseUrl(baseUrl);
  requireCheck(isValidToken(writerToken) && isValidToken(readerToken) && writerToken !== readerToken
    && typeof sourceId === 'string' && SOURCE_ID.test(sourceId), 'invalid_uat_credentials');
  return origin;
}

function metadata(value, sourceId) {
  requireCheck(keys(value, ['sourceId', 'batchId', 'contentHash', 'receivedAt', 'observationCount']));
  requireCheck(value.sourceId === sourceId && typeof value.batchId === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value.batchId)
    && /^[a-f0-9]{64}$/.test(value.contentHash) && Number.isInteger(value.observationCount)
    && value.observationCount >= 1 && value.observationCount <= 2000);
  try { validateReceivedAt(value.receivedAt); } catch { throw failure('response_contract_mismatch'); }
}

/** One new synthetic batch, no deletion, no provider calls, no model execution. */
export async function verifyModelInputUat({ baseUrl, writerToken, readerToken, sourceId, fetchImpl = globalThis.fetch } = {}) {
  const origin = configuration({ baseUrl, writerToken, readerToken, sourceId });
  const runId = randomUUID();
  const batch = validateBatch({ schemaVersion: 1, kind: 'satellite', sourceId, batchId: `uat-smoke-${runId}`,
    observations: [{ subdistrictCode: '300806', period: '2023-05', availableAt: '2023-06-02T00:00:00.000Z',
      metric: 'ndvi', value: 0.625, unit: '1', quality: 'reported', validPixelFraction: 1,
      product: 'SYNTHETIC-UAT-NDVI-NOT-OBSERVED', productVersion: 'demo-v1', processingVersion: 'uat-smoke-v1',
      resolutionMeters: 250, spatialAggregation: 'area_weighted_mean', temporalAggregation: 'mean' }] });
  const expectedHash = hashBatch(batch);
  const report = { schemaVersion: 1, mode: 'synthetic-hosted-v1-uat', baseUrl: origin, sourceId,
    batchId: batch.batchId, startedAt: new Date().toISOString(), completedAt: null,
    status: 'running', confirmedCreatedBatches: 0, writeOutcomeUncertain: false, checks: [] };

  async function check(name, { method = 'GET', token = readerToken, query = '', body, status, errorCode, verify }) {
    const result = { name, passed: false, httpStatus: null };
    report.checks.push(result);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      if (method === 'POST') report.writeOutcomeUncertain = true;
      const response = await fetchImpl(`${origin}/api/model-inputs${query}`, {
        method, redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      result.httpStatus = response.status;
      requireCheck(!response.redirected && (response.status < 300 || response.status >= 400), 'redirect_rejected');
      requireCheck(response.headers.get('content-type')?.toLowerCase().includes('application/json'), 'unexpected_content_type');
      requireCheck(response.headers.get('cache-control')?.includes('no-store'), 'missing_private_response_headers');
      const requestId = response.headers.get('x-request-id');
      requireCheck(typeof requestId === 'string' && /^[a-f0-9-]{36}$/i.test(requestId), 'missing_request_id');
      result.requestId = requestId;
      const length = response.headers.get('content-length');
      requireCheck(length === null || /^\d+$/.test(length) && Number(length) <= MAX_RESPONSE_BYTES, 'response_too_large');
      requireCheck(response.body, 'missing_response_body');
      const reader = response.body.getReader();
      let size = 0; const chunks = [];
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw failure('response_too_large'); }
        chunks.push(next.value);
      }
      let data;
      try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size))); }
      catch { throw failure('invalid_response_json'); }
      if (ERROR_CODES.has(data?.error?.code)) result.apiCode = data.error.code;
      requireCheck(response.status === status, 'unexpected_http_status');
      if (errorCode) requireCheck(keys(data, ['error']) && keys(data.error, ['code', 'message'])
        && data.error.code === errorCode && typeof data.error.message === 'string' && data.error.message.length > 0);
      if (verify) verify(data);
      result.passed = true;
      return data;
    } catch (error) {
      // Never retain exception text, response bodies, headers, or credentials.
      result.code = ['response_contract_mismatch', 'redirect_rejected', 'unexpected_content_type', 'missing_private_response_headers',
        'missing_request_id', 'response_too_large', 'missing_response_body', 'invalid_response_json', 'unexpected_http_status'].includes(error?.code)
        ? error.code : controller.signal.aborted ? 'request_timeout' : 'request_failed';
      throw failure(result.code);
    } finally { clearTimeout(timer); controller.abort(); }
  }

  let receivedAt;
  const readOriginal = data => {
    requireCheck(keys(data, ['schemaVersion', 'sourceId', 'batchId', 'kind', 'observations', 'contentHash', 'receivedAt']));
    const { contentHash, receivedAt: stamp, ...payload } = data;
    requireCheck(isDeepStrictEqual(payload, batch) && contentHash === expectedHash);
    try { validateReceivedAt(stamp); } catch { throw failure('response_contract_mismatch'); }
    requireCheck(receivedAt === undefined || receivedAt === stamp);
    receivedAt = stamp;
    report.writeOutcomeUncertain = false;
  };
  const receipt = created => data => {
    requireCheck(keys(data, ['created', 'batch']) && data.created === created);
    metadata(data.batch, sourceId);
    requireCheck(data.batch.batchId === batch.batchId && data.batch.contentHash === expectedHash && data.batch.observationCount === 1);
    requireCheck(receivedAt === undefined || receivedAt === data.batch.receivedAt);
    receivedAt = data.batch.receivedAt;
  };
  const listing = data => {
    requireCheck(keys(data, ['items', 'nextCursor']) && Array.isArray(data.items) && data.items.length <= 1);
    data.items.forEach(item => metadata(item, sourceId));
    requireCheck(data.nextCursor === null || typeof data.nextCursor === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(data.nextCursor));
    if (data.nextCursor !== null) {
      requireCheck(data.items.length === 1);
      let cursor;
      try { cursor = JSON.parse(Buffer.from(data.nextCursor, 'base64url').toString('utf8')); }
      catch { throw failure('response_contract_mismatch'); }
      requireCheck(isDeepStrictEqual(cursor, { receivedAt: data.items[0].receivedAt, batchId: data.items[0].batchId }));
    }
  };
  const query = `?batchId=${encodeURIComponent(batch.batchId)}`;
  try {
    await check('unauthenticated_read_rejected', { token: null, query, status: 401, errorCode: 'unauthorized' });
    await check('reader_write_rejected', { method: 'POST', body: batch, status: 403, errorCode: 'forbidden' });
    await check('rejected_reader_write_not_stored', { query, status: 404, errorCode: 'not_found' });
    report.writeOutcomeUncertain = false;
    await check('synthetic_satellite_created', { method: 'POST', token: writerToken, body: batch, status: 201, verify: receipt(true) });
    report.confirmedCreatedBatches = 1;
    await check('reader_reads_exact_original', { query, status: 200, verify: readOriginal });
    await check('identical_batch_replayed', { method: 'POST', token: writerToken, body: batch, status: 200, verify: receipt(false) });
    await check('same_id_changed_content_rejected', { method: 'POST', token: writerToken,
      body: { ...batch, observations: [{ ...batch.observations[0], value: 0.5 }] }, status: 409, errorCode: 'batch_conflict' });
    await check('invalid_satellite_value_rejected', { method: 'POST', token: writerToken,
      body: { ...batch, observations: [{ ...batch.observations[0], value: 2 }] }, status: 400, errorCode: 'invalid_batch' });
    await check('original_unchanged_after_failed_writes', { query, status: 200, verify: readOriginal });
    await check('missing_batch_not_found', { query: `?batchId=uat-absent-${runId}`, status: 404, errorCode: 'not_found' });
    const first = await check('writer_lists_metadata', { token: writerToken, query: '?limit=1', status: 200, verify: data => {
      listing(data); requireCheck(data.items.length === 1);
    } });
    if (first.nextCursor !== null) {
      await check('reader_follows_cursor', { query: `?limit=1&cursor=${encodeURIComponent(first.nextCursor)}`, status: 200, verify: data => {
        listing(data);
        requireCheck(data.items.length === 1 && data.items[0].batchId !== first.items[0].batchId);
      } });
    } else {
      report.pagination = 'not_needed_no_next_page';
    }
    report.status = 'passed';
  } catch {
    report.status = 'failed';
  }
  report.completedAt = new Date().toISOString();
  return JSON.parse(JSON.stringify(report).replaceAll(writerToken, '[redacted]').replaceAll(readerToken, '[redacted]'));
}

export async function runUatCli(argv = process.argv.slice(2), env = process.env, { fetchImpl = globalThis.fetch, print = console.log } = {}) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    requireCheck(['--base-url', '--output'].includes(argv[index]) && argv[index + 1]
      && !Object.hasOwn(args, argv[index]), 'invalid_arguments');
    args[argv[index]] = argv[index + 1];
  }
  requireCheck(args['--base-url'] && args['--output'], 'invalid_arguments');
  const config = { baseUrl: args['--base-url'], writerToken: env.MODEL_INPUT_UAT_WRITER_TOKEN,
    readerToken: env.MODEL_INPUT_UAT_READER_TOKEN, sourceId: env.MODEL_INPUT_UAT_SOURCE_ID };
  configuration(config);
  // Reserve an exclusive artifact before any HTTP request; never overwrite a previous run.
  let file;
  try { file = await open(resolve(args['--output']), 'wx', 0o600); }
  catch { throw failure('output_unavailable'); }
  try {
    const report = await verifyModelInputUat({ ...config, fetchImpl });
    await file.writeFile(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
    print(JSON.stringify({ status: report.status, checksPassed: report.checks.filter(item => item.passed).length,
      checksTotal: report.checks.length, confirmedCreatedBatches: report.confirmedCreatedBatches,
      writeOutcomeUncertain: report.writeOutcomeUncertain }));
    return report.status === 'passed' ? 0 : 1;
  } finally { await file.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await runUatCli(); }
  catch (error) {
    const code = ['invalid_arguments', 'invalid_base_url', 'production_endpoint_rejected', 'invalid_uat_credentials', 'output_unavailable'].includes(error?.code)
      ? error.code : 'uat_verification_failed';
    console.error(JSON.stringify({ status: 'failed', code }));
    process.exitCode = 1;
  }
}
