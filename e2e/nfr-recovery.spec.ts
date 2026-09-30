import { expect, test, fillAuthForm, seedAuthSession } from './fixtures';

// Uses only the local static/auth-fixture harness; protected database regression is separate.
test.skip(process.env.PLAYWRIGHT_DATA_BACKEND === 'supabase', 'Static fixture network faults; database faults have their own suite.');

test('a stalled map times out and retries in place without losing the selected forecast', async ({ page }, testInfo) => {
  await seedAuthSession(page);
  await page.clock.install();
  let attempts = 0;
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/geodata/nakhon-ratchasima-subdistricts.geojson', async route => {
    attempts++;
    if (attempts === 1) await held;
    await route.continue().catch(() => {});
  });
  const documents: string[] = [];
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
  try {
    await page.goto('/dan-khun-thot/t-300806?mapLayer=forecast-archive&target=2025-12&horizon=4');
    await expect(page.locator('.nr-drought-workspace-kpis')).toContainText('เสี่ยงสูง');
    await expect(page.locator('.nr-map-loading')).toContainText('กำลังโหลดขอบเขต');
    await expect(page.locator('.app-startup')).toBeVisible();
    await expect(page.locator('.nr-drought-workspace-kpis')).not.toBeVisible();
    await page.clock.fastForward(30_001);
    await expect(page.getByRole('alert')).toContainText('ไม่สามารถโหลดขอบเขตตำบลนครราชสีมาได้');
    await expect(page.locator('.app-startup')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('map-timeout-recovery.png'), fullPage: true });
    await page.getByRole('button', { name: 'ลองโหลดแผนที่ใหม่', exact: true }).click();
    await expect(page.locator('.nr-map-shape')).toHaveCount(289);
    await expect(page.locator('.nr-drought-workspace-horizon').getByRole('tab', { selected: true })).toContainText('4 เดือน');
    await expect(page).toHaveURL(/target=2025-12&horizon=4/);
    expect(documents).toHaveLength(1);
    expect(attempts).toBe(2);
  } finally { release(); }
});

test('a stalled forecast times out and recovers the same source month and horizon', async ({ page }) => {
  await seedAuthSession(page);
  await page.clock.install();
  let attempts = 0;
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(/drought_forecast_archive_rev03(?:-[\w-]+)?\.json(?:\?.*)?$/, async route => {
    // Vite also imports this filename as a JavaScript URL module (?import&url).
    // Stall only the archive fetch; blocking that module prevents the app from mounting.
    if (route.request().resourceType() !== 'fetch') return route.continue();
    attempts++;
    if (attempts === 1) await held;
    await route.continue().catch(() => {});
  });
  try {
    await page.goto('/drought?mapLayer=forecast-archive&target=2025-11&horizon=3');
    await expect(page.locator('.app-startup').getByRole('status')).toHaveText('กำลังเตรียมข้อมูลให้คุณ');
    await expect(page.locator('.page-load-content')).toHaveAttribute('inert', '');
    await expect.poll(() => attempts).toBe(1);
    await page.clock.fastForward(30_001);
    await expect(page.getByRole('alert')).toHaveText('โหลดข้อมูลพยากรณ์ไม่สำเร็จ กรุณาลองใหม่');
    await expect(page.locator('.app-startup')).toHaveCount(0);
    await expect(page.locator('.nr-drought-compact-workspace')).toHaveCount(0);
    await page.getByRole('button', { name: 'ลองใหม่', exact: true }).click();
    await expect(page.locator('.nr-drought-workspace-horizon').getByRole('tab', { selected: true })).toContainText('3 เดือน');
    await expect(page).toHaveURL(/target=2025-11&horizon=3/);
    expect(attempts).toBe(2);
  } finally { release(); }
});

test('keyboard login and skip navigation reach risk controls with reduced motion', async ({ page, browserName }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dan-khun-thot/t-300806?mapLayer=forecast-archive&target=2025-12&horizon=4');
  await fillAuthForm(page);
  await page.getByLabel('รหัสผ่าน', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: /ภัยแล้ง.*บ้านเก่า/, level: 1 })).toBeVisible();
  // macOS WebKit follows Safari's default: Option-Tab includes links; plain Tab
  // can leave the document when full keyboard navigation is disabled in Safari.
  await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
  const skip = page.getByRole('link', { name: 'ข้ามไปเนื้อหาหลัก' });
  await expect(skip).toBeFocused();
  await skip.press('Enter');
  await expect(page.locator('#workspace-content')).toBeFocused();
  await expect(page.locator('.nav-subitem[aria-current="page"]')).toHaveText('ภัยแล้ง');
  const selected = page.locator('.nr-drought-workspace-horizon').getByRole('tab', { selected: true });
  await selected.focus();
  await selected.press('ArrowRight');
  await expect(page.locator('.nr-drought-workspace-horizon').getByRole('tab', { selected: true })).toContainText('5 เดือน');
  await expect(page.locator('.nr-drought-workspace-horizon').getByRole('tab', { selected: true })).toBeFocused();
  await expect(page.locator('.nr-drought-workspace-kpis')).toContainText('เสี่ยง');
  await expect(page).toHaveURL(/target=2025-12&horizon=5/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('keyboard-risk-controls.png'), fullPage: true });
});
