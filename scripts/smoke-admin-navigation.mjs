import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, expect as baseExpect } from '@playwright/test';
import { validateSmokeTarget } from './smoke-target.mjs';

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
        && url.searchParams.get('action') === 'resource-get';
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
      await expect(page.locator('.cms-resource-group:visible')).toHaveCount(2);
      await expect(page.locator('.cms-reference')).not.toContainText('แหล่งข้อมูลอ้างอิง');
      await expect(page.getByRole('combobox', { name: 'เดือนตั้งต้นที่จะตรวจแก้', exact: true })).toBeVisible();
      await expect(page.locator('.cms-forecast-metrics')).toContainText('เผยแพร่แล้ว');
      await expect(page.locator('.cms-published [role="alert"]')).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.brand-mark img').evaluate(image => image.decode());
      await page.screenshot({ path: path.join(output, `${device}-admin-data-full.png`), fullPage: true });
      await page.screenshot({ path: path.join(output, `${device}-admin-data-viewport.png`) });
      const mapGroup = page.locator('.cms-resource-group[data-group="maps"]');
      await mapGroup.getByRole('button', { name: 'ดูชั้นข้อมูล', exact: true }).click();
      await expect(mapGroup.locator('.cms-map-resource:visible')).toHaveCount(3);
      await mapGroup.getByRole('button', { name: 'ย่อชั้นข้อมูล', exact: true }).click();
      await expect(mapGroup.locator('.cms-map-resource:visible')).toHaveCount(0);
      await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('ข้อมูลพื้นที่');
      await expect(page.locator('.cms-resource-group:visible')).toHaveCount(1);
      const search = page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true });
      const originalSearch = await search.elementHandle();
      await watchStartup();
      const away = await context.newPage();
      await away.bringToFront();
      await page.bringToFront();
      await expect(search).toHaveValue('ข้อมูลพื้นที่');
      assert.equal(await originalSearch.evaluate(element => element.isConnected), true, 'Browser tab return must retain the existing Admin view.');
      await noNewStartup();
      await away.close();

      holdReads('list', 'forecast-catalog', 'resource-catalog');
      await page.getByRole('button', { name: 'โหลดฉบับล่าสุด', exact: true }).click();
      await expect.poll(() => ['list', 'forecast-catalog', 'resource-catalog'].every(action => arrivedActions.has(action))).toBe(true);
      await expect(page.locator('.cms-resource-group:visible')).toHaveCount(1);
      await expect(page.getByRole('heading', { name: 'พยากรณ์ที่แสดงบนเว็บไซต์', exact: true })).toBeVisible();
      await expect(search).toHaveValue('ข้อมูลพื้นที่');
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
      await expect(page.locator('.cms-resource-group:visible')).toHaveCount(2);
      await expect(page.getByRole('heading', { name: 'พยากรณ์ที่แสดงบนเว็บไซต์', exact: true })).toBeVisible();
      await noNewStartup();
      await page.screenshot({ path: path.join(output, `${device}-admin-warm-navigation.png`), fullPage: true });
      resumeReads();
      await expect(page.locator('.cms-reference')).toHaveAttribute('aria-busy', 'false');
      await noNewStartup();

      await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('รายชื่ออำเภอและตำบล');
      const areaRead = page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.origin === base.origin && url.pathname === '/api/admin-data' && url.searchParams.get('action') === 'resource-get' && response.ok();
      });
      await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'รายชื่ออำเภอและตำบล', level: 1, exact: true })).toBeVisible();
      const areaResource = await (await areaRead).json();
      assert.equal(areaResource.resource_key, 'canonical/nakhon_ratchasima/admin_hierarchy');
      await expect(page.locator('.cms-resource-total-metric')).toContainText('289');
      await expect(page.locator('.cms-resource-total-metric')).toContainText('ตำบลใน 32 อำเภอ');
      await expect(page.locator('.cms-reference-table tbody tr')).toHaveCount(20);
      await expect(page.getByText('หน้า 1 / 15', { exact: true })).toBeVisible();
      await expect(page.locator('.cms-reference-table input[type="checkbox"]')).toHaveCount(0);
      await expect(page.getByRole('checkbox', { name: 'เลือกทุกรายการในหน้านี้', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'เลือกเพื่อดาวน์โหลด', exact: true })).toBeVisible();
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
      const filterCode = (await page.locator('.cms-reference-table tbody .cms-record-cell-2').first().textContent()).match(/\b\d{6}\b/)[0];
      await page.getByLabel('ค้นหาในข้อมูลชุดนี้', { exact: true }).fill(filterCode.slice(2));
      await expect(page.locator('.cms-reference-table tbody tr')).toHaveCount(1);
      await expect(page.locator('.cms-reference-table tbody tr')).toContainText(filterCode);
      await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click();
      await expect(page.locator('.cms-reference-table tbody tr')).toHaveCount(20);
      const rowCheckboxes = page.locator('.cms-reference-table tbody input[type="checkbox"]');
      await expect(rowCheckboxes).toHaveCount(0);
      const startSelection = page.getByRole('button', { name: 'เลือกเพื่อดาวน์โหลด', exact: true });
      await startSelection.focus(); await page.keyboard.press('Enter');
      await expect(rowCheckboxes).toHaveCount(20);
      if (device === 'mobile') await expect(page.getByText('เลือกทั้งหน้านี้', { exact: true })).toBeVisible();
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
      await rowCheckboxes.first().check();
      await page.getByRole('button', { name: 'ยกเลิกการเลือก', exact: true }).click();
      await expect(rowCheckboxes).toHaveCount(0);
      await expect(page.getByRole('checkbox', { name: 'เลือกทุกรายการในหน้านี้', exact: true })).toHaveCount(0);
      await startSelection.click();
      await expect(page.locator('.cms-reference-table tbody input[type="checkbox"]:checked')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'ดาวน์โหลดที่เลือก (CSV)', exact: true, includeHidden: true })).toBeDisabled();
      await page.getByRole('button', { name: 'ยกเลิกการเลือก', exact: true }).click();
      const openDetails = page.getByRole('button', { name: 'ดูรายละเอียด', exact: true }).first();
      if (device === 'mobile') {
        const dimensions = await openDetails.evaluate(element => ({ button: element.getBoundingClientRect().toJSON(), row: element.closest('tr').getBoundingClientRect().toJSON() }));
        assert.ok(dimensions.button.width < dimensions.row.width * 0.7, 'Detail action must remain compact within the mobile row.');
        assert.ok(dimensions.button.height >= 44, 'Compact detail action must retain a 44px touch target.');
      }
      const recordValues = await page.locator('.cms-reference-table tbody tr').first().locator('.cms-record-cell').evaluateAll(cells =>
        cells.map(cell => (cell.textContent ?? '').replace(cell.querySelector('.cms-record-mobile-label')?.textContent ?? '', '').trim()));
      await openDetails.focus(); await page.keyboard.press('Enter');
      const recordDialog = page.getByRole('dialog', { name: 'รายละเอียดรายการ', exact: true });
      await expect(recordDialog).toBeVisible();
      await expect(recordDialog).toHaveAccessibleDescription('ข้อมูลอำเภอและตำบลในจังหวัดนครราชสีมา');
      assert.equal(await recordDialog.evaluate(element => element.tagName === 'DIALOG' && element.matches(':modal')), true);
      await expect(recordDialog.locator('.cms-record-dialog-meta')).toContainText(`รุ่นแก้ไข ${areaResource.revision}`);
      await expect(recordDialog.locator('.cms-record-dialog-status')).toHaveText(areaResource.state === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง');
      await expect(recordDialog.locator('dt')).toHaveText(['อำเภอ', 'ตำบล', 'รหัสตำบล']);
      await expect(recordDialog.locator('dt svg[aria-hidden="true"]')).toHaveCount(3);
      await expect(recordDialog.locator('dd')).toHaveText(recordValues);
      await expect(recordDialog.locator('.cms-record-dialog-description')).toContainText('ชื่อและรหัสพื้นที่ที่ใช้ค้นหา เลือกพื้นที่ และเชื่อมกับค่าพยากรณ์');
      await expect(recordDialog.locator('footer')).toContainText(`ข้อมูลอ้างอิงสำหรับตรวจสอบ · รุ่นแก้ไข ${areaResource.revision}`);
      const getDialogGeometry = () => recordDialog.evaluate(element => {
        const content = element.querySelector('.nr-tool-dialog-content');
        return { viewport: { width: innerWidth, height: innerHeight }, dialog: element.getBoundingClientRect().toJSON(),
          content: { clientHeight: content.clientHeight, scrollHeight: content.scrollHeight, scrollTop: content.scrollTop },
          footer: element.querySelector('footer').getBoundingClientRect().toJSON(), pageOverflow: document.documentElement.scrollWidth > innerWidth };
      });
      const recordDialogGeometry = { normal: await getDialogGeometry(), short: null };
      assert.equal(recordDialogGeometry.normal.pageOverflow, false);
      if (device === 'mobile') {
        assert.ok(Math.abs(recordDialogGeometry.normal.dialog.x) <= 1, 'Mobile record dialog starts at the viewport left edge.');
        assert.ok(Math.abs(recordDialogGeometry.normal.dialog.width - viewport.width) <= 1, 'Mobile record dialog spans the viewport width.');
        assert.ok(Math.abs(recordDialogGeometry.normal.dialog.bottom - viewport.height) <= 1, 'Mobile record dialog is anchored to the viewport bottom.');
      }
      const recordDialogScreenshots = {
        viewport: path.join(output, `${device}-admin-record-dialog-viewport.png`),
        context: path.join(output, `${device}-admin-record-dialog-context.png`),
      };
      await page.mouse.move(0, 0);
      await page.screenshot({ path: recordDialogScreenshots.viewport });
      // Native modal/backdrop evidence must stay within one viewport; full-page stitching misplaces it.
      await page.screenshot({ path: recordDialogScreenshots.context });
      await page.keyboard.press('Escape');
      await expect(recordDialog).toHaveCount(0);
      await expect(openDetails).toBeFocused();
      await page.keyboard.press('Enter');
      await recordDialog.getByRole('button', { name: 'ปิดรายละเอียดรายการ', exact: true }).click();
      await expect(recordDialog).toHaveCount(0); await expect(openDetails).toBeFocused();
      await page.keyboard.press('Enter');
      if (device === 'mobile') {
        await page.setViewportSize({ width: viewport.width, height: 480 });
        await expect.poll(async () => Math.abs((await getDialogGeometry()).dialog.bottom - 480) <= 1).toBe(true);
        const content = recordDialog.locator('.nr-tool-dialog-content');
        assert.equal(await content.evaluate(element => element.scrollHeight > element.clientHeight), true, 'Short mobile dialog content must scroll independently.');
        await content.evaluate(element => { element.scrollTop = element.scrollHeight; });
        await expect.poll(() => content.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
        recordDialogGeometry.short = await getDialogGeometry();
        assert.ok(recordDialogGeometry.short.footer.top >= 0 && recordDialogGeometry.short.footer.bottom <= 480, 'Dialog footer remains inside the short viewport.');
        await expect(recordDialog.getByRole('button', { name: 'ปิด', exact: true })).toBeInViewport();
        recordDialogScreenshots.short = path.join(output, `${device}-admin-record-dialog-short.png`);
        await page.screenshot({ path: recordDialogScreenshots.short });
      }
      await recordDialog.getByRole('button', { name: 'ปิด', exact: true }).click();
      await expect(recordDialog).toHaveCount(0); await expect(openDetails).toBeFocused();
      if (device === 'mobile') await page.setViewportSize(viewport);
      await writeFile(path.join(output, `${device}-admin-record-dialog-geometry.json`), JSON.stringify(recordDialogGeometry, null, 2));
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
      report.checks.push({ device, navigation: 'passed', resourceSearch: 'passed', resourceGroupCount: 2, mapResourceCount: 3, retiredSourceCategory: 'absent',
        browserTabReturn: 'passed', manualRefresh: 'passed', warmNavigation: 'passed',
        resourceDetail: { status: 'passed', areas: 289, districts: 32, selectedCsvRows: 2, explicitSelection: 'passed', cancelClearsSelection: 'passed', keyboardDetail: 'passed', screenshot: detailScreenshots, geometry, assets,
          dialog: { revision: areaResource.revision, state: areaResource.state, geometry: recordDialogGeometry, screenshots: recordDialogScreenshots, closeAndFocus: ['Escape', 'header close', 'footer close'] } },
        importTemplate: 'passed', independentSessions: 'passed', applicationWrites: 0 });
    } finally { resumeReads(); await context.close(); }
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(redact(error.message ?? error));
  process.exitCode = 1;
} finally { await browser.close(); }
