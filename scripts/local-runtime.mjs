import net from "node:net";
import http from "node:http";
import https from "node:https";

export function readOption(args, name) {
  const equalsPrefix = `${name}=`;
  const equalsValue = args.find((arg) => arg.startsWith(equalsPrefix));
  if (equalsValue) return equalsValue.slice(equalsPrefix.length);

  const index = args.indexOf(name);
  if (index === -1) return undefined;

  const value = args[index + 1];
  return value && !value.startsWith("-") ? value : "true";
}

export async function assertLocalPortAvailable({ host = "127.0.0.1", port = 0 } = {}) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host, port }, () => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });
}

export function isPermissionError(error) {
  return error && typeof error === "object" && error.code === "EPERM";
}

export function isPortInUseError(error) {
  return error && typeof error === "object" && error.code === "EADDRINUSE";
}

export function printSandboxHelp({ command, task }) {
  console.error("");
  console.error(`Cannot ${task} from the current Codex sandbox.`);
  console.error("macOS denied localhost access with EPERM, so changing ports will not fix it.");
  console.error("");
  console.error("Run the command from a normal Terminal, or approve the Codex escalated run:");
  console.error("");
  console.error("  cd /Users/point/Kaset-Tan-Phai");
  console.error(`  ${command}`);
  console.error("");
  console.error("For local E2E in Codex, use two outside-sandbox terminals:");
  console.error("");
  console.error("  npm run dev:e2e");
  console.error("  npm run test:e2e:attached");
  console.error("");
}

export async function assertURLReachable(urlString) {
  const url = new URL(urlString);
  const client = url.protocol === "https:" ? https : http;

  await new Promise((resolve, reject) => {
    const request = client.request(url, { method: "HEAD", timeout: 5_000 }, (response) => {
      response.resume();
      if (response.statusCode && response.statusCode < 500) {
        resolve();
        return;
      }

      reject(new Error(`Received HTTP ${response.statusCode ?? "unknown"}`));
    });

    request.once("timeout", () => {
      request.destroy(new Error("Timed out waiting for the local dev server"));
    });
    request.once("error", reject);
    request.end();
  });
}

export function printAttachedServerHelp({ baseURL }) {
  console.error("");
  console.error(`Cannot run attached Playwright because ${baseURL} is not reachable.`);
  console.error("");
  console.error("Start the local E2E server first:");
  console.error("");
  console.error("  cd /Users/point/Kaset-Tan-Phai");
  console.error("  npm run dev:e2e");
  console.error("");
  console.error("Then, from another outside-sandbox terminal, run:");
  console.error("");
  console.error("  npm run test:e2e:attached");
  console.error("");
  console.error("Outside Codex, this one-command path is also available:");
  console.error("");
  console.error("  npm run test:e2e:managed");
  console.error("");
}
