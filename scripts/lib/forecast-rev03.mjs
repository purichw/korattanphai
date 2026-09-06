import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

export const rev03 = Object.freeze({
  project: 'dihchjflzhcekywarhxd',
  datasetId: 'a3be4448-6c8e-4039-b574-4674e261ee9b',
  version: 'drought-rev03-a3be44486c8e',
  source: 'Drought_T1-6_rev03.xlsx',
  sourceSha: 'a3be44486c8e8039f5744674e261ee9b27306f0c78b46bd1ce62e8903d4915b4',
  normalizedDirectory: 'data/normalized/drought-rev03',
  runtimePath: 'src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json',
});
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const nameKey = (name) => name.toLowerCase().replace(/^(tambon|amphoe) /, '').replace(/[^a-z0-9]/g, '');
const districtAliases = { chaloemphrakiet: 'chaleomphrakiat', lamtamanchai: 'lamthamenchai' };
const districtKey = (name) => districtAliases[nameKey(name)] ?? nameKey(name);
// English labels disagree with the Thai labels at these codes in the existing
// GeoJSON. Check the Thai administrative master before using reviewed labels.
export const geometryLabelReviews = {
  '300101': ['ในเมือง', 'Nai Mueang'],
  '300113': ['บ้านใหม่', 'Ban Mai'],
  '301811': ['กุดจิก', 'Kut Chik'],
  '302401': ['โนนแดง', 'Non Daeng'],
  '302405': ['ดอนยาวใหญ่', 'Don Yao Yai'],
};
const monthsTh = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export function shiftPeriod(period, horizon) {
  assert.match(period, /^\d{4}-(0[1-9]|1[0-2])$/);
  assert.ok(Number.isInteger(horizon) && horizon >= 1 && horizon <= 6);
  const [y, m] = period.split('-').map(Number);
  const index = y * 12 + m - 1 + horizon;
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
}
const monthLabel = (period) => {
  const [year, month] = period.split('-').map(Number);
  return `${monthsTh[month - 1]} ${year + 543}`;
};

export async function readRev03Inputs() {
  const directory = rev03.normalizedDirectory;
  const manifestBytes = await fs.readFile(`${directory}/manifest.json`);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.source_sha256, rev03.sourceSha);
  for (const [name, expected] of Object.entries(manifest.files)) {
    const bytes = await fs.readFile(`${directory}/${name}`);
    assert.equal(bytes.length, expected.bytes, `Size mismatch: ${name}`);
    assert.equal(sha256(bytes), expected.sha256, `Hash mismatch: ${name}`);
  }
  return {
    source: JSON.parse(await fs.readFile(`${directory}/forecast_archive.json`)),
    quality: JSON.parse(await fs.readFile(`${directory}/data_quality.json`)),
    manifest, manifestSha: sha256(manifestBytes),
    admin: JSON.parse(await fs.readFile('src/data/canonical/nakhon_ratchasima/admin_hierarchy.json')),
    geometry: JSON.parse(await fs.readFile('public/geodata/nakhon-ratchasima-subdistricts.geojson')),
  };
}

export function buildRev03Archive({ source, quality, manifest, manifestSha, admin, geometry }) {
  assert.equal(source.meta.source_sha256, rev03.sourceSha);
  const adminByCode = new Map(admin.province.districts.flatMap((district) =>
    district.subdistricts.map((subdistrict) => [subdistrict.subdistrictCode, { district, subdistrict }])));
  assert.equal(adminByCode.size, 289);
  const candidates = new Map();
  const labelReviews = [];
  for (const feature of geometry.features) {
    const p = feature.properties;
    const area = adminByCode.get(p.Admin_code);
    assert.ok(area, `Unknown geometry code: ${p.Admin_code}`);
    assert.equal(p.T_Name_T.replace(/^ตำบล/, ''), area.subdistrict.nameTh);
    let english = p.T_Name_E;
    const review = geometryLabelReviews[p.Admin_code];
    if (review) {
      assert.equal(area.subdistrict.nameTh, review[0]);
      labelReviews.push({ subdistrictCode: p.Admin_code, sourceLabel: english, reviewedLabel: review[1], evidence: `Thai geometry label and administrative master: ${review[0]}` });
      english = review[1];
    }
    const key = `${districtKey(p.A_Name_E)}|${nameKey(english)}`;
    assert.ok(!candidates.has(key), `Ambiguous geometry identity: ${key}`);
    candidates.set(key, area);
  }
  const locations = source.locations.map((location) => {
    const corrected = location.source_id === '222' ? 'Phimai' : location.source_amphoe_en;
    if (location.source_id === '222') {
      assert.equal(location.source_tambon_en, 'Nong Rawiang');
      assert.equal(location.source_amphoe_en, 'Mueang Nakhon Ratchasima');
    }
    const key = `${districtKey(corrected)}|${nameKey(location.source_tambon_en)}`;
    const area = candidates.get(key);
    assert.ok(area, `Unmapped source ID ${location.source_id}: ${key}`);
    const { district, subdistrict } = area;
    return {
      sourceId: location.source_id,
      sourceAreaKey: `${location.source_amphoe_en}|${location.source_tambon_en}`,
      sourceTambonEn: location.source_tambon_en, sourceAmphoeEn: location.source_amphoe_en,
      sourceAmphoeEnCorrected: corrected,
      sourceAdminCorrectionApplied: location.source_id === '222',
      irrigationStatusRaw: location.irrigation_status_raw, irrigationStatus: location.irrigation_status,
      provinceId: 'TH-P29', provinceCode: '30', provinceNameTh: 'นครราชสีมา', provinceNameEn: 'Nakhon Ratchasima',
      districtCode: district.districtCode, districtId: district.id, districtNameTh: district.nameTh,
      districtNameEn: district.name, districtSlug: district.routingSlug,
      subdistrictCode: subdistrict.subdistrictCode, subdistrictId: subdistrict.id,
      subdistrictNameTh: subdistrict.nameTh, subdistrictSlug: subdistrict.routingSlug,
      matchStatus: 'MATCHED', matchMethod: 'REV03_DISTRICT_AND_TAMBON_REVIEWED_ADMIN_CODE',
      qualityFlags: location.source_id === '222' ? 'USER_CONFIRMED_DISTRICT_2026_09_06' : '',
    };
  });
  assert.equal(new Set(locations.map((l) => l.sourceId)).size, 289);
  assert.equal(new Set(locations.map((l) => l.subdistrictCode)).size, 289);
  const packed = Object.fromEntries(source.sourceMonths.map((period) => [period, Object.fromEntries(locations.map((l) => {
    const risks = source.packedRiskBySourceMonth[period][l.sourceId];
    assert.ok(Array.isArray(risks) && risks.length === 6 && risks.every((v) => v === null || v === 0 || v === 1 || v === 2));
    return [l.subdistrictCode, [...risks]];
  }))]));
  const targetMonths = source.sourceMonths.map((period) => ({
    period, labelTh: monthLabel(period),
    horizons: Array.from({ length: 6 }, (_, i) => {
      const horizon = i + 1;
      const risks = Object.values(packed[period]).map((values) => values[i]);
      return {
        horizon, horizonLabel: `T+${horizon}`, issueMonth: period, targetMonth: shiftPeriod(period, horizon),
        vintageCount: risks.length, inScopeSubdistricts: risks.filter((r) => r !== null).length,
        outOfScopeSubdistricts: risks.filter((r) => r === null).length,
        noRiskSubdistricts: risks.filter((r) => r === 0).length,
        moderateRiskSubdistricts: risks.filter((r) => r === 1).length,
        highRiskSubdistricts: risks.filter((r) => r === 2).length,
      };
    }),
  }));
  return {
    meta: {
      sourceOfTruth: 'normalized_rev03_original_workbook', sourceWorkbook: rev03.source,
      sourceWorkbookOriginal: rev03.source, sourceWorkbookSha256: rev03.sourceSha,
      normalizedManifestSha256: manifestSha, datasetId: rev03.datasetId, datasetVersion: rev03.version,
      sourceSheet: manifest.source_sheet, locationSheet: manifest.source_sheet,
      generatedAt: '2026-09-06', timezone: 'Asia/Bangkok',
      provinceId: 'TH-P29', provinceCode: '30', provinceNameTh: 'นครราชสีมา', provinceNameEn: 'Nakhon Ratchasima',
      provenance: 'REAL', semanticsTh: 'เดือนใน Excel คือเดือนตั้งต้น T; T+1 ถึง T+6 คือหนึ่งถึงหกเดือนถัดไป',
      sourceRowCountOriginal: quality.source_rows, sourceRowCountDeduped: quality.exact_unique_rows,
      duplicateSourceRowsRemoved: quality.exact_duplicates_removed, sourceIdCount: locations.length,
      targetMonthCount: targetMonths.length, horizonCount: 6, forecastVintageCount: quality.forecast_value_count,
      sourceVintageKeyCount: quality.forecast_value_count, forecastVintageIdentity: 'sourceId + sourceMonth + horizon',
      totalCanonicalSubdistricts: adminByCode.size, periodStart: quality.source_month_start, periodEnd: quality.source_month_end,
      targetMonthStart: quality.source_month_start, targetMonthEnd: quality.source_month_end,
      issueMonthStart: quality.source_month_start, issueMonthEnd: quality.source_month_end,
      forecastTargetMonthStart: quality.target_month_start, forecastTargetMonthEnd: quality.target_month_end,
      temporalInterpretation: 'SOURCE_YEARMONTH_IS_ORIGIN_MONTH',
      targetMonthRule: 'source_month + horizon_months', issueMonthRule: 'source_month',
      temporalInterpretationEvidence: ['User confirmed 2026-09-06: December 2025 T+1 is January 2026; T+6 is June 2026.'],
      legacyFieldNames: 'targetMonths / packedRiskByTargetMonth keys are origin months for existing UI/URL compatibility',
      lineageFileSha256: manifest.files['source_row_lineage.csv'].sha256,
    },
    riskSemantics: [0, 1, 2, null].map((risk) => ({
      forecastRisk: risk, scopeStatus: risk === null ? 'out_of_scope' : 'in_scope',
      labelTh: manifest.risk_labels_th[String(risk)],
      mapStatus: risk === null ? 'forecast-out-of-scope' : ['forecast-no-risk', 'forecast-moderate', 'forecast-high'][risk],
    })),
    mapping: {
      sourceIdCount: 289, mappedSourceIdCount: 289, mappedCanonicalSubdistrictCount: 289,
      duplicateSourceIds: [], unmappedSourceIds: [], unmatchedSources: [], ambiguousSourceIds: [], ambiguousSources: [],
      duplicateCanonicalSubdistrictCodes: [],
      sourceCorrections: [{ sourceId: '222', sourceAmphoeEnOriginal: 'Mueang Nakhon Ratchasima', sourceAmphoeEnCorrected: 'Phimai', subdistrictCode: '301512', evidence: 'User confirmed 2026-09-06; original normalized workbook fields remain unchanged.' }],
      geodataLabelOverrides: labelReviews,
    },
    locations, targetMonths,
    horizonSummary: Array.from({ length: 6 }, (_, i) => {
      const horizons = targetMonths.map((month) => month.horizons[i]);
      const sum = (field) => horizons.reduce((n, h) => n + h[field], 0);
      return { horizon: i + 1, horizonLabel: `T+${i + 1}`, vintageCount: sum('vintageCount'),
        inScopeVintages: sum('inScopeSubdistricts'), outOfScopeVintages: sum('outOfScopeSubdistricts'),
        noRiskVintages: sum('noRiskSubdistricts'), moderateRiskVintages: sum('moderateRiskSubdistricts'), highRiskVintages: sum('highRiskSubdistricts') };
    }),
    validationExamples: {}, packedRiskByTargetMonth: packed,
  };
}
