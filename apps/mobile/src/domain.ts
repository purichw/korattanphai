import hierarchy from '../../../src/data/canonical/nakhon_ratchasima/admin_hierarchy.json';
import type { NakhonRatchasimaDroughtForecastArchive as Archive } from '../../../src/types';
import { irrigationStatusFromSource, type IrrigationCriterion } from '../../../src/irrigation';
import type { ExportLocation, ExportRisk } from '../../../src/forecastExportModel';
import type { SavedRiskCriterion } from '../../../src/data/savedWorkspaces';
export { formatMonth } from '../../../src/i18n';
export { forecastTargetPeriod } from '../../../src/forecastPeriod';
export { summarizeExportRisks, exportRiskLabel, exportHorizons } from '../../../src/forecastExportModel';
export type { Archive, ExportLocation, ExportRisk, IrrigationCriterion, SavedRiskCriterion };

export const districts = hierarchy.province.districts;
export const areas = [
  { code: '30', name: 'นครราชสีมา', label: 'จังหวัดนครราชสีมา', parent: '', search: 'Nakhon Ratchasima' },
  ...districts.flatMap(d => [
    { code: d.districtCode, name: d.nameTh, label: `อ.${d.nameTh}`, parent: '30', search: d.name },
    ...d.subdistricts.map(t => ({ code: t.subdistrictCode, name: t.nameTh, label: `ต.${t.nameTh} · อ.${d.nameTh}`, parent: d.districtCode, search: `${t.name} ${d.name}` })),
  ]),
];
export const areaInfo = (code: string) => areas.find(a => a.code === code) ?? areas[0];
export const riskOptions: { value: SavedRiskCriterion; label: string }[] = [
  { value: 'all', label: 'ทุกระดับความเสี่ยง' },
  { value: 'forecast-no-risk', label: 'ไม่พบสัญญาณเสี่ยง' },
  { value: 'forecast-moderate', label: 'เสี่ยงปานกลาง' },
  { value: 'forecast-high', label: 'เสี่ยงสูง' },
  { value: 'forecast-out-of-scope', label: 'นอกขอบเขตการศึกษา' },
  { value: 'forecast-missing', label: 'ไม่มีข้อมูล' },
];
export const riskColors = ['#5dae79', '#f1b84b', '#d95d59', '#e2e8e4', '#dfe7e1'] as const;
export const riskIndex = (risk: ExportRisk) => risk === undefined ? 4 : risk === null ? 3 : risk;
export function matchesRisk(risk: ExportRisk, criterion: SavedRiskCriterion) {
  return criterion === 'all' || riskOptions[riskIndex(risk) + 1].value === criterion;
}
export function forecastRows(archive: Archive, origin: string, irrigation: IrrigationCriterion): ExportLocation[] {
  return archive.locations.filter(row => irrigation === 'all' || irrigationStatusFromSource(row.irrigationStatus) === irrigation)
    .sort((a, b) => a.subdistrictCode.localeCompare(b.subdistrictCode))
    .map(row => ({ ...row, risks: [0, 1, 2, 3, 4, 5].map(i => archive.packedRiskByTargetMonth[origin]?.[row.subdistrictCode]?.[i]) }));
}
