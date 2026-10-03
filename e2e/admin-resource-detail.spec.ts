import { test, expect, seedAdminSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { AREA_NAMES_KEY, AREA_BOUNDARIES_KEY } from '../src/admin/areaModel';
import type { Page } from '@playwright/test';

test.use({ actionTimeout: 10000 });

async function choose(page: Page, label: string, value: string) {
  const select = page.getByRole('combobox', { name: new RegExp(`^${label}`) });
  if (!await select.isVisible()) await page.getByRole('button', { name: /^ตัวกรอง/ }).click();
  await select.click(); await page.getByRole('option', { name: value, exact: true }).click();
  await expect(select).toHaveAttribute('aria-expanded', 'false');
  await expect(select).toBeFocused();
}
async function prepareCapture(page: Page) {
  await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur?.(); window.scrollTo(0, 0); });
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
}
async function downloaded(page: Page, button: string) {
  const ready = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  const file = await ready;
  return { name: file.suggestedFilename(), text: await readFile((await file.path())!, 'utf8') };
}

test('unified areas group, filter, inspect, map and export the same CMS records without writes', async ({ page, context }, info) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true });
  const errors: string[] = []; const writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const action = new URL(request.url()).searchParams.get('action');
    if (action && /clone|edit|publish|create|accept/.test(action)) writes.push(action);
  });
  try {
    const catalog = await database.operation('resource:catalog', {});
    const names = catalog.find((item: { resource_key: string }) => item.resource_key === AREA_NAMES_KEY);
    const boundaries = catalog.find((item: { resource_key: string }) => item.resource_key === AREA_BOUNDARIES_KEY);
    const original = await database.operation('resource:get', { id: boundaries.id });
    await seedAdminSession(page); await page.goto('/admin');
    await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('รายชื่ออำเภอและตำบล');
    await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`resource=${names.id}`));
    await expect(page.getByRole('heading', { name: 'ข้อมูลพื้นที่', level: 1 })).toBeVisible();
    await expect(page.locator('.cms-area-results')).toContainText('พบ 289 จาก 289 รายการ · 32 อำเภอ');
    await expect(page.locator('.cms-area-group')).toHaveCount(4);
    await expect(page.getByText('หน้า 1 / 8', { exact: true })).toBeVisible();
    await expect(page.locator('.cms-area-group').first().locator('tbody tr')).toHaveCount(25);
    await expect(page.locator('.cms-area-table input')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.brand-mark img').evaluate((image: HTMLImageElement) => image.decode());
    const layout = await page.evaluate(() => {
      const scroll = document.querySelector('.cms-area-groups')!;
      return { height: document.documentElement.scrollHeight, historyBottom: document.querySelector('.cms-resource-history')!.getBoundingClientRect().bottom + scrollY,
        listHeight: scroll.clientHeight, listScrollHeight: scroll.scrollHeight, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(layout.overflow).toBe(false); expect(layout.listScrollHeight).toBeGreaterThan(layout.listHeight);
    expect(layout.height).toBeLessThan(layout.historyBottom + 120);
    await writeFile(info.outputPath('layout.json'), JSON.stringify(layout, null, 2));
    await prepareCapture(page);
    await page.screenshot({ path: info.outputPath('areas-list-full.png'), fullPage: true });
    await page.screenshot({ path: info.outputPath('areas-list-viewport.png') });
    await page.getByRole('button', { name: 'ย่อทุกกลุ่ม', exact: true }).click();
    await expect(page.locator('.cms-area-group-heading button[aria-expanded="false"]')).toHaveCount(4);
    await page.getByRole('button', { name: 'ขยายทุกกลุ่ม', exact: true }).click();
    const selection = page.getByRole('button', { name: 'เลือกเพื่อดาวน์โหลด', exact: true });
    await selection.focus(); await page.keyboard.press('Enter');
    await page.getByRole('checkbox', { name: 'เลือก ในเมือง 300101', exact: true }).check();
    await expect(page.getByRole('checkbox', { name: 'เลือกกลุ่ม เมืองนครราชสีมา', exact: true })).toHaveJSProperty('indeterminate', true);
    await page.getByRole('button', { name: 'ข้อมูลหน้าถัดไป', exact: true }).click();
    const next = page.locator('.cms-area-table tbody input').first();
    const nextCode = (await next.getAttribute('aria-label'))!.split(' ').at(-1)!;
    await next.check();
    await expect(page.getByText('เลือก 2 รายการ (รวมทุกหน้า)', { exact: true })).toBeVisible();
    await choose(page, 'เรียงลำดับ', 'รหัสพื้นที่ มากไปน้อย');
    const csv = await downloaded(page, 'รายชื่อ (CSV)');
    expect(csv.text.startsWith('\uFEFF')).toBe(true); expect(csv.text.split('\r\n')).toHaveLength(3);
    expect(csv.text).toContain('300101'); expect(csv.text).toContain(nextCode);
    await page.getByRole('button', { name: 'แผนที่', exact: true }).click();
    await expect(page.getByText('เลือก 2 รายการ (รวมทุกหน้า)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'รายชื่อ', exact: true }).click();
    await choose(page, 'อำเภอ', 'ปากช่อง');
    await expect(page.locator('.cms-area-results')).toContainText('พบ 12 จาก 289 รายการ · 1 อำเภอ');
    await expect(page.getByRole('button', { name: 'รายชื่อ (CSV)', exact: true })).toBeDisabled();
    await page.getByRole('checkbox', { name: 'เลือกกลุ่ม ปากช่อง', exact: true }).check();
    const geometry = await downloaded(page, 'ขอบเขต (GeoJSON) · 12');
    expect(geometry.name.endsWith('.geojson')).toBe(true);
    const parsed = JSON.parse(geometry.text);
    expect(parsed.features).toHaveLength(12);
    for (const feature of parsed.features) expect(original.payload.features).toContainEqual(feature);
    await page.getByRole('button', { name: 'ยกเลิกการเลือก', exact: true }).click();
    await choose(page, 'ตำบล', 'หนองสาหร่าย 302106 · ปากช่อง');
    await expect(page.locator('.cms-area-table tbody tr')).toHaveCount(1);
    const open = page.getByRole('button', { name: /^ดูรายละเอียด หนองสาหร่าย/ });
    await open.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'ตำบลหนองสาหร่าย', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('dd')).toContainText(['นครราชสีมา', 'ปากช่อง', 'หนองสาหร่าย', '302106']);
    await dialog.getByRole('button', { name: 'ขอบเขตแผนที่', exact: true }).click();
    await expect(dialog.locator('.cms-area-map-canvas > svg > g > path')).toHaveCount(1);
    await expect(dialog).toContainText('DOPA');
    await page.screenshot({ path: info.outputPath('areas-detail-map.png') });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0); await expect(open).toBeFocused();
    await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click();
    await choose(page, 'อำเภอ', 'ปากช่อง');
    await page.getByRole('button', { name: 'แผนที่', exact: true }).click();
    await expect(page.locator('.cms-area-map-canvas > svg > g > path')).toHaveCount(12);
    await expect(page.locator('.cms-area-map-list')).toContainText('หนองสาหร่าย');
    await expect(page.locator('.cms-area-map-label').first()).toBeVisible();
    const transform = page.locator('.cms-area-map-canvas > svg > g');
    const before = await transform.getAttribute('transform');
    await page.getByRole('button', { name: 'ขยายแผนที่ขอบเขต', exact: true }).click();
    await expect(transform).not.toHaveAttribute('transform', before!);
    await page.getByRole('button', { name: 'แสดงขอบเขตทั้งหมด', exact: true }).click();
    await expect(transform).toHaveAttribute('transform', before!);
    await prepareCapture(page);
    await page.screenshot({ path: info.outputPath('areas-map-full.png'), fullPage: true });
    const polygon = page.locator('.cms-area-map-canvas > svg > g > path[role="button"]').first();
    await polygon.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'ปิดรายละเอียดพื้นที่', exact: true }).click();
    await expect(polygon).toBeFocused();
    await page.getByLabel('ค้นหาพื้นที่', { exact: true }).fill('ไม่มีพื้นที่นี้');
    await expect(page.getByRole('heading', { name: 'ไม่พบพื้นที่ตามตัวกรองนี้', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).last().click();
    await choose(page, 'สถานะขอบเขต', 'รายการที่ต้องตรวจสอบ');
    await expect(page.getByRole('heading', { name: 'ไม่พบพื้นที่ตามตัวกรองนี้', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).last().click();
    await page.getByRole('button', { name: 'รายชื่อ', exact: true }).click();
    await page.getByLabel('ค้นหาพื้นที่', { exact: true }).fill('๓๐๐๑๐๑');
    await expect(page.locator('.cms-area-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.cms-area-group-heading')).toContainText('1 / 25 ตำบล');
    await page.locator('summary').filter({ hasText: 'ประวัติและไฟล์ต้นฉบับ' }).click();
    const source = page.locator('.cms-area-source').filter({ has: page.getByRole('heading', { name: 'ขอบเขตตำบล', exact: true }) });
    const downloadReady = page.waitForEvent('download');
    await source.getByRole('button', { name: 'ไฟล์ต้นฉบับ (JSON)', exact: true }).click();
    expect(JSON.parse(await readFile((await (await downloadReady).path())!, 'utf8'))).toEqual(original.payload);
    await source.getByRole('button', { name: 'ประวัติการแก้ไข', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'ประวัติ ขอบเขตตำบล' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Existing boundary deep links resolve to the same workspace, initially in map mode.
    await page.goto(`/admin?resource=${boundaries.id}`);
    await expect(page.getByRole('heading', { name: 'ข้อมูลพื้นที่', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'แผนที่', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.cms-area-map-canvas > svg > g > path')).toHaveCount(289);
    await page.reload();
    await expect(page.getByRole('button', { name: 'แผนที่', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await writeFile(info.outputPath('areas-evidence.json'), JSON.stringify({ route: page.url(), viewport: page.viewportSize(), errors, writes, geometryCount: await page.locator('.cms-area-map-canvas > svg > g > path').count() }, null, 2));
    expect(errors).toEqual([]); expect(writes).toEqual([]);
  } finally { await database.close(); }
});

test('failed boundary read stays unknown and retries without reporting every tambon missing', async ({ page, context }) => {
  test.setTimeout(90000);
  const database = await cmsTestDatabase(context, { references: true });
  try {
    const catalog = await database.operation('resource:catalog', {});
    const names = catalog.find((item: { resource_key: string }) => item.resource_key === AREA_NAMES_KEY);
    const boundary = catalog.find((item: { resource_key: string }) => item.resource_key === AREA_BOUNDARIES_KEY);
    let blocked = true;
    await context.route('**/api/admin-data?action=resource-get', async route => {
      if (route.request().postDataJSON().id === boundary.id && blocked) await route.fulfill({ status: 503, json: { error: { code: 'cms_unavailable' } } });
      else await route.fallback();
    });
    await seedAdminSession(page); await page.goto(`/admin?resource=${names.id}`);
    await expect(page.getByRole('alert')).toContainText('ข้อมูลที่โหลดไม่ได้จะไม่ถูกนับ');
    await expect(page.locator('.cms-area-table .cms-area-status').first()).toHaveText('ยังตรวจสอบไม่ได้');
    await choose(page, 'สถานะขอบเขต', 'ไม่มีขอบเขต');
    await expect(page.getByRole('heading', { name: 'ไม่พบพื้นที่ตามตัวกรองนี้', exact: true })).toBeVisible();
    blocked = false;
    await page.getByRole('button', { name: 'ลองโหลดใหม่', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).last().click();
    await expect(page.locator('.cms-area-table .cms-area-status').first()).toHaveText('มีขอบเขต');
    let catalogBlocked = true;
    await context.route('**/api/admin-data?action=resource-catalog', async route => {
      if (catalogBlocked) await route.fulfill({ status: 503, json: { error: { code: 'cms_unavailable' } } });
      else await route.fallback();
    });
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('ข้อมูลที่โหลดไม่ได้จะไม่ถูกนับ');
    await page.getByLabel('ค้นหาพื้นที่', { exact: true }).fill('300101');
    catalogBlocked = false;
    await page.getByRole('button', { name: 'ลองโหลดใหม่', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByLabel('ค้นหาพื้นที่', { exact: true })).toHaveValue('300101');
    await expect(page.locator('.cms-area-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.cms-area-table .cms-area-status')).toHaveText('มีขอบเขต');
  } finally { await database.close(); }
});
