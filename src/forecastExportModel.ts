import type { NakhonRatchasimaDroughtForecastArchive as Archive } from './types';
import { forecastScopeCodes } from './data/forecastScope';
import { forecastTargetPeriod } from './forecastPeriod';
import { irrigationStatusFromSource, type IrrigationCriterion } from './irrigation';
import { forecastExportDictionary } from './forecastExportDictionary';

export const exportHorizons = [1, 2, 3, 4, 5, 6] as const;
export const exportRiskLabels = ['ไม่พบสัญญาณเสี่ยง', 'เสี่ยงปานกลาง', 'เสี่ยงสูง', 'นอกขอบเขตการศึกษา', 'ไม่มีข้อมูล'] as const;
export type ExportRisk = 0 | 1 | 2 | null | undefined;
export type ExportOptions = { originPeriod: string; areaCode: string; irrigation: IrrigationCriterion };
export type ExportLocation = Archive['locations'][number] & { risks: ExportRisk[] };
export const forecastExportVersion = '2.0.0';
export type ForecastExportStatus = 'VALID' | 'OUT_OF_SCOPE' | 'MISSING';
export type ForecastExportMachineRow = {
  provinceCode: string;
  provinceNameTh: string;
  districtCode: string;
  districtNameTh: string;
  subdistrictCode: string;
  subdistrictNameTh: string;
  sourceId: string;
  irrigationStatus: ReturnType<typeof irrigationStatusFromSource>;
  originPeriod: string;
  targetPeriod: string;
  horizon: typeof exportHorizons[number];
  forecastRisk: 0 | 1 | 2 | null;
  forecastStatus: ForecastExportStatus;
  riskLabelTh: string;
  riskLabelEn: string;
  locationCount: 1;
  sourceVintageKey: string;
  sourceAreaKey: string;
  sourceAdminCorrectionApplied: boolean;
  sourceWorkbook: string;
  sourceSheet: string;
  sourceWorkbookSha256: string;
  normalizedManifestSha256: string;
  datasetId: string;
  datasetVersion: string;
  provenance: Archive['meta']['provenance'];
  exportVersion: string;
  exportedAt: string;
};

export type ForecastExportComparisonRow = {
  provinceCode: string;
  districtCode: string;
  districtNameTh: string;
  subdistrictCode: string;
  subdistrictNameTh: string;
  irrigationStatus: ForecastExportMachineRow['irrigationStatus'];
  targetPeriod: string;
  baselineOriginPeriod: string;
  currentOriginPeriod: string;
  baselineHorizon: typeof exportHorizons[number];
  currentHorizon: typeof exportHorizons[number];
  baselineSourceId: string;
  currentSourceId: string;
  baselineForecastRisk: ForecastExportMachineRow['forecastRisk'];
  currentForecastRisk: ForecastExportMachineRow['forecastRisk'];
  baselineStatus: ForecastExportStatus;
  currentStatus: ForecastExportStatus;
  riskDelta: number | null;
  comparisonStatus: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | 'NOT_COMPARABLE';
  baselineSourceVintageKey: string;
  currentSourceVintageKey: string;
  baselineDatasetId: string;
  currentDatasetId: string;
  baselineDatasetVersion: string;
  currentDatasetVersion: string;
  baselineSourceWorkbookSha256: string;
  currentSourceWorkbookSha256: string;
  exportVersion: string;
  exportedAt: string;
};

export type ForecastExportComparison = {
  baselineOriginPeriod: string;
  currentOriginPeriod: string;
  targets: string[];
  rows: ForecastExportComparisonRow[];
  baselineMeta: Archive['meta'];
  currentMeta: Archive['meta'];
};

export function forecastExportStatus(risk: ExportRisk): ForecastExportStatus {
  return risk === undefined ? 'MISSING' : risk === null ? 'OUT_OF_SCOPE' : 'VALID';
}

const riskLabelsEn = ['No forecast risk signal', 'Moderate risk', 'High risk', 'Out of study scope', 'Missing data'];

function exportFilename(options: ExportOptions, meta: Archive['meta'], exportedAt: Date, baselineOrigin?: string) {
  const stamp = exportedAt.toISOString().replace(/[-:]/g, '').replace('.', '');
  const version = meta.datasetVersion.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'dataset';
  const sourceHash = meta.sourceWorkbookSha256.replace(/[^a-fA-F0-9]/g, '').slice(0, 12) || 'unknown';
  return `Korat_Drought_${options.originPeriod}_${options.areaCode}_${options.irrigation}_T1-T6${baselineOrigin ? `_vs_${baselineOrigin}` : ''}_data-${version}-${sourceHash}_v${forecastExportVersion}_${stamp}.xlsx`;
}

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
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(options.originPeriod) || !Number.isFinite(exportedAt.getTime())) {
    throw new Error('เดือนตั้งต้นหรือเวลาส่งออกไม่ถูกต้อง');
  }
  const month = archive.targetMonths.find(item => item.period === options.originPeriod);
  const packed = archive.packedRiskByTargetMonth[options.originPeriod];
  if (!month || !packed || archive.meta.horizonCount !== 6
    || (archive.loadedSelection && (archive.loadedSelection.originPeriod !== options.originPeriod || archive.loadedSelection.horizonCount !== 6))) {
    throw new Error('ไม่พบข้อมูลครบ 6 เดือนล่วงหน้าสำหรับเดือนตั้งต้นที่เลือก กรุณาลองใหม่');
  }
  const scope = new Set(forecastScopeCodes(options.areaCode));
  const locations = archive.locations.filter(row => scope.has(row.subdistrictCode));
  if (locations.length !== scope.size || new Set(locations.map(row => row.subdistrictCode)).size !== scope.size) {
    throw new Error('ข้อมูลพื้นที่ไม่ครบตามขอบเขตที่เลือก กรุณาลองใหม่');
  }
  const rows: ExportLocation[] = locations.filter(row => options.irrigation === 'all'
    || irrigationStatusFromSource(row.irrigationStatus) === options.irrigation).map(row => {
    const values = packed[row.subdistrictCode];
    if (values !== undefined && (!Array.isArray(values) || values.length !== 6
      || exportHorizons.some((_, index) => ![null, 0, 1, 2].includes(values[index])))) {
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
  const targets = exportHorizons.map(horizon => forecastTargetPeriod(options.originPeriod, horizon));
  const meta = structuredClone(archive.meta);
  const machineRows: ForecastExportMachineRow[] = rows.flatMap(row => exportHorizons.map((horizon, index) => {
    const risk = row.risks[index];
    return {
      provinceCode: row.provinceCode, provinceNameTh: row.provinceNameTh,
      districtCode: row.districtCode, districtNameTh: row.districtNameTh,
      subdistrictCode: row.subdistrictCode, subdistrictNameTh: row.subdistrictNameTh,
      sourceId: row.sourceId, irrigationStatus: irrigationStatusFromSource(row.irrigationStatus),
      originPeriod: options.originPeriod, targetPeriod: targets[index], horizon,
      forecastRisk: risk ?? null, forecastStatus: forecastExportStatus(risk),
      riskLabelTh: exportRiskLabel(risk), riskLabelEn: riskLabelsEn[risk === undefined ? 4 : risk === null ? 3 : risk],
      locationCount: 1, sourceVintageKey: `${row.sourceId}|${options.originPeriod}|T+${horizon}`,
      sourceAreaKey: row.sourceAreaKey, sourceAdminCorrectionApplied: row.sourceAdminCorrectionApplied,
      sourceWorkbook: meta.sourceWorkbookOriginal, sourceSheet: meta.sourceSheet,
      sourceWorkbookSha256: meta.sourceWorkbookSha256, normalizedManifestSha256: meta.normalizedManifestSha256,
      datasetId: meta.datasetId, datasetVersion: meta.datasetVersion, provenance: meta.provenance,
      exportVersion: forecastExportVersion, exportedAt: exportedAt.toISOString(),
    };
  }));
  return { options: { ...options }, rows, districts, exportedAt: new Date(exportedAt), meta,
    corrections: structuredClone(archive.mapping.sourceCorrections), targets, machineRows,
    dictionary: forecastExportDictionary, exportVersion: forecastExportVersion,
    comparison: undefined as ForecastExportComparison | undefined,
    totals: exportHorizons.map(horizon => summarizeExportRisks(rows, horizon)),
    filename: exportFilename(options, meta, exportedAt) };
}

export type ForecastExport = ReturnType<typeof buildForecastExport>;

/** Metadata object order is irrelevant; every value, including untyped revision fields, must agree. */
function stableMetadata(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableMetadata).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableMetadata(child)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

/** Reconfirm prepared data only when content changes; export times and row ordering are not data revisions. */
export function sameForecastExportData(left: ForecastExport, right: ForecastExport): boolean {
  const snapshot = (report: ForecastExport) => ({
    options: report.options, meta: report.meta, corrections: report.corrections, exportVersion: report.exportVersion,
    targets: report.targets,
    rows: [...report.rows].sort((a, b) => a.subdistrictCode.localeCompare(b.subdistrictCode)),
    machineRows: report.machineRows.map(({ exportedAt: _exportedAt, ...row }) => row)
      .sort((a, b) => `${a.subdistrictCode}|${a.targetPeriod}`.localeCompare(`${b.subdistrictCode}|${b.targetPeriod}`)),
    comparison: report.comparison && {
      ...report.comparison,
      rows: report.comparison.rows.map(({ exportedAt: _exportedAt, ...row }) => row)
        .sort((a, b) => `${a.subdistrictCode}|${a.targetPeriod}`.localeCompare(`${b.subdistrictCode}|${b.targetPeriod}`)),
    },
  });
  return stableMetadata(snapshot(left)) === stableMetadata(snapshot(right));
}

/** Compare a selected report against a reference origin, always for the same calendar target. */
export function buildForecastComparison(current: ForecastExport, baseline: ForecastExport): ForecastExportComparison {
  if (current.options.originPeriod === baseline.options.originPeriod) throw new Error('กรุณาเลือกเดือนตั้งต้นสำหรับเปรียบเทียบคนละเดือน');
  if (current.options.areaCode !== baseline.options.areaCode || current.options.irrigation !== baseline.options.irrigation) {
    throw new Error('เปรียบเทียบได้เฉพาะขอบเขตพื้นที่และตัวกรองชลประทานเดียวกัน');
  }
  if (stableMetadata(current.meta) !== stableMetadata(baseline.meta)) {
    throw new Error('ข้อมูลคนละรุ่นหรือข้อมูลกำกับชุดข้อมูลไม่ตรงกัน กรุณาเตรียมข้อมูลใหม่');
  }
  const baselineLocations = new Map(baseline.rows.map(row => [row.subdistrictCode, row]));
  if (baselineLocations.size !== baseline.rows.length || new Set(current.rows.map(row => row.subdistrictCode)).size !== current.rows.length
    || current.rows.length !== baseline.rows.length || current.rows.some(row => {
      const previous = baselineLocations.get(row.subdistrictCode);
      return !previous || row.provinceCode !== previous.provinceCode || row.districtCode !== previous.districtCode
        || irrigationStatusFromSource(row.irrigationStatus) !== irrigationStatusFromSource(previous.irrigationStatus);
    })) throw new Error('รหัสพื้นที่หรือสถานะชลประทานของสองรอบไม่ตรงกัน');
  const targets = current.targets.filter(target => baseline.targets.includes(target));
  if (!targets.length) throw new Error('สองเดือนตั้งต้นไม่มีเดือนพยากรณ์ร่วมกัน');
  const baselineRows = new Map(baseline.machineRows.map(row => [`${row.subdistrictCode}|${row.targetPeriod}`, row]));
  const rows: ForecastExportComparisonRow[] = current.machineRows.filter(row => targets.includes(row.targetPeriod)).map(row => {
    const previous = baselineRows.get(`${row.subdistrictCode}|${row.targetPeriod}`);
    if (!previous) throw new Error('ข้อมูลเปรียบเทียบไม่ครบตามรหัสพื้นที่และเดือนพยากรณ์');
    const riskDelta = row.forecastStatus === 'VALID' && previous.forecastStatus === 'VALID'
      && row.forecastRisk !== null && previous.forecastRisk !== null ? row.forecastRisk - previous.forecastRisk : null;
    return {
      provinceCode: row.provinceCode, districtCode: row.districtCode, districtNameTh: row.districtNameTh,
      subdistrictCode: row.subdistrictCode, subdistrictNameTh: row.subdistrictNameTh, irrigationStatus: row.irrigationStatus,
      targetPeriod: row.targetPeriod, baselineOriginPeriod: previous.originPeriod, currentOriginPeriod: row.originPeriod,
      baselineHorizon: previous.horizon, currentHorizon: row.horizon,
      baselineSourceId: previous.sourceId, currentSourceId: row.sourceId,
      baselineForecastRisk: previous.forecastRisk, currentForecastRisk: row.forecastRisk,
      baselineStatus: previous.forecastStatus, currentStatus: row.forecastStatus, riskDelta,
      comparisonStatus: riskDelta === null ? 'NOT_COMPARABLE' : riskDelta > 0 ? 'INCREASED' : riskDelta < 0 ? 'DECREASED' : 'UNCHANGED',
      baselineSourceVintageKey: previous.sourceVintageKey, currentSourceVintageKey: row.sourceVintageKey,
      baselineDatasetId: previous.datasetId, currentDatasetId: row.datasetId,
      baselineDatasetVersion: previous.datasetVersion, currentDatasetVersion: row.datasetVersion,
      baselineSourceWorkbookSha256: previous.sourceWorkbookSha256, currentSourceWorkbookSha256: row.sourceWorkbookSha256,
      exportVersion: current.exportVersion, exportedAt: current.exportedAt.toISOString(),
    };
  });
  return { baselineOriginPeriod: baseline.options.originPeriod, currentOriginPeriod: current.options.originPeriod,
    targets, rows, baselineMeta: structuredClone(baseline.meta), currentMeta: structuredClone(current.meta) };
}

export function withForecastExportComparison(current: ForecastExport, baseline: ForecastExport): ForecastExport {
  return { ...current, comparison: buildForecastComparison(current, baseline),
    filename: exportFilename(current.options, current.meta, current.exportedAt, baseline.options.originPeriod) };
}
