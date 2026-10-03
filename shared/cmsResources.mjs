// Only resources consumed by the current forecast website belong in this list.
// Retired CMS versions remain in storage for read/history; they are not startup
// dependencies and must not be seeded, cloned, edited or republished by this app.
export const CMS_RESOURCES = [
  { key: 'canonical/nakhon_ratchasima/admin_hierarchy', group: 'reference', preload: true, editable: false },
  { key: 'generated/forecast-archive-summary', group: 'derived', preload: true, editable: false },
  ...['nakhon-ratchasima-subdistricts', 'thailand-adm1', 'nakhon-ratchasima-boundary'].map(key => ({
    key: `geodata/${key}`, group: 'geometry', preload: false, editable: false,
  })),
];
export const CMS_RESOURCE_BY_KEY = new Map(CMS_RESOURCES.map(resource => [resource.key, resource]));
export const resourceSourcePath = resource => resource.group === 'geometry' ? `public/${resource.key}.geojson` : `src/data/${resource.key}.json`;
