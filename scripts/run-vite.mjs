import { spawn } from "node:child_process";
import {
  assertLocalPortAvailable,
  isPermissionError,
  isPortInUseError,
  printSandboxHelp,
  readOption,
} from "./local-runtime.mjs";

const [mode = "dev", ...args] = process.argv.slice(2);
const lifecycle = process.env.npm_lifecycle_event ?? (mode === "preview" ? "preview" : "dev");
const host = readOption(args, "--host") ?? "127.0.0.1";
const defaultPort = mode === "preview" ? 4173 : 5173;
const port = Number(readOption(args, "--port") ?? defaultPort);
const forwardedCommand = `npm run ${lifecycle}${args.length ? ` -- ${args.join(" ")}` : ""}`;

try {
  await assertLocalPortAvailable({ host, port });
} catch (error) {
  if (isPermissionError(error)) {
    printSandboxHelp({ command: forwardedCommand, task: "start the Vite dev server" });
    process.exit(1);
  }

  if (isPortInUseError(error)) {
    console.error("");
    console.error(`Cannot start Vite because ${host}:${port} is already in use.`);
    console.error("If this is the E2E server you already started, keep it running and use:");
    console.error("");
    console.error("  npm run test:e2e:attached");
    console.error("");
    process.exit(1);
  }

  throw error;
}

const viteArgs = mode === "preview" ? ["preview", ...args] : args;
const child = spawn("vite", viteArgs, { stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
