import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { collectBatch, loadCollectorConfig, parseCsv, submitBatch, transformRows, validateCollectorConfig } from '../../server/model-inputs/collector.mjs';
import { hashBatch, MAX_BODY_BYTES, MAX_OBSERVATIONS } from '../../server/model-inputs/contract.mjs';

const fixture = (name) => fileURLToPath(new URL(`../../examples/model-inputs/${name}`, import.meta.url));
const csvLoaded = await loadCollectorConfig(fixture('local-csv.config.json'));
const jsonLoaded = await loadCollectorConfig(fixture('local-json.config.json'));
const satelliteLoaded = await loadCollectorConfig(fixture('satellite-features.config.json'));
const cropLoaded = await loadCollectorConfig(fixture('doae-crop-yield.config.json'));
const satelliteRows = () => JSON.parse(satelliteFixture).features;
const satelliteFixture = await readFile(fixture('satellite-features.json'), 'utf8');
const cropRows = () => parseCsv(cropFixture);
const cropFixture = await readFile(fixture('doae-crop-yield.csv'), 'utf8');
const config = () => structuredClone(csvLoaded.config);
const rows = () => [{ station_code: 'ST-001', observed_at: '2026-09-08 07:00:00', rain_mm: '0', temperature_c: '28.5' }];
const token = 'test-token-for-local-model-inputs-123456789';
const receipt = (batch, created = true) => ({ created, batch: { sourceId: batch.sourceId, batchId: batch.batchId, contentHash: hashBatch(batch), observationCount: batch.observations.length, receivedAt: '2026-09-08T01:00:00.000Z' } });

async function localServer(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('CSV handles BOM, CRLF, escaped quotes, delimiters and newlines inside fields', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"first, value","quoted ""value""\nnext"\r\n'), [{ a: 'first, value', b: 'quoted "value"\nnext' }]);
  assert.deepEqual(parseCsv('a;b\n1;2', ';'), [{ a: '1', b: '2' }]);
  for (const malformed of ['a,a\n1,2', 'a,\n1,2', 'a,b\n1', 'a,b\n1,2,3', 'a,b\n"unclosed,2', 'a,b\n"closed"x,2', 'a,b\nnot"quoted,2', '']) {
    assert.throws(() => parseCsv(malformed));
  }
});

test('file examples normalize to the same batch without treating zero as missing', async () => {
  const csv = await collectBatch(csvLoaded.config, { baseDir: csvLoaded.baseDir });
  const json = await collectBatch(jsonLoaded.config, { baseDir: jsonLoaded.baseDir });
  assert.deepEqual(csv, json);
  assert.equal(csv.observations.length, 4);
  assert.equal(csv.observations[0].value, 0);
  assert.equal(csv.observations[0].quality, 'reported');
  assert.equal(csv.observations[0].observedAt, '2026-09-08T00:00:00.000Z');
  assert.equal(csv.observations[2].value, null);
  assert.equal(csv.observations[2].quality, 'missing');
  assert.match(csv.batchId, /^sha256-[a-f0-9]{64}$/);
  const changed = rows();
  const original = transformRows(changed, config());
  changed[0].rain_mm = '1';
  assert.notEqual(transformRows(changed, config()).batchId, original.batchId);
});

test('mappings reject missing columns and malformed numeric text atomically', () => {
  for (const value of ['1,000', 'NaN', 'Infinity', '12 mm', '0x10', true, undefined, {}, []]) {
    const input = rows(); input[0].rain_mm = value;
    assert.throws(() => transformRows(input, config()));
  }
  const input = rows(); delete input[0].rain_mm;
  assert.throws(() => transformRows(input, config()), /missing mapped column rain_mm/);
  const missing = rows(); missing[0].rain_mm = ' NULL ';
  assert.equal(transformRows(missing, config()).observations[0].value, null);
  assert.throws(() => transformRows([], config()), /at least one/);
  assert.throws(() => transformRows(Array(MAX_OBSERVATIONS).fill(rows()[0]), config()), /exceeds/);
});

test('dates use explicit Gregorian format and offsets and never guess Thai years', () => {
  for (const value of ['2569-09-08 07:00:00', '2026-02-30 07:00:00', '08/09/2026 07:00', '2026-09-08 24:00:00']) {
    const input = rows(); input[0].observed_at = value;
    assert.throws(() => transformRows(input, config()));
  }
  const iso = config(); iso.timestamp = { format: 'iso' };
  const input = rows(); input[0].observed_at = '2026-09-08T00:00:00Z';
  assert.equal(transformRows(input, iso).batchId, transformRows(rows(), config()).batchId);
  input[0].observed_at = '2026-09-08T00:00:00';
  assert.throws(() => transformRows(input, iso), /explicit offset/);
});

test('quality codes require an explicit mapping and consistency with missing values', () => {
  const mapped = config();
  mapped.measurements[0].qualityColumn = 'qc';
  mapped.measurements[0].qualityMap = { '1': 'reported', '2': 'suspect', '9': 'missing' };
  const input = rows(); input[0].qc = '2';
  assert.equal(transformRows(input, mapped).observations[0].quality, 'suspect');
  input[0].qc = 'unknown';
  assert.throws(() => transformRows(input, mapped), /unmapped quality/);
  input[0].qc = '9';
  assert.throws(() => transformRows(input, mapped), /exactly when quality/);
  input[0].rain_mm = '-9999';
  assert.equal(transformRows(input, mapped).observations[0].value, null);
});

test('configuration rejects ambiguous units, paths, credentials and insecure URLs', () => {
  const wrongUnit = config(); wrongUnit.measurements[0].unit = 'cm';
  assert.throws(() => validateCollectorConfig(wrongUnit), /unit/);
  const insecure = config(); insecure.source = { type: 'http', url: 'http://station.internal/read' };
  assert.throws(() => validateCollectorConfig(insecure), /allowHttp/);
  insecure.source.allowHttp = true;
  assert.doesNotThrow(() => validateCollectorConfig(insecure));
  insecure.source.url = 'https://user:secret@station.internal/read';
  assert.throws(() => validateCollectorConfig(insecure), /credentials/);
  insecure.source.url = 'https://station.internal/read';
  insecure.source.headers = { Authorization: 'literal-secret' };
  assert.throws(() => validateCollectorConfig(insecure), /object/);
  const path = structuredClone(jsonLoaded.config); path.format.dataPath = '__proto__.records';
  assert.throws(() => validateCollectorConfig(path), /safe dot/);
  const unknown = config(); unknown.guessDates = true;
  assert.throws(() => validateCollectorConfig(unknown), /Unknown/);
});

test('HTTP collector sends GET with environment header and accepts nested JSON', async (t) => {
  const address = await localServer(t, (request, response) => {
    assert.equal(request.method, 'GET');
    assert.equal(request.headers['x-api-key'], 'source-test-only');
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ result: { records: rows() } }));
  });
  const remote = config();
  remote.source = { type: 'http', url: address, allowHttp: true, headers: { 'X-API-Key': { env: 'TEST_SOURCE_KEY' } } };
  remote.format = { type: 'json', dataPath: 'result.records' };
  const batch = await collectBatch(remote, { env: { TEST_SOURCE_KEY: 'source-test-only' } });
  assert.equal(batch.observations.length, 2);
  await assert.rejects(() => collectBatch(remote, { env: {} }), /environment variable/);
});

test('collector rejects HTTP redirects without forwarding source credentials', async (t) => {
  let forwarded = 0;
  const destination = await localServer(t, (_request, response) => { forwarded++; response.end('[]'); });
  const address = await localServer(t, (_request, response) => { response.writeHead(302, { Location: destination }); response.end(); });
  const remote = config(); remote.source = { type: 'http', url: address, allowHttp: true };
  await assert.rejects(() => collectBatch(remote), /302/);
  assert.equal(forwarded, 0);
});

test('collector enforces source response limits with and without content-length', async () => {
  const remote = config(); remote.source = { type: 'http', url: 'https://source.invalid/data' };
  for (const headers of [{}, { 'content-length': String(MAX_BODY_BYTES + 1) }]) {
    await assert.rejects(() => collectBatch(remote, { fetchImpl: async () => new Response('x'.repeat(MAX_BODY_BYTES + 1), { headers }) }), /exceeds/);
  }
  await assert.rejects(() => collectBatch(remote, { fetchImpl: async () => { throw new Error('secret must not escape'); } }), /Source request failed/);
});

test('collector decodes Windows-874 when explicitly configured', async () => {
  const remote = config();
  remote.source = { type: 'http', url: 'https://source.invalid/data' };
  remote.format.encoding = 'windows-874';
  const bytes = Buffer.concat([Buffer.from('station_code,observed_at,rain_mm,temperature_c,note\nST-001,2026-09-08 07:00:00,0,28.5,'), Buffer.from([0xa1])]);
  assert.equal((await collectBatch(remote, { fetchImpl: async () => new Response(bytes) })).observations[0].value, 0);
  remote.format.encoding = 'utf-8';
  await assert.rejects(() => collectBatch(remote, { fetchImpl: async () => new Response(bytes) }), /encoding/);
});

test('submission retries transient failures with exactly the same batch and token', async (t) => {
  const bodies = [], methods = [];
  const address = await localServer(t, async (request, response) => {
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    methods.push(request.method);
    let body = ''; for await (const chunk of request) body += chunk;
    bodies.push(body);
    if (bodies.length === 1) { response.writeHead(503); response.end('temporarily unavailable'); }
    else { response.writeHead(201, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(receipt(JSON.parse(body)))); }
  });
  const batch = transformRows(rows(), config());
  const result = await submitBatch(batch, `${address}/api/model-inputs`, { token, sleep: async () => {} });
  assert.deepEqual(result, { status: 201, duplicate: false, receivedAt: '2026-09-08T01:00:00.000Z' });
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.deepEqual(methods, ['POST', 'POST']);
});

test('submission retries network/429 but not conflict, auth or redirects', async () => {
  const batch = transformRows(rows(), config());
  let attempts = 0;
  const delays = [];
  assert.deepEqual(await submitBatch(batch, 'https://receiver.invalid/api/model-inputs', {
    token, sleep: async (ms) => delays.push(ms), fetchImpl: async () => {
      attempts++;
      if (attempts === 1) throw new Error('secret network detail');
      if (attempts === 2) return new Response('', { status: 429, headers: { 'Retry-After': '3' } });
      return Response.json(receipt(batch, false), { status: 200 });
    },
  }), { status: 200, duplicate: true, receivedAt: '2026-09-08T01:00:00.000Z' });
  assert.deepEqual(delays, [250, 3000]);
  let deferredCalls = 0;
  await assert.rejects(submitBatch(batch, 'https://receiver.invalid/api/model-inputs', { token, fetchImpl: async () => {
    deferredCalls++; return new Response('', { status: 429, headers: { 'Retry-After': '600' } });
  } }), error => error.status === 429 && error.retryAfterSeconds === 600);
  assert.equal(deferredCalls, 1);
  for (const status of [301, 401, 403, 409, 422]) {
    attempts = 0;
    await assert.rejects(() => submitBatch(batch, 'https://receiver.invalid/api/model-inputs', { token, fetchImpl: async () => { attempts++; return new Response('', { status }); } }), new RegExp(String(status)));
    assert.equal(attempts, 1);
  }
  await assert.rejects(() => submitBatch(batch, 'http://receiver.internal/api/model-inputs', { token }), /requires HTTPS/);
  await assert.rejects(() => submitBatch(batch, 'https://user:pass@receiver.invalid/api/model-inputs', { token }), /credentials/);
  await assert.rejects(() => submitBatch(batch, 'https://receiver.invalid/api/model-inputs', { token: 'short' }), /32 characters/);
});

test('submission requires a matching durable receipt, not only HTTP success', async () => {
  const batch = transformRows(rows(), config());
  await assert.rejects(() => submitBatch(batch, 'https://receiver.invalid/api/model-inputs', { token, fetchImpl: async () => new Response('<html>Sign in</html>', { status: 200, headers: { 'content-type': 'text/html' } }) }), /JSON storage receipt/);
  const invalidReceipts = [
    {},
    receipt(batch, false),
    { ...receipt(batch), batch: { ...receipt(batch).batch, contentHash: '0'.repeat(64) } },
    { ...receipt(batch), batch: { ...receipt(batch).batch, sourceId: 'another-source' } },
    { ...receipt(batch), batch: { ...receipt(batch).batch, batchId: 'another-batch' } },
    { ...receipt(batch), batch: { ...receipt(batch).batch, observationCount: 999 } },
    { ...receipt(batch), batch: { ...receipt(batch).batch, receivedAt: '2026-02-30T00:00:00Z' } },
  ];
  for (const invalid of invalidReceipts) {
    await assert.rejects(() => submitBatch(batch, 'https://receiver.invalid/api/model-inputs', { token, fetchImpl: async () => Response.json(invalid, { status: 201 }) }), /receipt is invalid/);
  }
});

test('source timeouts abort the request and do not reveal credentials', async (t) => {
  const address = await localServer(t, (_request, _response) => {});
  const remote = config(); remote.source = { type: 'http', url: address, allowHttp: true, timeoutMs: 100 };
  await assert.rejects(() => collectBatch(remote), /failed or timed out/);
});

test('satellite feature config preserves monthly aggregation and processing lineage', async () => {
  const batch = await collectBatch(satelliteLoaded.config, { baseDir: satelliteLoaded.baseDir });
  assert.equal(batch.kind, 'satellite');
  assert.equal(batch.sourceId, 'korat-model-team');
  assert.equal(batch.observations.length, 3);
  assert.equal(batch.observations[0].subdistrictCode, '300806');
  assert.equal(batch.observations[0].period, '2026-08');
  assert.equal(batch.observations[0].availableAt, '2026-09-02T02:00:00.000Z');
  assert.equal(batch.observations[0].value, 0.6);
  assert.equal(batch.observations[0].productVersion, 'synthetic-demo-v1');
  assert.equal(batch.observations[0].processingVersion, 'synthetic-demo-v1');
  assert.equal(batch.observations[0].geometryVersion, 'demo-boundary-v1');
  assert.equal(batch.observations[0].maskVersion, 'demo-crop-mask-v1');
  assert.equal(batch.observations[0].nativeSupportMeters, 10);
  assert.equal(batch.observations[2].metric, 'precipitation');
  assert.equal(batch.observations[2].spatialAggregation, 'coarse_grid_proxy');
  assert.equal(batch.observations[2].temporalAggregation, 'sum');
});

test('annual crop CSV maps assumed DOAE fields without inventing harvest dates or yield basis', async () => {
  const batch = await collectBatch(cropLoaded.config, { baseDir: cropLoaded.baseDir });
  assert.equal(batch.kind, 'crop');
  const row = batch.observations[0];
  assert.equal(row.agency, 'DOAE');
  assert.equal(row.datasetVersion, 'synthetic-demo-v1');
  assert.equal(row.cropCode, 'rice');
  assert.equal(row.seasonId, '2025-annual');
  assert.equal(row.periodType, 'calendar_year');
  assert.equal(row.plantedAreaRai, 100);
  assert.equal(row.harvestedAreaRai, 90);
  assert.equal(row.productionTonnes, 45);
  assert.equal(row.yieldKgPerRai, 500);
  assert.equal(row.yieldAreaBasis, 'unspecified');
  assert.equal(row.periodStart, '2025-01-01');
  assert.equal(row.periodEnd, '2025-12-31');
  assert.equal(Object.hasOwn(row, 'harvestStart'), false);
  assert.equal(row.availableAt, '2026-03-01T02:00:00.000Z');
});

test('typed collectors produce the same batch for numeric CSV strings and JSON numbers', () => {
  const originals = satelliteRows();
  const asCsv = originals.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value)])));
  asCsv[0].available_at = '2026-09-02T02:00:00Z';
  assert.deepEqual(transformRows(asCsv, satelliteLoaded.config), transformRows(originals, satelliteLoaded.config));
  const mapped = structuredClone(satelliteLoaded.config);
  mapped.fields.processingVersion = 'processing_version';
  delete mapped.constants.processingVersion;
  originals.forEach((row) => { row.processing_version = 'synthetic-demo-v1'; });
  assert.deepEqual(transformRows(originals, mapped), transformRows(satelliteRows(), satelliteLoaded.config));
});

test('typed configs require every canonical field explicitly and reject mapping collisions', () => {
  const omitted = structuredClone(satelliteLoaded.config); delete omitted.fields.quality;
  assert.throws(() => validateCollectorConfig(omitted), /quality/);
  const collision = structuredClone(satelliteLoaded.config); collision.constants.quality = 'reported';
  assert.throws(() => validateCollectorConfig(collision), /both mapped and constant/);
  const typo = structuredClone(cropLoaded.config); typo.fields.yieldKgPerRaii = 'yield_kg_per_rai';
  assert.throws(() => validateCollectorConfig(typo), /Unknown/);
  const legacy = structuredClone(satelliteLoaded.config); legacy.timestamp = { format: 'iso' };
  assert.throws(() => validateCollectorConfig(legacy), /Unknown/);
  const unknown = structuredClone(satelliteLoaded.config); unknown.kind = 'raw-geotiff';
  assert.throws(() => validateCollectorConfig(unknown), /kind/);
});

test('typed missing values preserve nulls and require explicit matching quality', () => {
  const satellite = satelliteRows();
  satellite[0].value = '-9999';
  assert.throws(() => transformRows(satellite, satelliteLoaded.config));
  satellite[0].quality = 'missing';
  satellite[0].valid_pixel_fraction = 0;
  assert.equal(transformRows(satellite, satelliteLoaded.config).observations[0].value, null);
  const crop = cropRows();
  for (const name of ['planted_rai', 'harvested_rai', 'production_tonnes', 'yield_kg_per_rai']) crop[0][name] = 'NULL';
  crop[0].quality = 'missing';
  const normalized = transformRows(crop, cropLoaded.config).observations[0];
  assert.equal(normalized.productionTonnes, null);
  assert.equal(normalized.yieldKgPerRai, null);
  const malformed = satelliteRows(); malformed[0].value = '0.6 NDVI';
  assert.throws(() => transformRows(malformed, satelliteLoaded.config), /numeric/);
});

test('typed batches use the same validated submission receipt contract', async () => {
  const batch = transformRows(satelliteRows(), satelliteLoaded.config);
  let submitted;
  const result = await submitBatch(batch, 'https://receiver.invalid/api/model-inputs', { token, fetchImpl: async (_url, request) => {
    submitted = JSON.parse(request.body);
    return Response.json(receipt(batch), { status: 201 });
  } });
  assert.equal(result.status, 201);
  assert.equal(result.receivedAt, receipt(batch).batch.receivedAt);
  assert.deepEqual(submitted, batch);
});

test('satellite optional artifact hashes and numeric native support map through the collector', () => {
  const config = structuredClone(satelliteLoaded.config);
  config.fields.sourceArtifactHash = 'artifact_sha256';
  const input = satelliteRows();
  input.forEach((row) => { row.artifact_sha256 = 'CD'.repeat(32); row.native_support_m = String(row.native_support_m); });
  const normalized = transformRows(input, config).observations;
  assert.equal(normalized[0].sourceArtifactHash, 'cd'.repeat(32));
  assert.equal(normalized[2].nativeSupportMeters, 10000);
});
