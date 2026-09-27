import { readFile } from 'node:fs/promises';
import { buildForecastOverviewArchive } from '../../scripts/generate-forecast-summary.mjs';

export async function prepareCmsForecastSchema(db) {
  await db.exec(`create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;`);
  await db.exec(await readFile(new URL('../../supabase/baseline/20260905_existing.sql', import.meta.url), 'utf8'));
  for (const file of ['20260905110000_archive_and_saved_workspaces.sql','20260905124000_target_month_archive_publication.sql',
    '20260906160000_rev03_origin_forecast.sql','20260907040000_scoped_forecast_reads.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
}

export async function seedCmsForecast(db) {
  const archive = JSON.parse(await readFile(new URL('../../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', import.meta.url), 'utf8'));
  const period = '2025-12';
  archive.targetMonths = archive.targetMonths.filter(month => month.period === period);
  Object.assign(archive.meta, { targetMonthCount: 1, targetMonthStart: period, targetMonthEnd: period, forecastVintageCount: 289 * 6 });
  archive.packedRiskByTargetMonth = { [period]: archive.packedRiskByTargetMonth[period] };
  const locations = JSON.stringify(archive.locations);
  await db.query(`insert into ktp_districts(district_code,canonical_id,name_th,name_en,routing_slug)
    select distinct l."districtCode",l."districtId",l."districtNameTh",l."districtNameEn",l."districtSlug"
    from jsonb_to_recordset($1::jsonb) l("districtCode" text,"districtId" text,"districtNameTh" text,"districtNameEn" text,"districtSlug" text)`, [locations]);
  await db.query(`insert into ktp_subdistricts select l."subdistrictCode",l."districtCode",l."subdistrictId",l."subdistrictNameTh",l."subdistrictSlug"
    from jsonb_to_recordset($1::jsonb) l("subdistrictCode" text,"districtCode" text,"subdistrictId" text,"subdistrictNameTh" text,"subdistrictSlug" text)`, [locations]);
  const { packedRiskByTargetMonth: _packed, ...manifest } = archive;
  const { packedRiskByTargetMonth: _onePacked, ...overview } = buildForecastOverviewArchive(archive);
  const id = archive.meta.datasetId;
  await db.query(`insert into ktp_forecast_datasets(dataset_id,version_label,source_filename,source_sha256,model_version,provenance,
    source_time_role,archive_manifest,overview_manifest,normalization_manifest) values($1,$2,'fixture.xlsx',$3,'fixture','REAL',
    'CONFIRMED_SOURCE_IS_ORIGIN',$4::jsonb,$5::jsonb,$6::jsonb)`, [id,archive.meta.datasetVersion,archive.meta.sourceWorkbookSha256,
    JSON.stringify(manifest),JSON.stringify(overview),JSON.stringify({ source_sha256:archive.meta.sourceWorkbookSha256,source_month_role:'forecast_origin_month' })]);
  await db.query(`insert into ktp_research_crosswalk select $1,l."sourceId",l."subdistrictCode",'Isolated browser test'
    from jsonb_to_recordset($2::jsonb) l("sourceId" integer,"subdistrictCode" text)`,[id,locations]);
  for (let horizon=1;horizon<=6;horizon++) {
    await db.query('insert into ktp_forecast_runs(dataset_id,origin_period,horizon,source_year_month) values($1,$2,$3,$2)',[id,`${period}-01`,horizon]);
    const rows=archive.locations.map(l=>{const risk=archive.packedRiskByTargetMonth[period][l.subdistrictCode][horizon-1];return{code:l.subdistrictCode,id:l.sourceId,risk,scope:risk===null?'OUT_OF_SCOPE':'IN_SCOPE'};});
    await db.query(`insert into ktp_forecast_values(dataset_id,origin_period,horizon,subdistrict_code,research_id,study_scope,risk_level,source_first_row,source_row_count)
      select $1,$2,$3,r.code,r.id,r.scope,r.risk,2,1 from jsonb_to_recordset($4::jsonb) r(code text,id integer,risk smallint,scope text)`,[id,`${period}-01`,horizon,JSON.stringify(rows)]);
  }
  await db.query("update ktp_forecast_datasets set status='published',published_at=clock_timestamp() where dataset_id=$1",[id]);
  return archive;
}
