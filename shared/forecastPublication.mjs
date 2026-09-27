export const FORECAST_PUBLICATION_SOURCES = ['normalized_rev03_original_workbook', 'admin_reviewed_forecast'];
export function isForecastPublicationSource(value) {
  return FORECAST_PUBLICATION_SOURCES.includes(value);
}
