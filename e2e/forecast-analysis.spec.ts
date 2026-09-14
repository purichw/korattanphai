import { readFileSync } from 'node:fs';
import { test, expect, seedAuthSession, type Page } from './fixtures';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';
import type { NakhonRatchasimaDroughtForecastArchive as Archive } from '../src/types';

test.skip(process.env.PLAYWRIGHT_DATA_BACKEND !== 'supabase', 'Requires isolated database fixture');
const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8')) as Archive;
const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));

async function setup(page: Page, path: string) {
  const reads: unknown[] = [];
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
    const query = route.request().postDataJSON(); reads.push(query);
    return route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
  });
  await seedAuthSession(page);
  await page.goto(path);
  await page.getByRole('button', { name: 'วิเคราะห์พยากรณ์', exact: true }).click();
  await expect(page.locator('.nr-analysis-table tbody tr').first()).toBeVisible();
  await expect(page.locator('.nr-analysis-refresh')).toHaveCount(0);
  return reads;
}

async function choose(page: Page, name: string | RegExp, option: string) {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

// Fixed samples from seed 20260914, plus the reported case and an all-null tambon.
const samples = [
  { code: '30', path: '/', origin: '2025-12' },
  { code: '30', path: '/drought', origin: '2025-12' },
  { code: '3025', path: '/wang-nam-khiao', origin: '2025-12' },
  { code: '3017', path: '/chum-phuang', origin: '2023-04' },
  { code: '3018', path: '/sung-noen', origin: '2025-12' },
  { code: '300101', path: '/mueang-nakhon-ratchasima/t-300101', origin: '2019-10' },
  { code: '300117', path: '/mueang-nakhon-ratchasima/t-300117', origin: '2025-12' },
  { code: '302503', path: '/wang-nam-khiao/t-302503', origin: '2025-12' },
];

for (const sample of samples) test(`analysis scope and six monthly filters ${sample.path}`, async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const reads = await setup(page, `${sample.path}?target=${sample.origin}&horizon=1`);
  const dialog = page.getByRole('dialog');
  const members = archive.locations.filter(l => l.subdistrictCode.startsWith(sample.code))
    .sort((a, b) => a.subdistrictCode.localeCompare(b.subdistrictCode));
  const scopeName = sample.code === '30' ? 'จังหวัดนครราชสีมา' : sample.code.length === 4
    ? `อำเภอ${members[0].districtNameTh} · จังหวัดนครราชสีมา`
    : `ตำบล${members[0].subdistrictNameTh} · อำเภอ${members[0].districtNameTh}`;
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(`วิเคราะห์พยากรณ์ · ${scopeName}`);
  const initial = (await dialog.boundingBox())!;
  expect(initial.height).toBeGreaterThan(page.viewportSize()!.height * 0.85);
  const stable = async () => {
    const box = (await dialog.boundingBox())!;
    expect(box.height).toBeCloseTo(initial.height, 0);
    expect(box.y).toBeCloseTo(initial.y, 0);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  };
  if (sample.code.length !== 6) {
    const expected = [...new Set(members.map(l => l.districtCode))].sort().map(code => ({ code,
      risks: [0, 1, 2, 3, 4, 5].map(h => {
        const valid = members.filter(l => l.districtCode === code).map(l => archive.packedRiskByTargetMonth[sample.origin][l.subdistrictCode][h])
          .filter((value): value is 0 | 1 | 2 => value !== null);
        return valid.length ? String(Math.max(...valid)) : 'outside';
      }),
    }));
    const actual = await page.locator('.nr-analysis-table tbody tr').evaluateAll(rows => rows.map(row => ({
      code: row.querySelector('th small')!.textContent!.match(/30\d{2}/)![0],
      risks: [...row.querySelectorAll('.nr-analysis-risk')].map(cell => [...cell.classList].find(name => name.startsWith('is-'))!.slice(3)),
    })));
    expect(actual).toEqual(expected);
    await choose(page, 'ระดับตาราง', 'รายตำบล');
  }
  const tableRows = page.locator('.nr-analysis-table tbody tr');
  const expectedAll = members.map(l => ({ code: l.subdistrictCode, risks: archive.packedRiskByTargetMonth[sample.origin][l.subdistrictCode]
    .map(value => value === null ? 'outside' : String(value)) })).sort((a, b) => a.code.localeCompare(b.code));
  expect(await tableRows.evaluateAll(rows => rows.map(row => ({
    code: row.querySelector('th small')!.textContent!.match(/30\d{4}/)![0],
    risks: [...row.querySelectorAll('.nr-analysis-risk')].map(cell => [...cell.classList].find(name => name.startsWith('is-'))!.slice(3)),
  })))).toEqual(expectedAll);
  const settledReads = reads.length;
  for (let h = 1; h <= 6; h++) {
    await choose(page, 'รูปแบบความเสี่ยง 6 เดือน', `มีความเสี่ยงใน T+${h}`);
    const expected = members.filter(l => [1, 2].includes(archive.packedRiskByTargetMonth[sample.origin][l.subdistrictCode][h - 1] as number));
    await expect(tableRows).toHaveCount(expected.length);
    expect(await tableRows.locator('th small').allTextContents()).toEqual(expected.map(l => `อ.${l.districtNameTh} · ${l.subdistrictCode} · ID ${l.sourceId}`));
    if (!expected.length) await expect(dialog.getByText('ไม่พบตำบลตามตัวกรองนี้', { exact: true })).toBeVisible();
    await expect(page.locator('.nr-analysis-loading, .nr-analysis-refresh')).toHaveCount(0);
    await stable();
  }
  await choose(page, 'รูปแบบความเสี่ยง 6 เดือน', 'เริ่มเสี่ยงครั้งแรกในรอบที่ T+3');
  const first3 = members.filter(l => {
    const values = archive.packedRiskByTargetMonth[sample.origin][l.subdistrictCode];
    return values[0] === 0 && values[1] === 0 && [1, 2].includes(values[2] as number);
  });
  await expect(tableRows).toHaveCount(first3.length);
  await choose(page, 'รูปแบบความเสี่ยง 6 เดือน', 'ทุกรูปแบบพยากรณ์');
  await page.getByRole('searchbox', { name: 'ค้นหาในตารางพยากรณ์' }).fill('ไม่มีพื้นที่นี้');
  await expect(tableRows).toHaveCount(0);
  await stable();
  await page.getByRole('searchbox', { name: 'ค้นหาในตารางพยากรณ์' }).clear();
  await expect(tableRows).toHaveCount(members.length);
  expect(reads.length).toBe(settledReads);
  if (sample.code === '3025') {
    await choose(page, 'ระดับตาราง', 'สรุปอำเภอ');
    await dialog.locator('.nr-tool-dialog-content').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: info.outputPath('analysis-wang-nam-khiao.png') });
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'วิเคราะห์พยากรณ์', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('analysis empty results offer a scoped reset without changing the dialog frame', async ({ page }, info) => {
  await setup(page, '/wang-nam-khiao?target=2025-12&horizon=1');
  const dialog = page.getByRole('dialog');
  const height = (await dialog.boundingBox())!.height;
  const url = page.url();
  const empty = dialog.locator('.nr-analysis-empty');
  const search = dialog.getByRole('searchbox', { name: 'ค้นหาในตารางพยากรณ์' });
  await choose(page, 'รูปแบบความเสี่ยง 6 เดือน', 'มีความเสี่ยงใน T+5');
  await expect(empty.getByRole('heading')).toHaveText('ไม่พบตำบลตามตัวกรองนี้');
  await expect(dialog.getByRole('button', { name: 'แสดงบนแผนที่', exact: true })).toBeDisabled();
  await empty.getByRole('button', { name: 'ล้างตัวกรองการวิเคราะห์' }).click();
  await expect(search).toBeFocused();
  await expect(dialog.locator('.nr-analysis-table tbody tr')).toHaveCount(1);
  await expect(dialog.getByRole('combobox', { name: 'รูปแบบความเสี่ยง 6 เดือน', exact: true })).toContainText('ทุกรูปแบบพยากรณ์');

  await search.fill('ไม่มีพื้นที่นี้');
  for (const tab of ['กราฟอำเภอ', 'เปรียบเทียบรอบ', 'ตาราง 6 เดือน']) {
    await dialog.getByRole('button', { name: tab, exact: true }).click();
    await expect(empty).toBeVisible();
    expect((await dialog.boundingBox())!.height).toBe(height);
  }
  await empty.scrollIntoViewIfNeeded();
  expect(await empty.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('analysis-empty.png') });
  await empty.getByRole('button', { name: 'ล้างตัวกรองการวิเคราะห์' }).click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(empty).toHaveCount(0);
  await expect(dialog.locator('.nr-analysis-table tbody tr')).toHaveCount(1);
  expect(page.url()).toBe(url);
});

test('analysis keeps its frame and current data while refreshing and changing baselines', async ({ page }, info) => {
  test.setTimeout(90_000);
  await setup(page, '/wang-nam-khiao?target=2025-12&horizon=1');
  const dialog = page.getByRole('dialog');
  const initial = (await dialog.boundingBox())!;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/rest/v1/rpc/ktp_latest_forecast_revision', async route => { await gate; await route.fallback(); });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.nr-analysis-refresh')).toBeVisible();
  await expect(page.locator('.nr-analysis-table')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'แสดงบนแผนที่', exact: true })).toBeDisabled();
  expect((await dialog.boundingBox())!.height).toBe(initial.height);
  release();
  await expect(page.locator('.nr-analysis-refresh')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'กราฟอำเภอ', exact: true }).click();
  await expect(dialog.getByRole('list', { name: 'กราฟเปรียบเทียบอำเภอ' })).toContainText('วังน้ำเขียว');
  expect((await dialog.boundingBox())!.height).toBe(initial.height);
  await dialog.getByRole('button', { name: 'เปรียบเทียบรอบ', exact: true }).click();
  await choose(page, /^รอบตั้งต้นอ้างอิง /, 'พ.ย. 2568');
  await expect(dialog.getByRole('region', { name: 'ตารางเปรียบเทียบรอบ' })).toBeVisible();
  let releaseBaseline!: () => void;
  const baselineGate = new Promise<void>(resolve => { releaseBaseline = resolve; });
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', async route => {
    if (route.request().postDataJSON().p_origin_period === '2025-10') await baselineGate;
    await route.fallback();
  });
  await choose(page, /^รอบตั้งต้นอ้างอิง /, 'ต.ค. 2568');
  await expect(dialog.getByRole('region', { name: 'ตารางเปรียบเทียบรอบ' })).toHaveCount(0);
  await expect(page.locator('.nr-analysis-loading')).toBeVisible();
  expect((await dialog.boundingBox())!.height).toBe(initial.height);
  releaseBaseline();
  await expect(dialog.getByRole('region', { name: 'ตารางเปรียบเทียบรอบ' })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: 'รอบ ต.ค. 2568' })).toBeVisible();
  expect((await dialog.boundingBox())!.height).toBe(initial.height);
  await page.screenshot({ path: info.outputPath('analysis-comparison.png') });
});

test('analysis cold overview loading uses the same tall shell', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', async route => {
    const query = route.request().postDataJSON();
    if (query.p_horizon_count === 6) await gate;
    await route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
  });
  await seedAuthSession(page);
  await page.goto('/?target=2025-12');
  await page.getByRole('button', { name: 'วิเคราะห์พยากรณ์', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(page.locator('.nr-analysis-loading')).toBeVisible();
  const initial = (await dialog.boundingBox())!;
  await dialog.evaluate(el => el.setAttribute('data-shell-probe', 'initial'));
  release();
  await expect(page.locator('.nr-analysis-table')).toBeVisible();
  await expect(dialog).toHaveAttribute('data-shell-probe', 'initial');
  expect((await dialog.boundingBox())!.height).toBe(initial.height);
  expect((await dialog.boundingBox())!.y).toBe(initial.y);
});
