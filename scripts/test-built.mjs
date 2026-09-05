import { spawn } from "node:child_process";
import { preview } from "vite";

const baseURL = "http://127.0.0.1:4174";
const server = await preview({ build: { outDir: process.env.BUILD_OUT_DIR ?? "dist" }, preview: { host: "127.0.0.1", port: 4174, strictPort: true } });
try {
  const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--workers=2", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL, PLAYWRIGHT_SKIP_WEB_SERVER: "1" },
  });
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
