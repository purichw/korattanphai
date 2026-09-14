import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect, seedAuthSession, type Page } from './fixtures';
import { forecastSlice, forecastRevision } from '../tests/fixtures/forecast-slice.mjs';

test.skip(process.env.PLAYWRIGHT_DATA_BACKEND !== 'supabase', 'Requires isolated database fixture');
const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));
async function setup(page: Page, path = '/soeng-sang?target=2025-12&horizon=1') {
  const requests: any[] = [];
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
    const query = route.request().postDataJSON(); requests.push(query);
    return route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
  });
  await seedAuthSession(page);
  // Cold dev-server/module loading is setup, not part of the gesture contract.
  const geometry = page.waitForResponse(response => new URL(response.url()).pathname === '/geodata/nakhon-ratchasima-subdistricts.geojson');
  await page.goto(path);
  expect((await geometry).ok()).toBe(true);
  await expect(page.getByRole('button', { name: 'ค้นหาพื้นที่บนแผนที่' })).toBeVisible();
  return requests;
}
async function choose(page: Page, name: string | RegExp, option: string) {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function openAnalysis(page: Page) {
  await page.getByRole('button', { name: 'วิเคราะห์พยากรณ์', exact: true }).click();
  await expect(page.locator('.nr-analysis-table tbody tr').first()).toBeVisible();
}

async function settledCamera(page: Page) {
  const layer = page.locator('.nr-map-transform-layer');
  let previous: string | null = null;
  let stableFrames = 0;
  await expect.poll(async () => {
    // Observe rendered frames, not two timer reads while a busy CI browser has
    // yet to advance the wheel animation.
    const next = await layer.evaluate(element => new Promise<string | null>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(element.getAttribute('transform'))));
    }));
    stableFrames = next === previous ? stableFrames + 1 : 0;
    previous = next;
    return next !== null && stableFrames >= 3;
  }, { intervals: [100] }).toBe(true);
  return previous!;
}

for (const path of ['/?target=2025-12', '/drought?target=2025-12', '/soeng-sang?target=2025-12', '/phimai/t-301503?target=2025-12']) {
  test(`Korat shared map scroll, camera and fullscreen tools ${path}`, async ({ page }, info) => {
    test.setTimeout(90_000);
    // Compact tambon pages can fit at 960px; keep real document scrolling available.
    if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 720 });
    await setup(page, path);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const panel = page.locator('.nr-map-panel');
    const svg = page.locator('.nr-map-svg');
    const layer = page.locator('.nr-map-transform-layer');
    const url = page.url();
    await panel.evaluate(element => element.setAttribute('data-interaction-probe', 'original'));
    const fit = await settledCamera(page);
    await page.evaluate(() => scrollTo(0, 0));
    await page.mouse.move(page.viewportSize()!.width - 5, 300);
    await page.mouse.wheel(0, 240);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await expect(layer).toHaveAttribute('transform', fit);
    await panel.getByTitle('ขยายแผนที่', { exact: true }).click();
    await expect(layer).not.toHaveAttribute('transform', fit);
    const zoom = await settledCamera(page);
    await svg.scrollIntoViewIfNeeded();
    const point = await svg.evaluate(element => {
      const box = element.getBoundingClientRect();
      for (const xr of [.12, .25, .75, .88]) for (const yr of [.3, .5, .7]) {
        const x = box.x + box.width * xr, y = box.y + box.height * yr;
        const hit = document.elementFromPoint(x, y);
        if (hit && element.contains(hit) && !hit.closest('.nr-map-shape')) return { x, y };
      }
      throw new Error('No reachable map background for a real pointer gesture');
    });
    if (info.project.name === 'mobile') {
      const touch = await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 0 }] });
      await expect(panel).toHaveClass(/is-dragging/);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + 48, y: point.y + 24, id: 0 }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.detach();
    } else {
      await page.mouse.move(point.x, point.y); await page.mouse.down();
      await page.mouse.move(point.x + 48, point.y + 24, { steps: 6 }); await page.mouse.up();
    }
    await expect(layer).not.toHaveAttribute('transform', zoom);
    const dragged = await settledCamera(page);
    if (info.project.name === 'mobile') {
      const touch = await page.context().newCDPSession(page);
      const points = (spread: number) => [{ x: point.x - spread, y: point.y, id: 0 }, { x: point.x + spread, y: point.y, id: 1 }];
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(14) });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(36) });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.detach();
    } else {
      const scrollBefore = await page.evaluate(() => scrollY);
      await page.mouse.move(point.x, point.y); await page.mouse.wheel(0, 40);
      await expect(layer).not.toHaveAttribute('transform', dragged);
      expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
    }
    await expect(layer).not.toHaveAttribute('transform', dragged);
    const panned = await settledCamera(page);
    await panel.getByRole('combobox', { name: 'เดือนตั้งต้นบนแผนที่พยากรณ์ภัยแล้ง', exact: true }).click();
    const options = page.locator('.app-select-options').last();
    await options.hover(); await page.mouse.wheel(0, 220);
    await expect.poll(() => options.evaluate(element => Math.max(element.scrollTop, element.closest('.app-select-menu')!.scrollTop))).toBeGreaterThan(0);
    await expect(layer).toHaveAttribute('transform', panned);
    await page.keyboard.press('Escape');
    const opener = page.getByRole('button', { name: 'ค้นหาพื้นที่บนแผนที่' });
    await opener.click();
    const scroll = await page.evaluate(() => scrollY);
    await page.mouse.move(3, page.viewportSize()!.height - 3);
    await page.mouse.wheel(0, 240);
    await page.getByRole('searchbox').fill('นครราชสีมา');
    expect(await page.evaluate(() => scrollY)).toBe(scroll);
    await expect(layer).toHaveAttribute('transform', panned);
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await opener.click();
    await page.mouse.click(2, 2);
    await expect(page.locator('.nr-tool-dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
    await panel.getByTitle('เปิดแผนที่เต็มจอ', { exact: true }).click();
    await expect.poll(() => panel.evaluate(element => document.fullscreenElement === element)).toBe(true);
    await openAnalysis(page);
    await expect(page.locator('.nr-tool-dialog')).toBeVisible();
    expect(await page.locator('.nr-tool-dialog').evaluate(element => document.fullscreenElement?.contains(element))).toBe(true);
    const pattern = page.getByRole('combobox', { name: 'รูปแบบความเสี่ยง 6 เดือน', exact: true });
    await pattern.click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.screenshot({ path: info.outputPath('custom-dropdown.png') });
    await pattern.press('ArrowDown');
    await pattern.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.locator('.nr-tool-dialog')).toBeVisible();
    await expect(pattern).toBeFocused();
    await page.screenshot({ path: info.outputPath('fullscreen-analysis.png') });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'วิเคราะห์พยากรณ์', exact: true })).toBeFocused();
    await panel.getByTitle('ออกจากเต็มจอ', { exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await panel.getByTitle('กลับมุมมองพื้นที่นี้', { exact: true }).click();
    await expect(layer).toHaveAttribute('transform', fit);
    await expect(panel).toHaveAttribute('data-interaction-probe', 'original');
    expect(page.url()).toBe(url);
    expect(errors).toEqual([]);
  });
}

for (const path of ['/?target=2025-12', '/drought?target=2025-12', '/soeng-sang?target=2025-12', '/phimai/t-301503?target=2025-12']) {
  test(`Korat map tools scope and on-demand table ${path}`, async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const lazyRequests: string[] = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (/(?:mapImageExport|mapReport|mapPoint|ForecastAnalysisDialog|jspdf|html2canvas|purify)/.test(url.pathname)) lazyRequests.push(url.pathname);
    });
    const requests = await setup(page, path);
    expect(lazyRequests).toEqual([]);
    expect(requests).toHaveLength(1);
    await expect(page.locator('.nr-map-svg')).toBeVisible();
    const plot = await page.locator('.nr-map-svg').boundingBox(); expect(plot!.height).toBeGreaterThanOrEqual(260);
    await page.getByRole('button', { name: 'ค้นหาพื้นที่บนแผนที่' }).click();
    await page.getByRole('searchbox', { name: 'ชื่อหรือรหัสพื้นที่นครราชสีมา' }).fill('เชียงใหม่');
    await expect(page.locator('.nr-area-search-results li')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'ค้นหาพื้นที่บนแผนที่' })).toBeFocused();
    await openAnalysis(page);
    const rowCount = path.startsWith('/phimai') ? 1 : path.startsWith('/soeng') ? 1 : 32;
    await expect(page.locator('.nr-analysis-table tbody tr')).toHaveCount(rowCount);
    await expect(page.locator('.nr-analysis-table')).toContainText('ม.ค. 2569');
    await expect(page.locator('.nr-analysis-table')).toContainText('มิ.ย. 2569');
    if (path.startsWith('/phimai')) await expect(page.getByRole('button', { name: 'เปรียบเทียบอำเภอ', exact: true })).toHaveCount(0);
    if (path.startsWith('/?')) expect(requests.map(query => query.p_horizon_count)).toEqual([1, 6]);
    await page.screenshot({ path: info.outputPath('table.png') });
    await page.keyboard.press('Escape');
    await page.locator('.nr-map-tools').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('map-tools.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('Korat map tools table, pattern, district comparison and same-target map colors', async ({ page }, info) => {
  await setup(page);
  await choose(page, 'สถานะพยากรณ์ภัยแล้ง', 'เสี่ยงสูง');
  await openAnalysis(page);
  await choose(page, 'ระดับตาราง', 'รายตำบล');
  await expect(page.locator('.nr-analysis-table tbody tr')).toHaveCount(6);
  await choose(page, 'รูปแบบความเสี่ยง 6 เดือน', 'เสี่ยงต่อเนื่องอย่างน้อย 3 เดือน');
  const members = archive.locations.filter((row: any) => row.districtCode === '3003');
  const expected = members.filter((row: any) => {
    const risks = archive.packedRiskByTargetMonth['2025-12'][row.subdistrictCode];
    return [0, 1, 2, 3].some(i => risks.slice(i, i + 3).every((r: any) => r === 1 || r === 2));
  });
  await expect(page.locator('.nr-analysis-table tbody tr')).toHaveCount(expected.length);
  await page.getByRole('button', { name: 'แสดงบนแผนที่', exact: true }).click();
  await expect(page.locator('.nr-map-shape:not(.is-criteria-filtered)')).toHaveCount(expected.length);
  await page.getByRole('button', { name: 'ล้างการวิเคราะห์', exact: true }).click();
  await expect(page.locator('.nr-map-shape:not(.is-criteria-filtered)')).toHaveCount(6);
  await openAnalysis(page);
  await page.getByRole('button', { name: 'กราฟอำเภอ', exact: true }).click();
  await expect(page.getByRole('list', { name: 'กราฟเปรียบเทียบอำเภอ' })).toContainText('เสิงสาง');
  await page.screenshot({ path: info.outputPath('district-comparison.png') });
  await page.getByRole('button', { name: 'เปรียบเทียบรอบ', exact: true }).click();
  await choose(page, /^รอบตั้งต้นอ้างอิง /, 'พ.ย. 2568');
  await expect(page.getByRole('region', { name: 'ตารางเปรียบเทียบรอบ' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('round-comparison.png') });
  await page.getByRole('button', { name: 'แสดงบนแผนที่', exact: true }).click();
  await expect(page.locator('.nr-map-analysis-notice')).toContainText('พยากรณ์ ม.ค. 2569');
  for (const member of members) {
    const now = archive.packedRiskByTargetMonth['2025-12'][member.subdistrictCode][0];
    const before = archive.packedRiskByTargetMonth['2025-11'][member.subdistrictCode][1];
    await expect.poll(() => page.locator(`[data-nr-subdistrict-code="${member.subdistrictCode}"]`).evaluate(el => getComputedStyle(el).fill))
      .toBe(now === null || before === null ? 'url("#nr-forecast-out-of-scope-hatch")' : now > before ? 'rgb(184, 59, 63)' : now < before ? 'rgb(57, 127, 197)' : 'rgb(165, 173, 168)');
  }
  await page.getByRole('tab', { name: /ล่วงหน้า 2 เดือน/ }).click();
  await expect(page.locator('.nr-map-analysis-notice')).toHaveCount(0);
});

test('Korat empty irrigation retains compact map dimensions', async ({ page }) => {
  await setup(page, '/soeng-sang?target=2025-12&horizon=4');
  const map = page.locator('.nr-dashboard-map-card');
  const initial = (await map.boundingBox())!;
  await map.locator('.nr-irrigation-filter').getByRole('combobox').click();
  await page.getByRole('option', { name: 'เข้าถึงชลประทาน', exact: true }).click();
  await expect(page.locator('.nr-irrigation-empty')).toBeVisible();
  const empty = (await map.boundingBox())!;
  expect(empty.width).toBeCloseTo(initial.width, 0);
  expect(empty.height).toBeCloseTo(initial.height, 0);
  if (page.viewportSize()!.width > 900) {
    await map.evaluate(element => { element.style.width = 'calc(100% - 16px)'; });
    await expect.poll(async () => (await map.boundingBox())!.width).toBeLessThan(initial.width - 10);
    await map.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect.poll(() => map.evaluate(element => Number.parseFloat(element.style.getPropertyValue('--nr-populated-map-height')))).toBeCloseTo(initial.height, 0);
    await map.evaluate(element => element.style.removeProperty('width'));
    await expect.poll(async () => (await map.boundingBox())!.height).toBeCloseTo(initial.height, 0);
  }
  await page.getByRole('button', { name: 'แสดงทุกสถานะชลประทาน', exact: true }).click();
  await expect(page.locator('.nr-drought-workspace-chart-card')).toBeVisible();
  await expect.poll(async () => (await map.boundingBox())!.height).toBeCloseTo(initial.height, 0);
});

test('Korat playback period stays grouped and keeps the map frame stable', async ({ page }, info) => {
  await setup(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const playback = page.locator('.nr-map-playback');
  const period = playback.getByRole('status');
  const panel = page.locator('.nr-map-panel');
  await playback.scrollIntoViewIfNeeded();
  await expect(period).toContainText('T+1');
  await expect(period).toContainText('ม.ค. 2569');
  const initial = await panel.boundingBox();
  const initialControl = await playback.boundingBox();
  await playback.getByRole('button', { name: 'เล่นลำดับพยากรณ์ 6 เดือน' }).click();
  await expect(playback).toHaveClass(/is-playing/);
  await expect(page).toHaveURL(/horizon=2/);
  await playback.getByRole('button', { name: 'หยุดลำดับพยากรณ์' }).click();
  await expect(period).toContainText('T+2');
  await expect(period).toContainText('ก.พ. 2569');
  await expect(playback).not.toHaveClass(/is-playing/);
  expect((await panel.boundingBox())!.height).toBeCloseTo(initial!.height, 0);
  expect((await playback.boundingBox())!.height).toBe(initialControl!.height);
  expect((await playback.boundingBox())!.width).toBe(initialControl!.width);
  await expect(page.locator('.nr-map-tool-status')).toHaveCount(0);
  const layout = await playback.evaluate(element => {
    const box = element.getBoundingClientRect();
    return [...element.querySelectorAll('button, .nr-map-playback-period')].every(child => {
      const rect = child.getBoundingClientRect();
      return rect.left >= box.left && rect.right <= box.right && rect.top >= box.top && rect.bottom <= box.bottom;
    });
  });
  expect(layout).toBe(true);
  await playback.getByRole('button', { name: 'เล่นลำดับพยากรณ์ 6 เดือน' }).click();
  await page.mouse.move(0, 0);
  const contrast = await playback.getByRole('button').evaluate(element => ({
    icon: getComputedStyle(element).color,
    expected: getComputedStyle(element.querySelector('svg')!).color,
  }));
  expect(contrast.icon).not.toBe('rgb(255, 255, 255)');
  expect(contrast.expected).toBe(contrast.icon);
  const card = (await page.locator('.nr-dashboard-map-card').boundingBox())!;
  const control = (await playback.boundingBox())!;
  const viewport = page.viewportSize()!;
  const x = Math.max(0, card.x - 12), y = Math.max(0, card.y - 12);
  await page.screenshot({ path: info.outputPath(`playback-${info.project.name}.png`), scale: 'css', clip: {
    x, y, width: Math.min(viewport.width - x, card.width + 24),
    height: Math.min(viewport.height - y, control.y + control.height + 100 - y),
  } });
  await playback.getByRole('button', { name: 'หยุดลำดับพยากรณ์' }).click();
  if (info.project.name === 'mobile') {
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const narrow = await playback.boundingBox();
    expect(narrow!.x).toBeGreaterThanOrEqual(0);
    expect(narrow!.x + narrow!.width).toBeLessThanOrEqual(320);
  }
  expect(errors).toEqual([]);
});

test('Korat map tools coordinates, playback, search focus and PNG/PDF download', async ({ page }, info) => {
  test.setTimeout(90_000);
  await setup(page, '/drought?target=2025-12&horizon=1');
  await page.getByRole('button', { name: 'ค้นหาด้วยพิกัด', exact: true }).click();
  await page.getByLabel('ละติจูด (WGS84)').fill('13.7563');
  await page.getByLabel('ลองจิจูด (WGS84)').fill('100.5018');
  await page.getByRole('button', { name: 'ค้นหาตำบล', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('นอกขอบเขตนครราชสีมา');
  await page.getByLabel('ละติจูด (WGS84)').fill('14.9775');
  await page.getByLabel('ลองจิจูด (WGS84)').fill('102.0892');
  await page.getByRole('button', { name: 'ค้นหาตำบล', exact: true }).click();
  await expect(page.locator('.nr-coordinate-pin')).toBeVisible();
  await expect(page.locator('.nr-map-tools')).toContainText('ไม่ใช่รายแปลง');
  await page.getByRole('button', { name: 'ล้างจุดพิกัด' }).click();
  await page.getByRole('button', { name: 'เล่นลำดับพยากรณ์ 6 เดือน' }).click();
  await expect(page).toHaveURL(/horizon=2/, { timeout: 8000 });
  await page.getByRole('button', { name: 'หยุดลำดับพยากรณ์' }).click();
  await page.getByRole('button', { name: 'ค้นหาพื้นที่บนแผนที่' }).click();
  await page.getByRole('searchbox').fill('301503');
  await page.locator('.nr-area-search-results button').click();
  await expect(page.locator('[data-nr-subdistrict-code="301503"]')).toHaveClass(/is-selected/);
  await page.evaluate(() => {
    const policy = document.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "img-src 'self' data:";
    document.head.append(policy);
  });
  for (const format of ['PNG', 'PDF']) {
    await page.getByRole('button', { name: 'ส่งออกแผนที่', exact: true }).click();
    if (format === 'PDF') await choose(page, 'รูปแบบไฟล์แผนที่', 'PDF');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ดาวน์โหลด', exact: true }).click();
    const result = await download;
    const path = info.outputPath(`map.${format.toLowerCase()}`);
    await result.saveAs(path);
    const bytes = readFileSync(path);
    expect(bytes.length).toBeGreaterThan(20_000);
    if (format === 'PNG') expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    else expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  }
});

for (const path of ['/soeng-sang?target=2025-12&horizon=1', '/phimai/t-301503?target=2025-12&horizon=1']) {
  test(`Korat report A4 scoped export ${path}`, async ({ page }, info) => {
    await setup(page, path);
    await page.getByRole('button', { name: 'ส่งออกแผนที่', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'ขอบเขตภาพรายงาน' })).toContainText('พื้นที่ทั้งหมดของหน้านี้');
    const camera = await page.locator('.nr-map-transform-layer').getAttribute('transform');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ดาวน์โหลด', exact: true }).click();
    const file = await download;
    const output = info.outputPath('report.png'); await file.saveAs(output);
    const bytes = readFileSync(output);
    expect(bytes.readUInt32BE(16)).toBe(1600); expect(bytes.readUInt32BE(20)).toBe(2263);
    await expect(page.locator('.nr-map-transform-layer')).toHaveAttribute('transform', camera!);
  });
}

test('Korat map tools rejects stale analysis, recovers errors and revalidates new publication', async ({ page }, info) => {
  await setup(page);
  let failed = true, current = archive, reads = 0;
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => route.fulfill(failed ? { status: 503, json: { message: 'test failure' } }
    : { json: forecastSlice(current, route.request().postDataJSON()) }));
  await page.getByRole('button', { name: 'วิเคราะห์พยากรณ์' }).click();
  await expect(page.locator('.nr-tool-dialog [role="alert"]')).toBeVisible();
  await expect(page.locator('.nr-analysis-table')).toHaveCount(0);
  failed = false;
  await page.getByRole('button', { name: 'ลองใหม่', exact: true }).click();
  await expect(page.locator('.nr-analysis-table')).toBeVisible();
  await expect(page.locator('.nr-analysis-table tbody tr').first().locator('td').first()).toContainText('1 · ปานกลาง');
  await expect(page.locator('.nr-analysis-source')).toHaveCount(0);
  await expect(page.locator('.nr-tool-dialog')).not.toContainText('Drought_T1-6_rev03.xlsx');
  await page.screenshot({ path: info.outputPath('analysis-without-footer.png') });
  current = structuredClone(archive); current.meta.datasetId = '11111111-1111-4111-8111-111111111111';
  current.meta.datasetVersion = 'test-new-publication'; current.meta.sourceWorkbookSha256 = 'b'.repeat(64);
  const changed = current.locations.find((location: { districtCode: string; subdistrictCode: string }) => location.districtCode === '3003'
    && current.packedRiskByTargetMonth['2025-12'][location.subdistrictCode]?.[0] === 1);
  current.packedRiskByTargetMonth['2025-12'][changed.subdistrictCode][0] = 2;
  await page.route('**/rest/v1/rpc/ktp_latest_forecast_revision', route => { reads++; return route.fulfill({ json: { ...forecastRevision(current), publishedAt: '2026-09-08T10:00:00Z' } }); });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => reads).toBeGreaterThan(0);
  // Either the page and dialog adopt the new revision together, or old output is withheld.
  await expect.poll(async () => (await page.locator('.nr-analysis-table tbody tr').first().locator('td').first().allTextContents()).join('')
    + (await page.locator('.nr-tool-dialog [role="alert"]').allTextContents()).join('')).toMatch(/2 · สูง|มีข้อมูลรุ่นใหม่/);
});

test('Korat report dynamic pagination preserves Thai text and page flow', async ({ page }, info) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const modulePath = '/src/mapImageExport.ts';
    const { snapshotMapSvg, createMapImage, mapImageBlob } = await import(modulePath);
    const snapshot = snapshotMapSvg(document.querySelector('.nr-map-svg'));
    const context = {
      title: 'รายงานพยากรณ์ภัยแล้ง', scope: 'จังหวัดนครราชสีมา (ทดสอบการจัดหน้ารายงาน)', origin: 'ธ.ค. 2568', target: 'ม.ค. 2569', horizon: 1,
      filters: 'ทดสอบข้อความยาวและการจัดหน้าอัตโนมัติ ', details: [], timestamp: '13/9/2569 12:00', filename: 'layout-test',
      source: { workbook: 'Drought_T1-6_rev03.xlsx', sheet: 'Master_Data_Drought_Final', version: 'layout-test', sha: 'a'.repeat(64) },
      legend: [{ label: 'ไม่พบสัญญาณเสี่ยง', color: '#5dae79' }, { label: 'เสี่ยงปานกลาง', color: '#f1b84b' }, { label: 'เสี่ยงสูง', color: '#d95d59' }, { label: 'นอกขอบเขตการศึกษา', color: '#e2e8e4', hatched: true }],
    };
    const checks: { pages: number; valid: boolean; figures: number }[] = [];
    let stress;
    for (const length of [0, 5, 25, 70]) {
      const details = Array.from({ length }, (_, i) => `รายการตรวจสอบ ${i + 1}: ` + 'ชื่อพื้นที่นครราชสีมาและข้อความอ้างอิงสำหรับทดสอบการตัดบรรทัดภาษาไทย '.repeat(3));
      const report = await createMapImage(snapshot, { ...context, details, filters: context.filters.repeat(length ? 20 : 1),
        source: { ...context.source, workbook: length ? 'long_filename_without_spaces_'.repeat(25) + '.xlsx' : context.source.workbook } });
      const ctx = document.createElement('canvas').getContext('2d')!;
      const family = getComputedStyle(document.body).fontFamily;
      let valid = true, figures = 0;
      for (const page of report.layout) {
        let bottom = report.contentTop;
        page.forEach((item: any, index: number) => {
          if (item.top < bottom || item.top + item.height > report.contentBottom) valid = false;
          if (item.content.kind === 'text') {
            const row = item.content;
            ctx.font = `${row.bold ? '600 ' : ''}${row.size}px ${family}`;
            if (ctx.measureText(row.text).width > 1456.1 || /^\p{Mark}/u.test(row.text)) valid = false;
            if (row.bold && index === page.length - 1) valid = false;
          }
          if (item.content.kind === 'map') figures++;
          bottom = item.top + item.height;
        });
      }
      const contents = report.layout.flat().filter((item: any) => item.content.kind === 'text').map((item: any) => item.content.text).join('').replace(/\s/g, '');
      if (!details.every(detail => contents.includes(detail.replace(/\s/g, '')))) valid = false;
      checks.push({ pages: report.pages.length, valid, figures });
      if (length === 25) stress = report;
    }
    const pdf = await mapImageBlob(stress, 'pdf');
    const zip = await mapImageBlob(stress, 'png');
    const zipPath = '/node_modules/.vite/deps/jszip.js';
    const { default: JSZip } = await import(zipPath);
    const entries = Object.keys((await JSZip.loadAsync(await zip.arrayBuffer())).files);
    const dataUrl = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(pdf); });
    return { checks, entries, pdf: dataUrl.split(',')[1] };
  });
  expect(result.checks.every(check => check.valid && check.figures === 1)).toBe(true);
  expect(result.checks[0].pages).toBe(1);
  expect(result.checks[2].pages).toBeGreaterThan(1);
  expect(result.checks[3].pages).toBeGreaterThan(result.checks[2].pages);
  expect(result.entries).toHaveLength(result.checks[2].pages);
  writeFileSync(info.outputPath('dynamic-layout.pdf'), Buffer.from(result.pdf, 'base64'));
});
