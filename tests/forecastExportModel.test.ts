import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildForecastComparison, buildForecastExport, forecastExportVersion, sameForecastExportData, withForecastExportComparison,
  type ExportRisk, type ForecastExport } from '../src/forecastExportModel';
import type { NakhonRatchasimaDroughtForecastArchive as Archive } from '../src/types';

const archive: Archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
const exportedAt = new Date('2026-09-09T10:30:00.123Z');
const options = { originPeriod: '2025-12', areaCode: '3003', irrigation: 'all' as const };
const current = buildForecastExport(archive, options, exportedAt);
const baseline = buildForecastExport(archive, { ...options, originPeriod: '2025-11' }, exportedAt);
const firstCode = current.rows[0].subdistrictCode;

function riskArchive(origin: string, risk: ExportRisk): Archive {
  const packed = Object.fromEntries(Object.entries(archive.packedRiskByTargetMonth[origin]).filter(([code]) => code !== firstCode));
  if (risk !== undefined) packed[firstCode] = [risk, risk, risk, risk, risk, risk];
  return { ...archive, packedRiskByTargetMonth: { ...archive.packedRiskByTargetMonth, [origin]: packed } };
}

describe('machine-readable forecast export model', () => {
  it('exports every administrative location and all six horizons with ISO calendar months and exact source evidence', () => {
    const province = buildForecastExport(archive, { ...options, areaCode: '30' }, exportedAt);
    expect(province.machineRows).toHaveLength(289 * 6);
    expect(new Set(province.machineRows.map(row => `${row.subdistrictCode}|${row.originPeriod}|${row.horizon}`)).size).toBe(289 * 6);
    for (const row of province.machineRows) {
      const sourceRisk = archive.packedRiskByTargetMonth[row.originPeriod][row.subdistrictCode][row.horizon - 1];
      expect(row.forecastRisk).toBe(sourceRisk);
      expect(row.forecastStatus).toBe(sourceRisk === null ? 'OUT_OF_SCOPE' : 'VALID');
      expect(row.originPeriod).toBe('2025-12');
      expect(row.targetPeriod).toBe(`2026-0${row.horizon}`);
      expect(Number.isInteger(row.horizon)).toBe(true);
      expect(row.sourceVintageKey).toBe(`${row.sourceId}|2025-12|T+${row.horizon}`);
      expect(row).toMatchObject({ sourceWorkbook: archive.meta.sourceWorkbookOriginal, sourceSheet: archive.meta.sourceSheet,
        sourceWorkbookSha256: archive.meta.sourceWorkbookSha256, normalizedManifestSha256: archive.meta.normalizedManifestSha256,
        datasetId: archive.meta.datasetId, datasetVersion: archive.meta.datasetVersion, provenance: 'REAL',
        exportedAt: exportedAt.toISOString(), exportVersion: forecastExportVersion, locationCount: 1 });
      for (const code of [row.provinceCode, row.districtCode, row.subdistrictCode, row.sourceId]) expect(typeof code).toBe('string');
    }
  });

  it.each([
    [0, 'VALID', 'No forecast risk signal'],
    [1, 'VALID', 'Moderate risk'],
    [2, 'VALID', 'High risk'],
    [null, 'OUT_OF_SCOPE', 'Out of study scope'],
    [undefined, 'MISSING', 'Missing data'],
  ] as const)('represents risk %s with a separate %s status without coercing blanks to zero', (risk, status, label) => {
    const report = buildForecastExport(riskArchive(options.originPeriod, risk), options, exportedAt);
    const rows = report.machineRows.filter(row => row.subdistrictCode === firstCode);
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row).toMatchObject({ forecastRisk: risk ?? null, forecastStatus: status, riskLabelEn: label });
  });

  it('preserves text identifiers, correction flags and irrigation independently from risk', () => {
    const changed = { ...archive, locations: archive.locations.map(row => row.subdistrictCode === firstCode
      ? { ...row, sourceId: '0005', sourceAdminCorrectionApplied: true, irrigationStatus: 'irragation' } : row) };
    const row = buildForecastExport(changed, options, exportedAt).machineRows[0];
    expect(row).toMatchObject({ sourceId: '0005', sourceAdminCorrectionApplied: true, irrigationStatus: 'irrigated', sourceVintageKey: '0005|2025-12|T+1' });
  });

  it('snapshots provenance, selections and export time so later caller mutations cannot relabel a prepared report', () => {
    const input = { ...archive, meta: structuredClone(archive.meta), mapping: structuredClone(archive.mapping) };
    const selection = { ...options };
    const date = new Date(exportedAt);
    const report = buildForecastExport(input, selection, date);
    input.meta.datasetVersion = 'changed-after-preparation';
    input.meta.temporalInterpretationEvidence.push('new evidence');
    input.mapping.sourceCorrections.push({ unexpected: 'new correction' });
    selection.originPeriod = '2025-10';
    date.setUTCFullYear(2030);
    expect(report.meta).toEqual(archive.meta);
    expect(report.corrections).toEqual(archive.mapping.sourceCorrections);
    expect(report.options).toEqual(options);
    expect(report.exportedAt).toEqual(exportedAt);
    expect(report.machineRows[0].datasetVersion).toBe(archive.meta.datasetVersion);
  });

  it('identifies the data revision, format version and millisecond export timestamp in a filesystem-safe filename', () => {
    expect(current.filename).toMatch(/^Korat_Drought_2025-12_3003_all_T1-T6_data-/);
    expect(current.filename).toContain(archive.meta.datasetVersion);
    expect(current.filename).toContain(`_v${forecastExportVersion}_20260909T103000123Z.xlsx`);
    const unsafe = { ...archive, meta: { ...archive.meta, datasetVersion: '../ฉบับใหม่/\\bad\n'.repeat(30) } };
    const filename = buildForecastExport(unsafe, options, exportedAt).filename;
    expect(filename).not.toMatch(/[\\/\n\r:]/);
    expect(filename).toMatch(/^[a-zA-Z0-9_.-]+$/);
    expect(filename.length).toBeLessThan(200);
    expect(buildForecastExport(archive, options, new Date(exportedAt.getTime() + 1)).filename).not.toBe(current.filename);
    expect(() => buildForecastExport(archive, options, new Date('invalid'))).toThrow('เวลาส่งออก');
  });

  it('rejects invalid months, sparse risk vectors and malformed present records instead of inventing values', () => {
    expect(() => buildForecastExport(archive, { ...options, originPeriod: '2025-13' })).toThrow('เดือนตั้งต้น');
    const sparse = new Array(6) as Array<0 | 1 | 2 | null>;
    const invalid = { ...archive, packedRiskByTargetMonth: { ...archive.packedRiskByTargetMonth,
      [options.originPeriod]: { ...archive.packedRiskByTargetMonth[options.originPeriod], [firstCode]: sparse } } };
    expect(() => buildForecastExport(invalid, options)).toThrow('ไม่ตรงนิยาม');
    expect(() => buildForecastExport({ ...invalid, packedRiskByTargetMonth: { [options.originPeriod]: { [firstCode]: null } } } as unknown as Archive, options)).toThrow('ไม่ตรงนิยาม');
  });

  it('documents every exported machine/comparison column with bilingual business definitions and consistent value types', () => {
    const comparison = buildForecastComparison(current, baseline);
    for (const [table, row] of [['machineRows', current.machineRows[0]], ['comparisonRows', comparison.rows[0]]] as const) {
      const definitions = current.dictionary.filter(item => item.table === table);
      expect(definitions.map(item => item.field)).toEqual(Object.keys(row));
      expect(new Set(definitions.map(item => item.field)).size).toBe(definitions.length);
      for (const definition of definitions) {
        for (const text of [definition.labelTh, definition.labelEn, definition.businessDescriptionTh,
          definition.businessDescriptionEn, definition.unit, definition.blankMeaningTh, definition.blankMeaningEn]) expect(text.trim().length).toBeGreaterThan(0);
        expect(['M', 'C', 'O']).toContain(definition.mandatory);
        expect(typeof definition.nullable).toBe('boolean');
        const value = row[definition.field as keyof typeof row];
        if (value === null) expect(definition.nullable).toBe(true);
        else expect(typeof value).toBe(definition.type === 'integer' ? 'number' : definition.type);
        expect(definition.sampleValue).not.toBeUndefined();
      }
    }
    expect(current.dictionary.find(item => item.field === 'forecastRisk')).toMatchObject({ type: 'integer', nullable: true, mandatory: 'C' });
    expect(current.dictionary.find(item => item.field === 'riskDelta')?.businessDescriptionEn).toContain('not a change in probability');
  });
});

describe('same-target origin comparison', () => {
  it('aligns by administrative code and target month regardless of row order, not by source ID or equal horizon', () => {
    const shuffled = { ...baseline, rows: [...baseline.rows].reverse(), machineRows: [...baseline.machineRows].reverse() };
    const comparison = buildForecastComparison(current, shuffled);
    expect(comparison.targets).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']);
    expect(comparison.rows).toHaveLength(6 * 5);
    for (const row of comparison.rows) {
      expect(row.baselineHorizon).toBe(row.currentHorizon + 1);
      expect(row.currentForecastRisk).toBe(archive.packedRiskByTargetMonth['2025-12'][row.subdistrictCode][row.currentHorizon - 1]);
      expect(row.baselineForecastRisk).toBe(archive.packedRiskByTargetMonth['2025-11'][row.subdistrictCode][row.baselineHorizon - 1]);
      expect(row.baselineSourceVintageKey).toBe(`${row.baselineSourceId}|2025-11|T+${row.baselineHorizon}`);
      expect(row.currentSourceVintageKey).toBe(`${row.currentSourceId}|2025-12|T+${row.currentHorizon}`);
    }
  });

  it.each([
    [0, 2, 2, 'INCREASED'], [2, 0, -2, 'DECREASED'], [0, 0, 0, 'UNCHANGED'],
    [null, 0, null, 'NOT_COMPARABLE'], [0, null, null, 'NOT_COMPARABLE'],
    [undefined, 2, null, 'NOT_COMPARABLE'], [2, undefined, null, 'NOT_COMPARABLE'],
    [null, undefined, null, 'NOT_COMPARABLE'], [undefined, null, null, 'NOT_COMPARABLE'],
    [null, null, null, 'NOT_COMPARABLE'], [undefined, undefined, null, 'NOT_COMPARABLE'],
  ] as const)('compares reference %s and selected %s as %s with %s result', (before, after, delta, status) => {
    const reference = buildForecastExport(riskArchive('2025-11', before), { ...options, originPeriod: '2025-11' }, exportedAt);
    const selected = buildForecastExport(riskArchive('2025-12', after), options, exportedAt);
    const row = buildForecastComparison(selected, reference).rows.find(row => row.subdistrictCode === firstCode)!;
    expect(row).toMatchObject({ baselineForecastRisk: before ?? null, currentForecastRisk: after ?? null,
      baselineStatus: before === undefined ? 'MISSING' : before === null ? 'OUT_OF_SCOPE' : 'VALID',
      currentStatus: after === undefined ? 'MISSING' : after === null ? 'OUT_OF_SCOPE' : 'VALID',
      riskDelta: delta, comparisonStatus: status });
  });

  it('attaches the optional comparison without changing either report and retains both complete provenance snapshots', () => {
    const report = withForecastExportComparison(current, baseline);
    expect(current.comparison).toBeUndefined();
    expect(baseline.comparison).toBeUndefined();
    expect(report.comparison).toMatchObject({ baselineOriginPeriod: '2025-11', currentOriginPeriod: '2025-12',
      baselineMeta: baseline.meta, currentMeta: current.meta });
    expect(report.comparison!.baselineMeta).not.toBe(baseline.meta);
    expect(report.comparison!.currentMeta).not.toBe(current.meta);
    expect(report.filename).toContain('_vs_2025-11_');
    expect(report.machineRows).toBe(current.machineRows);
  });

  it.each(['datasetId', 'datasetVersion', 'sourceWorkbookSha256', 'normalizedManifestSha256', 'targetMonthEnd', 'generatedAt'] as const)(
    'rejects reports with a different %s even when the target months overlap', key => {
      const changed = { ...baseline, meta: { ...baseline.meta, [key]: 'different' } };
      expect(() => buildForecastComparison(current, changed)).toThrow('ข้อมูลคนละรุ่น');
    });

  it('compares all metadata including new fields while ignoring object property order', () => {
    const reordered = { ...baseline, meta: Object.fromEntries(Object.entries(baseline.meta).reverse()) as Archive['meta'] };
    expect(buildForecastComparison(current, reordered).rows).toHaveLength(30);
    const extra = { ...baseline, meta: { ...baseline.meta, newRevisionField: 'changed' } };
    expect(() => buildForecastComparison(current, extra)).toThrow('ข้อมูลคนละรุ่น');
    const evidence = { ...baseline, meta: { ...baseline.meta, temporalInterpretationEvidence: ['different evidence'] } };
    expect(() => buildForecastComparison(current, evidence)).toThrow('ข้อมูลคนละรุ่น');
  });

  it('rejects different selections, absent/duplicate administrative keys and changed irrigation metadata', () => {
    const incompatible: ForecastExport[] = [
      { ...baseline, options: { ...baseline.options, areaCode: '30' } },
      { ...baseline, options: { ...baseline.options, irrigation: 'rainfed' } },
      { ...baseline, rows: baseline.rows.slice(1) },
      { ...baseline, rows: baseline.rows.map((row, index) => index === 0 ? baseline.rows[1] : row) },
      { ...baseline, rows: baseline.rows.map((row, index) => index === 0 ? { ...row, subdistrictCode: '300101' } : row) },
      { ...baseline, rows: baseline.rows.map((row, index) => index === 0 ? { ...row, districtCode: '3099' } : row) },
      { ...baseline, rows: baseline.rows.map((row, index) => index === 0 ? { ...row, irrigationStatus: row.irrigationStatus.toLowerCase() === 'rainfed' ? 'Irrigation' : 'Rainfed' } : row) },
    ];
    for (const report of incompatible) expect(() => buildForecastComparison(current, report)).toThrow();
  });

  it('rejects the same origin or non-overlapping calendars and can compare against a later reference origin', () => {
    expect(() => buildForecastComparison(current, current)).toThrow('คนละเดือน');
    const noOverlap = buildForecastExport(archive, { ...options, originPeriod: '2025-06' }, exportedAt);
    expect(() => buildForecastComparison(current, noOverlap)).toThrow('ไม่มีเดือนพยากรณ์ร่วมกัน');
    const reversed = buildForecastComparison(baseline, current);
    expect(reversed.targets).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']);
    expect(reversed.rows[0].currentHorizon).toBe(reversed.rows[0].baselineHorizon + 1);
  });
});

describe('prepared forecast data identity', () => {
  it('treats MISSING and OUT_OF_SCOPE as different data even though both serialize their numeric value as null', () => {
    const missing = buildForecastExport(riskArchive('2025-12', undefined), options, exportedAt);
    const outOfScope = buildForecastExport(riskArchive('2025-12', null), options, exportedAt);
    expect(JSON.stringify(missing.rows)).toBe(JSON.stringify(outOfScope.rows));
    expect(sameForecastExportData(missing, outOfScope)).toBe(false);
    expect(sameForecastExportData(outOfScope, missing)).toBe(false);
    expect(sameForecastExportData(withForecastExportComparison(missing, baseline), withForecastExportComparison(outOfScope, baseline))).toBe(false);
  });

  it('ignores export timestamp changes including comparison records while retaining forecast and source integrity', () => {
    const later = buildForecastExport(archive, options, new Date(exportedAt.getTime() + 30_000));
    expect(current.filename).not.toBe(later.filename);
    expect(sameForecastExportData(current, later)).toBe(true);
    const before = withForecastExportComparison(current, baseline);
    const after = withForecastExportComparison(later, buildForecastExport(archive, baseline.options, later.exportedAt));
    expect(before.comparison!.rows[0].exportedAt).not.toBe(after.comparison!.rows[0].exportedAt);
    expect(sameForecastExportData(before, after)).toBe(true);
    expect(sameForecastExportData(current, before)).toBe(false);
    expect(sameForecastExportData(current, { ...later, meta: { ...later.meta, datasetVersion: 'new-revision' } })).toBe(false);
    expect(sameForecastExportData(current, { ...later, machineRows: later.machineRows.map((row, index) => index === 0
      ? { ...row, sourceWorkbookSha256: 'different-source' } : row) })).toBe(false);
  });

  it('ignores object key/record order and rejects changed filters, source corrections and reference origin', () => {
    expect(sameForecastExportData(current, { ...current, meta: Object.fromEntries(Object.entries(current.meta).reverse()) as Archive['meta'],
      rows: [...current.rows].reverse(), machineRows: [...current.machineRows].reverse() })).toBe(true);
    expect(sameForecastExportData(current, { ...current, options: { ...options, irrigation: 'rainfed' } })).toBe(false);
    expect(sameForecastExportData(current, { ...current, corrections: [...current.corrections, { sourceId: '0', reason: 'reviewed correction' }] })).toBe(false);
    const first = withForecastExportComparison(current, baseline);
    const second = withForecastExportComparison(current, buildForecastExport(archive, { ...options, originPeriod: '2025-10' }, exportedAt));
    expect(sameForecastExportData(first, second)).toBe(false);
  });
});
