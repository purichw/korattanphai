import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { isDeepStrictEqual } from "node:util";
import { buildForecastOverviewArchive } from "./generate-forecast-summary.mjs";
import { forecastSlice } from "../tests/fixtures/forecast-slice.mjs";
import { smokeExcelExport } from "./smoke-excel-export.mjs";
import { validateSmokeTarget } from './smoke-target.mjs';
import { BUSINESS_TIMEZONE, OPERATIONAL_POLICY_VERSION, businessMonth, nextBusinessMonth } from '../src/data/operationalPolicy.mjs';

const base = validateSmokeTarget(process.env.SMOKE_URL ?? "https://korattanphai.vercel.app", process.env.SMOKE_ALLOWED_PREVIEW_ORIGINS);
const local = ["localhost", "127.0.0.1"].includes(base.hostname);
const output = path.resolve(process.env.SMOKE_OUTPUT_DIR ?? "smoke-results");
const databaseMode = process.env.SMOKE_DATA_BACKEND === "supabase";
const expectedArchive = databaseMode ? JSON.parse(await fs.readFile(new URL("../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json", import.meta.url), "utf8")) : null;
const email = process.env.SMOKE_AUTH_EMAIL?.trim();
const password = process.env.SMOKE_AUTH_PASSWORD;
if (!email || !password) throw new Error("Set SMOKE_AUTH_EMAIL and SMOKE_AUTH_PASSWORD securely for an admin-provisioned test account. No demo login fallback is available.");
const protectionCookie = process.env.SMOKE_VERCEL_COOKIE?.trim();
if (protectionCookie && (local || !/^[A-Za-z0-9_.-]+$/.test(protectionCookie))) {
  throw new Error("SMOKE_VERCEL_COOKIE must be an authorized Vercel session for this deployment, never a localhost fixture.");
}
await fs.mkdir(output, { recursive: true });
const report = { url: base.origin, at: new Date().toISOString(), api: local ? "skipped: Vite preview has no serverless API" : "pending", checks: [], failures: [] };
let browser;
try {
  if (!local) {
    const response = await fetch(new URL("/api/risk-fusion?eventId=ARE-2026-0825-NE", base), {
      signal: AbortSignal.timeout(30_000), redirect: "error",
      headers: protectionCookie ? { Cookie: `_vercel_jwt=${protectionCookie}` } : undefined,
    });
    assert.equal(response.status, 200, "API status");
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const body = await response.json();
    assert.equal(body.id, "fusion-ARE-2026-0825-NE");
    assert.equal(body.components.length, 6);
    assert.ok(!JSON.stringify(body).match(/thaiwater|thai-water|thai_water/i), "retired provider remains absent");
    report.api = "passed";
    const clock = await fetch(new URL('/api/operational-context', base), {
      signal: AbortSignal.timeout(30_000), redirect: 'error',
      headers: protectionCookie ? { Cookie: `_vercel_jwt=${protectionCookie}` } : undefined,
    });
    assert.equal(clock.status, 200, 'Operational clock status');
    assert.match(clock.headers.get('cache-control') ?? '', /no-store/);
    const metadata = await clock.json();
    assert.equal(metadata.timezone, BUSINESS_TIMEZONE);
    assert.equal(metadata.policyVersion, OPERATIONAL_POLICY_VERSION);
    assert.equal(metadata.currentPeriod, businessMonth(metadata.serverNow));
    assert.equal(metadata.nextBoundary, nextBusinessMonth(metadata.serverNow));
    assert.ok(Math.abs(Date.now() - Date.parse(metadata.serverNow)) < 60_000, 'Fresh server clock');
    assert.deepEqual(metadata.actualPeriods, []);
    assert.deepEqual(metadata.forecastPeriods, []);
    report.checks.push({ operationalClock: 'passed', actualFeed: 'unconfigured', operationalForecastFeed: 'unconfigured' });
  }
  browser = await chromium.launch();
  for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 960 }, mobile: { width: 390, height: 844 } })) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const allowedOrigins = new Set([base.origin, 'https://dihchjflzhcekywarhxd.supabase.co', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com']);
    await context.route('**/*', route => allowedOrigins.has(new URL(route.request().url()).origin)
      ? route.continue() : route.abort('blockedbyclient'));
    if (protectionCookie) await context.addCookies([{
      name: "_vercel_jwt", value: protectionCookie, domain: base.hostname,
      path: "/", secure: true, httpOnly: true, sameSite: "Lax",
    }]);
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const errors = [];
    const assetChecks = [];
    const rpcChecks = [];
    const rpcHorizons = new Set();
    let operationalReads = 0;
    page.on("request", request => { if (new URL(request.url()).pathname === "/api/operational-context") operationalReads++; });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).origin === base.origin && request.failure()?.errorText !== "net::ERR_ABORTED") errors.push(`Request failed: ${new URL(request.url()).pathname}`);
    });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (databaseMode && url.pathname === "/rest/v1/rpc/ktp_load_forecast_archive") errors.push("Unexpected full archive read");
      if (databaseMode && url.origin === "https://dihchjflzhcekywarhxd.supabase.co" && url.pathname === "/rest/v1/rpc/ktp_load_forecast_slice") {
        rpcChecks.push((async () => {
          assert.equal(response.status(), 200, "Forecast RPC status");
          const horizon = response.request().postDataJSON().p_horizon_count;
          const expected = forecastSlice(horizon === 1 ? buildForecastOverviewArchive(expectedArchive) : expectedArchive, response.request().postDataJSON());
          assert.ok(isDeepStrictEqual(await response.json(), expected), "Rendered app RPC differs from source archive");
          rpcHorizons.add(horizon);
        })().catch(error => errors.push(error.message)));
      }
      if (url.origin !== base.origin) return;
      if (databaseMode && /\/(drought_forecast_archive_rev03|forecast-overview-t1).*\.json$/.test(url.pathname)) errors.push("Unexpected static archive fallback");
      if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${url.pathname}`);
      if (/^\/assets\/.*\.(js|css|json)$/.test(url.pathname)) assetChecks.push((async () => {
        const headers = await response.allHeaders();
        assert.ok(!headers["content-type"]?.includes("text/html"), `Asset returned HTML: ${url.pathname}`);
        if (!local) assert.match(headers["cache-control"] ?? "", /immutable/, `Asset cache: ${url.pathname}`);
      })().catch((error) => { errors.push(error.message); }));
    });
    try {
      const response = await page.goto(new URL("/login", base).href, { waitUntil: "domcontentloaded" });
      assert.equal(response.status(), 200);
      if (!local) {
        const headers = await response.allHeaders();
        assert.match(headers["content-security-policy"] ?? "", /frame-ancestors 'none'/);
        assert.equal(headers["x-content-type-options"], "nosniff");
      }
      try {
        await page.getByLabel("อีเมล", { exact: true }).fill(email);
        await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
        await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
        await page.locator(".nr-forecast-overview").waitFor();
      } catch {
        throw new Error("Smoke login failed. Verify the configured test account, environment and network; credential values are not reported.");
      }
      for (const route of ['/', '/wang-nam-khiao', '/phimai/t-301503']) {
        await page.goto(new URL(`${route}?period=2026-08`, base).href, { waitUntil: 'domcontentloaded' });
        await page.locator('.nr-map-shape').first().waitFor();
        await expect(page.locator('.nr-map-shape')).toHaveCount(289);
        await expect(page.locator('.nr-primary-workspace, .nr-archive-context')).toHaveCount(0);
        await expect(page).toHaveURL(/target=2025-12&horizon=1/);
        assert.equal(new URL(page.url()).searchParams.has('period'), false);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        if (route === '/') await page.screenshot({ path: path.join(output, `${name}-forecast-default.png`), fullPage: true });
        report.checks.push({ viewport: name, route, forecastDefault: true, retiredPeriodNotOrigin: true });
      }
      for (const [route, areaCode] of [["/?mapLayer=forecast-archive", "30"], ["/drought?mapLayer=forecast-archive&target=2025-12&horizon=1", "30"], ["/dan-khun-thot?mapLayer=forecast-archive&target=2025-12&horizon=4", "3008"], ["/dan-khun-thot/t-300806?mapLayer=forecast-archive&target=2025-12&horizon=4", "300806"], ["/ban-lueam?mapLayer=forecast-archive&target=2025-12&horizon=1", "3005"]]) {
        await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded" });
        await page.locator(".nr-map-shape").first().waitFor();
        assert.equal(await page.locator(".nr-map-shape").count(), 289, `${name}: polygon count`);
        await expect(page.locator('.nr-home-readiness, .nr-data-readiness-section, .nr-prediction-readiness, .nr-readiness-map-action, .nr-return-forecast')).toHaveCount(0);
        if (databaseMode) {
          const target = new URL(page.url()).searchParams.get("target");
          const horizon = Number(new URL(page.url()).searchParams.get("horizon"));
          const actual = await page.locator(".nr-map-shape").evaluateAll(nodes => nodes.map(node => ({
            code: node.getAttribute("data-nr-subdistrict-code"),
            filtered: node.classList.contains("is-criteria-filtered"),
            risk: node.classList.contains("is-forecast-high") ? 2 : node.classList.contains("is-forecast-moderate") ? 1
              : node.classList.contains("is-forecast-no-risk") ? 0 : node.classList.contains("is-forecast-out-of-scope") ? null : "missing",
          })));
          const expectedCodes = expectedArchive.locations.filter(location => areaCode === "30" || location.districtCode === areaCode || location.subdistrictCode === areaCode).map(location => location.subdistrictCode).sort();
          const visible = actual.filter(shape => !shape.filtered);
          assert.deepEqual(visible.map(shape => shape.code).sort(), expectedCodes, `${name}: exact route scope; other polygons filtered`);
          assert.ok(visible.every(({ code, risk }) => risk === expectedArchive.packedRiskByTargetMonth[target]?.[code]?.[horizon - 1]), `${name}: all in-scope map colors match source`);
        }
        if (route === "/?mapLayer=forecast-archive") {
          const summary = page.locator(".nr-forecast-overview-summary");
          await summary.waitFor();
          assert.deepEqual(await summary.locator(".metric-card-value").allTextContents(), ["0 ตำบล", "117 ตำบล", "0 ตำบล", "172 ตำบล"], `${name}: latest T+1 forecast counts`);
          await expect(page.locator(".nr-forecast-overview-context")).toContainText("พยากรณ์ ม.ค. 2569");
          await expect(page.locator(".nr-forecast-overview-context")).toContainText("เดือนตั้งต้น (T) ธ.ค. 2568");
          assert.equal(new URL(page.url()).searchParams.get("target"), "2025-12");
          assert.equal(new URL(page.url()).searchParams.get("horizon"), "1");
          await page.screenshot({ path: path.join(output, `${name}-overview.png`), fullPage: true });
          if (databaseMode) {
            const mapMonth = page.locator('.nr-map-panel').getByRole('combobox', { name: /เดือนตั้งต้น/ });
            await expect(mapMonth).toContainText("ธ.ค. 2568");
            await mapMonth.click();
            await page.getByRole("option", { name: "พ.ย. 2568", exact: true }).click();
            await expect(mapMonth).toContainText("พ.ย. 2568");
            await expect(summary.locator(".metric-card-value")).toHaveText(["0 ตำบล", "48 ตำบล", "69 ตำบล", "172 ตำบล"]);
            await expect(page).toHaveURL(/target=2025-11.*horizon=1/);
            if (name === "mobile") await page.getByRole("button", { name: "แก้ไขตัวกรองข้อมูล" }).click();
            const topMonth = page.locator(name === "mobile" ? ".operational-filter-sheet" : ".operational-filter-fields").getByRole("combobox", { name: name === "mobile" ? "เลือกเดือนตั้งต้น" : /^เดือนตั้งต้น / });
            await expect(topMonth).toContainText("พ.ย. 2568");
            await topMonth.click();
            await page.getByRole("option", { name: "ธ.ค. 2568", exact: true }).click();
            await expect(mapMonth).toContainText("ธ.ค. 2568");
            if (name === "mobile") await page.getByRole("button", { name: "แสดงผล", exact: true }).click();
            await expect(summary.locator(".metric-card-value")).toHaveText(["0 ตำบล", "117 ตำบล", "0 ตำบล", "172 ตำบล"]);
            await expect(page).toHaveURL(/target=2025-12.*horizon=1/);
            await page.locator(".nr-forecast-overview-map").screenshot({ path: path.join(output, `${name}-overview-month-filter.png`) });
            report.checks.push({ viewport: name, overviewMonthSync: "page and map controls update the same selection", forecastHorizon: 1 });
            report.checks.push(await smokeExcelExport({ page, viewport: name, output, archive: expectedArchive }));
          }
        }
        if (route.includes("target=")) {
          await page.locator(".nr-drought-compact-workspace").waitFor();
          assert.match(await page.locator(".nr-drought-workspace-horizon").getByRole("tab", { selected: true }).innerText(), route.includes("horizon=4") ? /4 เดือน/ : /1 เดือน/);
          await expect(page.locator('.nr-forecast-archive-horizon-tabs strong')).toHaveText([1, 2, 3, 4, 5, 6].map(horizon => `${horizon} เดือน`));
          await expect(page.locator('.nr-forecast-horizon-date-break').first()).toHaveCSS('display', name === 'mobile' ? 'inline' : 'none');
          const forecastMonth = route.includes("horizon=4") ? "เม.ย. 2569" : "ม.ค. 2569";
          await expect(page.locator(".nr-drought-workspace-horizon").getByRole("tab", { selected: true }).locator("span")).toHaveText(forecastMonth);
          await expect(page.locator(".nr-drought-workspace-context .is-issue dt")).toHaveText("เดือนตั้งต้น (T)");
          await expect(page.locator(".nr-drought-workspace-context .is-issue strong")).toHaveText("ธ.ค. 2568");
          await expect(page.locator(".nr-drought-workspace-context .is-target dt")).toHaveText("เดือนที่พยากรณ์");
          await expect(page.locator(".nr-drought-workspace-context .is-target strong")).toHaveText(forecastMonth);
          assert.equal(await page.locator(".nr-drought-workspace-details, .nr-forecast-archive-mode-section, .nr-agri-impact-module").count(), 0, `${name}: duplicate or unsupported panels`);
        }
        if (route.startsWith("/drought")) {
          assert.match(await page.locator(".nr-drought-workspace-kpis .is-coverage").innerText(), /117\/289/);
          await expect(page.locator(".nr-forecast-target-note")).toHaveText("เดือนตั้งต้น ธ.ค. 2568 · พยากรณ์ล่วงหน้า 1–6 เดือน: ม.ค. 2569 – มิ.ย. 2569");
        }
        if (databaseMode && (areaCode === "30" && route !== "/?mapLayer=forecast-archive" || areaCode === "3008")) {
          const chart = page.locator(".nr-drought-workspace-chart-card");
          const codes = expectedArchive.locations.filter(location => areaCode === "30" || location.districtCode === areaCode).map(location => location.subdistrictCode);
          const initialUrl = page.url();
          for (const unit of ["percent", "count"]) {
            if (unit === "count") await chart.getByRole("button", { name: "จำนวนตำบล", exact: true }).click();
            await expect(chart.locator("figure")).toHaveAttribute("data-unit", unit);
            const columns = chart.locator(".nr-forecast-point-group");
            await expect(columns).toHaveCount(6);
            for (let h = 0; h < 6; h++) {
              const risks = codes.map(code => expectedArchive.packedRiskByTargetMonth["2025-12"][code][h]);
              const moderate = risks.filter(value => value === 1).length;
              const high = risks.filter(value => value === 2).length;
              const inScope = risks.filter(value => value !== null).length;
              const label = !inScope ? "ไม่มีค่า" : unit === "count" ? String(moderate + high)
                : `${((moderate + high) / inScope * 100).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;
              await expect(columns.nth(h).locator(".nr-drought-forecast-point-label")).toHaveText(label);
              for (const [level, count] of [["moderate", moderate], ["high", high]]) {
                const bar = columns.nth(h).locator(`.nr-drought-forecast-bar.is-${level}`);
                if (count) await expect(bar).toHaveAttribute("data-count", String(count));
                else await expect(bar).toHaveCount(0);
              }
            }
            assert.equal(page.url(), initialUrl, `${name}: chart units preserve selection`);
          }
          await expect(chart.locator(".nr-drought-forecast-graph-threshold, .is-severe")).toHaveCount(0);
          await chart.getByRole("button", { name: "เปอร์เซ็นต์", exact: true }).click();
          if (areaCode === "3008") await page.screenshot({ path: path.join(output, `${name}-district.png`), fullPage: true });
          report.checks.push({ viewport: name, route, graphUnits: ["percent", "count"], sourceCategoriesMatch: true });
        }
        if (route.includes("/t-300806")) {
          const kpis = page.locator(".nr-drought-workspace-kpis");
          assert.equal(await kpis.locator(".metric-card").count(), 1, `${name}: single tambon status`);
          assert.equal(await kpis.locator(".metric-card-value").innerText(), "เสี่ยงสูง");
          assert.equal(await page.locator(".nr-drought-workspace-chart-card, .nr-operational-forecast-summary, .nr-operational-attention-list").count(), 0, `${name}: no population summary or self-links`);
          const frame = await kpis.boundingBox();
          const card = await kpis.locator(".metric-card").boundingBox();
          const map = await page.locator(".nr-drought-workspace-map-card").boundingBox();
          assert.ok(frame && card && map && Math.abs(card.width - frame.width) < 1 && frame.y + frame.height < map.y, `${name}: single status fills row above map`);
          await page.screenshot({ path: path.join(output, `${name}-subdistrict.png`), fullPage: true });
        }
        if (route.startsWith("/ban-lueam")) {
          await page.locator(".nr-forecast-unavailable").waitFor();
          assert.match(await page.locator(".nr-forecast-unavailable").innerText(), /ไม่มีค่าพยากรณ์ให้เปรียบเทียบ/);
          assert.equal(await page.locator(".nr-drought-forecast-bar, .nr-drought-forecast-zero").count(), 0, `${name}: null forecasts are not zero`);
          assert.match(await page.locator(".nr-drought-workspace-kpis .is-coverage").innerText(), /0\/4 ตำบล/);
          assert.match(await page.locator(".nr-drought-workspace-kpis .is-no-risk").getAttribute("class"), /is-muted/);
          assert.equal(await page.locator(".nr-operational-attention-list").count(), 0);
          await page.screenshot({ path: path.join(output, `${name}-unavailable-district.png`), fullPage: true });
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        assert.equal(overflow, false, `${name}: horizontal overflow on ${route}`);
        assert.equal(await page.locator(".app-recovery, .nr-archive-load-state").count(), 0);
        const brokenImages = await page.locator("img").evaluateAll((images) => images.filter((image) => image.getBoundingClientRect().width > 0 && (!image.complete || !image.naturalWidth)).map((image) => new URL(image.src).pathname));
        assert.deepEqual(brokenImages, [], `${name}: visible images`);
        if (route.startsWith("/drought")) await page.screenshot({ path: path.join(output, `${name}-drought.png`), fullPage: true });
        report.checks.push({ viewport: name, route, polygons: 289, forecastScope: areaCode });
      }
      if (databaseMode) {
        for (const [criterion, status, label, color] of [
          ["irrigated", "Irrigation", "เข้าถึงชลประทาน", "rgb(57, 127, 197)"],
          ["rainfed", "RainFed", "พึ่งน้ำฝน (ไม่มีชลประทาน)", "rgb(146, 98, 183)"],
          ["unknown", "Collecting", "ยังไม่มีข้อมูลชลประทาน", "rgb(135, 147, 158)"],
        ]) {
          const route = `${criterion === "unknown" ? "/" : "/drought"}?mapLayer=forecast-archive&target=2025-12&horizon=1`;
          await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded" });
          await page.locator('.nr-map-shape').first().waitFor();
          const select = page.locator(".nr-map-panel .nr-irrigation-filter").getByRole("combobox");
          await expect(select).toBeVisible();
          const mapFrame = await page.locator('.nr-dashboard-map-card').boundingBox();
          const initialUrl = page.url();
          const initialHistoryLength = await page.evaluate(() => history.length);
          await select.click();
          await page.getByRole("option", { name: label, exact: true }).click();
          assert.equal(page.url(), initialUrl, `${name}: selecting ${criterion} must not change URL`);
          assert.equal(await page.evaluate(() => history.length), initialHistoryLength);
          await page.locator(".nr-map-panel .nr-local-map-filter-status").waitFor();
          const codes = expectedArchive.locations.filter(location => location.irrigationStatus === status).map(location => location.subdistrictCode).sort();
          const shapes = page.locator(".nr-map-shape:not(.is-criteria-filtered)");
          await expect(shapes).toHaveCount(codes.length);
          const filteredFrame = await page.locator('.nr-dashboard-map-card').boundingBox();
          assert.ok(Math.abs(filteredFrame.width - mapFrame.width) < 1 && Math.abs(filteredFrame.height - mapFrame.height) < 1, `${name}: irrigation preserves the map frame`);
          assert.deepEqual(await shapes.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-nr-subdistrict-code")).sort()), codes, `${name}: ${criterion} matches source locations`);
          await expect.poll(() => shapes.evaluateAll((nodes, expected) => nodes.every(node => getComputedStyle(node).fill === expected), color)).toBe(true);
          const high = codes.filter(code => expectedArchive.packedRiskByTargetMonth["2025-12"][code][0] === 2).length;
          const highCard = criterion === "unknown"
            ? page.locator(".nr-forecast-overview-summary .metric-card").filter({ hasText: "เสี่ยงสูง" })
            : page.locator(".nr-drought-workspace-kpis .is-high");
          await expect(highCard).toContainText(`${high} ตำบล`);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}: irrigation overflow`);
          await page.screenshot({ path: path.join(output, `${name}-irrigation-${criterion}.png`), fullPage: true });
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.locator('.nr-map-shape').first().waitFor();
          await expect(select).toContainText(label);
          await expect(shapes).toHaveCount(codes.length);
          report.checks.push({ viewport: name, irrigation: criterion, matched: codes.length, highRisk: high, sourceMatch: true, categoricalColor: color, unchangedUrl: true, reloadPreserved: true });
        }
        for (const [scope, route, count] of [
          ['overview-district', '/?mapLayer=forecast-archive&target=2025-12&horizon=1&district=3003', 6],
          ['district', '/soeng-sang?mapLayer=forecast-archive&target=2025-12&horizon=4', 6],
          ['subdistrict', '/dan-khun-thot/t-300803?mapLayer=forecast-archive&target=2025-12&horizon=4', 1],
        ]) {
          await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded' });
          await page.locator('.nr-map-shape').first().waitFor();
          const shapes = page.locator('.nr-map-shape:not(.is-criteria-filtered)');
          await expect(shapes).toHaveCount(count);
          const map = page.locator('.nr-dashboard-map-card');
          const original = await map.boundingBox();
          const emptyUrl = page.url();
          await map.locator('.nr-irrigation-filter').getByRole('combobox').click();
          await page.getByRole('option', { name: 'เข้าถึงชลประทาน', exact: true }).click();
          await page.locator('.nr-irrigation-empty').waitFor();
          await expect(shapes).toHaveCount(0);
          await expect(page.locator('.nr-drought-workspace-kpis .metric-card, .nr-drought-workspace-chart-card')).toHaveCount(0);
          const filtered = await map.boundingBox();
          assert.ok(Math.abs(filtered.width - original.width) < 1 && Math.abs(filtered.height - original.height) < 1, `${name}: empty ${scope} preserves map dimensions`);
          assert.equal(await page.evaluate(() => document.fullscreenElement), null);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
          await map.scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(output, `${name}-empty-irrigation-${scope}.png`) });
          await page.getByRole('button', { name: 'แสดงทุกสถานะชลประทาน', exact: true }).click();
          await expect(shapes).toHaveCount(count);
          if (scope === 'district') await expect(page.locator('.nr-drought-workspace-chart-card')).toBeVisible();
          if (scope === 'subdistrict') await expect(page.locator('.nr-drought-workspace-kpis')).toContainText('เสี่ยงปานกลาง');
          assert.equal(page.url(), emptyUrl);
          report.checks.push({ viewport: name, scope, irrigationEmptyReset: true, stableMapFrame: true });
        }
        await page.getByRole("button", { name: "รายการที่บันทึก", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor();
        await dialog.getByText("กำลังโหลดรายการ...", { exact: true }).waitFor({ state: "hidden" });
        assert.equal(await dialog.getByRole("alert").count(), 0, "Saved workspace read");
        await expect(dialog.locator(".nr-saved-header")).toBeInViewport();
        await dialog.getByRole("tab", { name: "พื้นที่ติดตาม", exact: true }).focus();
        await page.keyboard.press("ArrowRight");
        await expect(dialog.getByRole("tab", { name: "ตัวกรองที่บันทึก", exact: true })).toBeFocused();
        await expect(dialog.getByRole("status")).toBeEmpty();
        if (process.env.SMOKE_SAVED_FILTER_NAME) await dialog.getByRole("button", { name: new RegExp(`^${process.env.SMOKE_SAVED_FILTER_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} `) }).waitFor();
        await page.screenshot({ path: path.join(output, `${name}-saved-filters.png`), fullPage: true });
        await dialog.getByRole("button", { name: "ปิดรายการที่บันทึก" }).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole("button", { name: "รายการที่บันทึก", exact: true })).toBeFocused();
        await Promise.all(rpcChecks);
        assert.ok(rpcHorizons.has(1) && rpcHorizons.has(6), "App must load both authenticated database projections");
        report.checks.push({ viewport: name, databaseProjectionsMatch: true, savedWorkspaceRead: true, staticFallback: false });
      }
      assert.equal(operationalReads, 0, "Forecast routes must not depend on the parked Actual API");
      await Promise.all(assetChecks);
      assert.deepEqual(errors, [], `${name}: browser errors`);
      await page.getByRole("button", { name: /บัญชีผู้ใช้/ }).click();
      assert.equal(await page.getByRole("menuitem").count(), 1, `${name}: no demo account actions`);
      await page.getByRole("menuitem", { name: "ออกจากระบบ", exact: true }).click();
      await page.getByLabel("อีเมล", { exact: true }).waitFor();
      assert.equal(await page.getByRole("alert").count(), 0, "Logout should complete without an auth error");
    } catch (error) {
      await Promise.all(rpcChecks);
      if (errors.length) error.message += `\nObserved browser failures: ${errors.join('; ')}`;
      await page.screenshot({ path: path.join(output, `${name}-failure.png`),
        mask: [page.locator('input[type="password"], #login-email, #login-password')] }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} catch (error) {
  let message = error.message;
  for (const secret of [password, email, protectionCookie].filter(Boolean)) message = message.replaceAll(secret, "[redacted]");
  report.failures.push(message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
