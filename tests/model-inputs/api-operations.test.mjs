import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createIntegrationAuth, clientsFromEnvironment } from '../../server/operations/integration-auth.mjs';
import { createMemoryRateLimiter, createSupabaseRateLimiter, rateLimitOptionsFromEnvironment } from '../../server/operations/rate-limit.mjs';

const identity = { sourceId: 'local-source', clientId: 'local-ingestor' };
const token = 'test-only-integration-token-0123456789';
const url = 'https://example.supabase.co';
const key = 'test-server-only-key';
const quotaResponse = changes => new Response(JSON.stringify([{ allowed: true, retry_after_seconds: 0, remaining_minute: 59, remaining_daily: 9999, ...changes }]), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('integration identities reject ambiguity, cross-source configuration, weak keys, and unknown roles', () => {
  const client = { id: identity.clientId, sourceId: identity.sourceId, role: 'writer', tokens: [token] };
  const auth = createIntegrationAuth({ sourceId: identity.sourceId, clients: [client] });
  assert.deepEqual(auth.authenticate(`Bearer ${token}`), { id: client.id, role: 'writer', sourceId: identity.sourceId });
  for (const value of [undefined, token, `Basic ${token}`, `Bearer ${token}\n`, ['Bearer token']]) assert.equal(auth.authenticate(value), null);
  for (const clients of [null, [], [client, client], [{ ...client, role: 'admin' }], [{ ...client, sourceId: 'other-source' }],
    [{ ...client, tokens: ['weak'] }], [{ ...client, tokens: [token, token] }], [{ ...client, unknown: true }],
    [client, { ...client, id: 'second-client' }]]) assert.throws(() => createIntegrationAuth({ sourceId: identity.sourceId, clients }));
  assert.throws(() => createIntegrationAuth({ token, sourceId: identity.sourceId, clients: [client] }), /unique/);
  assert.deepEqual(clientsFromEnvironment(JSON.stringify([client])), [client]);
  assert.equal(clientsFromEnvironment(undefined), undefined);
  assert.throws(() => clientsFromEnvironment('{'), /MODEL_INPUT_CLIENTS_JSON/);
});

test('local quota has UTC minute/day windows, stable client scope, and deterministic parallel limits', async () => {
  let now = Date.parse('2026-09-09T23:58:59Z');
  const limiter = createMemoryRateLimiter({ requestsPerMinute: 2, dailyQuota: 3, now: () => now });
  const concurrent = await Promise.all(Array.from({ length: 10 }, () => limiter.consume(identity)));
  assert.equal(concurrent.filter(result => result.allowed).length, 2);
  assert.equal(concurrent[2].retryAfterSeconds, 1);
  assert.equal((await limiter.consume({ ...identity, clientId: 'another-client' })).allowed, true);
  now += 1000;
  assert.equal((await limiter.consume(identity)).allowed, true);
  const dailyLimited = await limiter.consume(identity);
  assert.equal(dailyLimited.allowed, false);
  assert.equal(dailyLimited.retryAfterSeconds, 60);
  assert.equal(dailyLimited.remainingDaily, 0);
  now += 60000;
  assert.deepEqual(await limiter.consume(identity), { allowed: true, retryAfterSeconds: 0, remainingMinute: 1, remainingDaily: 2 });
});

test('quota environment settings are bounded positive integers with explicit safe defaults', () => {
  assert.deepEqual(rateLimitOptionsFromEnvironment({}), { requestsPerMinute: 60, dailyQuota: 10000 });
  assert.deepEqual(rateLimitOptionsFromEnvironment({ MODEL_INPUT_RATE_LIMIT_PER_MINUTE: '5', MODEL_INPUT_DAILY_QUOTA: '90' }), { requestsPerMinute: 5, dailyQuota: 90 });
  for (const raw of ['0', '-1', '1.5', 'NaN', 'Infinity', '60001', '10 ']) assert.throws(() => rateLimitOptionsFromEnvironment({ MODEL_INPUT_RATE_LIMIT_PER_MINUTE: raw }));
  assert.throws(() => createMemoryRateLimiter({ dailyQuota: 0 }));
});

test('durable quota adapter hashes identity, calls only the fixed RPC, and preserves server response semantics', async () => {
  const requests = [];
  const limiter = createSupabaseRateLimiter({ url, key, fetchImpl: async (target, options) => { requests.push({ target, options }); return quotaResponse(); } });
  assert.deepEqual(await limiter.consume(identity), { allowed: true, retryAfterSeconds: 0, remainingMinute: 59, remainingDaily: 9999 });
  assert.equal(requests[0].target, `${url}/rest/v1/rpc/consume_model_input_quota`);
  const body = JSON.parse(requests[0].options.body);
  assert.match(body.p_scope_key, /^[a-f0-9]{64}$/);
  assert.equal(body.p_minute_limit, 60);
  assert.equal(body.p_daily_limit, 10000);
  assert.ok(!requests[0].options.body.includes(identity.clientId));
  assert.equal(requests[0].options.redirect, 'error');
  assert.equal(requests[0].options.headers.Authorization, `Bearer ${key}`);
  const rejected = createSupabaseRateLimiter({ url, key, fetchImpl: async () => quotaResponse({ allowed: false, retry_after_seconds: 24, remaining_minute: 0 }) });
  assert.equal((await rejected.consume(identity)).retryAfterSeconds, 24);
});

test('quota adapter rejects unsafe targets, redirects, malformed/oversized upstream replies, and timeouts', async () => {
  for (const value of ['http://example.test', `${url}/path`, 'https://user:pass@example.test', `${url}?secret=x`]) assert.throws(() => createSupabaseRateLimiter({ url: value, key }));
  const badResponses = [
    () => new Response('private upstream error', { status: 500 }),
    () => new Response('redirect', { status: 302, headers: { Location: 'https://other.test' } }),
    () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
    () => quotaResponse({ allowed: 'true' }), () => quotaResponse({ retry_after_seconds: 1 }),
    () => quotaResponse({ allowed: false, retry_after_seconds: 0 }),
    () => new Response('x'.repeat(4097), { headers: { 'Content-Type': 'application/json' } }),
    () => new Response('[]', { headers: { 'Content-Type': 'application/json', 'Content-Length': '5000' } }),
  ];
  for (const response of badResponses) {
    const limiter = createSupabaseRateLimiter({ url, key, fetchImpl: async () => response() });
    await assert.rejects(limiter.consume(identity), error => error.code === 'rate_limit_unavailable' && !error.message.includes('private'));
  }
  const stalled = createSupabaseRateLimiter({ url, key, timeoutMs: 10, fetchImpl: () => new Promise(() => {}) });
  await assert.rejects(stalled.consume(identity), { code: 'rate_limit_unavailable' });
});

test('prepared PostgreSQL quota migration executes, denies public/table access, and atomically caps queued consumption', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await readFile(new URL('../../supabase/migrations/20260909020000_model_input_api_quota.sql', import.meta.url), 'utf8'));
  const hash = 'a'.repeat(64);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from public.consume_model_input_quota($1, 3, 5)', [hash]), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  await assert.rejects(db.query('select * from public.model_input_api_quotas'), /permission denied/);
  const results = await Promise.all(Array.from({ length: 12 }, () => db.query('select * from public.consume_model_input_quota($1, 3, 5)', [hash])));
  assert.equal(results.filter(result => result.rows[0].allowed).length, 3);
  assert.ok(results.slice(3).every(result => result.rows[0].remaining_minute === 0 && result.rows[0].retry_after_seconds >= 1));
  await db.exec('reset role');
  assert.equal((await db.query('select minute_count from public.model_input_api_quotas where scope_key = $1', [hash])).rows[0].minute_count, 3);
  await db.query('update public.model_input_api_quotas set minute_start = minute_start - 60 where scope_key = $1', [hash]);
  assert.equal((await db.query('select * from public.consume_model_input_quota($1, 3, 5)', [hash])).rows[0].allowed, true);
  await db.query('select * from public.consume_model_input_quota($1, 3, 5)', [hash]);
  const dailyBlocked = (await db.query('select * from public.consume_model_input_quota($1, 3, 5)', [hash])).rows[0];
  assert.equal(dailyBlocked.allowed, false);
  assert.equal(dailyBlocked.remaining_daily, 0);
  await db.query('update public.model_input_api_quotas set minute_start = minute_start - 60, day_start = day_start - 86400 where scope_key = $1', [hash]);
  assert.equal((await db.query('select * from public.consume_model_input_quota($1, 3, 5)', [hash])).rows[0].allowed, true);
  await assert.rejects(db.query('select * from public.consume_model_input_quota($1, 0, 5)', [hash]), /Invalid quota/);
  // PGlite has one connection; independent production connection load is not covered.
});

test('quota RPC uses an opaque secret only as apikey while legacy service-role JWTs also use Bearer', async () => {
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ role: 'service_role', iss: 'test-only' })).toString('base64url')}.test-signature`;
  for (const credential of ['sb_secret_test_only_opaque_server_key', jwt]) {
    let calls = 0;
    const limiter = createSupabaseRateLimiter({ url, key: credential, fetchImpl: async (target, options) => {
      calls++;
      assert.equal(target, `${url}/rest/v1/rpc/consume_model_input_quota`);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.apikey, credential);
      const headers = new Headers(options.headers);
      assert.equal(headers.get('authorization'), credential.startsWith('sb_secret_') ? null : `Bearer ${credential}`);
      return quotaResponse();
    } });
    assert.equal((await limiter.consume(identity)).allowed, true);
    assert.equal(calls, 1);
  }
});
