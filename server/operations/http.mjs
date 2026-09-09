export class OperationalError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export function sendJson(response, status, body) {
  if (response.destroyed) return;
  response.statusCode = status;
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(status === 204 ? undefined : JSON.stringify(body));
}

export async function readSmallJson(request, maxBytes = 4096, timeoutMs = 5000) {
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers['content-type'] ?? '')) throw new OperationalError(415, 'unsupported_media_type');
  const length = request.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(String(length)) || Number(length) > maxBytes)) throw new OperationalError(413, 'payload_too_large');
  let body;
  if (request.body !== undefined) {
    body = typeof request.body === 'string' || Buffer.isBuffer(request.body) ? String(request.body) : JSON.stringify(request.body);
  } else {
    try {
      body = await withDeadline(async () => {
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += Buffer.byteLength(chunk);
          if (size > maxBytes) throw new OperationalError(413, 'payload_too_large');
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString('utf8');
      }, timeoutMs);
    } catch (error) {
      if (error instanceof OperationalError && error.code === 'dependency_timeout') {
        // Stop an incomplete upload. HTTP clients may observe a closed connection.
        request.destroy?.();
        throw new OperationalError(408, 'request_timeout');
      }
      throw error;
    }
  }
  if (typeof body !== 'string' || Buffer.byteLength(body) > maxBytes) throw new OperationalError(413, 'payload_too_large');
  try { return JSON.parse(body); } catch { throw new OperationalError(400, 'invalid_json'); }
}

export async function withDeadline(operation, timeoutMs = 5000) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new OperationalError(503, 'dependency_timeout')); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
