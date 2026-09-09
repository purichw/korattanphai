-- Additive collector storage. No forecast table, publication, or personal record
-- is changed. Only server-side service credentials may insert/read these rows.
create table public.model_input_batches (
  source_id text collate "C" not null check (source_id ~ '^[a-z][a-z0-9_-]{0,63}$'),
  batch_id text collate "C" not null check (batch_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  received_at timestamptz not null default clock_timestamp(),
  payload jsonb not null,
  observation_count integer not null check (observation_count between 0 and 2000),
  primary key (source_id, batch_id),
  constraint model_input_batch_shape check ((
    jsonb_typeof(payload) = 'object'
    and payload -> 'schemaVersion' = '1'::jsonb
    and payload ->> 'sourceId' = source_id
    and payload ->> 'batchId' = batch_id
    and jsonb_typeof(payload -> 'observations') = 'array'
    and jsonb_array_length(payload -> 'observations') = observation_count
    and octet_length(payload::text) <= 2097152
  ) is true)
);

create index model_input_batches_received_idx
  on public.model_input_batches (source_id, received_at desc, batch_id desc);

alter table public.model_input_batches enable row level security;
revoke all on public.model_input_batches from public, anon, authenticated;
revoke all on public.model_input_batches from service_role;
grant select, insert on public.model_input_batches to service_role;

create policy model_input_batches_server_read on public.model_input_batches
  for select to service_role using (true);
create policy model_input_batches_server_insert on public.model_input_batches
  for insert to service_role with check (true);
