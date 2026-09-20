import { readFileSync } from 'node:fs';
import { test, expect, seedAuthSession } from './fixtures';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

test.skip(process.env.PLAYWRIGHT_DATA_BACKEND !== 'supabase', 'Requires isolated database fixture');
const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));

for (const code of ['302503', '300304']) test(`tambon ${code} keeps a compact inspection layout and working map tools`, async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => route.fulfill({ json: forecastSlice(archive, route.request().postDataJSON()) }));
  await seedAuthSession(page);
  const district = code.startsWith('3025') ? 'wang-nam-khiao' : 'soeng-sang';
  await page.goto(`/${district}/t-${code}?mapLayer=forecast-archive&target=2025-12&horizon=1`);
  const workspace = page.locator('.nr-drought-compact-workspace.is-subdistrict');
  const map = workspace.locator('.nr-dashboard-map-card');
  const panel = map.locator('.nr-map-panel');
  const svg = map.locator('.nr-map-svg');
  await expect(map.locator('.nr-map-tools')).toBeVisible();
  await expect(workspace.locator('.nr-drought-workspace-chart-card')).toHaveCount(0);
  const check = async () => {
    const frame = (await map.boundingBox())!, plot = (await svg.boundingBox())!;
    const width = await map.evaluate(el => el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) - parseFloat(getComputedStyle(el).paddingRight));
    expect(plot.height).toBeCloseTo(Math.max(280, width * .34), 0);
    expect(plot.y + plot.height).toBeLessThan(frame.y + frame.height);
    const context = (await workspace.locator('.nr-subdistrict-forecast-context').boundingBox())!;
    const guidance = (await workspace.locator('.nr-operational-guidance').boundingBox())!;
    if (page.viewportSize()!.width >= 768) {
      expect(frame.height).toBeLessThan(720);
      expect(context.x).toBeGreaterThan(frame.x + frame.width);
      expect(context.y).toBeCloseTo(frame.y, 0);
      expect(guidance.y + guidance.height).toBeCloseTo(frame.y + frame.height, 0);
    } else {
      expect(frame.width).toBeCloseTo((await workspace.boundingBox())!.width, 0);
      expect(context.y + context.height).toBeLessThan(frame.y);
      expect(guidance.y).toBeGreaterThanOrEqual(frame.y + frame.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  const widths = info.project.name === 'desktop' ? [1440, 2048, 1024] : [390];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await check();
  }
  await page.setViewportSize({ width: info.project.name === 'desktop' ? 1440 : 390, height: info.project.name === 'desktop' ? 1000 : 844 });
  const original = (await map.boundingBox())!;
  await workspace.getByRole('tab', { name: /ล่วงหน้า 6 เดือน/ }).click();
  await expect(workspace.getByRole('tab', { name: /ล่วงหน้า 6 เดือน/ })).toHaveAttribute('aria-selected', 'true');
  await check();
  expect((await map.boundingBox())!.height).toBeCloseTo(original.height, 0);
  await map.getByRole('button', { name: 'ชลประทาน', exact: true }).click();
  await check();
  await map.getByRole('button', { name: 'ความเสี่ยงภัยแล้ง', exact: true }).click();
  const layer = map.locator('.nr-map-transform-layer');
  const beforeZoom = await layer.getAttribute('transform');
  await panel.getByTitle('ขยายแผนที่', { exact: true }).click();
  await expect(layer).not.toHaveAttribute('transform', beforeZoom!);
  await check();
  await page.evaluate(() => scrollTo(0, 0));
  if (code === '302503') await page.screenshot({ path: info.outputPath('tambon-layout.png'), fullPage: true, scale: 'css' });
});
