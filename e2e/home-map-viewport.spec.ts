import { readFileSync } from 'node:fs';
import { test, expect, seedAuthSession, type Locator, type Page } from './fixtures';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));
const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page);
  await page.route('https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_load_forecast_slice', route =>
    route.fulfill({ json: forecastSlice(route.request().postDataJSON().p_horizon_count === 1 ? overview : archive, route.request().postDataJSON()) }));
});

async function settledTransform(layer: Locator) {
  let previous: string | null = null;
  let stable = 0;
  await expect.poll(async () => {
    const current = await layer.getAttribute('transform');
    stable = current === previous ? stable + 1 : 0;
    previous = current;
    return stable;
  }, { intervals: [100] }).toBeGreaterThanOrEqual(2);
  return previous;
}

async function expectContainedMap(page: Page, card: Locator) {
  const bounds = await card.evaluate(element => {
    const selectors = ['.nr-map-panel', '.nr-local-map-criteria', '.nr-map-svg', '.nr-map-legend', '.nr-map-controls'];
    return Object.fromEntries(selectors.map(selector => {
      const node = element.querySelector(selector)!;
      const rect = node.getBoundingClientRect();
      return [selector, { top: rect.top, bottom: rect.bottom, height: rect.height }];
    }));
  });
  expect(bounds['.nr-map-svg'].height).toBeGreaterThanOrEqual(260);
  expect(bounds['.nr-map-svg'].top).toBeGreaterThanOrEqual(bounds['.nr-local-map-criteria'].bottom - 1);
  expect(bounds['.nr-map-svg'].bottom).toBeLessThanOrEqual(bounds['.nr-map-legend'].top + 1);
  expect(bounds['.nr-map-legend'].bottom).toBeLessThanOrEqual(bounds['.nr-map-panel'].bottom + 1);
  expect(bounds['.nr-map-controls'].top).toBeGreaterThanOrEqual(bounds['.nr-map-svg'].top);
  expect(bounds['.nr-map-controls'].bottom).toBeLessThanOrEqual(bounds['.nr-map-svg'].bottom);
  if (page.viewportSize()!.width < 721) {
    const attention = await page.locator('.nr-forecast-overview-attention').boundingBox();
    expect(bounds['.nr-map-panel'].bottom).toBeLessThanOrEqual(attention!.y);
    expect(bounds['.nr-map-legend'].height).toBeLessThanOrEqual(36);
    expect(bounds['.nr-map-legend'].top - bounds['.nr-map-svg'].bottom).toBeLessThanOrEqual(1);
    const controls = await card.locator('.nr-map-controls').evaluate(element => {
      const toolbar = element.getBoundingClientRect();
      return Array.from(element.querySelectorAll('button')).map(button => {
        const rect = button.getBoundingClientRect();
        const icon = button.querySelector('svg')!.getBoundingClientRect();
        return { width: rect.width, height: rect.height, x: icon.x + icon.width / 2 - (toolbar.x + toolbar.width / 2), y: icon.y + icon.height / 2 - (rect.y + rect.height / 2) };
      });
    });
    for (const control of controls) {
      expect(control.width).toBe(44);
      expect(control.height).toBe(44);
      expect(Math.abs(control.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(control.y)).toBeLessThanOrEqual(0.5);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const size of ['default', 'narrow'] as const) {
  test(`Home map contains zoomed drawing and preserves overlay controls (${size})`, async ({ page }, info) => {
    test.skip(size === 'narrow' && info.project.name !== 'webkit-mobile', 'Adjacent iPhone size uses WebKit.');
    test.setTimeout(60000);
    if (size === 'narrow') await page.setViewportSize({ width: 375, height: 667 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?mapLayer=forecast-archive&target=2025-12&horizon=1');
    const card = page.locator('.nr-overview-cockpit-map .nr-dashboard-map-card');
    const map = card.locator('.nr-map-svg');
    const layer = map.locator('.nr-map-transform-layer');
    await expect(map).toBeVisible();
    await expect(page.locator('.nr-forecast-overview-attention li')).toHaveCount(117);
    await page.evaluate(() => document.fonts.ready);
    await card.scrollIntoViewIfNeeded();
    const initialTransform = await settledTransform(layer);
    await expectContainedMap(page, card);

    for (let step = 0; step < 3; step++) {
      await card.getByRole('button', { name: 'ขยายแผนที่', exact: true }).click();
    }
    expect(await settledTransform(layer)).not.toBe(initialTransform);
    const viewport = page.viewportSize()!;
    await map.evaluate(element => window.scrollTo(0, scrollY + element.getBoundingClientRect().top - 110));
    await expectContainedMap(page, card);
    await page.screenshot({ path: info.outputPath('home-map-zoomed.png'), scale: 'css' });
    if (viewport.width < 721) {
      await page.setViewportSize({ width: viewport.height, height: viewport.width });
      await expectContainedMap(page, card);
      await page.setViewportSize(viewport);
      await expectContainedMap(page, card);
    }

    const zoomedTransform = await settledTransform(layer);
    await card.getByRole('button', { name: 'ย่อแผนที่', exact: true }).click();
    expect(await settledTransform(layer)).not.toBe(zoomedTransform);
    await card.getByRole('button', { name: 'กลับมุมมองพื้นที่นี้', exact: true }).click();
    expect(await settledTransform(layer)).toBe(initialTransform);
    await expectContainedMap(page, card);

    await card.getByRole('combobox', { name: 'สถานะพยากรณ์ภัยแล้ง', exact: true }).click();
    await page.getByRole('option', { name: 'เสี่ยงปานกลาง', exact: true }).click();
    await expect(card.getByRole('combobox', { name: 'สถานะพยากรณ์ภัยแล้ง', exact: true })).toContainText('ปานกลาง');
    await card.getByRole('button', { name: 'รีเซ็ต', exact: true }).click();
    await expectContainedMap(page, card);
    await card.locator('.nr-irrigation-filter').getByRole('combobox').click();
    await page.getByRole('option', { name: 'เข้าถึงชลประทาน', exact: true }).click();
    await expect(card.locator('.nr-map-legend [data-report-label="พึ่งน้ำฝน (ไม่มีชลประทาน)"]')).toBeVisible();
    await expectContainedMap(page, card);
    await card.locator('.nr-irrigation-filter').getByRole('combobox').click();
    await page.getByRole('option', { name: 'ทุกสถานะ', exact: true }).click();
    const area = map.locator('[data-nr-subdistrict-code="300116"]');
    if (info.project.use.hasTouch) await area.tap();
    else await area.click();
    const preview = card.getByRole('dialog', { name: /ข้อมูลย่อพื้นที่/ });
    await expect(preview).toBeVisible();
    await expect(preview.getByRole('button', { name: /เปิด/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

for (const route of ['/drought', '/wang-nam-khiao', '/wang-nam-khiao/t-302504']) {
  test(`Map control icons center inside buttons and toolbar: ${route}`, async ({ page }) => {
    await page.goto(`${route}?mapLayer=forecast-archive&target=2025-12&horizon=1`);
    await expect(page.locator('.nr-map-shape').first()).toBeVisible();
    const offsets = await page.locator('.nr-map-controls').evaluate(toolbar => {
      const parent = toolbar.getBoundingClientRect();
      return Array.from(toolbar.querySelectorAll('button')).map(button => {
        const box = button.getBoundingClientRect(), icon = button.querySelector('svg')!.getBoundingClientRect();
        return [icon.x + icon.width / 2 - box.x - box.width / 2,
          icon.y + icon.height / 2 - box.y - box.height / 2,
          icon.x + icon.width / 2 - parent.x - parent.width / 2];
      });
    });
    expect(offsets).toHaveLength(4);
    for (const offset of offsets.flat()) expect(Math.abs(offset)).toBeLessThanOrEqual(0.5);
    const values = await page.locator('.nr-dashboard-map-card .app-select-trigger, .nr-operational-filters .app-select-trigger').evaluateAll(buttons => buttons.map(button => {
      const box = button.getBoundingClientRect(), value = button.querySelector('.app-select-value')!.getBoundingClientRect();
      return [value.x + value.width / 2 - box.x - box.width / 2, value.y + value.height / 2 - box.y - box.height / 2];
    }));
    for (const offset of values.flat()) expect(Math.abs(offset)).toBeLessThanOrEqual(0.5);
  });
}
