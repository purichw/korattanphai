-- Prepared, not applied. Reviewed edits create new immutable forecast datasets.
alter table public.ktp_cms_drafts drop constraint ktp_cms_drafts_kind_check;
alter table public.ktp_cms_drafts add constraint ktp_cms_drafts_kind_check
  check (kind in ('station','satellite','crop','forecast','archive'));
create table public.ktp_cms_forecast_publications (
  dataset_id uuid primary key references public.ktp_forecast_datasets,
  draft_id uuid not null references public.ktp_cms_drafts,
  review jsonb not null
);
alter table public.ktp_cms_forecast_publications enable row level security;
revoke all on public.ktp_cms_forecast_publications from public, anon, authenticated, service_role;

create or replace function public.ktp_latest_forecast_revision()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select archive_manifest->'meta' || jsonb_build_object('publishedAt', published_at)
  from public.ktp_forecast_datasets
  where status = 'published' and source_time_role = 'CONFIRMED_SOURCE_IS_ORIGIN'
    and archive_manifest->'meta'->>'sourceOfTruth' in ('normalized_rev03_original_workbook','admin_reviewed_forecast')
  order by published_at desc, dataset_id desc limit 1;
$$;

create function public.ktp_cms_forecast(p_actor uuid, p_operation text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  source public.ktp_forecast_datasets;
  draft public.ktp_cms_drafts;
  payload jsonb;
  result jsonb;
  cells jsonb;
  new_id uuid;
  version text;
  origin date;
  current_id uuid;
  n integer;
  published timestamptz;
  archive jsonb;
  overview jsonb;
  cell_count integer;
begin
  perform public.ktp_cms_operation(p_actor,'access','{}'::jsonb);
  if p_operation = 'catalog' then
    select * into source from public.ktp_forecast_datasets
      where dataset_id=(public.ktp_latest_forecast_revision()->>'datasetId')::uuid;
    if not found then return jsonb_build_object('revision',null,'periods','[]'::jsonb); end if;
    select jsonb_agg(period order by period desc) into result from
      (select distinct to_char(origin_period,'YYYY-MM') period from public.ktp_forecast_runs where dataset_id=source.dataset_id) m;
    return jsonb_build_object('revision', source.archive_manifest->'meta', 'periods', result);
  end if;
  if p_operation = 'crosswalk' then
    select jsonb_agg(jsonb_build_object('sourceId',research_id,'subdistrictCode',subdistrict_code) order by research_id) into result
      from public.ktp_research_crosswalk where dataset_id=(public.ktp_latest_forecast_revision()->>'datasetId')::uuid;
    return coalesce(result,'[]'::jsonb);
  end if;
  if p_operation = 'read' then
    select * into source from public.ktp_forecast_datasets where dataset_id=(p_args->>'datasetId')::uuid
      and status='published' and source_time_role='CONFIRMED_SOURCE_IS_ORIGIN';
    if not found then raise exception 'cms_not_found' using errcode='P0002'; end if;
    if p_args->>'originMonth' !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'cms_invalid_month'; end if;
    origin := (p_args->>'originMonth' || '-01')::date;
    select jsonb_agg(jsonb_build_object('subdistrictCode',v.subdistrict_code,'horizonMonths',v.horizon,
      'targetMonth',to_char(r.target_period,'YYYY-MM'), 'status',case when v.study_scope='IN_SCOPE' then 'predicted' else 'out_of_scope' end,
      'riskCode',v.risk_level) order by v.subdistrict_code,v.horizon) into cells
      from public.ktp_forecast_values v join public.ktp_forecast_runs r using(dataset_id,origin_period,horizon)
      where v.dataset_id=source.dataset_id and v.origin_period=origin;
    if cells is null then raise exception 'cms_not_found' using errcode='P0002'; end if;
    return jsonb_build_object('schemaVersion',1,'baseDatasetId',source.dataset_id,'originMonth',p_args->>'originMonth',
      'scope',jsonb_build_object('subdistrictCodes',(select jsonb_agg(subdistrict_code order by subdistrict_code) from public.ktp_subdistricts)),
      'predictions',cells);
  end if;
  if p_operation <> 'publish' then raise exception 'cms_unknown_operation'; end if;
  -- Serialize publications as well as edits to prevent two drafts replacing the
  -- same base. This lock is local to the transaction and has no client bypass.
  perform pg_advisory_xact_lock(27092701);
  select * into draft from public.ktp_cms_drafts where id=(p_args->>'id')::uuid for update;
  if not found then raise exception 'cms_not_found' using errcode='P0002'; end if;
  if draft.revision is distinct from (p_args->>'revision')::integer then raise exception 'cms_revision_conflict' using errcode='40001'; end if;
  if draft.state <> 'draft' then raise exception 'cms_immutable' using errcode='55000'; end if;
  if draft.kind <> 'archive' then raise exception 'cms_invalid_archive'; end if;
  if length(btrim(coalesce(p_args->>'reason',''))) not between 1 and 1000 then raise exception 'cms_reason_required'; end if;
  if coalesce(p_args->>'contentHash','') !~ '^[a-f0-9]{64}$' then raise exception 'cms_invalid_hash'; end if;
  payload := draft.payload;
  current_id := (public.ktp_latest_forecast_revision()->>'datasetId')::uuid;
  if current_id is distinct from (payload->>'baseDatasetId')::uuid then raise exception 'cms_revision_conflict' using errcode='40001'; end if;
  select * into source from public.ktp_forecast_datasets where dataset_id=current_id;
  if source.dataset_id is null then raise exception 'cms_not_found' using errcode='P0002'; end if;
  if payload->>'originMonth' !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'cms_invalid_month'; end if;
  origin := (payload->>'originMonth' || '-01')::date;
  if not exists (select 1 from public.ktp_forecast_runs where dataset_id=current_id and origin_period=origin) then
    raise exception 'cms_unknown_origin';
  end if;
  cells := payload->'predictions';
  select count(*) into n from public.ktp_subdistricts;
  if n <> 289 or jsonb_typeof(cells) is distinct from 'array' or jsonb_array_length(cells) <> n * 6 then raise exception 'cms_incomplete_forecast'; end if;
  select count(distinct (r."subdistrictCode",r."horizonMonths")) into cell_count
    from jsonb_to_recordset(cells) as r("subdistrictCode" text,"horizonMonths" integer,"targetMonth" text,status text,"riskCode" smallint)
    join public.ktp_subdistricts s on s.subdistrict_code=r."subdistrictCode"
    where r."horizonMonths" between 1 and 6 and r."targetMonth"=to_char(origin+make_interval(months=>r."horizonMonths"),'YYYY-MM')
      and ((r.status='predicted' and r."riskCode" in (0,1,2)) or (r.status='out_of_scope' and r."riskCode" is null));
  if cell_count <> n*6 then raise exception 'cms_invalid_forecast_cells'; end if;
  new_id := gen_random_uuid();
  version := 'cms-' || new_id::text;
  published := clock_timestamp();
  archive := source.archive_manifest || jsonb_build_object('horizonSummary','[]'::jsonb,'validationExamples','{}'::jsonb);
  overview := source.overview_manifest || jsonb_build_object('horizonSummary','[]'::jsonb,'validationExamples','{}'::jsonb);
  select jsonb_agg(jsonb_build_object('period',m->>'period','labelTh',m->>'labelTh','horizons',
    (select jsonb_agg(jsonb_build_object('horizon',h->'horizon','horizonLabel',h->>'horizonLabel',
      'issueMonth',h->>'issueMonth','targetMonth',h->>'targetMonth') order by h->>'horizon')
      from jsonb_array_elements(m->'horizons') h)) order by m->>'period') into result
    from jsonb_array_elements(archive->'targetMonths') m;
  archive := jsonb_set(archive,'{targetMonths}',result);
  select jsonb_agg(jsonb_build_object('period',m->>'period','labelTh',m->>'labelTh','horizons',
    (select jsonb_agg(jsonb_build_object('horizon',h->'horizon','horizonLabel',h->>'horizonLabel',
      'issueMonth',h->>'issueMonth','targetMonth',h->>'targetMonth') order by h->>'horizon')
      from jsonb_array_elements(m->'horizons') h)) order by m->>'period') into result
    from jsonb_array_elements(overview->'targetMonths') m;
  overview := jsonb_set(overview,'{targetMonths}',result);
  -- Keep original-workbook provenance; label corrected values as reviewed, never
  -- claim the corrected snapshot was the verbatim original workbook.
  archive := jsonb_set(archive,'{meta}', archive->'meta' || jsonb_build_object('datasetId',new_id,'datasetVersion',version,
    'sourceOfTruth','admin_reviewed_forecast','provenance','DERIVED','generatedAt',published,
    'reviewedFromDatasetId',current_id,'reviewedDraftId',draft.id));
  overview := jsonb_set(overview,'{meta}', overview->'meta' || jsonb_build_object('datasetId',new_id,'datasetVersion',version,
    'sourceOfTruth','admin_reviewed_forecast','provenance','DERIVED','generatedAt',published,
    'reviewedFromDatasetId',current_id,'reviewedDraftId',draft.id));
  insert into public.ktp_forecast_datasets(dataset_id,version_label,source_filename,source_sha256,model_version,provenance,
    normalized_sha256,canonical_sha256,source_time_role,archive_manifest,overview_manifest,normalization_manifest)
    values(new_id,version,source.source_filename,source.source_sha256,source.model_version,'DERIVED',
      source.normalized_sha256,null,source.source_time_role,archive,overview,source.normalization_manifest);
  insert into public.ktp_cms_forecast_publications(dataset_id,draft_id,review)
    values(new_id,draft.id,jsonb_build_object('baseDatasetId',current_id,'revision',draft.revision,'actorId',p_actor,
      'reason',p_args->>'reason','reviewedContentHash',p_args->>'contentHash','originMonth',payload->>'originMonth'));
  insert into public.ktp_research_crosswalk(dataset_id,research_id,subdistrict_code,mapping_evidence)
    select new_id,research_id,subdistrict_code,mapping_evidence from public.ktp_research_crosswalk where dataset_id=current_id;
  insert into public.ktp_forecast_runs(dataset_id,origin_period,horizon,source_year_month)
    select new_id,origin_period,horizon,source_year_month from public.ktp_forecast_runs where dataset_id=current_id;
  insert into public.ktp_forecast_values(dataset_id,origin_period,horizon,subdistrict_code,research_id,study_scope,risk_level,source_first_row,source_row_count)
    select new_id,v.origin_period,v.horizon,v.subdistrict_code,v.research_id,
      case when v.origin_period=origin then case when r.status='predicted' then 'IN_SCOPE' else 'OUT_OF_SCOPE' end else v.study_scope end,
      case when v.origin_period=origin then r."riskCode" else v.risk_level end,v.source_first_row,v.source_row_count
    from public.ktp_forecast_values v left join jsonb_to_recordset(cells) as r("subdistrictCode" text,"horizonMonths" integer,status text,"riskCode" smallint)
      on v.origin_period=origin and r."subdistrictCode"=v.subdistrict_code and r."horizonMonths"=v.horizon where v.dataset_id=current_id;
  update public.ktp_forecast_datasets set status='published',published_at=published where dataset_id=new_id;
  update public.ktp_cms_drafts set state='accepted',revision=revision+1,accepted_hash=p_args->>'contentHash',accepted_at=published,
    updated_at=published,updated_by=p_actor where id=draft.id returning * into draft;
  insert into public.ktp_cms_audit(draft_id,actor_id,action,revision,reason,before_payload,after_payload)
    values(draft.id,p_actor,'accept',draft.revision,p_args->>'reason',draft.payload,draft.payload);
  return to_jsonb(draft)-'original_payload';
end;
$$;
revoke all on function public.ktp_cms_forecast(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.ktp_cms_forecast(uuid,text,jsonb) to service_role;
