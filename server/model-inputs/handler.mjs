import {
  BATCH_ID, InputError, MAX_BODY_BYTES, batchMetadata, hashBatch, validateBatch, validateReceivedAt,
} from './contract.mjs';
import { createIntegrationAuth } from '../operations/integration-auth.mjs';
import { beginRequest } from '../operations/request-log.mjs';
import { createMemoryRateLimiter } from '../operations/rate-limit.mjs';

export { isValidToken } from '../operations/integration-auth.mjs';

function send(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const declared = request.headers?.['content-length'];
  if (declared !== undefined && (typeof declared !== 'string' || !/^\d+$/.test(declared))) {
    throw new InputError('Invalid Content-Length.', 400, 'invalid_request');
  }
  if (declared !== undefined && Number(declared) > MAX_BODY_BYTES) {
    throw new InputError('Request body exceeds 1 MiB.', 413, 'payload_too_large');
  }
  // Vercel may parse JSON before invoking the handler; the standalone server streams it.
  if (request.body !== undefined && request.body !== null && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    if (Buffer.byteLength(JSON.stringify(request.body)) > MAX_BODY_BYTES) {
      throw new InputError('Request body exceeds 1 MiB.', 413, 'payload_too_large');
    }
    return request.body;
  }
  let bytes = 0;
  const chunks = [];
  if (request.body !== undefined && request.body !== null) {
    chunks.push(Buffer.isBuffer(request.body) ? request.body : Buffer.from(String(request.body)));
    bytes = chunks[0].length;
  } else {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > MAX_BODY_BYTES) throw new InputError('Request body exceeds 1 MiB.', 413, 'payload_too_large');
      chunks.push(buffer);
    }
  }
  if (bytes > MAX_BODY_BYTES) throw new InputError('Request body exceeds 1 MiB.', 413, 'payload_too_large');
  try {
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    return JSON.parse(raw);
  } catch {
    throw new InputError('Body must contain valid UTF-8 JSON.', 400, 'invalid_json');
  }
}

function parseQuery(request) {
  const params = new URL(request.url ?? '/api/model-inputs', 'http://localhost').searchParams;
  for (const key of params.keys()) {
    if (!['batchId', 'limit', 'cursor'].includes(key) || params.getAll(key).length !== 1) {
      throw new InputError('Unknown or repeated query parameter.', 400, 'invalid_query');
    }
  }
  return params;
}

function readCursor(value) {
  if (!value) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]{1,512}$/.test(value)) throw new Error();
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!cursor || Object.keys(cursor).sort().join() !== 'batchId,receivedAt'
      || typeof cursor.batchId !== 'string' || !BATCH_ID.test(cursor.batchId)
      || typeof cursor.receivedAt !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(cursor.receivedAt)) throw new Error();
    // Postgres returns microseconds and offsets. Validate the calendar using
    // millisecond precision, but retain its exact cursor to avoid skipping ties.
    validateReceivedAt(cursor.receivedAt);
    return cursor;
  } catch {
    throw new InputError('Invalid pagination cursor.', 400, 'invalid_query');
  }
}

export function createHandler({ token, readToken, sourceId, clients, store, rateLimiter = createMemoryRateLimiter(), log = console.info }) {
  const auth = createIntegrationAuth({ token, readToken, sourceId, clients });
  if (!store?.put || !store?.get || !store?.list) throw new Error('A persistent model-input store is required.');
  if (typeof rateLimiter?.consume !== 'function') throw new Error('A request quota service is required.');

  return async function handler(request, response) {
    const context = beginRequest(request, response, { route: '/api/model-inputs', log });
    let client;
    let outcomeCode = 'ok';
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      client = auth.authenticate(request.headers?.authorization);
      if (!client) {
        response.setHeader('WWW-Authenticate', 'Bearer');
        throw new InputError('A valid integration token is required.', 401, 'unauthorized');
      }
      let quota;
      try { quota = await rateLimiter.consume({ sourceId: client.sourceId, clientId: client.id }); }
      catch { throw new InputError('Request quota service is unavailable. Retry later.', 503, 'rate_limit_unavailable'); }
      response.setHeader('X-RateLimit-Limit', String(rateLimiter.requestsPerMinute));
      response.setHeader('X-RateLimit-Remaining', String(quota.remainingMinute));
      response.setHeader('X-DailyQuota-Limit', String(rateLimiter.dailyQuota));
      response.setHeader('X-DailyQuota-Remaining', String(quota.remainingDaily));
      if (!quota.allowed) {
        response.setHeader('Retry-After', String(quota.retryAfterSeconds));
        throw new InputError('Integration request quota exceeded. Retry after the indicated delay.', 429, 'rate_limit_exceeded');
      }
      if (!['GET', 'POST'].includes(request.method)) {
        response.setHeader('Allow', 'GET, POST');
        throw new InputError('Use GET or POST.', 405, 'method_not_allowed');
      }
      const params = parseQuery(request);
      if (request.method === 'POST') {
        if (client.role !== 'writer') throw new InputError('This token has read-only access.', 403, 'forbidden');
        if (params.size) throw new InputError('POST does not accept query parameters.', 400, 'invalid_query');
        if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers?.['content-type'] ?? '')) {
          throw new InputError('Use Content-Type: application/json (UTF-8).', 415, 'unsupported_media_type');
        }
        const batch = validateBatch(await readBody(request));
        if (batch.sourceId !== client.sourceId) throw new InputError('This token cannot submit another source.', 403, 'forbidden');
        const result = await store.put(batch, hashBatch(batch));
        send(response, result.created ? 201 : 200, { created: result.created, batch: batchMetadata(result.batch) });
        return;
      }
      const batchId = params.get('batchId');
      if (params.has('batchId')) {
        if (!batchId || !BATCH_ID.test(batchId) || params.size !== 1) throw new InputError('Use batchId alone with a valid identifier.', 400, 'invalid_query');
        const batch = await store.get(client.sourceId, batchId);
        if (!batch) throw new InputError('Batch not found.', 404, 'not_found');
        send(response, 200, batch);
        return;
      }
      const limitText = params.get('limit') ?? '25';
      const limit = Number(limitText);
      if (!/^\d{1,3}$/.test(limitText) || limit < 1 || limit > 100) throw new InputError('limit must be 1–100.', 400, 'invalid_query');
      if (params.has('cursor') && !params.get('cursor')) throw new InputError('cursor must not be empty.', 400, 'invalid_query');
      const before = readCursor(params.get('cursor'));
      const rows = await store.list(client.sourceId, { limit: limit + 1, before });
      const items = rows.slice(0, limit);
      const last = items.at(-1);
      const nextCursor = rows.length > limit && last
        ? Buffer.from(JSON.stringify({ receivedAt: last.receivedAt, batchId: last.batchId })).toString('base64url') : null;
      send(response, 200, { items, nextCursor });
    } catch (error) {
      // Do not echo upstream exceptions, URLs, credentials, payloads or SQL errors.
      if (error instanceof InputError) {
        outcomeCode = error.code;
        if (error.status === 503) response.setHeader('Retry-After', '30');
        send(response, error.status, { error: { code: error.code, message: error.message } });
      } else if (error?.status === 409 && error?.code === 'batch_conflict') {
        outcomeCode = 'batch_conflict';
        send(response, 409, { error: { code: 'batch_conflict', message: 'This batchId already exists with different content. Use a new batchId for a correction.' } });
      } else {
        outcomeCode = 'storage_unavailable';
        response.setHeader('Retry-After', '30');
        send(response, 503, { error: { code: 'storage_unavailable', message: 'Model-input storage is unavailable. Retry the same batch later.' } });
      }
    } finally {
      context.finish({ code: outcomeCode, clientId: client?.id });
    }
  };
}

export function unavailableHandler(request, response) {
  const context = beginRequest(request, response, { route: '/api/model-inputs' });
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Retry-After', '30');
  send(response, 503, { error: { code: 'service_not_configured', message: 'Model-input ingestion is not configured.' } });
  context.finish({ code: 'service_not_configured' });
}
