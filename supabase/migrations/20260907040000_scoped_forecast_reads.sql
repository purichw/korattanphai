begin;

-- Publishing is already privileged and requires complete, source-traceable data.
-- Discover new published origin datasets without consulting a browser cache.
create function public.ktp_latest_forecast_revision()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select archive_manifest->'meta' || jsonb_build_object('publishedAt', published_at)
  from public.ktp_forecast_datasets
  where status = 'published' and source_time_role = 'CONFIRMED_SOURCE_IS_ORIGIN'
    and archive_manifest->'meta'->>'sourceOfTruth' = 'normalized_rev03_original_workbook'
  order by published_at desc, dataset_id desc limit 1;
$$;
revoke all on function public.ktp_latest_forecast_revision() from public, anon;
grant execute on function public.ktp_latest_forecast_revision() to authenticated;

-- Read one source month and administrative scope using the existing indexed keys.
-- Keep the full-archive RPC for older clients and integrity/rollback tooling.
create function public.ktp_load_forecast_slice(
  p_version text, p_origin_period text default null,
  p_area_code text default '30', p_horizon_count integer default 6
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with dataset as (
    select dataset_id,
      case when p_horizon_count = 1 then overview_manifest else archive_manifest end as manifest
    from public.ktp_forecast_datasets
    where version_label = p_version and status = 'published'
      and source_time_role = 'CONFIRMED_SOURCE_IS_ORIGIN' and p_horizon_count in (1, 6)
  ), selection as (
    select d.*, coalesce((select m->>'period' from jsonb_array_elements(d.manifest->'targetMonths') m
      where m->>'period' = p_origin_period), d.manifest->'meta'->>'targetMonthEnd') as period
    from dataset d
  ), locations as (
    select l as location from selection s, jsonb_array_elements(s.manifest->'locations') l
    where p_area_code = '30' or l->>'districtCode' = p_area_code or l->>'subdistrictCode' = p_area_code
  ), risks as (
    select v.subdistrict_code, jsonb_agg(v.risk_level order by v.horizon) as values
    from selection s
    join public.ktp_forecast_values v on v.dataset_id = s.dataset_id
      and v.origin_period = (s.period || '-01')::date and v.horizon <= p_horizon_count
    join locations l on l.location->>'subdistrictCode' = v.subdistrict_code
    group by v.subdistrict_code
  )
  select s.manifest || jsonb_build_object(
    'targetMonths', (select jsonb_agg(jsonb_build_object('period', m->>'period', 'labelTh', m->>'labelTh',
      'horizons', (select jsonb_agg(jsonb_build_object('horizon', h->'horizon', 'horizonLabel', h->>'horizonLabel',
        'issueMonth', h->>'issueMonth', 'targetMonth', h->>'targetMonth') order by h->>'horizon')
        from jsonb_array_elements(m->'horizons') h)) order by m->>'period')
      from jsonb_array_elements(s.manifest->'targetMonths') m),
    'horizonSummary', '[]'::jsonb, 'validationExamples', '{}'::jsonb,
    'locations', (select jsonb_agg(location order by location->>'subdistrictCode') from locations),
    'loadedSelection', jsonb_build_object('originPeriod', s.period, 'areaCode', p_area_code,
      'horizonCount', p_horizon_count, 'subdistrictCount', (select count(*) from locations)),
    'packedRiskByTargetMonth', jsonb_build_object(s.period,
      (select jsonb_object_agg(subdistrict_code, values) from risks)))
  from selection s where exists (select 1 from locations);
$$;

revoke all on function public.ktp_load_forecast_slice(text, text, text, integer) from public, anon;
grant execute on function public.ktp_load_forecast_slice(text, text, text, integer) to authenticated;

commit;
