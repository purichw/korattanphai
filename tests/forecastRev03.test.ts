import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import runtime from '../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json';
import normalized from '../data/normalized/drought-rev03/forecast_archive.json';
import { buildRev03Archive, readRev03Inputs } from '../scripts/lib/forecast-rev03.mjs';
import { forecastArchiveRecordsForSelection, localMapStatusForForecastRecord } from '../src/components/nakhon-ratchasima/forecastModel';
import type { NakhonRatchasimaDroughtForecastArchive } from '../src/types';

it('deterministically rebuilds the runtime from verified rev03 normalized data and unchanged geography', async () => {
  const rebuilt = buildRev03Archive(await readRev03Inputs());
  expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(runtime));
  expect(runtime.mapping.sourceCorrections).toHaveLength(1);
  expect(runtime.locations.find((l) => l.sourceId === '5')?.subdistrictCode).toBe('300106');
  expect(runtime.locations.find((l) => l.sourceId === '222')).toMatchObject({
    sourceAmphoeEn: 'Mueang Nakhon Ratchasima', sourceAmphoeEnCorrected: 'Phimai', subdistrictCode: '301512',
  });
});

it('keeps all source values and irrigation metadata intact through administrative mapping and every map status', () => {
  const archive = runtime as NakhonRatchasimaDroughtForecastArchive;
  const sourceRows = normalized.packedRiskBySourceMonth as Record<string, Record<string, (0 | 1 | 2 | null)[]>>;
  const sourceLocations = new Map(normalized.locations.map((l) => [l.source_id, l]));
  let checked = 0;
  const mismatches: string[] = [];
  for (const month of archive.targetMonths) for (const horizon of [1, 2, 3, 4, 5, 6] as const) {
    const records = forecastArchiveRecordsForSelection(archive, month, horizon);
    for (const location of archive.locations) {
      const source = sourceLocations.get(location.sourceId)!;
      const risk = sourceRows[month.period][location.sourceId][horizon - 1];
      const record = records.get(location.subdistrictCode);
      const expectedStatus = risk === null ? 'forecast-out-of-scope' : ['forecast-no-risk', 'forecast-moderate', 'forecast-high'][risk];
      if (!record || record.forecastRisk !== risk || localMapStatusForForecastRecord(record) !== expectedStatus ||
          location.sourceAmphoeEn !== source.source_amphoe_en || location.sourceTambonEn !== source.source_tambon_en ||
          location.irrigationStatus !== source.irrigation_status || location.irrigationStatusRaw !== source.irrigation_status_raw) {
        mismatches.push(`${month.period}/${location.sourceId}/T+${horizon}`);
      }
      checked++;
    }
  }
  expect(checked).toBe(220218);
  expect(mismatches).toEqual([]);
  expect(localMapStatusForForecastRecord(undefined)).toBe('forecast-missing');
  const css = readFileSync('src/styles.css', 'utf8');
  expect(css).toMatch(/\.nr-map-shape\.is-forecast-no-risk\s*\{\s*fill: #5dae79/);
  expect(css).toMatch(/\.nr-map-shape\.is-forecast-moderate\s*\{\s*fill: #f1b84b/);
  expect(css).toMatch(/\.nr-map-shape\.is-forecast-high\s*\{\s*fill: #d95d59/);
});
