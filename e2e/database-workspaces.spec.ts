import { test, expect, seedAuthSession, authTestUser } from './fixtures';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));

test.skip(process.env.PLAYWRIGHT_DATA_BACKEND !== 'supabase', 'Run with npm run test:e2e:database');

test('database archive and shared bookmarks survive reload and restore the same route filters', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = []; const staticForecasts: string[] = []; const rpcHorizons: number[] = [];
  const areas: any[] = []; const filters: any[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (/forecast-(overview|archive)|drought_forecast_archive/.test(request.url()) && request.url().endsWith('.json')) staticForecasts.push(request.url()); });
  await page.route('https://ktp-auth-test.supabase.co/rest/v1/**', async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname.endsWith('/rpc/ktp_load_forecast_archive')) {
      const count = request.postDataJSON().p_horizon_count; rpcHorizons.push(count);
      return route.fulfill({ json: count === 1 ? overview : archive });
    }
    const isAreas = url.pathname.endsWith('/ktp_followed_areas');
    const rows = isAreas ? areas : filters;
    if (!isAreas && !url.pathname.endsWith('/ktp_saved_filters')) return route.abort();
    if (request.method() === 'GET') {
      expect(url.searchParams.get('user_id')).toBe(`eq.${authTestUser.id}`);
      return route.fulfill({ json: rows });
    }
    if (request.method() === 'POST') {
      const row = request.postDataJSON(); expect(row.user_id).toBe(authTestUser.id);
      rows.push({ ...row, id: isAreas ? undefined : '00000000-0000-4000-8000-000000000011', created_at: '2026-09-05T00:00:00Z' });
      return route.fulfill({ status: 201, json: null });
    }
    if (request.method() === 'DELETE') {
      expect(url.searchParams.get('user_id')).toBe(`eq.${authTestUser.id}`);
      const key = isAreas ? 'area_code' : 'id'; const id = url.searchParams.get(key)?.slice(3);
      const removed = rows.splice(rows.findIndex((row) => row[key] === id), 1);
      return route.fulfill({ json: removed });
    }
    return route.abort();
  });
  await seedAuthSession(page);
  await page.goto('/dan-khun-thot/t-300806?target=2025-12&horizon=4&mapRisk=forecast-high&irrigation=irrigated');
  await expect(page.getByRole('heading', { name: /ภัยแล้ง.*บ้านเก่า/ }).first()).toBeVisible();
  const initialUrl = page.url();
  await page.locator('.nr-map-panel .nr-irrigation-filter').getByRole('combobox').click();
  await page.getByRole('option', { name: 'พึ่งน้ำฝน (ไม่มีชลประทาน)', exact: true }).click();
  expect(page.url()).toBe(initialUrl);
  await expect(page.locator('.nr-drought-workspace-kpis .metric-card')).toHaveCount(1);
  await expect(page.locator('.nr-drought-workspace-kpis')).toContainText('เสี่ยงสูง');
  await expect(page.locator('.nr-forecast-archive-horizon-tabs button[aria-selected="true"] span')).toHaveText('เม.ย. 2569');
  await page.getByRole('button', { name: 'รายการที่บันทึก', exact: true }).click();
  await page.getByRole('button', { name: 'ติดตามพื้นที่นี้', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('เพิ่มพื้นที่ติดตามแล้ว');
  await page.getByRole('tab', { name: 'ตัวกรองที่บันทึก', exact: true }).click();
  await page.getByLabel('ชื่อตัวกรอง', { exact: true }).fill('บ้านเก่า พยากรณ์ T+4');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('บันทึกตัวกรองแล้ว');
  expect(filters[0]).toMatchObject({ target_period: '2025-12-01', horizon: 4, area_code: '300806', risk_criterion: 'forecast-high', irrigation_criterion: 'rainfed' });
  await mkdir('tmp-snapshots/database-workspaces', { recursive: true });
  await page.screenshot({ path: `tmp-snapshots/database-workspaces/${testInfo.project.name}-saved-filter.png` });
  await page.getByRole('button', { name: 'ปิดรายการที่บันทึก' }).click();
  await page.goto('/dan-khun-thot/t-300806?target=2025-10&horizon=1');
  await page.getByRole('button', { name: 'รายการที่บันทึก', exact: true }).click();
  await page.getByRole('tab', { name: 'ตัวกรองที่บันทึก', exact: true }).click();
  await page.getByRole('button', { name: /^บ้านเก่า พยากรณ์ T\+4/ }).click();
  await expect(page).toHaveURL(/target=2025-12&horizon=4&mapRisk=forecast-high/);
  await expect(page.locator('.nr-forecast-archive-horizon-tabs button[aria-selected="true"]')).toContainText('T+4');
  await expect(page.locator('.nr-forecast-archive-horizon-tabs button[aria-selected="true"] span')).toHaveText('เม.ย. 2569');
  await expect(page.locator('.nr-drought-workspace-context .is-issue strong')).toHaveText('ธ.ค. 2568');
  await page.reload();
  await expect(page.locator('.nr-map-panel .nr-irrigation-filter')).toContainText('พึ่งน้ำฝน');
  await expect(page.locator('.nr-forecast-archive-horizon-tabs button[aria-selected="true"]')).toContainText('T+4');
  await expect(page.locator('.nr-forecast-archive-horizon-tabs button[aria-selected="true"] span')).toHaveText('เม.ย. 2569');
  await expect(page.locator('.nr-drought-workspace-context .is-issue strong')).toHaveText('ธ.ค. 2568');
  await expect(page.locator('.nr-drought-workspace-kpis')).toContainText('เสี่ยงสูง');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'จังหวัดนครราชสีมา', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'รายการที่บันทึก', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /^ตำบลบ้านเก่า/ })).toBeVisible();
  await page.getByRole('button', { name: /^ลบ ตำบลบ้านเก่า/ }).click();
  await page.getByRole('button', { name: 'ลบ', exact: true }).click();
  await expect(page.getByText('ยังไม่มีพื้นที่ติดตาม', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ปิดรายการที่บันทึก' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(rpcHorizons).toContain(1); expect(rpcHorizons).toContain(6);
  expect(staticForecasts).toEqual([]); expect(errors).toEqual([]);
});

test('database failure shows retry without static fallback and retains the requested vintage', async ({ page }) => {
  let failed = true; const assets: string[] = [];
  page.on('request', (r) => { if (/(drought_forecast_archive_rev03|forecast-overview-t1).*\.json/.test(r.url())) assets.push(r.url()); });
  await page.route('https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_load_forecast_archive', (route) => route.fulfill(failed
    ? { status: 503, json: { message: 'Test-only unavailable' } } : { json: archive }));
  await seedAuthSession(page);
  await page.goto('/drought?target=2025-11&horizon=3');
  const retry = page.getByRole('button', { name: /ลองใหม่/ });
  await expect(retry).toBeVisible(); failed = false; await retry.click();
  await expect(page.locator('.nr-forecast-archive-horizon-tabs button[aria-selected="true"]')).toContainText('T+3');
  await expect(page.locator('.nr-forecast-archive-horizon-tabs button[aria-selected="true"] span')).toHaveText('ก.พ. 2569');
  await expect(page).toHaveURL(/target=2025-11&horizon=3/);
  expect(assets).toEqual([]);
});
