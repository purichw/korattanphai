declare module '*.geojson' {
  const collection: import('geojson').FeatureCollection<import('geojson').Geometry, { Admin_code: number }>;
  export default collection;
}
