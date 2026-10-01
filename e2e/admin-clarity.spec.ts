import { test, expect, seedAdminSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { mkdir, readFile } from 'node:fs/promises';
import { createAdminWorkbook } from '../src/admin/workbook';

test('operators see explained real resources and can inspect them without creating drafts', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true, forecasts: true });
  const errors: string[] = []; const clones: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('action=resource-clone')) clones.push(request.url()); });
  try {
    await seedAdminSession(page); await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'ข้อมูลประกอบเว็บไซต์', exact: true })).toBeVisible();
    await expect(page.locator('.cms-resource-group')).toHaveCount(3);
    for (const name of ['ข้อมูลพื้นที่', 'ชั้นข้อมูลแผนที่', 'แหล่งข้อมูลอ้างอิง']) {
      await expect(page.locator('.cms-reference').getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await expect(page.locator('.cms-workspace')).not.toContainText('canonical/');
    await expect(page.locator('.cms-workspace')).not.toContainText('farmer profile');
    await expect(page.locator('.cms-workspace')).not.toContainText('advisory');
    await expect(page.locator('.cms-workspace')).not.toContainText('drought-rev03-');
    await expect(page.getByRole('button', { name: 'ตรวจแก้รอบนี้', exact: true })).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    await mkdir('artifacts/admin-no-code', { recursive: true });
    await page.screenshot({ path: `artifacts/admin-no-code/${testInfo.project.name}-home.png`, fullPage: true });
    await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('รายชื่ออำเภอและตำบล');
    await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'รายชื่ออำเภอและตำบล', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ในเมือง', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'สร้างฉบับแก้ไข', exact: true })).toHaveCount(0);
    // Retained resources remain inspectable and exportable through existing deep links.
    const catalog = await database.operation('resource:catalog', {});
    const station = catalog.find((resource: { resource_key: string }) => resource.resource_key === 'canonical/nakhon_ratchasima/rainfall_stations');
    const original = await database.operation('resource:get', { id: station.id });
    await page.goto(`/admin?resource=${station.id}`);
    await expect(page.getByRole('heading', { name: 'รายชื่อและพิกัดสถานีฝน', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'บ้านเทพนิมิตร', exact: true })).toBeVisible();
    await expect(page.getByText('หน้า 1 / 3', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'สร้างฉบับแก้ไข', exact: true })).toHaveCount(0);
    await page.locator('summary').filter({ hasText: 'ประวัติและไฟล์ต้นฉบับ' }).click();
    const downloadReady = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ดาวน์โหลดไฟล์ข้อมูล (JSON)', exact: true }).click();
    const download = await downloadReady;
    expect(download.suggestedFilename()).toMatch(/^rainfall_stations_r\d+\.json$/);
    expect(JSON.parse(await readFile((await download.path())!, 'utf8'))).toEqual(original.payload);
    expect(clones).toEqual([]);
    await page.getByRole('button', { name: 'กลับหน้าจัดการข้อมูล', exact: true }).click();
    await page.getByRole('button', { name: 'นำเข้าข้อมูล', exact: true }).click();
    await page.getByRole('combobox', { name: /^ประเภทข้อมูล/ }).click();
    await expect(page.getByRole('option', { name: 'ผลพยากรณ์จากแบบจำลอง', exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: 'ข้อมูลสถานีตรวจวัด', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('ยังไม่ใช้สร้างพยากรณ์หรือแสดงบนแผนที่อัตโนมัติ');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await database.close(); }
});

test('a no-code forecast correction preserves area and month and distinguishes out of scope from zero', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true, forecasts: true });
  try {
    await seedAdminSession(page); await page.goto('/admin');
    await page.getByRole('button', { name: 'ตรวจแก้รอบนี้', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    const id = new URL(page.url()).searchParams.get('draft')!;
    const original = await database.operation('get', { id });
    const row = original.payload.predictions[0];
    await page.getByLabel('ค้นหารายการข้อมูล').fill('ในเมือง');
    await page.getByRole('button', { name: 'แก้ไขแถว 1', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('ต.ในเมือง');
    await expect(dialog).not.toContainText('riskCode');
    await expect(dialog.getByRole('textbox', { name: /subdistrictCode|targetMonth/ })).toHaveCount(0);
    await page.getByRole('combobox', { name: /^ผลพยากรณ์/ }).click();
    await page.getByRole('option', { name: 'นอกขอบเขตการศึกษา', exact: true }).click();
    await page.getByLabel('เหตุผลการแก้ไข', { exact: true }).fill('ตรวจสถานะนอกขอบเขตจากต้นฉบับในฐานทดสอบ');
    await mkdir('artifacts/admin-no-code', { recursive: true });
    await page.screenshot({ path: `artifacts/admin-no-code/${testInfo.project.name}-forecast-form.png` });
    await page.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }).click();
    await expect(page.getByText('บันทึกฉบับร่างแล้ว', { exact: true })).toBeVisible();
    await page.reload();
    let saved = await database.operation('get', { id });
    expect(saved.payload.predictions[0]).toEqual({ ...row, status: 'out_of_scope', riskCode: null });
    await page.getByRole('button', { name: 'แก้ไขแถว 1', exact: true }).click();
    await page.getByRole('combobox', { name: /^ผลพยากรณ์/ }).click();
    await page.getByRole('option', { name: 'ไม่พบความเสี่ยง', exact: true }).click();
    await page.getByLabel('เหตุผลการแก้ไข', { exact: true }).fill('ตรวจค่าศูนย์ในฐานทดสอบ');
    await page.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }).click();
    await expect(page.getByText('บันทึกฉบับร่างแล้ว', { exact: true })).toBeVisible();
    saved = await database.operation('get', { id });
    expect(saved.payload.predictions[0]).toEqual({ ...row, status: 'predicted', riskCode: 0 });
    expect((await database.operation('original', { id })).payload.predictions[0]).toEqual(row);
  } finally { await database.close(); }
});

test('an exported station workbook is recognized without choosing technical import fields', async ({ page, context }) => {
  const database = await cmsTestDatabase(context, { references: true, forecasts: true });
  const payload = { schemaVersion: 1, sourceId: 'station-roundtrip', batchId: 'roundtrip-001', observations: [
    { stationId: '001', observedAt: '2026-09-01T07:00:00+07:00', metric: 'rainfall', value: 0,
      unit: 'mm', aggregation: 'sum', periodMinutes: 60, quality: 'reported', sourceRecordId: '0001' },
  ] };
  try {
    await seedAdminSession(page); await page.goto('/admin');
    await page.getByRole('button', { name: 'นำเข้าข้อมูล', exact: true }).click();
    const bytes = await createAdminWorkbook('station', payload);
    await page.getByLabel('ไฟล์ข้อมูล', { exact: true }).setInputFiles({ name: 'station.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(bytes) });
    await expect(page.getByRole('combobox', { name: /^ประเภทข้อมูล/ })).toContainText('ข้อมูลสถานีตรวจวัด');
    await page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true }).click();
    await page.getByRole('button', { name: 'สร้างฉบับร่าง', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    const id = new URL(page.url()).searchParams.get('draft')!;
    const saved = await database.operation('get', { id });
    expect(saved.kind).toBe('station');
    expect(saved.payload).toEqual(payload);
  } finally { await database.close(); }
});
