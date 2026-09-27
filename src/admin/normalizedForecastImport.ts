import type { ImportSheet } from './workbook';
import type { Payload } from './types';

export const workbookRiskColumns = Array.from({ length: 6 }, (_, index) => `Pred_Risk_T+${index + 1}`);
export const isOriginalForecastSheet = (sheet: ImportSheet) => ['Year', 'Month', 'ID', 'TAMBON_E', 'AMPHOE_E', 'Irrigation_Status', ...workbookRiskColumns].every(key => sheet.columns.includes(key));
export function workbookOrigins(sheet: ImportSheet): string[] {
  const values = new Set<string>();
  for (const row of sheet.rows) {
    if (!Number.isInteger(row.Year) || Number(row.Year) < 1900 || Number(row.Year) > 2199 || !Number.isInteger(row.Month) || Number(row.Month) < 1 || Number(row.Month) > 12) throw new Error('Year / Month ต้องเป็นปี ค.ศ. และเดือน 1–12');
    values.add(`${row.Year}-${String(row.Month).padStart(2, '0')}`);
  }
  return [...values].sort().reverse();
}
export function importOriginalForecast(sheet: ImportSheet, base: Payload, crosswalk: { sourceId: number; subdistrictCode: string }[], origin: string): Payload {
  if (!isOriginalForecastSheet(sheet)) throw new Error('คอลัมน์ไม่ตรงกับ Master_Data_Drought_Final');
  const selected = sheet.rows.filter(row => `${row.Year}-${String(row.Month).padStart(2, '0')}` === origin);
  const sourceIds = new Map(crosswalk.map(area => [String(area.sourceId), area.subdistrictCode]));
  const predictions = new Map<string, Payload>();
  selected.forEach(row => {
    const code = sourceIds.get(String(row.ID));
    if (!code) throw new Error(`ID ${row.ID} ยังไม่มีทะเบียนจับคู่รหัสตำบล ต้องตรวจทะเบียนก่อนนำเข้า`);
    workbookRiskColumns.forEach((column, index) => {
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
