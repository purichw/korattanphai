-- Prepared only. Apply/seed/cutover require separate owner approval.
begin;
create table public.ktp_cms_resources (
  id uuid primary key default gen_random_uuid(),
  resource_key text not null check(length(resource_key) between 1 and 160),
  title text not null,
  resource_group text not null check(resource_group in ('reference','retained','derived','geometry')),
  payload jsonb not null,
  base_id uuid references public.ktp_cms_resources(id),
  revision integer not null default 1 check(revision>0),
  state text not null default 'draft' check(state in ('draft','published')),
  original_sha256 text,
  created_at timestamptz not null default clock_timestamp(),
  published_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  actor_id uuid references auth.users(id),
  reason text not null
);
create index ktp_cms_resources_head on public.ktp_cms_resources(resource_key,published_at desc) where state='published';
create table public.ktp_cms_resource_audit (
  id bigint generated always as identity primary key,
  resource_id uuid not null references public.ktp_cms_resources(id),
  revision integer not null, actor_id uuid not null references auth.users(id),
  action text not null, reason text not null, before_payload jsonb, after_payload jsonb,
  occurred_at timestamptz not null default clock_timestamp()
);
alter table public.ktp_cms_resources enable row level security;
alter table public.ktp_cms_resource_audit enable row level security;
revoke all on public.ktp_cms_resources,public.ktp_cms_resource_audit from public,anon,authenticated,service_role;
revoke all on sequence public.ktp_cms_resource_audit_id_seq from public,anon,authenticated,service_role;

create function public.ktp_cms_resource_immutable() returns trigger language plpgsql set search_path='' as $$
begin
  if old.state='published' then raise exception 'Published resource is immutable' using errcode='55000'; end if;
  return new;
end $$;
create trigger ktp_cms_resource_immutable before update or delete on public.ktp_cms_resources
for each row execute function public.ktp_cms_resource_immutable();

create function public.ktp_cms_reference_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(h)) from (
    select distinct on(resource_key) id,resource_key,title,resource_group,published_at,original_sha256
    from public.ktp_cms_resources where state='published' order by resource_key,published_at desc,id desc
  )h),'[]'::jsonb);
end $$;
create function public.ktp_cms_reference_read(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select payload into result from public.ktp_cms_resources where id=p_id and state='published';
  if not found then raise exception 'Resource unavailable' using errcode='P0002'; end if;
  return result;
end $$;
revoke all on function public.ktp_cms_reference_catalog(),public.ktp_cms_reference_read(uuid) from public,anon;
grant execute on function public.ktp_cms_reference_catalog(),public.ktp_cms_reference_read(uuid) to authenticated;

create function public.ktp_cms_reference_bundle(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; matched integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if cardinality(p_ids) not between 1 and 40 then raise exception 'Invalid reference request' using errcode='22023'; end if;
  select jsonb_object_agg(resource_key,payload),count(*) into result,matched from public.ktp_cms_resources
    where id=any(p_ids) and state='published' and resource_group<>'geometry';
  if matched<>cardinality(p_ids) or (select count(*) from jsonb_object_keys(result))<>matched then
    raise exception 'Incomplete reference bundle' using errcode='P0002';
  end if;
  return result;
end $$;
revoke all on function public.ktp_cms_reference_bundle(uuid[]) from public,anon;
grant execute on function public.ktp_cms_reference_bundle(uuid[]) to authenticated;

create function public.ktp_cms_resource_operation(p_actor uuid,p_operation text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.ktp_cms_resources; base public.ktp_cms_resources; latest uuid; result jsonb;
begin
  if not exists(select 1 from public.ktp_cms_operators where user_id=p_actor and enabled) then
    raise exception 'CMS access denied' using errcode='42501';
  end if;
  if p_operation='catalog' then
    return coalesce((select jsonb_agg(to_jsonb(h)||jsonb_build_object('draft_id',
      (select d.id from public.ktp_cms_resources d where d.base_id=h.id and d.state='draft' order by d.updated_at desc,d.id desc limit 1))) from (
      select distinct on(resource_key) id,resource_key,title,resource_group,published_at,original_sha256
      from public.ktp_cms_resources where state='published' order by resource_key,published_at desc,id desc
    )h),'[]'::jsonb);
  elsif p_operation='clone' then
    select * into base from public.ktp_cms_resources where resource_key=p_args->>'key' and state='published'
      order by published_at desc,id desc limit 1;
    if not found then raise exception 'Unknown resource' using errcode='P0002'; end if;
    insert into public.ktp_cms_resources(resource_key,title,resource_group,payload,base_id,actor_id,reason)
      values(base.resource_key,base.title,base.resource_group,base.payload,base.id,p_actor,'Clone published reference') returning * into item;
  else
    select * into item from public.ktp_cms_resources where id=(p_args->>'id')::uuid for update;
    if not found then raise exception 'Unknown draft' using errcode='P0002'; end if;
    if p_operation='get' then return to_jsonb(item); end if;
    if p_operation='history' then
      return coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from (
        select id,revision,actor_id,action,reason,occurred_at from public.ktp_cms_resource_audit
        where resource_id=item.id order by id desc limit 100)a),'[]'::jsonb);
    end if;
    if item.state<>'draft' then raise exception 'Immutable reference' using errcode='55000'; end if;
    if item.revision<>(p_args->>'revision')::integer then raise exception 'Stale revision' using errcode='40001'; end if;
    if length(trim(coalesce(p_args->>'reason',''))) not between 1 and 1000 then raise exception 'Reason required' using errcode='22023'; end if;
    if p_operation='edit' then
      if item.resource_group<>'reference' or not(p_args ? 'payload') then raise exception 'Review required' using errcode='22023'; end if;
      insert into public.ktp_cms_resource_audit(resource_id,revision,actor_id,action,reason,before_payload,after_payload)
        values(item.id,item.revision+1,p_actor,'edit',p_args->>'reason',item.payload,p_args->'payload');
      update public.ktp_cms_resources set payload=p_args->'payload',revision=revision+1,updated_at=clock_timestamp(),actor_id=p_actor,
        reason=p_args->>'reason' where id=item.id returning * into item;
      return to_jsonb(item);
    elsif p_operation='publish' then
      perform pg_advisory_xact_lock(739204,2);
      select id into latest from public.ktp_cms_resources where resource_key=item.resource_key and state='published'
        order by published_at desc,id desc limit 1;
      if latest is distinct from item.base_id then raise exception 'Published base changed' using errcode='40001'; end if;
      update public.ktp_cms_resources set state='published',published_at=clock_timestamp(),updated_at=clock_timestamp(),actor_id=p_actor,
        reason=p_args->>'reason' where id=item.id returning * into item;
    else raise exception 'Unknown operation' using errcode='22023'; end if;
  end if;
  insert into public.ktp_cms_resource_audit(resource_id,revision,actor_id,action,reason,after_payload)
    values(item.id,item.revision,p_actor,p_operation,item.reason,item.payload);
  return to_jsonb(item);
end $$;
revoke all on function public.ktp_cms_resource_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ktp_cms_resource_operation(uuid,text,jsonb) to service_role;
commit;
