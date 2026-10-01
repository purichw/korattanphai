import { test, expect, seedAuthSession, seedAdminSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { readFile } from 'node:fs/promises';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

test.skip(process.env.PLAYWRIGHT_REFERENCE_BACKEND !== 'cms', 'Requires the dedicated CMS build and database fixture');

test('editing a filtered source preserves hidden rows through reload, publication and the public CMS bundle', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true });
  const errors: string[] = []; const reads: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('ktp_cms_reference_bundle')) reads.push(request.postData() ?? ''); });
  try {
    const archive = JSON.parse(await readFile('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
    const overview = JSON.parse(await readFile('src/data/generated/forecast-overview-t1.json', 'utf8'));
    await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
      const query = route.request().postDataJSON();
      return route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
    });
    await seedAdminSession(page); await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'ข้อมูลประกอบเว็บไซต์', exact: true })).toBeVisible();
    expect(reads).toHaveLength(1); expect(JSON.parse(reads[0]).p_ids).toHaveLength(34);
    await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('แหล่งข้อมูลอ้างอิง');
    await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
    await page.getByRole('button', { name: 'สร้างฉบับแก้ไข', exact: true }).click();
    await expect(page).toHaveURL(/resource=/);
    await expect(page.getByRole('heading', { name: 'แหล่งข้อมูลอ้างอิง', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'แก้ไข', exact: true })).toHaveCount(5);
    await expect(page.getByRole('columnheader', { name: 'การใช้งาน', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'อ้างอิงประกอบ', exact: true })).toHaveCount(5);
    const id = new URL(page.url()).searchParams.get('resource')!;
    const draft = await database.operation('resource:get', { id });
    const originalPayload = structuredClone(draft.payload);
    expect(originalPayload).toHaveLength(9);
    expect(originalPayload[3].id).toBe('SRC-RID');
    await page.locator('.cms-reference-table tbody tr').filter({ has: page.getByRole('cell', { name: originalPayload[3].nameTh, exact: true }) })
      .getByRole('button', { name: 'แก้ไข', exact: true }).click();
    const updated = `${originalPayload[3].nameTh} [CMS isolated test]`;
    const expectedPayload = structuredClone(originalPayload);
    expectedPayload[3].nameTh = updated;
    await page.getByLabel('ชื่อแหล่งข้อมูล', { exact: true }).fill(updated);
    await page.getByLabel('เหตุผลการแก้ไขข้อมูลอ้างอิง', { exact: true }).fill('ตรวจแก้ข้อมูลอ้างอิงในฐานทดสอบ');
    await page.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }).click();
    await expect(page.getByText('บันทึกข้อมูลอ้างอิงฉบับร่างแล้ว', { exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByRole('cell', { name: updated, exact: true })).toBeVisible();
    expect((await database.operation('resource:get', { id })).payload).toEqual(expectedPayload);
    expect((await database.operation('resource:get', { id: draft.base_id })).payload).toEqual(originalPayload);
    await expect(page.locator('.cms-reference-table tbody tr')).toHaveCount(5);
    await page.screenshot({ path: `artifacts/admin-cms-20260927/${testInfo.project.name}-references.png`, fullPage: true });
    await page.getByRole('button', { name: 'เผยแพร่ข้อมูลอ้างอิง', exact: true }).click();
    await page.getByLabel('เหตุผลเผยแพร่ข้อมูลอ้างอิง', { exact: true }).fill('ยืนยันในฐานทดสอบ');
    await page.getByRole('button', { name: 'ยืนยันเผยแพร่ข้อมูลอ้างอิง', exact: true }).click();
    await expect(page.getByText('เผยแพร่ข้อมูลอ้างอิงแล้ว', { exact: true })).toBeVisible();
    const published = await database.operation('resource:get', { id });
    expect(published.state).toBe('published');
    expect(published.payload).toEqual(expectedPayload);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'แหล่งข้อมูลอ้างอิง', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: updated, exact: true })).toBeVisible();
    await seedAuthSession(page);
    const bundleReady = page.waitForResponse(response => response.url().includes('ktp_cms_reference_bundle') && response.ok());
    await page.goto('/');
    const bundle = await (await bundleReady).json();
    expect(bundle['canonical/source_registry']).toEqual(expectedPayload);
    await expect(page.locator('.nr-map-panel .nr-map-shape').first()).toBeVisible({ timeout: 30000 });
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
