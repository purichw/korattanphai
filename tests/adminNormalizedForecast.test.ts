import { describe, it, expect } from 'vitest';
import { importOriginalForecast, workbookOrigins, workbookRiskColumns } from '../src/admin/normalizedForecastImport';
import type { ImportSheet } from '../src/admin/workbook';
import { createAdminWorkbook, readAdminWorkbook } from '../src/admin/workbook';
import archive from '../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json';

const columns = ['Year', 'Month', 'ID', 'TAMBON_E', 'AMPHOE_E', 'Irrigation_Status', ...workbookRiskColumns];
const makeSheet = (): ImportSheet => ({ name: 'Master_Data_Drought_Final', columns, rows: archive.locations.map((area, index) => ({
  Year: 2025, Month: 12, ID: area.sourceId, TAMBON_E: area.subdistrictNameEn, AMPHOE_E: area.districtNameEn, Irrigation_Status: 'RainFed',
  ...Object.fromEntries(workbookRiskColumns.map((column, horizon) => [column, index === 0 ? null : horizon % 3])),
})) });
describe('original normalized workbook adapter', () => {
  it('uses approved source-ID crosswalk and preserves zero, null, T+h and exact duplicates', () => {
    const sheet = makeSheet(); sheet.rows.push(sheet.rows[1]);
    expect(workbookOrigins(sheet)).toEqual(['2025-12']);
    const result = importOriginalForecast(sheet, { originMonth: '2025-12' }, archive.locations, '2025-12');
    const rows = result.predictions as Record<string, unknown>[];
    expect(rows).toHaveLength(1734);
    expect(rows.filter(row => row.status === 'out_of_scope')).toHaveLength(6);
    expect(rows.find(row => row.horizonMonths === 1)?.targetMonth).toBe('2026-01');
    expect(rows.some(row => row.riskCode === 0 && row.status === 'predicted')).toBe(true);
  });
  it('retains conflicting values visibly for UI correction; never last-row wins', () => {
    const sheet = makeSheet(); sheet.rows.push({ ...sheet.rows[1], 'Pred_Risk_T+1': 2 });
    const rows = importOriginalForecast(sheet, {}, archive.locations, '2025-12').predictions as Record<string, unknown>[];
    expect(rows.find(row => row.status === 'unresolved')?.riskCode).toContain('ค่าต่างกัน');
    sheet.rows[0].ID = 999999;
    expect(() => importOriginalForecast(sheet, {}, archive.locations, '2025-12')).toThrow('ยังไม่มีทะเบียน');
    sheet.rows.shift();
    expect(() => importOriginalForecast(sheet, {}, archive.locations, '2025-12')).toThrow('ไม่ครบ');
  });
  it('round trips large import provenance without exceeding the Excel cell text limit', async () => {
    const payload = { schemaVersion: 1, originMonth: '2025-12', predictions: [{ subdistrictCode: '300101', horizonMonths: 1, targetMonth: '2026-01', status: 'predicted', riskCode: 0 }],
      sourceImport: { sha256: 'a'.repeat(64), sheet: 'Original', rows: Array.from({ length: 800 }, (_, i) => ({ sourceRow: i + 2, values: { note: 'ข้อมูลต้นทาง'.repeat(20) } })) } };
    const bytes = await createAdminWorkbook('archive', payload);
    const result = await readAdminWorkbook(bytes.buffer as ArrayBuffer);
    expect(result.metadata?.sourceImport).toEqual(payload.sourceImport);
  });
});
