import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readDataFile, readCsv } from '../src/admin/readDataFile';
import { importOriginalForecast, matchRev3Columns, normalizeRev3Sheet, rev3Fields, workbookOrigins } from '../src/admin/normalizedForecastImport';
import { readAdminWorkbook } from '../src/admin/workbook';
import archive from '../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json';
import { legacyCodepages } from '../src/admin/legacyCodepages';
const requireAdmin = createRequire(resolve('src/admin/readDataFile.ts'));
const xlsx = requireAdmin('xlsx');
const buffer = (bytes: Uint8Array) => Uint8Array.from(bytes).buffer;
const csvBytes = (text: string) => new TextEncoder().encode(text).buffer;
const thaiRows = archive.locations.map((area, i) => [2025, 12, Number(area.sourceId), area.subdistrictNameTh, area.districtNameTh, 'อาศัยน้ำฝน', 'ไม่พบความเสี่ยง', 'เสี่ยงปานกลาง', 'เสี่ยงสูง', 'นอกขอบเขตการศึกษา', i === 0 ? '' : 0, 2]);
function csv(rows: unknown[][], separator = ',') { return '\uFEFF' + rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(separator)).join('\r\n'); }
function legacy(rows: unknown[][]) {
  const book = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet(rows), 'ข้อมูลพยากรณ์');
  return xlsx.write(book, { type: 'array', bookType: 'biff8' }) as ArrayBuffer;
}
describe('CSV and legacy Excel input', () => {
  it('decodes the Thai and Unicode code pages used in XLS without guessing unsupported encodings', () => {
    const codepage = requireAdmin('xlsx/dist/cpexcel.js');
    for (const cp of [874, 1200, 65001]) {
      expect(legacyCodepages.utils.decode(cp, codepage.utils.encode(cp, 'ในเมือง'))).toBe('ในเมือง');
    }
    expect(legacyCodepages.utils.decode(1252, [0x63, 0x61, 0x66, 0xe9])).toBe('café');
    expect(() => legacyCodepages.utils.decode(720, [65])).toThrow('รหัสภาษาเก่าที่ไม่รองรับ');
  });
  it.each([',', ';', '\t'])('preserves quoted text, blanks, zero and row lineage with %s', separator => {
    const file = readCsv(csv([['รหัส', 'หมายเหตุ', 'ค่า'], ['001', 'ฝน, "เล็กน้อย"\nสองบรรทัด', 0], ['002', 'ไม่มีค่า', '']], separator));
    expect(file.sheets[0].rows).toEqual([{ รหัส: '001', หมายเหตุ: 'ฝน, "เล็กน้อย"\nสองบรรทัด', ค่า: '0' }, { รหัส: '002', หมายเหตุ: 'ไม่มีค่า', ค่า: '' }]);
    expect(file.sheets[0].sourceRows).toEqual([2, 4]);
  });
  it('rejects malformed records instead of inventing missing cells or dropping extras', () => {
    expect(() => readCsv('a,b,c\n1,2')).toThrow('จำนวนช่อง');
    expect(() => readCsv('a,b\n"unfinished,2')).toThrow('ยังไม่ปิด');
    expect(() => readCsv('a,a\n1,2')).toThrow('ไม่ซ้ำ');
    expect(() => readCsv('__proto__,b\n1,2')).toThrow('หัวคอลัมน์');
  });
  it('explains corrupt Excel files without exposing a ZIP parser error', async () => {
    await expect(readDataFile(csvBytes('not an Excel file'), 'xlsx')).rejects.toThrow('อ่านไฟล์ Excel ไม่สำเร็จ');
  });
  it('supports explicit Thai Windows-874 and fails visibly when UTF-8 cannot decode it', async () => {
    const codepage = requireAdmin('xlsx/dist/cpexcel.js');
    const bytes = buffer(Uint8Array.from(codepage.utils.encode(874, 'ชื่อ,ค่า\r\nในเมือง,0')));
    await expect(readDataFile(bytes, 'csv')).rejects.toThrow('อ่านภาษา');
    expect((await readDataFile(bytes, 'csv', 'windows-874')).sheets[0].rows[0]).toEqual({ ชื่อ: 'ในเมือง', ค่า: '0' });
  });
  it('reads a genuine XLS binary with Thai names and preserves all rev3 forecast cells', async () => {
    const file = await readDataFile(legacy([rev3Fields.map(field => field.label), ...thaiRows]), 'xls');
    const normalized = normalizeRev3Sheet(file.sheets[0]);
    expect(workbookOrigins(normalized)).toEqual(['2025-12']);
    expect(normalized.rows[0].TAMBON_E).toBe('ในเมือง');
    const result = importOriginalForecast(normalized, {}, archive.locations, '2025-12');
    const rows = result.predictions as Record<string, unknown>[];
    expect(rows).toHaveLength(1734);
    expect(rows.slice(0, 6).map(row => row.riskCode)).toEqual([0, 1, 2, null, null, 2]);
    expect(rows[0].targetMonth).toBe('2026-01'); expect(rows[5].targetMonth).toBe('2026-06');
  });
  it('rejects formulas in XLS and files renamed to XLS', async () => {
    await expect(readDataFile(buffer(readFileSync('tests/fixtures/admin-formula.xls')), 'xls')).rejects.toThrow('พบสูตร');
    await expect(readDataFile(csvBytes('a,b\n1,2'), 'xls')).rejects.toThrow('ไม่ใช่ Excel');
  });
  it('maps Thai CSV to the same rev3 meanings without mutating source evidence', async () => {
    const file = await readDataFile(csvBytes(csv([rev3Fields.map(field => field.label), ...thaiRows])), 'csv');
    const source = JSON.stringify(file.sheets[0]);
    const normalized = normalizeRev3Sheet(file.sheets[0]);
    expect(normalized.rows[0]).toMatchObject({ Year: 2025, Month: 12, ID: 0, 'Pred_Risk_T+1': 0, 'Pred_Risk_T+4': null });
    expect(importOriginalForecast(normalized, {}, archive.locations, '2025-12').predictions).toHaveLength(1734);
    expect(JSON.stringify(file.sheets[0])).toBe(source);
  });
  it('requires explicit resolution of alias collisions and accepts manually mapped columns', () => {
    const sheet = { name: 'Data', columns: ['Year', ...rev3Fields.map(field => field.label)], rows: [] };
    expect(matchRev3Columns(sheet).Year).toBe('');
    expect(() => normalizeRev3Sheet(sheet)).toThrow('ปีต้นทาง');
    const custom = { name: 'Data', columns: rev3Fields.map((_, i) => `ช่อง ${i}`), rows: [Object.fromEntries(thaiRows[0].map((value, i) => [`ช่อง ${i}`, value]))] };
    const mapping = Object.fromEntries(rev3Fields.map((field, i) => [field.key, `ช่อง ${i}`]));
    expect(normalizeRev3Sheet(custom, mapping).rows[0].ID).toBe(0);
    expect(() => normalizeRev3Sheet(custom, { ...mapping, Month: mapping.Year })).toThrow('หนึ่งคอลัมน์');
  });
  it('ships the documented 12 fields and 289 exact IDs in XLSX and CSV, without fake default risks', async () => {
    const bytes = buffer(readFileSync('src/assets/rev3-import-template.xlsx'));
    const raw = xlsx.read(bytes, { type: 'array' });
    expect(raw.SheetNames).toEqual(['ข้อมูลพยากรณ์', 'ตัวอย่าง', 'คำอธิบาย', 'รายชื่อพื้นที่']);
    const file = await readDataFile(bytes, 'xlsx');
    const csvFile = await readDataFile(buffer(readFileSync('src/assets/rev3-import-template.csv')), 'csv');
    expect(file.sheets).toHaveLength(1);
    expect(file.sheets[0].columns).toEqual(rev3Fields.map(field => field.label));
    expect(file.sheets[0].rows).toHaveLength(289); expect(csvFile.sheets[0].rows).toHaveLength(289);
    const normalized = normalizeRev3Sheet(file.sheets[0]);
    expect(normalized.rows.map(row => Number(row.ID))).toEqual(archive.locations.map(row => Number(row.sourceId)));
    expect(normalized.rows.every(row => row['Pred_Risk_T+1'] === 'ยังไม่กรอก')).toBe(true);
    expect(() => workbookOrigins(normalized)).toThrow('ปีต้นทาง');
    normalized.rows.forEach(row => { row.Year = 2025; row.Month = 12; });
    expect(() => importOriginalForecast(normalized, {}, archive.locations, '2025-12')).toThrow('ยังไม่กรอก');
    expect((await readAdminWorkbook(bytes)).sheets).toHaveLength(1);
  });
});
