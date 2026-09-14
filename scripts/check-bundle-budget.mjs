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
// Bound user-action map tools separately without relaxing login/application limits.
const toolRoots = ['mapImageExport', 'ForecastAnalysisDialog', 'mapPoint'].map(name => {
  const matches = [...sources.keys()].filter(file => new RegExp(`^${name}-[\\w-]+\\.js$`).test(file));
  if (matches.length !== 1) throw new Error(`Expected one lazy ${name} chunk.`);
  return matches[0];
});
const eagerProduct = new Set(startup);
function followEager(file) {
  if (eagerProduct.has(file)) return;
  eagerProduct.add(file);
  for (const node of syntaxTree(file).statements) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const dependency = path.basename(node.moduleSpecifier.text);
      if (sources.has(dependency)) followEager(dependency);
    }
  }
}
for (const file of sources.keys()) if (/^AuthenticatedApp-[\w-]+\.js$/.test(file)) followEager(file);
if (toolRoots.some(file => eagerProduct.has(file))) throw new Error('Map tools must remain user-action-only dynamic imports.');
const toolGraph = new Set();
function followTool(file, graph = toolGraph) {
  if (graph.has(file) || eagerProduct.has(file) || workerGraph.has(file)) return;
  graph.add(file);
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const dependency = path.basename(node.text);
      if (sources.has(dependency)) followTool(dependency, graph);
    }
    ts.forEachChild(node, visit);
  }
  visit(syntaxTree(file));
}
toolRoots.forEach(file => followTool(file));
// Search loads only after its dialog opens; keep the existing core/map limits.
const searchRoot = [...sources.keys()].filter(file => /^WorkspaceSearchContent-[\w-]+\.js$/.test(file));
if (searchRoot.length !== 1 || eagerProduct.has(searchRoot[0])) throw new Error('Expected one user-action-only search chunk.');
const searchGraph = new Set();
followTool(searchRoot[0], searchGraph);
for (const file of toolGraph) searchGraph.delete(file);
const searchBytes = [...searchGraph].reduce((sum, file) => sum + sources.get(file).length, 0);
const searchGzipBytes = [...searchGraph].reduce((sum, file) => sum + gzipSync(sources.get(file)).length, 0);
if (searchBytes > 100_000 || searchGzipBytes > 25_000) throw new Error(`Lazy search exceeds 100000 / 25000 bytes: ${searchBytes} / ${searchGzipBytes}`);
console.log(`[bundle-budget] Search on demand: ${searchBytes} bytes / ${searchGzipBytes} gzip bytes; no eager imports.`);
for (const file of sources.keys()) {
  if (toolGraph.has(file) || searchGraph.has(file)) continue;
  for (const node of syntaxTree(file).statements) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
      && (toolGraph.has(path.basename(node.moduleSpecifier.text)) || searchGraph.has(path.basename(node.moduleSpecifier.text)))) throw new Error(`Eager import of on-demand tool dependency in ${file}.`);
  }
}
const toolBytes = [...toolGraph].reduce((sum, file) => sum + sources.get(file).length, 0);
const toolGzipBytes = [...toolGraph].reduce((sum, file) => sum + gzipSync(sources.get(file)).length, 0);
// Protected jsPDF/optional renderers, ZIP, analysis and Turf: ~1.73 MB / 461 kB.
if (toolBytes > 1_850_000 || toolGzipBytes > 480_000) throw new Error(`Lazy map tools exceed 1850000 / 480000 bytes: ${toolBytes} / ${toolGzipBytes}`);
console.log(`[bundle-budget] Map tools on demand: ${toolBytes} bytes / ${toolGzipBytes} gzip bytes; no eager imports.`);
const startupGzipBytes = [...startup].reduce((sum, file) => sum + gzipSync(sources.get(file)).length, 0);
if (!startup.size || startupGzipBytes > 125_000) throw new Error(`Login startup JavaScript exceeds 125000 gzip bytes: ${startupGzipBytes}`);
console.log(`[bundle-budget] Login startup: ${startupGzipBytes} gzip bytes; chunk imports resolve.`);
// CI exercises opt-in telemetry; production keeps it disabled. Bound its lazy
// third-party SDK independently, while its application wiring stays in core.
const telemetryFiles = [...sources.keys()].filter(file => /^(?:web-vitals|web)-[\w-]+\.js$/.test(file));
if (telemetryFiles.length > 1 || telemetryFiles.some(file => eagerProduct.has(file) || toolGraph.has(file))) throw new Error('Expected at most one deferred telemetry SDK.');
for (const file of sources.keys()) {
  for (const node of syntaxTree(file).statements) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
      && telemetryFiles.includes(path.basename(node.moduleSpecifier.text))) throw new Error(`Telemetry SDK must not be statically imported by ${file}.`);
  }
}
const telemetryBytes = telemetryFiles.reduce((sum, file) => sum + sources.get(file).length, 0);
const telemetryGzipBytes = telemetryFiles.reduce((sum, file) => sum + gzipSync(sources.get(file)).length, 0);
if (telemetryBytes > 20_000 || telemetryGzipBytes > 6_000) throw new Error(`Optional telemetry SDK exceeds 20000 / 6000 bytes: ${telemetryBytes} / ${telemetryGzipBytes}`);
console.log(`[bundle-budget] Optional telemetry SDK: ${telemetryGzipBytes} gzip bytes; not in startup.`);
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
if (!jsBytes || jsBytes - exportBytes - toolBytes - telemetryBytes - searchBytes > 3_500_000 || jsGzipBytes - authGzipBytes - exportGzipBytes - toolGzipBytes - telemetryGzipBytes - searchGzipBytes > 370_000) {
  throw new Error(`Application JavaScript budget exceeded: ${jsBytes - exportBytes - toolBytes - telemetryBytes - searchBytes} bytes / ${jsGzipBytes - authGzipBytes - exportGzipBytes - toolGzipBytes - telemetryGzipBytes - searchGzipBytes} app gzip bytes (limits 3500000 / 370000 plus bounded SDKs).`);
}
console.log(`[bundle-budget] Supabase SDK: ${authGzipBytes} gzip bytes; Excel on demand: ${exportGzipBytes}; application: ${jsGzipBytes - authGzipBytes - exportGzipBytes - toolGzipBytes - telemetryGzipBytes - searchGzipBytes} gzip bytes.`);
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
