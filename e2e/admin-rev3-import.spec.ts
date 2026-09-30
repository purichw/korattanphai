import { test, expect, seedAdminSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { readFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const fields: { key: string; label: string }[] = JSON.parse(readFileSync('src/admin/rev3Fields.json', 'utf8'));
const xlsx = createRequire(resolve('src/admin/readDataFile.ts'))('xlsx');
const labels = fields.map(field => field.label);
async function sampleRows() {
  const archive = JSON.parse(await readFile('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
  return archive.locations.map((area: { sourceId: string; subdistrictNameTh: string; districtNameTh: string }) => [2025, 12, Number(area.sourceId), area.subdistrictNameTh, area.districtNameTh, 'อาศัยน้ำฝน', 'ไม่พบความเสี่ยง', 'เสี่ยงปานกลาง', 'เสี่ยงสูง', 'นอกขอบเขตการศึกษา', '', 2]);
}
function csv(rows: unknown[][]) { return '\uFEFF' + rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n'); }

test('downloads the explained templates and maps a Thai CSV into persisted rev3 corrections', async ({ page, context }, testInfo) => {
  test.setTimeout(90000);
  const db = await cmsTestDatabase(context, { references: true, forecasts: true });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await seedAdminSession(page); await page.goto('/admin');
    await page.getByRole('button', { name: 'นำเข้าข้อมูล', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'เริ่มจากแม่แบบพยากรณ์ rev3' })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('link', { name: 'แม่แบบ Excel พร้อมคำอธิบาย' }).click();
    const downloaded = await downloadPromise;
    expect(createHash('sha256').update(await readFile((await downloaded.path())!)).digest('hex'))
      .toBe(createHash('sha256').update(await readFile('src/assets/rev3-import-template.xlsx')).digest('hex'));
    await mkdir('artifacts/rev3-import', { recursive: true });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `artifacts/rev3-import/${testInfo.project.name}-upload.png` });
    await dialog.getByText('ความหมายของ 12 คอลัมน์และตัวอย่าง', { exact: true }).click();
    await expect(dialog.getByText('ตัวอย่าง: 2025', { exact: true })).toBeVisible();
    await expect(dialog.getByText('ตัวอย่าง: ในเมือง', { exact: true })).toBeVisible();
    await dialog.getByText('ความหมายของ 12 คอลัมน์และตัวอย่าง', { exact: true }).click();
    await page.getByLabel('ไฟล์ข้อมูล', { exact: true }).setInputFiles({ name: 'broken.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b,c\n1,2') });
    await expect(dialog.getByRole('alert')).toContainText('จำนวนช่องไม่ตรง');
    const source = csv([[...labels.slice(0, 1), 'เดือนของข้อมูล', ...labels.slice(2)], ...await sampleRows()]);
    await page.getByLabel('ไฟล์ข้อมูล', { exact: true }).setInputFiles({ name: 'ข้อมูลพยากรณ์.csv', mimeType: 'text/csv', buffer: Buffer.from(source) });
    await expect(dialog.getByText('ตรวจการจับคู่คอลัมน์ (11 / 12 ช่อง)', { exact: true })).toBeVisible();
    await dialog.getByRole('combobox', { name: 'คอลัมน์ เดือนต้นทาง (1–12)', exact: true }).click();
    await page.getByRole('option', { name: 'เดือนของข้อมูล', exact: true }).click();
    await expect(dialog.getByText('ตรวจการจับคู่คอลัมน์ (12 / 12 ช่อง)', { exact: true })).toBeVisible();
    // Collapse if mapping remains open after the final column is selected.
    const mapping = dialog.locator('.cms-import-mapping');
    if (await mapping.getAttribute('open') !== null) await mapping.locator('summary').click();
    await page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true }).click();
    await expect(dialog).toContainText('1734 ค่าพยากรณ์');
    await page.screenshot({ path: `artifacts/rev3-import/${testInfo.project.name}-review.png` });
    await page.getByRole('button', { name: 'สร้างฉบับร่าง', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    const id = new URL(page.url()).searchParams.get('draft')!;
    await page.getByRole('button', { name: 'ตรวจข้อมูล', exact: true }).click();
    await expect(page.getByText('ผ่านการตรวจรูปแบบข้อมูล', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('cell', { name: 'ไม่พบความเสี่ยง', exact: true }).first()).toBeVisible();
    const saved = await db.operation('get', { id });
    expect(saved.payload.predictions.slice(0, 6).map((row: { riskCode: number | null }) => row.riskCode)).toEqual([0, 1, 2, null, null, 2]);
    expect(saved.payload.predictions[0].targetMonth).toBe('2026-01');
    expect(saved.payload.sourceImport.rows[0].values['ความเสี่ยงล่วงหน้า 1 เดือน']).toBe('ไม่พบความเสี่ยง');
    expect(saved.payload.sourceImport.rows[0].sourceRow).toBe(2);
    expect(errors).toEqual([]);
  } finally { await db.close(); }
});

for (const format of ['xlsx', 'xls'] as const) test(`uploads actual ${format} files with Thai rev3 columns`, async ({ page, context }) => {
  test.setTimeout(90000);
  const db = await cmsTestDatabase(context, { references: true, forecasts: true });
  try {
    const book = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([labels, ...await sampleRows()]), 'ข้อมูลพยากรณ์');
    const bytes = xlsx.write(book, { type: 'buffer', bookType: format === 'xls' ? 'biff8' : 'xlsx' });
    await seedAdminSession(page); await page.goto('/admin');
    await page.getByRole('button', { name: 'นำเข้าข้อมูล', exact: true }).click();
    await page.getByLabel('ไฟล์ข้อมูล', { exact: true }).setInputFiles({ name: `forecast.${format}`, mimeType: 'application/octet-stream', buffer: bytes });
    await expect(page.getByText('ตรวจการจับคู่คอลัมน์ (12 / 12 ช่อง)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true }).click();
    await page.getByRole('button', { name: 'สร้างฉบับร่าง', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    const saved = await db.operation('get', { id: new URL(page.url()).searchParams.get('draft')! });
    expect(saved.payload.predictions).toHaveLength(1734);
    expect(saved.payload.predictions.slice(0, 6).map((row: { riskCode: number | null }) => row.riskCode)).toEqual([0, 1, 2, null, null, 2]);
    expect(saved.payload.sourceImport.rows).toHaveLength(289);
    expect(saved.source_filename).toBe(`forecast.${format}`);
  } finally { await db.close(); }
});
