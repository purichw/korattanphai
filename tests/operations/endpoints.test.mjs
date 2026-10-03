import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { readSmallJson } from '../../server/operations/http.mjs';
import { createHealthHandler, createArchiveProbe } from '../../server/operations/health.mjs';
import { createTelemetryHandler, validateTelemetry } from '../../server/operations/telemetry.mjs';
import { createMemoryRateLimiter } from '../../server/operations/rate-limit.mjs';
import { checkOperationalHealth, validateMonitorUrl } from '../../server/operations/monitor.mjs';

async function serve(t, handler) {
  const server = http.createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}
const quiet = () => {};
const token = 'test-only-health-token-that-is-at-least-32-chars';

test('health distinguishes public liveness from authenticated dependency readiness', async t => {
  let calls = 0;
  const base = await serve(t, createHealthHandler({ token, probe: async () => { calls++; }, log: quiet }));
  assert.deepEqual(await (await fetch(base)).json(), { status: 'ok', scope: 'process' });
  assert.equal((await fetch(`${base}?mode=readiness`)).status, 401);
  assert.equal(calls, 0);
  const ready = await fetch(`${base}?mode=readiness`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(ready.status, 200); assert.equal(calls, 1);
  assert.match(ready.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
  assert.match(ready.headers.get('cache-control'), /no-store/);
  assert.equal((await fetch(`${base}?mode=readiness&mode=liveness`)).status, 400);
});

test('readiness fails closed on absent config and hides provider exception details', async t => {
  const absent = await serve(t, createHealthHandler({ log: quiet }));
  assert.equal((await fetch(`${absent}?mode=readiness`)).status, 503);
  const broken = await serve(t, createHealthHandler({ token, probe: async () => { throw new Error('PRIVATE_DATABASE_PASSWORD'); }, log: quiet }));
  const response = await fetch(`${broken}?mode=readiness`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 503); assert(!((await response.text()).includes('PRIVATE_DATABASE_PASSWORD')));
});

test('archive probe rejects HTML, no publication, oversized bodies and a never-ending dependency', async () => {
  const options = { url: 'https://sampleproject.supabase.co', key: 'sb_secret_test_only_not_real_000000' };
  const valid = [{ dataset_id: '11111111-1111-4111-8111-111111111111', published_at: '2026-09-09T00:00:00Z', source_time_role: 'CONFIRMED_SOURCE_IS_ORIGIN' }];
  assert.deepEqual(await createArchiveProbe({ ...options, fetchImpl: async target => {
    assert.equal(target.searchParams.get('source_time_role'), 'eq.CONFIRMED_SOURCE_IS_ORIGIN');
    assert.equal(target.searchParams.get('archive_manifest->meta->>sourceOfTruth'), 'in.(normalized_rev03_original_workbook,admin_reviewed_forecast)');
    return Response.json(valid);
  } })(), { publishedArchive: 'available' });
  await assert.rejects(createArchiveProbe({ ...options, fetchImpl: async () => Response.json([{ ...valid[0], source_time_role: 'CONFIRMED_SOURCE_IS_TARGET' }]) })());
  for (const response of [new Response('<html>login</html>'), Response.json([]), Response.json({ text: 'x'.repeat(5000) })]) await assert.rejects(createArchiveProbe({ ...options, fetchImpl: async () => response })());
  await assert.rejects(createArchiveProbe({ ...options, timeoutMs: 10, fetchImpl: () => new Promise(() => {}) })(), /dependency_timeout/);
});

test('telemetry rejects private fields, cross-origin reports and invalid metric combinations', async t => {
  const logs = [];
  const handler = createTelemetryHandler({ enabled: true, origins: ['https://korattanphai.vercel.app'], limiter: createMemoryRateLimiter({ requestsPerMinute: 2, dailyQuota: 10 }), log: entry => logs.push(entry) });
  const base = await serve(t, handler);
  const event = { schemaVersion: 1, event: 'runtime_error', code: 'RENDER_FAILED', route: 'overview', viewport: 'mobile' };
  const post = (body, origin = 'https://korattanphai.vercel.app') => fetch(base, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({ ...event, message: 'private@example.com' })).status, 400);
  assert.equal((await post(event, 'https://attacker.example')).status, 403);
  assert.equal((await post(event)).status, 204);
  assert.equal((await post(event)).status, 204);
  const limited = await post(event); assert.equal(limited.status, 429); assert(Number(limited.headers.get('retry-after')) > 0);
  assert(!logs.join('\n').includes('private@example.com'));
  assert.equal(logs.map(JSON.parse).filter(entry => entry.category === 'browser_operational_event').length, 2);
  assert.throws(() => validateTelemetry({ ...event, metric: 'LCP', value: 10 }));
  assert.throws(() => validateTelemetry({ ...event, event: 'web_vital', code: 'CLS', metric: 'LCP', value: 10 }));
  assert.throws(() => validateTelemetry({ ...event, requestId: 'user-123' }));
  assert.equal((await post({ ...event, event: ['runtime_error'] })).status, 400);
  assert.equal((await post({ ...event, event: ['web_vital'], code: 'LCP' })).status, 400);
});

test('telemetry off is silent; quotas unavailable fail closed; excessive payload rejected', async t => {
  const off = await serve(t, createTelemetryHandler({ log: () => { throw new Error('must not log'); } }));
  assert.equal((await fetch(off, { method: 'POST' })).status, 204);
  const broken = await serve(t, createTelemetryHandler({ enabled: true, origins: ['https://korattanphai.vercel.app'], limiter: { consume: async () => { throw new Error('private-key'); } }, log: quiet }));
  const headers = { Origin: 'https://korattanphai.vercel.app', 'Content-Type': 'application/json' };
  const response = await fetch(broken, { method: 'POST', headers, body: JSON.stringify({ schemaVersion: 1, event: 'map_load', code: 'LOAD_OK', route: 'overview', viewport: 'mobile', durationMs: 10 }) });
  assert.equal(response.status, 503); assert(!((await response.text()).includes('private-key')));
  assert.equal((await fetch(broken, { method: 'POST', headers, body: JSON.stringify({ data: 'x'.repeat(2000) }) })).status, 413);
});

test('monitor bounds hung probes, rejects redirects/HTML APIs and preserves no secret in report', async () => {
  assert.throws(() => validateMonitorUrl('https://attacker.example'));
  assert.throws(() => validateMonitorUrl('https://korattanphai-not-our-project.vercel.app'));
  assert.throws(() => validateMonitorUrl('https://user:password@korattanphai.vercel.app'));
  const report = await checkOperationalHealth({ url: 'https://korattanphai.vercel.app', readiness: true, healthToken: token, timeoutMs: 10, fetchImpl: async url => {
    if (url.pathname === '/login') return new Response('<html><script type="module" src="/assets/app.js"></script></html>', { headers: { 'content-type': 'text/html' } });
    if (url.pathname === '/api/health' && !url.search) return Response.json({ status: 'ok', scope: 'process' });
    throw new Error(token);
  } });
  assert.equal(report.status, 'failed'); assert.equal(report.checks[0].status, 'passed'); assert.equal(report.checks[1].status, 'passed');
  assert(!JSON.stringify(report).includes(token));
  const hung = await checkOperationalHealth({ url: 'http://localhost', timeoutMs: 10, fetchImpl: () => new Promise(() => {}) });
  assert(hung.checks.every(check => check.status === 'failed'));
});

test('monitor probes real process health separately from published forecast readiness', async () => {
  const requests = [];
  const report = await checkOperationalHealth({ url: 'https://korattanphai.vercel.app', readiness: true, healthToken: token, fetchImpl: async (url, options) => {
    requests.push({ path: url.pathname + url.search, authorization: options.headers?.Authorization });
    if (url.pathname === '/login') return new Response('<html><script type="module" src="/assets/app.js"></script></html>', { headers: { 'content-type': 'text/html' } });
    if (url.pathname === '/api/health' && !url.search) return Response.json({ status: 'ok', scope: 'process' });
    if (url.pathname === '/api/health' && url.search === '?mode=readiness') return Response.json({ status: 'ready', scope: 'published_archive', checks: { publishedArchive: 'available' } });
    throw new Error('Unexpected endpoint');
  } });
  assert.equal(report.status, 'passed');
  assert.deepEqual(report.checks.map(check => check.name), ['login_document', 'health_liveness', 'published_archive_readiness']);
  assert.deepEqual(requests, [
    { path: '/login', authorization: undefined },
    { path: '/api/health', authorization: undefined },
    { path: '/api/health?mode=readiness', authorization: `Bearer ${token}` },
  ]);
  assert(!JSON.stringify(report).includes(token));
});

test('monitor rejects HTML and misleading payloads from the health endpoint', async () => {
  for (const bad of [new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } }), Response.json({ status: 'ready', scope: 'published_archive' }), Response.json({ status: 'ok', scope: 'other' })]) {
    const report = await checkOperationalHealth({ url: 'https://korattanphai.vercel.app', fetchImpl: async url => url.pathname === '/login'
      ? new Response('<html><script type="module" src="/assets/app.js"></script></html>', { headers: { 'content-type': 'text/html' } }) : bad });
    assert.equal(report.status, 'failed');
    assert.equal(report.checks.find(check => check.name === 'health_liveness').status, 'failed');
  }
});

test('partial chunked uploads expire and stop reading without leaking data', async () => {
  const request = new PassThrough();
  request.headers = { 'content-type': 'application/json' };
  request.write('{');
  await assert.rejects(readSmallJson(request, 1024, 10), error => error.status === 408 && error.code === 'request_timeout');
  assert.equal(request.destroyed, true);
});
