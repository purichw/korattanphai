import { readFileSync } from 'node:fs';
import { test as base, expect, seedAuthSession, type Page } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

const test = base.extend<{ referenceDatabase: unknown }>({
  referenceDatabase: [async ({ context }, use) => {
    const database = process.env.PLAYWRIGHT_REFERENCE_BACKEND === 'cms'
      ? await cmsTestDatabase(context, { references: true }) : null;
    try { await use(database); } finally { await database?.close(); }
  }, { auto: true }],
});
test.skip(process.env.PLAYWRIGHT_DATA_BACKEND !== 'supabase', 'Requires isolated database fixture');
const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));

async function setup(page: Page, path: string) {
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
    const query = route.request().postDataJSON();
    return route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
  });
  await seedAuthSession(page);
  const geometry = page.waitForResponse(response => process.env.PLAYWRIGHT_REFERENCE_BACKEND === 'cms'
    ? new URL(response.url()).pathname.endsWith('/ktp_cms_reference_read')
    : new URL(response.url()).pathname === '/geodata/nakhon-ratchasima-subdistricts.geojson');
  await page.goto(`${path}?mapLayer=forecast-archive&target=2025-12&horizon=1`);
  expect((await geometry).ok()).toBe(true);
  await expect(page.locator('.nr-map-shape').first()).toBeVisible();
  await page.locator('.nr-map-svg').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  await settledCamera(page);
}

async function settledCamera(page: Page) {
  let previous: string | null = null;
  let stableFrames = 0;
  await expect.poll(async () => {
    const next = await page.locator('.nr-map-transform-layer').evaluate(element => new Promise<string | null>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(element.getAttribute('transform'))));
    }));
    stableFrames = next === previous ? stableFrames + 1 : 0;
    previous = next;
    return next !== null && stableFrames >= 3;
  }, { intervals: [100] }).toBe(true);
}

async function zoomIn(page: Page, count: number) {
  const layer = page.locator('.nr-map-transform-layer');
  const before = await layer.getAttribute('transform');
  // Repeated presses exercise the actual button handler and its accumulated zoom target.
  await page.locator('.nr-map-panel').getByTitle('ขยายแผนที่', { exact: true }).evaluate((button, presses) => {
    for (let index = 0; index < presses; index += 1) (button as HTMLButtonElement).click();
  }, count);
  await expect(layer).not.toHaveAttribute('transform', before!);
  await settledCamera(page);
  await page.locator('.nr-map-svg').scrollIntoViewIfNeeded();
}

async function pinchZoomIn(page: Page) {
  const svg = page.locator('.nr-map-svg');
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  const layer = page.locator('.nr-map-transform-layer');
  const before = await layer.getAttribute('transform');
  const touch = await page.context().newCDPSession(page);
  const points = (spread: number) => [
    { x: box.x + box.width / 2 - spread, y: box.y + box.height / 2, id: 0 },
    { x: box.x + box.width / 2 + spread, y: box.y + box.height / 2, id: 1 },
  ];
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(30) });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(66) });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.detach();
  await expect(layer).not.toHaveAttribute('transform', before!);
  await settledCamera(page);
}

async function visibleLabels(page: Page, selector: string) {
  return page.locator(`.nr-map-label-layer ${selector}`).evaluateAll(elements => elements.flatMap(element => {
    const text = element as SVGTextElement;
    const matrix = text.getScreenCTM();
    const plot = text.ownerSVGElement?.getBoundingClientRect();
    const bounds = text.getBoundingClientRect();
    const style = getComputedStyle(text);
    if (!matrix || !plot || !bounds.width || !bounds.height || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return [];
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    // SVG text can be mounted but clipped outside the plot after pan/zoom.
    if (centerX < Math.max(0, plot.left) || centerX > Math.min(innerWidth, plot.right)
      || centerY < Math.max(0, plot.top) || centerY > Math.min(innerHeight, plot.bottom)) return [];
    return [{ text: text.textContent, screenFontSize: parseFloat(style.fontSize) * Math.hypot(matrix.c, matrix.d),
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }];
  }));
}

async function expectReadableLabels(page: Page, selector: string, minimum: number) {
  await expect.poll(async () => (await visibleLabels(page, selector)).length).toBeGreaterThan(0);
  const labels = await visibleLabels(page, selector);
  // getComputedStyle(fontSize) alone is in SVG units; include both map zoom and CSS viewBox scaling.
  expect(Math.min(...labels.map(label => label.screenFontSize))).toBeGreaterThanOrEqual(minimum - 0.05);
  return labels;
}

test('province zoom reveals readable district and unselected subdistrict names', async ({ page }, info) => {
  test.setTimeout(60_000);
  await setup(page, '/');
  const minimum = info.project.name.includes('mobile') ? 11 : 6;
  const route = page.url();
  await expect(page.locator('.nr-map-shape.is-selected')).toHaveCount(0);
  await zoomIn(page, 3);
  const districts = await expectReadableLabels(page, '.is-district-label', minimum);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: info.outputPath('province-district-labels.png') });
  if (info.project.name === 'mobile') await pinchZoomIn(page);
  else await zoomIn(page, 6);
  const subdistricts = await expectReadableLabels(page, '.is-subdistrict-label:not(.is-featured-label):not(.is-selected-label):not(.is-previewed-label)', minimum);
  await expect(page.locator('.nr-map-shape.is-selected')).toHaveCount(0);
  expect(page.url()).toBe(route);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: info.outputPath('province-subdistrict-labels.png') });
  await info.attach('visible-label-metrics', { body: JSON.stringify({ districts, subdistricts }, null, 2), contentType: 'application/json' });
});

test('district zoom keeps subdistrict names readable within the plot', async ({ page }, info) => {
  test.setTimeout(60_000);
  await setup(page, '/soeng-sang');
  const minimum = info.project.name.includes('mobile') ? 11 : 6;
  await zoomIn(page, 2);
  const labels = await expectReadableLabels(page, '.is-subdistrict-label', minimum);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: info.outputPath('district-subdistrict-labels.png') });
  await info.attach('visible-label-metrics', { body: JSON.stringify(labels, null, 2), contentType: 'application/json' });
});

test('single-area inspection retains a readable selected place name', async ({ page }, info) => {
  test.setTimeout(60_000);
  await setup(page, '/phimai/t-301503');
  await expect(page.locator('[data-nr-subdistrict-code="301503"]')).toHaveClass(/is-selected/);
  const labels = await expectReadableLabels(page, '.is-subdistrict-label.is-selected-label', info.project.name.includes('mobile') ? 12 : 6);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: info.outputPath('selected-place-label.png') });
  await info.attach('visible-label-metrics', { body: JSON.stringify(labels, null, 2), contentType: 'application/json' });
});
