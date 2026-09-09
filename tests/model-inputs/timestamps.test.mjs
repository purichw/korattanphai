import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHandler } from '../../server/model-inputs/handler.mjs';
import { submitBatch } from '../../server/model-inputs/collector.mjs';
import { validateReceivedAt } from '../../server/model-inputs/contract.mjs';

test('PostgreSQL microsecond receipts and pagination cursors survive the actual API and collector', async (t) => {
  const token = 'test-microsecond-receipt-token-123456789';
  const timestamp = '2026-09-08T12:00:00.123456+00:00';
  let stored;
  const metadata = (id) => ({ sourceId: 'test', batchId: id, contentHash: 'a'.repeat(64), receivedAt: timestamp, observationCount: 1 });
  const store = {
    async put(batch, contentHash) { stored = { ...batch, contentHash, receivedAt: timestamp }; return { created: true, batch: stored }; },
    async get() { return stored; },
    async list(_sourceId, { before }) {
      if (before) { assert.deepEqual(before, { batchId: 'b', receivedAt: timestamp }); return [metadata('a')]; }
      return [metadata('b'), metadata('a')];
    },
  };
  const server = createServer(createHandler({ sourceId: 'test', token, store }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/model-inputs`;
  const batch = { schemaVersion: 1, sourceId: 'test', batchId: 'b', observations: [{ stationId: 's', observedAt: '2026-09-08T00:00:00Z', metric: 'rainfall', value: 0, unit: 'mm', aggregation: 'sum', periodMinutes: 60, quality: 'reported' }] };
  assert.deepEqual(await submitBatch(batch, endpoint, { token }), { status: 201, duplicate: false, receivedAt: timestamp });
  const headers = { Authorization: `Bearer ${token}` };
  const first = await (await fetch(`${endpoint}?limit=1`, { headers })).json();
  assert.equal(first.items[0].receivedAt, timestamp);
  const second = await fetch(`${endpoint}?limit=1&cursor=${first.nextCursor}`, { headers });
  assert.equal(second.status, 200);
  assert.equal((await second.json()).items[0].batchId, 'a');
});

test('storage timestamps validate real Gregorian dates even with microseconds', () => {
  assert.equal(validateReceivedAt('2026-09-08T00:00:00.000001Z'), '2026-09-08T00:00:00.000001Z');
  for (const value of ['2026-02-30T00:00:00.123456Z', '2026-09-08T00:00:00.1234567Z', '2026-09-08T00:00:00.1+14:30']) assert.throws(() => validateReceivedAt(value));
});
