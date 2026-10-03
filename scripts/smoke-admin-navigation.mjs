import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, expect as baseExpect } from '@playwright/test';
import { validateSmokeTarget } from './smoke-target.mjs';
import { smokeAdminAreas } from './smoke-admin-areas.mjs';

const base = validateSmokeTarget(process.env.SMOKE_URL ?? 'https://korattanphai.vercel.app', process.env.SMOKE_ALLOWED_PREVIEW_ORIGINS);
const email = process.env.SMOKE_AUTH_EMAIL;
const password = process.env.SMOKE_AUTH_PASSWORD;
assert.ok(email && password, 'Provide the real smoke account through environment variables.');
const output = path.resolve(process.env.SMOKE_OUTPUT_DIR ?? 'smoke-results/admin-navigation');
const expect = baseExpect.configure({ timeout: 30000 });
await mkdir(output, { recursive: true });
let cookie = process.env.SMOKE_VERCEL_COOKIE;
if (!cookie && process.env.SMOKE_VERCEL_SESSION === '1') {
  try {
    const headers = execFileSync('vercel', ['curl', '/?x-vercel-set-bypass-cookie=true', '--deployment', base.origin, '--', '--silent', '--show-error', '--dump-header', '-', '--output', '/dev/null'], {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
    cookie = headers.match(/^set-cookie:\s*_vercel_jwt=([^;\r\n]+)/im)?.[1];
    assert.ok(cookie, 'Authorized session did not provide a target cookie.');
  } catch { throw new Error('Authorized Vercel session cookie could not be obtained; no headers or credential values were logged.'); }
}
if (cookie) assert.match(cookie, /^[A-Za-z0-9_.-]+$/);
const redact = value => [email, password, cookie].filter(Boolean).reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value));
const browser = await chromium.launch({ ...(process.env.SMOKE_BROWSER_CHANNEL ? { channel: process.env.SMOKE_BROWSER_CHANNEL } : {}) });
const report = { url: base.origin, deploymentId: process.env.SMOKE_DEPLOYMENT_ID ?? null, sourceSha: process.env.SMOKE_SOURCE_SHA ?? null, at: new Date().toISOString(), checks: [] };
try {
  for (const [device, viewport] of Object.entries({ desktop: { width: 1440, height: 960 }, mobile: { width: 390, height: 844 } })) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', extraHTTPHeaders: { DNT: '1' } });
    await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1', configurable: true }));
    const errors = [];
    const blockedWrites = [];
    let delayedActions = new Set();
    let arrivedActions = new Set();
    let pendingReads = Promise.resolve();
    let releaseReads = () => {};
    const holdReads = (...actions) => {
      releaseReads(); delayedActions = new Set(actions); arrivedActions = new Set();
      pendingReads = new Promise(resolve => { releaseReads = resolve; });
    };
    const resumeReads = () => { delayedActions.clear(); releaseReads(); };
    const origins = new Set([base.origin, 'https://dihchjflzhcekywarhxd.supabase.co', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com']);
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!origins.has(url.origin)) return route.abort('blockedbyclient');
      const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method());
      const auth = url.origin === 'https://dihchjflzhcekywarhxd.supabase.co' && /^\/auth\/v1\/(token|logout)$/.test(url.pathname);
      const readRpc = url.origin === 'https://dihchjflzhcekywarhxd.supabase.co' && /^\/rest\/v1\/rpc\/(ktp_cms_reference_(catalog|read|bundle)|ktp_latest_forecast_revision|ktp_load_forecast_slice)$/.test(url.pathname);
      const readResource = url.origin === base.origin && url.pathname === '/api/admin-data'
        && ['resource-get', 'resource-history'].includes(url.searchParams.get('action'));
      if (!read && !(request.method() === 'POST' && (auth || readRpc || readResource))) {
        blockedWrites.push(`${request.method()} ${url.pathname}`);
        return route.abort('blockedbyclient');
      }
      if (url.origin === base.origin && url.pathname === '/api/admin-data' && delayedActions.has(url.searchParams.get('action'))) {
        arrivedActions.add(url.searchParams.get('action'));
        await pendingReads;
      }
      return route.continue();
    });
    if (cookie) {
      assert.match(cookie, /^[A-Za-z0-9_.-]+$/);
      await context.addCookies([{ name: '_vercel_jwt', value: cookie, domain: base.hostname, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
    }
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(redact(error.message)));
    page.on('response', response => {
      if (response.status() >= 400 && new URL(response.url()).origin === base.origin) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
    });
    const login = async (current, destination) => {
      await current.goto(new URL(destination, base).href);
      assert.equal(new URL(current.url()).origin, base.origin, 'Deployment must be accessible before login.');
      await current.getByLabel('อีเมล', { exact: true }).fill(email);
      await current.getByLabel('รหัสผ่าน', { exact: true }).fill(password);
      await current.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
    };
    const openNavigation = async current => {
      const toggle = current.getByRole('button', { name: 'เปิดเมนูหลัก', exact: true });
      if (await toggle.isVisible()) await toggle.click();
    };
    const navigate = async label => {
      await openNavigation(page);
      await page.locator('.admin-navigation').getByRole('link', { name: label, exact: true }).click();
    };
    const watchStartup = async () => {
      await expect(page.locator('.app-startup')).toHaveCount(0);
      await page.evaluate(() => {
        window.adminSmokeStartupObserver?.disconnect();
        window.adminSmokeStartupCount = 0;
        window.adminSmokeStartupObserver = new MutationObserver(records => {
          for (const record of records) for (const node of record.addedNodes) {
            if (node instanceof Element && (node.matches('.app-startup') || node.querySelector('.app-startup'))) window.adminSmokeStartupCount += 1;
          }
        });
        window.adminSmokeStartupObserver.observe(document.body, { childList: true, subtree: true });
      });
    };
    const noNewStartup = async () => {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect(page.locator('.app-startup')).toHaveCount(0);
      assert.equal(await page.evaluate(() => window.adminSmokeStartupCount), 0, 'Warm Admin must not briefly show the full-page startup screen.');
    };
    try {
      await login(page, '/admin');
      await expect(page.getByRole('heading', { name: 'จัดการข้อมูล', exact: true })).toBeVisible();
      await expect(page.locator('.cms-resource-group:visible')).toHaveCount(3);
      await expect(page.getByRole('combobox', { name: 'เดือนตั้งต้นที่จะตรวจแก้', exact: true })).toBeVisible();
      await expect(page.locator('.cms-forecast-metrics')).toContainText('เผยแพร่แล้ว');
      await expect(page.locator('.cms-published [role="alert"]')).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.brand-mark img').evaluate(image => image.decode());
      await page.screenshot({ path: path.join(output, `${device}-admin-data-full.png`), fullPage: true });
      await page.screenshot({ path: path.join(output, `${device}-admin-data-viewport.png`) });
      const mapGroup = page.locator('.cms-resource-group[data-group="maps"]');
      await mapGroup.getByRole('button', { name: 'ดูชั้นข้อมูล', exact: true }).click();
      await expect(mapGroup.locator('.cms-map-resource:visible')).toHaveCount(2);
      await mapGroup.getByRole('button', { name: 'ย่อชั้นข้อมูล', exact: true }).click();
      await expect(mapGroup.locator('.cms-map-resource:visible')).toHaveCount(0);
      await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('แหล่งข้อมูลอ้างอิง');
      await expect(page.locator('.cms-resource-group:visible')).toHaveCount(1);
      const search = page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true });
      const originalSearch = await search.elementHandle();
      await watchStartup();
      const away = await context.newPage();
      await away.bringToFront();
      await page.bringToFront();
      await expect(search).toHaveValue('แหล่งข้อมูลอ้างอิง');
      assert.equal(await originalSearch.evaluate(element => element.isConnected), true, 'Browser tab return must retain the existing Admin view.');
      await noNewStartup();
      await away.close();

      holdReads('list', 'forecast-catalog', 'resource-catalog');
      await page.getByRole('button', { name: 'โหลดฉบับล่าสุด', exact: true }).click();
      await expect.poll(() => ['list', 'forecast-catalog', 'resource-catalog'].every(action => arrivedActions.has(action))).toBe(true);
      await expect(page.locator('.cms-resource-group:visible')).toHaveCount(1);
      await expect(page.getByRole('heading', { name: 'พยากรณ์ที่แสดงบนเว็บไซต์', exact: true })).toBeVisible();
      await expect(search).toHaveValue('แหล่งข้อมูลอ้างอิง');
      assert.equal(await originalSearch.evaluate(element => element.isConnected), true, 'Manual refresh must retain the search control.');
      await noNewStartup();
      await page.screenshot({ path: path.join(output, `${device}-admin-manual-refresh.png`), fullPage: true });
      resumeReads();
      await expect(page.getByRole('button', { name: 'โหลดฉบับล่าสุด', exact: true })).toBeEnabled();
      await expect(page.locator('.cms-reference')).toHaveAttribute('aria-busy', 'false');
      await noNewStartup();

      await navigate('รายการนำเข้าและฉบับร่าง');
      await expect(page.getByRole('heading', { name: 'รายการนำเข้าและฉบับร่าง', exact: true })).toBeVisible();
      holdReads('forecast-catalog', 'resource-catalog');
      await navigate('จัดการข้อมูล');
      await expect.poll(() => ['forecast-catalog', 'resource-catalog'].every(action => arrivedActions.has(action))).toBe(true);
      await expect(page.locator('.cms-resource-group:visible')).toHaveCount(3);
      await expect(page.getByRole('heading', { name: 'พยากรณ์ที่แสดงบนเว็บไซต์', exact: true })).toBeVisible();
      await noNewStartup();
      await page.screenshot({ path: path.join(output, `${device}-admin-warm-navigation.png`), fullPage: true });
      resumeReads();
      await expect(page.locator('.cms-reference')).toHaveAttribute('aria-busy', 'false');
      await noNewStartup();

      await search.fill('แหล่งข้อมูลอ้างอิง');
      await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'แหล่งข้อมูลอ้างอิง', level: 1, exact: true })).toBeVisible();
      await expect(page.locator('.cms-reference-table tbody tr')).toHaveCount(5);
      await page.locator('.cms-reference-context').getByRole('link', { name: 'จัดการข้อมูล', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'จัดการข้อมูล', exact: true })).toBeVisible();
      await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('รายชื่ออำเภอและตำบล');
      const areaEvidence = await smokeAdminAreas({ page, expect, device, viewport, output });
      await expect(page.getByRole('heading', { name: 'จัดการข้อมูล', exact: true })).toBeVisible();
      await page.evaluate(() => scrollTo(0, 0));
      await openNavigation(page);
      const nav = page.getByRole('navigation', { name: 'เมนูผู้ดูแล' });
      await expect(nav.getByRole('link')).toHaveCount(3);
      for (const link of await nav.getByRole('link').all()) assert.match(await link.getAttribute('href'), /^\/admin(?:\?|$)/);
      await expect(page.locator('.topbar, .mobile-account-slot')).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.brand-mark img').evaluate(image => image.decode());
      await page.screenshot({ path: path.join(output, `${device}-admin-navigation.png`) });
      await nav.getByRole('link', { name: 'รายการนำเข้าและฉบับร่าง', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'รายการนำเข้าและฉบับร่าง', exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'รายการนำเข้าและฉบับร่าง', exact: true })).toBeVisible();
      await openNavigation(page);
      await nav.getByRole('link', { name: 'นำเข้าข้อมูล', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'นำเข้าชุดข้อมูล', exact: true });
      await expect(dialog).toBeVisible();
      const downloaded = page.waitForEvent('download');
      await dialog.getByRole('link', { name: 'แม่แบบ Excel พร้อมคำอธิบาย', exact: true }).click();
      assert.equal(await (await downloaded).failure(), null);
      await page.getByRole('button', { name: 'ปิดการนำเข้าข้อมูล', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(/\/admin\?view=imports$/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

      const visitor = await context.newPage();
      visitor.setDefaultTimeout(30000);
      await login(visitor, '/');
      await expect(visitor.locator('.nr-forecast-overview-heading h1')).toBeVisible();
      await expect(visitor.locator('.admin-navigation')).toHaveCount(0);
      await expect(visitor.locator('.primary-nav').getByRole('button', { name: 'ภาพรวม', exact: true, includeHidden: true })).toHaveCount(1);
      await openNavigation(page);
      await page.locator('.sidebar-account .account-trigger').click();
      await page.getByRole('menuitem', { name: 'ออกจากระบบ', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/login$/);
      await visitor.reload();
      await expect(visitor.locator('.nr-forecast-overview-heading h1')).toBeVisible();
      await openNavigation(visitor);
      await visitor.locator('.sidebar-account .account-trigger').click();
      await visitor.getByRole('menuitem', { name: 'ออกจากระบบ', exact: true }).click();
      await expect(visitor).toHaveURL(/\/login$/);
      assert.deepEqual(errors, []);
      assert.deepEqual(blockedWrites, []);
      report.checks.push({ device, navigation: 'passed', resourceSearch: 'passed', resourceGroupCount: 3, mapResourceCount: 2, sourceRows: 5,
        browserTabReturn: 'passed', manualRefresh: 'passed', warmNavigation: 'passed',
        resourceDetail: areaEvidence,
        importTemplate: 'passed', independentSessions: 'passed', applicationWrites: 0 });
    } finally { resumeReads(); await context.close(); }
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(redact(error.message ?? error));
  process.exitCode = 1;
} finally { await browser.close(); }
