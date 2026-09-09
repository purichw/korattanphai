import type { ForecastExportComparisonRow, ForecastExportMachineRow } from './forecastExportModel';

export type ForecastExportFieldDefinition = {
  table: 'machineRows' | 'comparisonRows';
  field: string;
  labelTh: string;
  labelEn: string;
  businessDescriptionTh: string;
  businessDescriptionEn: string;
  type: 'string' | 'integer' | 'boolean';
  mandatory: 'M' | 'C' | 'O';
  nullable: boolean;
  unit: string;
  sampleValue: string | number | boolean | null;
  blankMeaningTh: string;
  blankMeaningEn: string;
};

type Meaning = Omit<ForecastExportFieldDefinition, 'table' | 'field'>;
function field(labelTh: string, labelEn: string, businessDescriptionTh: string, businessDescriptionEn: string,
  sampleValue: Meaning['sampleValue'], options: Partial<Meaning> = {}): Meaning {
  return { labelTh, labelEn, businessDescriptionTh, businessDescriptionEn, type: 'string', mandatory: 'M', nullable: false,
    unit: '—', sampleValue, blankMeaningTh: 'ต้องมีค่า; ช่องว่างถือว่าข้อมูลไม่ครบ',
    blankMeaningEn: 'Required; a blank indicates incomplete data.', ...options };
}

const machine: Record<keyof ForecastExportMachineRow, Meaning> = {
  provinceCode: field('รหัสจังหวัด', 'Province code', 'รหัสปกครองจังหวัด ใช้เชื่อมข้อมูลโดยเก็บเป็นข้อความ',
    'Administrative province code, stored as text for joining records.', '30'),
  provinceNameTh: field('ชื่อจังหวัด', 'Province name in Thai', 'ชื่อจังหวัดสำหรับอ่านประกอบ ไม่ใช้เป็นกุญแจเชื่อมข้อมูล',
    'Readable Thai province name; use the code when joining records.', 'นครราชสีมา'),
  districtCode: field('รหัสอำเภอ', 'District code', 'รหัสปกครองอำเภอ ใช้เชื่อมข้อมูลแทนชื่ออำเภอ',
    'Administrative district code used to join records independently of name spelling.', '3001'),
  districtNameTh: field('ชื่ออำเภอ', 'District name in Thai', 'ชื่ออำเภอภาษาไทยตามรหัสพื้นที่ที่ตรวจแล้ว',
    'Thai district name associated with the reviewed administrative code.', 'เมืองนครราชสีมา'),
  subdistrictCode: field('รหัสตำบล', 'Subdistrict code', 'รหัสปกครองตำบล เป็นกุญแจพื้นที่หลักในการเทียบสองรอบพยากรณ์',
    'Administrative subdistrict code; the location key used to align forecast origins.', '300101'),
  subdistrictNameTh: field('ชื่อตำบล', 'Subdistrict name in Thai', 'ชื่อตำบลภาษาไทยเพื่อให้อ่านเข้าใจ ใช้รหัสตำบลเมื่อเชื่อมข้อมูล',
    'Readable Thai subdistrict name; join records using the subdistrict code.', 'ในเมือง'),
  sourceId: field('รหัสแถวพื้นที่ต้นทาง', 'Source location ID', 'รหัสพื้นที่จากไฟล์ต้นฉบับ เก็บเป็นข้อความและไม่ใช่รหัสปกครอง',
    'Location identifier in the source workbook, stored as text; it is not an administrative code.', '0'),
  irrigationStatus: field('สถานะชลประทาน', 'Irrigation status', 'สถานะพื้นที่ที่ปรับคำแล้ว: irrigated เข้าถึงชลประทาน, rainfed พึ่งน้ำฝน, unknown ยังไม่ทราบ; ไม่ใช่ระดับภัย',
    'Normalized availability: irrigated, rainfed or unknown. This describes the location, not its forecast risk.', 'unknown'),
  originPeriod: field('เดือนตั้งต้น T', 'Forecast origin month', 'เดือนตั้งต้นจาก Excel ในรูป ค.ศ. YYYY-MM; ไม่ใช่เดือนที่เกิดภัยหรือเวลาส่งออก',
    'Source forecast origin T as Gregorian YYYY-MM; not the target month or export time.', '2025-12', { unit: 'Gregorian YYYY-MM' }),
  targetPeriod: field('เดือนที่พยากรณ์', 'Forecast target month', 'เดือนที่ค่าพยากรณ์กล่าวถึง เท่ากับเดือนตั้งต้นบวกระยะล่วงหน้า',
    'Calendar month being predicted: origin month plus the horizon in months.', '2026-01', { unit: 'Gregorian YYYY-MM' }),
  horizon: field('ระยะล่วงหน้า', 'Forecast horizon', 'จำนวนเดือนหลังเดือนตั้งต้น 1 ถึง 6; เลข 1 หมายถึง T+1',
    'Whole months after the origin, from 1 to 6; 1 means T+1.', 1, { type: 'integer', unit: 'month / เดือน' }),
  forecastRisk: field('รหัสระดับความเสี่ยง', 'Forecast risk code', 'รหัสจากแบบจำลอง: 0 ไม่พบสัญญาณเสี่ยง, 1 ปานกลาง, 2 สูง; เป็นหมวดเรียงลำดับ ไม่ใช่เปอร์เซ็นต์หรือปริมาณความเสียหาย',
    'Model category: 0 no risk signal, 1 moderate, 2 high. An ordinal class, not a probability or damage amount.', 1,
    { type: 'integer', mandatory: 'C', nullable: true, unit: 'ordinal class 0/1/2',
      blankMeaningTh: 'null เมื่อ forecastStatus เป็น OUT_OF_SCOPE หรือ MISSING; ต้องอ่านสถานะแยก ห้ามแทนด้วย 0',
      blankMeaningEn: 'Null for OUT_OF_SCOPE or MISSING; read the separate status and never substitute zero.' }),
  forecastStatus: field('สถานะค่าพยากรณ์', 'Forecast value status', 'VALID มีตัวเลข 0/1/2; OUT_OF_SCOPE คือช่องว่างต้นฉบับที่อยู่นอกขอบเขตศึกษา; MISSING คือไม่พบระเบียนพื้นที่ในเดือนตั้งต้น',
    'VALID has a 0/1/2 value; OUT_OF_SCOPE is an original study-scope blank; MISSING means the source location record is absent for this origin.', 'VALID'),
  riskLabelTh: field('คำอธิบายความเสี่ยงไทย', 'Risk label in Thai', 'ข้อความอ่านง่ายของค่าความเสี่ยงหรือเหตุที่ไม่มีตัวเลข',
    'Thai description of the risk category or the reason a numeric value is unavailable.', 'เสี่ยงปานกลาง'),
  riskLabelEn: field('คำอธิบายความเสี่ยงอังกฤษ', 'Risk label in English', 'คำอธิบายภาษาอังกฤษที่ตรงกับสถานะและค่าความเสี่ยง',
    'English description corresponding to the risk value and status.', 'Moderate risk'),
  locationCount: field('จำนวนตำบลต่อระเบียน', 'Location count per record', 'ค่า 1 สำหรับนับตำบลภายในเดือนพยากรณ์หนึ่งเดือน; รวมข้ามเดือนได้จำนวนตำบล-เดือน ไม่ใช่ตำบลไม่ซ้ำ',
    'One location per row. Sum within one target month to count subdistricts; across months the sum counts location-months, not distinct places.', 1,
    { type: 'integer', unit: 'location-month / ตำบล-เดือน' }),
  sourceVintageKey: field('กุญแจตรวจย้อนกลับ', 'Source forecast vintage key', 'ประกอบรหัสต้นทาง เดือนตั้งต้น และ T+ระยะ เพื่อค้นค่ากลับไปยังต้นฉบับ; ใช้คู่กับรุ่นชุดข้อมูล',
    'Source ID, origin month and T+horizon identify a source forecast; use with the dataset revision.', '0|2025-12|T+1'),
  sourceAreaKey: field('ชื่อพื้นที่ในต้นทาง', 'Source area key', 'ข้อความอำเภอและตำบลจากต้นฉบับสำหรับตรวจย้อนกลับ ไม่ใช้แทนรหัสปกครอง',
    'Source district and subdistrict text retained for traceability; not a replacement for administrative codes.', 'Mueang Nakhon Ratchasima|Nai Mueang'),
  sourceAdminCorrectionApplied: field('มีการแก้การจับคู่พื้นที่', 'Administrative correction applied', 'true เมื่อใช้การแก้ชื่ออำเภอจากต้นทางที่ตรวจแล้วก่อนจับคู่รหัสพื้นที่; false เมื่อไม่ต้องแก้',
    'True when a reviewed correction to the source district was used for administrative mapping; false otherwise.', false, { type: 'boolean' }),
  sourceWorkbook: field('ไฟล์ต้นฉบับ', 'Original source workbook', 'ชื่อไฟล์ต้นฉบับที่เป็นหลักฐานของชุดข้อมูล ไม่ใช่ชื่อไฟล์ที่กำลังส่งออก',
    'Name of the original workbook that supplies the evidence, not this exported file.', 'Drought_T1-6_rev03.xlsx'),
  sourceSheet: field('ชีตต้นทาง', 'Source worksheet', 'ชื่อชีตในไฟล์ต้นฉบับที่เก็บผลพยากรณ์',
    'Worksheet in the source workbook containing the forecast data.', 'Master_Data_Drought_Final'),
  sourceWorkbookSha256: field('ลายนิ้วมือไฟล์ต้นฉบับ', 'Source workbook SHA-256', 'รหัสตรวจความตรงกันของไฟล์ต้นฉบับ เปลี่ยนเมื่อเนื้อหาไฟล์เปลี่ยน',
    'SHA-256 fingerprint used to verify the exact source workbook bytes.', 'a3be44486c8e8039f5744674e261ee9b27306f0c78b46bd1ce62e8903d4915b4', { unit: 'SHA-256 hex' }),
  normalizedManifestSha256: field('ลายนิ้วมือบัญชีข้อมูลที่จัดรูปแบบ', 'Normalized manifest SHA-256', 'รหัสตรวจความตรงกันของบัญชีข้อมูลหลังจัดรูปแบบสำหรับระบบ',
    'SHA-256 fingerprint of the manifest describing the normalized dataset.', 'be910423f3384de067ccdb5ef08a33d6af15c35f7370127c1a4d47636cc74b57', { unit: 'SHA-256 hex' }),
  datasetId: field('รหัสชุดข้อมูล', 'Dataset ID', 'รหัสอ้างอิงชุดข้อมูล ใช้ร่วมกับรุ่นและลายนิ้วมือไฟล์เพื่อตรวจว่าอ้างข้อมูลเดียวกัน',
    'Dataset identifier, checked together with its version and source fingerprint.', 'a3be4448-6c8e-4039-b574-4674e261ee9b'),
  datasetVersion: field('รุ่นชุดข้อมูล', 'Dataset version', 'รุ่นของข้อมูลต้นทางที่ใช้สร้างรายงาน; สองรอบต้องใช้รุ่นเดียวกันจึงเปรียบเทียบได้',
    'Source dataset revision used for this report; both origins must use the same revision for comparison.', 'drought-rev03-a3be44486c8e'),
  provenance: field('ประเภทที่มาข้อมูล', 'Data provenance class', 'ประเภทหลักฐานที่ติดมากับชุดข้อมูล เช่น REAL หมายถึงข้อมูลอ้างอิงจากแหล่งจริง ไม่ได้ยืนยันว่าพยากรณ์จะเกิดขึ้นจริง',
    'Dataset evidence classification, such as REAL for source-backed data; it does not guarantee a forecast will occur.', 'REAL'),
  exportVersion: field('รุ่นรูปแบบรายงาน', 'Export format version', 'รุ่นโครงสร้างไฟล์ส่งออก แยกจากรุ่นข้อมูล เพื่อให้ระบบปลายทางเลือกวิธีอ่านได้',
    'Export schema version, separate from the dataset revision, so consumers can choose the correct parser.', '2.0.0'),
  exportedAt: field('เวลาสร้างรายงาน', 'Report export time', 'เวลาสร้างรายงานใน UTC แบบ ISO 8601; ไม่ใช่เวลาเก็บข้อมูลหรือเวลารันโมเดล',
    'Report creation time in ISO 8601 UTC; not observation time or model execution time.', '2026-09-09T10:30:00.000Z', { unit: 'ISO 8601 UTC' }),
};

function side(meaning: Meaning, which: 'baseline' | 'current'): Meaning {
  const th = which === 'baseline' ? 'รอบอ้างอิง' : 'รอบที่เลือก';
  const en = which === 'baseline' ? 'Reference origin' : 'Selected origin';
  return { ...meaning, labelTh: `${meaning.labelTh} — ${th}`, labelEn: `${meaning.labelEn} — ${en}`,
    businessDescriptionTh: `${th}: ${meaning.businessDescriptionTh}`, businessDescriptionEn: `${en}: ${meaning.businessDescriptionEn}` };
}

const comparison: Record<keyof ForecastExportComparisonRow, Meaning> = {
  provinceCode: machine.provinceCode,
  districtCode: machine.districtCode,
  districtNameTh: machine.districtNameTh,
  subdistrictCode: machine.subdistrictCode,
  subdistrictNameTh: machine.subdistrictNameTh,
  irrigationStatus: machine.irrigationStatus,
  targetPeriod: { ...machine.targetPeriod, businessDescriptionTh: 'เดือนพยากรณ์เดียวกันที่ปรากฏในทั้งสองรอบ จับคู่ด้วยรหัสตำบลและเดือนนี้',
    businessDescriptionEn: 'The same target month available in both origins; rows align on this month and the administrative subdistrict code.' },
  baselineOriginPeriod: { ...side(machine.originPeriod, 'baseline'), sampleValue: '2025-11' },
  currentOriginPeriod: side(machine.originPeriod, 'current'),
  baselineHorizon: { ...side(machine.horizon, 'baseline'), sampleValue: 2 },
  currentHorizon: side(machine.horizon, 'current'),
  baselineSourceId: side(machine.sourceId, 'baseline'),
  currentSourceId: side(machine.sourceId, 'current'),
  baselineForecastRisk: { ...side(machine.forecastRisk, 'baseline'), blankMeaningTh: 'null เมื่อ baselineStatus ไม่ใช่ VALID; ห้ามแทนด้วย 0',
    blankMeaningEn: 'Null when baselineStatus is not VALID; never substitute zero.' },
  currentForecastRisk: { ...side(machine.forecastRisk, 'current'), blankMeaningTh: 'null เมื่อ currentStatus ไม่ใช่ VALID; ห้ามแทนด้วย 0',
    blankMeaningEn: 'Null when currentStatus is not VALID; never substitute zero.' },
  baselineStatus: side(machine.forecastStatus, 'baseline'),
  currentStatus: side(machine.forecastStatus, 'current'),
  riskDelta: field('ผลต่างรหัสความเสี่ยง', 'Risk class-code change', 'รหัสรอบที่เลือกลบรหัสรอบอ้างอิง เฉพาะเมื่อทั้งคู่ VALID; บวกคือรหัสสูงขึ้น ลบคือลดลง ไม่ใช่ผลต่างความน่าจะเป็นหรือปริมาณความรุนแรง',
    'Selected code minus reference code only when both are VALID. Positive means a higher class and negative a lower class; not a change in probability or a physical severity measure.', 0,
    { type: 'integer', mandatory: 'C', nullable: true, unit: 'ordinal class-code change (-2 to 2)',
      blankMeaningTh: 'null เมื่ออย่างน้อยหนึ่งรอบเป็น OUT_OF_SCOPE หรือ MISSING; ไม่ใช่ไม่มีการเปลี่ยนแปลง',
      blankMeaningEn: 'Null when either origin is OUT_OF_SCOPE or MISSING; it does not mean unchanged.' }),
  comparisonStatus: field('ผลการเปรียบเทียบ', 'Comparison result', 'INCREASED รหัสสูงขึ้น, DECREASED ลดลง, UNCHANGED เท่าเดิม; NOT_COMPARABLE คำนวณไม่ได้ ให้ดูสถานะของแต่ละรอบ',
    'INCREASED, DECREASED or UNCHANGED compares valid class codes. NOT_COMPARABLE means no numeric comparison is possible; inspect both origin statuses.', 'UNCHANGED'),
  baselineSourceVintageKey: { ...side(machine.sourceVintageKey, 'baseline'), sampleValue: '0|2025-11|T+2' },
  currentSourceVintageKey: side(machine.sourceVintageKey, 'current'),
  baselineDatasetId: side(machine.datasetId, 'baseline'),
  currentDatasetId: side(machine.datasetId, 'current'),
  baselineDatasetVersion: side(machine.datasetVersion, 'baseline'),
  currentDatasetVersion: side(machine.datasetVersion, 'current'),
  baselineSourceWorkbookSha256: side(machine.sourceWorkbookSha256, 'baseline'),
  currentSourceWorkbookSha256: side(machine.sourceWorkbookSha256, 'current'),
  exportVersion: machine.exportVersion,
  exportedAt: machine.exportedAt,
};

/** Every machine/comparison column is defined here; samples illustrate the field, not a joined forecast record. */
export const forecastExportDictionary: ForecastExportFieldDefinition[] = [
  ...Object.entries(machine).map(([key, meaning]) => ({ table: 'machineRows' as const, field: key, ...meaning })),
  ...Object.entries(comparison).map(([key, meaning]) => ({ table: 'comparisonRows' as const, field: key, ...meaning })),
];
