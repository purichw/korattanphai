import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { contentHash } from '../../server/admin-data/contract.mjs';
import { validateBatch } from '../../server/model-inputs/contract.mjs';

test('CMS draft lifecycle is durable, permission checked, conflict safe and atomically accepted', async () => {
  const db = new PGlite();
  const actor = '11111111-1111-4111-8111-111111111111';
  const outsider = '22222222-2222-4222-8222-222222222222';
  const batch = { schemaVersion: 1, sourceId: 'cms-test', batchId: 'test-v1', observations: [{ stationId: 'ST-1',
    observedAt: '2026-09-01T00:00:00Z', metric: 'rainfall', value: 0, unit: 'mm', aggregation: 'sum', periodMinutes: 60, quality: 'reported' }] };
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${actor}');`);
    for (const file of ['20260909010000_model_input_batches.sql', '20260927010000_cms_data_drafts.sql']) {
      await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
    await db.exec(`insert into auth.users values ('${outsider}')`);
    const op = async (operation, args = {}, user = actor) => (await db.query(
      'select public.ktp_cms_operation($1::uuid,$2::text,$3::jsonb) result', [user, operation, JSON.stringify(args)])).rows[0].result;
    await db.exec('set role authenticated');
    await assert.rejects(op('access'), /permission denied/);
    await assert.rejects(db.query('select * from public.ktp_cms_drafts'), /permission denied/);
    await db.exec('reset role; set role service_role');
    await assert.rejects(op('access', {}, outsider), /cms_forbidden/);
    let draft = await op('create', { kind: 'station', title: 'Draft', sourceFilename: 'test.xlsx', payload: batch, originalHash: contentHash(batch) });
    assert.equal(draft.revision, 1);
    const id = draft.id;
    const changed = structuredClone(batch); changed.observations[0].value = 5;
    draft = await op('edit', { id, revision: 1, reason: 'Verified source', payload: changed });
    assert.equal(draft.revision, 2);
    assert.deepEqual((await op('get', { id })).payload, changed);
    assert.deepEqual((await op('original', { id })).payload, batch);
    await assert.rejects(op('edit', { id, revision: 1, reason: 'Stale', payload: batch }), /cms_revision_conflict/);
    assert.equal((await op('audit', { id })).length, 2);
    const canonical = validateBatch(changed);
    draft = await op('accept', { id, revision: 2, reason: 'Reviewed', payload: canonical, contentHash: contentHash(canonical) });
    assert.equal(draft.state, 'accepted');
    assert.equal(draft.revision, 3);
    assert.equal((await db.query('select payload from public.model_input_batches')).rows[0].payload.observations[0].value, 5);
    await assert.rejects(op('edit', { id, revision: 3, reason: 'Overwrite', payload: batch }), /cms_immutable/);
    await assert.rejects(db.query('update public.ktp_cms_audit set reason = $1', ['tamper']), /permission denied/);
    const duplicate = await op('create', { kind: 'station', title: 'Retry', sourceFilename: 'test.xlsx', payload: batch, originalHash: contentHash(batch) });
    await assert.rejects(op('accept', { id: duplicate.id, revision: 1, reason: 'Duplicate', payload: batch, contentHash: contentHash(batch) }), /duplicate key/);
    assert.equal((await op('get', { id: duplicate.id })).state, 'draft');
    assert.equal((await op('audit', { id: duplicate.id })).length, 1);
    await db.exec('reset role');
    await db.query('update public.ktp_cms_operators set enabled=false where user_id=$1', [actor]);
    await db.exec('set role service_role');
    await assert.rejects(op('get', { id }), /cms_forbidden/);
  } finally { await db.close(); }
});
