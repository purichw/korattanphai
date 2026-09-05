import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { buildForecastOverviewArchive } from '../generate-forecast-summary.mjs';

export const forecastImport = Object.freeze({
  project: 'dihchjflzhcekywarhxd',
  datasetId: '9b299cef-c704-4139-8085-18664253cc80',
  version: 'drought-rev02-9b299cefc704',
  original: 'Drought_T1-6_rev02.xlsx',
  normalized: 'Drought_T1-6_rev02_Normalized_ArchiveReady(1).xlsx',
  originalSha: 'a2f2dca4d70519540b6f74199312a0fdab8be78d7b78ca64b9e988f139c188e6',
  normalizedSha: '08ad9a2587a43bf243f5605de4ca14d6b2258740422cd87996b61f5ef153a0c2',
  canonicalSha: '9b299cefc7049c13408518664253cc804ef56d93cf81c150607ce926e0d6c4c4',
});
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const jsonSql = (value) => `${sqlString(JSON.stringify(value))}::jsonb`;
const datasetId = `${sqlString(forecastImport.datasetId)}::uuid`;
const withoutRisks = ({ packedRiskByTargetMonth: _, ...manifest }) => manifest;

export function inspectArchive(archive) {
  if (archive.meta.sourceOfTruth !== 'normalized_rev02_forecast_archive_workbook' ||
      archive.meta.provinceCode !== '30' || archive.meta.horizonCount !== 6 ||
      archive.locations.length !== 289 || archive.targetMonths.length !== 127) throw new Error('Unexpected archive source/coverage');
  const codeToSource = new Map(archive.locations.map((l) => [l.subdistrictCode, Number(l.sourceId)]));
  if (codeToSource.size !== 289 || new Set(codeToSource.values()).size !== 289) throw new Error('Duplicate source/admin keys');
  const digest = createHash('sha256');
  const counts = { rows: 0, noRisk: 0, moderate: 0, high: 0, outOfScope: 0 };
  for (const month of [...archive.targetMonths].sort((a, b) => a.period.localeCompare(b.period))) {
    const rows = archive.packedRiskByTargetMonth[month.period];
    if (!rows || Object.keys(rows).length !== 289 || month.horizons.length !== 6) throw new Error('Incomplete month');
    for (const code of [...codeToSource.keys()].sort()) {
      const risks = rows[code];
      if (!Array.isArray(risks) || risks.length !== 6) throw new Error('Missing vintage is not out-of-scope');
      risks.forEach((risk, i) => {
        if (![null, 0, 1, 2].includes(risk)) throw new Error('Invalid prediction');
        digest.update(`${code}|${month.period}|${i + 1}|${risk === null ? 'null' : risk}\n`);
        counts.rows++;
        counts[risk === null ? 'outOfScope' : ['noRisk', 'moderate', 'high'][risk]]++;
      });
    }
  }
  if (!isDeepStrictEqual(counts, { rows: 220218, noRisk: 44474, moderate: 27670, high: 22830, outOfScope: 125244 })) throw new Error('Unexpected prediction totals');
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
          or s.canonical_id is distinct from l->>'subdistrictId' or s.routing_slug is distinct from l->>'subdistrictSlug'
          or d.canonical_id is distinct from l->>'districtId' or d.routing_slug is distinct from l->>'districtSlug')
      then raise exception 'Administrative crosswalk differs; refusing import'; end if;
    end $$;
    insert into public.ktp_forecast_datasets
      (dataset_id, version_label, source_filename, source_sha256, model_version, provenance,
       normalized_sha256, canonical_sha256, source_time_role, archive_manifest, overview_manifest)
    values (${datasetId}, ${sqlString(forecastImport.version)}, ${sqlString(forecastImport.original)},
      ${sqlString(forecastImport.originalSha)}, 'rev02', 'REAL', ${sqlString(forecastImport.normalizedSha)},
      ${sqlString(forecastImport.canonicalSha)}, 'UNCONFIRMED_PRODUCT_USES_TARGET',
      ${jsonSql(expected.manifest)}, ${jsonSql(expected.overviewManifest)}) on conflict do nothing;
    do $$ begin
      if not exists (select 1 from public.ktp_forecast_datasets where dataset_id = ${datasetId}
        and version_label = ${sqlString(forecastImport.version)} and source_sha256 = ${sqlString(forecastImport.originalSha)}
        and normalized_sha256 = ${sqlString(forecastImport.normalizedSha)} and canonical_sha256 = ${sqlString(forecastImport.canonicalSha)}
        and archive_manifest = ${jsonSql(expected.manifest)} and overview_manifest = ${jsonSql(expected.overviewManifest)})
      then raise exception 'Existing dataset differs; refusing overwrite'; end if;
    end $$;
    insert into public.ktp_research_crosswalk (dataset_id, research_id, subdistrict_code, mapping_evidence)
    select ${datasetId}, (l->>'sourceId')::integer, l->>'subdistrictCode', l::text
    from jsonb_array_elements(${jsonSql(archive.locations)}) l on conflict do nothing;
    commit;`;
}

export function buildMonthSql(archive, period) {
  const month = archive.targetMonths.find((m) => m.period === period);
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Unknown source month');
  return `begin;
    do $$ begin
      if not exists (select 1 from public.ktp_forecast_datasets where dataset_id = ${datasetId} and status = 'draft')
      then raise exception 'Import requires a draft dataset'; end if;
    end $$;
    insert into public.ktp_forecast_runs (dataset_id, origin_period, horizon, source_year_month)
    select ${datasetId}, (h->>'issueMonth' || '-01')::date, (h->>'horizon')::integer,
      ${sqlString(period + '-01')}::date
    from jsonb_array_elements(${jsonSql(month.horizons)}) h on conflict do nothing;
    insert into public.ktp_forecast_values (dataset_id, origin_period, horizon, subdistrict_code, research_id, study_scope, risk_level)
    select ${datasetId}, r.origin_period, risk.horizon, areas.key, c.research_id,
      case when risk.value = 'null'::jsonb then 'OUT_OF_SCOPE' else 'IN_SCOPE' end,
      (risk.value #>> '{}')::smallint
    from jsonb_each(${jsonSql(archive.packedRiskByTargetMonth[period])}) areas
    cross join lateral jsonb_array_elements(areas.value) with ordinality risk(value, horizon)
    join public.ktp_forecast_runs r on r.dataset_id = ${datasetId} and r.target_period = ${sqlString(period + '-01')}::date and r.horizon = risk.horizon
    join public.ktp_research_crosswalk c on c.dataset_id = ${datasetId} and c.subdistrict_code = areas.key
    on conflict do nothing;
    commit;`;
}

export function archiveAuditSql() {
  return `select count(*)::integer as rows,
    count(*) filter (where v.risk_level = 0)::integer as "noRisk",
    count(*) filter (where v.risk_level = 1)::integer as moderate,
    count(*) filter (where v.risk_level = 2)::integer as high,
    count(*) filter (where v.risk_level is null)::integer as "outOfScope",
    encode(sha256(convert_to(string_agg(v.subdistrict_code || '|' || to_char(r.target_period, 'YYYY-MM') || '|' || v.horizon || '|' || coalesce(v.risk_level::text, 'null') || E'\\n', '' order by r.target_period, v.subdistrict_code, v.horizon), 'UTF8')), 'hex') as digest,
    count(*) filter (where r.source_year_month is distinct from r.target_period or r.origin_period is distinct from (r.target_period - make_interval(months => r.horizon))::date)::integer as temporal_errors,
    (select count(*)::integer from public.ktp_forecast_runs where dataset_id = ${datasetId}) as runs,
    (select count(*)::integer from public.ktp_research_crosswalk where dataset_id = ${datasetId}) as locations
    from public.ktp_forecast_values v join public.ktp_forecast_runs r using (dataset_id, origin_period, horizon)
    where v.dataset_id = ${datasetId}`;
}

export function assertArchiveAudit(actual, expected) {
  for (const key of ['rows', 'noRisk', 'moderate', 'high', 'outOfScope', 'digest']) {
    if (actual[key] !== expected[key]) throw new Error(`Database integrity mismatch: ${key}`);
  }
  if (actual.temporal_errors !== 0 || actual.runs !== 762 || actual.locations !== 289) throw new Error('Database identity/temporal mismatch');
}

export function publishArchiveSql(expected) {
  return `begin;
    lock table public.ktp_forecast_datasets, public.ktp_forecast_runs, public.ktp_research_crosswalk, public.ktp_forecast_values in share row exclusive mode;
    do $$ declare result record; begin
      select * into result from (${archiveAuditSql()}) a;
      if result.rows <> 220218 or result.runs <> 762 or result.locations <> 289 or result.temporal_errors <> 0
        or result.digest is distinct from ${sqlString(expected.digest)}
      then raise exception 'Archive verification failed; cannot publish'; end if;
      if not exists (select 1 from public.ktp_forecast_datasets where dataset_id = ${datasetId}
        and archive_manifest = ${jsonSql(expected.manifest)} and overview_manifest = ${jsonSql(expected.overviewManifest)}
        and source_sha256 = ${sqlString(forecastImport.originalSha)} and normalized_sha256 = ${sqlString(forecastImport.normalizedSha)}
        and canonical_sha256 = ${sqlString(forecastImport.canonicalSha)} and source_time_role = 'UNCONFIRMED_PRODUCT_USES_TARGET')
      then raise exception 'Source lineage differs; cannot publish'; end if;
      if exists (select 1 from public.ktp_research_crosswalk c join public.ktp_forecast_datasets d using (dataset_id)
        where c.dataset_id = ${datasetId} and not exists (
          select 1 from jsonb_array_elements(d.archive_manifest->'locations') l
          where l->>'sourceId' = c.research_id::text and l->>'subdistrictCode' = c.subdistrict_code and l = c.mapping_evidence::jsonb
        )) then raise exception 'Crosswalk differs; cannot publish'; end if;
      update public.ktp_forecast_datasets set status = 'published', published_at = now()
      where dataset_id = ${datasetId} and status = 'draft';
    end $$;
    commit;`;
}
