import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { buildForecastOverviewArchive } from './generate-forecast-summary.mjs';
import { archiveAuditSql, assertArchiveAudit, buildDraftSql, buildMonthSql, forecastImport, inspectArchive, publishArchiveSql } from './lib/forecast-migration.mjs';

// Isolated PostgreSQL/WASM. Never connects to Supabase or creates real accounts.
const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
const db = new PGlite();
let passed = 0;
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
async function check(name, fn) { await fn(); console.log(`[database] PASS ${name}`); passed++; }
async function asUser(id, fn) {
  return db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
    return fn(tx);
  });
}
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    insert into auth.users values ('${a}'), ('${b}');`);
  await check('existing baseline and additive migration compile', async () => {
    await db.exec(await fs.readFile('supabase/baseline/20260905_existing.sql', 'utf8'));
    await db.exec(await fs.readFile('supabase/migrations/20260905110000_archive_and_saved_workspaces.sql', 'utf8'));
  });
  const archive = JSON.parse(await fs.readFile('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev02.json', 'utf8'));
  const expected = inspectArchive(archive);
  const districts = [...new Map(archive.locations.map((l) => [l.districtCode, l])).values()];
  for (const l of districts) await db.query('insert into ktp_districts (district_code,canonical_id,name_th,name_en,routing_slug) values ($1,$2,$3,$4,$5)', [l.districtCode,l.districtId,l.districtNameTh,l.districtNameEn,l.districtSlug]);
  for (const l of archive.locations) await db.query('insert into ktp_subdistricts values ($1,$2,$3,$4,$5)', [l.subdistrictCode,l.districtCode,l.subdistrictId,l.subdistrictNameTh,l.subdistrictSlug]);
  await check('draft is hidden from authenticated users', async () => {
    await db.exec(buildDraftSql(archive));
    await asUser(a, async (tx) => {
      assert.equal((await tx.query('select * from ktp_forecast_datasets')).rows.length, 0);
      assert.equal((await tx.query('select ktp_load_forecast_archive($1,6) as archive', [forecastImport.version])).rows[0].archive, null);
    });
  });
  await check('incomplete archive cannot publish', async () => {
    await assert.rejects(db.exec(publishArchiveSql(expected)), /cannot publish/);
    await db.exec('rollback');
  });
  await check('all 220,218 predictions, source IDs and dates survive idempotent import', async () => {
    for (const month of archive.targetMonths) await db.exec(buildMonthSql(archive, month.period));
    await db.exec(buildMonthSql(archive, archive.targetMonths[0].period));
    await db.exec(buildDraftSql(archive));
    assertArchiveAudit((await db.query(archiveAuditSql())).rows[0], expected);
  });
  await check('target-month publication preserves legacy guards and published immutability', async () => {
    await assert.rejects(db.exec(publishArchiveSql(expected)), /Each origin/);
    await db.exec('rollback');
    await db.exec(await fs.readFile('supabase/migrations/20260905124000_target_month_archive_publication.sql', 'utf8'));
    const publish = "update ktp_forecast_datasets set status='published',published_at=now()";
    for (const [change, message] of [
      ["update ktp_forecast_runs set source_year_month=null where horizon=1", /preserve every source month/],
      ["delete from ktp_forecast_values where horizon=6; delete from ktp_forecast_runs where horizon=6", /Each target month/],
      ["delete from ktp_forecast_values where subdistrict_code='300806' and horizon=6", /Every run requires/],
      ["update ktp_forecast_datasets set source_time_role=null", /Each origin/],
    ]) {
      await assert.rejects(db.exec(`begin; ${change}; ${publish}; commit;`), message);
      await db.exec('rollback');
    }
    await db.exec(publishArchiveSql(expected));
    await assert.rejects(db.exec('update ktp_forecast_values set risk_level=risk_level'), /Published dataset is immutable/);
    await assert.rejects(db.exec('update ktp_forecast_datasets set status=status'), /Published dataset is immutable/);
  });
  await check('authenticated full/T+1 RPC exactly matches canonical projections', async () => {
    for (const [horizon, projection] of [[6,archive],[1,buildForecastOverviewArchive(archive)]]) {
      const start = performance.now();
      await asUser(a, async (tx) => {
        const result = (await tx.query('select ktp_load_forecast_archive($1,$2) as archive', [forecastImport.version,horizon])).rows[0].archive;
        assert.deepEqual(result, projection);
      });
      console.log(`[database] ${horizon}-horizon query ${Math.round(performance.now() - start)} ms (local WASM, not production latency)`);
    }
  });
  await check('authenticated users cannot change forecast values', async () => {
    await assert.rejects(asUser(a, (tx) => tx.exec('update ktp_forecast_values set risk_level=0')), /permission denied/);
  });
  await check('anonymous callers cannot read archive or personal data', async () => {
    for (const sql of ["select ktp_load_forecast_archive('x',6)", 'select * from ktp_forecast_values', 'select * from ktp_followed_areas', 'select * from ktp_saved_filters']) {
      await assert.rejects(db.transaction(async (tx) => { await tx.exec('set local role anon'); return tx.exec(sql); }), /permission denied/);
    }
  });
  await check('followed areas are owner-only for read, insert, update and delete', async () => {
    await asUser(a, (tx) => tx.exec("insert into ktp_followed_areas(area_code) values ('30'),('3008'),('300806')"));
    await asUser(b, async (tx) => {
      assert.equal((await tx.query('select * from ktp_followed_areas')).rows.length, 0);
      assert.equal((await tx.query('delete from ktp_followed_areas returning *')).rows.length, 0);
      assert.equal((await tx.query("update ktp_followed_areas set area_code='3001' returning *")).rows.length, 0);
    });
    await assert.rejects(asUser(b, (tx) => tx.query('insert into ktp_followed_areas(user_id,area_code) values ($1,$2)', [a,'3001'])), /row-level security/);
    await assert.rejects(asUser(a, (tx) => tx.query('update ktp_followed_areas set user_id=$1', [b])), /row-level security/);
    await assert.rejects(asUser(a, (tx) => tx.exec("insert into ktp_followed_areas(area_code) values ('309999')")), /foreign key/);
    await asUser(a, async (tx) => assert.equal((await tx.query("delete from ktp_followed_areas where area_code='30' returning *")).rows.length, 1));
  });
  await check('saved filters validate forecast keys and prevent cross-account access', async () => {
    const insert = "insert into ktp_saved_filters(name,view_name,area_code,dataset_id,target_period,horizon,risk_criterion) values ($1,'drought','300806',$2,'2025-12-01',$3,'forecast-high') returning id";
    const row = await asUser(a, async (tx) => (await tx.query(insert, ['พื้นที่ทดสอบ',forecastImport.datasetId,4])).rows[0]);
    await asUser(b, async (tx) => {
      assert.equal((await tx.query('select * from ktp_saved_filters')).rows.length, 0);
      assert.equal((await tx.query('delete from ktp_saved_filters where id=$1 returning *', [row.id])).rows.length, 0);
      assert.equal((await tx.query("update ktp_saved_filters set name='changed' where id=$1 returning *", [row.id])).rows.length, 0);
    });
    await assert.rejects(asUser(a, (tx) => tx.query('update ktp_saved_filters set user_id=$1 where id=$2', [b,row.id])), /row-level security/);
    await assert.rejects(asUser(a, (tx) => tx.query(insert, ['invalid',forecastImport.datasetId,7])), /check constraint/);
    await assert.rejects(asUser(a, (tx) => tx.exec("update ktp_saved_filters set target_period='2026-01-01'")), /foreign key/);
    await assert.rejects(asUser(a, (tx) => tx.exec("update ktp_saved_filters set view_name='overview'")), /check constraint/);
    await asUser(a, async (tx) => {
      const saved = (await tx.query('select * from ktp_saved_filters')).rows[0];
      assert.equal(saved.horizon, 4); assert.equal(saved.area_code,'300806'); assert.equal(saved.risk_criterion,'forecast-high');
      assert.equal((await tx.query('delete from ktp_saved_filters where id=$1 returning *',[row.id])).rows.length,1);
    });
  });
  console.log(`[database] ${passed} migration/integrity/RLS checks passed. No remote database touched.`);
} finally { await db.close(); }
