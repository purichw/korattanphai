begin;

alter table public.ktp_forecast_datasets
  drop constraint ktp_forecast_datasets_source_time_role_check,
  add constraint ktp_forecast_datasets_source_time_role_check
    check (source_time_role in ('UNCONFIRMED_PRODUCT_USES_TARGET', 'CONFIRMED_SOURCE_IS_ORIGIN')),
  add column normalization_manifest jsonb;
alter table public.ktp_forecast_values
  add column source_first_row integer check (source_first_row > 1),
  add column source_row_count integer check (source_row_count > 0);

-- Saved filters already store T. Keep their values, owner/RLS and UI contract
-- unchanged while new runs store the actual forward target date.
alter table public.ktp_forecast_runs
  add constraint ktp_runs_source_selection_key unique (dataset_id, source_year_month, horizon);
do $$ declare fk record; begin
  for fk in select conname from pg_constraint
    where conrelid = 'public.ktp_saved_filters'::regclass
      and confrelid = 'public.ktp_forecast_runs'::regclass and contype = 'f'
  loop execute format('alter table public.ktp_saved_filters drop constraint %I', fk.conname); end loop;
end $$;
alter table public.ktp_saved_filters add constraint ktp_saved_filters_source_run_fkey
  foreign key (dataset_id, target_period, horizon)
  references public.ktp_forecast_runs(dataset_id, source_year_month, horizon);
comment on column public.ktp_forecast_runs.source_year_month is
  'Verbatim workbook Year/Month. For CONFIRMED_SOURCE_IS_ORIGIN datasets, equals origin_period; target_period = origin_period + horizon.';

create function public.ktp_validate_rev03_lineage() returns trigger
language plpgsql set search_path = '' as $$
begin
  if NEW.status = 'published' and NEW.source_time_role = 'CONFIRMED_SOURCE_IS_ORIGIN' then
    if NEW.normalization_manifest is null or NEW.source_sha256 is distinct from NEW.normalization_manifest->>'source_sha256'
      or NEW.normalization_manifest->>'source_month_role' is distinct from 'forecast_origin_month' then
      raise exception 'Origin archive requires verified original-workbook lineage';
    end if;
    if exists (select 1 from public.ktp_forecast_runs r where r.dataset_id = NEW.dataset_id
      and r.source_year_month is distinct from r.origin_period) then
      raise exception 'Origin must equal the original workbook month';
    end if;
    if exists (select 1 from public.ktp_forecast_values v where v.dataset_id = NEW.dataset_id
      and (v.source_first_row is null or v.source_row_count is null)) then
      raise exception 'Every prediction must trace to an original workbook row';
    end if;
  end if;
  return NEW;
end;
$$;
create trigger ktp_rev03_lineage before insert or update on public.ktp_forecast_datasets
  for each row execute function public.ktp_validate_rev03_lineage();

-- Legacy JSON field names remain a presentation adapter only, never date math.
create or replace function public.ktp_load_forecast_archive(p_version text, p_horizon_count integer default 6)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with dataset as (
    select dataset_id, case when p_horizon_count = 1 then overview_manifest else archive_manifest end as manifest
    from public.ktp_forecast_datasets
    where version_label = p_version and status = 'published' and p_horizon_count in (1, 6)
  ), risks as (
    select to_char(r.source_year_month, 'YYYY-MM') as period, v.subdistrict_code,
      jsonb_agg(v.risk_level order by v.horizon) as values
    from public.ktp_forecast_values v
    join dataset d using (dataset_id)
    join public.ktp_forecast_runs r using (dataset_id, origin_period, horizon)
    where v.horizon <= p_horizon_count
    group by r.source_year_month, v.subdistrict_code
  ), months as (
    select period, jsonb_object_agg(subdistrict_code, values) as values from risks group by period
  )
  select d.manifest || jsonb_build_object('packedRiskByTargetMonth', (select jsonb_object_agg(period, values) from months))
  from dataset d where d.manifest is not null;
$$;

commit;
