import ExcelJS from '@protobi/exceljs';
import { DATA_FIELDS, type DataKind } from '../../shared/dataFields.mjs';
import { rowsKey, type Payload, type Json } from './types';

export type ImportSheet = { name: string; columns: string[]; rows: Payload[] };
export type ImportFile = { sheets: ImportSheet[]; metadata: Payload | null };
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 100000;

export async function readAdminWorkbook(bytes: ArrayBuffer): Promise<ImportFile> {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error('ไฟล์เกิน 20 MB');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheets: ImportSheet[] = [];
  let metadata: Payload | null = null;
  for (const sheet of workbook.worksheets) {
    if (sheet.name === '_Metadata') {
      metadata = {};
      const parts = new Map<string, { total: number; chunks: Map<number, string> }>();
      sheet.eachRow((row, index) => {
        if (index === 1) return;
        const key = row.getCell(1).text;
        if (!key || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('ชื่อ field ใน metadata ไม่ถูกต้อง');
        const part = Number(row.getCell(3).value ?? 1);
        const total = Number(row.getCell(4).value ?? 1);
        if (!Number.isInteger(part) || !Number.isInteger(total) || part < 1 || part > total || total > 100) throw new Error('ลำดับ metadata ไม่ถูกต้อง');
        const entry = parts.get(key) ?? { total, chunks: new Map<number, string>() };
        if (entry.total !== total || entry.chunks.has(part)) throw new Error('ชื่อ field ใน metadata ซ้ำกัน');
        entry.chunks.set(part, row.getCell(2).text); parts.set(key, entry);
      });
      for (const [key, entry] of parts) {
        if (entry.chunks.size !== entry.total) throw new Error('metadata ไม่ครบทุกส่วน');
        metadata[key] = JSON.parse(Array.from({ length: entry.total }, (_, index) => entry.chunks.get(index + 1)).join('')) as Json;
      }
      continue;
    }
    if (sheet.name.startsWith('_')) continue;
    if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > 100) throw new Error('หนึ่งชีตรับได้ไม่เกิน 100,000 รายการและ 100 คอลัมน์');
    const columns: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, cell => columns.push(cell.text.trim()));
    if (!columns.length || columns.some(key => !key || ['__proto__', 'constructor', 'prototype'].includes(key))
      || new Set(columns).size !== columns.length) throw new Error('หัวคอลัมน์ต้องไม่ว่างและไม่ซ้ำกัน');
    const rows: Payload[] = [];
    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex++) {
      const row = sheet.getRow(rowIndex);
      if (!row.hasValues) continue;
      const record: Payload = {};
      columns.forEach((key, column) => {
        const cell = row.getCell(column + 1);
        if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Error) {
          throw new Error(`แถว ${rowIndex}: พบสูตรหรือข้อผิดพลาด ต้องใช้ค่าข้อมูลต้นทางที่ยืนยันแล้ว`);
        }
        const value = cell.value;
        if (value === null || value === undefined) record[key] = null;
        else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') record[key] = value;
        else if (value instanceof Date) throw new Error(`แถว ${rowIndex}: วันที่ต้องระบุเป็นข้อความตามรูปแบบ API พร้อมเขตเวลาถ้าจำเป็น`);
        else record[key] = cell.text;
      });
      rows.push(record);
    }
    sheets.push({ name: sheet.name, columns, rows });
  }
  if (!sheets.length) throw new Error('ไม่พบตารางข้อมูลในไฟล์');
  return { sheets, metadata };
}

export function mapImportRows(kind: DataKind, sheet: ImportSheet, mapping: Record<string, string>, ignored: string[] = []): Payload[] {
  const selected = Object.values(mapping).filter(Boolean);
  if (new Set(selected).size !== selected.length) throw new Error('หนึ่งคอลัมน์จับคู่ได้เพียง field เดียว');
  if (sheet.columns.some(column => !selected.includes(column) && !ignored.includes(column))) throw new Error('ยังมีคอลัมน์ที่ไม่ได้จับคู่หรือยืนยันไม่นำเข้า');
  return sheet.rows.map(row => {
    const output: Payload = {};
    for (const field of DATA_FIELDS[kind]) {
      const column = mapping[field.key];
      if (!column) continue;
      let value = row[column];
      if (value === null || value === '') {
        if (field.optional) continue;
        value = field.nullable ? null : '';
      } else if (field.type === 'number' && typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value.trim())) {
        const number = Number(value);
        if (Number.isFinite(number)) value = number;
      }
      // Invalid values are retained for visible correction, not guessed/coerced.
      output[field.key] = value;
    }
    return output;
  });
}

export async function createAdminWorkbook(kind: DataKind, payload: Payload) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'โคราชทันภัย';
  const rowKey = rowsKey(kind);
  const rows = payload[rowKey] as Payload[];
  const keys = [...new Set([...DATA_FIELDS[kind].map(field => field.key), ...rows.flatMap(row => Object.keys(row))])];
  const sheet = workbook.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
  sheet.columns = keys.map(key => ({ header: key, key, width: key.toLowerCase().includes('at') ? 30 : 24 }));
  rows.forEach(row => sheet.addRow(keys.map(key => {
    const value = row[key];
    return value === undefined || value === null ? null : typeof value === 'object' ? JSON.stringify(value) : value;
  })));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: keys.length } };
  const metadata = workbook.addWorksheet('_Metadata');
  metadata.columns = [{ header: 'field', key: 'field', width: 30 }, { header: 'value_json', key: 'value', width: 100 }, { header: 'part', width: 10 }, { header: 'parts', width: 10 }];
  for (const [key, value] of Object.entries(payload)) if (key !== rowKey) {
    const json = JSON.stringify(value);
    const count = Math.max(1, Math.ceil(json.length / 30000));
    for (let part = 1; part <= count; part++) metadata.addRow([key, json.slice((part - 1) * 30000, part * 30000), part, count]);
  }
  for (const page of workbook.worksheets) {
    page.eachRow((row, index) => {
      row.height = index === 1 ? 32 : 28;
      row.eachCell({ includeEmpty: true }, cell => {
        cell.font = { name: 'Cordia New', size: 16, bold: index === 1, color: { argb: 'FF20362E' } };
        cell.alignment = { vertical: 'middle', horizontal: page.name === '_Metadata' ? 'left' : 'center', wrapText: true };
        if (index === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F2EC' } };
      });
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
