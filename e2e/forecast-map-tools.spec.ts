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
  await page.goto(path);
  await expect(page.getByRole('button', { name: 'ค้นหาพื้นที่บนแผนที่' })).toBeVisible();
  return requests;
}
async function choose(page: Page, name: string | RegExp, option: string) {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function openAnalysis(page: Page) {
  await page.getByRole('button', { name: 'ตาราง / วิเคราะห์', exact: true }).click();
  await expect(page.locator('.nr-analysis-table tbody tr').first()).toBeVisible();
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
    const plot = await page.locator('.nr-map-svg').boundingBox(); expect(plot!.height).toBeGreaterThan(170);
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

test('Korat map tools rejects stale analysis, recovers errors and revalidates new publication', async ({ page }) => {
  await setup(page);
  let failed = true, current = archive, reads = 0;
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => route.fulfill(failed ? { status: 503, json: { message: 'test failure' } }
    : { json: forecastSlice(current, route.request().postDataJSON()) }));
  await page.getByRole('button', { name: 'ตาราง / วิเคราะห์' }).click();
  await expect(page.locator('.nr-tool-dialog [role="alert"]')).toBeVisible();
  await expect(page.locator('.nr-analysis-table')).toHaveCount(0);
  failed = false;
  await page.getByRole('button', { name: 'ลองใหม่', exact: true }).click();
  await expect(page.locator('.nr-analysis-table')).toBeVisible();
  current = structuredClone(archive); current.meta.datasetId = '11111111-1111-4111-8111-111111111111';
  current.meta.datasetVersion = 'test-new-publication'; current.meta.sourceWorkbookSha256 = 'b'.repeat(64);
  await page.route('**/rest/v1/rpc/ktp_latest_forecast_revision', route => { reads++; return route.fulfill({ json: { ...forecastRevision(current), publishedAt: '2026-09-08T10:00:00Z' } }); });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => reads).toBeGreaterThan(0);
  // Either the page and dialog adopt the new revision together, or old output is withheld.
  await expect.poll(async () => (await page.locator('.nr-analysis-source').allTextContents()).join('')
    + (await page.locator('.nr-tool-dialog [role="alert"]').allTextContents()).join('')).toMatch(/test-new-publication|มีข้อมูลรุ่นใหม่/);
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
