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
      const readResource = url.origin === base.origin && url.pathname === '/api/admin-data'
        && ['resource-get', 'resource-history'].includes(url.searchParams.get('action'));
      if (!read && !(request.method() === 'POST' && (auth || readRpc || readResource))) {
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
      await expect(page.locator('.cms-resource-row').first()).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'เดือนตั้งต้นที่จะตรวจแก้', exact: true })).toBeVisible();
      await expect(page.locator('.cms-forecast-metrics')).toContainText('เผยแพร่แล้ว');
      await expect(page.locator('.cms-published [role="alert"]')).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.brand-mark img').evaluate(image => image.decode());
      const resourceCount = await page.locator('.cms-resource-row').count();
      await page.screenshot({ path: path.join(output, `${device}-admin-data-full.png`), fullPage: true });
      await page.screenshot({ path: path.join(output, `${device}-admin-data-viewport.png`) });
      if (device === 'mobile' && resourceCount > 3) {
        await page.getByRole('button', { name: 'ดูข้อมูลทั้งหมด', exact: true }).click();
        await expect(page.locator('.cms-resource-row:visible')).toHaveCount(resourceCount);
        await page.getByRole('button', { name: 'แสดงน้อยลง', exact: true }).click();
      }
      await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('แหล่งข้อมูลอ้างอิง');
      await expect(page.locator('.cms-resource-row:visible')).toHaveCount(1);
      await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('รายชื่ออำเภอและตำบล');
      await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'รายชื่ออำเภอและตำบล', level: 1, exact: true })).toBeVisible();
      await expect(page.locator('.cms-resource-total-metric')).toContainText('289');
      await expect(page.locator('.cms-resource-total-metric')).toContainText('ตำบลใน 32 อำเภอ');
      await expect(page.locator('.cms-reference-table tbody tr')).toHaveCount(20);
      await expect(page.getByText('หน้า 1 / 15', { exact: true })).toBeVisible();
      const resourceUrl = page.url();
      await page.evaluate(() => scrollTo(0, 0));
      await page.evaluate(() => document.fonts.ready);
      const assets = await page.evaluate(async () => {
        const visible = element => {
          const bounds = element.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0 && getComputedStyle(element).visibility !== 'hidden';
        };
        const images = [...document.images].filter(visible);
        await Promise.all(images.map(image => image.decode()));
        const backgrounds = [...new Set([...document.querySelectorAll('*')].filter(visible).flatMap(element =>
          [...getComputedStyle(element).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => match[1])))];
        await Promise.all(backgrounds.map(source => new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => image.naturalWidth > 0 ? resolve() : reject(new Error(`Empty background: ${source}`));
          image.onerror = () => reject(new Error(`Background failed to load: ${source}`));
          image.src = source;
        })));
        return { images: images.map(image => ({ source: image.currentSrc, width: image.naturalWidth })), backgrounds };
      });
      assert.ok(assets.images.length > 0 && assets.images.every(image => image.width > 0), 'Visible brand images must decode.');
      await page.mouse.move(0, 0);
      const detailScreenshots = {
        full: path.join(output, `${device}-admin-resource-detail-full.png`),
        viewport: path.join(output, `${device}-admin-resource-detail-viewport.png`),
      };
      await page.screenshot({ path: detailScreenshots.full, fullPage: true });
      await page.screenshot({ path: detailScreenshots.viewport });
      const geometry = await page.evaluate(() => {
        const list = document.querySelector('.cms-records-scroll');
        return { url: location.href, width: innerWidth, height: innerHeight, pageHeight: document.documentElement.scrollHeight,
          pageOverflow: document.documentElement.scrollWidth > innerWidth, listHeight: list.clientHeight,
          listScrollHeight: list.scrollHeight, listScrollTop: list.scrollTop,
          rowCount: list.querySelectorAll('tbody tr').length, bounds: list.getBoundingClientRect().toJSON() };
      });
      assert.equal(geometry.pageOverflow, false);
      await writeFile(path.join(output, `${device}-admin-resource-detail-geometry.json`), JSON.stringify({ ...geometry, assets }, null, 2));
      const choose = async (label, value) => {
        const select = page.getByRole('combobox', { name: new RegExp(`^${label}`) });
        if (!await select.isVisible()) await page.getByRole('button', { name: /^ตัวกรอง/ }).click();
        await select.click();
        await page.getByRole('option', { name: value, exact: true }).click();
      };
      await choose('อำเภอ', 'ปากช่อง');
      await expect(page.getByText('พบ 12 จาก 289 รายการ', { exact: true })).toBeVisible();
      await expect(page.locator('.cms-reference-table tbody tr')).toHaveCount(12);
      const filterCode = (await page.locator('.cms-reference-table tbody input[type="checkbox"]').first().getAttribute('aria-label')).split(' · ').at(-1);
      await page.getByLabel('ค้นหาในข้อมูลชุดนี้', { exact: true }).fill(filterCode.slice(2));
      await expect(page.locator('.cms-reference-table tbody tr')).toHaveCount(1);
      await expect(page.locator('.cms-reference-table tbody tr')).toContainText(filterCode);
      await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click();
      await expect(page.locator('.cms-reference-table tbody tr')).toHaveCount(20);
      const rowCheckboxes = page.locator('.cms-reference-table tbody input[type="checkbox"]');
      await rowCheckboxes.first().check();
      const firstCode = (await rowCheckboxes.first().getAttribute('aria-label')).split(' · ').at(-1);
      await page.getByRole('button', { name: 'ข้อมูลหน้าถัดไป', exact: true }).click();
      await rowCheckboxes.last().check();
      const secondCode = (await rowCheckboxes.last().getAttribute('aria-label')).split(' · ').at(-1);
      await expect(page.getByText('เลือก 2 รายการ (รวมทุกหน้า)', { exact: true })).toBeVisible();
      const selectedDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'ดาวน์โหลดที่เลือก (CSV)', exact: true }).click();
      const csvDownload = await selectedDownload;
      assert.equal(await csvDownload.failure(), null);
      const stream = await csvDownload.createReadStream();
      assert.ok(stream, 'Selected CSV download must be readable.');
      const chunks = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const csv = Buffer.concat(chunks).toString('utf8');
      assert.ok(csv.startsWith('\uFEFF'), 'CSV must include the UTF-8 BOM for Excel.');
      assert.equal(csv.split('\r\n').length, 3, 'CSV must contain a header and two selected data rows.');
      for (const code of [firstCode, secondCode]) assert.ok(csv.includes(`"${code}"`), 'CSV must retain original selected area codes.');
      await page.getByRole('button', { name: 'ล้างรายการที่เลือก', exact: true }).click();
      await expect(page.locator('.cms-reference-table tbody input[type="checkbox"]:checked')).toHaveCount(0);
      await expect(page.locator('.cms-record-selection button').filter({ hasText: 'ดาวน์โหลดที่เลือก (CSV)' })).toBeDisabled();
      const openDetails = page.getByRole('button', { name: 'ดูรายละเอียด', exact: true }).first();
      await openDetails.click();
      await expect(page.getByRole('dialog', { name: 'รายละเอียดรายการ', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'รายละเอียดรายการ', exact: true })).toHaveCount(0);
      await expect(openDetails).toBeFocused();
      await page.reload();
      await expect(page).toHaveURL(resourceUrl);
      await expect(page.getByRole('heading', { name: 'รายชื่ออำเภอและตำบล', level: 1, exact: true })).toBeVisible();
      await page.locator('summary').filter({ hasText: 'ประวัติและไฟล์ต้นฉบับ' }).click();
      await expect(page.getByRole('button', { name: 'ดาวน์โหลดไฟล์ข้อมูล (JSON)', exact: true })).toBeVisible();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('.cms-reference-context').getByRole('link', { name: 'จัดการข้อมูล', exact: true }).click();
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
      report.checks.push({ device, navigation: 'passed', resourceSearch: 'passed', resourceCount,
        resourceDetail: { status: 'passed', areas: 289, districts: 32, selectedCsvRows: 2, screenshot: detailScreenshots, geometry, assets },
        importTemplate: 'passed', independentSessions: 'passed', applicationWrites: 0 });
    } finally { await context.close(); }
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(String(error.message ?? error).replaceAll(password, '[redacted]').replaceAll(email, '[redacted]'));
  process.exitCode = 1;
} finally { await browser.close(); }
