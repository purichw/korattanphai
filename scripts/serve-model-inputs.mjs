import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHandler } from '../server/model-inputs/handler.mjs';
import { createFileStore } from '../server/model-inputs/storage.mjs';
import { clientsFromEnvironment } from '../server/operations/integration-auth.mjs';
import { createMemoryRateLimiter, rateLimitOptionsFromEnvironment } from '../server/operations/rate-limit.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function startModelInputServer(env = process.env) {
  const port = Number(env.MODEL_INPUT_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('MODEL_INPUT_PORT must be a valid port.');
  const directory = resolve(projectRoot, env.MODEL_INPUT_DATA_DIR || '.local/model-inputs');
  const handler = createHandler({
    token: env.MODEL_INPUT_API_TOKEN || undefined,
    readToken: env.MODEL_INPUT_READ_TOKEN || undefined,
    sourceId: env.MODEL_INPUT_SOURCE_ID,
    clients: clientsFromEnvironment(env.MODEL_INPUT_CLIENTS_JSON),
    rateLimiter: createMemoryRateLimiter(rateLimitOptionsFromEnvironment(env)),
    store: createFileStore(directory),
  });
  const server = createServer((request, response) => {
    if (new URL(request.url, 'http://localhost').pathname !== '/api/model-inputs') {
      response.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: { code: 'not_found', message: 'Route not found.' } }));
      return;
    }
    void handler(request, response);
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.listen(port, '127.0.0.1');
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const server = startModelInputServer();
    server.on('listening', () => {
      process.stdout.write(`Local model-input API: http://127.0.0.1:${server.address().port}/api/model-inputs\n`);
    });
    server.on('error', () => { process.stderr.write('Unable to start the local model-input API. Check port and file-store access.\n'); process.exitCode = 1; });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
