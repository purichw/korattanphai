import ExcelJS from '@protobi/exceljs';
import JSZip from 'jszip';
import templateUrl from './assets/forecast-export-template.xlsx?url';
import { exportHorizons, exportRiskLabel, exportRiskLabels, type ForecastExport } from './forecastExportModel';
import { formatMonth } from './i18n';
import { irrigationLabels, irrigationStatusFromSource } from './irrigation';

const color = { ink: '20342C', green: '58AD7C', amber: 'F3BC4C', red: 'DC5858', pale: 'EEF5F2' };
const longHeaders = ['Source ID', 'รหัสอำเภอ', 'อำเภอ', 'รหัสตำบล', 'ตำบล', 'ชลประทาน', 'เดือนตั้งต้น', 'ระยะ', 'เดือนพยากรณ์', 'ค่าพยากรณ์', 'ระดับความเสี่ยง', 'จำนวนตำบล', 'กุญแจตรวจย้อนกลับ'];
type CellValue = string | number | ExcelJS.CellFormulaValue;

function setup(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.views = [{ state: 'normal', showGridLines: false }];
  sheet.columns = widths.map(width => ({ width }));
  sheet.properties.defaultRowHeight = 25;
  sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  sheet.headerFooter = { ...sheet.headerFooter, oddFooter: '&Lโคราชทันภัย&R&P / &N' };
}

function table(sheet: ExcelJS.Worksheet, name: string, headers: string[], rows: CellValue[][], start = 4) {
  sheet.addTable({ name, ref: `A${start}`, headerRow: true,
    columns: headers.map(name => ({ name, filterButton: true })), rows,
    style: { theme: 'TableStyleMedium4', showRowStripes: true } });
  sheet.views = [{ state: 'frozen', ySplit: start, xSplit: 0, showGridLines: false }];
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

export async function createForecastWorkbook(report: ForecastExport, templateBytes?: ArrayBuffer) {
  if (!templateBytes) {
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error('โหลดแบบฟอร์ม Excel ไม่สำเร็จ');
    templateBytes = await response.arrayBuffer();
  }
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(templateBytes);
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
  dashboard.getRow(8).values = ['เดือนพยากรณ์', ...exportRiskLabels, 'มีค่าพยากรณ์', 'สัดส่วนตำบลเสี่ยง', 'ตำบลตามตัวกรอง'];
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
  book.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => {
    cell.font = { name: 'Arial', size: 11, color: { argb: color.ink }, ...cell.font };
    cell.alignment = { vertical: 'middle', ...cell.alignment };
    if (typeof cell.value === 'number' || typeof cell.result === 'number') cell.numFmt ||= '#,##0';
  })));
  const bytes = await book.xlsx.writeBuffer();
  return finalizeWorkbookArchive(new Uint8Array(bytes), book, report);
}

// Excel recalculates live formulas; refresh the chart's preview cache as well so
// readers that only display cached chart values never show template contents.
async function finalizeWorkbookArchive(bytes: Uint8Array, book: ExcelJS.Workbook, report: ForecastExport) {
  const zip = await JSZip.loadAsync(bytes);
  const namespace = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
  // ExcelJS's experimental pivot writer currently emits the field count as the
  // record count and a fixed refresh date. Correct only that generated metadata.
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!/^xl\/pivotCache\/pivotCacheDefinition\d+\.xml$/.test(name)) continue;
    const xml = new DOMParser().parseFromString(await entry.async('string'), 'application/xml');
    const root = xml.documentElement;
    root.setAttribute('recordCount', String(report.rows.length * 6));
    root.setAttribute('refreshedBy', 'โคราชทันภัย');
    root.setAttribute('refreshedDate', String(report.exportedAt.getTime() / 86400000 + 25569));
    zip.file(name, new XMLSerializer().serializeToString(xml));
  }
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!/^xl\/charts\/chart\d+\.xml$/.test(name)) continue;
    const xml = new DOMParser().parseFromString(await entry.async('string'), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('อ่านโครงสร้างกราฟ Excel ไม่สำเร็จ');
    const maximum = Math.max(1, ...report.totals.flatMap(item => item.counts.slice(0, 3)));
    const step = [1, 2, 5, 10, 20, 50, 100].find(value => value >= maximum / 5) ?? Math.ceil(maximum / 5);
    for (const axis of xml.getElementsByTagNameNS(namespace, 'valAx')) {
      const unit = xml.createElementNS(namespace, 'c:majorUnit'); unit.setAttribute('val', String(step)); axis.appendChild(unit);
      const scaling = axis.getElementsByTagNameNS(namespace, 'scaling')[0];
      if (scaling) for (const [name, value] of [['max', Math.ceil(maximum / step) * step], ['min', 0]] as const) {
        const old = scaling.getElementsByTagNameNS(namespace, name)[0]; if (old) scaling.removeChild(old);
        const bound = xml.createElementNS(namespace, `c:${name}`); bound.setAttribute('val', String(value)); scaling.appendChild(bound);
      }
    }
    for (const ref of [...xml.getElementsByTagNameNS(namespace, 'numRef'), ...xml.getElementsByTagNameNS(namespace, 'strRef')]) {
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
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
