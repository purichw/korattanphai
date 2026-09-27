// Resource identifiers are schema/configuration; the values live in CMS.
const catalog = [
  'advisory', 'crop_profiles', 'data_model_registry', 'data_period', 'event_detail_enrichment',
  'farmer_profile', 'field_verification_tasks', 'historical_analogues', 'locations',
  'long_term_climate_illustrative', 'map_layer_catalog', 'national_monthly_backbone',
  'outcome_analytics', 'province_monthly_risk', 'risk_events', 'source_registry', 'users',
];
const local = [
  'admin_hierarchy', 'district_subdistrict_matrix', 'dwr_ews_station_coverage', 'evidence_records',
  'local_subset', 'map_layers', 'opsmoac_monthly_reports', 'rainfall_monthly_history',
  'rainfall_observations_24h', 'rainfall_source_audit', 'rainfall_stations',
  'normalized_research_monthly_panel', 'normalized_research_panel_summary', 'source_matrix',
  'subdistrict_rainfall_coverage', 'temporal_matrix',
];
export const CMS_RESOURCES = [
  ...catalog.map(key => ({ key: `canonical/${key}`,
    group: ['locations', 'source_registry', 'map_layer_catalog', 'data_model_registry'].includes(key) ? 'reference' : 'retained', preload: true })),
  ...local.map(key => ({ key: `canonical/nakhon_ratchasima/${key}`, group: 'reference', preload: true })),
  { key: 'generated/forecast-archive-summary', group: 'derived', preload: true },
  ...['existing_prototype_province_month', 'manifest', 'validation', 'schema_mapping', 'local_subset_rows', 'hotspot_evidence_matrix', 'drought_forecast_archive_rev02'].map(key => ({
    key: `canonical/nakhon_ratchasima/${key}`, group: 'retained', preload: false,
  })),
  ...['nakhon-ratchasima-subdistricts', 'thailand-adm1', 'nakhon-ratchasima-boundary', 'thailand-neighbor-context'].map(key => ({
    key: `geodata/${key}`, group: 'geometry', preload: false,
  })),
];
export const CMS_RESOURCE_BY_KEY = new Map(CMS_RESOURCES.map(resource => [resource.key, resource]));
export const resourceSourcePath = resource => resource.group === 'geometry' ? `public/${resource.key}.geojson` : `src/data/${resource.key}.json`;
