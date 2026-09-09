import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from '../../server/model-inputs/handler.mjs';
import { createFileStore } from '../../server/model-inputs/storage.mjs';
import { createMemoryRateLimiter } from '../../server/operations/rate-limit.mjs';

const artifacts = fileURLToPath(new URL('../../artifacts/model-input-tests/', import.meta.url));
const sourceId = 'weather-model';
const token = 'test-only-machine-ingest-token-0123456789';
const readToken = 'test-only-machine-read-token-9876543210';
const maxBytes = 1024 * 1024;
const observation = (changes = {}) => ({
  stationId: 'station-01', observedAt: '2026-09-08T12:00:00+07:00',
  metric: 'rainfall', value: 0, unit: 'mm', aggregation: 'sum',
  periodMinutes: 60, quality: 'reported', sourceRecordId: 'reading-01', ...changes,
});
const batch = (changes = {}) => ({ schemaVersion: 1, sourceId, batchId: 'batch-01', observations: [observation()], ...changes });

async function serve(t, options = {}) {
  await mkdir(artifacts, { recursive: true });
  const directory = options.directory ?? await mkdtemp(path.join(artifacts, 'api-'));
  const store = options.store ?? createFileStore(directory);
  const events = [];
  const handler = createHandler({ token, sourceId, store, log: line => events.push(JSON.parse(line)),
    ...(options.readToken ? { readToken: options.readToken } : {}), ...options.handlerOptions });
  const server = http.createServer((req, res) => {
    const dispatch = async () => {
      if (options.preparse && req.method === 'POST') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        req.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        delete req.headers['content-length'];
      }
      return handler(req, res);
    };
    dispatch().catch(error => {
      res.statusCode = 599;
      res.end(`Unhandled test-server failure: ${error.message}`);
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/model-inputs`;
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  };
  t.after(stop);
  async function request({ method = 'GET', query = '', body, authorization = `Bearer ${token}`, contentType = 'application/json', headers = {}, chunked = false } = {}) {
    const requestHeaders = { ...headers };
    if (authorization !== null) requestHeaders.authorization = authorization;
    if (body !== undefined && contentType !== null) requestHeaders['content-type'] = contentType;
    const serialized = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
    const payload = chunked ? new ReadableStream({ start(controller) {
      const bytes = new TextEncoder().encode(serialized);
      for (let offset = 0; offset < bytes.length; offset += 16384) controller.enqueue(bytes.slice(offset, offset + 16384));
      controller.close();
    } }) : serialized;
    const response = await fetch(`${base}${query}`, { method, headers: requestHeaders, body: payload, ...(chunked ? { duplex: 'half' } : {}) });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, headers: response.headers, data, text };
  }
  return { request, directory, stop, events };
}

function securityHeaders(result) {
  assert.ok(result.headers.get('cache-control')?.split(',').map(value => value.trim()).includes('no-store'));
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
  assert.match(result.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
}

test('both read and ingest require the configured machine token; rejected writes leave storage empty', async t => {
  const api = await serve(t);
  for (const method of ['GET', 'POST']) for (const authorization of [null, 'Bearer incorrect-token', `Basic ${token}`]) {
    const result = await api.request({ method, authorization, ...(method === 'POST' ? { body: batch() } : {}) });
    assert.equal(result.status, 401);
    securityHeaders(result);
  }
  const queryToken = await api.request({ query: `?token=${encodeURIComponent(token)}`, authorization: null });
  assert.equal(queryToken.status, 401);
  assert.deepEqual((await api.request()).data.items, []);
});

test('an optional read token can retrieve inputs but cannot write them', async t => {
  const api = await serve(t, { readToken });
  assert.equal((await api.request({ authorization: `Bearer ${readToken}` })).status, 200);
  const refused = await api.request({ method: 'POST', body: batch(), authorization: `Bearer ${readToken}` });
  assert.equal(refused.status, 403);
  assert.deepEqual((await api.request()).data.items, []);
  assert.equal((await api.request({ method: 'POST', body: batch() })).status, 201);
  assert.equal((await api.request({ query: '?batchId=batch-01', authorization: `Bearer ${readToken}` })).status, 200);
});

test('the handler fails closed before serving with missing or weak credentials and invalid source configuration', () => {
  const store = { put() {}, get() {}, list() {} };
  for (const value of [undefined, '', 'short']) assert.throws(() => createHandler({ token: value, sourceId, store }), /MODEL_INPUT_API_TOKEN/);
  for (const value of [undefined, '', '../outside', 'Upper Case']) assert.throws(() => createHandler({ token, sourceId: value, store }), /MODEL_INPUT_SOURCE_ID/);
  for (const value of ['short', token]) assert.throws(() => createHandler({ token, readToken: value, sourceId, store }), /MODEL_INPUT_READ_TOKEN/);
});

test('stores and retrieves all supported measurements while preserving numeric zero and explicit missing values', async t => {
  const api = await serve(t);
  const observations = [
    observation(),
    observation({ stationId: 'missing-rain', quality: 'missing', value: null }),
    observation({ metric: 'air_temperature', unit: 'degC', value: -5, aggregation: 'instant', periodMinutes: 0 }),
    observation({ metric: 'relative_humidity', unit: '%', value: 82, aggregation: 'mean', periodMinutes: 60 }),
    observation({ metric: 'water_level', unit: 'm', value: 1.2, aggregation: 'instant', periodMinutes: 0, quality: 'suspect' }),
    observation({ metric: 'streamflow', unit: 'm3/s', value: 0, aggregation: 'max', periodMinutes: 60 }),
    observation({ metric: 'soil_moisture', unit: '%', value: 37, aggregation: 'min', periodMinutes: 60 }),
  ];
  const created = await api.request({ method: 'POST', body: batch({ observations }) });
  assert.equal(created.status, 201);
  assert.equal(created.data.created, true);
  assert.equal(created.data.batch.observationCount, observations.length);
  assert.equal(created.data.batch.sourceId, sourceId);
  assert.equal(created.data.batch.batchId, 'batch-01');
  assert.match(created.data.batch.contentHash, /^[a-f0-9]{64}$/);
  assert.ok(Number.isFinite(Date.parse(created.data.batch.receivedAt)));
  securityHeaders(created);
  const retrieved = await api.request({ query: '?batchId=batch-01' });
  assert.equal(retrieved.status, 200);
  securityHeaders(retrieved);
  assert.equal(retrieved.data.schemaVersion, 1);
  assert.equal(retrieved.data.contentHash, created.data.batch.contentHash);
  assert.equal(retrieved.data.receivedAt, created.data.batch.receivedAt);
  assert.equal(retrieved.data.observations.length, observations.length);
  assert.equal(retrieved.data.observations.find(row => row.metric === 'rainfall' && row.quality === 'reported').value, 0);
  assert.equal(retrieved.data.observations.find(row => row.quality === 'missing').value, null);
  assert.ok(retrieved.data.observations.every(row => row.observedAt === '2026-09-08T05:00:00.000Z'));
});

test('rejects another configured source and never partially stores a mixed valid/invalid batch', async t => {
  const api = await serve(t);
  assert.equal((await api.request({ method: 'POST', body: batch({ sourceId: 'another-source' }) })).status, 403);
  const invalid = batch({ observations: [observation(), observation({ stationId: 'bad', value: -1 })] });
  assert.equal((await api.request({ method: 'POST', body: invalid })).status, 400);
  assert.equal((await api.request({ query: '?batchId=batch-01' })).status, 404);
  assert.deepEqual((await api.request()).data.items, []);
});

test('rejects malformed timestamps, invalid measurements, incompatible units/aggregations and unknown observation fields', async t => {
  const api = await serve(t);
  const invalidRows = [
    { observedAt: '2026-02-30T12:00:00Z' }, { observedAt: '2026-09-08T12:00:00' },
    { observedAt: '2026-09-08' }, { observedAt: 'not-a-date' },
    { observedAt: '2026-09-08T12:00:00+25:00' }, { stationId: '../outside' },
    { value: '0' }, { value: null }, { quality: 'missing', value: 0 },
    { quality: 'estimated' }, { value: -0.1 }, { metric: 'forecast_risk' },
    { unit: 'cm' }, { aggregation: 'mean' }, { periodMinutes: 0 },
    { periodMinutes: 1.5 }, { unexpected: true },
    { metric: 'relative_humidity', unit: '%', aggregation: 'instant', periodMinutes: 0, value: 101 },
    { metric: 'air_temperature', unit: 'degC', aggregation: 'instant', periodMinutes: 60 },
    { metric: 'air_temperature', unit: 'degC', aggregation: 'mean', periodMinutes: 0 },
  ];
  for (const [index, changes] of invalidRows.entries()) {
    const result = await api.request({ method: 'POST', body: batch({ batchId: `invalid-${index}`, observations: [observation(changes)] }) });
    assert.equal(result.status, 400, JSON.stringify(changes));
  }
  assert.deepEqual((await api.request()).data.items, []);
});

test('rejects malformed envelopes, unknown top-level keys and duplicate normalized observation identities', async t => {
  const api = await serve(t);
  const invalidBatches = [
    null, [], {}, batch({ schemaVersion: 2 }), batch({ observations: [] }),
    batch({ batchId: '../outside' }), batch({ batchId: 'x'.repeat(129) }),
    batch({ observations: 'not-an-array' }), batch({ unknown: true }),
    batch({ observations: [observation(), observation({ value: 1, sourceRecordId: 'different-record' })] }),
    batch({ observations: [observation(), observation({ observedAt: '2026-09-08T05:00:00Z' })] }),
  ];
  for (const body of invalidBatches) {
    const result = await api.request({ method: 'POST', body: JSON.stringify(body) });
    assert.equal(result.status, 400, JSON.stringify(body));
  }
  assert.deepEqual((await api.request()).data.items, []);
});

test('rejects nonfinite JSON numbers, malformed JSON and incorrect media types before persistence', async t => {
  const api = await serve(t);
  const infinite = JSON.stringify(batch()).replace('"value":0', '"value":1e400');
  for (const body of ['{', '', infinite]) assert.equal((await api.request({ method: 'POST', body })).status, 400);
  for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', null]) {
    assert.equal((await api.request({ method: 'POST', body: batch(), contentType })).status, 415);
  }
  assert.deepEqual((await api.request()).data.items, []);
});

test('returns method and cache policy without exposing internals', async t => {
  const api = await serve(t);
  const result = await api.request({ method: 'PUT', body: batch() });
  assert.equal(result.status, 405);
  assert.deepEqual(result.headers.get('allow').split(',').map(value => value.trim()).sort(), ['GET', 'POST']);
  securityHeaders(result);
});

test('identical retries are idempotent and changing an existing batch conflicts without overwriting it', async t => {
  const api = await serve(t);
  const first = await api.request({ method: 'POST', body: batch() });
  const repeated = await api.request({ method: 'POST', body: batch() });
  assert.equal(first.status, 201);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.data.created, false);
  assert.deepEqual(repeated.data.batch, first.data.batch);
  const conflicting = await api.request({ method: 'POST', body: batch({ observations: [observation({ value: 1 })] }) });
  assert.equal(conflicting.status, 409);
  const stored = await api.request({ query: '?batchId=batch-01' });
  assert.equal(stored.data.observations[0].value, 0);
  assert.equal(stored.data.contentHash, first.data.batch.contentHash);
  assert.equal((await api.request()).data.items.length, 1);
});

test('equivalent offset timestamps retry the same canonical batch rather than causing a conflict', async t => {
  const api = await serve(t);
  const first = await api.request({ method: 'POST', body: batch() });
  const repeated = await api.request({ method: 'POST', body: batch({ observations: [observation({ observedAt: '2026-09-08T05:00:00.000Z' })] }) });
  assert.equal(first.status, 201);
  assert.equal(repeated.status, 200);
  assert.deepEqual(repeated.data.batch, first.data.batch);
});

test('concurrent identical ingestion creates exactly one immutable batch', async t => {
  const api = await serve(t);
  const results = await Promise.all(Array.from({ length: 8 }, () => api.request({ method: 'POST', body: batch() })));
  assert.equal(results.filter(result => result.status === 201).length, 1);
  assert.equal(results.filter(result => result.status === 200).length, 7);
  assert.equal(new Set(results.map(result => result.data.batch.contentHash)).size, 1);
  assert.equal(new Set(results.map(result => result.data.batch.receivedAt)).size, 1);
  assert.equal((await api.request()).data.items.length, 1);
});

test('concurrent conflicting requests preserve whichever batch wins creation', async t => {
  const api = await serve(t);
  const inputs = [batch(), batch({ observations: [observation({ value: 12 })] })];
  const results = await Promise.all(inputs.map(body => api.request({ method: 'POST', body })));
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  const winner = results.findIndex(result => result.status === 201);
  const stored = await api.request({ query: '?batchId=batch-01' });
  assert.equal(stored.data.observations[0].value, inputs[winner].observations[0].value);
  assert.equal(stored.data.contentHash, results[winner].data.batch.contentHash);
});

test('a fresh handler and file store retain data and idempotency after a process-like restart', async t => {
  const first = await serve(t);
  const created = await first.request({ method: 'POST', body: batch() });
  assert.equal(created.status, 201);
  await first.stop();
  const restarted = await serve(t, { directory: first.directory });
  const retrieved = await restarted.request({ query: '?batchId=batch-01' });
  assert.equal(retrieved.status, 200);
  assert.equal(retrieved.data.contentHash, created.data.batch.contentHash);
  assert.equal(retrieved.data.receivedAt, created.data.batch.receivedAt);
  const repeated = await restarted.request({ method: 'POST', body: batch() });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.data.created, false);
});

test('lists newest-first metadata with nonoverlapping cursor pages', async t => {
  const api = await serve(t);
  for (let index = 0; index < 5; index++) assert.equal((await api.request({ method: 'POST', body: batch({ batchId: `page-${index}` }) })).status, 201);
  const all = await api.request();
  assert.equal(all.status, 200);
  assert.equal(all.data.items.length, 5);
  assert.equal(all.data.nextCursor, null);
  assert.ok(all.data.items.every(item => item.observationCount === 1 && !('observations' in item)));
  assert.ok(all.data.items.every((item, index, items) => index === 0 || item.receivedAt <= items[index - 1].receivedAt));
  let query = '?limit=2';
  const ids = [];
  for (let page = 0; page < 3; page++) {
    const result = await api.request({ query });
    assert.equal(result.status, 200);
    assert.ok(result.data.items.length <= 2);
    ids.push(...result.data.items.map(item => item.batchId));
    if (page < 2) {
      assert.equal(typeof result.data.nextCursor, 'string');
      query = `?limit=2&cursor=${encodeURIComponent(result.data.nextCursor)}`;
    } else assert.equal(result.data.nextCursor, null);
  }
  assert.equal(new Set(ids).size, 5);
  assert.deepEqual(ids, all.data.items.map(item => item.batchId));
});

test('validates pagination limits and malformed cursor content', async t => {
  const api = await serve(t);
  const invalidQueries = ['?limit=0', '?limit=-1', '?limit=101', '?limit=1.5', '?limit=abc', '?cursor=not%25base64'];
  for (const value of [{}, { receivedAt: 'invalid', batchId: 'a' }, { receivedAt: '2026-09-08T00:00:00.000Z', batchId: '../outside' }]) {
    invalidQueries.push(`?cursor=${Buffer.from(JSON.stringify(value)).toString('base64url')}`);
  }
  for (const query of invalidQueries) assert.equal((await api.request({ query })).status, 400, query);
  assert.equal((await api.request({ query: '?limit=100' })).status, 200);
});

test('enforces the 2000-observation boundary without partially saving an oversized batch', async t => {
  const api = await serve(t);
  const rows = Array.from({ length: 2001 }, (_, index) => observation({ stationId: `station-${index}` }));
  const refused = await api.request({ method: 'POST', body: batch({ batchId: 'too-many', observations: rows }) });
  assert.equal(refused.status, 413);
  assert.equal((await api.request({ query: '?batchId=too-many' })).status, 404);
  const accepted = await api.request({ method: 'POST', body: batch({ observations: rows.slice(0, 2000) }) });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.data.batch.observationCount, 2000);
});

test('enforces the 1 MiB request limit including otherwise valid trailing JSON whitespace', async t => {
  const api = await serve(t);
  const json = JSON.stringify(batch());
  const exact = json + ' '.repeat(maxBytes - Buffer.byteLength(json));
  const refused = await api.request({ method: 'POST', body: `${exact} ` });
  assert.equal(refused.status, 413);
  securityHeaders(refused);
  assert.deepEqual((await api.request()).data.items, []);
  const accepted = await api.request({ method: 'POST', body: exact });
  assert.equal(accepted.status, 201);
});

test('limits chunked request bodies even when Content-Length is absent', async t => {
  const api = await serve(t);
  const result = await api.request({ method: 'POST', body: JSON.stringify(batch()) + ' '.repeat(maxBytes), chunked: true });
  assert.equal(result.status, 413);
  securityHeaders(result);
  assert.deepEqual((await api.request()).data.items, []);
});

test('accepts Vercel-style parsed JSON objects and applies the byte limit before persistence', async t => {
  const api = await serve(t, { preparse: true });
  const accepted = await api.request({ method: 'POST', body: batch() });
  assert.equal(accepted.status, 201);
  const rejected = await api.request({ method: 'POST', body: batch({ batchId: 'oversized-parsed', extra: 'x'.repeat(maxBytes) }) });
  assert.equal(rejected.status, 413);
  assert.equal((await api.request({ query: '?batchId=oversized-parsed' })).status, 404);
  assert.equal((await api.request()).data.items.length, 1);
});

test('unexpected storage errors return a sanitized retryable response', async t => {
  const secret = '/private/path/db-password=test-secret';
  const fail = async () => { throw new Error(secret); };
  const api = await serve(t, { store: { put: fail, get: fail, list: fail } });
  for (const options of [{}, { query: '?batchId=batch-01' }, { method: 'POST', body: batch() }]) {
    const result = await api.request(options);
    assert.equal(result.status, 503);
    assert.equal(result.headers.get('retry-after'), '30');
    securityHeaders(result);
    assert.ok(!result.text.includes(secret));
    assert.ok(!result.text.includes('test-secret'));
    assert.equal(typeof result.data, 'object');
  }
  assert.ok(api.events.every(event => event.code === 'storage_unavailable'));
  assert.ok(!JSON.stringify(api.events).includes(secret));
});

test('request IDs are server-generated, correlate sanitized completion logs, and survive a log failure', async t => {
  const api = await serve(t);
  const result = await api.request({ query: '?batchId=batch-01', headers: { 'x-request-id': 'caller-controlled-secret', 'x-forwarded-for': '192.0.2.1' } });
  const event = api.events.at(-1);
  assert.equal(event.requestId, result.headers.get('x-request-id'));
  assert.equal(event.clientId, 'legacy-writer');
  assert.equal(event.code, 'not_found');
  assert.equal(event.status, 404);
  assert.equal(event.route, '/api/model-inputs');
  assert.ok(event.durationMs >= 0);
  assert.deepEqual(Object.keys(event).sort(), ['timestamp', 'event', 'requestId', 'route', 'method', 'status', 'durationMs', 'code', 'clientId'].sort());
  const serialized = JSON.stringify(api.events);
  for (const privateValue of [token, 'caller-controlled-secret', '192.0.2.1', 'batch-01']) assert.ok(!serialized.includes(privateValue));
  const logFailure = await serve(t, { handlerOptions: { log() { throw new Error('log transport secret'); } } });
  assert.equal((await logFailure.request({ method: 'POST', body: batch() })).status, 201);
});

test('rotating tokens keep the identity and quota while readers and unrelated identities stay separate', async t => {
  const oldToken = 'test-only-integrator-old-01234567890';
  const newToken = 'test-only-integrator-new-98765432100';
  const readerToken = 'test-only-viewer-token-987654321000';
  const clients = [
    { id: 'local-station', sourceId, role: 'writer', tokens: [oldToken, newToken] },
    { id: 'model-team', sourceId, role: 'reader', tokens: [readerToken] },
  ];
  const api = await serve(t, { handlerOptions: { clients, rateLimiter: createMemoryRateLimiter({ requestsPerMinute: 2, dailyQuota: 10 }) } });
  const first = await api.request({ method: 'POST', body: batch(), authorization: `Bearer ${oldToken}` });
  const repeated = await api.request({ method: 'POST', body: batch(), authorization: `Bearer ${newToken}` });
  assert.equal(first.status, 201);
  assert.equal(repeated.status, 200);
  assert.deepEqual(repeated.data.batch, first.data.batch);
  const limited = await api.request({ authorization: `Bearer ${newToken}` });
  assert.equal(limited.status, 429);
  assert.equal(limited.data.error.code, 'rate_limit_exceeded');
  assert.equal(limited.headers.get('x-ratelimit-remaining'), '0');
  assert.ok(Number(limited.headers.get('retry-after')) >= 1);
  const viewer = await api.request({ authorization: `Bearer ${readerToken}` });
  assert.equal(viewer.status, 200);
  assert.equal((await api.request({ method: 'POST', body: batch(), authorization: `Bearer ${readerToken}` })).status, 403);
  assert.equal(api.events.filter(event => event.clientId === 'local-station').length, 3);

  const rotated = await serve(t, { handlerOptions: { clients: [{ ...clients[0], tokens: [newToken] }] } });
  assert.equal((await rotated.request({ authorization: `Bearer ${oldToken}` })).status, 401);
  assert.equal((await rotated.request({ authorization: `Bearer ${newToken}` })).status, 200);
});

test('parallel requests cannot exceed a shared limiter, and unauthenticated callers consume no client quota', async t => {
  const api = await serve(t, { handlerOptions: { rateLimiter: createMemoryRateLimiter({ requestsPerMinute: 4, dailyQuota: 4 }) } });
  const rejected = await Promise.all(Array.from({ length: 5 }, () => api.request({ authorization: 'Bearer invalid' })));
  assert.ok(rejected.every(result => result.status === 401));
  const attempts = await Promise.all(Array.from({ length: 12 }, () => api.request({ method: 'POST', body: batch() })));
  assert.equal(attempts.filter(result => result.status === 201).length, 1);
  assert.equal(attempts.filter(result => result.status === 200).length, 3);
  assert.equal(attempts.filter(result => result.status === 429).length, 8);
  assert.ok(attempts.every(result => result.headers.get('x-request-id')));
});

test('quota outage fails closed before body validation or storage, with a sanitized retryable error', async t => {
  let stores = 0;
  const api = await serve(t, {
    store: { async put() { stores++; }, async get() { stores++; }, async list() { stores++; } },
    handlerOptions: { rateLimiter: { async consume() { throw new Error('secret upstream SQL text'); } } },
  });
  for (const request of [{}, { method: 'POST', body: batch() }]) {
    const result = await api.request(request);
    assert.equal(result.status, 503);
    assert.equal(result.data.error.code, 'rate_limit_unavailable');
    assert.equal(result.headers.get('retry-after'), '30');
    assert.ok(!result.text.includes('SQL'));
  }
  assert.equal(stores, 0);
  assert.ok(!JSON.stringify(api.events).includes('SQL'));
});
