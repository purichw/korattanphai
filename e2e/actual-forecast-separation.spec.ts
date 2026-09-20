import { readFileSync } from 'node:fs';
import { test, expect, seedAuthSession, type Page } from './fixtures';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';
import { BUSINESS_TIMEZONE, OPERATIONAL_POLICY_VERSION, businessMonth, nextBusinessMonth, operationalFamily, sourceAvailability } from '../src/data/operationalPolicy.mjs';

const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));
async function setup(page: Page) {
  let forecastReads = 0;
  await page.route(/\/rest\/v1\/ktp_(followed_areas|saved_filters)(\?|$)/, route =>
    route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.abort());
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
    forecastReads++;
    const query = route.request().postDataJSON();
    return route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
  });
  await page.route('**/api/operational-context**', route => {
    const now = '2026-09-20T05:00:00Z';
    const validPeriod = new URL(route.request().url()).searchParams.get('period') ?? '2026-09';
    return route.fulfill({ json: { policyVersion: OPERATIONAL_POLICY_VERSION, timezone: BUSINESS_TIMEZONE, serverNow: now,
      currentPeriod: businessMonth(now), validPeriod, family: operationalFamily(validPeriod, now), nextBoundary: nextBusinessMonth(now),
      sourceAvailability, actualPeriods: [], forecastPeriods: [], latestActualPeriod: null } });
  });
  await seedAuthSession(page);
  return () => forecastReads;
}
async function chooseMonth(page: Page, text: string) {
  await page.getByRole('combobox', { name: /^เดือนข้อมูล / }).click();
  await page.getByRole('option', { name: new RegExp(`^${text}`) }).click();
}

test('actual separation across overview, province, districts and tambons', async ({ page }, info) => {
  test.setTimeout(90000);
  const reads = await setup(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const [path, count] of [['/', 289], ['/drought', 289], ['/wang-nam-khiao', 5], ['/phimai', 12], ['/wang-nam-khiao/t-302503', 1], ['/phimai/t-301503', 1]] as const) {
    await page.goto(`${path}?period=2026-08`);
    await expect(page.getByRole('heading', { name: 'ยังไม่มีข้อมูลสถานการณ์จริงสำหรับเดือนนี้' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'ขอบเขตและความครอบคลุม' })).toContainText(`${count} ตำบล`);
    await expect(page.locator('.nr-map-shape').first()).toBeVisible();
    await expect(page.locator('.nr-map-shape.is-forecast-no-risk, .nr-map-shape.is-forecast-moderate, .nr-map-shape.is-forecast-high')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'ระยะพยากรณ์' })).toHaveCount(0);
    await expect(page.locator('.nr-drought-horizon-strip')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (path === '/') await page.screenshot({ path: `artifacts/actual-forecast-${info.project.name}.png`, fullPage: true });
  }
  expect(reads()).toBe(0);
  expect(errors).toEqual([]);
});

test('month changes, legacy URL, back/forward and camera keep their meaning', async ({ page }) => {
  await setup(page);
  await page.goto('/phimai?target=2025-12&horizon=6');
  await expect(page.locator('.nr-primary-workspace')).toHaveAttribute('data-valid-period', '2026-06');
  await expect(page).toHaveURL(/\/phimai\?period=2026-06$/);
  await expect(page.locator('.nr-map-shape').first()).toBeVisible();
  const transform = page.locator('.nr-map-transform-layer');
  const scale = () => transform.evaluate(node => (node as SVGGElement).transform.baseVal.consolidate()?.matrix.a ?? 0);
  const initialScale = await scale();
  await page.getByRole('button', { name: 'ขยายแผนที่', exact: true }).click();
  await expect.poll(scale).toBeGreaterThan(initialScale);
  // The renderer keeps one camera instance when primary period/family changes.
  const svg = page.locator('.nr-map-svg');
  await svg.evaluate(node => { node.setAttribute('data-instance-marker', 'same-map'); });
  // Poll until the map's existing button animation has settled before comparison.
  let lastTransform = '';
  await expect.poll(async () => {
    const value = await transform.getAttribute('transform') ?? '';
    const settled = value === lastTransform;
    lastTransform = value;
    return settled;
  }).toBe(true);
  const zoomedTransform = await transform.getAttribute('transform');
  await chooseMonth(page, 'ต.ค. 2569');
  await expect(page.locator('.nr-primary-workspace')).toHaveAttribute('data-data-family', 'forecast');
  await expect(page.getByRole('heading', { name: 'ยังไม่มีคำพยากรณ์ที่พร้อมใช้สำหรับเดือนนี้' })).toBeVisible();
  await expect(svg).toHaveAttribute('data-instance-marker', 'same-map');
  await expect(transform).toHaveCount(1);
  await expect(transform).toHaveAttribute('transform', zoomedTransform!);
  await page.goBack();
  await expect(page.locator('.nr-primary-workspace')).toHaveAttribute('data-valid-period', '2026-06');
  await expect(page.locator('.nr-primary-workspace')).toHaveAttribute('data-data-family', 'actual');
  await page.goForward();
  await expect(page.locator('.nr-primary-workspace')).toHaveAttribute('data-valid-period', '2026-10');
  if (process.env.PLAYWRIGHT_DATA_BACKEND !== 'supabase') {
    await expect(page.getByRole('button', { name: 'รายการที่บันทึก', exact: true })).toHaveCount(0);
    return;
  }
  await page.getByRole('button', { name: 'รายการที่บันทึก', exact: true }).click();
  const bookmarks = page.getByRole('dialog', { name: 'รายการที่บันทึก' });
  await expect(bookmarks.getByRole('button', { name: 'ติดตามพื้นที่นี้', exact: true })).toBeEnabled();
  await expect(bookmarks).toContainText('อำเภอพิมาย');
  await bookmarks.getByRole('tab', { name: 'ตัวกรองที่บันทึก' }).click();
  await expect(bookmarks.getByText(/บันทึกตัวกรองได้จากคลังคำพยากรณ์ย้อนหลัง/)).toBeVisible();
  await expect(bookmarks.getByLabel('ชื่อตัวกรอง')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(bookmarks).toHaveCount(0);
});

test('tablet and legacy scope keep geography and the explicit T+6 vintage', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'One tablet pass covers this shared layout.');
  await setup(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/?district=3015&target=2025-12&horizon=6');
  await expect(page).toHaveURL(/\/phimai\?period=2026-06$/);
  await expect(page.getByRole('heading', { name: 'อำเภอพิมาย', exact: true })).toBeVisible();
  await page.goto('/?mapLayer=forecast-archive&target=2025-12&horizon=6');
  await expect(page.getByRole('tab', { name: 'ล่วงหน้า 6 เดือน · มิ.ย. 2569' })).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'กลับไปข้อมูลสถานการณ์' }).click();
  await expect(page.locator('.nr-primary-workspace')).toHaveAttribute('data-data-family', 'actual');
});

test('request error has retry and is not presented as confirmed no-data', async ({ page }) => {
  await setup(page);
  let failed = true;
  await page.route('**/api/operational-context**', route => failed ? route.fulfill({ status: 503, body: '{}' }) : route.fallback());
  await page.goto('/drought?period=2026-08');
  await expect(page.getByRole('heading', { name: 'ตรวจสอบข้อมูลไม่สำเร็จ' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ยังไม่มีข้อมูลสถานการณ์จริงสำหรับเดือนนี้' })).toHaveCount(0);
  failed = false;
  await page.getByRole('button', { name: 'ลองอีกครั้ง', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ยังไม่มีข้อมูลสถานการณ์จริงสำหรับเดือนนี้' })).toBeVisible();
});

test('explicit archive preserves rev03, one temporal owner, and rejects missing origins', async ({ page }, info) => {
  test.setTimeout(60000);
  await setup(page);
  await page.goto('/wang-nam-khiao?mapLayer=forecast-archive&target=2025-12&horizon=4');
  await expect(page.getByRole('region', { name: 'บริบทคลังพยากรณ์' })).toBeVisible();
  await expect(page.locator('.nr-map-shape.is-forecast-high').first()).toBeVisible();
  await expect(page.getByRole('combobox', { name: /^เดือนตั้งต้น / })).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'ระยะพยากรณ์', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'ล่วงหน้า 4 เดือน · เม.ย. 2569' })).toHaveAttribute('aria-selected', 'true');
  await page.screenshot({ path: `artifacts/archive-preserved-${info.project.name}.png`, fullPage: true });
  await page.getByRole('link', { name: 'กลับไปข้อมูลสถานการณ์' }).click();
  await expect(page.locator('.nr-primary-workspace')).toHaveAttribute('data-data-family', 'actual');
  await page.goto('/drought?mapLayer=forecast-archive&target=2030-01&horizon=6');
  await expect(page.getByRole('heading', { name: 'ไม่มีเดือนตั้งต้นที่เลือกในคลังพยากรณ์' })).toBeVisible();
  await expect(page).toHaveURL(/target=2030-01/);
  await expect(page.locator('.nr-map-shape')).toHaveCount(0);
});
