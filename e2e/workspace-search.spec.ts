import { readFileSync } from 'node:fs';
import { test, expect, seedAuthSession, authTestUser, type Page } from './fixtures';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

test.skip(process.env.PLAYWRIGHT_DATA_BACKEND !== 'supabase', 'Uses isolated database fixtures, never production.');
const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));
const historyKey = `korat-tan-phai-search-history-v1:${authTestUser.id}`;
async function setup(page: Page, path = '/drought?mapLayer=forecast-archive&target=2025-12&horizon=4') {
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
    const query = route.request().postDataJSON();
    return route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
  });
  await seedAuthSession(page);
  await page.goto(path);
  await expect(page.getByRole('button', { name: 'ค้นหาข้อมูล', exact: true }).filter({ visible: true }).first()).toBeVisible();
}
async function open(page: Page) {
  const trigger = page.getByRole('button', { name: 'ค้นหาข้อมูล', exact: true }).filter({ visible: true }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'ค้นหาข้อมูล', exact: true });
  await expect(dialog.getByRole('searchbox', { name: 'คำค้นหา', exact: true })).toBeFocused();
  return dialog;
}

test('search trigger stays in the upper-right toolbar and restores focus after dismissal', async ({ page }, info) => {
  await setup(page, '/?mapLayer=forecast-archive&target=2025-12&horizon=1');
  await expect(page.locator('.nr-forecast-overview-summary')).toBeVisible();
  const trigger = page.getByRole('button', { name: 'ค้นหาข้อมูล', exact: true });
  await expect(trigger).toHaveCount(1);
  await expect(page.locator('#primary-navigation .workspace-search-trigger')).toHaveCount(0);
  const toolbar = page.locator(info.project.name === 'mobile' ? '.mobile-account-slot' : '.topbar-actions');
  await expect(toolbar.locator('.workspace-search-trigger')).toBeVisible();
  const searchBox = (await trigger.boundingBox())!;
  const bookmarkBox = (await toolbar.locator('.nr-bookmarks-trigger').boundingBox())!;
  expect(searchBox.height).toBe(44);
  expect(bookmarkBox.height).toBe(44);
  expect(Math.abs(searchBox.y - bookmarkBox.y)).toBeLessThan(1);
  expect(searchBox.x).toBeGreaterThan(bookmarkBox.x + bookmarkBox.width);
  expect(searchBox.x).toBeGreaterThan(page.viewportSize()!.width / 2);
  expect(searchBox.y).toBeLessThan(90);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: info.outputPath('search-top-right.png'), scale: 'css' });
  await page.screenshot({ path: info.outputPath('search-toolbar-context.png'), scale: 'css', clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: info.project.name === 'mobile' ? 220 : 190 } });
  const dialog = await open(page);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'เปิดเมนูหลัก', exact: true }).click();
    await expect(trigger).toHaveCount(1);
    await expect(page.locator('#primary-navigation .workspace-search-trigger')).toHaveCount(0);
    await trigger.click();
    await expect(dialog.getByRole('searchbox', { name: 'คำค้นหา', exact: true })).toBeFocused();
    await dialog.getByRole('button', { name: 'ปิดการค้นหา', exact: true }).click();
    await expect(trigger).toBeFocused();
  }
});

test('search loads on demand and its loading dialog can be dismissed', async ({ page }) => {
  let requested = false;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/WorkspaceSearchContent*', async route => {
    requested = true;
    await pending;
    await route.continue();
  });
  await setup(page);
  expect(requested).toBe(false);
  const trigger = page.getByRole('button', { name: 'ค้นหาข้อมูล', exact: true }).filter({ visible: true }).first();
  try {
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'ค้นหาข้อมูล', exact: true });
    await expect(dialog.getByRole('status')).toHaveText('กำลังเตรียมการค้นหาข้อมูล...');
    await expect.poll(() => requested).toBe(true);
    await dialog.getByRole('button', { name: 'ปิดการค้นหา', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  } finally { release(); }
  await open(page);
});

test('repeated names retain level, location, filtering and the exact forecast destination', async ({ page }, info) => {
  await setup(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const dialog = await open(page);
  const search = dialog.getByRole('searchbox', { name: 'คำค้นหา', exact: true });
  await search.fill('ปากช่อง');
  await expect(dialog.getByRole('heading', { name: 'อำเภอ 1 รายการ', exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'ตำบล 12 รายการ', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /ตำบลปากช่อง.*รหัสพื้นที่ 302101/ })).toBeVisible();
  if (await dialog.getByRole('button', { name: 'แสดงตัวกรอง', exact: true }).isVisible()) await dialog.getByRole('button', { name: 'แสดงตัวกรอง', exact: true }).click();
  await dialog.getByRole('combobox', { name: /^ประเภทข้อมูล / }).click();
  await page.getByRole('option', { name: 'ตำบล', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'ผลการค้นหา' })).toContainText('12 จาก 13');
  await dialog.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click();
  await expect(dialog.locator('.workspace-search-result')).toHaveCount(13);
  if (info.project.name === 'mobile') await dialog.getByRole('button', { name: 'ซ่อนตัวกรอง', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: info.outputPath('search-repeated-names.png'), fullPage: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await dialog.getByRole('button', { name: /ตำบลปากช่อง.*รหัสพื้นที่ 302101/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(url => url.pathname === '/pak-chong/t-302101'
    && url.searchParams.get('target') === '2025-12' && url.searchParams.get('horizon') === '4'
    && url.searchParams.getAll('mapLayer').length === 1 && url.searchParams.get('mapLayer') === 'forecast-archive');
  await expect(page.locator('.nr-drought-compact-workspace.is-subdistrict')).toBeVisible();
  expect(errors).toEqual([]);
});

test('history is committed explicitly, survives reload and can be cleared without affecting another account', async ({ page }, info) => {
  // Three full document loads share this budget on the slower CI browser.
  test.setTimeout(60_000);
  await setup(page);
  await page.evaluate(() => localStorage.setItem('korat-tan-phai-search-history-v1:another-account', JSON.stringify(['ข้อมูลของบัญชีอื่น'])));
  let dialog = await open(page);
  const search = dialog.getByRole('searchbox', { name: 'คำค้นหา', exact: true });
  await search.fill('ปากช่อง');
  expect(await page.evaluate(key => localStorage.getItem(key), historyKey)).toBeNull();
  await search.press('Enter');
  await dialog.getByRole('button', { name: 'ล้างคำค้นหา', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'คำค้นหาล่าสุด', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'ปากช่อง', exact: true })).toBeVisible();
  await expect(dialog).not.toContainText('ข้อมูลของบัญชีอื่น');
  await page.reload();
  dialog = await open(page);
  await expect(dialog.getByRole('heading', { name: 'คำค้นหาล่าสุด', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('search-history.png'), fullPage: false });
  await dialog.getByRole('button', { name: 'ล้างประวัติการค้นหา', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('ล้างประวัติการค้นหาแล้ว');
  expect(await page.evaluate(key => localStorage.getItem(key), historyKey)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('korat-tan-phai-search-history-v1:another-account'))).toBe('["ข้อมูลของบัญชีอื่น"]');
  await page.reload();
  dialog = await open(page);
  await expect(dialog.getByRole('heading', { name: 'คำค้นหาแนะนำ', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'ล้างประวัติการค้นหา', exact: true })).toHaveCount(0);
});

test('aliases, tags, exact matching, empty states and keyboard dismissal remain usable', async ({ page }, info) => {
  await setup(page);
  const trigger = page.getByRole('button', { name: 'ค้นหาข้อมูล', exact: true }).filter({ visible: true }).first();
  const dialog = await open(page);
  const search = dialog.getByRole('searchbox', { name: 'คำค้นหา', exact: true });
  await search.fill('โคราช');
  await expect(dialog.getByRole('button', { name: /จังหวัดนครราชสีมา.*รหัสพื้นที่ 30 ตรงกับ: โคราช/ })).toBeVisible();
  await expect(dialog.locator('.workspace-search-result')).toHaveCount(24);
  await dialog.getByRole('button', { name: /แสดงผลการค้นหาเพิ่มเติม/ }).click();
  await expect(dialog.locator('.workspace-search-result')).toHaveCount(48);
  await search.fill('ดาวน์โหลดตาราง');
  await dialog.getByRole('button', { name: 'กรองหัวข้อ รายงาน', exact: true }).click();
  await expect(dialog.locator('.workspace-search-result')).toHaveCount(1);
  await search.fill('ปาก');
  if (await dialog.getByRole('button', { name: 'แสดงตัวกรอง', exact: true }).isVisible()) await dialog.getByRole('button', { name: 'แสดงตัวกรอง', exact: true }).click();
  await dialog.getByRole('button', { name: 'ตรงกับคำค้นหาทั้งหมด', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'ไม่พบข้อมูลที่ตรงกับคำค้นหา', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'มีคำค้นหาอยู่ภายใน', exact: true }).click();
  await expect(dialog.locator('.workspace-search-result').first()).toBeVisible();
  await search.fill('ป');
  await expect(dialog.getByRole('heading', { name: 'กรุณาระบุคำค้นหาเพิ่มเติม', exact: true })).toBeVisible();
  await search.fill('ไม่พบพื้นที่ดังกล่าว');
  await page.screenshot({ path: info.outputPath('search-empty.png'), fullPage: false });
  await dialog.getByRole('combobox', { name: /^ประเภทข้อมูล / }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'เปิดเมนูหลัก', exact: true }).click();
    await expect(page.locator('#primary-navigation .workspace-search-trigger')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'ค้นหาข้อมูล', exact: true })).toHaveCount(1);
    await trigger.click();
    await expect(dialog.getByRole('searchbox', { name: 'คำค้นหา', exact: true })).toBeFocused();
    await dialog.getByRole('button', { name: 'ปิดการค้นหา', exact: true }).click();
    await expect(trigger).toBeFocused();
  }
});

test('search opens the existing export dialog without downloading or writing data', async ({ page }) => {
  await setup(page);
  const writes: string[] = []; const downloads: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET' && request.url().includes('/rest/v1/') && !request.url().includes('/rpc/ktp_load_') && !request.url().includes('/rpc/ktp_latest_')) writes.push(request.url()); });
  page.on('download', download => downloads.push(download.suggestedFilename()));
  const dialog = await open(page);
  await dialog.getByRole('searchbox', { name: 'คำค้นหา', exact: true }).fill('Excel');
  await dialog.getByRole('button', { name: /ส่งออก Excel เครื่องมือรายงาน/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.nr-export-dialog')).toBeVisible();
  expect(writes).toEqual([]); expect(downloads).toEqual([]);
});
