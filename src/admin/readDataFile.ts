import type { ImportFile, ImportSheet } from './workbook';
import type { Json, Payload } from './types';
import { legacyCodepages } from './legacyCodepages';

export type DataFileFormat = 'xlsx' | 'xls' | 'csv';
export type CsvEncoding = 'utf-8' | 'windows-874';
const maxRows = 100000;
const unsafe = new Set(['__proto__', 'constructor', 'prototype']);
function columnsFor(values: Json[]) {
  const columns = values.map(value => String(value ?? '').replace(/^\uFEFF/, '').trim());
  if (!columns.length || columns.length > 100 || columns.some(key => !key || unsafe.has(key)) || new Set(columns).size !== columns.length) {
    throw new Error('หัวคอลัมน์ต้องไม่ว่าง ไม่ซ้ำกัน และมีไม่เกิน 100 คอลัมน์');
  }
  return columns;
}

/** CSV remains text until the selected field contract interprets a value. */
export function readCsv(text: string): ImportFile {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0];
  const counts = [',', ';', '\t'].map(separator => {
    let quoted = false; let count = 0;
    for (let i = 0; i < first.length; i++) {
      if (first[i] === '"') { if (quoted && first[i + 1] === '"') i++; else quoted = !quoted; }
      else if (!quoted && first[i] === separator) count++;
    }
    return { separator, count };
  }).sort((a, b) => b.count - a.count);
  const separator = counts[0].separator;
  if (!counts[0].count || counts[0].count === counts[1].count) throw new Error('ไม่พบตัวคั่นคอลัมน์ที่ชัดเจน กรุณาบันทึก CSV แบบคั่นด้วยจุลภาค อัฒภาค หรือแท็บ');
  const matrix: string[][] = []; const sourceRows: number[] = [];
  let row: string[] = []; let cell = ''; let quoted = false; let closed = false; let line = 1; let start = 1;
  const finishCell = () => { row.push(cell); cell = ''; closed = false; if (row.length > 100) throw new Error('ไฟล์มีมากกว่า 100 คอลัมน์'); };
  const finishRow = () => {
    finishCell();
    if (row.some(value => value !== '')) { matrix.push(row); sourceRows.push(start); }
    if (matrix.length > maxRows + 1) throw new Error('หนึ่งไฟล์รับได้ไม่เกิน 100,000 รายการ');
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else { cell += char; if (char === '\n') line++; }
    } else if (char === separator) finishCell();
    else if (char === '\r' || char === '\n') { if (char === '\r' && text[i + 1] === '\n') i++; finishRow(); line++; start = line; }
    else if (char === '"' && !cell && !closed) quoted = true;
    else { if (closed || char === '"') throw new Error(`แถว ${line}: เครื่องหมายคำพูดใน CSV ไม่ถูกต้อง`); cell += char; }
  }
  if (quoted) throw new Error(`แถว ${start}: CSV มีข้อความที่ยังไม่ปิดเครื่องหมายคำพูด`);
  if (cell || row.length || closed) finishRow();
  if (!matrix.length) throw new Error('ไฟล์ CSV ไม่มีข้อมูล');
  const columns = columnsFor(matrix[0]);
  const rows = matrix.slice(1).map((values, index) => {
    if (values.length !== columns.length) throw new Error(`แถว ${sourceRows[index + 1]}: จำนวนช่องไม่ตรงกับหัวคอลัมน์ กรุณาตรวจตัวคั่นหรือช่องที่ขาด`);
    return Object.fromEntries(columns.map((column, i) => [column, values[i]]));
  });
  return { sheets: [{ name: 'ข้อมูล CSV', columns, rows, sourceRows: sourceRows.slice(1) }], metadata: null };
}

async function readExcelFile(bytes: ArrayBuffer, format: 'xls' | 'xlsx'): Promise<ImportFile> {
  const signature = new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength));
  if (format === 'xls' && !(signature[0] === 0xd0 && signature[1] === 0xcf) && !(signature[0] === 9 && [0, 2, 4, 8].includes(signature[1]))) {
    throw new Error('ไฟล์นี้ไม่ใช่ Excel .xls แบบเดิม กรุณาเปิดใน Excel แล้วบันทึกเป็น .xlsx หรือ CSV');
  }
  if (format === 'xlsx' && !(signature[0] === 0x50 && signature[1] === 0x4b)) {
    throw new Error('อ่านไฟล์ Excel ไม่สำเร็จ กรุณาเปิดไฟล์ต้นฉบับและบันทึกใหม่เป็น .xlsx หรือ CSV');
  }
  const xlsx = await import('xlsx');
  xlsx.set_cptable(legacyCodepages);
  const book = xlsx.read(bytes, { type: 'array', cellFormula: true, cellDates: true, sheetRows: maxRows + 2 });
  const sheets: ImportSheet[] = []; let metadata: Payload | null = null;
  for (const name of book.SheetNames) {
    if (book.SheetNames.includes('ข้อมูลพยากรณ์') && ['คำอธิบาย', 'ตัวอย่าง', 'รายชื่อพื้นที่'].includes(name)) continue;
    if (name.startsWith('_') && name !== '_Metadata') continue;
    const sheet = book.Sheets[name]; if (!sheet['!ref']) continue;
    const extent = xlsx.utils.decode_range(sheet['!fullref'] ?? sheet['!ref']!);
    if (extent.e.r > maxRows || extent.e.c >= 100) throw new Error('หนึ่งชีตรับได้ไม่เกิน 100,000 รายการและ 100 คอลัมน์');
    const matrix: Json[][] = []; const sourceRows: number[] = [];
    for (let r = 0; r <= extent.e.r; r++) {
      const row: Json[] = [];
      for (let c = 0; c <= extent.e.c; c++) {
        const cell = sheet[xlsx.utils.encode_cell({ r, c })];
        if (cell?.f || cell?.t === 'e') throw new Error(`ชีต ${name} แถว ${r + 1}: พบสูตรหรือข้อผิดพลาด กรุณาใช้ค่าข้อมูลที่ยืนยันแล้ว`);
        if (cell?.t === 'd') throw new Error(`ชีต ${name} แถว ${r + 1}: วันที่ต้องเป็นข้อความตามรูปแบบของช่อง`);
        row.push(cell?.v ?? null);
      }
      if (r === 0 || row.some(value => value !== null && value !== '')) { matrix.push(row); sourceRows.push(r + 1); }
    }
    if (name === '_Metadata') {
      metadata = {}; const parts = new Map<string, { total: number; chunks: Map<number, string> }>();
      for (const row of matrix.slice(1)) {
        const key = String(row[0] ?? ''); const part = Number(row[2] ?? 1); const total = Number(row[3] ?? 1);
        if (!key || unsafe.has(key) || !Number.isInteger(part) || !Number.isInteger(total) || part < 1 || part > total || total > 100) throw new Error('รายละเอียดประกอบไฟล์ไม่ถูกต้อง');
        const entry = parts.get(key) ?? { total, chunks: new Map<number, string>() };
        if (entry.total !== total || entry.chunks.has(part)) throw new Error('รายละเอียดประกอบไฟล์ซ้ำกัน');
        entry.chunks.set(part, String(row[1] ?? '')); parts.set(key, entry);
      }
      for (const [key, entry] of parts) {
        if (entry.chunks.size !== entry.total) throw new Error('รายละเอียดประกอบไฟล์ไม่ครบ');
        metadata[key] = JSON.parse(Array.from({ length: entry.total }, (_, i) => entry.chunks.get(i + 1)).join('')) as Json;
      }
      continue;
    }
    const columns = columnsFor(matrix[0]);
    sheets.push({ name, columns, rows: matrix.slice(1).map(row => Object.fromEntries(columns.map((column, i) => [column, row[i]]))), sourceRows: sourceRows.slice(1) });
  }
  if (!sheets.length) throw new Error('ไม่พบตารางข้อมูลในไฟล์');
  return { sheets, metadata };
}

export async function readDataFile(bytes: ArrayBuffer, format: DataFileFormat, encoding: CsvEncoding = 'utf-8'): Promise<ImportFile> {
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('ไฟล์เกิน 20 MB');
  let result: ImportFile;
  if (format === 'csv') {
    let text: string;
    try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes); }
    catch { throw new Error('อ่านภาษาใน CSV ไม่ได้ ลองเลือก ภาษาไทยจาก Excel รุ่นเก่า หรือบันทึกไฟล์ใหม่เป็น CSV UTF-8'); }
    result = readCsv(text);
  } else {
    try { result = await readExcelFile(bytes, format); }
    catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/[\u0E00-\u0E7F]/.test(message)) throw error;
      if (/password|encrypt/i.test(message)) throw new Error('ไฟล์นี้ต้องใช้รหัสผ่าน กรุณาบันทึกสำเนาที่ไม่ล็อกก่อนนำเข้า');
      throw new Error('อ่านไฟล์ Excel ไม่สำเร็จ กรุณาเปิดไฟล์ต้นฉบับและบันทึกใหม่เป็น .xlsx หรือ CSV');
    }
  }
  // These names belong to the shipped template; other workbooks keep all data tabs.
  if (result.sheets.some(sheet => sheet.name === 'ข้อมูลพยากรณ์')) result.sheets = result.sheets.filter(sheet => !['คำอธิบาย', 'ตัวอย่าง', 'รายชื่อพื้นที่'].includes(sheet.name));
  return result;
}
