import { describe, expect, it } from 'vitest';
import { analysisDistricts, areaMatchesSearch, filterAnalysisRows, forecastPattern, matchesRiskPattern } from '../src/forecastAnalysis';
import { buildForecastExport, buildForecastComparison, type ExportLocation } from '../src/forecastExportModel';
import { locateKoratPoint } from '../src/mapPoint';
import raw from '../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json';
import type { NakhonRatchasimaDroughtForecastArchive as Archive } from '../src/types';
import type { NakhonRatchasimaGeoFeature } from '../src/components/nakhon-ratchasima/workspaceModel';

const archive = raw as unknown as Archive;
const report = buildForecastExport(archive, { areaCode: '30', originPeriod: '2025-12', irrigation: 'all' });

describe('shared analysis preserves source risk and scope', () => {
  it('never bridges null or missing values, or claims a first risk after a gap', () => {
    expect(forecastPattern([1, 2, null, 1, 1, 1]).longestRun).toBe(3);
    expect(matchesRiskPattern([1, 2, undefined, 1, 2, null], 'consecutive3')).toBe(false);
    expect(matchesRiskPattern([0, 0, 1, 2, null, null], 'first-3')).toBe(true);
    expect(matchesRiskPattern([0, null, 1, 2, null, null], 'first-3')).toBe(false);
    expect(forecastPattern([null, undefined, null]).confirmedFirst).toBeNull();
    expect(matchesRiskPattern([null, 0, 0, 2, 0, 1], 'high')).toBe(true);
  });
  it('finds administrative codes and Thai names without crossing province scope', () => {
    expect(areaMatchesSearch('3015', 'Phimai', '301503')).toBe(true);
    expect(areaMatchesSearch('พิมาย โบสถ์', 'โบสถ์', 'พิมาย')).toBe(true);
    expect(filterAnalysisRows(report.rows, '', '3015', 'all').every(row => row.districtCode === '3015')).toBe(true);
    expect(filterAnalysisRows(report.rows, 'เชียงใหม่', '', 'all')).toHaveLength(0);
    expect(report.rows.every(row => row.provinceCode === '30')).toBe(true);
  });
  it('matches every district / horizon directly against the original normalized slots', () => {
    const groups = analysisDistricts(report.rows);
    expect(groups).toHaveLength(32);
    for (const district of groups) for (let h = 0; h < 6; h++) {
      const source = archive.locations.filter(row => row.districtCode === district.code)
        .map(row => archive.packedRiskByTargetMonth['2025-12'][row.subdistrictCode][h]);
      const valid = source.filter((risk): risk is 0 | 1 | 2 => risk !== null);
      expect(district.horizons[h].valid).toBe(valid.length);
      expect(district.horizons[h].counts[3]).toBe(source.filter(risk => risk === null).length);
      expect(district.horizons[h].highest).toBe(valid.length ? Math.max(...valid) : null);
      expect(district.horizons[h].riskShare).toBe(valid.length ? valid.filter(risk => risk > 0).length / valid.length : null);
    }
  });
  it('five zeros and one moderate produce moderate, not an average-rounded green', () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({ ...report.rows[0], risks: [index === 5 ? 1 : 0, null, null, null, null, null] })) as ExportLocation[];
    const first = analysisDistricts(rows)[0].horizons[0];
    expect(first.highest).toBe(1); expect(first.riskShare).toBe(1 / 6);
    expect(analysisDistricts(rows)[0].horizons[1].riskShare).toBeNull();
  });
  it('comparisons align the same actual month and retain out-of-scope status', () => {
    const baseline = buildForecastExport(archive, { areaCode: '30', originPeriod: '2025-11', irrigation: 'all' });
    const rows = buildForecastComparison(report, baseline).rows.filter(row => row.targetPeriod === '2026-01');
    expect(rows).toHaveLength(289);
    for (const row of rows) {
      expect(row.currentHorizon).toBe(1); expect(row.baselineHorizon).toBe(2);
      expect(row.currentForecastRisk).toBe(archive.packedRiskByTargetMonth['2025-12'][row.subdistrictCode][0]);
      expect(row.baselineForecastRisk).toBe(archive.packedRiskByTargetMonth['2025-11'][row.subdistrictCode][1]);
      if (row.baselineStatus !== 'VALID' || row.currentStatus !== 'VALID') expect(row.comparisonStatus).toBe('NOT_COMPARABLE');
    }
  });
});

const polygon = { type: 'Feature', properties: { Admin_code: '300101' }, geometry: { type: 'Polygon', coordinates: [
  [[100, 10], [102, 10], [102, 12], [100, 12], [100, 10]],
  [[100.5, 10.5], [101.5, 10.5], [101.5, 11.5], [100.5, 11.5], [100.5, 10.5]],
] } } as NakhonRatchasimaGeoFeature;
describe('coordinate lookup', () => {
  it('uses lat/lon in the correct order and respects polygon holes', () => {
    expect(locateKoratPoint('10.2', '100.2', [polygon]).feature.properties.Admin_code).toBe('300101');
    expect(() => locateKoratPoint('11', '101', [polygon])).toThrow('นอกขอบเขต');
    expect(() => locateKoratPoint('', '100.2', [polygon])).toThrow('ถูกต้อง');
    expect(() => locateKoratPoint('100.2', '10.2', [polygon])).toThrow('ถูกต้อง');
  });
  it('rejects other provinces and ambiguous overlapping boundaries', () => {
    expect(() => locateKoratPoint('10.2', '100.2', [{ ...polygon, properties: { ...polygon.properties, Admin_code: '500101' } }])).toThrow('นอกขอบเขต');
    expect(() => locateKoratPoint('10.2', '100.2', [polygon, { ...polygon, properties: { ...polygon.properties, Admin_code: '300102' } }])).toThrow('หลายตำบล');
  });
});
