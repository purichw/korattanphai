import { exportHorizons, summarizeExportRisks, type ExportLocation, type ExportRisk, type ForecastExportComparisonRow } from './forecastExportModel';

export type AnalysisLevel = 'district' | 'subdistrict';
const analysisHierarchyByScope = {
  province: { defaultLevel: 'district', levels: ['district', 'subdistrict'], comparisonLevel: 'district' },
  district: { defaultLevel: 'subdistrict', levels: ['subdistrict'], comparisonLevel: 'subdistrict' },
  // Tambon is the current source-data leaf. Do not invent finer-area forecasts.
  subdistrict: { defaultLevel: 'subdistrict', levels: ['subdistrict'], comparisonLevel: null },
} as const;

export function analysisHierarchy(areaCode: string) {
  const scope = areaCode === '30' ? 'province' : areaCode.length === 4 ? 'district' : 'subdistrict';
  return analysisHierarchyByScope[scope];
}

export type RiskPattern = 'all' | 'high' | 'consecutive3' | `first-${number}` | `risk-${number}`;
export const riskPatternOptions = [
  { value: 'all', label: 'ทุกรูปแบบพยากรณ์' },
  ...exportHorizons.map(h => ({ value: `risk-${h}`, label: `มีความเสี่ยงใน T+${h}`, group: 'ความเสี่ยงรายเดือน' })),
  { value: 'high', label: 'เสี่ยงสูงอย่างน้อย 1 เดือน', group: 'รูปแบบตลอด 6 เดือน' },
  { value: 'consecutive3', label: 'เสี่ยงต่อเนื่องอย่างน้อย 3 เดือน', group: 'รูปแบบตลอด 6 เดือน' },
  ...exportHorizons.map(h => ({ value: `first-${h}`, label: `เริ่มเสี่ยงครั้งแรกในรอบที่ T+${h}`, group: 'เดือนแรกที่เสี่ยงในรอบพยากรณ์' })),
];

export function forecastPattern(risks: ExportRisk[]) {
  let run = 0, longestRun = 0;
  for (const risk of risks) {
    run = risk === 1 || risk === 2 ? run + 1 : 0;
    longestRun = Math.max(longestRun, run);
  }
  const first = risks.findIndex(risk => risk === 1 || risk === 2);
  // A gap before the first signal cannot establish when risk began.
  const confirmedFirst = first >= 0 && risks.slice(0, first).every(risk => risk === 0) ? first + 1 : null;
  return { longestRun, firstSignal: first < 0 ? null : first + 1, confirmedFirst, high: risks.includes(2) };
}

export function matchesRiskPattern(risks: ExportRisk[], pattern: RiskPattern) {
  if (pattern.startsWith('risk-')) {
    const risk = risks[Number(pattern.slice(5)) - 1];
    return risk === 1 || risk === 2;
  }
  const result = forecastPattern(risks);
  return pattern === 'all' || (pattern === 'high' ? result.high : pattern === 'consecutive3'
    ? result.longestRun >= 3 : result.confirmedFirst === Number(pattern.slice(6)));
}

export function areaMatchesSearch(query: string, ...values: string[]) {
  const words = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const haystack = values.join(' ').normalize('NFKC').toLocaleLowerCase();
  return words.every(word => haystack.includes(word));
}

export function filterAnalysisRows(rows: ExportLocation[], query: string, districtCode: string, pattern: RiskPattern) {
  return rows.filter(row => (!districtCode || row.districtCode === districtCode)
    && matchesRiskPattern(row.risks, pattern)
    && areaMatchesSearch(query, row.subdistrictCode, row.subdistrictNameTh, row.sourceTambonEn,
      row.districtCode, row.districtNameTh, row.sourceAmphoeEnCorrected || row.sourceAmphoeEn));
}

export function analysisDistricts(rows: ExportLocation[]) {
  const groups = new Map<string, ExportLocation[]>();
  for (const row of rows) groups.set(row.districtCode, [...(groups.get(row.districtCode) ?? []), row]);
  return [...groups].map(([code, members]) => ({ code, name: members[0].districtNameTh, rows: members,
    horizons: exportHorizons.map(h => summarizeExportRisks(members, h)) }));
}

export const comparisonStyles = {
  INCREASED: { label: 'ความเสี่ยงเพิ่มขึ้น', color: '#b83b3f' },
  DECREASED: { label: 'ความเสี่ยงลดลง', color: '#397fc5' },
  UNCHANGED: { label: 'ระดับเดิม', color: '#a5ada8' },
  NOT_COMPARABLE: { label: 'เปรียบเทียบไม่ได้', color: '#e2e9e5' },
} as const;

export type ForecastAnalysisOverlay = {
  originPeriod: string;
  horizon: number;
  datasetVersion: string;
  revision: string;
  label: string;
  codes: string[];
  comparison?: ForecastExportComparisonRow[];
};
