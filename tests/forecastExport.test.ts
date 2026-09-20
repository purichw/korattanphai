import { readFileSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from '@protobi/exceljs';
import JSZip from 'jszip';
import { describe, it, expect, vi } from 'vitest';
import { buildForecastExport, summarizeExportRisks, exportRiskLabel, withForecastExportComparison } from '../src/forecastExportModel';
import { createForecastWorkbook, forecastExportSheetNames, FORECAST_TEMPLATE_VERSION } from '../src/forecastExcelWriter';
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
    expect(() => buildForecastExport({ ...archive, meta: { ...archive.meta, horizonCount: 1 } }, options)).toThrow('ครบ 6 เดือนล่วงหน้า');
    expect(() => buildForecastExport(archive, { ...options, originPeriod: '2099-01' })).toThrow('ครบ 6 เดือนล่วงหน้า');
    expect(() => buildForecastExport({ ...archive, locations: archive.locations.slice(1) }, options)).toThrow('พื้นที่ไม่ครบ');
  });
  it('creates typed filterable tables, cached live formulas, native charts and native pivot records', async () => {
    const input = readFileSync('src/assets/forecast-export-template.xlsx');
    const bytes = await createForecastWorkbook(report, new Uint8Array(input).buffer);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes);
    expect(book.worksheets.map(sheet => sheet.name)).toEqual(['วิเคราะห์', 'สรุปอำเภอ', 'รายตำบล', 'สถิติรายเดือน', 'PivotTable', 'ฐาน Pivot', 'ที่มาและนิยาม', forecastExportSheetNames.machine, forecastExportSheetNames.dictionary]);
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
    expect(sheet.getCell('A1').font).toMatchObject({ name: 'Cordia New', size: 18, bold: true });
    expect(sheet.getCell('A2').font.italic).not.toBe(true);
    expect(sheet.getCell('A1').alignment).toMatchObject({ horizontal: 'left', vertical: 'middle' });
    for (const address of ['B4', 'E4', 'A9', 'C9', 'H9']) {
      expect(sheet.getCell(address).alignment).toMatchObject({ horizontal: 'center', vertical: 'middle', wrapText: true });
    }
    for (const address of ['A5', 'C5', 'E5', 'G5', 'H5', 'N5']) {
      expect(raw.getCell(address).alignment).toMatchObject({ horizontal: 'center', vertical: 'middle', wrapText: true });
      expect(raw.getCell(address).font.name).toBe('Cordia New');
    }
    expect(sheet.getCell('A1').fill).not.toEqual(sheet.getCell('B4').fill);
    expect(sheet.getCell('I8').value).toBe('ตำบลตาม\nตัวกรอง');
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
    expect(chart).toContain('typeface="Cordia New"');
    expect(chart).not.toContain('typeface="Tahoma"');
    expect(chart).not.toContain('typeface="Arial"');
    expect(chart).not.toContain('sz="825"');
    expect(Object.keys(zip.files).filter(path => /^xl\/pivotTables\/pivotTable\d+\.xml$/.test(path))).toHaveLength(1);
    expect(Object.keys(zip.files).some(path => /pivotCacheRecords\d+\.xml$/.test(path))).toBe(true);
    const cacheName = Object.keys(zip.files).find(path => /pivotCacheDefinition\d+\.xml$/.test(path))!;
    const cache = new DOMParser().parseFromString(await zip.file(cacheName)!.async('string'), 'application/xml');
    expect(cache.documentElement.getAttribute('recordCount')).toBe('1734');
    expect(book.getWorksheet('ที่มาและนิยาม')!.getSheetValues().flat().join(' ')).toContain(report.meta.sourceWorkbookSha256);
    expect(book.getWorksheet('ที่มาและนิยาม')!.getSheetValues().flat()).toContain(FORECAST_TEMPLATE_VERSION);
    const machine = book.getWorksheet(forecastExportSheetNames.machine)!;
    expect(machine.rowCount).toBe(report.machineRows.length + 4);
    const definitions = report.dictionary.filter(item => item.table === 'machineRows');
    expect(machine.getRow(4).values.slice(1)).toEqual(definitions.map(item => item.field));
    for (const [index, record] of report.machineRows.entries()) {
      for (const [column, definition] of definitions.entries()) {
        expect(machine.getCell(index + 5, column + 1).value).toEqual(record[definition.field as keyof typeof record]);
      }
    }
    const dictionary = book.getWorksheet(forecastExportSheetNames.dictionary)!;
    const dictFields = dictionary.getColumn(1).values.slice(5);
    expect(dictionary.getCell('B5').alignment).toMatchObject({ horizontal: 'left', vertical: 'top', wrapText: true });
    expect(dictionary.getCell('E5').alignment).toMatchObject({ horizontal: 'center', vertical: 'middle' });
    expect(book.getWorksheet('ที่มาและนิยาม')!.getCell('B19').alignment).toMatchObject({ horizontal: 'left', vertical: 'middle', wrapText: true });
    expect(book.getWorksheet('ที่มาและนิยาม')!.getRow(19).height).toBeGreaterThan(44);
    expect(dictFields).toEqual(expect.arrayContaining(definitions.map(item => item.field)));
    expect(dictFields).toEqual(expect.arrayContaining(['forecastRiskDisplay', 'highestForecastRiskDisplay', 'riskShare', 'pivotLocationHorizonCount', 'sourceTambonEn', 'metadataDetail']));
    const descriptions = dictionary.getSheetValues().slice(5) as unknown[][];
    for (const row of descriptions) {
      expect(row[2]).toMatch(/[ก-๙]/); expect(row[3]).toMatch(/[a-z]/i);
      expect(row[5]).toMatch(/^[MCO]$/); expect(row[8]).toBeDefined();
      expect(row[9]).toMatch(/[ก-๙]/); expect(row[10]).toMatch(/[a-z]/i); expect(row[11]).toBeTruthy();
    }
    const drawing = await zip.file('xl/drawings/drawing1.xml')!.async('string');
    expect(drawing).toContain('descr='); expect(drawing).toContain('Six-month drought forecast');
  }, 30_000);

  it('keeps machine blanks numeric-only with explicit missing states and builds without browser DOM globals', async () => {
    const selected = structuredClone(archive);
    const locations = selected.locations.filter(row => row.districtCode === '3003');
    selected.packedRiskByTargetMonth['2025-12'][locations[0].subdistrictCode] = [0, null, 1, 2, null, 0];
    delete selected.packedRiskByTargetMonth['2025-12'][locations[1].subdistrictCode];
    const report = buildForecastExport(selected, { ...options, areaCode: '3003' });
    const stages: string[] = [];
    vi.stubGlobal('DOMParser', undefined); vi.stubGlobal('XMLSerializer', undefined);
    let bytes: Uint8Array;
    try { bytes = await createForecastWorkbook(report, new Uint8Array(readFileSync('src/assets/forecast-export-template.xlsx')).buffer, { onProgress: stage => stages.push(stage) }); }
    finally { vi.unstubAllGlobals(); }
    expect(stages).toEqual(['template', 'workbook', 'packaging']);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes!);
    const sheet = book.getWorksheet(forecastExportSheetNames.machine)!;
    const fields = report.dictionary.filter(item => item.table === 'machineRows').map(item => item.field);
    const value = (index: number, field: string) => sheet.getCell(index + 5, fields.indexOf(field) + 1).value;
    expect(value(0, 'forecastRisk')).toBe(0); expect(value(0, 'forecastStatus')).toBe('VALID');
    expect(value(1, 'forecastRisk')).toBeNull(); expect(value(1, 'forecastStatus')).toBe('OUT_OF_SCOPE');
    expect(value(6, 'forecastRisk')).toBeNull(); expect(value(6, 'forecastStatus')).toBe('MISSING');
    for (let i = 0; i < report.machineRows.length; i++) expect(value(i, 'forecastRisk') === null || typeof value(i, 'forecastRisk') === 'number').toBe(true);
  }, 30_000);

  it('adds a readable same-target comparison while keeping numeric codes, statuses and provenance', async () => {
    const current = buildForecastExport(archive, { ...options, areaCode: '3003' });
    const baseline = buildForecastExport(archive, { ...options, areaCode: '3003', originPeriod: '2025-11' });
    const comparison = withForecastExportComparison(current, baseline);
    const bytes = await createForecastWorkbook(comparison, new Uint8Array(readFileSync('src/assets/forecast-export-template.xlsx')).buffer);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes);
    expect(book.worksheets).toHaveLength(10);
    const sheet = book.getWorksheet(forecastExportSheetNames.comparison)!;
    const headers = sheet.getRow(4).values.slice(1) as string[];
    expect(headers.filter(header => !/[ก-๙]/.test(header) || !header.includes('\n'))).toEqual([]);
    const fields = headers.map(header => header.split('\n')[1]);
    for (const field of ['targetPeriod', 'subdistrictNameTh', 'districtNameTh', 'baselineOriginPeriod', 'currentOriginPeriod', 'baselineHorizon', 'currentHorizon', 'riskDelta']) {
      expect(sheet.getCell(5, fields.indexOf(field) + 1).alignment).toMatchObject({ horizontal: 'center', vertical: 'middle', wrapText: true });
    }
    const hashColumn = fields.findIndex(field => field === 'baselineSourceWorkbookSha256') + 1;
    expect(hashColumn).toBeGreaterThan(0);
    expect(sheet.getCell(5, hashColumn).alignment).toMatchObject({ horizontal: 'left', vertical: 'middle', wrapText: true });
    expect(fields.slice(0, 7)).toEqual(['targetPeriod', 'subdistrictCode', 'subdistrictNameTh', 'baselineRiskLabelTh', 'currentRiskLabelTh', 'comparisonLabelTh', 'riskDelta']);
    expect(sheet.getCell('A3').value).toContain('รอบที่เลือก − รอบอ้างอิง');
    expect(sheet.getCell('A3').value).toContain('เทียบระดับไม่ได้ ≠ ระดับเท่าเดิม');
    expect(sheet.getRow(4).height).toBeGreaterThanOrEqual(60);
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 4, xSplit: 3 });
    expect(sheet.pageSetup.fitToPage).toBe(false);
    for (const [index, record] of comparison.comparison!.rows.entries()) {
      for (const [field, expected] of Object.entries(record)) expect(sheet.getCell(index + 5, fields.indexOf(field) + 1).value).toEqual(expected);
      if (record.comparisonStatus === 'NOT_COMPARABLE') {
        expect(sheet.getCell(index + 5, fields.indexOf('comparisonLabelTh') + 1).value).toBe('เทียบระดับไม่ได้');
        expect(sheet.getCell(index + 5, fields.indexOf('riskDelta') + 1).value).toBeNull();
      }
    }
    const dictionary = book.getWorksheet(forecastExportSheetNames.dictionary)!;
    expect(dictionary.getColumn(1).values).toEqual(expect.arrayContaining(['baselineRiskLabelTh', 'currentRiskLabelTh', 'comparisonLabelTh', 'baselineSourceDisplay']));
    const notes = book.getWorksheet('ที่มาและนิยาม')!.getSheetValues().flat();
    expect(notes).toContain('2025-11 → 2025-12');
    expect(notes).toContain(comparison.comparison!.baselineMeta.sourceWorkbookSha256);
  }, 30_000);
});
