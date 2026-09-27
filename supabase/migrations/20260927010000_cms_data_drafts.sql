-- Prepared only. Applying this migration is a separate, owner-approved action.
-- Existing staff accounts share the operator role. New accounts are not enrolled
-- automatically; display personas and user_metadata cannot grant this access.
create table public.ktp_cms_operators (
  user_id uuid primary key references auth.users(id),
  enabled boolean not null default true,
  granted_at timestamptz not null default clock_timestamp()
);
insert into public.ktp_cms_operators(user_id) select id from auth.users;

create table public.ktp_cms_drafts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('station', 'satellite', 'crop', 'forecast', 'archive')),
  title text not null check (length(title) between 1 and 160),
  source_filename text not null check (length(source_filename) <= 240),
  original_payload jsonb not null,
  payload jsonb not null,
  original_hash text not null check (original_hash ~ '^[a-f0-9]{64}$'),
  revision integer not null default 1 check (revision > 0),
  state text not null default 'draft' check (state in ('draft', 'accepted')),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  accepted_hash text,
  accepted_at timestamptz,
  check (octet_length(payload::text) <= 4194304),
  check (jsonb_typeof(payload) = 'object' and jsonb_typeof(original_payload) = 'object')
);
create index ktp_cms_drafts_updated_idx on public.ktp_cms_drafts(updated_at desc, id);

create table public.ktp_cms_audit (
  id bigint generated always as identity primary key,
  draft_id uuid not null references public.ktp_cms_drafts(id),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('create', 'edit', 'accept')),
  revision integer not null,
  reason text not null,
  before_payload jsonb,
  after_payload jsonb not null,
  occurred_at timestamptz not null default clock_timestamp()
);

alter table public.ktp_cms_operators enable row level security;
alter table public.ktp_cms_drafts enable row level security;
alter table public.ktp_cms_audit enable row level security;
revoke all on public.ktp_cms_operators, public.ktp_cms_drafts, public.ktp_cms_audit from public, anon, authenticated, service_role;

-- Only the server can call this RPC, after verifying the real Auth session.
-- The database checks membership again for every operation, including reads.
create function public.ktp_cms_operation(p_actor uuid, p_operation text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d public.ktp_cms_drafts;
  previous jsonb;
  result jsonb;
  n integer;
begin
  if not exists (select 1 from public.ktp_cms_operators where user_id = p_actor and enabled) then
    raise exception 'cms_forbidden' using errcode = '42501';
  end if;
  if p_operation = 'access' then return jsonb_build_object('role', 'operator'); end if;
  if p_operation = 'list' then
    n := coalesce((p_args->>'offset')::integer, 0);
    if n < 0 or n > 100000 then raise exception 'cms_invalid_offset'; end if;
    select jsonb_build_object('items', coalesce(jsonb_agg(x), '[]'::jsonb),
      'total', (select count(*) from public.ktp_cms_drafts)) into result
    from (select id, kind, title, source_filename, revision, state, updated_at, created_at
      from public.ktp_cms_drafts order by updated_at desc, id limit 50 offset n) x;
    return result;
  end if;
  if p_operation = 'create' then
    if p_args->>'kind' not in ('station','satellite','crop','forecast','archive')
      or jsonb_typeof(p_args->'payload') is distinct from 'object' then raise exception 'cms_invalid_draft'; end if;
    insert into public.ktp_cms_drafts(kind,title,source_filename,original_payload,payload,original_hash,created_by,updated_by)
      values(p_args->>'kind', p_args->>'title', p_args->>'sourceFilename', p_args->'payload', p_args->'payload',
        p_args->>'originalHash', p_actor, p_actor) returning * into d;
    insert into public.ktp_cms_audit(draft_id,actor_id,action,revision,reason,after_payload)
      values(d.id,p_actor,'create',1,'import',d.payload);
    return to_jsonb(d) - 'original_payload';
  end if;
  select * into d from public.ktp_cms_drafts where id = (p_args->>'id')::uuid for update;
  if not found then raise exception 'cms_not_found' using errcode = 'P0002'; end if;
  if p_operation = 'get' then return to_jsonb(d) - 'original_payload'; end if;
  if p_operation = 'original' then return jsonb_build_object('payload', d.original_payload, 'hash', d.original_hash); end if;
  if p_operation = 'audit' then
    select coalesce(jsonb_agg(x order by x.id desc), '[]'::jsonb) into result from
      (select id,action,revision,reason,actor_id,occurred_at from public.ktp_cms_audit
        where draft_id = d.id order by id desc limit 100) x;
    return result;
  end if;
  if p_args->>'revision' is null or (p_args->>'revision')::integer <> d.revision then
    raise exception 'cms_revision_conflict' using errcode = '40001';
  end if;
  if d.state <> 'draft' then raise exception 'cms_immutable' using errcode = '55000'; end if;
  if length(btrim(coalesce(p_args->>'reason',''))) not between 1 and 1000 then raise exception 'cms_reason_required'; end if;
  previous := d.payload;
  if p_operation = 'edit' then
    if jsonb_typeof(p_args->'payload') is distinct from 'object' then raise exception 'cms_invalid_draft'; end if;
    update public.ktp_cms_drafts set payload=p_args->'payload', revision=revision+1,
      updated_by=p_actor, updated_at=clock_timestamp() where id=d.id returning * into d;
  elsif p_operation = 'accept' then
    -- Canonical data has been revalidated by the shared API validator immediately
    -- before this call. Revision locking makes that verdict apply to this draft.
    if d.kind in ('forecast','archive') then raise exception 'cms_forecast_publication_not_enabled'; end if;
    if (p_args->'payload'->>'kind') is distinct from (case when d.kind='station' then null else d.kind end)
      or p_args->>'contentHash' !~ '^[a-f0-9]{64}$' then raise exception 'cms_invalid_acceptance'; end if;
    insert into public.model_input_batches(source_id,batch_id,content_hash,payload,observation_count)
      values(p_args->'payload'->>'sourceId',p_args->'payload'->>'batchId',p_args->>'contentHash',
        p_args->'payload',jsonb_array_length(p_args->'payload'->'observations'));
    update public.ktp_cms_drafts set payload=p_args->'payload', state='accepted', revision=revision+1,
      accepted_hash=p_args->>'contentHash', accepted_at=clock_timestamp(), updated_by=p_actor,
      updated_at=clock_timestamp() where id=d.id returning * into d;
  else raise exception 'cms_unknown_operation';
  end if;
  insert into public.ktp_cms_audit(draft_id,actor_id,action,revision,reason,before_payload,after_payload)
    values(d.id,p_actor,p_operation,d.revision,btrim(p_args->>'reason'),previous,d.payload);
  return to_jsonb(d) - 'original_payload';
end;
$$;
revoke all on function public.ktp_cms_operation(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.ktp_cms_operation(uuid,text,jsonb) to service_role;
