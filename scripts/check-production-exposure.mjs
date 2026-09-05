import fs from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve(process.env.BUILD_OUT_DIR ?? "dist");
const blockedPatterns = [
  { label: "source map reference", pattern: /sourceMappingURL/ },
  { label: "source path", pattern: /src\/data\/canonical|src\/domain|src\/store/ },
  { label: "demo password literal", pattern: /demo123|(?:^|[,{])\s*["']?password["']?\s*:\s*["'][^"']+/i },
  { label: "unprotected fusion formula", pattern: /Hazard x Exposure|Crop-stage sensitivity/ },
];

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

const files = await readDirectoryFiles(distDir);
const sourceMaps = files.filter((file) => file.endsWith(".map"));
const jsFiles = files.filter((file) => file.endsWith(".js"));
const failures = [];

if (sourceMaps.length > 0) {
  failures.push(`Unexpected source maps: ${sourceMaps.map((file) => path.relative(distDir, file)).join(", ")}`);
}

for (const file of jsFiles) {
  const text = await fs.readFile(file, "utf8");
  for (const blocked of blockedPatterns) {
    if (blocked.pattern.test(text)) {
      failures.push(`${path.relative(distDir, file)} contains ${blocked.label}`);
    }
  }
}

if (failures.length > 0) {
  console.error("[check-production-exposure] Failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `[check-production-exposure] OK: ${jsFiles.length} JS asset${jsFiles.length === 1 ? "" : "s"}, no source maps, no blocked literals.`,
);
