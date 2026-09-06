import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { buildForecastOverviewArchive } from '../generate-forecast-summary.mjs';
import { rev03, sha256, shiftPeriod } from './forecast-rev03.mjs';

export { sha256 };
export const forecastImport = Object.freeze({
  ...rev03, original: rev03.source, originalSha: rev03.sourceSha,
  normalized: 'manifest.json', normalizedSha: 'be910423f3384de067ccdb5ef08a33d6af15c35f7370127c1a4d47636cc74b57',
  canonicalSha: '56ca64940332ef588bd163523428ae7e8330c3310d3a63f4f61407af989da592',
});
export const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const jsonSql = (value) => `${sqlString(JSON.stringify(value))}::jsonb`;
const datasetId = `${sqlString(rev03.datasetId)}::uuid`;
const withoutRisks = ({ packedRiskByTargetMonth: _, ...manifest }) => manifest;
let cachedLineage;
export function readLineage() {
  if (!cachedLineage) {
    const bytes = fs.readFileSync(`${rev03.normalizedDirectory}/source_row_lineage.csv`);
    const manifest = readManifest();
    assert.equal(sha256(bytes), manifest.files['source_row_lineage.csv'].sha256);
    cachedLineage = JSON.parse(execFileSync(process.env.PYTHON ?? 'python3', ['-B', 'scripts/read-forecast-lineage.py'], { maxBuffer: 8 * 1024 * 1024 }));
  }
  return cachedLineage;
}
function readManifest() {
  const bytes = fs.readFileSync(`${rev03.normalizedDirectory}/manifest.json`);
  assert.equal(sha256(bytes), forecastImport.normalizedSha);
  return JSON.parse(bytes);
}
export function inspectArchive(archive) {
  assert.equal(archive.meta.sourceOfTruth, 'normalized_rev03_original_workbook');
  assert.equal(archive.meta.sourceWorkbookSha256, rev03.sourceSha);
  assert.equal(archive.meta.temporalInterpretation, 'SOURCE_YEARMONTH_IS_ORIGIN_MONTH');
  assert.equal(archive.locations.length, 289);
  assert.equal(archive.targetMonths.length, 127);
  assert.equal(new Set(archive.locations.map((l) => l.subdistrictCode)).size, 289);
  assert.equal(new Set(archive.locations.map((l) => l.sourceId)).size, 289);
  const digest = createHash('sha256');
  const counts = { rows: 0, noRisk: 0, moderate: 0, high: 0, outOfScope: 0 };
  const lineage = readLineage();
  for (const month of [...archive.targetMonths].sort((a, b) => a.period.localeCompare(b.period))) {
    const rows = archive.packedRiskByTargetMonth[month.period];
    assert.equal(Object.keys(rows).length, 289);
    assert.equal(month.horizons.length, 6);
    for (const l of [...archive.locations].sort((a, b) => a.subdistrictCode.localeCompare(b.subdistrictCode))) {
      const risks = rows[l.subdistrictCode];
      assert.equal(risks.length, 6);
      const [first, count] = lineage[month.period][l.sourceId];
      risks.forEach((risk, i) => {
        assert.ok(risk === null || risk === 0 || risk === 1 || risk === 2);
        assert.equal(month.horizons[i].issueMonth, month.period);
        assert.equal(month.horizons[i].targetMonth, shiftPeriod(month.period, i + 1));
        digest.update(`${l.subdistrictCode}|${l.sourceId}|${month.period}|${i + 1}|${shiftPeriod(month.period, i + 1)}|${risk === null ? 'null' : risk}|${first}|${count}\n`);
        counts.rows++;
        counts[risk === null ? 'outOfScope' : ['noRisk', 'moderate', 'high'][risk]]++;
      });
    }
  }
  assert.deepEqual(counts, { rows: 220218, noRisk: 43733, moderate: 24898, high: 20523, outOfScope: 131064 });
  return { ...counts, digest: digest.digest('hex'), manifest: withoutRisks(archive), overviewManifest: withoutRisks(buildForecastOverviewArchive(archive)) };
}

export function buildDraftSql(archive) {
  const expected = inspectArchive(archive);
  return `begin;
    do $$ begin
      if (select count(*) from public.ktp_districts) <> 32 or (select count(*) from public.ktp_subdistricts) <> 289
      then raise exception 'Administrative coverage differs; refusing import'; end if;
      if exists (select 1 from jsonb_array_elements(${jsonSql(archive.locations)}) l
        left join public.ktp_subdistricts s on s.subdistrict_code = l->>'subdistrictCode'
        left join public.ktp_districts d on d.district_code = s.district_code
        where s.subdistrict_code is null or s.district_code is distinct from l->>'districtCode'
          or s.name_th is distinct from l->>'subdistrictNameTh'
          or s.canonical_id is distinct from l->>'subdistrictId' or s.routing_slug is distinct from l->>'subdistrictSlug'
          or d.canonical_id is distinct from l->>'districtId' or d.routing_slug is distinct from l->>'districtSlug')
      then raise exception 'Administrative mapping differs; refusing import'; end if;
    end $$;
    insert into public.ktp_forecast_datasets
      (dataset_id, version_label, source_filename, source_sha256, model_version, provenance,
       normalized_sha256, canonical_sha256, source_time_role, archive_manifest, overview_manifest, normalization_manifest)
    values (${datasetId}, ${sqlString(rev03.version)}, ${sqlString(rev03.source)},
      ${sqlString(rev03.sourceSha)}, 'rev03', 'REAL', ${sqlString(forecastImport.normalizedSha)},
      ${sqlString(forecastImport.canonicalSha)}, 'CONFIRMED_SOURCE_IS_ORIGIN',
      ${jsonSql(expected.manifest)}, ${jsonSql(expected.overviewManifest)}, ${jsonSql(readManifest())}) on conflict do nothing;
    do $$ begin
      if not exists (select 1 from public.ktp_forecast_datasets where dataset_id = ${datasetId}
        and version_label = ${sqlString(rev03.version)} and source_sha256 = ${sqlString(rev03.sourceSha)}
        and normalized_sha256 = ${sqlString(forecastImport.normalizedSha)} and canonical_sha256 = ${sqlString(forecastImport.canonicalSha)}
        and source_time_role = 'CONFIRMED_SOURCE_IS_ORIGIN'
        and normalization_manifest = ${jsonSql(readManifest())}
        and archive_manifest = ${jsonSql(expected.manifest)} and overview_manifest = ${jsonSql(expected.overviewManifest)})
      then raise exception 'Existing dataset differs; refusing overwrite'; end if;
    end $$;
    insert into public.ktp_research_crosswalk (dataset_id, research_id, subdistrict_code, mapping_evidence)
    select ${datasetId}, (l->>'sourceId')::integer, l->>'subdistrictCode', l::text
    from jsonb_array_elements(${jsonSql(archive.locations)}) l on conflict do nothing;
    commit;`;
}

export function buildMonthSql(archive, period) {
  assert.ok(archive.targetMonths.some((m) => m.period === period));
  assert.match(period, /^\d{4}-(0[1-9]|1[0-2])$/);
  const rows = archive.locations.map((l) => ({
    code: l.subdistrictCode, source: Number(l.sourceId), risks: archive.packedRiskByTargetMonth[period][l.subdistrictCode],
    first: readLineage()[period][l.sourceId][0], count: readLineage()[period][l.sourceId][1],
  }));
  return `begin;
    do $$ begin
      if not exists (select 1 from public.ktp_forecast_datasets where dataset_id = ${datasetId} and status = 'draft')
      then raise exception 'Import requires a draft dataset'; end if;
    end $$;
    insert into public.ktp_forecast_runs (dataset_id, origin_period, horizon, source_year_month)
    select ${datasetId}, ${sqlString(period + '-01')}::date, h, ${sqlString(period + '-01')}::date
    from generate_series(1,6) h on conflict do nothing;
    insert into public.ktp_forecast_values
      (dataset_id, origin_period, horizon, subdistrict_code, research_id, study_scope, risk_level, source_first_row, source_row_count)
    select ${datasetId}, ${sqlString(period + '-01')}::date, risk.horizon, l->>'code', (l->>'source')::integer,
      case when risk.value = 'null'::jsonb then 'OUT_OF_SCOPE' else 'IN_SCOPE' end,
      (risk.value #>> '{}')::smallint, (l->>'first')::integer, (l->>'count')::integer
    from jsonb_array_elements(${jsonSql(rows)}) l
    cross join lateral jsonb_array_elements(l->'risks') with ordinality risk(value, horizon)
    on conflict do nothing;
    commit;`;
}

export function archiveAuditSql() {
  return `select count(*)::integer as rows,
    count(*) filter (where v.risk_level = 0)::integer as "noRisk",
    count(*) filter (where v.risk_level = 1)::integer as moderate,
    count(*) filter (where v.risk_level = 2)::integer as high,
    count(*) filter (where v.risk_level is null)::integer as "outOfScope",
    encode(sha256(convert_to(string_agg(v.subdistrict_code || '|' || v.research_id || '|' || to_char(r.origin_period, 'YYYY-MM') || '|' || v.horizon || '|' || to_char(r.target_period, 'YYYY-MM') || '|' || coalesce(v.risk_level::text, 'null') || '|' || v.source_first_row || '|' || v.source_row_count || E'\\n', '' order by r.origin_period, v.subdistrict_code, v.horizon), 'UTF8')), 'hex') as digest,
    count(*) filter (where r.source_year_month is distinct from r.origin_period or r.target_period is distinct from (r.origin_period + make_interval(months => r.horizon))::date)::integer as temporal_errors,
    count(*) filter (where v.source_first_row is null or v.source_row_count is null)::integer as lineage_errors,
    (select count(*)::integer from public.ktp_forecast_runs where dataset_id = ${datasetId}) as runs,
    (select count(*)::integer from public.ktp_research_crosswalk where dataset_id = ${datasetId}) as locations
    from public.ktp_forecast_values v join public.ktp_forecast_runs r using (dataset_id, origin_period, horizon)
    where v.dataset_id = ${datasetId}`;
}
export function assertArchiveAudit(actual, expected) {
  for (const key of ['rows', 'noRisk', 'moderate', 'high', 'outOfScope', 'digest']) {
    assert.equal(actual[key], expected[key], `Database integrity mismatch: ${key}`);
  }
  assert.equal(actual.temporal_errors, 0);
  assert.equal(actual.lineage_errors, 0);
  assert.equal(actual.runs, 762);
  assert.equal(actual.locations, 289);
}
export function publishArchiveSql(expected) {
  return `begin;
    lock table public.ktp_forecast_datasets, public.ktp_forecast_runs, public.ktp_research_crosswalk, public.ktp_forecast_values in share row exclusive mode;
    do $$ declare result record; begin
      select * into result from (${archiveAuditSql()}) a;
      if result.rows <> 220218 or result.runs <> 762 or result.locations <> 289 or result.temporal_errors <> 0 or result.lineage_errors <> 0
        or result.digest is distinct from ${sqlString(expected.digest)}
      then raise exception 'Archive verification failed; cannot publish'; end if;
      if not exists (select 1 from public.ktp_forecast_datasets where dataset_id = ${datasetId}
        and archive_manifest = ${jsonSql(expected.manifest)} and overview_manifest = ${jsonSql(expected.overviewManifest)}
        and source_sha256 = ${sqlString(rev03.sourceSha)} and normalized_sha256 = ${sqlString(forecastImport.normalizedSha)}
        and canonical_sha256 = ${sqlString(forecastImport.canonicalSha)} and source_time_role = 'CONFIRMED_SOURCE_IS_ORIGIN'
        and normalization_manifest = ${jsonSql(readManifest())})
      then raise exception 'Source lineage differs; cannot publish'; end if;
      if exists (select 1 from public.ktp_research_crosswalk c where c.dataset_id = ${datasetId} and not exists (
        select 1 from jsonb_array_elements(${jsonSql(expected.manifest.locations)}) l
        where l->>'sourceId' = c.research_id::text and l->>'subdistrictCode' = c.subdistrict_code and l = c.mapping_evidence::jsonb))
      then raise exception 'Mapping evidence differs; cannot publish'; end if;
      update public.ktp_forecast_datasets set status = 'published', published_at = now()
      where dataset_id = ${datasetId} and status = 'draft';
    end $$;
    commit;`;
}
