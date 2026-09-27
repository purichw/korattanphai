import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { prepareReferenceSeed } from '../../scripts/prepare-cms-reference-seed.mjs';
import { assertResourceEdit, handleResourceAction } from '../../server/admin-data/resources.mjs';
import { cmsReferencePlugin } from '../../scripts/cms-reference-plugin.mjs';
import { resolve } from 'node:path';

const actor = '10000000-0000-4000-8000-000000000001';
test('reference edits preserve keys, nulls, types and identity', () => {
  const source = { records: [{ subdistrictCode: '300101', nameTh: 'เดิม', value: 0, absent: null }] };
  assert.doesNotThrow(() => assertResourceEdit(source, { records: [{ ...source.records[0], nameTh: 'แก้ไข', value: 2 }] }));
  for (const next of [{ records: [] }, { records: [{ ...source.records[0], subdistrictCode: '300102' }] },
    { records: [{ ...source.records[0], absent: 0 }] }, { records: [{ ...source.records[0], value: '0' }] }]) {
    assert.throws(() => assertResourceEdit(source, next));
  }
});

test('all registered resources migrate losslessly; public reads, history, conflicts and immutable publication', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key);insert into auth.users values('${actor}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;`);
    for (const name of ['20260909010000_model_input_batches.sql', '20260927010000_cms_data_drafts.sql', '20260927030000_cms_reference_resources.sql'])
      await db.exec(await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8'));
    const seed = await prepareReferenceSeed();
    await db.exec(seed.sql);
    await db.exec(seed.sql); // Idempotent, never duplicates an initial version.
    const migrated = (await db.query('select resource_key,payload from ktp_cms_resources')).rows;
    assert.equal(migrated.length, seed.resources.length);
    for (const resource of seed.resources) assert.deepEqual(migrated.find(row => row.resource_key === resource.key).payload, resource.payload);
    await db.exec('set role anon');
    await assert.rejects(db.query('select public.ktp_cms_reference_catalog()'), /permission denied/);
    await assert.rejects(db.query('select * from public.ktp_cms_resources'), /permission denied/);
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${actor}',false)`);
    const catalog = (await db.query('select public.ktp_cms_reference_catalog() result')).rows[0].result;
    assert.equal(catalog.length, seed.resources.length);
    const ids = catalog.filter(row => seed.resources.find(resource => resource.key === row.resource_key).preload).map(row => row.id);
    const bundle = (await db.query('select public.ktp_cms_reference_bundle($1::uuid[]) result', [ids])).rows[0].result;
    assert.equal(Object.keys(bundle).length, 34);
    await assert.rejects(db.query('select public.ktp_cms_reference_bundle($1::uuid[])', [[...ids, actor]]), /Incomplete/);
    const published = catalog.find(row => row.resource_key === 'canonical/source_registry');
    assert.deepEqual((await db.query('select public.ktp_cms_reference_read($1) result', [published.id])).rows[0].result,
      seed.resources.find(row => row.key === published.resource_key).payload);
    await assert.rejects(db.query("select public.ktp_cms_resource_operation($1,'catalog','{}')", [actor]), /permission denied/);
    await db.exec('set role service_role');
    const operation = async (actorId, action, args) => (await db.query('select public.ktp_cms_resource_operation($1,$2,$3::jsonb) result',
      [actorId, action.replace('resource:', ''), JSON.stringify(args)])).rows[0].result;
    await assert.rejects(operation('10000000-0000-4000-8000-000000000002', 'catalog', {}), /denied/);
    const first = await operation(actor, 'clone', { key: published.resource_key });
    const second = await operation(actor, 'clone', { key: published.resource_key });
    const saved = await handleResourceAction(actor, 'edit', { id: first.id, revision: 1, reason: 'Review', payload: first.payload }, operation);
    assert.equal(saved.revision, 2);
    await assert.rejects(handleResourceAction(actor, 'edit', { id: first.id, revision: 1, reason: 'Stale', payload: first.payload }, operation), /revision_conflict/);
    const released = await handleResourceAction(actor, 'publish', { id: first.id, revision: 2, reason: 'Approved test' }, operation);
    assert.equal(released.state, 'published');
    await assert.rejects(operation(actor, 'publish', { id: second.id, revision: 1, reason: 'Stale base' }), /base changed/);
    await assert.rejects(operation(actor, 'edit', { id: first.id, revision: 2, reason: 'Overwrite', payload: {} }), /Immutable/);
    assert.equal((await operation(actor, 'history', { id: first.id })).length, 3);
    const geometry = await operation(actor, 'clone', { key: 'geodata/thailand-neighbor-context' });
    await assert.rejects(handleResourceAction(actor, 'edit', { id: geometry.id, revision: 1, reason: 'Invalid', payload: geometry.payload }, operation), /resource_review_required/);
    const plugin = cmsReferencePlugin(process.cwd());
    for (const resource of seed.resources.filter(item => item.preload)) {
      const id = plugin.resolveId(`./${resource.path}`, resolve('entry.ts'));
      assert.ok(id.startsWith('\0cms-reference:'));
      assert.match(plugin.load(id), /readCmsResource/);
    }
  } finally { await db.close(); }
});
