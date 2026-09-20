import { readFileSync } from 'node:fs';
import { test, expect, seedAuthSession } from './fixtures';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

test.skip(process.env.PLAYWRIGHT_DATA_BACKEND !== 'supabase', 'Requires isolated database fixture');
const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
    const query = route.request().postDataJSON();
    return route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
  });
  await seedAuthSession(page);
});

test('searchable page and map filters keep selection, scrolling and small menus intact', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/drought?mapLayer=forecast-archive&target=2025-12&horizon=1');
  const fields = page.locator('.nr-operational-filters');
  const month = fields.getByRole('combobox', { name: /^เดือนตั้งต้น / });
  await month.click();
  const input = page.getByRole('searchbox', { name: 'ค้นหาตัวเลือก เดือนตั้งต้น', exact: true });
  if (info.project.name === 'desktop') await expect(input).toBeFocused();
  else await expect(month).toBeFocused();
  const scrollY = await page.evaluate(() => window.scrollY);
  await input.press('ArrowUp');
  await expect(input).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  for (const query of ['พฤศจิกายน ๒๕๖๘', 'พย2568', '2025-11']) {
    await input.fill(query);
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option')).toHaveText('พ.ย. 2568');
  }
  await input.fill('ไม่มีเดือนนี้');
  await expect(page.getByRole('status').filter({ hasText: 'ไม่พบตัวเลือก' })).toBeVisible();
  await input.press('Enter');
  await expect(month).toContainText('ธ.ค. 2568');
  await page.getByRole('button', { name: 'ล้างคำค้นตัวเลือก' }).click();
  await input.fill('พฤศจิกายน 2568');
  await input.press('Enter');
  await expect(month).toContainText('พ.ย. 2568');
  await expect(month).toBeFocused();
  await expect(page).toHaveURL(/target=2025-11/);

  const area = fields.getByRole('combobox', { name: /^อำเภอ / });
  await area.click();
  const areaSearch = page.getByRole('searchbox', { name: 'ค้นหาตัวเลือก อำเภอ', exact: true });
  await areaSearch.fill('พิมาย');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('searchable-district.png'), scale: 'css' });
  await page.getByRole('option', { name: 'พิมาย', exact: true }).click();
  await expect(page).toHaveURL(/phimai/);
  await fields.getByRole('combobox', { name: /^ตำบล / }).click();
  await page.getByRole('searchbox', { name: 'ค้นหาตัวเลือก ตำบล', exact: true }).fill('301503');
  await expect(page.getByRole('option', { name: 'โบสถ์', exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/phimai\/t-301503/);
  await expect(fields.getByRole('combobox', { name: /^ระยะพยากรณ์ / })).toBeVisible();
  await page.getByRole('tab', { name: /ล่วงหน้า 4 เดือน/ }).click();
  await expect(page).toHaveURL(/horizon=4/);
  await page.getByRole('combobox', { name: 'สถานะพยากรณ์ภัยแล้ง', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: /^ค้นหาตัวเลือก/ })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await expect(page.getByRole('combobox', { name: 'เดือนตั้งต้นบนแผนที่พยากรณ์ภัยแล้ง', exact: true })).toBeVisible();
  await month.click();
  await page.getByRole('searchbox', { name: 'ค้นหาตัวเลือก เดือนตั้งต้น', exact: true }).fill('ธันวาคม 2568');
  await page.keyboard.press('Enter');
  await expect(month).toContainText('ธ.ค. 2568');
  await expect(page).toHaveURL(/target=2025-12/);
  expect(errors).toEqual([]);
});

test('searchable analysis and export menus retain their parent modal and tab sequence', async ({ page }, info) => {
  await page.goto('/drought?mapLayer=forecast-archive&target=2025-12&horizon=1');
  const panel = page.locator('.nr-map-panel');
  if (info.project.name === 'desktop') {
    await panel.getByTitle('เปิดแผนที่เต็มจอ', { exact: true }).click();
    await expect.poll(() => panel.evaluate(el => document.fullscreenElement === el)).toBe(true);
  }
  await page.getByRole('button', { name: 'วิเคราะห์พยากรณ์', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.nr-analysis-table')).toBeVisible();
  const district = dialog.getByRole('combobox', { name: 'อำเภอในตารางวิเคราะห์', exact: true });
  await district.click();
  const search = page.getByRole('searchbox', { name: /^ค้นหาตัวเลือก อำเภอในตาราง/ });
  await search.fill('3015');
  await search.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(district).toBeFocused();
  await district.click();
  await expect(search).toHaveValue('');
  await search.fill('พิมาย');
  await search.press('Tab');
  await expect(page.getByRole('button', { name: 'ล้างคำค้นตัวเลือก' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(search).toHaveValue('');
  await search.fill('พิมาย');
  await search.press('Enter');
  await expect(dialog.locator('.nr-analysis-table tbody tr')).toHaveCount(1);
  const height = (await dialog.boundingBox())!.height;
  await dialog.getByRole('combobox', { name: 'รูปแบบความเสี่ยง 6 เดือน', exact: true }).click();
  await page.getByRole('searchbox', { name: /^ค้นหาตัวเลือก รูปแบบความเสี่ยง/ }).fill('T+3');
  await expect(page.getByRole('option')).toHaveCount(2);
  await page.screenshot({ path: info.outputPath('searchable-pattern.png'), scale: 'css' });
  await page.keyboard.press('Escape');
  expect((await dialog.boundingBox())!.height).toBe(height);
  await dialog.getByRole('button', { name: 'เปรียบเทียบรอบ', exact: true }).click();
  await dialog.getByRole('combobox', { name: /^รอบตั้งต้นอ้างอิง / }).click();
  await page.getByRole('searchbox', { name: 'ค้นหาตัวเลือก รอบตั้งต้นอ้างอิง', exact: true }).fill('ตุลาคม 2568');
  await page.getByRole('option', { name: 'ต.ค. 2568', exact: true }).click();
  await expect(dialog.getByRole('columnheader', { name: 'รอบ ต.ค. 2568', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  if (info.project.name === 'desktop') {
    await panel.getByTitle('ออกจากเต็มจอ', { exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  }

  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'เปิดเมนูหลัก' }).click();
  await page.getByRole('button', { name: 'ส่งออก Excel', exact: true }).click();
  const exportDialog = page.getByRole('dialog', { name: 'ส่งออกข้อมูลพยากรณ์' });
  await exportDialog.getByRole('combobox', { name: /^เดือนตั้งต้น \(T\) / }).click();
  await page.getByRole('searchbox', { name: 'ค้นหาตัวเลือก เดือนตั้งต้น (T)', exact: true }).fill('dec 2025');
  await page.getByRole('option', { name: 'ธ.ค. 2568', exact: true }).click();
  await exportDialog.getByRole('combobox', { name: /^รอบตั้งต้นที่ใช้เปรียบเทียบ / }).click();
  await page.getByRole('searchbox', { name: 'ค้นหาตัวเลือก รอบตั้งต้นที่ใช้เปรียบเทียบ', exact: true }).fill('ตุลาคม');
  await page.getByRole('option', { name: 'ต.ค. 2568', exact: true }).click();
  await exportDialog.getByRole('combobox', { name: /^พื้นที่ / }).click();
  await page.getByRole('searchbox', { name: 'ค้นหาตัวเลือก พื้นที่', exact: true }).fill('พิมาย');
  await page.getByRole('option', { name: 'อำเภอพิมาย', exact: true }).click();
  await expect(exportDialog.getByRole('combobox', { name: /^พื้นที่ / })).toContainText('อำเภอพิมาย');
  await expect(exportDialog.getByRole('combobox', { name: /^รอบตั้งต้นที่ใช้เปรียบเทียบ / })).toContainText('ต.ค. 2568');
});

test('overview search stays inside the existing mobile filter sheet', async ({ page }, info) => {
  await page.goto('/?mapLayer=forecast-archive&target=2025-12&horizon=1');
  const mobile = info.project.name === 'mobile';
  if (mobile) await page.getByRole('button', { name: 'แก้ไขตัวกรองข้อมูล' }).click();
  const fields = page.locator(mobile ? '.operational-filter-sheet' : '.control-band');
  const month = fields.getByRole('combobox', { name: /เดือน/ });
  await month.click();
  const input = fields.getByRole('searchbox', { name: /^ค้นหาตัวเลือก/ });
  const list = page.getByRole('listbox');
  await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await input.fill('2568');
  await expect(page.getByRole('option')).toHaveCount(12);
  await expect.poll(() => list.evaluate(el => {
    const first = el.querySelector('[role="option"]')!.getBoundingClientRect();
    const frame = el.getBoundingClientRect();
    return first.top >= frame.top && first.bottom <= frame.bottom;
  })).toBe(true);
  await expect(page.getByRole('option').first()).toBeInViewport();
  await input.press('ArrowDown');
  await expect(input).toBeInViewport();
  await page.screenshot({ path: info.outputPath('searchable-month.png'), scale: 'css' });
  await input.fill('2025-11');
  await input.press('Enter');
  await expect(month).toContainText('พ.ย. 2568');
  await expect(month).toBeFocused();
  const area = fields.getByRole('combobox', { name: /อำเภอ/ });
  await area.click();
  await fields.getByRole('searchbox', { name: /^ค้นหาตัวเลือก/ }).fill('พิมาย');
  await page.keyboard.press('Escape');
  await expect(area).toBeFocused();
  if (mobile) {
    await expect(fields).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fields).toHaveCount(0);
  }
});
