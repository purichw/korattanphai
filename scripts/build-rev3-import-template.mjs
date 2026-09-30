import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Use the bundled spreadsheet authoring runtime, never install it into the app.
if (!process.env.KTP_ARTIFACT_NODE_MODULES) throw new Error('Set KTP_ARTIFACT_NODE_MODULES to the node_modules path returned by load_workspace_dependencies');
const requireRuntime = createRequire(path.join(process.env.KTP_ARTIFACT_NODE_MODULES, 'ktp-template-builder.cjs'));
const { Workbook, SpreadsheetFile } = await import(pathToFileURL(requireRuntime.resolve('@oai/artifact-tool')).href);

const root = path.resolve(import.meta.dirname, '..');
await fs.mkdir(path.join(root, 'artifacts/rev3-import'), { recursive: true });
const fields = JSON.parse(await fs.readFile(path.join(root, 'src/admin/rev3Fields.json'), 'utf8'));
const archive = JSON.parse(await fs.readFile(path.join(root, 'src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json'), 'utf8'));
const areas = archive.locations;
const labels = fields.map(field => field.label);
const riskChoices = ['ไม่พบความเสี่ยง', 'เสี่ยงปานกลาง', 'เสี่ยงสูง', 'นอกขอบเขตการศึกษา'];
const irrigation = { Collecting: 'ยังไม่ทราบ', RainFed: 'อาศัยน้ำฝน', Irrigation: 'มีชลประทาน' };
const rows = areas.map(area => [null, null, Number(area.sourceId), area.subdistrictNameTh, area.districtNameTh,
  irrigation[area.irrigationStatus] ?? 'ยังไม่ทราบ', ...Array(6).fill('ยังไม่กรอก')]);
const wb = Workbook.create();
const data = wb.worksheets.add('ข้อมูลพยากรณ์');
const examples = wb.worksheets.add('ตัวอย่าง');
const guide = wb.worksheets.add('คำอธิบาย');
const directory = wb.worksheets.add('รายชื่อพื้นที่');
function format(sheet, address, headerRow = 1) {
  const range = sheet.getRange(address);
  range.format.font = { name: 'Arial', size: 11, color: '#20362E' };
  range.format.wrapText = true; range.format.verticalAlignment = 'center';
  range.format.rowHeight = 36; range.format.columnWidth = 24;
  const end = address.match(/:([A-Z]+)\d+$/)[1];
  sheet.getRange(`A${headerRow}:${end}${headerRow}`).format = { fill: '#193E31', font: { name: 'Arial', size: 11, bold: true, color: '#FFFFFF' }, rowHeight: 48, wrapText: true, horizontalAlignment: 'center', verticalAlignment: 'center' };
  sheet.showGridLines = false;
}
data.getRange('A1:L290').values = [labels, ...rows]; format(data, 'A1:L290');
data.getRange('A2:B290').format.fill = '#FFF2D4'; data.getRange('G2:L290').format.fill = '#FFF2D4';
data.getRange('A2:C290').setNumberFormat('0');
data.getRange('A2:A290').dataValidation = { rule: { type: 'whole', operator: 'between', formula1: 1900, formula2: 2199 } };
data.getRange('B2:B290').dataValidation = { rule: { type: 'whole', operator: 'between', formula1: 1, formula2: 12 } };
data.getRange('F2:F290').dataValidation = { rule: { type: 'list', values: Object.values(irrigation) } };
data.getRange('G2:L290').dataValidation = { rule: { type: 'list', values: riskChoices } };
data.freezePanes.freezeRows(1); data.freezePanes.freezeColumns(5);
const sampleRows = rows.slice(0, 4).map((row, i) => [2025, 12, ...row.slice(2, 6), ...Array.from({ length: 6 }, (_, h) => riskChoices[(i + h) % 4])]);
examples.getRange('A1').values = [['ตัวอย่างการกรอกข้อมูลพยากรณ์']];
examples.getRange('A2').values = [['ค่าความเสี่ยงสมมติเพื่ออธิบายรูปแบบ ไม่ใช่ผลพยากรณ์จริง และไม่นำเข้าชีตนี้']];
examples.getRange('A4:L8').values = [labels, ...sampleRows]; format(examples, 'A4:L8', 4);
examples.getRange('A1:L2').format.font = { name: 'Arial', size: 11, color: '#20362E' };
examples.getRange('A1').format.font.bold = true;
examples.getRange('A2').format.wrapText = false;
examples.getRange('A10').values = [['ต้นทางธันวาคม 2025: ล่วงหน้า 1 เดือน = มกราคม 2026 และล่วงหน้า 6 เดือน = มิถุนายน 2026']];
const guideRows = fields.map(field => [field.label, field.description, field.example, field.key]);
guide.getRange('A1:D13').values = [['คอลัมน์ในแม่แบบ', 'ความหมายและวิธีกรอก', 'ตัวอย่างค่า', 'ชื่อเดิมใน rev3'], ...guideRows];
format(guide, 'A1:D13'); guide.getRange('A1:A13').format.columnWidth = 30; guide.getRange('B1:B13').format.columnWidth = 80;
guide.getRange('C1:D13').format.columnWidth = 28; guide.getRange('A2:D13').format.rowHeight = 64;
const notes = [
  ['วิธีใช้', 'กรอกปีและเดือนต้นทางในชีตข้อมูลพยากรณ์ แล้วแทนที่คำว่า ยังไม่กรอก ทั้ง 6 ช่องด้วยผลที่ตรวจสอบแล้ว ช่องสีอ่อนคือช่องที่ต้องกรอก'],
  ['ค่าความเสี่ยง', 'ไม่พบความเสี่ยง = 0, เสี่ยงปานกลาง = 1, เสี่ยงสูง = 2, นอกขอบเขตการศึกษา = ไม่มีค่าพยากรณ์'],
  ['ช่องว่างในไฟล์ต้นฉบับ', 'ช่องว่างของผลพยากรณ์หมายถึงนอกขอบเขตการศึกษา ไม่ใช่ 0 ถ้ายังไม่ทราบผล ให้คงคำว่า ยังไม่กรอก และตรวจต้นทางก่อนนำเข้า'],
  ['จำนวนพื้นที่', 'หนึ่งรอบเดือนต้องครบ 289 ตำบล ใช้รหัสพื้นที่ต้นฉบับเป็นตัวเชื่อมข้อมูล ชื่อพื้นที่เป็นข้อมูลประกอบ'],
  ['ขอบเขตที่เปิดใช้', 'นำเข้าเพื่อตรวจแก้รอบเดือนที่มีอยู่ในคลัง เลือกทีละรอบ การเพิ่มเดือนต้นทางใหม่ยังไม่เปิดใช้'],
  ['กรณีไฟล์มีหลายเดือน', 'เพิ่มแถวครบ 289 ตำบลสำหรับแต่ละเดือน แล้วเลือกรอบที่จะนำเข้าบนหน้าจอ สามารถใช้ไฟล์เดิมนำเข้าเดือนอื่นในครั้งถัดไป'],
  ['ผลของการนำเข้า', 'บันทึกเป็นฉบับร่างก่อน ตรวจค่าผิดรูปแบบและค่าซ้ำที่ขัดแย้งกัน แล้วจึงยืนยันเผยแพร่ เว็บไซต์จะยังใช้ข้อมูลเดิมจนกว่าจะเผยแพร่'],
  ['สถานะชลประทานและชื่อพื้นที่', 'เก็บค่าในไฟล์ไว้เป็นหลักฐาน การนำเข้าครั้งนี้แก้เฉพาะค่าพยากรณ์ ไม่แก้ทะเบียนพื้นที่หรือชลประทานส่วนกลาง'],
  ['CSV', 'CSV มีตารางเดียว คั่นด้วยจุลภาค อัฒภาค หรือแท็บ ใช้ UTF-8 ถ้าภาษาไทยมาจาก Excel รุ่นเก่า ให้เลือกตัวเลือกภาษาบนหน้านำเข้า'],
  ['ไฟล์ที่รองรับ', 'CSV, Excel .xlsx และ .xls ไม่เกิน 20 MB และ 100,000 แถวต่อชีต ไม่รับเซลล์สูตรหรือไฟล์ที่ต้องใช้รหัสผ่าน'],
  ['รหัสและแหล่งอ้างอิง', 'รายชื่อและรหัสพื้นที่อ้างอิงชุด Drought_T1-6_rev03.xlsx ที่ใช้งานอยู่ วันที่เตรียมแม่แบบ 30 กันยายน 2026'],
];
guide.getRange('A15:B25').values = notes; guide.getRange('A15:B25').format = { font: { name: 'Arial', size: 11, color: '#20362E' }, wrapText: true, verticalAlignment: 'center', rowHeight: 58 };
guide.getRange('A15:A25').format.font.bold = true; guide.freezePanes.freezeRows(1);
const directoryRows = areas.map(area => [Number(area.sourceId), area.subdistrictNameTh, area.districtNameTh, area.subdistrictCode, area.sourceTambonEn, area.sourceAmphoeEnCorrected]);
directory.getRange('A1:F290').values = [['รหัสพื้นที่ต้นฉบับ', 'ตำบล', 'อำเภอ', 'รหัสตำบล (อ่านประกอบ)', 'ชื่อตำบลภาษาอังกฤษ', 'ชื่ออำเภอภาษาอังกฤษ'], ...directoryRows];
format(directory, 'A1:F290'); directory.getRange('A2:A290').setNumberFormat('0'); directory.getRange('B1:F290').format.columnWidth = 32;
directory.freezePanes.freezeRows(1);
console.log((await wb.inspect({ kind: 'table', range: 'ข้อมูลพยากรณ์!A1:L3', tableMaxRows: 3, tableMaxCols: 12, maxChars: 2000 })).ndjson);
console.log((await wb.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!', options: { useRegex: true, maxResults: 10 }, maxChars: 1000 })).ndjson);
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(path.join(root, 'src/assets/rev3-import-template.xlsx'));
const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
await fs.writeFile(path.join(root, 'src/assets/rev3-import-template.csv'), '\uFEFF' + [labels, ...rows].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n');
for (const [name, range, file] of [['ข้อมูลพยากรณ์', 'A1:L5', 'data'], ['ตัวอย่าง', 'A1:L10', 'examples'], ['คำอธิบาย', 'A1:D13', 'dictionary'], ['รายชื่อพื้นที่', 'A1:F7', 'areas']]) {
  const image = await wb.render({ sheetName: name, range, scale: 1.5, format: 'png' });
  await fs.writeFile(path.join(root, `artifacts/rev3-import/template-${file}.png`), new Uint8Array(await image.arrayBuffer()));
}
console.log('Saved rev3 template, CSV and four sheet previews');
