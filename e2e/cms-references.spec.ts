import { test, expect, seedAuthSession, seedAdminSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { readFile } from 'node:fs/promises';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

test.skip(process.env.PLAYWRIGHT_REFERENCE_BACKEND !== 'cms', 'Requires the dedicated CMS build and database fixture');

test('CMS resource edit survives reload and the public runtime reads the published revision without bundled fallback', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true });
  const errors: string[] = []; const reads: string[] = [];
  const readValues: unknown[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('ktp_cms_reference_bundle')) reads.push(request.postData() ?? ''); });
  page.on('response', async response => { if (response.url().includes('ktp_cms_reference_bundle') && response.ok()) readValues.push(...Object.values(await response.json())); });
  try {
    await seedAdminSession(page); await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'ข้อมูลประกอบเว็บไซต์', exact: true })).toBeVisible();
    expect(reads).toHaveLength(1); expect(JSON.parse(reads[0]).p_ids).toHaveLength(34);
    await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('แหล่งข้อมูลอ้างอิง');
    await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
    await page.getByRole('button', { name: 'สร้างฉบับแก้ไข', exact: true }).click();
    await expect(page).toHaveURL(/resource=/);
    await expect(page.getByRole('heading', { name: 'แหล่งข้อมูลอ้างอิง', exact: true })).toBeVisible();
    const id = new URL(page.url()).searchParams.get('resource')!;
    const draft = await database.operation('resource:get', { id });
    const editable = Object.entries(draft.payload[0]).find(([key, value]) => key === 'nameTh' && typeof value === 'string')!;
    const label = 'ชื่อแหล่งข้อมูล';
    await page.getByRole('button', { name: 'แก้ไข', exact: true }).first().click();
    const updated = `${editable[1]} [CMS isolated test]`;
    await page.getByLabel(label, { exact: true }).fill(updated);
    await page.getByLabel('เหตุผลการแก้ไขข้อมูลอ้างอิง', { exact: true }).fill('ตรวจแก้ข้อมูลอ้างอิงในฐานทดสอบ');
    await page.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }).click();
    await expect(page.getByText('บันทึกข้อมูลอ้างอิงฉบับร่างแล้ว', { exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByRole('cell', { name: updated, exact: true })).toBeVisible();
    await page.screenshot({ path: `artifacts/admin-cms-20260927/${testInfo.project.name}-references.png`, fullPage: true });
    await page.getByRole('button', { name: 'เผยแพร่ข้อมูลอ้างอิง', exact: true }).click();
    await page.getByLabel('เหตุผลเผยแพร่ข้อมูลอ้างอิง', { exact: true }).fill('ยืนยันในฐานทดสอบ');
    await page.getByRole('button', { name: 'ยืนยันเผยแพร่ข้อมูลอ้างอิง', exact: true }).click();
    await expect(page.getByText('เผยแพร่ข้อมูลอ้างอิงแล้ว', { exact: true })).toBeVisible();
    readValues.length = 0; await page.reload();
    await expect(page.getByRole('heading', { name: 'แหล่งข้อมูลอ้างอิง', exact: true })).toBeVisible();
    const value = readValues.find((value): value is Record<string, string>[] => Array.isArray(value) && value[0]?.[editable[0]] === updated)!;
    expect(value[0][editable[0]]).toBe(updated);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { await database.close(); }
});

test('map geometry comes from the pinned CMS revision and zoom behavior is preserved', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Shared loader integration is covered once; responsive editing is covered separately');
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true });
  const staticGeometry: string[] = [];
  const geometryReads: string[] = [];
  try {
    const archive = JSON.parse(await readFile('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
    const overview = JSON.parse(await readFile('src/data/generated/forecast-overview-t1.json', 'utf8'));
    await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
      const query = route.request().postDataJSON();
      return route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
    });
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/geodata/')) staticGeometry.push(request.url());
      if (request.url().includes('ktp_cms_reference_read')) geometryReads.push(request.postData() ?? '');
    });
    await seedAuthSession(page); await page.goto('/soeng-sang?mapLayer=forecast-archive&target=2025-12&horizon=1');
    const map = page.locator('.nr-map-panel');
    await expect(map.locator('.nr-map-shape').first()).toBeVisible({ timeout: 30000 });
    const layer = map.locator('.nr-map-transform-layer');
    const initial = await layer.getAttribute('transform');
    await map.getByTitle('ขยายแผนที่', { exact: true }).click();
    await expect(layer).not.toHaveAttribute('transform', initial!);
    expect(geometryReads.length).toBeGreaterThanOrEqual(1); expect(staticGeometry).toEqual([]);
    await page.screenshot({ path: 'artifacts/admin-cms-20260927/cms-map.png', fullPage: true });
  } finally { await database.close(); }
});

test('incomplete CMS migration fails closed without serving bundled references', async ({ page, context }) => {
  test.setTimeout(60000);
  await context.route('https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_cms_reference_catalog', route => route.fulfill({ json: [] }));
  await seedAdminSession(page); await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'ไม่สามารถแสดงหน้านี้ได้', exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'จัดการข้อมูล', exact: true })).toHaveCount(0);
});
