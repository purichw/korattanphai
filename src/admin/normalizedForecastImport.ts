import type { ImportSheet } from './workbook';
import type { Payload } from './types';
import fields from './rev3Fields.json';

export const rev3Fields = fields;
export const riskHelp = 'เลือก ไม่พบความเสี่ยง / เสี่ยงปานกลาง / เสี่ยงสูง / นอกขอบเขตการศึกษา หรือใช้ 0 / 1 / 2 / ช่องว่างตามต้นฉบับ ช่องว่างไม่ใช่ค่าศูนย์';
const header = (value: string) => value.trim().replace(/\uFEFF/g, '').replace(/–/g, '-');
export function matchRev3Columns(sheet: ImportSheet): Record<string, string> {
  return Object.fromEntries(fields.map(field => {
    const matches = sheet.columns.filter(column => [field.key, field.label].some(alias => header(alias) === header(column)));
    return [field.key, matches.length === 1 ? matches[0] : ''];
  }));
}
export function normalizeRev3Sheet(sheet: ImportSheet, mapping = matchRev3Columns(sheet)): ImportSheet {
  const missing = fields.filter(field => !mapping[field.key] || !sheet.columns.includes(mapping[field.key]));
  if (missing.length) throw new Error(`เลือกคอลัมน์สำหรับ ${missing.map(field => field.label).join(', ')}`);
  const selected = fields.map(field => mapping[field.key]);
  if (new Set(selected).size !== fields.length) throw new Error('หนึ่งคอลัมน์ใช้ได้เพียงหนึ่งช่อง กรุณาตรวจการจับคู่');
  const risks: Record<string, number | null> = { '0': 0, '1': 1, '2': 2, 'ไม่พบความเสี่ยง': 0, 'เสี่ยงปานกลาง': 1, 'เสี่ยงสูง': 2, 'นอกขอบเขตการศึกษา': null, '': null };
  return { ...sheet, columns: fields.map(field => field.key), rows: sheet.rows.map(row => Object.fromEntries(fields.map(field => {
    let value = row[mapping[field.key]];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (['Year', 'Month', 'ID'].includes(field.key) && /^\d+$/.test(trimmed)) value = Number(trimmed);
      else if (field.key.startsWith('Pred_Risk_') && Object.prototype.hasOwnProperty.call(risks, trimmed)) value = risks[trimmed];
    }
    return [field.key, value];
  }))) };
}

export const workbookRiskColumns = Array.from({ length: 6 }, (_, index) => `Pred_Risk_T+${index + 1}`);
export const isOriginalForecastSheet = (sheet: ImportSheet) => Object.values(matchRev3Columns(sheet)).every(Boolean);
export function workbookOrigins(sheet: ImportSheet): string[] {
  const values = new Set<string>();
  for (const [index, row] of normalizeRev3Sheet(sheet).rows.entries()) {
    if (!Number.isInteger(row.Year) || Number(row.Year) < 1900 || Number(row.Year) > 2199 || !Number.isInteger(row.Month) || Number(row.Month) < 1 || Number(row.Month) > 12) throw new Error(`แถว ${sheet.sourceRows?.[index] ?? index + 2}: ระบุปีต้นทางเป็น ค.ศ. เช่น 2025 และเดือน 1–12`);
    values.add(`${row.Year}-${String(row.Month).padStart(2, '0')}`);
  }
  return [...values].sort().reverse();
}
export function importOriginalForecast(sheet: ImportSheet, base: Payload, crosswalk: { sourceId: number; subdistrictCode: string }[], origin: string): Payload {
  sheet = normalizeRev3Sheet(sheet);
  workbookOrigins(sheet);
  const selected = sheet.rows.filter(row => `${row.Year}-${String(row.Month).padStart(2, '0')}` === origin);
  const sourceIds = new Map(crosswalk.map(area => [String(area.sourceId), area.subdistrictCode]));
  const predictions = new Map<string, Payload>();
  selected.forEach(row => {
    const code = sourceIds.get(String(row.ID));
    if (!code) throw new Error(`ID ${row.ID} ยังไม่มีทะเบียนจับคู่รหัสตำบล ต้องตรวจทะเบียนก่อนนำเข้า`);
    workbookRiskColumns.forEach((column, index) => {
      if (row[column] === 'ยังไม่กรอก') throw new Error(`รหัสพื้นที่ ${row.ID}: ยังไม่กรอกผลล่วงหน้า ${index + 1} เดือน กรุณาเลือกผลที่ตรวจสอบแล้ว`);
      const horizon = index + 1;
      const serial = Number(origin.slice(0, 4)) * 12 + Number(origin.slice(5)) - 1 + horizon;
      const risk = row[column] === '' ? null : row[column];
      const cell = { subdistrictCode: code, horizonMonths: horizon,
        targetMonth: `${Math.floor(serial / 12)}-${String(serial % 12 + 1).padStart(2, '0')}`,
        status: risk === null ? 'out_of_scope' : 'predicted', riskCode: risk };
      const key = `${code}:${horizon}`;
      const earlier = predictions.get(key);
      if (earlier && earlier.riskCode !== risk) predictions.set(key, { ...cell, status: 'unresolved', riskCode: `ค่าต่างกัน: ${earlier.riskCode} / ${risk}` });
      else if (!earlier) predictions.set(key, cell);
    });
  });
  if (predictions.size !== 289 * 6) throw new Error(`รอบ ${origin} มีข้อมูลไม่ครบ 289 ตำบล ห้ามเติมพื้นที่ที่หายไปเป็นนอกขอบเขต`);
  return { ...base, predictions: [...predictions.values()].sort((a, b) => String(a.subdistrictCode).localeCompare(String(b.subdistrictCode)) || Number(a.horizonMonths) - Number(b.horizonMonths)) };
}
