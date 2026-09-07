// Build-only chart template. Runtime exports use the browser ExcelJS writer.
import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
import JSZip from 'jszip';
import { JSDOM } from 'jsdom';

const book = Workbook.create();
const sheet = book.worksheets.add('วิเคราะห์');
sheet.showGridLines = false;
sheet.getRange('A1:H37').format.font = { name: 'Arial', size: 11 };
sheet.getRange('A1:H37').format.columnWidth = 17;
sheet.getRange('A1:H37').format.rowHeight = 24;
sheet.getRange('A8:D14').values = [
  ['เดือนพยากรณ์', 'ไม่พบสัญญาณเสี่ยง', 'เสี่ยงปานกลาง', 'เสี่ยงสูง'],
  ...Array.from({ length: 6 }, (_, i) => [`T+${i + 1}`, null, null, null]),
];
const chart = sheet.charts.add('bar', sheet.getRange('A8:D14'));
chart.title = 'จำนวนตำบลแยกตามระดับความเสี่ยง';
chart.titleTextStyle.typeface = 'Arial';
chart.titleTextStyle.fontSize = 14;
chart.legend = { position: 'bottom', textStyle: { typeface: 'Arial', fontSize: 11 } };
chart.xAxis = { axisType: 'textAxis', textStyle: { typeface: 'Arial', fontSize: 11 } };
chart.yAxis = { numberFormatCode: '0', numberFormatSourceLinked: false, textStyle: { typeface: 'Arial', fontSize: 11 } };
['#58ad7c', '#f3bc4c', '#dc5858'].forEach((color, i) => { chart.series.items[i].fill = color; });
chart.setPosition('A17', 'J31');
const output = await SpreadsheetFile.exportXlsx(book);
await fs.mkdir('src/assets', { recursive: true });
await fs.mkdir('artifacts/excel-export', { recursive: true });
await output.save('artifacts/excel-export/chart-template.xlsx');
// Normalize the chart location for ExcelJS's documented round-trip support.
const zip = await JSZip.loadAsync(await fs.readFile('artifacts/excel-export/chart-template.xlsx'));
const oldPath = 'xl/drawings/charts/chart1.xml';
zip.file('xl/charts/chart1.xml', await zip.file(oldPath).async('uint8array'));
zip.remove(oldPath);
for (const [path, attribute, before, after] of [
  ['[Content_Types].xml', 'PartName', '/' + oldPath, '/xl/charts/chart1.xml'],
  ['xl/drawings/_rels/drawing1.xml.rels', 'Target', '/xl/drawings/charts/chart1.xml', '../charts/chart1.xml'],
]) {
  const dom = new JSDOM(await zip.file(path).async('string'), { contentType: 'text/xml' });
  for (const node of dom.window.document.querySelectorAll(`[${attribute}]`)) {
    if (node.getAttribute(attribute) === before) node.setAttribute(attribute, after);
  }
  zip.file(path, dom.serialize());
}
await fs.writeFile('src/assets/forecast-export-template.xlsx', await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log('Created data-free native-chart template');
