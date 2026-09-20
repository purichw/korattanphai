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
  it('distinguishes risk in a month from the first risky month in Wang Nam Khiao', () => {
    const rows = report.rows.filter(row => row.districtCode === '3025');
    expect([1, 2, 3, 4, 5, 6].map(h => filterAnalysisRows(rows, '', '', `risk-${h}`).length))
      .toEqual([4, 4, 4, 3, 0, 0]);
    expect(filterAnalysisRows(rows, '', '', 'first-1')).toHaveLength(4);
    expect(filterAnalysisRows(rows, '', '', 'first-3')).toHaveLength(0);
    expect(matchesRiskPattern([null, undefined, 0, 1, 2, 0], 'risk-1')).toBe(false);
    expect(matchesRiskPattern([null, undefined, 0, 1, 2, 0], 'risk-2')).toBe(false);
    expect(matchesRiskPattern([null, undefined, 0, 1, 2, 0], 'risk-3')).toBe(false);
    expect(matchesRiskPattern([null, undefined, 0, 1, 2, 0], 'risk-5')).toBe(true);
  });
  it('samples province, eight districts and twelve tambons across four origins against source slots', () => {
    let seed = 20260914;
    function sample<T>(values: T[], count: number) {
      const pool = [...values];
      for (let i = pool.length - 1; i > 0; i--) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const j = seed % (i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, count);
    }
    const scopes = ['30', ...sample([...new Set(archive.locations.map(l => l.districtCode))], 8),
      ...sample(archive.locations.map(l => l.subdistrictCode), 12)];
    const origins = ['2025-12', ...sample(archive.targetMonths.filter(m => m.period !== '2025-12').map(m => m.period), 3)];
    for (const originPeriod of origins) for (const areaCode of scopes) {
      const selected = buildForecastExport(archive, { areaCode, originPeriod, irrigation: 'all' });
      const members = archive.locations.filter(l => l.subdistrictCode.startsWith(areaCode));
      expect(selected.rows.map(row => row.subdistrictCode).sort()).toEqual(members.map(l => l.subdistrictCode).sort());
      for (let h = 1; h <= 6; h++) {
        const expected = members.filter(l => [1, 2].includes(archive.packedRiskByTargetMonth[originPeriod][l.subdistrictCode][h - 1] as number));
        const filtered = filterAnalysisRows(selected.rows, '', '', `risk-${h}`);
        expect(filtered.map(row => row.subdistrictCode).sort()).toEqual(expected.map(l => l.subdistrictCode).sort());
        for (const row of selected.rows) expect(row.risks[h - 1]).toBe(archive.packedRiskByTargetMonth[originPeriod][row.subdistrictCode][h - 1]);
        for (const group of analysisDistricts(filtered)) {
          const source = expected.filter(l => l.districtCode === group.code)
            .map(l => archive.packedRiskByTargetMonth[originPeriod][l.subdistrictCode][h - 1] as number);
          expect(group.horizons[h - 1].highest).toBe(Math.max(...source));
          expect(group.horizons[h - 1].valid).toBe(source.length);
        }
      }
    }
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
