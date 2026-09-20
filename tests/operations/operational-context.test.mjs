import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOperationalContextHandler } from '../../server/operations/operational-context.mjs';

function invoke(url, time = '2026-09-30T17:00:00Z', method = 'GET') {
  const result = { headers: {}, status: 0, body: null };
  const response = { setHeader: (key, value) => { result.headers[key.toLowerCase()] = value; },
    set statusCode(value) { result.status = value; }, end: value => { result.body = JSON.parse(value); } };
  createOperationalContextHandler({ now: () => new Date(time) })({ url, method }, response);
  return result;
}
test('trusted Bangkok cutoff defaults to actual current month with no fabricated catalog', () => {
  const result = invoke('/api/operational-context');
  assert.equal(result.status, 200);
  assert.equal(result.body.currentPeriod, '2026-10');
  assert.equal(result.body.family, 'actual');
  assert.equal(result.body.validPeriod, '2026-10');
  assert.deepEqual(result.body.actualPeriods, []);
  assert.equal(result.body.latestActualPeriod, null);
  assert.match(result.headers['cache-control'], /no-store/);
  assert.equal(result.body.records, undefined);
});
test('same selected month re-resolves across boundary without trusting requested kind', () => {
  assert.equal(invoke('/api/operational-context?period=2026-10', '2026-09-30T16:59:59Z').body.family, 'forecast');
  assert.equal(invoke('/api/operational-context?period=2026-10').body.family, 'actual');
  assert.equal(invoke('/api/operational-context?period=2026-08&kind=forecast').status, 400);
});
test('invalid queries and methods fail without fallback', () => {
  for (const query of ['?period=2026-13', '?period=2569-09', '?period=', '?period=2026-09&period=2026-10', '?horizon=1']) assert.equal(invoke(`/api/operational-context${query}`).status, 400);
  assert.equal(invoke('/api/operational-context', undefined, 'POST').status, 405);
});
