import type { NakhonRatchasimaDroughtForecastArchive as Archive } from './types';
import { forecastScopeCodes } from './data/forecastScope';
import { forecastTargetPeriod } from './forecastPeriod';
import { irrigationStatusFromSource, type IrrigationCriterion } from './irrigation';

export const exportHorizons = [1, 2, 3, 4, 5, 6] as const;
export const exportRiskLabels = ['ไม่พบสัญญาณเสี่ยง', 'เสี่ยงปานกลาง', 'เสี่ยงสูง', 'นอกขอบเขตการศึกษา', 'ไม่มีข้อมูล'] as const;
export type ExportRisk = 0 | 1 | 2 | null | undefined;
export type ExportOptions = { originPeriod: string; areaCode: string; irrigation: IrrigationCriterion };
export type ExportLocation = Archive['locations'][number] & { risks: ExportRisk[] };

export function summarizeExportRisks(rows: ExportLocation[], horizon: number) {
  const counts = [0, 0, 0, 0, 0];
  for (const row of rows) {
    const risk = row.risks[horizon - 1];
    counts[risk === undefined ? 4 : risk === null ? 3 : risk] += 1;
  }
  const valid = counts[0] + counts[1] + counts[2];
  const highest: ExportRisk = counts[2] ? 2 : counts[1] ? 1 : counts[0] ? 0 : counts[4] ? undefined : null;
  return { counts, valid, highest, total: rows.length, riskShare: valid ? (counts[1] + counts[2]) / valid : null };
}

export function exportRiskLabel(risk: ExportRisk) {
  return exportRiskLabels[risk === undefined ? 4 : risk === null ? 3 : risk];
}

export function buildForecastExport(archive: Archive, options: ExportOptions, exportedAt = new Date()) {
  const month = archive.targetMonths.find(item => item.period === options.originPeriod);
  const packed = archive.packedRiskByTargetMonth[options.originPeriod];
  if (!month || !packed || archive.meta.horizonCount !== 6
    || (archive.loadedSelection && (archive.loadedSelection.originPeriod !== options.originPeriod || archive.loadedSelection.horizonCount !== 6))) {
    throw new Error('ไม่พบข้อมูลครบ T+1–T+6 สำหรับเดือนตั้งต้นที่เลือก กรุณาลองใหม่');
  }
  const scope = new Set(forecastScopeCodes(options.areaCode));
  const locations = archive.locations.filter(row => scope.has(row.subdistrictCode));
  if (locations.length !== scope.size || new Set(locations.map(row => row.subdistrictCode)).size !== scope.size) {
    throw new Error('ข้อมูลพื้นที่ไม่ครบตามขอบเขตที่เลือก กรุณาลองใหม่');
  }
  const rows: ExportLocation[] = locations.filter(row => options.irrigation === 'all'
    || irrigationStatusFromSource(row.irrigationStatus) === options.irrigation).map(row => {
    const values = packed[row.subdistrictCode];
    if (values && (values.length !== 6 || values.some(risk => risk !== null && risk !== 0 && risk !== 1 && risk !== 2))) {
      throw new Error('พบข้อมูลพยากรณ์ที่ไม่ตรงนิยาม จึงยังไม่ส่งออก');
    }
    return { ...row, risks: exportHorizons.map((_, index) => values?.[index]) };
  }).sort((a, b) => a.subdistrictCode.localeCompare(b.subdistrictCode));
  if (!rows.length) throw new Error('ไม่มีตำบลตรงกับตัวกรองชลประทานที่เลือก');
  const districts = [...new Set(rows.map(row => row.districtCode))].map(code => {
    const members = rows.filter(row => row.districtCode === code);
    return { code, name: members[0].districtNameTh, rows: members, total: forecastScopeCodes(code).length,
      horizons: exportHorizons.map(horizon => summarizeExportRisks(members, horizon)) };
  });
  return { options, rows, districts, exportedAt, meta: archive.meta, corrections: archive.mapping.sourceCorrections,
    targets: exportHorizons.map(horizon => forecastTargetPeriod(options.originPeriod, horizon)),
    totals: exportHorizons.map(horizon => summarizeExportRisks(rows, horizon)),
    filename: `Korat_Drought_${options.originPeriod}_${options.areaCode}_${options.irrigation}_T1-T6.xlsx` };
}

export type ForecastExport = ReturnType<typeof buildForecastExport>;
