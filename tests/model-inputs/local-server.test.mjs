import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { startModelInputServer } from '../../scripts/serve-model-inputs.mjs';

const sourceId = 'local-server-test';
const writerToken = 'test-local-server-writer-0123456789012345';
const rotatedToken = 'test-local-server-rotation-012345678901234';
const readerToken = 'test-local-server-reader-0123456789012345';
async function serve(t, overrides) {
  const artifacts = fileURLToPath(new URL('../../artifacts/model-input-tests/', import.meta.url));
  await fs.mkdir(artifacts, { recursive: true });
  const directory = await fs.mkdtemp(path.join(artifacts, 'local-server-'));
  const server = startModelInputServer({ MODEL_INPUT_SOURCE_ID: sourceId, MODEL_INPUT_PORT: '0', MODEL_INPUT_DATA_DIR: directory, ...overrides });
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return async (token, { body } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/model-inputs`, {
      method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, headers: response.headers, data: await response.json() };
  };
}
const batch = { schemaVersion: 1, sourceId, batchId: 'local-rotation-test', observations: [{ stationId: 'station-1', observedAt: '2026-09-09T00:00:00Z', metric: 'rainfall', value: 0, unit: 'mm', aggregation: 'sum', periodMinutes: 60, quality: 'reported' }] };

test('standalone server accepts clients-only config and shares quota between rotation slots', async t => {
  const request = await serve(t, { MODEL_INPUT_API_TOKEN: '', MODEL_INPUT_RATE_LIMIT_PER_MINUTE: '2', MODEL_INPUT_DAILY_QUOTA: '10',
    MODEL_INPUT_CLIENTS_JSON: JSON.stringify([
      { id: 'source-writer', sourceId, role: 'writer', tokens: [writerToken, rotatedToken] },
      { id: 'model-reader', sourceId, role: 'reader', tokens: [readerToken] },
    ]) });
  const created = await request(writerToken, { body: batch }); assert.equal(created.status, 201);
  const replay = await request(rotatedToken, { body: batch }); assert.equal(replay.status, 200); assert.deepEqual(replay.data.batch, created.data.batch);
  const blocked = await request(writerToken); assert.equal(blocked.status, 429); assert.equal(blocked.headers.get('x-ratelimit-limit'), '2');
  const reader = await request(readerToken); assert.equal(reader.status, 200); assert.equal(reader.data.items.length, 1);
  assert.equal((await request(readerToken, { body: batch })).status, 403);
});

test('standalone legacy auth honors supplied minute and daily quota environment values', async t => {
  const request = await serve(t, { MODEL_INPUT_API_TOKEN: writerToken, MODEL_INPUT_RATE_LIMIT_PER_MINUTE: '1', MODEL_INPUT_DAILY_QUOTA: '1' });
  const first = await request(writerToken); assert.equal(first.status, 200);
  assert.equal(first.headers.get('x-ratelimit-limit'), '1'); assert.equal(first.headers.get('x-dailyquota-limit'), '1');
  const second = await request(writerToken); assert.equal(second.status, 429); assert.ok(Number(second.headers.get('retry-after')) >= 1);
});

test('standalone server rejects malformed quota and client environment instead of ignoring it', () => {
  const base = { MODEL_INPUT_SOURCE_ID: sourceId, MODEL_INPUT_PORT: '0', MODEL_INPUT_API_TOKEN: writerToken };
  for (const value of ['0', 'NaN', '-1', '60001']) assert.throws(() => startModelInputServer({ ...base, MODEL_INPUT_RATE_LIMIT_PER_MINUTE: value }), /Invalid MODEL_INPUT_RATE_LIMIT_PER_MINUTE/);
  assert.throws(() => startModelInputServer({ ...base, MODEL_INPUT_CLIENTS_JSON: '{' }), /Invalid MODEL_INPUT_CLIENTS_JSON/);
});
