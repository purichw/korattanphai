import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import ExcelJS from '@protobi/exceljs';
import JSZip from 'jszip';
import { expect } from '@playwright/test';

export async function smokeExcelExport({ page, viewport, output, archive }) {
  const origin = '2025-12';
  const districtCode = viewport === 'desktop' ? '30' : '3003';
  const locations = archive.locations.filter(row => districtCode === '30' || row.districtCode === districtCode);
  const districts = [...new Set(locations.map(row => row.districtCode))].sort();
  const initialUrl = page.url();
  if (viewport === 'mobile') await page.getByRole('button', { name: 'เปิดเมนูหลัก' }).click();
  await page.getByRole('button', { name: 'ส่งออก Excel', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'ส่งออกคลังคำพยากรณ์ย้อนหลัง' });
  const downloadButton = dialog.getByRole('button', { name: 'ดาวน์โหลด Excel' });
  await expect(dialog.getByRole('button', { name: 'ตรวจข้อมูลก่อนส่งออก' })).toBeEnabled();
  if (districtCode !== '30') {
    await dialog.getByRole('combobox', { name: /^พื้นที่ / }).click();
    await page.getByRole('option', { name: 'อำเภอเสิงสาง', exact: true }).click();
  }
  await expect(dialog).toContainText('ม.ค. 2569 – มิ.ย. 2569');
  await dialog.getByRole('button', { name: 'ตรวจข้อมูลก่อนส่งออก' }).click();
  await expect(downloadButton).toBeEnabled();
  await page.screenshot({ path: path.join(output, `${viewport}-excel-export.png`), fullPage: true });
  assert.equal(await dialog.evaluate(node => node.scrollWidth > node.clientWidth), false, 'Export dialog overflow');
  const event = page.waitForEvent('download', { timeout: 60_000 });
  await downloadButton.click();
  const download = await event;
  const file = path.join(output, `${viewport}-forecast.xlsx`);
  await download.saveAs(file);
  assert.equal(await download.failure(), null);
  assert.ok(download.suggestedFilename().startsWith(`Korat_Drought_${origin}_${districtCode}_all_T1-T6_`));
  assert.ok(download.suggestedFilename().endsWith('.xlsx'));
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  assert.ok(book.worksheets.length >= 9);
  const tambons = book.getWorksheet('รายตำบล');
  const summary = book.getWorksheet('สรุปอำเภอ');
  const rowsByCode = new Map();
  tambons.eachRow((row, index) => { if (index > 4) rowsByCode.set(row.getCell(4).value, row); });
  assert.deepEqual([...rowsByCode.keys()].sort(), locations.map(row => row.subdistrictCode).sort());
  for (const location of locations) {
    const row = rowsByCode.get(location.subdistrictCode);
    assert.equal(row.getCell(1).value, location.sourceId);
    assert.equal(row.getCell(2).value, location.districtCode);
    for (let h = 0; h < 6; h++) {
      assert.equal(row.getCell(h + 8).value, archive.packedRiskByTargetMonth[origin][location.subdistrictCode][h] ?? 'นอกขอบเขตการศึกษา', `${location.subdistrictCode} T+${h + 1}`);
    }
  }
  assert.equal(summary.rowCount, districts.length + 4);
  for (let index = 0; index < districts.length; index++) {
    const row = summary.getRow(index + 5);
    assert.equal(row.getCell(1).value, districts[index]);
    const members = locations.filter(location => location.districtCode === districts[index]);
    for (let h = 0; h < 6; h++) {
      const risks = members.map(location => archive.packedRiskByTargetMonth[origin][location.subdistrictCode][h]).filter(value => value !== null);
      assert.equal(row.getCell(h + 5).value, risks.length ? Math.max(...risks) : 'นอกขอบเขตการศึกษา');
    }
  }
  assert.equal(book.getWorksheet('ฐาน Pivot').rowCount, locations.length * 6 + 1);
  assert.match(book.getWorksheet('วิเคราะห์').getCell('C9').value.formula, /^COUNTIFS\(/);
  assert.equal(book.getWorksheet('วิเคราะห์').getCell('B4').dataValidation.type, 'list');
  assert.ok(book.getWorksheet('ที่มาและนิยาม').getSheetValues().flat().includes(archive.meta.datasetVersion));
  const zip = await JSZip.loadAsync(await fs.readFile(file));
  assert.ok(zip.file('xl/charts/chart1.xml'), 'Native chart is present');
  assert.ok(Object.keys(zip.files).some(name => /^xl\/pivotTables\/pivotTable\d+\.xml$/.test(name)), 'Native pivot is present');
  await dialog.getByRole('button', { name: 'ปิด', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  assert.equal(page.url(), initialUrl, 'Export does not change the map selection');
  return { viewport, excelExport: 'passed', districtCode, tambons: locations.length, verifiedValues: locations.length * 6, districtSummaries: districts.length, nativeChart: true, nativePivot: true };
}
