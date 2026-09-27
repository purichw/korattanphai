import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createCmsHandler } from '../../server/admin-data/handler.mjs';

test('HTTP admin boundary verifies identity, forbids actor injection, revalidates writes and does not leak storage errors', async () => {
  const calls = [];
  const payload = { schemaVersion: 1, sourceId: 'cms-test', batchId: 'v1', observations: [{ stationId: 'S-1',
    observedAt: '2026-09-01T00:00:00Z', metric: 'rainfall', value: 0, unit: 'mm', aggregation: 'sum', periodMinutes: 60, quality: 'reported' }] };
  const id = '11111111-1111-4111-8111-111111111111';
  const draft = { id, kind: 'station', payload, revision: 1, state: 'draft' };
  const handler = createCmsHandler({
    authenticate: async token => token === 'test-session' ? id : null,
    operation: async (actor, operation, args) => {
      calls.push({ actor, operation, args });
      if (operation === 'get') return draft;
      if (operation === 'accept') return { ...draft, state: 'accepted', revision: 2 };
      if (operation === 'list') throw new Error('secret internal connection string');
      return {};
    },
  });
  const server = createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/admin-data`;
  const request = (path, body, token = 'test-session') => fetch(url + path, {
    method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    assert.equal((await request('?action=schema', null, '')).status, 401);
    assert.equal((await request('?action=schema', null, 'forged-token')).status, 401);
    assert.equal(calls.length, 0);
    assert.equal((await request('?action=schema')).status, 200);
    assert.equal((await request(`?action=accept&id=${id}`, { revision: 1, reason: 'test', actor: id })).status, 400);
    assert.equal((await request(`?action=accept&id=${id}`, { revision: 2, reason: 'test' })).status, 409);
    payload.observations[0].value = null;
    const rejected = await request(`?action=accept&id=${id}`, { revision: 1, reason: 'test' });
    assert.equal(rejected.status, 422);
    assert.equal(calls.some(call => call.operation === 'accept'), false);
    payload.observations[0].quality = 'missing';
    assert.equal((await request(`?action=accept&id=${id}`, { revision: 1, reason: 'test' })).status, 200);
    assert.equal(calls.filter(call => call.operation === 'accept').length, 1);
    assert.equal(calls.at(-1).args.payload.observations[0].value, null);
    const failed = await request('?action=list');
    assert.equal(failed.status, 503);
    assert.equal((await failed.text()).includes('secret'), false);
    assert.equal((await request('?action=schema&action=list')).status, 400);
    assert.equal((await request('?action=schema&unknown=1')).status, 400);
  } finally { server.close(); await once(server, 'close'); }
});
