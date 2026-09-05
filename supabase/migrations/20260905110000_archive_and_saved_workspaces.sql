begin;

-- Add lineage without renaming the existing keys or changing any source value.
alter table public.ktp_forecast_datasets
  add column normalized_sha256 text check (normalized_sha256 ~ '^[0-9a-f]{64}$'),
  add column canonical_sha256 text check (canonical_sha256 ~ '^[0-9a-f]{64}$'),
  add column source_time_role text check (source_time_role = 'UNCONFIRMED_PRODUCT_USES_TARGET'),
  add column archive_manifest jsonb,
  add column overview_manifest jsonb;
alter table public.ktp_forecast_runs add column source_year_month date
  check (extract(day from source_year_month) = 1);

-- Keep source months explicit. origin_period is the existing product's derived
-- issue month, not a claim that the workbook confirms issue/target semantics.
comment on column public.ktp_forecast_runs.source_year_month is
  'Verbatim Source_YearMonth from Excel. Source role unconfirmed; product currently interprets it as target month.';

create function public.ktp_load_forecast_archive(p_version text, p_horizon_count integer default 6)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with dataset as (
    select dataset_id, case when p_horizon_count = 1 then overview_manifest else archive_manifest end as manifest
    from public.ktp_forecast_datasets
    where version_label = p_version and status = 'published' and p_horizon_count in (1, 6)
  ), risks as (
    select to_char(r.target_period, 'YYYY-MM') as period, v.subdistrict_code,
      jsonb_agg(v.risk_level order by v.horizon) as values
    from public.ktp_forecast_values v
    join dataset d using (dataset_id)
    join public.ktp_forecast_runs r using (dataset_id, origin_period, horizon)
    where v.horizon <= p_horizon_count
    group by r.target_period, v.subdistrict_code
  ), months as (
    select period, jsonb_object_agg(subdistrict_code, values) as values from risks group by period
  )
  select d.manifest || jsonb_build_object('packedRiskByTargetMonth', (select jsonb_object_agg(period, values) from months))
  from dataset d where d.manifest is not null;
$$;
revoke all on function public.ktp_load_forecast_archive(text, integer) from public, anon;
grant execute on function public.ktp_load_forecast_archive(text, integer) to authenticated;

create table public.ktp_followed_areas (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  area_code text not null check (area_code ~ '^30([0-9]{2}){0,2}$'),
  district_code text generated always as (case when length(area_code) >= 4 then left(area_code, 4) end) stored references public.ktp_districts,
  subdistrict_code text generated always as (case when length(area_code) = 6 then area_code end) stored references public.ktp_subdistricts,
  created_at timestamptz not null default now(), primary key (user_id, area_code)
);
create table public.ktp_saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80 and name = btrim(name)),
  view_name text not null check (view_name in ('overview', 'drought')),
  area_code text not null check (area_code ~ '^30([0-9]{2}){0,2}$'),
  district_code text generated always as (case when length(area_code) >= 4 then left(area_code, 4) end) stored references public.ktp_districts,
  subdistrict_code text generated always as (case when length(area_code) = 6 then area_code end) stored references public.ktp_subdistricts,
  dataset_id uuid not null references public.ktp_forecast_datasets,
  target_period date not null, horizon integer not null check (horizon between 1 and 6),
  risk_criterion text not null default 'all' check (risk_criterion in (
    'all', 'forecast-no-risk', 'forecast-moderate', 'forecast-high', 'forecast-out-of-scope', 'forecast-missing'
  )),
  created_at timestamptz not null default now(),
  foreign key (dataset_id, target_period, horizon) references public.ktp_forecast_runs(dataset_id, target_period, horizon),
  check (view_name <> 'overview' or (horizon = 1 and length(area_code) <= 4)),
  unique (user_id, name)
);

alter table public.ktp_followed_areas enable row level security;
alter table public.ktp_saved_filters enable row level security;
revoke all on public.ktp_followed_areas, public.ktp_saved_filters from public, anon, authenticated;
grant select, insert, update, delete on public.ktp_followed_areas, public.ktp_saved_filters to authenticated;
create policy ktp_own_followed_areas on public.ktp_followed_areas to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ktp_own_saved_filters on public.ktp_saved_filters to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (
    select 1 from public.ktp_forecast_datasets d where d.dataset_id = ktp_saved_filters.dataset_id and d.status = 'published'
  ));
comment on table public.ktp_followed_areas is 'User-owned followed administrative areas. No prototype localStorage import.';
comment on table public.ktp_saved_filters is 'Explicit saved forecast views, isolated per Supabase Auth user. No tokens or arbitrary URLs.';
commit;
