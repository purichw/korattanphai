import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = new URL(process.env.SMOKE_URL ?? "https://korattanphai.vercel.app");
const local = ["localhost", "127.0.0.1"].includes(base.hostname);
if (!(local || (base.protocol === "https:" && /^korattanphai(?:-[a-z0-9-]+)?\.vercel\.app$/.test(base.hostname))) || base.username || base.password) {
  throw new Error("SMOKE_URL must be this project's Vercel deployment or localhost.");
}
const output = path.resolve(process.env.SMOKE_OUTPUT_DIR ?? "smoke-results");
await fs.mkdir(output, { recursive: true });
const report = { url: base.origin, at: new Date().toISOString(), api: local ? "skipped: Vite preview has no serverless API" : "pending", checks: [], failures: [] };
let browser;
try {
  if (!local) {
    const response = await fetch(new URL("/api/risk-fusion?eventId=ARE-2026-0825-NE", base), { signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200, "API status");
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const body = await response.json();
    assert.equal(body.id, "fusion-ARE-2026-0825-NE");
    assert.equal(body.components.length, 6);
    assert.ok(!JSON.stringify(body).match(/thaiwater|thai-water|thai_water/i), "retired provider remains absent");
    report.api = "passed";
  }
  browser = await chromium.launch();
  for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 960 }, mobile: { width: 390, height: 844 } })) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const errors = [];
    const assetChecks = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).origin === base.origin && request.failure()?.errorText !== "net::ERR_ABORTED") errors.push(`Request failed: ${new URL(request.url()).pathname}`);
    });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin !== base.origin) return;
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
      // Existing front-end demo account; no server-side authentication or writes.
      await page.getByLabel("ชื่อผู้ใช้").fill("pointy");
      await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
      await page.locator(".nr-forecast-overview-summary").waitFor();
      for (const route of ["/", "/drought?target=2025-12&horizon=1", "/dan-khun-thot?target=2025-12&horizon=4", "/dan-khun-thot/t-300806?target=2025-12&horizon=4"]) {
        await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded" });
        await page.locator(".nr-map-shape").first().waitFor();
        assert.equal(await page.locator(".nr-map-shape").count(), 289, `${name}: polygon count`);
        if (route === "/") {
          const summary = page.locator(".nr-forecast-overview-summary");
          await summary.waitFor();
          assert.deepEqual(await summary.locator(".metric-card-value").allTextContents(), ["13 ตำบล", "129 ตำบล", "0 ตำบล", "147 ตำบล"], `${name}: latest T+1 forecast counts`);
          assert.equal(new URL(page.url()).searchParams.get("target"), "2025-12");
          assert.equal(new URL(page.url()).searchParams.get("horizon"), "1");
          await page.screenshot({ path: path.join(output, `${name}-overview.png`), fullPage: true });
        }
        if (route.includes("target=")) {
          await page.locator(".nr-drought-compact-workspace").waitFor();
          assert.match(await page.locator(".nr-drought-workspace-horizon").getByRole("tab", { selected: true }).innerText(), route.includes("horizon=4") ? /T\+4/ : /T\+1/);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        assert.equal(overflow, false, `${name}: horizontal overflow on ${route}`);
        assert.equal(await page.locator(".app-recovery, .nr-archive-load-state").count(), 0);
        const brokenImages = await page.locator("img").evaluateAll((images) => images.filter((image) => image.getBoundingClientRect().width > 0 && (!image.complete || !image.naturalWidth)).map((image) => new URL(image.src).pathname));
        assert.deepEqual(brokenImages, [], `${name}: visible images`);
        if (route.startsWith("/drought")) await page.screenshot({ path: path.join(output, `${name}-drought.png`), fullPage: true });
        report.checks.push({ viewport: name, route, polygons: 289 });
      }
      await Promise.all(assetChecks);
      assert.deepEqual(errors, [], `${name}: browser errors`);
    } finally { await context.close(); }
  }
} catch (error) {
  report.failures.push(error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
