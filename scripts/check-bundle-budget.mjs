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
const workerFiles = [...sources.keys()].filter(file => /^forecastExcelWorker-[\w-]+\.js$/.test(file));
const workerGraph = new Set();
const workerReferences = new Set();
const syntaxTrees = new Map();
function syntaxTree(file) {
  if (!syntaxTrees.has(file)) syntaxTrees.set(file, ts.createSourceFile(file, sources.get(file).toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS));
  return syntaxTrees.get(file);
}
function followWorker(file) {
  if (workerGraph.has(file)) return;
  if (!sources.has(file)) throw new Error(`Missing Excel worker dependency: ${file}`);
  workerGraph.add(file);
  for (const node of syntaxTree(file).statements) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const target = node.moduleSpecifier.text;
      if (target.startsWith('.') || target.startsWith('/assets/')) followWorker(path.basename(target));
    }
  }
}
for (const file of workerFiles) followWorker(file);
function checkChunk(file, initial = false) {
  const source = sources.get(file);
  if (!source) throw new Error(`Missing referenced JavaScript chunk: ${file}`);
  if (initial && startup.has(file)) return;
  if (initial) startup.add(file);
  const ast = syntaxTree(file);
  for (const node of ast.statements) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const target = node.moduleSpecifier.text;
      if (target.startsWith(".") || target.startsWith("/assets/")) {
        const dependency = path.basename(target);
        if (!workerGraph.has(file) && (/^forecastExcel(?:Writer|Job|Worker)-[\w-]+\.js$/.test(dependency) || workerGraph.has(dependency))) throw new Error('Excel generation must remain a user-action-only dynamic import with an isolated worker.');
        if (!sources.has(dependency)) throw new Error(`Broken chunk reference: ${file} -> ${target}`);
        if (initial) checkChunk(dependency, true);
      }
    }
  }
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const target = node.text;
      // Protect-build renames worker assets as well as entry chunks. Verify the
      // URL literal in the on-demand client still points to an emitted asset.
      if (/^(?:\.\.?\/|\/assets\/).*forecastExcelWorker-[\w-]+\.js$/.test(target)) {
        const dependency = path.basename(target);
        if (!sources.has(dependency)) throw new Error(`Broken Excel worker URL: ${file} -> ${target}`);
        workerReferences.add(dependency);
        if (initial) throw new Error('Excel worker must not be constructed by a startup chunk.');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
for (const file of sources.keys()) checkChunk(file);
for (const file of initialFiles) checkChunk(file, true);
const startupGzipBytes = [...startup].reduce((sum, file) => sum + gzipSync(sources.get(file)).length, 0);
if (!startup.size || startupGzipBytes > 125_000) throw new Error(`Login startup JavaScript exceeds 125000 gzip bytes: ${startupGzipBytes}`);
console.log(`[bundle-budget] Login startup: ${startupGzipBytes} gzip bytes; chunk imports resolve.`);
// Supabase 2.115 adds ~100 kB gzip after protection; retain the original app budget.
const authChunks = [...sources.entries()].filter(([file]) => /^supabaseClient-[\w-]+\.js$/.test(file));
const authGzipBytes = authChunks.reduce((sum, [, source]) => sum + gzipSync(source).length, 0);
if (authChunks.length > 1 || authGzipBytes > 105_000) throw new Error(`Supabase SDK exceeds 105000 gzip bytes: ${authGzipBytes}`);
// Native XLSX charts/pivots are loaded only after Download, never on page load.
if (workerFiles.length !== 1 || workerReferences.size !== 1 || !workerReferences.has(workerFiles[0])) throw new Error('Expected one referenced, on-demand Excel worker asset.');
if ([...sources.keys()].some(file => /^forecastExcelWriter-[\w-]+\.js$/.test(file) && !workerGraph.has(file))) throw new Error('Excel writer was emitted outside its worker.');
const exportChunks = [...sources.entries()].filter(([file]) => workerGraph.has(file));
const exportBytes = exportChunks.reduce((sum, [, source]) => sum + source.length, 0);
const exportGzipBytes = exportChunks.reduce((sum, [, source]) => sum + gzipSync(source).length, 0);
// The portable XML parser and bilingual workbook dictionary live only here.
// Measured protected worker: ~2.49 MB raw / 662 kB gzip; main budgets stay fixed.
if (exportBytes > 2_650_000 || exportGzipBytes > 700_000) throw new Error(`Excel export worker exceeds its isolated budget: ${exportBytes} / ${exportGzipBytes}`);
if (!jsBytes || jsBytes - exportBytes > 3_500_000 || jsGzipBytes - authGzipBytes - exportGzipBytes > 370_000) {
  throw new Error(`Application JavaScript budget exceeded: ${jsBytes - exportBytes} bytes / ${jsGzipBytes - authGzipBytes - exportGzipBytes} app gzip bytes (limits 3500000 / 370000 plus bounded SDK).`);
}
console.log(`[bundle-budget] Supabase SDK: ${authGzipBytes} gzip bytes; Excel on demand: ${exportGzipBytes}; application: ${jsGzipBytes - authGzipBytes - exportGzipBytes} gzip bytes.`);
const archiveAsset = assets.find((name) => /^drought_forecast_archive_rev03-[\w-]+\.json$/.test(name));
let databaseBuild = false;
try { databaseBuild = JSON.parse(await fs.readFile(path.join(distDir, "data-backend.json"), "utf8")).backend === "supabase"; }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (databaseBuild) {
  if (archiveAsset || assets.some((name) => /^forecast-overview-t1-.*\.json$/.test(name))) throw new Error("Database build must not expose static forecast archives.");
  console.log("[bundle-budget] Database provider: no static forecast archive assets emitted.");
} else {
  if (!archiveAsset) throw new Error("Missing separate, content-hashed forecast archive asset.");
  const source = await fs.readFile("src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json");
  const emitted = await fs.readFile(path.join(assetsDir, archiveAsset));
  if (!emitted.equals(source)) throw new Error("Emitted forecast archive differs from canonical source.");
  console.log("[bundle-budget] Static provider: archive matches canonical bytes.");
}
console.log(`[bundle-budget] OK: JavaScript ${jsBytes} bytes / ${jsGzipBytes} gzip bytes.`);
