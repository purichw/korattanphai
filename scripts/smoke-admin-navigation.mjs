import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect as baseExpect } from '@playwright/test';
import { validateSmokeTarget } from './smoke-target.mjs';

const base = validateSmokeTarget(process.env.SMOKE_URL ?? 'https://korattanphai.vercel.app', process.env.SMOKE_ALLOWED_PREVIEW_ORIGINS);
const email = process.env.SMOKE_AUTH_EMAIL;
const password = process.env.SMOKE_AUTH_PASSWORD;
assert.ok(email && password, 'Provide the real smoke account through environment variables.');
const output = path.resolve(process.env.SMOKE_OUTPUT_DIR ?? 'smoke-results/admin-navigation');
const expect = baseExpect.configure({ timeout: 30000 });
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = { url: base.origin, at: new Date().toISOString(), checks: [] };
try {
  for (const [device, viewport] of Object.entries({ desktop: { width: 1440, height: 960 }, mobile: { width: 390, height: 844 } })) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    const blockedWrites = [];
    const origins = new Set([base.origin, 'https://dihchjflzhcekywarhxd.supabase.co', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com']);
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!origins.has(url.origin)) return route.abort('blockedbyclient');
      const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method());
      const auth = url.origin === 'https://dihchjflzhcekywarhxd.supabase.co' && /^\/auth\/v1\/(token|logout)$/.test(url.pathname);
      const readRpc = url.origin === 'https://dihchjflzhcekywarhxd.supabase.co' && /^\/rest\/v1\/rpc\/(ktp_cms_reference_(catalog|read|bundle)|ktp_latest_forecast_revision|ktp_load_forecast_slice)$/.test(url.pathname);
      if (!read && !(request.method() === 'POST' && (auth || readRpc))) {
        blockedWrites.push(`${request.method()} ${url.pathname}`);
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    const cookie = process.env.SMOKE_VERCEL_COOKIE;
    if (cookie) {
      assert.match(cookie, /^[A-Za-z0-9_.-]+$/);
      await context.addCookies([{ name: '_vercel_jwt', value: cookie, domain: base.hostname, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
    }
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
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
    try {
      await login(page, '/admin');
      await expect(page.getByRole('heading', { name: 'จัดการข้อมูล', exact: true })).toBeVisible();
      await expect(page.locator('.cms-resource-group:visible')).toHaveCount(3);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.brand-mark img').evaluate(image => image.decode());
      await page.screenshot({ path: path.join(output, `${device}-admin-data-full.png`), fullPage: true });
      await page.screenshot({ path: path.join(output, `${device}-admin-data-viewport.png`) });
      const mapGroup = page.locator('.cms-resource-group[data-group="maps"]');
      await mapGroup.getByRole('button', { name: 'ดูชั้นข้อมูล', exact: true }).click();
      await expect(mapGroup.locator('.cms-map-resource:visible')).toHaveCount(3);
      await mapGroup.getByRole('button', { name: 'ย่อชั้นข้อมูล', exact: true }).click();
      await expect(mapGroup.locator('.cms-map-resource:visible')).toHaveCount(0);
      await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('แหล่งข้อมูลอ้างอิง');
      await expect(page.locator('.cms-resource-group:visible')).toHaveCount(1);
      await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('');
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
      report.checks.push({ device, navigation: 'passed', resourceSearch: 'passed', resourceGroupCount: 3, importTemplate: 'passed', independentSessions: 'passed', applicationWrites: 0 });
    } finally { await context.close(); }
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(String(error.message ?? error).replaceAll(password, '[redacted]').replaceAll(email, '[redacted]'));
  process.exitCode = 1;
} finally { await browser.close(); }
