-- Read-only dashboard audit, 2026-09-05. Reconstructs the six existing tables
-- for isolated tests/new environments. DO NOT apply to the linked project.
create table public.ktp_districts (
  district_code text primary key check (district_code ~ '^30[0-9]{2}$'),
  province_code text not null default '30' check (province_code = '30'),
  province_id text not null default 'TH-P29' check (province_id = 'TH-P29'),
  canonical_id text not null unique, name_th text not null, name_en text not null,
  routing_slug text not null unique
);
create table public.ktp_subdistricts (
  subdistrict_code text primary key check (subdistrict_code ~ '^30[0-9]{4}$'),
  district_code text not null references public.ktp_districts,
  canonical_id text not null unique, name_th text not null, routing_slug text not null unique,
  check (left(subdistrict_code, 4) = district_code)
);
create table public.ktp_forecast_datasets (
  dataset_id uuid primary key default gen_random_uuid(), version_label text not null unique,
  source_filename text not null, source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  model_version text not null, provenance text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(), published_at timestamptz,
  check ((status = 'draft' and published_at is null) or (status = 'published' and published_at is not null))
);
create table public.ktp_forecast_runs (
  dataset_id uuid not null references public.ktp_forecast_datasets,
  origin_period date not null check (extract(day from origin_period) = 1),
  horizon integer not null check (horizon between 1 and 6),
  target_period date generated always as ((origin_period + make_interval(months => horizon))::date) stored,
  primary key (dataset_id, origin_period, horizon), unique (dataset_id, target_period, horizon)
);
create table public.ktp_research_crosswalk (
  dataset_id uuid not null references public.ktp_forecast_datasets,
  research_id integer not null check (research_id >= 0),
  subdistrict_code text not null references public.ktp_subdistricts,
  mapping_evidence text not null,
  primary key (dataset_id, research_id), unique (dataset_id, subdistrict_code),
  unique (dataset_id, research_id, subdistrict_code)
);
create table public.ktp_forecast_values (
  dataset_id uuid not null, origin_period date not null, horizon integer not null,
  subdistrict_code text not null, research_id integer not null,
  study_scope text not null check (study_scope in ('IN_SCOPE', 'OUT_OF_SCOPE')), risk_level smallint,
  primary key (dataset_id, origin_period, horizon, subdistrict_code),
  foreign key (dataset_id, origin_period, horizon) references public.ktp_forecast_runs,
  foreign key (dataset_id, research_id, subdistrict_code) references public.ktp_research_crosswalk(dataset_id, research_id, subdistrict_code),
  check ((study_scope = 'IN_SCOPE' and risk_level is not null and risk_level in (0, 1, 2)) or (study_scope = 'OUT_OF_SCOPE' and risk_level is null))
);
alter table public.ktp_districts enable row level security;
alter table public.ktp_subdistricts enable row level security;
alter table public.ktp_forecast_datasets enable row level security;
alter table public.ktp_forecast_runs enable row level security;
alter table public.ktp_forecast_values enable row level security;
alter table public.ktp_research_crosswalk enable row level security;
create policy ktp_read_districts on public.ktp_districts for select to authenticated using (true);
create policy ktp_read_subdistricts on public.ktp_subdistricts for select to authenticated using (true);
create policy ktp_read_published_datasets on public.ktp_forecast_datasets for select to authenticated using (status = 'published');
create policy ktp_read_published_runs on public.ktp_forecast_runs for select to authenticated using (exists (
  select 1 from public.ktp_forecast_datasets d where d.dataset_id = ktp_forecast_runs.dataset_id and d.status = 'published'
));
create policy ktp_read_published_values on public.ktp_forecast_values for select to authenticated using (exists (
  select 1 from public.ktp_forecast_datasets d where d.dataset_id = ktp_forecast_values.dataset_id and d.status = 'published'
));
grant select on public.ktp_districts, public.ktp_subdistricts, public.ktp_forecast_datasets,
  public.ktp_forecast_runs, public.ktp_forecast_values to authenticated;
