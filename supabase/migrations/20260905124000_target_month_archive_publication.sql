begin;

-- Preserve the original guard for origin-based datasets. Rev02 is a complete
-- target-month archive; boundary origins intentionally have fewer horizons.
create or replace function public.ktp_validate_publication() returns trigger
language plpgsql set search_path = '' as $$
declare total_subdistricts bigint; mapped bigint;
begin
  if TG_OP in ('UPDATE', 'DELETE') then
    if OLD.status = 'published' then raise exception 'Published dataset is immutable; create a new version'; end if;
    if TG_OP = 'DELETE' then return OLD; end if;
  end if;
  if NEW.status = 'published' then
    select count(*) into total_subdistricts from public.ktp_subdistricts;
    select count(*) into mapped from public.ktp_research_crosswalk c where c.dataset_id = NEW.dataset_id;
    if total_subdistricts <> 289 or mapped <> total_subdistricts then
      raise exception 'Publication requires the verified crosswalk for all 289 subdistricts';
    end if;
    if not exists (select 1 from public.ktp_forecast_runs r where r.dataset_id = NEW.dataset_id) then
      raise exception 'Cannot publish an archive without runs';
    end if;
    if NEW.source_time_role = 'UNCONFIRMED_PRODUCT_USES_TARGET' then
      if exists (select 1 from public.ktp_forecast_runs r where r.dataset_id = NEW.dataset_id
        and (r.source_year_month is null or r.source_year_month is distinct from r.target_period)) then
        raise exception 'Target-month archive must preserve every source month';
      end if;
      if exists (select 1 from public.ktp_forecast_runs r where r.dataset_id = NEW.dataset_id
        group by r.target_period having count(*) <> 6) then
        raise exception 'Each target month must contain T+1 through T+6';
      end if;
    elsif exists (select 1 from public.ktp_forecast_runs r where r.dataset_id = NEW.dataset_id
      group by r.origin_period having count(*) <> 6) then
      raise exception 'Each origin must contain T+1 through T+6';
    end if;
    if exists (select 1 from public.ktp_forecast_runs r left join public.ktp_forecast_values v
      on v.dataset_id = r.dataset_id and v.origin_period = r.origin_period and v.horizon = r.horizon
      where r.dataset_id = NEW.dataset_id group by r.origin_period, r.horizon
      having count(v.subdistrict_code) <> total_subdistricts) then
      raise exception 'Every run requires one explicit IN_SCOPE/OUT_OF_SCOPE row per subdistrict';
    end if;
  end if;
  return NEW;
end;
$$;
commit;
