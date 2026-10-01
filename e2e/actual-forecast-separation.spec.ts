import { readFileSync } from 'node:fs';
import { test, expect, seedAuthSession, type Page } from './fixtures';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));
async function setup(page: Page) {
  let operationalReads = 0;
  await page.route(/\/rest\/v1\/ktp_(followed_areas|saved_filters)(\?|$)/, route =>
    route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.abort());
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
    const query = route.request().postDataJSON();
    return route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
  });
  await page.route('**/api/operational-context**', route => {
    operationalReads++;
    return route.fulfill({ status: 503, body: '{}' });
  });
  await seedAuthSession(page);
  return () => operationalReads;
}

test('forecast-only defaults across overview, province, districts and tambons', async ({ page }, info) => {
  test.setTimeout(90000);
  const reads = await setup(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const [path, count] of [['/', 289], ['/drought', 289], ['/wang-nam-khiao', 5], ['/phimai', 12], ['/wang-nam-khiao/t-302503', 1], ['/phimai/t-301503', 1]] as const) {
    // Retired valid-month links must not turn their period into an origin.
    await page.goto(`${path}?period=2026-08`);
    // The DB dev server loads its module graph before the map's readiness check.
    await expect(page.locator('.nr-forecast-overview, .nr-drought-compact-workspace')).toBeVisible({ timeout: 30_000 });
    // Cold CI also parses the full boundary geometry after the workspace loads.
    await expect(page.locator('.nr-map-shape')).toHaveCount(289, { timeout: 30_000 });
    await expect(page.locator('.nr-map-shape:not(.is-criteria-filtered)')).toHaveCount(count);
    if (path === '/') await expect(page).toHaveURL(url => url.pathname === '/' && url.search === '');
    else await expect(page).toHaveURL(/target=2025-12&horizon=1/);
    expect(new URL(page.url()).searchParams.has('period')).toBe(false);
    await expect(page.locator('.nr-primary-workspace, .nr-archive-context')).toHaveCount(0);
    const shapes = await page.locator('.nr-map-shape:not(.is-criteria-filtered)').evaluateAll(nodes => nodes.map(node => ({
      code: node.getAttribute('data-nr-subdistrict-code')!,
      risk: node.classList.contains('is-forecast-high') ? 2 : node.classList.contains('is-forecast-moderate') ? 1
        : node.classList.contains('is-forecast-no-risk') ? 0 : null,
    })));
    for (const shape of shapes) expect(shape.risk).toBe(archive.packedRiskByTargetMonth['2025-12'][shape.code][0]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    if (path === '/' || path === '/wang-nam-khiao' || path === '/phimai/t-301503')
      await page.screenshot({ path: `artifacts/forecast-restored-${info.project.name}-${count}.png`, fullPage: true });
  }
  expect(reads()).toBe(0);
  expect(errors).toEqual([]);
});

test('Home removes default forecast parameters and retains reload, historical filters and Back navigation', async ({ page }, info) => {
  test.setTimeout(90_000);
  await setup(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?mapLayer=forecast-archive&target=2025-12&horizon=1');
  const month = page.getByRole('combobox', { name: 'เดือนตั้งต้นบนแผนที่พยากรณ์ภัยแล้ง', exact: true });
  await expect(month).toContainText('ธ.ค. 2568');
  await expect(page).toHaveURL(url => url.pathname === '/' && url.search === '');
  await page.reload();
  await expect(month).toContainText('ธ.ค. 2568');
  await expect(page).toHaveURL(url => url.pathname === '/' && url.search === '');
  await month.click();
  await page.getByRole('option', { name: 'พ.ย. 2568', exact: true }).click();
  await expect(month).toContainText('พ.ย. 2568');
  await expect(page).toHaveURL(/target=2025-11&horizon=1/);
  await page.reload();
  await expect(month).toContainText('พ.ย. 2568');
  await month.click();
  await page.getByRole('option', { name: 'ธ.ค. 2568', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/' && url.search === '');
  if (process.env.PLAYWRIGHT_DATA_BACKEND === 'supabase') {
    await page.getByRole('button', { name: 'รายการที่บันทึก', exact: true }).filter({ visible: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'ตัวกรองที่บันทึก', exact: true }).click();
    await expect(dialog.getByLabel('ชื่อตัวกรอง', { exact: true })).toHaveValue(/ธ.ค. 2568.*ล่วงหน้า 1 เดือน/);
    await expect(dialog.getByRole('button', { name: 'บันทึก', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'ปิดรายการที่บันทึก', exact: true }).click();
  }
  await page.goto('/phimai?target=2025-11&horizon=4');
  await expect(page.getByRole('tab', { name: 'ล่วงหน้า 4 เดือน · มี.ค. 2569' })).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(month).toContainText('ธ.ค. 2568');
  await expect(page).toHaveURL(url => url.pathname === '/' && url.search === '');
  await expect(page.locator('.nr-map-shape')).toHaveCount(289);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: info.outputPath('home-clean-url.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('old source-month links preserve T+6, map camera and synced controls', async ({ page }) => {
  test.setTimeout(90_000);
  const reads = await setup(page);
  await page.goto('/phimai?target=2025-12&horizon=6');
  const tabs = page.locator('.nr-drought-workspace-horizon');
  await expect(tabs.getByRole('tab', { selected: true })).toContainText('6 เดือน');
  await expect(tabs.getByRole('tab', { selected: true })).toContainText('มิ.ย. 2569');
  const svg = page.locator('.nr-map-svg');
  await expect(svg).toBeVisible();
  const transform = page.locator('.nr-map-transform-layer');
  const scale = () => transform.evaluate(node => (node as SVGGElement).transform.baseVal.consolidate()?.matrix.a ?? 0);
  const initialScale = await scale();
  await page.getByRole('button', { name: 'ขยายแผนที่', exact: true }).click();
  await expect.poll(scale).toBeGreaterThan(initialScale);
  await svg.evaluate(node => node.setAttribute('data-instance-marker', 'same-map'));
  await tabs.getByRole('tab', { name: /ล่วงหน้า 4 เดือน/ }).click();
  await expect(svg).toHaveAttribute('data-instance-marker', 'same-map');
  await expect(page.getByRole('combobox', { name: /^ระยะพยากรณ์/ })).toContainText('4 เดือน');
  if (page.viewportSize()!.width < 768) {
    const filters = (await page.locator('.nr-operational-filters').boundingBox())!;
    const horizon = (await page.locator('.nr-operational-horizon-filter').boundingBox())!;
    expect(horizon.width).toBeCloseTo(filters.width, 0);
  }
  const month = page.locator('.nr-map-panel').getByRole('combobox', { name: /เดือนตั้งต้น/ });
  await month.click();
  await page.getByRole('option', { name: 'พ.ย. 2568', exact: true }).click();
  await expect(page.locator('.nr-operational-filters').getByRole('combobox', { name: /^เดือนตั้งต้น/ })).toContainText('พ.ย. 2568');
  await expect(page).toHaveURL(/target=2025-11&horizon=4/);
  await page.goto('/wang-nam-khiao?target=2025-12&horizon=3');
  await expect(tabs.getByRole('tab', { selected: true })).toContainText('3 เดือน');
  await page.goBack();
  await expect(page).toHaveURL(/phimai.*target=2025-11&horizon=4/);
  await expect(tabs.getByRole('tab', { selected: true })).toContainText('4 เดือน');
  await page.goForward();
  await expect(tabs.getByRole('tab', { selected: true })).toContainText('3 เดือน');
  expect(reads()).toBe(0);
});

test('tablet legacy overview keeps district scope and T+6', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'One tablet pass covers this shared layout.');
  await setup(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/?district=3015&target=2025-12&horizon=6');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('อำเภอพิมาย');
  await expect(page.locator('.nr-map-shape:not(.is-criteria-filtered)')).toHaveCount(12);
  await expect(page.getByRole('tab', { name: 'ล่วงหน้า 6 เดือน · มิ.ย. 2569' })).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('explicit archive links remain forecasts and missing origins never substitute latest', async ({ page }) => {
  test.setTimeout(90_000);
  await setup(page);
  await page.goto('/wang-nam-khiao?mapLayer=forecast-archive&target=2025-12&horizon=4');
  await expect(page.locator('.nr-map-shape.is-forecast-high').first()).toBeVisible();
  await expect(page.locator('.nr-archive-context')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'ล่วงหน้า 4 เดือน · เม.ย. 2569' })).toHaveAttribute('aria-selected', 'true');
  for (const path of ['/', '/drought', '/phimai', '/phimai/t-301503']) {
    await page.goto(`${path}?target=2030-01&horizon=1`);
    await expect(page.getByRole('heading', { name: 'ไม่มีเดือนตั้งต้นที่เลือกในคลังพยากรณ์' })).toBeVisible();
    await expect(page).toHaveURL(/target=2030-01/);
    await expect(page.locator('.nr-map-shape')).toHaveCount(0);
  }
  await page.goto('/drought?target=2025-12&horizon=7');
  await expect(page.getByRole('heading', { name: 'ระยะพยากรณ์ในลิงก์ไม่ถูกต้อง' })).toBeVisible();
  await expect(page.locator('.nr-map-shape')).toHaveCount(0);
});
