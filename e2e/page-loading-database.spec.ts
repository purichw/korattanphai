import { readFileSync } from 'node:fs';
import { test, expect, seedAuthSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

test.skip(process.env.PLAYWRIGHT_REFERENCE_BACKEND !== 'cms', 'Requires the production CMS reference mode with an isolated test database');

test('CMS bootstrap stays covered; a subsequent month change keeps ready content and controls', async ({ page, context }, testInfo) => {
  test.setTimeout(60_000);
  const database = await cmsTestDatabase(context, { references: true });
  const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));
  let releaseBootstrap!: () => void; let releaseMonth!: () => void;
  const bootstrap = new Promise<void>(resolve => { releaseBootstrap = resolve; });
  const month = new Promise<void>(resolve => { releaseMonth = resolve; });
  let requestedBootstrap = false;
  await page.route('**/rest/v1/rpc/ktp_cms_reference_bundle', async route => {
    requestedBootstrap = true; await bootstrap; await route.fallback();
  });
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', async route => {
    const query = route.request().postDataJSON();
    if (query.p_origin_period === '2025-11') await month;
    await route.fulfill({ json: forecastSlice(overview, query) });
  });
  try {
    await seedAuthSession(page);
    await page.goto('/?mapLayer=forecast-archive&target=2025-12&horizon=1');
    await expect.poll(() => requestedBootstrap).toBe(true);
    await expect(page.locator('.app-startup')).toBeVisible();
    await expect(page.locator('.app-shell')).toHaveCount(0);
    releaseBootstrap();
    await expect(page.locator('.nr-forecast-overview-summary')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.nr-map-shape')).toHaveCount(289);
    await expect(page.locator('.app-startup')).toHaveCount(0);
    const mobile = testInfo.project.name === 'mobile';
    if (mobile) await page.getByRole('button', { name: 'แก้ไขตัวกรองข้อมูล' }).click();
    const field = page.getByRole('combobox', { name: mobile ? 'เลือกเดือนตั้งต้น' : /^เดือนตั้งต้น / });
    await field.click();
    await page.getByRole('option', { name: 'พ.ย. 2568', exact: true }).click();
    await expect(field).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.app-startup')).toHaveCount(0);
    await expect(field).toContainText('ธ.ค. 2568');
    await expect(page.locator('.nr-forecast-overview-summary')).toBeVisible();
    releaseMonth();
    await expect(field).toContainText('พ.ย. 2568');
    await expect(field).not.toHaveAttribute('aria-busy');
    await expect(page).toHaveURL(/target=2025-11/);
  } finally { releaseBootstrap(); releaseMonth(); await database.close(); }
});
