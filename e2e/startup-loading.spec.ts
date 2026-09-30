import type { TestInfo } from '@playwright/test';
import { authTestEmail, authTestUser, expect, seedAuthSession, test, type Page } from './fixtures';

// Exercise the real lazy boundary in both Vite dev and the built static harness.
// Mock auth is deliberately restricted to localhost by ./fixtures.
test.skip(process.env.PLAYWRIGHT_DATA_BACKEND === 'supabase', 'Uses the static fixture build; database integration has a separate suite.');

const appChunk = /\/(?:src\/AuthenticatedApp\.tsx|assets\/AuthenticatedApp-[\w-]+\.js)(?:\?.*)?$/;
const requestedOverview = '/?mapLayer=forecast-archive&target=2025-12&horizon=1';

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

async function expectStartup(page: Page, testInfo: TestInfo, screenshot: string) {
  const startup = page.locator('.app-startup');
  await expect(startup).toBeVisible();
  await expect(startup.getByRole('status').filter({ hasText: 'กำลังเปิดโคราชทันภัย...' })).toBeVisible();
  await expect(startup.locator('img[src*="/brand/"]').first()).toBeVisible();
  await expect(startup.locator('.nr-skeleton')).toHaveCount(0);
  await expect(startup.locator('.app-startup-track > span')).toHaveCSS('animation-name', 'none');
  await expect(startup.getByRole('heading', { name: 'โคราชทันภัย', level: 1 })).toBeVisible();
  await expect(page.locator('.app-recovery, .nr-map-shape')).toHaveCount(0);
  await expect(startup).not.toContainText(authTestEmail);
  await expect(startup).not.toContainText(authTestUser.user_metadata.full_name);
  await expect(page.getByRole('button', { name: /บัญชีผู้ใช้/ })).toHaveCount(0);
  expect(await startup.innerText()).not.toMatch(/\d+\s*ตำบล|\d+\s*%/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(page).toHaveURL(new URL(requestedOverview, page.url()).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath(screenshot), fullPage: true });
}

async function expectOverviewReady(page: Page) {
  await expect(page.locator('.app-startup')).toHaveCount(0);
  await expect(page.locator('.nr-map-shape')).toHaveCount(289);
  await expect(page.locator('.nr-forecast-overview-summary')).toBeVisible();
  await expect(page).toHaveURL(new URL(requestedOverview, page.url()).href);
}

test('cold entry and uncached refresh keep branded loading until the authenticated chunk and page are ready', async ({ page, context }, testInfo) => {
  await seedAuthSession(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  let held = gate();
  let chunkRequests = 0;
  // Context routing disables the HTTP cache, so reload repeats a first-visit
  // chunk download instead of silently succeeding from the browser cache.
  await context.route(appChunk, async route => {
    chunkRequests++;
    await held.promise;
    await route.continue();
  });
  try {
    await page.goto(requestedOverview, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => chunkRequests).toBe(1);
    await expectStartup(page, testInfo, 'cold-entry-app-startup.png');
    held.release();
    await expectOverviewReady(page);

    held = gate();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => chunkRequests).toBe(2);
    await expectStartup(page, testInfo, 'uncached-refresh-app-startup.png');
    held.release();
    await expectOverviewReady(page);
    expect(errors).toEqual([]);
  } finally {
    held.release();
  }
});

test('signed-out deep entry preserves the login return URL without requesting protected code or data', async ({ page }) => {
  const protectedRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    const protectedData = url.pathname.startsWith('/geodata/')
      || /\/rest\/v1\/rpc\/ktp_(?:load_|latest_)/.test(url.pathname)
      || (request.resourceType() === 'fetch' && /(?:forecast-overview-t1|drought_forecast_archive_rev03).*\.json$/.test(url.pathname));
    if (appChunk.test(request.url()) || protectedData) protectedRequests.push(request.url());
  });
  const path = '/dan-khun-thot/t-300806?mapLayer=forecast-archive&target=2025-12&horizon=4#forecast';
  await page.goto(path);
  await expect(page.getByLabel('อีเมล', { exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/login');
  expect(new URL(page.url()).searchParams.get('next')).toBe(path);
  await expect(page.locator('.app-startup, .app-shell, .nr-map-shape')).toHaveCount(0);
  expect(protectedRequests).toEqual([]);
});

test('a failed authenticated chunk shows recovery and retry opens the original forecast', async ({ page, context }, testInfo) => {
  await seedAuthSession(page);
  let failChunk = true;
  let chunkRequests = 0;
  await context.route(appChunk, async route => {
    chunkRequests++;
    if (failChunk) await route.abort('failed');
    else await route.continue();
  });
  await page.goto(requestedOverview, { waitUntil: 'domcontentloaded' });
  const recovery = page.locator('.app-recovery');
  await expect(recovery.getByRole('heading', { name: 'ไม่สามารถแสดงหน้านี้ได้' })).toBeVisible();
  await expect(recovery.getByRole('alert')).toContainText('กรุณาลองใหม่');
  await expect(page.locator('.app-startup, .nr-map-shape')).toHaveCount(0);
  await expect(page).toHaveURL(new URL(requestedOverview, page.url()).href);
  await page.screenshot({ path: testInfo.outputPath('app-chunk-recovery.png'), fullPage: true });
  failChunk = false;
  await recovery.getByRole('button', { name: 'ลองใหม่', exact: true }).click();
  await expectOverviewReady(page);
  await expect(page.locator('.app-recovery')).toHaveCount(0);
  expect(chunkRequests).toBe(2);
});
