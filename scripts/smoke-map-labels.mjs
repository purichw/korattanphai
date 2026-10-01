import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices, expect as baseExpect } from '@playwright/test';
import { validateSmokeTarget } from './smoke-target.mjs';

const base = validateSmokeTarget(process.env.SMOKE_URL ?? 'https://korattanphai.vercel.app', process.env.SMOKE_ALLOWED_PREVIEW_ORIGINS);
const email = process.env.SMOKE_AUTH_EMAIL?.trim();
const password = process.env.SMOKE_AUTH_PASSWORD;
assert.ok(email && password, 'Provide the real smoke account through environment variables.');
const cookie = process.env.SMOKE_VERCEL_COOKIE?.trim();
if (cookie) assert.match(cookie, /^[A-Za-z0-9_.-]+$/, 'Invalid protected-preview cookie.');
const output = path.resolve(process.env.SMOKE_OUTPUT_DIR ?? 'smoke-results/map-labels');
const expect = baseExpect.configure({ timeout: 20000 });
const supabase = 'https://dihchjflzhcekywarhxd.supabase.co';
const allowedOrigins = new Set([base.origin, supabase, 'https://fonts.googleapis.com', 'https://fonts.gstatic.com']);
const report = { url: base.origin, at: new Date().toISOString(), checks: [] };
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
let timedOut = false;
const deadline = setTimeout(() => { timedOut = true; void browser.close(); }, 170000);

async function settledCamera(page) {
  let previous = null;
  let stableFrames = 0;
  await expect.poll(async () => {
    const current = await page.locator('.nr-map-transform-layer').evaluate(element => new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(element.getAttribute('transform'))));
    }));
    stableFrames = current === previous ? stableFrames + 1 : 0;
    previous = current;
    return current !== null && stableFrames >= 3;
  }, { intervals: [100] }).toBe(true);
}

async function zoomIn(page, count) {
  const layer = page.locator('.nr-map-transform-layer');
  const before = await layer.getAttribute('transform');
  await page.locator('.nr-map-panel').getByTitle('ขยายแผนที่', { exact: true }).evaluate((button, presses) => {
    for (let index = 0; index < presses; index += 1) button.click();
  }, count);
  await expect(layer).not.toHaveAttribute('transform', before);
  await settledCamera(page);
  await page.locator('.nr-map-svg').scrollIntoViewIfNeeded();
}

async function pinchZoomIn(page) {
  await page.locator('.nr-map-svg').scrollIntoViewIfNeeded();
  const box = await page.locator('.nr-map-svg').boundingBox();
  const layer = page.locator('.nr-map-transform-layer');
  const before = await layer.getAttribute('transform');
  const touch = await page.context().newCDPSession(page);
  const points = spread => [
    { x: box.x + box.width / 2 - spread, y: box.y + box.height / 2, id: 0 },
    { x: box.x + box.width / 2 + spread, y: box.y + box.height / 2, id: 1 },
  ];
  try {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(30) });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(66) });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await touch.detach(); }
  await expect(layer).not.toHaveAttribute('transform', before);
  await settledCamera(page);
}

async function visibleLabels(page, selector) {
  return page.locator(`.nr-map-label-layer ${selector}`).evaluateAll(elements => elements.flatMap(text => {
    const matrix = text.getScreenCTM();
    const plot = text.ownerSVGElement?.getBoundingClientRect();
    const bounds = text.getBoundingClientRect();
    const style = getComputedStyle(text);
    if (!matrix || !plot || !bounds.width || !bounds.height || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return [];
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    if (centerX < Math.max(0, plot.left) || centerX > Math.min(innerWidth, plot.right)
      || centerY < Math.max(0, plot.top) || centerY > Math.min(innerHeight, plot.bottom)) return [];
    return [{ text: text.textContent, screenFontSize: parseFloat(style.fontSize) * Math.hypot(matrix.c, matrix.d),
      fontFamily: style.fontFamily, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }];
  }));
}

async function capture(page, device, state, selector, minimum) {
  await expect.poll(async () => (await visibleLabels(page, selector)).length).toBeGreaterThan(0);
  const labels = await visibleLabels(page, selector);
  assert.ok(Math.min(...labels.map(label => label.screenFontSize)) >= minimum - 0.05, `${device} ${state}: labels below ${minimum} CSS px.`);
  await page.mouse.move(0, 0);
  const geometry = await page.locator('.nr-map-panel').evaluate(panel => {
    const bounds = panel.getBoundingClientRect();
    return { url: location.href, width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio, scrollY,
      overflow: document.documentElement.scrollWidth > innerWidth, mapBounds: bounds.toJSON(),
      transform: panel.querySelector('.nr-map-transform-layer').getAttribute('transform'),
      polygonCount: panel.querySelectorAll('.nr-map-shape').length };
  });
  assert.equal(geometry.overflow, false, `${device} ${state}: horizontal page overflow.`);
  const screenshots = { viewport: path.join(output, `${device}-${state}-viewport.png`), mapContext: path.join(output, `${device}-${state}-map-context.png`) };
  await page.screenshot({ path: screenshots.viewport });
  // Full-page context also handles mobile visual-viewport offsets after login;
  // the paired viewport capture keeps the inspected map and labels readable.
  await page.screenshot({ path: screenshots.mapContext, fullPage: true });
  return { state, minimumCssPx: minimum, labels, geometry, screenshots };
}

try {
  for (const [device, viewport] of Object.entries({ desktop: { width: 1440, height: 960 }, mobile: { width: 390, height: 844 } })) {
    const context = await browser.newContext({ ...(device === 'mobile' ? devices['Pixel 5'] : devices['Desktop Chrome']), viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const errors = [];
    const blockedWrites = [];
    const geometryResponses = [];
    const geometryChecks = [];
    let forecastReads = 0;
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!allowedOrigins.has(url.origin)) return route.abort('blockedbyclient');
      const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method());
      const auth = url.origin === supabase && /^\/auth\/v1\/(token|logout)$/.test(url.pathname);
      const readRpc = url.origin === supabase && /^\/rest\/v1\/rpc\/(ktp_cms_reference_(catalog|read|bundle)|ktp_latest_forecast_revision|ktp_load_forecast_slice)$/.test(url.pathname);
      if (!read && !(request.method() === 'POST' && (auth || readRpc))) {
        blockedWrites.push(`${request.method()} ${url.pathname}`);
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    if (cookie) await context.addCookies([{ name: '_vercel_jwt', value: cookie, domain: base.hostname, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      const url = new URL(response.url());
      if (!allowedOrigins.has(url.origin)) return;
      if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${url.pathname}`);
      const staticGeometry = url.origin === base.origin && url.pathname === '/geodata/nakhon-ratchasima-subdistricts.geojson';
      const cmsGeometry = url.origin === supabase && /^\/rest\/v1\/rpc\/ktp_cms_reference_(read|bundle)$/.test(url.pathname);
      if ((staticGeometry || cmsGeometry) && response.ok()) geometryChecks.push((async () => {
        const body = await response.json();
        const bundle = url.pathname.endsWith('ktp_cms_reference_bundle');
        const geometry = bundle ? body['geodata/nakhon-ratchasima-subdistricts'] : body;
        // Other CMS reads include province borders and context geometry. Identify
        // the actual tambon collection without requiring a static-file fallback.
        const tambons = geometry?.type === 'FeatureCollection' && Array.isArray(geometry.features)
          && geometry.features.some(feature => feature.properties?.T_Name_T);
        if (!staticGeometry && !tambons) return;
        assert.ok(tambons, 'Subdistrict geometry must be a named FeatureCollection.');
        assert.equal(geometry.features.length, 289, 'Loaded geometry must contain all 289 tambons.');
        assert.ok(geometry.features.every(feature => /^30\d{4}$/.test(feature.properties?.Admin_code)
          && feature.properties.T_Name_T && ['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)), 'Loaded tambons must retain codes, names and polygons.');
        const uniqueCodes = new Set(geometry.features.map(feature => feature.properties.Admin_code)).size;
        assert.equal(uniqueCodes, 289, 'Loaded tambon geometry must have unique area codes.');
        geometryResponses.push({ source: staticGeometry ? 'static-geodata' : `cms:${url.pathname.split('/').at(-1)}`,
          status: response.status(), featureCount: geometry.features.length, uniqueCodes });
      })().catch(error => errors.push(`Geometry evidence: ${error.message}`)));
      if (url.origin === supabase && url.pathname === '/rest/v1/rpc/ktp_load_forecast_slice' && response.ok()) forecastReads++;
    });
    page.on('requestfailed', request => {
      if (allowedOrigins.has(new URL(request.url()).origin) && request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`Request failed: ${new URL(request.url()).pathname}`);
    });
    const setup = async (route, forecastAreaCount) => {
      await page.goto(new URL(`${route}?mapLayer=forecast-archive&target=2025-12&horizon=1`, base).href, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.nr-map-shape')).toHaveCount(289);
      await expect(page.locator('.nr-map-shape').first()).toBeVisible();
      // Geometry stays province-wide; the forecast RPC paints only the route's
      // requested scope (province, district or selected tambon).
      await expect(page.locator('.nr-map-shape.is-forecast-high, .nr-map-shape.is-forecast-moderate, .nr-map-shape.is-forecast-no-risk, .nr-map-shape.is-forecast-out-of-scope')).toHaveCount(forecastAreaCount);
      await page.locator('.nr-map-svg').scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.brand-mark img').evaluate(image => image.decode());
      await settledCamera(page);
    };
    try {
      await page.goto(new URL('/login', base).href, { waitUntil: 'domcontentloaded' });
      assert.equal(new URL(page.url()).origin, base.origin, 'Deployment must be accessible before login.');
      await page.getByLabel('อีเมล', { exact: true }).fill(email);
      await page.getByLabel('รหัสผ่าน', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
      await expect(page.locator('.nr-forecast-overview')).toBeVisible();
      const minimum = device === 'mobile' ? 11 : 6;
      const states = [];
      await setup('/', 289);
      const provinceUrl = page.url();
      await expect(page.locator('.nr-map-shape.is-selected')).toHaveCount(0);
      await zoomIn(page, 3);
      states.push(await capture(page, device, 'province-district-labels', '.is-district-label', minimum));
      if (device === 'mobile') await pinchZoomIn(page);
      else await zoomIn(page, 6);
      states.push(await capture(page, device, 'province-subdistrict-labels', '.is-subdistrict-label:not(.is-featured-label):not(.is-selected-label):not(.is-previewed-label)', minimum));
      await expect(page.locator('.nr-map-shape.is-selected')).toHaveCount(0);
      assert.equal(page.url(), provinceUrl, 'Zoom must not navigate to a selected area.');
      await setup('/soeng-sang', 6);
      await zoomIn(page, 2);
      states.push(await capture(page, device, 'district-subdistrict-labels', '.is-subdistrict-label', minimum));
      await setup('/phimai/t-301503', 1);
      await expect(page.locator('[data-nr-subdistrict-code="301503"]')).toHaveClass(/is-selected/);
      states.push(await capture(page, device, 'selected-place-label', '.is-subdistrict-label.is-selected-label', device === 'mobile' ? 12 : 6));
      await Promise.all(geometryChecks);
      assert.ok(geometryResponses.length > 0 && geometryResponses.every(item => item.status === 200 && item.featureCount === 289), 'Real CMS or static map geometry must load successfully.');
      assert.ok(forecastReads > 0, 'Real forecast slice must load successfully.');
      assert.deepEqual(errors, []);
      assert.deepEqual(blockedWrites, []);
      report.checks.push({ device, viewport, touchPinch: device === 'mobile' ? 'CDP two-finger gesture passed' : 'not required',
        geometryResponses, forecastReads, applicationWrites: 0, states });
    } finally { await context.close(); }
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ url: report.url, report: path.join(output, 'report.json'), checks: report.checks.map(check => ({
    device: check.device, touchPinch: check.touchPinch, geometrySources: [...new Set(check.geometryResponses.map(item => item.source))],
    forecastReads: check.forecastReads, applicationWrites: check.applicationWrites,
    states: check.states.map(state => ({ state: state.state, visibleLabels: state.labels.length,
      minimumScreenFontSize: Math.min(...state.labels.map(label => label.screenFontSize)) })),
  })) }));
} catch (error) {
  console.error((timedOut ? 'Map label smoke exceeded its 170-second budget.' : String(error.message ?? error)).replaceAll(password, '[redacted]').replaceAll(email, '[redacted]'));
  process.exitCode = 1;
} finally { clearTimeout(deadline); await browser.close(); }
