import { spawn } from "node:child_process";
import {
  assertLocalPortAvailable,
  assertURLReachable,
  isPermissionError,
  printAttachedServerHelp,
  printSandboxHelp,
} from "./local-runtime.mjs";

const args = process.argv.slice(2);
const attached = args.includes("--attached");
const managed = args.includes("--managed");
const playwrightArgs = args.filter((arg) => arg !== "--attached" && arg !== "--managed");
const lifecycle = process.env.npm_lifecycle_event ?? "test:e2e";
const forwardedCommand = `npm run ${lifecycle}${
  playwrightArgs.length ? ` -- ${playwrightArgs.join(" ")}` : ""
}`;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";

try {
  await assertLocalPortAvailable();
} catch (error) {
  if (isPermissionError(error)) {
    printSandboxHelp({ command: forwardedCommand, task: "run Playwright/Chromium" });
    process.exit(1);
  }

  throw error;
}

if (attached) {
  try {
    await assertURLReachable(baseURL);
  } catch {
    printAttachedServerHelp({ baseURL });
    process.exit(1);
  }
}

const env = { ...process.env };
if (attached) env.PLAYWRIGHT_SKIP_WEB_SERVER = "1";
if (managed) env.PLAYWRIGHT_START_WEB_SERVER = "1";

const child = spawn(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...playwrightArgs],
  { env, stdio: "inherit" },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
