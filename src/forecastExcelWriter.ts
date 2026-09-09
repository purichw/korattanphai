import ExcelJS from '@protobi/exceljs';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer, onWarningStopParsing } from '@xmldom/xmldom';
import templateUrl from './assets/forecast-export-template.xlsx?url';
import { exportHorizons, exportRiskLabel, exportRiskLabels, type ForecastExport } from './forecastExportModel';
import { formatMonth } from './i18n';
import { irrigationLabels, irrigationStatusFromSource } from './irrigation';
import { withLoadDeadline } from './data/loadDeadline';

const color = { ink: '20342C', green: '58AD7C', amber: 'F3BC4C', red: 'DC5858', pale: 'EEF5F2' };
const longHeaders = ['Source ID', 'รหัสอำเภอ', 'อำเภอ', 'รหัสตำบล', 'ตำบล', 'ชลประทาน', 'เดือนตั้งต้น', 'ระยะ', 'เดือนพยากรณ์', 'ค่าพยากรณ์', 'ระดับความเสี่ยง', 'จำนวนตำบล', 'กุญแจตรวจย้อนกลับ'];
type CellValue = string | number | boolean | null | ExcelJS.CellFormulaValue;
export type ForecastWorkbookStage = 'template' | 'workbook' | 'packaging';
export const FORECAST_TEMPLATE_VERSION = '1.0.0';
export const forecastExportSheetNames = { machine: 'ข้อมูลสำหรับระบบ', dictionary: 'พจนานุกรมข้อมูล', comparison: 'เปรียบเทียบรอบ' } as const;

function setup(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.views = [{ state: 'normal', showGridLines: false }];
  sheet.columns = widths.map(width => ({ width }));
  sheet.properties.defaultRowHeight = 25;
  sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  sheet.headerFooter = { ...sheet.headerFooter, oddFooter: '&Lโคราชทันภัย&R&P / &N' };
}

function table(sheet: ExcelJS.Worksheet, name: string, headers: string[], rows: CellValue[][], start = 4, frozenColumns = 0) {
  sheet.addTable({ name, ref: `A${start}`, headerRow: true,
    columns: headers.map(name => ({ name, filterButton: true })), rows,
    style: { theme: 'TableStyleMedium4', showRowStripes: true } });
  sheet.views = [{ state: 'frozen', ySplit: start, xSplit: frozenColumns, showGridLines: false }];
  sheet.pageSetup.printTitlesRow = `${start}:${start}`;
  sheet.getRow(start).height = 42;
  sheet.getRow(start).eachCell(cell => {
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.ink } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
}

function riskFormatting(sheet: ExcelJS.Worksheet, ref: string) {
  sheet.addConditionalFormatting({ ref, rules: [color.green, color.amber, color.red].map((argb, index) => ({
    type: 'cellIs', operator: 'equal', formulae: [index], priority: index + 1,
    style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb } }, font: { color: { argb: color.ink }, bold: true } },
  })) });
}

function heading(sheet: ExcelJS.Worksheet, title: string, context: string) {
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { name: 'Arial', size: 17, bold: true, color: { argb: color.ink } };
  sheet.getRow(1).height = 30;
  sheet.getCell('A2').value = context;
  sheet.getCell('A2').font = { name: 'Arial', size: 11, italic: true, color: { argb: '52645E' } };
}

function formula(formula: string, result: number | string): ExcelJS.CellFormulaValue { return { formula, result }; }

type WriterDictionaryEntry = {
  field: string; businessDescriptionTh: string; businessDescriptionEn: string;
  type: string; mandatory: string; nullable: boolean; unit: string; sampleValue: string | number | boolean | null;
  blankMeaningTh: string; blankMeaningEn: string; usedIn: string;
};

// Aliases point to the existing human-readable sheets; they are not duplicate data fields.
const legacyFieldUses: Record<string, string> = {
  sourceId: 'รายตำบล!A; ฐาน Pivot!A', districtCode: 'สรุปอำเภอ!A; รายตำบล!B; ฐาน Pivot!B',
  districtNameTh: 'สรุปอำเภอ!B; รายตำบล!C; ฐาน Pivot!C; PivotTable: อำเภอ',
  subdistrictCode: 'รายตำบล!D; ฐาน Pivot!D', subdistrictNameTh: 'รายตำบล!E; ฐาน Pivot!E',
  originPeriod: 'รายตำบล!G; ฐาน Pivot!G; ที่มาและนิยาม: เดือนตั้งต้น (T)',
  riskLabelTh: 'ฐาน Pivot!K; PivotTable: ระดับความเสี่ยง',
  locationCount: 'ฐาน Pivot!L (ก่อนรวม / before aggregation)', sourceVintageKey: 'ฐาน Pivot!M',
  sourceWorkbook: 'ที่มาและนิยาม: ไฟล์ต้นฉบับ', sourceSheet: 'ที่มาและนิยาม: ชีตพยากรณ์',
  sourceWorkbookSha256: 'ที่มาและนิยาม: SHA-256 ต้นฉบับ', normalizedManifestSha256: 'ที่มาและนิยาม: SHA-256 normalized manifest',
  datasetId: 'ที่มาและนิยาม: Dataset ID', datasetVersion: 'ที่มาและนิยาม: Dataset version',
  exportVersion: 'ที่มาและนิยาม: รุ่นรูปแบบส่งออก / Export format version',
};

function legacyDictionary(): WriterDictionaryEntry[] {
  const entry = (field: string, usedIn: string, th: string, en: string, type: string, sample: string | number, unit = 'ไม่มีหน่วย / none', blankTh = 'ไม่มีช่องว่างในข้อมูลส่งออก', blankEn = 'No blank cells in exported records'): WriterDictionaryEntry => ({
    field, usedIn, businessDescriptionTh: th, businessDescriptionEn: en, type, mandatory: 'M', nullable: false, unit,
    sampleValue: sample, blankMeaningTh: blankTh, blankMeaningEn: blankEn,
  });
  return [
    entry('highestForecastRiskDisplay', 'สรุปอำเภอ!E:J (T+1–T+6)', 'ระดับสูงสุดในตำบลที่ผ่านตัวกรองแต่ละระยะ ไม่ใช่ค่าเฉลี่ยหรือความเสี่ยงของทุกตำบล; ใช้ข้อความเมื่อไม่มีค่าพยากรณ์', 'Highest valid class among filtered subdistricts per horizon, not an average or the class of every subdistrict; uses a status label when no valid values exist.', 'integer | string', 2),
    entry('forecastRiskDisplay', 'รายตำบล!H:M; ฐาน Pivot!J', 'ค่า 0/1/2 ตามต้นฉบับ หรือข้อความแยกนอกขอบเขตกับไม่มีข้อมูล หากต้องการคอลัมน์ตัวเลขล้วนให้ใช้ forecastRisk ในข้อมูลสำหรับระบบ', 'Original class 0/1/2, or distinct out-of-scope/missing labels. Use forecastRisk in the machine-readable sheet for a numeric-only column.', 'integer | string', 'นอกขอบเขตการศึกษา'),
    entry('irrigationLabelTh', 'รายตำบล!F; ฐาน Pivot!F; PivotTable: ชลประทาน', 'ชื่อสถานะชลประทานภาษาไทยจากข้อมูลต้นทาง ไม่ได้แปลว่ามีน้ำเพียงพอในปัจจุบัน', 'Thai irrigation-status label from source data; it does not imply current water sufficiency.', 'string', irrigationLabels.rainfed),
    entry('sourceAmphoeEn', 'รายตำบล!N', 'ชื่ออำเภอภาษาอังกฤษตามต้นฉบับ เก็บไว้ตรวจย้อนกลับแม้มีการแก้ไขการจับคู่พื้นที่', 'Original English district name retained for traceability even when its administrative mapping was corrected.', 'string', 'Dan Khun Thot'),
    entry('sourceTambonEn', 'รายตำบล!O', 'ชื่อตำบลภาษาอังกฤษตามต้นฉบับ ใช้ตรวจย้อนกลับร่วมกับ Source ID', 'Original English subdistrict name, used with Source ID to trace the source record.', 'string', 'Ban Kao'),
    entry('irrigationStatusRaw', 'รายตำบล!P', 'ข้อความสถานะชลประทานเดิมก่อนจัดกลุ่ม รวมการสะกดในต้นฉบับ', 'Original irrigation text before normalization, preserving source spelling.', 'string', 'RainFed'),
    entry('scopeCode', 'สถิติรายเดือน!A', 'รหัสอำเภอ หรือคำว่า รวม สำหรับผลรวมทุกพื้นที่ที่รวมในไฟล์ตามตัวกรอง', 'District code, or รวม for the total of all filtered areas included in this file.', 'string', 'รวม'),
    entry('scopeNameTh', 'สถิติรายเดือน!B', 'ชื่อพื้นที่ภาษาไทยของแถวสรุปตามขอบเขตส่งออก', 'Thai area label of the summary row within the exported scope.', 'string', 'จังหวัดนครราชสีมา'),
    entry('horizonLabel', 'สถิติรายเดือน!C; ฐาน Pivot!H; PivotTable: ระยะ', 'ข้อความ T+1 ถึง T+6 โดย T คือเดือนตั้งต้นเดียวกันของการส่งออก', 'Display label T+1 through T+6, where T is the same exported origin month.', 'string', 'T+1', 'เดือนล่วงหน้า / months ahead'),
    entry('targetMonthLabelTh', 'สถิติรายเดือน!D; ฐาน Pivot!I; หัวคอลัมน์ รายตำบล!H:M และ สรุปอำเภอ!E:J', 'เดือนเป้าหมายแสดงภาษาไทยและปี พ.ศ.; หัวคอลัมน์ระบุ T+ ประกอบ ใช้ targetPeriod สำหรับค่า ISO', 'Target month displayed in Thai with Buddhist Era year; column headers also show the horizon. Use targetPeriod for the ISO value.', 'string', 'ม.ค. 2569', 'เดือนปฏิทิน / calendar month'),
    entry('horizonTargetLabelTh', 'วิเคราะห์!A8:A14', 'ป้ายระยะและเดือนเป้าหมายของแต่ละแถวในตารางวิเคราะห์', 'Combined horizon and target-month label for each analysis row.', 'string', 'T+1 ม.ค. 2569'),
    entry('filteredSubdistrictCount', 'สรุปอำเภอ!C; สถิติรายเดือน!E; วิเคราะห์!I8:I14', 'จำนวนตำบลที่ผ่านตัวกรองพื้นที่และชลประทาน รวมทั้งแถวที่นอกขอบเขตหรือไม่มีข้อมูล', 'Number of subdistricts matching area and irrigation filters, including out-of-scope and missing records.', 'integer', 289, 'ตำบล / subdistricts'),
    entry('districtSubdistrictCount', 'สรุปอำเภอ!D', 'จำนวนตำบลทั้งอำเภอตามทะเบียนพื้นที่ ก่อนใช้ตัวกรองชลประทาน', 'Total canonical subdistrict count in the district before applying irrigation filters.', 'integer', 6, 'ตำบล / subdistricts'),
    entry('validForecastCount', 'สถิติรายเดือน!F; วิเคราะห์!G8:G14', 'จำนวนตำบลที่มีค่าพยากรณ์ 0/1/2 ใช้เป็นตัวหารของสัดส่วนเสี่ยง', 'Count of subdistricts with class 0/1/2; denominator of the risk share.', 'integer', 117, 'ตำบล / subdistricts'),
    ...[
      ['noRiskCount', 'G', 'B', 'ไม่พบสัญญาณเสี่ยง', 'no-risk signal', 0],
      ['moderateRiskCount', 'H', 'C', 'เสี่ยงปานกลาง', 'moderate risk', 1],
      ['highRiskCount', 'I', 'D', 'เสี่ยงสูง', 'high risk', 2],
      ['outOfScopeCount', 'J', 'E', 'นอกขอบเขตการศึกษา', 'out-of-scope source blanks', null],
      ['missingForecastCount', 'K', 'F', 'ไม่มีข้อมูล', 'missing records', undefined],
    ].map(([field, statsColumn, analysisColumn, labelTh, labelEn]) => entry(String(field), `สถิติรายเดือน!${statsColumn}; วิเคราะห์!${analysisColumn}8:${analysisColumn}14`,
      `จำนวนตำบลในสถานะ ${labelTh} สำหรับระยะนั้น แยกนอกขอบเขตและไม่มีข้อมูลออกจากค่า 0`, `Count of subdistricts with ${labelEn} for that horizon; out-of-scope and missing states are distinct from class 0.`, 'integer', 10, 'ตำบล / subdistricts')),
    { ...entry('riskShare', 'สถิติรายเดือน!L; วิเคราะห์!H8:H14', '(จำนวนเสี่ยงปานกลาง + สูง) หารจำนวนที่มีค่า 0/1/2; ไม่รวมตำบลนอกขอบเขตหรือไม่มีข้อมูลในตัวหาร', '(Moderate + high count) divided by valid class 0/1/2 count; out-of-scope and missing records are excluded from the denominator.', 'number | string', 0.5, 'สัดส่วน 0–1 แสดงเป็น % / fraction 0–1 displayed as %', 'ชีตวิเคราะห์แสดงว่างเมื่อไม่มีค่าพยากรณ์; ชีตสถิติใช้ข้อความ ไม่มีค่าพยากรณ์ ไม่ใช่ 0%', 'Analysis shows blank when no valid values exist; Statistics uses ไม่มีค่าพยากรณ์, not 0%'), nullable: true },
    entry('pivotLocationHorizonCount', 'PivotTable: ผลรวม จำนวนตำบล', 'จำนวนแถวตำบลต่อระยะหลังกรอง Pivot; ถ้ารวมหลาย T+ ตำบลเดิมอาจถูกนับหลายครั้ง', 'Sum of subdistrict-horizon rows after Pivot filters; totals across multiple horizons can count the same subdistrict more than once.', 'integer', 1734, 'ตำบล-เดือน / subdistrict-months'),
    entry('analysisDistrictSelection', 'วิเคราะห์!B4; ที่มาและนิยาม!D1:D', 'อำเภอที่เลือกสำหรับสูตรและกราฟ หรือ ทั้งหมด เฉพาะข้อมูลที่รวมในไฟล์', 'District selection for live formulas and chart, or ทั้งหมด, limited to records included in the file.', 'string', 'ทั้งหมด'),
    entry('analysisIrrigationSelection', 'วิเคราะห์!E4; ที่มาและนิยาม!E1:E', 'สถานะชลประทานที่เลือกสำหรับสูตรและกราฟ หรือ ทั้งหมด เฉพาะข้อมูลที่รวมในไฟล์', 'Irrigation selection for live formulas and chart, or ทั้งหมด, limited to records included in the file.', 'string', 'ทั้งหมด'),
    entry('metadataTopic', 'ที่มาและนิยาม!A', 'ชื่อหัวข้อสำหรับอธิบายที่มา ขอบเขต รุ่นข้อมูล และนิยามของรายงาน', 'Topic identifying report provenance, scope, data revision, or business definition.', 'string', 'Dataset version'),
    entry('metadataDetail', 'ที่มาและนิยาม!B', 'รายละเอียดของหัวข้อด้านซ้าย; รายงานเป็นข้อมูล ณ เวลาส่งออกและไม่เขียนกลับเว็บไซต์', 'Details of the adjacent topic; the report is a snapshot and does not write back to the website.', 'string', 'drought-rev03'),
    entry('exportedAtBangkokDisplay', 'ที่มาและนิยาม: เวลาส่งออก (Asia/Bangkok)', 'เวลาที่สร้างรายงาน แสดงตามเขตเวลาไทย ไม่ใช่เวลาตรวจวัดหรือเวลารันโมเดล', 'Report generation time displayed in Bangkok time, not an observation or model-run timestamp.', 'string', '9 กันยายน 2569 เวลา 12:00:00', 'Asia/Bangkok'),
    entry('templateVersion', 'ที่มาและนิยาม: รุ่นแม่แบบ / Template version', 'รุ่นของแม่แบบกราฟและโครงสร้างสมุดงาน ใช้ตรวจความเข้ากันได้ของรูปแบบไฟล์', 'Version of the chart template and workbook layout, used to trace file-format compatibility.', 'string', FORECAST_TEMPLATE_VERSION),
  ];
}

function dataWidth(field: string) {
  if (field === 'subdistrictCode') return 22;
  if (field === 'riskDelta') return 24;
  if (/Sha256/.test(field)) return 38;
  if (/Name|Label/.test(field)) return 26;
  if (/Workbook|provenance|Version/.test(field)) return 34;
  if (/Id|Key|At|Status/.test(field)) return 28;
  return 18;
}

function addDataAndDictionarySheets(book: ExcelJS.Workbook, report: ForecastExport) {
  const definitions: WriterDictionaryEntry[] = [];
  const addData = (name: string, tableName: string, rows: Record<string, CellValue>[], dictionary: ForecastExport['dictionary'], context: string, businessHeaders = false) => {
    const sheet = book.addWorksheet(name);
    const fields = dictionary.map(item => item.field);
    setup(sheet, fields.map(dataWidth));
    heading(sheet, name, context);
    sheet.getCell('A3').value = 'แถวละตำบลและเดือนเป้าหมาย; รหัสและวันที่ ISO เป็นข้อความ / One row per subdistrict and target month; identifiers and ISO periods are text.';
    sheet.mergeCells('A1:H1'); sheet.mergeCells('A2:H2'); sheet.mergeCells('A3:H3');
    for (const index of [2, 3]) { sheet.getRow(index).height = 42; sheet.getCell(index, 1).alignment = { wrapText: true, vertical: 'middle' }; }
    table(sheet, tableName, dictionary.map(item => businessHeaders ? `${item.labelTh}\n${item.field}` : item.field), rows.map(row => fields.map(field => row[field] ?? null)), 4, businessHeaders ? 3 : Math.min(5, fields.length));
    sheet.pageSetup.fitToPage = false;
    sheet.getRow(4).height = businessHeaders ? 72 : 48;
    dictionary.forEach((definition, index) => {
      if (definition.type === 'string') sheet.getColumn(index + 1).numFmt = '@';
      if (definition.type === 'integer') sheet.getColumn(index + 1).numFmt = '0';
      sheet.getColumn(index + 1).alignment = { vertical: 'middle', wrapText: true };
      definitions.push({ ...definition, usedIn: `${name}!${sheet.getColumn(index + 1).letter} (${definition.field})${definition.table === 'machineRows' && legacyFieldUses[definition.field] ? `; ${legacyFieldUses[definition.field]}` : ''}` });
    });
    rows.forEach((_, index) => { sheet.getRow(index + 5).height = 48; });
    return sheet;
  };
  addData(forecastExportSheetNames.machine, 'MachineForecastData', report.machineRows as unknown as Record<string, CellValue>[],
    report.dictionary.filter(item => item.table === 'machineRows'),
    'ตัวเลขความเสี่ยง 0/1/2 เท่านั้น; ช่องว่างอ่านร่วมกับ forecastStatus / Numeric risk 0/1/2 only; interpret blanks using forecastStatus.');
  const dictionary = book.addWorksheet(forecastExportSheetNames.dictionary);
  if (report.comparison) {
    const thChanges = { INCREASED: 'ระดับสูงขึ้น', DECREASED: 'ระดับลดลง', UNCHANGED: 'ระดับเท่าเดิม', NOT_COMPARABLE: 'เทียบระดับไม่ได้' };
    const displayDefinition = (field: string, labelTh: string, labelEn: string, th: string, en: string, sample: string): ForecastExport['dictionary'][number] => ({
      table: 'comparisonRows', field, labelTh, labelEn, businessDescriptionTh: th, businessDescriptionEn: en,
      type: 'string', mandatory: 'M', nullable: false, unit: 'ไม่มีหน่วย / none', sampleValue: sample,
      blankMeaningTh: 'ต้องมีข้อความอธิบาย แม้ไม่มีค่าตัวเลข', blankMeaningEn: 'A label is required even when numeric values are unavailable.',
    });
    const displayFields = [
      displayDefinition('baselineRiskLabelTh', 'ผลรอบอ้างอิง', 'Baseline risk label', 'ข้อความระดับพยากรณ์รอบอ้างอิง แยกนอกขอบเขตกับไม่มีข้อมูล ไม่แทนด้วยระดับปกติ', 'Baseline forecast label; out-of-scope and missing records are distinct from no risk.', 'เสี่ยงปานกลาง'),
      displayDefinition('currentRiskLabelTh', 'ผลรอบที่เลือก', 'Current risk label', 'ข้อความระดับพยากรณ์รอบที่เลือก สำหรับเดือนเป้าหมายเดียวกับรอบอ้างอิง', 'Current forecast label for the same target month as the baseline.', 'เสี่ยงสูง'),
      displayDefinition('comparisonLabelTh', 'ผลการเทียบระดับ', 'Class comparison label', 'ผลต่างของหมวดระดับเมื่อเทียบได้; เทียบระดับไม่ได้ ไม่ใช่ระดับเท่าเดิม', 'Readable comparison of ordinal classes; not comparable does not mean unchanged.', 'ระดับสูงขึ้น'),
    ];
    const entries = [...report.dictionary.filter(item => item.table === 'comparisonRows'), ...displayFields];
    const leading = ['targetPeriod', 'subdistrictCode', 'subdistrictNameTh', 'baselineRiskLabelTh', 'currentRiskLabelTh', 'comparisonLabelTh', 'riskDelta', 'districtNameTh'];
    const ordered = [...leading.map(field => entries.find(item => item.field === field)!), ...entries.filter(item => !leading.includes(item.field))];
    const rows = report.comparison.rows.map(row => ({ ...row,
      baselineRiskLabelTh: exportRiskLabel(row.baselineStatus === 'MISSING' ? undefined : row.baselineForecastRisk),
      currentRiskLabelTh: exportRiskLabel(row.currentStatus === 'MISSING' ? undefined : row.currentForecastRisk),
      comparisonLabelTh: thChanges[row.comparisonStatus],
    }));
    const sheet = addData(forecastExportSheetNames.comparison, 'SameTargetComparison', rows, ordered,
      `เดือนตั้งต้นรอบอ้างอิง ${report.comparison.baselineOriginPeriod} → รอบที่เลือก ${report.comparison.currentOriginPeriod}; เป้าหมายเดียวกัน / Same target month.`, true);
    sheet.getCell('A3').value = 'ผลต่าง = รหัสรอบที่เลือก − รอบอ้างอิง เป็นความต่างของหมวดระดับ ไม่ใช่เปอร์เซ็นต์; เทียบระดับไม่ได้ ≠ ระดับเท่าเดิม / Delta = current − baseline ordinal code, not a percentage; not comparable ≠ unchanged.';
    sheet.getRow(3).height = 54;
    [18, 22, 24, 25, 25, 25, 24, 26].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    rows.forEach((row, index) => {
      for (const [column, risk] of [[4, row.baselineForecastRisk], [5, row.currentForecastRisk]] as const) {
        sheet.getCell(index + 5, column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: risk === null ? color.pale : [color.green, color.amber, color.red][risk] } };
      }
    });
    definitions.push(
      { field: 'comparisonOriginsDisplay', usedIn: 'ที่มาและนิยาม: รอบที่เทียบ / Compared origins', businessDescriptionTh: 'คู่เดือนตั้งต้นของรอบอ้างอิงและรอบที่เลือกที่นำมาเปรียบเทียบ', businessDescriptionEn: 'Baseline and current origin months used in the comparison.', type: 'string', mandatory: 'C', nullable: false, unit: 'Gregorian YYYY-MM', sampleValue: '2025-11 → 2025-12', blankMeaningTh: 'มีเมื่อเลือกเปรียบเทียบเท่านั้น; ต้องมีทั้งสองเดือน', blankMeaningEn: 'Present only when comparison is selected; both months are required.' },
      { field: 'sharedTargetPeriodsDisplay', usedIn: 'ที่มาและนิยาม: เดือนเป้าหมายร่วม / Shared target months', businessDescriptionTh: 'รายการเดือนเป้าหมายที่มีอยู่ในทั้งสองรอบ ใช้เทียบเดือนเดียวกันเท่านั้น', businessDescriptionEn: 'Target months shared by both origins; only identical target months are compared.', type: 'string', mandatory: 'C', nullable: false, unit: 'Gregorian YYYY-MM', sampleValue: '2026-01, 2026-02', blankMeaningTh: 'มีเมื่อเลือกเปรียบเทียบ; ต้องมีอย่างน้อยหนึ่งเดือนร่วม', blankMeaningEn: 'Present for comparisons; at least one shared month is required.' },
      { field: 'baselineDatasetDisplay', usedIn: 'ที่มาและนิยาม: รุ่นข้อมูลรอบอ้างอิง / Baseline dataset', businessDescriptionTh: 'Dataset ID และรุ่นข้อมูลของรอบอ้างอิง เก็บคู่กันเพื่อระบุชุดที่ใช้เปรียบเทียบ', businessDescriptionEn: 'Baseline dataset ID and version identifying the exact comparison source.', type: 'string', mandatory: 'C', nullable: false, unit: 'ไม่มีหน่วย / none', sampleValue: 'dataset-id | dataset-version', blankMeaningTh: 'มีเมื่อเลือกเปรียบเทียบ; ต้องระบุชุดข้อมูลรอบอ้างอิง', blankMeaningEn: 'Present for comparisons; baseline dataset provenance is required.' },
      { field: 'baselineSourceDisplay', usedIn: 'ที่มาและนิยาม: ต้นฉบับรอบอ้างอิง / Baseline workbook and sheet', businessDescriptionTh: 'ชื่อไฟล์ต้นฉบับและชีตของรอบอ้างอิง ใช้ตรวจย้อนกลับกับค่าแฮช SHA-256 รอบอ้างอิง', businessDescriptionEn: 'Baseline source workbook and sheet, used with the baseline SHA-256 for traceability.', type: 'string', mandatory: 'C', nullable: false, unit: 'ไม่มีหน่วย / none', sampleValue: 'source.xlsx | Sheet1', blankMeaningTh: 'มีเมื่อเลือกเปรียบเทียบ; ต้องระบุไฟล์และชีตต้นฉบับ', blankMeaningEn: 'Present for comparisons; source workbook and sheet are required.' },
    );
  }
  definitions.push(...legacyDictionary());
  setup(dictionary, [31, 54, 54, 19, 13, 15, 24, 34, 49, 49, 56]);
  heading(dictionary, 'พจนานุกรมข้อมูล / Data dictionary', 'ความหมายทางธุรกิจและการอ่านช่องว่าง / Business meanings and how to interpret blank cells');
  dictionary.getCell('A3').value = 'M = ต้องมี / required; C = ตามเงื่อนไข / conditional; O = ไม่บังคับ / optional. ตัวอย่างเป็น JSON literals; required และ nullable เป็นคนละเงื่อนไข / Examples use JSON literals; required and nullable are separate rules.';
  dictionary.mergeCells('A1:K1'); dictionary.mergeCells('A2:K2'); dictionary.mergeCells('A3:K3'); dictionary.getRow(3).height = 42;
  dictionary.getCell('A3').alignment = { wrapText: true, vertical: 'middle' };
  table(dictionary, 'ExportFieldDictionary', ['Field key / ชื่อฟิลด์', 'ความหมายทางธุรกิจ (TH)', 'Business meaning (EN)', 'Data type / ชนิดข้อมูล', 'Required / บังคับ', 'Nullable / รับว่าง', 'Unit / หน่วย', 'Example / ตัวอย่าง JSON', 'ความหมายเมื่อว่าง (TH)', 'Blank meaning (EN)', 'Used in / ชีตและคอลัมน์'],
    definitions.map(item => [item.field, item.businessDescriptionTh, item.businessDescriptionEn, item.type, item.mandatory,
      item.nullable ? 'Yes / ได้' : 'No / ไม่ได้', item.unit, JSON.stringify(item.sampleValue), item.blankMeaningTh, item.blankMeaningEn, item.usedIn]), 4, 1);
  dictionary.pageSetup.fitToPage = false;
  definitions.forEach((_, index) => {
    dictionary.getRow(index + 5).height = 100;
    dictionary.getRow(index + 5).eachCell(cell => { cell.alignment = { vertical: 'top', wrapText: true }; });
  });
}

export async function createForecastWorkbook(report: ForecastExport, templateBytes?: ArrayBuffer,
  { onProgress }: { onProgress?: (stage: ForecastWorkbookStage) => void } = {}) {
  onProgress?.('template');
  if (!templateBytes) {
    const controller = new AbortController();
    templateBytes = await withLoadDeadline(controller, async () => {
      const response = await fetch(templateUrl, { signal: controller.signal });
      if (!response.ok) throw new Error('โหลดแบบฟอร์ม Excel ไม่สำเร็จ');
      return response.arrayBuffer();
    });
  }
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(templateBytes);
  onProgress?.('workbook');
  // Imported Excel styles are shared objects; detach them before formatting
  // individual inputs, headers or percentages in the chart template.
  book.eachSheet(sheet => {
    sheet.columns.forEach(column => { column.style = structuredClone(column.style); });
    sheet.eachRow({ includeEmpty: true }, row => {
      row.eachCell({ includeEmpty: true }, cell => { cell.style = structuredClone(cell.style); });
    });
  });
  book.creator = 'โคราชทันภัย';
  book.created = report.exportedAt;
  book.modified = report.exportedAt;
  book.calcProperties.fullCalcOnLoad = true;
  const dashboard = book.getWorksheet('วิเคราะห์')!;
  const districts = book.addWorksheet('สรุปอำเภอ');
  const tambons = book.addWorksheet('รายตำบล');
  const statistics = book.addWorksheet('สถิติรายเดือน');
  const pivot = book.addWorksheet('PivotTable');
  const data = book.addWorksheet('ฐาน Pivot');
  const notes = book.addWorksheet('ที่มาและนิยาม');
  const origin = formatMonth(report.options.originPeriod, 'th');
  const area = report.options.areaCode === '30' ? 'จังหวัดนครราชสีมา' : `อำเภอ${report.districts[0].name}`;
  const context = `เดือนตั้งต้น ${origin} | ${area} | ชลประทาน: ${irrigationLabels[report.options.irrigation]}`;
  const horizonHeaders = report.targets.map((target, index) => `T+${index + 1} ${formatMonth(target, 'th')}`);
  setup(districts, [14, 28, 16, 16, ...exportHorizons.map(() => 23)]);
  heading(districts, 'ระดับสูงสุดที่พบในตำบล แยกรายอำเภอ', context);
  table(districts, 'DistrictSummary', ['รหัสอำเภอ', 'อำเภอ', 'ตำบลตามตัวกรอง', 'ตำบลทั้งอำเภอ', ...horizonHeaders], report.districts.map(district => [
    district.code, district.name, district.rows.length, district.total,
    ...district.horizons.map(item => item.highest ?? exportRiskLabel(item.highest)),
  ]));
  riskFormatting(districts, `E5:J${report.districts.length + 4}`);
  districts.getCell('A3').value = 'ระดับสูงสุด ไม่ใช่ค่าเฉลี่ยหรือสถานะของทุกตำบล; 0 = ไม่พบสัญญาณเสี่ยง, 1 = ปานกลาง, 2 = สูง';

  setup(tambons, [13, 14, 27, 14, 25, 33, 16, ...exportHorizons.map(() => 23), 30, 25, 21]);
  heading(tambons, 'ค่าพยากรณ์รายตำบล T+1–T+6', context);
  const rawRows: CellValue[][] = report.rows.map(row => [row.sourceId, row.districtCode, row.districtNameTh, row.subdistrictCode,
    row.subdistrictNameTh, irrigationLabels[irrigationStatusFromSource(row.irrigationStatus)], report.options.originPeriod,
    ...row.risks.map(risk => risk ?? exportRiskLabel(risk)), row.sourceAmphoeEn, row.sourceTambonEn, row.irrigationStatusRaw]);
  table(tambons, 'TambonForecast', ['Source ID', 'รหัสอำเภอ', 'อำเภอ', 'รหัสตำบล', 'ตำบล', 'ชลประทาน', 'เดือนตั้งต้น', ...horizonHeaders, 'อำเภอในต้นฉบับ', 'ตำบลในต้นฉบับ', 'ชลประทานต้นฉบับ'], rawRows);
  riskFormatting(tambons, `H5:M${report.rows.length + 4}`);
  tambons.getCell('A3').value = 'ตัวเลข 0/1/2 ตรงกับต้นฉบับ; ข้อความนอกขอบเขตแทนช่องว่างต้นฉบับ ไม่ใช่ 0';

  const longRows: CellValue[][] = report.rows.flatMap(row => exportHorizons.map((horizon, index) => [row.sourceId, row.districtCode, row.districtNameTh,
    row.subdistrictCode, row.subdistrictNameTh, irrigationLabels[irrigationStatusFromSource(row.irrigationStatus)], report.options.originPeriod,
    `T+${horizon}`, formatMonth(report.targets[index], 'th'), row.risks[index] ?? exportRiskLabel(row.risks[index]),
    exportRiskLabel(row.risks[index]), 1, `${row.sourceId}|${report.options.originPeriod}|T+${horizon}`]));
  setup(data, [13, 14, 27, 14, 25, 33, 16, 10, 20, 26, 28, 17, 28]);
  table(data, 'ForecastData', longHeaders, longRows, 1);
  riskFormatting(data, `J2:J${longRows.length + 1}`);

  setup(statistics, [14, 27, 10, 20, 17, 17, 20, 20, 17, 19, 17, 20]);
  heading(statistics, 'จำนวนตำบลแยกตามระดับและเดือนพยากรณ์', context);
  const groups = [{ code: 'รวม', name: area, horizons: report.totals }, ...report.districts];
  const statsRows = groups.flatMap(group => group.horizons.map((item, index) => [group.code, group.name, `T+${index + 1}`,
    formatMonth(report.targets[index], 'th'), item.total, item.valid, ...item.counts, item.riskShare ?? 'ไม่มีค่าพยากรณ์']));
  table(statistics, 'MonthlyStatistics', ['รหัสอำเภอ', 'อำเภอ/รวม', 'ระยะ', 'เดือนพยากรณ์', 'ตำบลตามตัวกรอง', 'มีค่าพยากรณ์', 'ไม่พบสัญญาณเสี่ยง', 'เสี่ยงปานกลาง', 'เสี่ยงสูง', 'นอกขอบเขต', 'ไม่มีข้อมูล', 'สัดส่วนตำบลเสี่ยง'], statsRows);
  statistics.getColumn(12).numFmt = '0.0%';

  setup(dashboard, [22, 21, 18, 15, 23, 17, 17, 20, 17]);
  heading(dashboard, 'พยากรณ์ภัยแล้ง 6 เดือน', context);
  dashboard.getCell('A4').value = 'อำเภอ';
  dashboard.getCell('B4').value = 'ทั้งหมด';
  dashboard.getCell('D4').value = 'ชลประทาน';
  dashboard.mergeCells('E4:F4');
  dashboard.getCell('E4').value = 'ทั้งหมด';
  dashboard.getRow(4).height = 30;
  for (const cell of ['B4', 'E4']) {
    dashboard.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } };
    dashboard.getCell(cell).font = { name: 'Arial', size: 11, color: { argb: '006DA4' }, bold: true };
  }
  dashboard.getCell('A6').value = 'เลือกอำเภอ/ชลประทานในช่องสีเหลือง กราฟและตารางนี้คำนวณจากฐาน Pivot ภายในไฟล์';
  dashboard.getCell('A7').value = 'เปอร์เซ็นต์เสี่ยง = (ปานกลาง + สูง) / ตำบลที่มีค่า 0/1/2; นอกขอบเขตและไม่มีข้อมูลไม่อยู่ในตัวหาร';
  dashboard.getRow(8).values = ['เดือนพยากรณ์', 'ไม่พบ\nสัญญาณเสี่ยง', 'เสี่ยง\nปานกลาง', 'เสี่ยงสูง', 'นอกขอบเขต\nการศึกษา', 'ไม่มีข้อมูล', 'มีค่า\nพยากรณ์', 'สัดส่วน\nตำบลเสี่ยง', 'ตำบลตาม\nตัวกรอง'];
  dashboard.getRow(8).height = 38;
  dashboard.getRow(8).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.ink } }; cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } }; cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
  const end = longRows.length + 1;
  const range = (column: string) => `'ฐาน Pivot'!$${column}$2:$${column}$${end}`;
  report.totals.forEach((item, index) => {
    const row = index + 9;
    dashboard.getCell(`A${row}`).value = `T+${index + 1} ${formatMonth(report.targets[index], 'th')}`;
    exportRiskLabels.forEach((label, risk) => {
      dashboard.getCell(row, risk + 2).value = formula(`COUNTIFS(${range('H')},"T+${index + 1}",${range('C')},IF($B$4="ทั้งหมด","*",$B$4),${range('F')},IF($E$4="ทั้งหมด","*",$E$4),${range('K')},"${label}")`, item.counts[risk]);
    });
    dashboard.getCell(`G${row}`).value = formula(`SUM(B${row}:D${row})`, item.valid);
    dashboard.getCell(`H${row}`).value = formula(`IF(G${row}=0,"",(C${row}+D${row})/G${row})`, item.riskShare ?? '');
    dashboard.getCell(`I${row}`).value = formula(`SUM(B${row}:F${row})`, item.total);
    dashboard.getCell(`H${row}`).numFmt = '0.0%';
  });
  dashboard.getCell('A33').value = 'กราฟแสดงเฉพาะตำบลที่มีค่าพยากรณ์; จำนวนตำบลนอกขอบเขตและไม่มีข้อมูลแสดงในตารางด้านบน';

  setup(pivot, [32, ...Array.from({ length: 7 }, () => 21)]);
  // The maintained ExcelJS fork supplies native Excel PivotTable and report filters.
  (pivot as ExcelJS.Worksheet & { addPivotTable: (model: unknown) => void }).addPivotTable({
    sourceSheet: data, rows: ['อำเภอ'], columns: ['ระยะ'], values: ['จำนวนตำบล'],
    pages: ['ระดับความเสี่ยง', 'ชลประทาน'], metric: 'sum', applyWidthHeightFormats: '0',
  });
  pivot.mergeCells('D1:H1');
  pivot.getCell('D1').value = 'หากตารางยังว่าง เลือก Data > Refresh All';
  pivot.mergeCells('D2:H2');
  pivot.getCell('D2').value = 'ผลรวมข้าม T+ คือจำนวนตำบล-เดือน ตำบลเดิมนับซ้ำได้';
  pivot.getCell('A45').value = 'PivotTable: ใช้ตัวกรองระดับความเสี่ยงและชลประทาน; หากยังไม่แสดงผล เลือก Data > Refresh All ใน Microsoft Excel';
  pivot.getCell('A46').value = 'จำนวนที่รวมข้าม T+ คือจำนวนตำบล-เดือน ตำบลเดิมนับซ้ำได้ ไม่ใช่จำนวนตำบลไม่ซ้ำ';

  setup(notes, [32, 105]);
  heading(notes, 'แหล่งข้อมูลและนิยาม', 'รายงานพยากรณ์ย้อนหลัง ไม่ใช่สถานการณ์ตรวจวัดปัจจุบัน');
  const metadata: CellValue[][] = [
    ['เดือนตั้งต้น (T)', report.options.originPeriod], ['ขอบเขตพื้นที่', area], ['ตัวกรองชลประทาน', irrigationLabels[report.options.irrigation]],
    ['ขอบเขตความเสี่ยง', 'ทุกระดับ ตลอด T+1–T+6'], ['เวลาส่งออก (Asia/Bangkok)', new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(report.exportedAt)],
    ['ต้นทาง', 'Supabase: ข้อมูลที่ตรวจสอบรุ่นล่าสุดก่อนส่งออก'], ['ไฟล์ต้นฉบับ', report.meta.sourceWorkbookOriginal], ['ชีตพยากรณ์', report.meta.sourceSheet],
    ['Dataset ID', report.meta.datasetId], ['Dataset version', report.meta.datasetVersion], ['SHA-256 ต้นฉบับ', report.meta.sourceWorkbookSha256], ['SHA-256 normalized manifest', report.meta.normalizedManifestSha256],
    ['รุ่นรูปแบบส่งออก / Export format version', report.exportVersion], ['รุ่นแม่แบบ / Template version', FORECAST_TEMPLATE_VERSION],
    ['ข้อมูลสำหรับระบบ / Machine-readable data', 'ชีตข้อมูลสำหรับระบบมีค่าตัวเลขความเสี่ยงแยกจากสถานะ; คำอธิบายทุกฟิลด์อยู่ในพจนานุกรมข้อมูล / The machine sheet separates numeric risk from data status; every field is documented in the data dictionary.'],
    ...(report.comparison ? [
      ['รอบที่เทียบ / Compared origins', `${report.comparison.baselineOriginPeriod} → ${report.comparison.currentOriginPeriod}`],
      ['เดือนเป้าหมายร่วม / Shared target months', report.comparison.targets.join(', ')],
      ['รุ่นข้อมูลรอบอ้างอิง / Baseline dataset', `${report.comparison.baselineMeta.datasetId} | ${report.comparison.baselineMeta.datasetVersion}`],
      ['ต้นฉบับรอบอ้างอิง / Baseline workbook and sheet', `${report.comparison.baselineMeta.sourceWorkbookOriginal} | ${report.comparison.baselineMeta.sourceSheet}`],
      ['SHA-256 รอบอ้างอิง / Baseline source SHA-256', report.comparison.baselineMeta.sourceWorkbookSha256],
      ['นิยามการเปรียบเทียบ / Comparison meaning', 'จับคู่รหัสตำบลและเดือนเป้าหมายเดียวกันเท่านั้น ผลต่างเป็นรหัสรอบที่เลือกลบรอบอ้างอิง ไม่ใช่เปอร์เซ็นต์ / Matches subdistrict code and identical target month only; delta is current minus baseline class code, not a percentage.'],
    ] : []),
    ['วิธีตรวจย้อนกลับ', 'Source ID + เดือนตั้งต้น (Source_YearMonth) + T+ ของคอลัมน์ เทียบกับไฟล์และชีตต้นฉบับที่ระบุ'],
    ['การนับเดือน', 'T+1 คือเดือนถัดจากเดือนตั้งต้น; T+6 คือเดือนตั้งต้นบวก 6 เดือน'],
    ...exportRiskLabels.map((label, index) => [index < 3 ? `ค่า ${index}` : label, index < 3 ? label : index === 3 ? 'ช่องว่างในต้นฉบับ อยู่นอกขอบเขตการพยากรณ์ ไม่ใช่ 0' : 'ไม่มีรายการสำหรับตำบลและระยะที่เลือก แยกจากช่องว่างต้นฉบับ']),
    ['ระดับอำเภอ', 'ระดับสูงสุดที่พบในตำบลที่ผ่านตัวกรอง ไม่ใช่ค่าเฉลี่ย ไม่ได้หมายความว่าทุกตำบลในอำเภอมีความเสี่ยงระดับนี้'],
    ['สัดส่วนความเสี่ยง', '(จำนวนปานกลาง + จำนวนสูง) / จำนวนที่มีค่า 0/1/2; ไม่มีค่าพยากรณ์แสดงว่าง ไม่แสดง 0%'],
    ['Collecting', irrigationLabels.unknown], ['RainFed', irrigationLabels.rainfed], ['Irrigation / Irragation', irrigationLabels.irrigated],
    ['ตารางและตัวกรอง', 'ทุกตารางเปิด AutoFilter เพื่อกรองและเรียงต่อได้; สรุปอำเภอ/รายตำบล/สถิติเป็นภาพข้อมูล ณ เวลาส่งออก'],
    ['กราฟแบบปรับตัวกรอง', 'ชีตวิเคราะห์เลือกอำเภอและชลประทานจากข้อมูลที่รวมในไฟล์ กราฟเป็นวัตถุ Excel แก้ไขได้ ไม่ใช่รูปภาพ'],
    ['PivotTable', 'Microsoft Excel: เลือก Data > Refresh All เพื่อคำนวณ PivotTable; เปลี่ยนฟิลด์และตัวกรองรายงานได้จากฐาน Pivot'],
    ['ข้อมูลวิเคราะห์', 'ฐาน Pivot มีหนึ่งแถวต่อตำบลต่อระยะ; จำนวนตำบล = 1 ทุกแถว ต้องกรองระยะเมื่อหาจำนวนตำบลไม่ซ้ำ'],
    ['หลังแก้ข้อมูลในไฟล์', 'กราฟอ้างอิงฐาน Pivot; PivotTable ต้อง Refresh All หลังเปลี่ยนฐาน Pivot ส่วนชีตสรุปเป็น snapshot และไม่เขียนกลับเว็บ'],
    ['การอัปเดตข้อมูล', 'ไฟล์นี้ไม่เชื่อมฐานข้อมูลและไม่มีข้อมูลเข้าสู่ระบบ หากต้องการข้อมูลใหม่ให้ส่งออกจากเว็บอีกครั้ง'],
    ...report.rows.filter(row => row.sourceAdminCorrectionApplied).map(row => [`แก้ไข Source ID ${row.sourceId}`, `${row.sourceTambonEn}: อำเภอในต้นฉบับ ${row.sourceAmphoeEn}; ยืนยันเป็น ${row.sourceAmphoeEnCorrected} (${row.districtNameTh})`]),
  ];
  table(notes, 'ReportDefinitions', ['หัวข้อ', 'รายละเอียด'], metadata);
  metadata.forEach((_, index) => { notes.getRow(index + 5).height = 44; notes.getCell(index + 5, 2).alignment = { wrapText: true, vertical: 'middle' }; });
  notes.getColumn(4).width = 30;
  notes.getColumn(5).width = 35;
  notes.getCell('D1').value = 'ตัวเลือกอำเภอ';
  const districtOptions = ['ทั้งหมด', ...report.districts.map(district => district.name)];
  districtOptions.forEach((name, index) => { notes.getCell(index + 2, 4).value = name; });
  notes.getCell('E1').value = 'ตัวเลือกชลประทาน';
  const irrigationOptions = ['ทั้งหมด', ...new Set(report.rows.map(row => irrigationLabels[irrigationStatusFromSource(row.irrigationStatus)]))];
  irrigationOptions.forEach((name, index) => { notes.getCell(index + 2, 5).value = name; });
  book.definedNames.add(`'ที่มาและนิยาม'!$D$2:$D$${districtOptions.length + 1}`, 'ExportDistricts');
  book.definedNames.add(`'ที่มาและนิยาม'!$E$2:$E$${irrigationOptions.length + 1}`, 'ExportIrrigation');
  dashboard.getCell('B4').dataValidation = { type: 'list', allowBlank: false, formulae: ['ExportDistricts'], showErrorMessage: true, errorTitle: 'เลือกอำเภอ', error: 'เลือกจากรายการอำเภอในไฟล์' };
  dashboard.getCell('E4').dataValidation = { type: 'list', allowBlank: false, formulae: ['ExportIrrigation'], showErrorMessage: true, errorTitle: 'เลือกชลประทาน', error: 'เลือกจากรายการชลประทานในไฟล์' };
  addDataAndDictionarySheets(book, report);
  districts.views = [{ state: 'frozen', ySplit: 4, xSplit: 2, showGridLines: false }];
  tambons.views = [{ state: 'frozen', ySplit: 4, xSplit: 4, showGridLines: false }];
  data.views = [{ state: 'frozen', ySplit: 1, xSplit: 4, showGridLines: false }];
  book.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => {
    cell.font = { name: 'Arial', size: 11, color: { argb: color.ink }, ...cell.font };
    cell.alignment = { vertical: 'middle', ...cell.alignment };
    if (typeof cell.value === 'number' || typeof cell.result === 'number') cell.numFmt ||= '#,##0';
  })));
  onProgress?.('packaging');
  const bytes = await book.xlsx.writeBuffer();
  return finalizeWorkbookArchive(new Uint8Array(bytes), book, report);
}

// Excel recalculates live formulas; refresh the chart's preview cache as well so
// readers that only display cached chart values never show template contents.
async function finalizeWorkbookArchive(bytes: Uint8Array, book: ExcelJS.Workbook, report: ForecastExport) {
  const zip = await JSZip.loadAsync(bytes);
  const namespace = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
  const parser = new DOMParser({ onError: onWarningStopParsing });
  // ExcelJS writes header line breaks literally in table-column attributes.
  // XML readers normalize literal attribute whitespace to spaces; character
  // references preserve the deliberate breaks and match the worksheet cells.
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!/^xl\/tables\/table\d+\.xml$/.test(name)) continue;
    const xml = await entry.async('string');
    zip.file(name, xml.replace(/(<tableColumn\b[^>]*\bname=")([^"]*)"/g, (_, prefix: string, label: string) =>
      `${prefix}${label.replace(/\r/g, '&#13;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;')}"`));
  }
  // ExcelJS's experimental pivot writer currently emits the field count as the
  // record count and a fixed refresh date. Correct only that generated metadata.
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!/^xl\/pivotCache\/pivotCacheDefinition\d+\.xml$/.test(name)) continue;
    const xml = parser.parseFromString(await entry.async('string'), 'application/xml');
    const root = xml.documentElement;
    if (!root) throw new Error('ไม่พบโครงสร้าง PivotTable ในแบบฟอร์ม Excel');
    root.setAttribute('recordCount', String(report.rows.length * 6));
    root.setAttribute('refreshedBy', 'โคราชทันภัย');
    root.setAttribute('refreshedDate', String(report.exportedAt.getTime() / 86400000 + 25569));
    zip.file(name, new XMLSerializer().serializeToString(xml));
  }
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!/^xl\/charts\/chart\d+\.xml$/.test(name)) continue;
    const xml = parser.parseFromString(await entry.async('string'), 'application/xml');
    const maximum = Math.max(1, ...report.totals.flatMap(item => item.counts.slice(0, 3)));
    const step = [1, 2, 5, 10, 20, 50, 100].find(value => value >= maximum / 5) ?? Math.ceil(maximum / 5);
    for (const axis of Array.from(xml.getElementsByTagNameNS(namespace, 'valAx'))) {
      const unit = xml.createElementNS(namespace, 'c:majorUnit'); unit.setAttribute('val', String(step)); axis.appendChild(unit);
      const scaling = axis.getElementsByTagNameNS(namespace, 'scaling')[0];
      if (scaling) for (const [name, value] of [['max', Math.ceil(maximum / step) * step], ['min', 0]] as const) {
        const old = scaling.getElementsByTagNameNS(namespace, name)[0]; if (old) scaling.removeChild(old);
        const bound = xml.createElementNS(namespace, `c:${name}`); bound.setAttribute('val', String(value)); scaling.appendChild(bound);
      }
    }
    for (const ref of [...Array.from(xml.getElementsByTagNameNS(namespace, 'numRef')), ...Array.from(xml.getElementsByTagNameNS(namespace, 'strRef'))]) {
      const source = ref.getElementsByTagNameNS(namespace, 'f')[0]?.textContent;
      const match = source?.match(/^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/);
      if (!match || (match[4] && match[4] !== match[2])) throw new Error('ช่วงข้อมูลกราฟ Excel ไม่ถูกต้อง');
      const sheet = book.getWorksheet(match[1]);
      if (!sheet) throw new Error('ไม่พบชีตข้อมูลกราฟ');
      const type = ref.localName === 'numRef' ? 'numCache' : 'strCache';
      const old = ref.getElementsByTagNameNS(namespace, type)[0];
      if (old) ref.removeChild(old);
      const cache = xml.createElementNS(namespace, `c:${type}`);
      const count = xml.createElementNS(namespace, 'c:ptCount');
      count.setAttribute('val', String(Number(match[5] ?? match[3]) - Number(match[3]) + 1)); cache.appendChild(count);
      for (let row = Number(match[3]); row <= Number(match[5] ?? match[3]); row++) {
        const cell = sheet.getCell(`${match[2]}${row}`);
        const value = cell.result ?? cell.value;
        const point = xml.createElementNS(namespace, 'c:pt'); point.setAttribute('idx', String(row - Number(match[3])));
        const node = xml.createElementNS(namespace, 'c:v'); node.textContent = String(value ?? ''); point.appendChild(node); cache.appendChild(point);
      }
      ref.appendChild(cache);
    }
    zip.file(name, new XMLSerializer().serializeToString(xml));
  }
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!/^xl\/drawings\/drawing\d+\.xml$/.test(name)) continue;
    const xml = parser.parseFromString(await entry.async('string'), 'application/xml');
    const drawingNs = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
    for (const properties of Array.from(xml.getElementsByTagNameNS(drawingNs, 'cNvPr'))) {
      properties.setAttribute('descr', 'จำนวนตำบลที่มีผลพยากรณ์แต่ละระดับตลอด T+1–T+6; ดูตัวเลขและสถานะข้อมูลครบในตารางชีตวิเคราะห์ แถว 8–14 / Subdistrict counts by forecast class for T+1–T+6; complete values and data statuses are in the Analysis sheet, rows 8–14.');
      properties.setAttribute('title', 'พยากรณ์ภัยแล้ง 6 เดือน / Six-month drought forecast');
    }
    zip.file(name, new XMLSerializer().serializeToString(xml));
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
