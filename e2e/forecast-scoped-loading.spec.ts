import { readFileSync } from 'node:fs';
import { test, expect, seedAuthSession } from './fixtures';
import { forecastSlice, forecastRevision } from '../tests/fixtures/forecast-slice.mjs';

test.skip(process.env.PLAYWRIGHT_DATA_BACKEND !== 'supabase', 'Scoped RPC requires database mode');
const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));

for (const scope of [
  { path: '/drought', area: '30', count: 289 },
  { path: '/dan-khun-thot', area: '3008', count: 16 },
  { path: '/dan-khun-thot/t-300806', area: '300806', count: 1 },
]) test(`scoped loading ${scope.area}: atomic month change, retry and cached horizons`, async ({ page }, testInfo) => {
  const requests: any[] = []; const legacy: string[] = [];
  let failNovember = true;
  let releaseOctober: (() => void) | undefined;
  const october = new Promise<void>(resolve => { releaseOctober = resolve; });
  page.on('request', r => { if (r.url().includes('ktp_load_forecast_archive') || /(drought_forecast_archive_rev03|forecast-overview-t1).*\.json/.test(r.url())) legacy.push(r.url()); });
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', async route => {
    const query = route.request().postDataJSON(); requests.push(query);
    expect(query.p_area_code).toBe(scope.area);
    expect(query.p_horizon_count).toBe(6);
    if (query.p_origin_period === '2025-10') await october;
    if (query.p_origin_period === '2025-11' && failNovember) return route.fulfill({ status: 503, json: { message: 'test outage' } });
    const data = forecastSlice(archive, query);
    expect(data.locations).toHaveLength(scope.count);
    expect(Object.keys(data.packedRiskByTargetMonth)).toHaveLength(1);
    expect(Object.values(data.packedRiskByTargetMonth[data.loadedSelection.originPeriod]).flat()).toHaveLength(scope.count * 6);
    return route.fulfill({ json: data });
  });
  await seedAuthSession(page);
  await page.goto(`${scope.path}?target=2025-12&horizon=4`);
  const month = page.getByRole('combobox', { name: 'เดือนตั้งต้นบนแผนที่พยากรณ์ภัยแล้ง', exact: true });
  await expect(month).toContainText('ธ.ค. 2568');
  const selectMonth = async (label: string) => { await month.click(); await page.getByRole('option', { name: label, exact: true }).click(); };
  const before = await page.locator('.nr-drought-workspace-kpis').innerText();
  await selectMonth('พ.ย. 2568');
  await expect(page.getByRole('alert')).toContainText('ยังแสดงรอบเดิม');
  await expect(month).toContainText('ธ.ค. 2568');
  await expect(page).toHaveURL(/target=2025-12/);
  expect(await page.locator('.nr-drought-workspace-kpis').innerText()).toBe(before);
  failNovember = false;
  await page.getByRole('button', { name: 'ลองใหม่', exact: true }).click();
  await expect(month).toContainText('พ.ย. 2568');
  await expect(page).toHaveURL(/target=2025-11.*horizon=4/);
  await expect(page.locator('.nr-forecast-archive-horizon-tabs [aria-selected="true"]')).toContainText('มี.ค. 2569');
  await page.getByRole('tab', { name: /T\+6/ }).click();
  await expect(page).toHaveURL(/horizon=6/);
  expect(requests).toHaveLength(3);
  await selectMonth('ต.ค. 2568');
  await expect(page.getByRole('status').filter({ hasText: 'กำลังโหลดรอบที่เลือก' })).toBeVisible();
  await expect(month).toContainText('พ.ย. 2568');
  if (scope.area === '300806') await page.screenshot({ path: testInfo.outputPath('changing-month-keeps-previous-data.png') });
  // A later selection must win even if the older network response arrives last.
  await selectMonth('ธ.ค. 2568');
  await expect(month).toContainText('ธ.ค. 2568');
  const lateResponse = page.waitForResponse(r => r.url().includes('ktp_load_forecast_slice') && r.request().postDataJSON().p_origin_period === '2025-10');
  releaseOctober!();
  await (await lateResponse).finished();
  await expect.poll(() => requests.length).toBe(4);
  await expect(page).toHaveURL(/target=2025-12.*horizon=6/);
  await expect(page.locator('.nr-forecast-archive-horizon-tabs [aria-selected="true"]')).toContainText('มิ.ย. 2569');
  await expect(page.locator('.nr-map-shape:not(.is-criteria-filtered)')).toHaveCount(scope.count);
  expect(legacy).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`scoped-${scope.area}.png`), fullPage: true });
});

test('overview loads one T+1 month, then requests only the changed month', async ({ page }, testInfo) => {
  const requests: any[] = [];
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
    const query = route.request().postDataJSON(); requests.push(query);
    expect(query.p_area_code).toBe('30'); expect(query.p_horizon_count).toBe(1);
    return route.fulfill({ json: forecastSlice(overview, query) });
  });
  await seedAuthSession(page);
  await page.goto('/?target=2025-12');
  await expect(page.locator('.nr-forecast-overview-summary .metric-card-value')).toHaveText(['0 ตำบล', '117 ตำบล', '0 ตำบล', '172 ตำบล']);
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'แก้ไขตัวกรองข้อมูล' }).click();
  const month = page.getByRole('combobox', { name: testInfo.project.name === 'mobile' ? 'เลือกเดือนตั้งต้น' : /^เดือนตั้งต้น / });
  await month.click(); await page.getByRole('option', { name: 'พ.ย. 2568', exact: true }).click();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'แสดงผล', exact: true }).click();
  await expect(page.locator('.nr-forecast-overview-summary .metric-card-value')).toHaveText(['0 ตำบล', '48 ตำบล', '69 ตำบล', '172 ตำบล']);
  expect(requests.map(r => r.p_origin_period)).toEqual(['2025-12', '2025-11']);
});

test('an open page checks publication on focus and periodically, updating the visible slice without reloading', async ({ page }) => {
  let current = archive; let offline = false; let revisionReads = 0;
  let holdRevision = false; let releaseRevision!: () => void;
  const revisionGate = new Promise<void>(resolve => { releaseRevision = resolve; });
  const slices: any[] = [];
  await page.route('**/rest/v1/rpc/ktp_latest_forecast_revision', async route => {
    revisionReads++;
    if (holdRevision) await revisionGate;
    return route.fulfill(offline ? { status: 503, json: { message: 'test offline' } }
      : { json: { ...forecastRevision(current), publishedAt: current === archive ? '2026-09-06T10:00:00Z' : '2026-09-07T10:00:00Z' } });
  });
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
    const query = route.request().postDataJSON(); slices.push(query);
    expect(query.p_area_code).toBe('300806');
    return route.fulfill({ json: forecastSlice(current, query) });
  });
  await page.clock.install();
  await seedAuthSession(page);
  await page.goto('/dan-khun-thot/t-300806?target=2025-12&horizon=1');
  const shape = page.locator('.nr-map-shape[data-nr-subdistrict-code="300806"]');
  await expect(shape).toHaveCSS('fill', 'rgb(241, 184, 75)');
  const initialReads = revisionReads;
  holdRevision = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => revisionReads).toBeGreaterThan(initialReads);
  await expect(page.getByRole('status').filter({ hasText: 'กำลังโหลดรอบที่เลือก' })).toHaveCount(0);
  holdRevision = false; releaseRevision();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  expect(slices).toHaveLength(1);
  // Synthetic publication is test-only; source files and Supabase are untouched.
  current = structuredClone(archive);
  current.meta.datasetId = '11111111-1111-4111-8111-111111111111';
  current.meta.datasetVersion = 'test-only-new-publication';
  current.meta.sourceWorkbookSha256 = 'b'.repeat(64);
  current.packedRiskByTargetMonth['2025-12']['300806'][0] = 2;
  await page.clock.fastForward(60_000);
  await expect(shape).toHaveCSS('fill', 'rgb(217, 93, 89)');
  expect(slices).toHaveLength(2);
  expect(slices[1].p_version).toBe(current.meta.datasetVersion);
  offline = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('alert')).toContainText('ยังแสดงรอบเดิม');
  await expect(shape).toHaveCSS('fill', 'rgb(217, 93, 89)');
  expect(slices).toHaveLength(2);
});
