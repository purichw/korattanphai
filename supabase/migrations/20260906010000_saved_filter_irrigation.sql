-- Add a selection dimension only; forecast data and existing owner RLS are unchanged.
alter table public.ktp_saved_filters
  add column irrigation_criterion text not null default 'all'
  check (irrigation_criterion in ('all', 'irrigated', 'rainfed', 'unknown'));

comment on column public.ktp_saved_filters.irrigation_criterion is
  'Location irrigation filter: Irrigation=irrigated, RainFed=rainfed, Collecting=unknown. Independent of forecast risk and scope.';
