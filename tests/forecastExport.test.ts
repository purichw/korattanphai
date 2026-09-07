import { readFileSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from '@protobi/exceljs';
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';
import { buildForecastExport, summarizeExportRisks, exportRiskLabel } from '../src/forecastExportModel';
import { createForecastWorkbook } from '../src/forecastExcelWriter';
import type { NakhonRatchasimaDroughtForecastArchive as Archive } from '../src/types';

const archive: Archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
const options = { originPeriod: '2025-12', areaCode: '30', irrigation: 'all' as const };
const report = buildForecastExport(archive, options);

describe('forecast Excel data contract', () => {
  it('exports every source value in the selected origin, all six future months and both administrative levels', () => {
    expect(report.rows).toHaveLength(289);
    expect(report.districts).toHaveLength(32);
    expect(report.targets).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
    for (const row of report.rows) expect(row.risks).toEqual(archive.packedRiskByTargetMonth['2025-12'][row.subdistrictCode]);
    expect(report.rows.find(row => row.sourceId === '222')?.districtCode).toBe('3015');
    expect(report.rows.find(row => row.sourceId === '5')?.districtCode).toBe('3001');
    for (const summary of report.totals) expect(summary.counts.reduce((sum, count) => sum + count, 0)).toBe(289);
  });
  it('does not average risk or turn original blanks / absent records into zero', () => {
    const template = report.rows[0];
    const rows = [0, 0, 0, 0, 0, 1].map(value => ({ ...template, risks: [value as 0 | 1] }));
    expect(summarizeExportRisks(rows, 1)).toMatchObject({ highest: 1, valid: 6, riskShare: 1 / 6 });
    expect(summarizeExportRisks([{ ...template, risks: [null] }], 1)).toMatchObject({ highest: null, valid: 0, riskShare: null, counts: [0, 0, 0, 1, 0] });
    expect(summarizeExportRisks([{ ...template, risks: [] }], 1)).toMatchObject({ highest: undefined, valid: 0, riskShare: null, counts: [0, 0, 0, 0, 1] });
  });
  it('scopes districts and irrigation independently of risk and rejects incomplete slices', () => {
    const district = buildForecastExport(archive, { ...options, areaCode: '3003' });
    expect(district.rows).toHaveLength(6);
    expect(district.districts).toHaveLength(1);
    const filtered = buildForecastExport(archive, { ...options, irrigation: 'rainfed' });
    expect(filtered.rows.every(row => row.irrigationStatus.toLowerCase() === 'rainfed')).toBe(true);
    expect(() => buildForecastExport({ ...archive, meta: { ...archive.meta, horizonCount: 1 } }, options)).toThrow('T+1');
    expect(() => buildForecastExport(archive, { ...options, originPeriod: '2099-01' })).toThrow('T+1');
    expect(() => buildForecastExport({ ...archive, locations: archive.locations.slice(1) }, options)).toThrow('พื้นที่ไม่ครบ');
  });
  it('creates typed filterable tables, cached live formulas, native charts and native pivot records', async () => {
    const input = readFileSync('src/assets/forecast-export-template.xlsx');
    const bytes = await createForecastWorkbook(report, new Uint8Array(input).buffer);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes);
    expect(book.worksheets.map(sheet => sheet.name)).toEqual(['วิเคราะห์', 'สรุปอำเภอ', 'รายตำบล', 'สถิติรายเดือน', 'PivotTable', 'ฐาน Pivot', 'ที่มาและนิยาม']);
    const raw = book.getWorksheet('รายตำบล')!;
    expect(raw.getCell('H4').value).toBe('T+1 ม.ค. 2569');
    for (const [index, row] of report.rows.entries()) {
      expect(raw.getCell(index + 5, 1).value).toBe(row.sourceId);
      for (const [horizon, risk] of row.risks.entries()) expect(raw.getCell(index + 5, horizon + 8).value).toBe(risk ?? exportRiskLabel(risk));
    }
    const sheet = book.getWorksheet('วิเคราะห์')!;
    expect(sheet.getCell('B4').dataValidation.formulae).toEqual(['ExportDistricts']);
    expect(sheet.getCell('E4').dataValidation.formulae).toEqual(['ExportIrrigation']);
    expect(sheet.getCell('C9').formula).toContain('COUNTIFS');
    expect(sheet.getCell('C9').result).toBe(report.totals[0].counts[1]);
    expect(sheet.getCell('C9').numFmt).toBe('#,##0');
    expect(sheet.getCell('H9').numFmt).toBe('0.0%');
    expect(sheet.getCell('A1').font.size).toBe(17);
    expect(sheet.getCell('A1').fill).not.toEqual(sheet.getCell('B4').fill);
    expect(book.getWorksheet('ฐาน Pivot')!.rowCount).toBe(1735);
    const zip = await JSZip.loadAsync(bytes);
    for (const [name, entry] of Object.entries(zip.files)) {
      if (!name.endsWith('.rels')) continue;
      const xml = new DOMParser().parseFromString(await entry.async('string'), 'application/xml');
      const base = path.posix.dirname(name).replace(/\/?_rels$/, '');
      for (const relation of xml.querySelectorAll('Relationship')) {
        if (relation.getAttribute('TargetMode') === 'External') continue;
        const target = relation.getAttribute('Target')!;
        const resolved = target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(base, target));
        expect(zip.file(resolved), `${name} -> ${target}`).not.toBeNull();
      }
    }
    const charts = Object.keys(zip.files).filter(path => /^xl\/charts\/chart\d+\.xml$/.test(path));
    expect(charts).toHaveLength(1);
    const chart = await zip.file(charts[0])!.async('string');
    expect(chart).toContain('numRef');
    expect(chart).toContain('numCache');
    expect(chart).toContain('วิเคราะห์');
    expect(Object.keys(zip.files).filter(path => /^xl\/pivotTables\/pivotTable\d+\.xml$/.test(path))).toHaveLength(1);
    expect(Object.keys(zip.files).some(path => /pivotCacheRecords\d+\.xml$/.test(path))).toBe(true);
    const cacheName = Object.keys(zip.files).find(path => /pivotCacheDefinition\d+\.xml$/.test(path))!;
    const cache = new DOMParser().parseFromString(await zip.file(cacheName)!.async('string'), 'application/xml');
    expect(cache.documentElement.getAttribute('recordCount')).toBe('1734');
    expect(book.getWorksheet('ที่มาและนิยาม')!.getSheetValues().flat().join(' ')).toContain(report.meta.sourceWorkbookSha256);
  }, 30_000);
});
