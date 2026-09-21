import { describe, expect, it } from 'vitest';
import raw from '../../../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json';
import { areas, forecastRows, matchesRisk, summarizeExportRisks, type Archive } from '../src/domain';
import { buildForecastExport } from '../../../src/forecastExportModel';
import { filterAnalysisRows } from '../../../src/forecastAnalysis';
import { sessionStorage } from '../src/sessionStorage';

const archive = raw as unknown as Archive;
describe('native domain reuses forecast-only semantics', () => {
  it('has only 32 districts and 289 tambons in Korat', () => {
    expect(areas.filter(a => a.code.length === 4)).toHaveLength(32);
    expect(areas.filter(a => a.code.length === 6)).toHaveLength(289);
    expect(areas.every(a => a.code.startsWith('30'))).toBe(true);
  });
  it('matches the web export model at province, district and tambon scope', () => {
    for (const areaCode of ['30', '3025', '3015', '3008', '302502', '301503', '300101']) {
      for (const originPeriod of ['2025-12', '2025-06', '2024-10']) {
        const scoped = { ...archive, locations: archive.locations.filter(row => row.subdistrictCode.startsWith(areaCode)) };
        for (const irrigation of ['all', 'rainfed', 'irrigated', 'unknown'] as const) {
          const rows = forecastRows(scoped, originPeriod, irrigation);
          if (!rows.length) continue;
          const web = buildForecastExport(archive, { areaCode, originPeriod, irrigation });
          expect(rows.map(row => [row.subdistrictCode, row.risks])).toEqual(web.rows.map(row => [row.subdistrictCode, row.risks]));
          for (let h = 1; h <= 6; h++) expect(summarizeExportRisks(rows, h)).toEqual(web.totals[h - 1]);
        }
      }
    }
  });
  it('keeps zero, outside scope and missing distinct; monthly risk is not first occurrence', () => {
    expect(matchesRisk(0, 'forecast-no-risk')).toBe(true);
    expect(matchesRisk(null, 'forecast-no-risk')).toBe(false);
    expect(matchesRisk(undefined, 'forecast-missing')).toBe(true);
    const rows = forecastRows(archive, '2025-12', 'all').filter(row => row.districtCode === '3025');
    expect(filterAnalysisRows(rows, '', '', 'risk-3')).toHaveLength(4);
    expect(filterAnalysisRows(rows, '', '', 'first-3')).toHaveLength(0);
  });
});
describe('secure native session storage', () => {
  const setup = () => {
    const values = new Map<string, string>(); let fail = false;
    const adapter = sessionStorage({ getItemAsync: async key => values.get(key) ?? null,
      setItemAsync: async (key, value) => { if (fail) throw new Error('write failed'); expect(value.length).toBeLessThan(2000); values.set(key, value); },
      deleteItemAsync: async key => { values.delete(key); } });
    return { values, adapter, fail: () => { fail = true; } };
  };
  it('round-trips large Unicode sessions and clears old generations on replace/logout', async () => {
    const { values, adapter } = setup(); const session = 'ข้อมูลผู้ใช้'.repeat(900);
    await adapter.setItem('auth', session); expect(await adapter.getItem('auth')).toBe(session);
    const old = [...values.keys()].filter(key => key !== 'auth');
    await adapter.setItem('auth', 'replacement'); expect(old.every(key => !values.has(key))).toBe(true);
    await adapter.removeItem('auth'); expect(values.size).toBe(0); expect(await adapter.getItem('auth')).toBeNull();
  });
  it('preserves the old session when replacement fails and rejects partial/corrupt storage', async () => {
    const { values, adapter, fail } = setup(); await adapter.setItem('auth', 'old'); fail();
    await expect(adapter.setItem('auth', 'new')).rejects.toThrow(); expect(await adapter.getItem('auth')).toBe('old');
    values.delete([...values.keys()].find(key => key !== 'auth')!); expect(await adapter.getItem('auth')).toBeNull();
    values.set('auth', 'invalid'); expect(await adapter.getItem('auth')).toBeNull();
  });
});
