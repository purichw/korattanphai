-- Prepared only: activate with the model-input API deployment, after testing in
-- an isolated database. The counter contains opaque hashes, never tokens or IPs.
create table public.model_input_api_quotas (
  scope_key text primary key check (scope_key ~ '^[a-f0-9]{64}$'),
  minute_start bigint not null,
  minute_count integer not null default 0 check (minute_count >= 0),
  day_start bigint not null,
  day_count integer not null default 0 check (day_count >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.model_input_api_quotas enable row level security;
revoke all on public.model_input_api_quotas from public, anon, authenticated, service_role;

-- One transaction and one row lock serialize quota consumption for the client
-- across cold starts and parallel Vercel instances. Fixed windows use UTC.
create function public.consume_model_input_quota(
  p_scope_key text,
  p_minute_limit integer,
  p_daily_limit integer
) returns table (
  allowed boolean,
  retry_after_seconds integer,
  remaining_minute integer,
  remaining_daily integer
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_now bigint;
  v_minute bigint;
  v_day bigint;
  v_counter public.model_input_api_quotas%rowtype;
begin
  if p_scope_key is null or p_scope_key !~ '^[a-f0-9]{64}$'
    or p_minute_limit is null or p_minute_limit not between 1 and 60000
    or p_daily_limit is null or p_daily_limit not between 1 and 10000000 then
    raise exception 'Invalid quota configuration' using errcode = '22023';
  end if;

  v_now := floor(extract(epoch from clock_timestamp()))::bigint;
  v_minute := (v_now / 60) * 60;
  v_day := (v_now / 86400) * 86400;

  insert into public.model_input_api_quotas(scope_key, minute_start, day_start)
  values (p_scope_key, v_minute, v_day)
  on conflict (scope_key) do nothing;

  select * into strict v_counter from public.model_input_api_quotas
  where scope_key = p_scope_key for update;

  -- Re-read time after waiting for a lock, so queued requests use the window in
  -- which they consume quota, including a boundary crossed while blocked.
  v_now := floor(extract(epoch from clock_timestamp()))::bigint;
  v_minute := (v_now / 60) * 60;
  v_day := (v_now / 86400) * 86400;
  if v_counter.minute_start <> v_minute then v_counter.minute_count := 0; end if;
  if v_counter.day_start <> v_day then v_counter.day_count := 0; end if;
  allowed := v_counter.minute_count < p_minute_limit and v_counter.day_count < p_daily_limit;
  retry_after_seconds := greatest(
    case when v_counter.minute_count >= p_minute_limit then (v_minute + 60 - v_now)::integer else 0 end,
    case when v_counter.day_count >= p_daily_limit then (v_day + 86400 - v_now)::integer else 0 end
  );
  if allowed then
    v_counter.minute_count := v_counter.minute_count + 1;
    v_counter.day_count := v_counter.day_count + 1;
  end if;
  update public.model_input_api_quotas set
    minute_start = v_minute, minute_count = v_counter.minute_count,
    day_start = v_day, day_count = v_counter.day_count, updated_at = clock_timestamp()
  where scope_key = p_scope_key;
  remaining_minute := greatest(0, p_minute_limit - v_counter.minute_count);
  remaining_daily := greatest(0, p_daily_limit - v_counter.day_count);
  return next;
end;
$$;

revoke all on function public.consume_model_input_quota(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_model_input_quota(text, integer, integer) to service_role;
