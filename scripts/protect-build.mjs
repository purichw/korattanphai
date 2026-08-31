import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import JavaScriptObfuscator from "javascript-obfuscator";

const distDir = path.resolve(process.cwd(), "dist");
const assetsDir = path.join(distDir, "assets");

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: "hexadecimal",
  numbersToExpressions: false,
  renameGlobals: false,
  seed: 8272026,
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayCallsTransform: false,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 0.22,
  target: "browser",
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
};

async function readDirectoryFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return readDirectoryFiles(fullPath);
      if (!entry.isFile()) return [];
      return [fullPath];
    }),
  );
  return files.flat();
}

function contentHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function protectedAssetName(fileName, code) {
  const parsed = path.parse(fileName);
  const base = parsed.name.replace(/-[a-zA-Z0-9_-]{8,}$/, "");
  return `${base}-${contentHash(code)}${parsed.ext}`;
}

function formatBytes(value) {
  return `${(value / 1024).toFixed(1)} kB`;
}

const jsFiles = (await fs.readdir(assetsDir)).filter((file) => file.endsWith(".js"));

if (jsFiles.length === 0) {
  throw new Error("[protect-build] No JavaScript assets found in dist/assets.");
}

const renamedAssets = new Map();

for (const fileName of jsFiles) {
  const filePath = path.join(assetsDir, fileName);
  const input = await fs.readFile(filePath, "utf8");
  const output = JavaScriptObfuscator.obfuscate(input, obfuscatorOptions).getObfuscatedCode();
  const nextName = protectedAssetName(fileName, output);
  const nextPath = path.join(assetsDir, nextName);

  await fs.writeFile(nextPath, output, "utf8");
  if (nextName !== fileName) {
    await fs.unlink(filePath);
  }
  renamedAssets.set(fileName, nextName);

  console.log(
    `[protect-build] ${fileName} -> ${nextName} (${formatBytes(input.length)} raw, ${formatBytes(gzipSync(output).length)} gzip)`,
  );
}

const textFiles = (await readDirectoryFiles(distDir)).filter((file) =>
  /\.(css|html|js|json|svg|webmanifest)$/.test(file),
);

for (const filePath of textFiles) {
  let text = await fs.readFile(filePath, "utf8");
  let changed = false;
  for (const [from, to] of renamedAssets) {
    if (text.includes(from)) {
      text = text.split(from).join(to);
      changed = true;
    }
  }
  if (changed) {
    await fs.writeFile(filePath, text, "utf8");
  }
}

console.log(`[protect-build] Protected ${jsFiles.length} JavaScript asset${jsFiles.length === 1 ? "" : "s"}.`);
