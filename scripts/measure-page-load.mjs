import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";
import { preview } from "vite";

const label = process.argv[2] ?? "current";
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error("Use an alphanumeric measurement label.");
const outputDir = process.env.NFR_OUTPUT_DIR ?? "/tmp";
const distDir = path.resolve(process.env.NFR_DIST_DIR ?? "dist");
const isolateFonts = process.env.NFR_ISOLATE_FONTS === "1";
const mobileNetwork = process.env.NFR_MOBILE_NETWORK === "1";
const gzipAssets = new Map();
if (mobileNetwork) {
  for (const name of await fs.readdir(distDir, { recursive: true })) {
    if (!/\.(js|css|json|geojson)$/.test(name)) continue;
    gzipAssets.set(`/${name}`, gzipSync(await fs.readFile(path.join(distDir, name))));
  }
}
const server = await preview({
  build: { outDir: distDir }, preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  plugins: [{
    name: "measurement-gzip",
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url, "http://localhost").pathname;
        const asset = gzipAssets.get(pathname);
        if (!asset || !request.headers["accept-encoding"]?.includes("gzip")) return next();
        response.setHeader("Content-Encoding", "gzip");
        response.setHeader("Vary", "Accept-Encoding");
        response.setHeader("Content-Type", pathname.endsWith(".js") ? "text/javascript" : pathname.endsWith(".css") ? "text/css" : "application/json");
        response.setHeader("Content-Length", asset.length);
        response.end(asset);
      });
    },
  }],
});
let browser;
try {
  browser = await chromium.launch();
  const samples = [];
  for (const route of ["/login", "/", "/drought?target=2025-12&horizon=1"]) {
    for (let run = 0; run < 3; run += 1) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
      if (isolateFonts) await context.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ contentType: "text/css", body: "" }));
      await context.addInitScript(() => {
        localStorage.setItem("korat-tan-phai-login-user", "pointy");
        if (location.pathname === "/login") localStorage.removeItem("korat-tan-phai-login-user");
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.enable");
      await cdp.send("Performance.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      if (mobileNetwork) await cdp.send("Network.emulateNetworkConditions", {
        offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, connectionType: "cellular4g",
      });
      await page.goto(`http://127.0.0.1:4173${route}`, { waitUntil: "domcontentloaded" });
      if (route === "/login") await page.getByRole("heading", { name: "เข้าสู่ระบบ" }).waitFor();
      else await page.locator(".nr-map-shape").first().waitFor({ timeout: 120_000 });
      const timing = await page.evaluate(() => ({
        readyMs: performance.now(),
        domInteractiveMs: performance.getEntriesByType("navigation")[0].domInteractive,
        resources: performance.getEntriesByType("resource").map((entry) => ({
          name: new URL(entry.name).pathname,
          bytes: entry.decodedBodySize,
          encodedBytes: entry.encodedBodySize,
          startMs: entry.startTime,
          durationMs: entry.duration,
        })),
      }));
      const { metrics } = await cdp.send("Performance.getMetrics");
      const cpu = Object.fromEntries(metrics.filter(({ name }) => ["ScriptDuration", "TaskDuration", "LayoutDuration", "RecalcStyleDuration"].includes(name)).map(({ name, value }) => [name, value]));
      samples.push({ route, run, ...timing, cpu, errors });
      if (run === 0 && route.startsWith("/drought")) {
        await page.screenshot({ path: path.join(outputDir, `korattanphai-nfr-${label}-mobile.png`), fullPage: true });
      }
      await context.close();
    }
  }
  const assets = [];
  for (const name of await fs.readdir(path.join(distDir, "assets"))) {
    if (!/\.(js|json)$/.test(name)) continue;
    const data = await fs.readFile(path.join(distDir, "assets", name));
    assets.push({ name, bytes: data.length, gzipBytes: gzipSync(data).length });
  }
  const result = { label, distDir, isolateFonts, conditions: `Chromium, 390x844, CPU 4x, cold browser cache; ${mobileNetwork ? "simulated 1.6 Mbps down / 0.75 Mbps up, 150ms latency; gzip JS/CSS/JSON/GeoJSON" : "localhost network (not simulated mobile bandwidth)"}`, assets, samples };
  await fs.writeFile(path.join(outputDir, `korattanphai-nfr-${label}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ assets, samples: samples.map(({ route, readyMs, errors }) => ({ route, readyMs: Math.round(readyMs), errors })) }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
