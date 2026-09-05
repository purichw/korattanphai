import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import ts from "typescript";
import { JSDOM } from "jsdom";

const distDir = path.resolve(process.env.BUILD_OUT_DIR ?? "dist");
const assetsDir = path.join(distDir, "assets");
const assets = await fs.readdir(assetsDir);
let jsBytes = 0;
let jsGzipBytes = 0;
const sources = new Map();
for (const file of assets.filter((name) => name.endsWith(".js"))) {
  const content = await fs.readFile(path.join(assetsDir, file));
  jsBytes += content.length;
  jsGzipBytes += gzipSync(content).length;
  sources.set(file, content);
}
const document = new JSDOM(await fs.readFile(path.join(distDir, "index.html"), "utf8")).window.document;
const initialFiles = [...document.querySelectorAll('script[type="module"][src], link[rel="modulepreload"][href]')]
  .map((element) => path.basename(element.getAttribute("src") ?? element.getAttribute("href")));
const startup = new Set();
function checkChunk(file, initial = false) {
  const source = sources.get(file);
  if (!source) throw new Error(`Missing referenced JavaScript chunk: ${file}`);
  if (initial && startup.has(file)) return;
  if (initial) startup.add(file);
  const ast = ts.createSourceFile(file, source.toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  for (const node of ast.statements) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const target = node.moduleSpecifier.text;
      if (target.startsWith(".") || target.startsWith("/assets/")) {
        const dependency = path.basename(target);
        if (!sources.has(dependency)) throw new Error(`Broken chunk reference: ${file} -> ${target}`);
        if (initial) checkChunk(dependency, true);
      }
    }
  }
}
for (const file of sources.keys()) checkChunk(file);
for (const file of initialFiles) checkChunk(file, true);
const startupGzipBytes = [...startup].reduce((sum, file) => sum + gzipSync(sources.get(file)).length, 0);
if (!startup.size || startupGzipBytes > 125_000) throw new Error(`Login startup JavaScript exceeds 125000 gzip bytes: ${startupGzipBytes}`);
console.log(`[bundle-budget] Login startup: ${startupGzipBytes} gzip bytes; chunk imports resolve.`);
if (!jsBytes || jsBytes > 3_500_000 || jsGzipBytes > 370_000) {
  throw new Error(`JavaScript budget exceeded: ${jsBytes} bytes / ${jsGzipBytes} gzip bytes (limits 3500000 / 370000).`);
}
const archiveAsset = assets.find((name) => /^drought_forecast_archive_rev02-[\w-]+\.json$/.test(name));
if (!archiveAsset) throw new Error("Missing separate, content-hashed forecast archive asset.");
const source = await fs.readFile("src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev02.json");
const emitted = await fs.readFile(path.join(assetsDir, archiveAsset));
if (!emitted.equals(source)) throw new Error("Emitted forecast archive differs from canonical source.");
console.log(`[bundle-budget] OK: JavaScript ${jsBytes} bytes / ${jsGzipBytes} gzip bytes; separate archive matches canonical bytes.`);
