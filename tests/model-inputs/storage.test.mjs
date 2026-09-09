import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createFileStore, createSupabaseStore } from '../../server/model-inputs/storage.mjs';

const project = fileURLToPath(new URL('../../', import.meta.url));
const artifactRoot = path.join(project, 'artifacts/model-input-tests');
const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const sourceId = 'station-feed';
const receivedAt = '2026-09-09T00:00:00.123456+00:00';
const envelope = (batchId = '2026-09-09T00:00:00.000Z') => ({
  schemaVersion: 1, sourceId, batchId,
  observations: [{ stationId: 'station-1', observedAt: '2026-09-09T00:00:00Z', rainfallMm: 0 }],
});
const databaseRow = (batch = envelope(), contentHash = hashA) => ({ source_id: batch.sourceId, batch_id: batch.batchId,
  content_hash: contentHash, received_at: receivedAt, payload: batch, observation_count: batch.observations.length });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const conflict = error => error?.status === 409 && error?.code === 'batch_conflict';
const unavailable = error => error?.status === 503 && error?.code === 'storage_unavailable';
const batchFileName = id => `${createHash('sha256').update(id).digest('hex')}.json`;

async function directory() {
  await fs.mkdir(artifactRoot, { recursive: true });
  return fs.mkdtemp(path.join(artifactRoot, 'storage-'));
}

test('file store publishes one immutable complete batch across concurrent writers and restart', async () => {
  const dir = await directory();
  const store = createFileStore(dir);
  const batch = envelope();
  batch.observations[0].context = 'x'.repeat(500_000);
  assert.equal(await store.get(sourceId, batch.batchId), null);
  assert.deepEqual(await store.list(sourceId, { limit: 10 }), []);
  const writes = Array.from({ length: 12 }, () => createFileStore(dir).put(batch, hashA));
  const reads = Array.from({ length: 12 }, () => store.get(sourceId, batch.batchId));
  const results = await Promise.all(writes);
  assert.equal(results.filter(result => result.created).length, 1);
  for (const result of results) assert.deepEqual(result.batch, results[0].batch);
  for (const read of await Promise.all(reads)) if (read) assert.deepEqual(read, results[0].batch);
  const restarted = createFileStore(dir);
  assert.deepEqual(await restarted.get(sourceId, batch.batchId), results[0].batch);
  assert.deepEqual(await restarted.put(batch, hashA), { created: false, batch: results[0].batch });
  await assert.rejects(restarted.put({ ...batch, observations: [] }, hashB), conflict);
  assert.deepEqual(await restarted.get(sourceId, batch.batchId), results[0].batch);
  const otherSource = { ...batch, sourceId: 'other-feed' };
  assert.equal((await restarted.put(otherSource, hashB)).created, true);
  const files = await fs.readdir(path.join(dir, sourceId));
  assert.deepEqual(files, [batchFileName(batch.batchId)]);
});

test('different concurrent content cannot overwrite the same file-store identity', async () => {
  const store = createFileStore(await directory());
  const batch = envelope('collision');
  const attempts = await Promise.allSettled([store.put(batch, hashA), store.put({ ...batch, observations: [] }, hashB)]);
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
  assert.ok(conflict(attempts.find(result => result.status === 'rejected').reason));
  const winner = attempts.find(result => result.status === 'fulfilled').value;
  assert.deepEqual(await store.get(sourceId, batch.batchId), winner.batch);
});

test('file metadata pages have stable timestamp/id ordering and skip crash temp files', async () => {
  const dir = await directory();
  const store = createFileStore(dir);
  const records = [
    ['a', '2026-09-09T00:00:00.000Z'], ['b', '2026-09-09T00:00:00.000Z'],
    ['c', '2026-09-08T00:00:00.000Z'], ['A', '2026-09-09T00:00:00.000Z'],
  ];
  await fs.mkdir(path.join(dir, sourceId));
  for (const [id, time] of records) {
    await fs.writeFile(path.join(dir, sourceId, batchFileName(id)), JSON.stringify({ ...envelope(id), contentHash: hashA, receivedAt: time }));
  }
  await fs.writeFile(path.join(dir, sourceId, '.pending-interrupted.tmp'), '{partial');
  const first = await store.list(sourceId, { limit: 2 });
  assert.deepEqual(first.map(row => row.batchId), ['b', 'a']);
  assert.deepEqual(Object.keys(first[0]).sort(), ['batchId', 'contentHash', 'observationCount', 'receivedAt', 'sourceId']);
  assert.equal(first[0].observationCount, 1);
  const second = await createFileStore(dir).list(sourceId, { limit: 2, before: first.at(-1) });
  assert.deepEqual(second.map(row => row.batchId), ['A', 'c']);
  assert.deepEqual(await store.list(sourceId, { limit: 2, before: second.at(-1) }), []);
});

test('file paths reject traversal and symlinked source directories and fail safely on damaged batches', async () => {
  const dir = await directory();
  const store = createFileStore(dir);
  for (const invalid of ['../outside', '/outside', '..', '.', 'a/b', 'a\\b']) {
    await assert.rejects(store.get(sourceId, invalid), { code: 'invalid_storage_input' });
    await assert.rejects(store.list(invalid, { limit: 1 }), { code: 'invalid_storage_input' });
  }
  const outside = await directory();
  await fs.symlink(outside, path.join(dir, sourceId));
  await assert.rejects(store.put(envelope(), hashA), unavailable);
  assert.deepEqual(await fs.readdir(outside), []);
  const corruptDir = await directory();
  await fs.mkdir(path.join(corruptDir, sourceId));
  await fs.writeFile(path.join(corruptDir, sourceId, batchFileName('corrupt')), '{partial');
  await assert.rejects(createFileStore(corruptDir).get(sourceId, 'corrupt'), unavailable);
});

test('Supabase adapter inserts without upsert, resolves unique retries, and preserves server timestamps', async () => {
  const batch = envelope(); const calls = []; let saved = false;
  const store = createSupabaseStore({ url: 'https://example.supabase.co', key: 'secret-test-only', fetchImpl: async (url, options) => {
    calls.push({ url: new URL(url), options });
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.apikey, 'secret-test-only');
    assert.equal(options.headers.Authorization, 'Bearer secret-test-only');
    assert.ok(options.signal instanceof AbortSignal);
    assert.notEqual(options.headers.Prefer?.includes('resolution='), true);
    if (options.method === 'POST') {
      assert.equal(options.headers.Prefer, 'return=representation');
      const body = JSON.parse(options.body);
      assert.deepEqual(body.payload, batch);
      assert.equal(body.observation_count, 1);
      assert.equal(Object.hasOwn(body, 'received_at'), false);
      if (saved) return json({ message: 'private server diagnostic' }, 409);
      saved = true; return json([databaseRow(batch)], 201);
    }
    return json([databaseRow(batch)]);
  } });
  const first = await store.put(batch, hashA);
  assert.deepEqual(first, { created: true, batch: { ...batch, contentHash: hashA, receivedAt } });
  assert.deepEqual(await store.put(batch, hashA), { created: false, batch: first.batch });
  await assert.rejects(store.put(batch, hashB), conflict);
  const get = calls.find(call => call.options.method === 'GET').url;
  assert.equal(get.searchParams.get('source_id'), `eq.${sourceId}`);
  assert.equal(get.searchParams.get('batch_id'), `eq.${batch.batchId}`);
});

test('Supabase listing fetches only bounded metadata with a precise exclusive cursor', async () => {
  const rows = [databaseRow(envelope('b')), databaseRow(envelope('a'))];
  const seen = [];
  const store = createSupabaseStore({ url: 'https://example.supabase.co/', key: 'test-key', fetchImpl: async (url, options) => {
    const parsed = new URL(url); seen.push(parsed);
    assert.equal(options.method, 'GET');
    const select = parsed.searchParams.get('select');
    assert.equal(select, 'source_id,batch_id,content_hash,received_at,observation_count');
    return json(rows.map(({ payload, ...row }) => row));
  } });
  const result = await store.list(sourceId, { limit: 3, before: { receivedAt, batchId: 'c' } });
  assert.deepEqual(result.map(row => row.batchId), ['b', 'a']);
  assert.ok(result.every(row => !Object.hasOwn(row, 'observations') && !Object.hasOwn(row, 'payload')));
  assert.equal(seen[0].searchParams.get('limit'), '3');
  assert.equal(seen[0].searchParams.get('order'), 'received_at.desc,batch_id.desc');
  assert.equal(seen[0].searchParams.get('or'), `(received_at.lt.${receivedAt},and(received_at.eq.${receivedAt},batch_id.lt.c))`);
  for (const limit of [0, 102, 1.5]) await assert.rejects(store.list(sourceId, { limit }), { code: 'invalid_storage_input' });
  await assert.rejects(store.list(sourceId, { limit: 1, before: { receivedAt: `${receivedAt}),bad`, batchId: 'x' } }), { code: 'invalid_storage_input' });
  assert.equal(seen.length, 1);
});

test('Supabase adapter rejects unsafe config, redirects, corrupt/oversize bodies and secret-bearing errors', async () => {
  for (const url of ['http://example.supabase.co', 'https://user:pass@example.supabase.co', 'https://example.supabase.co/rest/v1', 'https://example.supabase.co?x=1']) {
    assert.throws(() => createSupabaseStore({ url, key: 'test-key' }), { code: 'invalid_storage_input' });
  }
  for (const response of [
    () => json([], 302),
    () => new Response('sensitive-password', { status: 500 }),
    () => new Response('private-invalid-json', { headers: { 'content-type': 'application/json' } }),
    () => new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { 'content-type': 'application/json' } }),
    () => new Response('[]', { headers: { 'content-type': 'application/json', 'content-length': '2097153' } }),
    () => json([{ ...databaseRow(), payload: {} }]),
    () => json([{ ...databaseRow(), observation_count: 2 }]),
    () => { throw new Error('Bearer super-secret-key; sensitive-password'); },
  ]) {
    const store = createSupabaseStore({ url: 'https://example.supabase.co', key: 'super-secret-key', fetchImpl: async () => response() });
    await assert.rejects(store.get(sourceId, envelope().batchId), error => unavailable(error)
      && !/sensitive|private|super-secret|Bearer/.test(error.message));
  }
  const missing = createSupabaseStore({ url: 'https://example.supabase.co', key: 'key', fetchImpl: async () => json([]) });
  assert.equal(await missing.get(sourceId, 'missing'), null);
});

test('Supabase batch reads and writes use apikey-only opaque secrets and retain legacy JWT Bearer auth', async () => {
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ role: 'service_role', iss: 'test-only' })).toString('base64url')}.test-signature`;
  for (const credential of ['sb_secret_test_only_opaque_server_key', jwt]) {
    const calls = [];
    const batch = envelope();
    const store = createSupabaseStore({ url: 'https://example.supabase.co', key: credential, fetchImpl: async (target, options) => {
      const parsed = new URL(target);
      calls.push(options.method);
      assert.equal(parsed.pathname, '/rest/v1/model_input_batches');
      assert.equal(options.headers.apikey, credential);
      const headers = new Headers(options.headers);
      assert.equal(headers.get('authorization'), credential.startsWith('sb_secret_') ? null : `Bearer ${credential}`);
      const row = databaseRow(batch);
      if (options.method === 'POST') return json([row], 201);
      if (parsed.searchParams.get('select').includes('payload')) return json([row]);
      const { payload, ...metadata } = row;
      return json([metadata]);
    } });
    assert.equal((await store.put(batch, hashA)).created, true);
    assert.equal((await store.get(sourceId, batch.batchId)).batchId, batch.batchId);
    assert.equal((await store.list(sourceId))[0].batchId, batch.batchId);
    assert.deepEqual(calls, ['POST', 'GET', 'GET']);
  }
});

test('Supabase request deadline aborts a stalled fetch and exposes only a safe storage error', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const store = createSupabaseStore({ url: 'https://example.supabase.co', key: 'test-key', fetchImpl: async (_, options) => {
    signal = options.signal;
    return new Promise(() => {});
  } });
  const waiting = assert.rejects(store.get(sourceId, 'stalled'), unavailable);
  context.mock.timers.tick(10_000);
  await waiting;
  assert.equal(signal.aborted, true);
});

test('additive SQL restricts rows to service reads/inserts and validates immutable batch envelopes', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; grant usage on schema public to anon, authenticated, service_role;');
    await db.exec(await fs.readFile(new URL('../../supabase/migrations/20260909010000_model_input_batches.sql', import.meta.url), 'utf8'));
    const batch = envelope();
    const asRole = (role, fn) => db.transaction(async tx => { await tx.exec(`set local role ${role}`); return fn(tx); });
    const insert = (tx, value = batch, hash = hashA, count = value.observations?.length ?? 0) => tx.query(
      'insert into model_input_batches(source_id,batch_id,content_hash,payload,observation_count) values ($1,$2,$3,$4,$5) returning received_at',
      [sourceId, batch.batchId, hash, JSON.stringify(value), count]);
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(asRole(role, tx => tx.query('select * from model_input_batches')), /permission denied/);
      await assert.rejects(asRole(role, tx => insert(tx)), /permission denied/);
    }
    assert.equal((await asRole('service_role', tx => insert(tx))).rows.length, 1);
    assert.equal((await asRole('service_role', tx => tx.query('select * from model_input_batches'))).rows.length, 1);
    await assert.rejects(asRole('service_role', tx => insert(tx)), /duplicate key/);
    for (const sql of ['update model_input_batches set content_hash=content_hash', 'delete from model_input_batches', 'truncate model_input_batches']) {
      await assert.rejects(asRole('service_role', tx => tx.exec(sql)), /permission denied/);
    }
    const invalidInsert = value => db.query(
      'insert into model_input_batches(source_id,batch_id,content_hash,payload,observation_count) values ($1,$2,$3,$4,$5)',
      [sourceId, 'invalid', hashA, JSON.stringify(value), 0]);
    for (const value of [{}, { schemaVersion: 1, sourceId, batchId: 'invalid' }, { ...batch, batchId: 'invalid', sourceId: 'other-feed', observations: [] }]) {
      await assert.rejects(invalidInsert(value), /check constraint/);
    }
    const info = (await db.query("select relrowsecurity from pg_class where relname='model_input_batches'")).rows[0];
    assert.equal(info.relrowsecurity, true);
  } finally { await db.close(); }
});
