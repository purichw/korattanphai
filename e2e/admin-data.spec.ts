import { test, expect, seedAuthSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import ExcelJS from '@protobi/exceljs';
import { readFile } from 'node:fs/promises';

test('CMS import, repair, reload, export, conflict and acceptance use the persisted contract', async ({ page, context }, testInfo) => {
  test.setTimeout(90000);
  const database = await cmsTestDatabase(context, { references: true });
  const runtimeErrors: string[] = []; page.on('pageerror', error => runtimeErrors.push(error.message));
  try {
    await seedAuthSession(page);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'ยังไม่มีรายการนำเข้า' })).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'นำเข้าข้อมูล', exact: true }).first().click();
    const batch = { schemaVersion: 1, sourceId: 'cms-test', batchId: 'operator-test-v1', observations: [{
      stationId: 'TEST-001', observedAt: '2026-09-01T07:00:00+07:00', metric: 'rainfall', value: null,
      unit: 'mm', aggregation: 'sum', periodMinutes: 60, quality: 'reported', sourceRecordId: '0001',
    }] };
    await page.getByLabel('ไฟล์ข้อมูล', { exact: true }).setInputFiles({ name: 'rainfall-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(batch)) });
    await page.getByRole('button', { name: 'สร้างฉบับร่าง', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\?draft=/);
    await page.getByRole('button', { name: 'ตรวจข้อมูล', exact: true }).click();
    await expect(page.getByText('พบ 1 จุดที่ต้องตรวจสอบ', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ยืนยันรับเข้าระบบ', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'แก้ไขแถว 1', exact: true }).click();
    await page.getByLabel('ไม่มีค่า (null)', { exact: true }).uncheck();
    await page.getByLabel('ค่าตรวจวัด · value', { exact: true }).fill('0');
    await page.getByLabel('เหตุผลการแก้ไข', { exact: true }).fill('ตรวจค่าศูนย์จากต้นทางแล้ว');
    await expect(page.getByLabel('เหตุผลการแก้ไข', { exact: true })).toBeFocused();
    expect(await page.getByRole('dialog').evaluate(element => element.getBoundingClientRect().height <= window.innerHeight)).toBe(true);
    await page.screenshot({ path: `artifacts/admin-cms-20260927/${testInfo.project.name}-edit.png` });
    await page.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }).click();
    await expect(page.getByText('บันทึกฉบับร่างแล้ว', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('cell', { name: '0', exact: true })).toBeVisible({ timeout: 30000 });
    const id = new URL(page.url()).searchParams.get('draft')!;
    const original = await database.operation('original', { id });
    expect(original.payload.observations[0].value).toBeNull();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/r2.json$/);
    await page.getByRole('button', { name: 'แก้ไขแถว 1', exact: true }).click();
    await page.getByLabel('ค่าตรวจวัด · value', { exact: true }).fill('5');
    await page.getByLabel('เหตุผลการแก้ไข', { exact: true }).fill('ทดสอบความขัดแย้ง');
    const current = await database.operation('get', { id });
    await database.operation('edit', { id, revision: current.revision, reason: 'Concurrent edit fixture', payload: current.payload });
    await page.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('อีกหน้าต่าง');
    await expect(page.getByLabel('ค่าตรวจวัด · value', { exact: true })).toHaveValue('5');
    await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
    await page.getByRole('button', { name: 'ปิดโดยไม่บันทึก', exact: true }).click();
    await page.getByRole('button', { name: 'โหลดฉบับล่าสุด', exact: true }).click();
    await page.getByRole('button', { name: 'ตรวจข้อมูล', exact: true }).click();
    await expect(page.getByText('ผ่านการตรวจรูปแบบข้อมูล', { exact: true })).toBeVisible();
    await page.screenshot({ path: `artifacts/admin-cms-20260927/${testInfo.project.name}-validated.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'ยืนยันรับเข้าระบบ', exact: true }).click();
    await page.getByLabel('บันทึกการตรวจสอบ', { exact: true }).fill('ยืนยันข้อมูลทดสอบ');
    await page.getByRole('dialog').getByRole('button', { name: 'ยืนยันรับเข้าระบบ', exact: true }).click();
    await expect(page.getByText('รับชุดข้อมูลเข้าระบบแล้ว', { exact: true })).toBeVisible();
    expect((await database.operation('get', { id })).state).toBe('accepted');
    expect((await database.db.query('select payload from public.model_input_batches')).rows[0].payload.observations[0].value).toBe(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'แก้ไขแถว 1', exact: true })).toBeDisabled({ timeout: 30000 });
    expect(runtimeErrors).toEqual([]);
  } finally { await database.close(); }
});

test('original T+ workbook imports through a worker and preserves conflicts for no-code repair', async ({ page, context }) => {
  test.setTimeout(90000);
  const database = await cmsTestDatabase(context, { forecasts: true, references: true });
  try {
    const archive = JSON.parse(await readFile('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Master_Data_Drought_Final');
    const headers = ['Year', 'Month', 'ID', 'TAMBON_E', 'AMPHOE_E', 'Irrigation_Status', ...Array.from({ length: 6 }, (_, index) => `Pred_Risk_T+${index + 1}`)];
    sheet.addRow(headers);
    for (const area of archive.locations) sheet.addRow([2025, 12, area.sourceId, area.subdistrictNameEn, area.districtNameEn, 'RainFed', ...archive.packedRiskByTargetMonth['2025-12'][area.subdistrictCode]]);
    const repeated = sheet.getRow(3).values as ExcelJS.CellValue[];
    sheet.addRow([...repeated.slice(1, 7), 2, ...repeated.slice(8)]);
    await seedAuthSession(page); await page.goto('/admin');
    await page.getByRole('button', { name: 'นำเข้าข้อมูล', exact: true }).first().click();
    await page.getByLabel('ไฟล์ข้อมูล', { exact: true }).setInputFiles({ name: 'normalized-test.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
    await expect(page.getByRole('heading', { name: 'พยากรณ์ T+1–T+6 จากต้นฉบับ', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true }).click();
    await page.getByRole('button', { name: 'สร้างฉบับร่าง', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    const id = new URL(page.url()).searchParams.get('draft')!;
    const draft = await database.operation('get', { id });
    expect(draft.payload.sourceImport.rows).toHaveLength(290);
    expect(draft.payload.sourceImport.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(draft.payload.predictions).toHaveLength(1734);
    await page.getByRole('button', { name: 'ตรวจข้อมูล', exact: true }).click();
    await expect(page.getByRole('button', { name: 'เผยแพร่รุ่นใหม่', exact: true })).toBeDisabled();
    expect(draft.payload.predictions.some((row: { status: string }) => row.status === 'unresolved')).toBe(true);
  } finally { await database.close(); }
});

test('CMS reviews a published forecast origin and publishes an immutable new version', async ({ page, context }, testInfo) => {
  test.setTimeout(90000);
  const database = await cmsTestDatabase(context, { forecasts: true, references: true });
  try {
    await seedAuthSession(page); await page.goto('/admin');
    await page.getByRole('button', { name: 'ตรวจแก้รอบนี้', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    const id = new URL(page.url()).searchParams.get('draft')!;
    const before = await database.operation('get', { id });
    const index = before.payload.predictions.findIndex((row: { status: string }) => row.status === 'predicted');
    const cell = before.payload.predictions[index];
    await page.getByLabel('ค้นหารายการข้อมูล').fill(cell.subdistrictCode);
    await page.getByRole('button', { name: `แก้ไขแถว ${index + 1}`, exact: true }).click();
    await page.getByLabel('ระดับความเสี่ยง (0/1/2) · riskCode', { exact: true }).fill(cell.riskCode === 2 ? '1' : '2');
    await page.getByLabel('เหตุผลการแก้ไข', { exact: true }).fill('ทดสอบแก้ไขค่าพยากรณ์ในฐานข้อมูลแยก');
    await page.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }).click();
    await expect(page.getByText('บันทึกฉบับร่างแล้ว', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'ตรวจข้อมูล', exact: true }).click();
    await expect(page.getByText('ผ่านการตรวจรูปแบบข้อมูล', { exact: true })).toBeVisible();
    await page.screenshot({ path: `artifacts/admin-cms-20260927/${testInfo.project.name}-forecast.png`, fullPage: true });
    await page.getByRole('button', { name: 'เผยแพร่รุ่นใหม่', exact: true }).click();
    await page.getByLabel('บันทึกการตรวจสอบ', { exact: true }).fill('เผยแพร่เฉพาะฐานทดสอบ');
    await page.getByRole('button', { name: 'ยืนยันเผยแพร่', exact: true }).click();
    await expect(page.getByText('เผยแพร่พยากรณ์รุ่นใหม่แล้ว', { exact: true })).toBeVisible();
    const catalog = await database.operation('forecast:catalog', {});
    expect(catalog.revision.datasetId).not.toBe(before.payload.baseDatasetId);
    const original = await database.operation('forecast:read', { datasetId: before.payload.baseDatasetId, originMonth: before.payload.originMonth });
    const published = await database.operation('forecast:read', { datasetId: catalog.revision.datasetId, originMonth: before.payload.originMonth });
    expect(original.predictions[index]).toEqual(cell);
    expect(published.predictions[index].riskCode).toBe(cell.riskCode === 2 ? 1 : 2);
  } finally { await database.close(); }
});
