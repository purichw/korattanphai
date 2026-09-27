import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { buildForecastOverviewArchive } from '../../scripts/generate-forecast-summary.mjs';
import { contentHash, validateCmsPayload } from '../../server/admin-data/contract.mjs';

test('reviewed forecast publication preserves original data, other months, nulls, scopes and private audit', async () => {
  const db = new PGlite();
  const actor = '11111111-1111-4111-8111-111111111111';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${actor}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to authenticated,anon;`);
    await db.exec(await readFile(new URL('../../supabase/baseline/20260905_existing.sql', import.meta.url), 'utf8'));
    for (const migration of ['20260905110000_archive_and_saved_workspaces.sql','20260905124000_target_month_archive_publication.sql',
      '20260906160000_rev03_origin_forecast.sql','20260907040000_scoped_forecast_reads.sql',
      '20260909010000_model_input_batches.sql','20260927010000_cms_data_drafts.sql','20260927020000_cms_forecast_review.sql']) {
      await db.exec(await readFile(new URL(`../../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    const archive = JSON.parse(await readFile(new URL('../../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', import.meta.url), 'utf8'));
    const months = process.env.CMS_FULL_ARCHIVE_TEST === '1'
      ? archive.targetMonths.map(month => month.period) : ['2025-11','2025-12'];
    archive.targetMonths = archive.targetMonths.filter(month => months.includes(month.period));
    archive.meta.targetMonthCount = months.length; archive.meta.targetMonthStart = months[0]; archive.meta.forecastVintageCount = 289 * 6 * months.length;
    archive.packedRiskByTargetMonth = Object.fromEntries(months.map(period => [period, archive.packedRiskByTargetMonth[period]]));
    const baseId = archive.meta.datasetId;
    for (const l of [...new Map(archive.locations.map(l => [l.districtCode,l])).values()]) {
      await db.query('insert into ktp_districts(district_code,canonical_id,name_th,name_en,routing_slug) values($1,$2,$3,$4,$5)', [l.districtCode,l.districtId,l.districtNameTh,l.districtNameEn,l.districtSlug]);
    }
    for (const l of archive.locations) await db.query('insert into ktp_subdistricts values($1,$2,$3,$4,$5)', [l.subdistrictCode,l.districtCode,l.subdistrictId,l.subdistrictNameTh,l.subdistrictSlug]);
    const { packedRiskByTargetMonth: _packed, ...manifest } = archive;
    const { packedRiskByTargetMonth: _overviewPacked, ...overview } = buildForecastOverviewArchive(archive);
    await db.query(`insert into ktp_forecast_datasets(dataset_id,version_label,source_filename,source_sha256,model_version,provenance,
      source_time_role,archive_manifest,overview_manifest,normalization_manifest) values($1,$2,'fixture.xlsx',$3,'fixture','REAL',
      'CONFIRMED_SOURCE_IS_ORIGIN',$4::jsonb,$5::jsonb,$6::jsonb)`, [baseId,archive.meta.datasetVersion,archive.meta.sourceWorkbookSha256,
      JSON.stringify(manifest),JSON.stringify(overview),JSON.stringify({ source_sha256: archive.meta.sourceWorkbookSha256, source_month_role: 'forecast_origin_month' })]);
    for (const l of archive.locations) await db.query('insert into ktp_research_crosswalk values($1,$2,$3,$4)', [baseId,l.sourceId,l.subdistrictCode,'Isolated test fixture']);
    for (const period of months) for (let horizon = 1; horizon <= 6; horizon++) {
      await db.query('insert into ktp_forecast_runs(dataset_id,origin_period,horizon,source_year_month) values($1,$2,$3,$2)', [baseId,`${period}-01`,horizon]);
      const rows = archive.locations.map(l => { const risk = archive.packedRiskByTargetMonth[period][l.subdistrictCode][horizon-1];
        return { code:l.subdistrictCode,id:l.sourceId,risk,scope:risk === null ? 'OUT_OF_SCOPE' : 'IN_SCOPE' }; });
      await db.query(`insert into ktp_forecast_values(dataset_id,origin_period,horizon,subdistrict_code,research_id,study_scope,risk_level,source_first_row,source_row_count)
        select $1,$2,$3,r.code,r.id,r.scope,r.risk,2,1 from jsonb_to_recordset($4::jsonb) r(code text,id integer,risk smallint,scope text)`,
      [baseId,`${period}-01`,horizon,JSON.stringify(rows)]);
    }
    await db.query("update ktp_forecast_datasets set status='published',published_at=clock_timestamp() where dataset_id=$1", [baseId]);
    const operation = async (fn, action, args = {}) => (await db.query(`select public.${fn}($1::uuid,$2::text,$3::jsonb) result`, [actor,action,JSON.stringify(args)])).rows[0].result;
    await db.exec('set role authenticated');
    await assert.rejects(operation('ktp_cms_forecast','catalog'), /permission denied/);
    await db.exec('reset role; set role service_role');
    assert.deepEqual((await operation('ktp_cms_forecast','catalog')).periods, [...months].sort().reverse());
    const payload = await operation('ktp_cms_forecast','read', { datasetId: baseId, originMonth: '2025-12' });
    assert.equal(payload.predictions.length, 1734);
    assert.doesNotThrow(() => validateCmsPayload('archive', payload));
    const draft = await operation('ktp_cms_operation','create', { kind: 'archive',title:'Review',sourceFilename:'published-database',payload,originalHash:contentHash(payload) });
    const edited = structuredClone(payload);
    const cell = edited.predictions.find(row => row.riskCode === 1);
    const originalCell = structuredClone(cell);
    cell.riskCode = 2;
    await operation('ktp_cms_operation','edit', { id:draft.id,revision:1,reason:'Reviewed fixture',payload:edited });
    const publicationStart = performance.now();
    const accepted = await operation('ktp_cms_forecast','publish', { id:draft.id,revision:2,reason:'Publish isolated test',contentHash:contentHash(edited) });
    console.log(JSON.stringify({ forecastCells: months.length * 289 * 6, publicationMilliseconds: Math.round(performance.now() - publicationStart) }));
    assert.equal(accepted.state,'accepted');
    await db.exec('reset role; set role authenticated');
    const revision = (await db.query('select public.ktp_latest_forecast_revision() revision')).rows[0].revision;
    assert.notEqual(revision.datasetId,baseId);
    assert.equal(revision.sourceOfTruth,'admin_reviewed_forecast');
    for (const period of months) {
      const result = (await db.query("select public.ktp_load_forecast_slice($1,$2,'30',6) archive", [revision.datasetVersion,period])).rows[0].archive;
      const expected = structuredClone(archive.packedRiskByTargetMonth[period]);
      if (period === '2025-12') expected[cell.subdistrictCode][cell.horizonMonths-1] = 2;
      assert.deepEqual(result.packedRiskByTargetMonth[period],expected);
    }
    const old = (await db.query("select public.ktp_load_forecast_slice($1,'2025-12','30',6) archive", [archive.meta.datasetVersion])).rows[0].archive;
    assert.equal(old.packedRiskByTargetMonth['2025-12'][originalCell.subdistrictCode][originalCell.horizonMonths-1],1);
    await assert.rejects(db.query('select * from ktp_cms_forecast_publications'), /permission denied/);
    await db.exec('reset role; set role service_role');
    const stale = await operation('ktp_cms_operation','create', { kind:'archive',title:'Stale',sourceFilename:'published-database',payload,originalHash:contentHash(payload) });
    await assert.rejects(operation('ktp_cms_forecast','publish', { id:stale.id,revision:1,reason:'Stale base',contentHash:contentHash(payload) }), /cms_revision_conflict/);
    assert.equal((await operation('ktp_cms_operation','get', { id:stale.id })).state,'draft');
    const restored = structuredClone(payload);
    restored.baseDatasetId = revision.datasetId;
    const recovery = await operation('ktp_cms_operation','create', { kind:'archive',title:'Restore prior values',sourceFilename:'published-database',payload:restored,originalHash:contentHash(restored) });
    await operation('ktp_cms_forecast','publish', { id:recovery.id,revision:1,reason:'Isolated recovery rehearsal',contentHash:contentHash(restored) });
    await db.exec('reset role; set role authenticated');
    const recovered = (await db.query('select public.ktp_latest_forecast_revision() revision')).rows[0].revision;
    assert.notEqual(recovered.datasetId, baseId);
    assert.notEqual(recovered.datasetId, revision.datasetId);
    const recoveredArchive = (await db.query('select public.ktp_load_forecast_archive($1,6) archive', [recovered.datasetVersion])).rows[0].archive;
    assert.deepEqual(recoveredArchive.packedRiskByTargetMonth, archive.packedRiskByTargetMonth);
  } finally { await db.close(); }
});
