import { test, expect, seedAuthSession, seedAdminSession } from './fixtures';

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test('Visitor waits for essential map geometry, but not optional context', async ({ page }, testInfo) => {
  const geometry = gate();
  const context = gate();
  await seedAuthSession(page);
  await page.route('**/geodata/nakhon-ratchasima-subdistricts.geojson', async route => { await geometry.promise; await route.continue(); });
  await page.route('**/geodata/thailand-adm1.geojson', async route => { await context.promise; await route.continue(); });
  try {
    await page.goto('/?mapLayer=forecast-archive&target=2025-12&horizon=1');
    await expect(page.locator('.nr-forecast-overview-summary')).toBeAttached();
    await expect(page.locator('.app-startup')).toBeVisible();
    await expect(page.locator('.nr-forecast-overview-summary')).not.toBeVisible();
    await expect(page.locator('.nr-skeleton:visible')).toHaveCount(0);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.page-load-content')))).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('visitor-loading.png') });
    geometry.release();
    await expect(page.locator('.app-startup')).toHaveCount(0);
    await expect(page.locator('.nr-map-shape')).toHaveCount(289);
    await expect(page.locator('.nr-forecast-overview-summary')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('visitor-ready.png') });
  } finally { geometry.release(); context.release(); }
});

test('a map failure exits loading and can retry without reloading the forecast', async ({ page }) => {
  await seedAuthSession(page);
  let attempts = 0;
  await page.route('**/geodata/nakhon-ratchasima-subdistricts.geojson', route => ++attempts === 1
    ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue());
  await page.goto('/?mapLayer=forecast-archive&target=2025-12&horizon=1');
  await expect(page.getByRole('alert')).toContainText('ไม่สามารถโหลดขอบเขตตำบล');
  await expect(page.locator('.app-startup')).toHaveCount(0);
  await page.getByRole('button', { name: 'ลองโหลดแผนที่ใหม่' }).click();
  await expect(page.locator('.nr-map-shape')).toHaveCount(289);
  await expect(page.locator('.app-startup')).toHaveCount(0);
  expect(attempts).toBe(2);
});

test('Admin keeps one splash through list, forecast catalogue and reference reads', async ({ page }, testInfo) => {
  await seedAdminSession(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const list = gate(); const forecast = gate(); const references = gate();
  const reads: string[] = [];
  await page.route('**/api/admin-data**', async route => {
    const action = new URL(route.request().url()).searchParams.get('action')!;
    reads.push(action);
    if (action === 'list') { await list.promise; await route.fulfill({ json: { items: [], total: 0 } }); }
    else if (action === 'forecast-catalog') { await forecast.promise; await route.fulfill({ json: { revision: null, periods: [] } }); }
    else if (action === 'resource-catalog') { await references.promise; await route.fulfill({ json: [] }); }
    else throw new Error(`Unexpected CMS action: ${action}`);
  });
  try {
    await page.goto('/admin');
    await expect.poll(() => reads.includes('list')).toBe(true);
    await expect(page.locator('.app-startup')).toBeVisible();
    await expect(page.getByRole('button', { name: 'นำเข้าข้อมูล', exact: true })).toHaveCount(0);
    list.release();
    await expect.poll(() => reads.includes('forecast-catalog') && reads.includes('resource-catalog')).toBe(true);
    await expect(page.locator('.app-startup')).toBeVisible();
    await expect(page.locator('.cms-workspace')).not.toBeVisible();
    forecast.release();
    await expect(page.locator('.cms-published')).toContainText('ยังไม่มีชุดพยากรณ์ที่เผยแพร่');
    await expect(page.locator('.app-startup')).toBeVisible();
    await expect(page.locator('.app-startup-track > span')).toHaveCSS('animation-name', 'none');
    await page.screenshot({ path: testInfo.outputPath('admin-loading.png') });
    references.release();
    await expect(page.locator('.app-startup')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'จัดการข้อมูล', exact: true })).toBeVisible();
    await expect(page.getByText('ยังไม่มีรายการนำเข้าที่ต้องดำเนินการ เริ่มจากนำเข้าไฟล์ หรือตรวจแก้พยากรณ์ในหน้าจัดการข้อมูล', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'นำเข้าข้อมูล', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('.app-startup')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(reads.sort()).toEqual(['forecast-catalog', 'list', 'resource-catalog']);
  } finally { list.release(); forecast.release(); references.release(); }
});

test('Admin failure releases loading, offers retry and leaves independent panels usable', async ({ page }) => {
  await seedAdminSession(page);
  let attempts = 0;
  await page.route('**/api/admin-data**', route => {
    const action = new URL(route.request().url()).searchParams.get('action');
    if (action === 'list') return route.fulfill({ json: { items: [], total: 0 } });
    if (action === 'resource-catalog') return route.fulfill({ json: [] });
    if (++attempts === 1) return route.fulfill({ status: 503, json: { error: { code: 'cms_unavailable' } } });
    return route.fulfill({ json: { revision: null, periods: [] } });
  });
  await page.goto('/admin');
  await expect(page.getByRole('alert')).toContainText('เชื่อมต่อ CMS ไม่สำเร็จ');
  await expect(page.locator('.app-startup')).toHaveCount(0);
  await page.getByRole('button', { name: 'ลองใหม่', exact: true }).click();
  await expect(page.getByText('ยังไม่มีชุดพยากรณ์ที่เผยแพร่', { exact: true })).toBeVisible();
  await expect(page.locator('.app-startup')).toHaveCount(0);
  expect(attempts).toBe(2);
});
