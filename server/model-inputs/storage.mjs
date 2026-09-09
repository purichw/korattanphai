import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const SOURCE_ID = /^[a-z][a-z0-9_-]{0,63}$/;
const BATCH_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_METADATA_BYTES = 128 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const DATA_COLUMNS = 'source_id,batch_id,content_hash,received_at,payload,observation_count';
const METADATA_COLUMNS = 'source_id,batch_id,content_hash,received_at,observation_count';

function failure(code = 'storage_unavailable', status = 503) {
  const error = new Error(code === 'batch_conflict' ? 'Batch ID already exists with different content.'
    : code === 'invalid_storage_input' ? 'Invalid storage input.' : 'Model input storage is unavailable.');
  error.code = code;
  error.status = status;
  return error;
}

function requireInput(condition) {
  if (!condition) throw failure('invalid_storage_input', 400);
}

function identifiers(sourceId, batchId) {
  requireInput(typeof sourceId === 'string' && SOURCE_ID.test(sourceId));
  if (batchId !== undefined) requireInput(typeof batchId === 'string' && BATCH_ID.test(batchId));
}

function timestamp(value) {
  return typeof value === 'string' && TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}

function listOptions({ limit = 100, before } = {}) {
  requireInput(Number.isInteger(limit) && limit >= 1 && limit <= 101);
  if (before !== undefined) {
    requireInput(before && timestamp(before.receivedAt) && typeof before.batchId === 'string' && BATCH_ID.test(before.batchId));
  }
  return { limit, before };
}

function validateBatch(batch, contentHash) {
  requireInput(batch && typeof batch === 'object' && !Array.isArray(batch));
  identifiers(batch.sourceId, batch.batchId);
  requireInput(typeof batch.batchId === 'string' && HASH.test(contentHash));
  requireInput(batch.schemaVersion === 1 && Array.isArray(batch.observations) && batch.observations.length <= 2000);
}

function metadata(stored) {
  return { sourceId: stored.sourceId, batchId: stored.batchId, contentHash: stored.contentHash,
    receivedAt: stored.receivedAt, observationCount: stored.observations.length };
}

// Hash opaque identities so case-insensitive filesystems preserve A vs a and
// timestamps/other permitted punctuation never become filesystem syntax.
function batchFileName(batchId) {
  return `${createHash('sha256').update(batchId).digest('hex')}.json`;
}

function existingResult(existing, contentHash) {
  if (existing.contentHash !== contentHash) throw failure('batch_conflict', 409);
  return { created: false, batch: existing };
}

function validateStored(value, sourceId, batchId) {
  if (!value || value.schemaVersion !== 1 || value.sourceId !== sourceId || value.batchId !== batchId
    || !HASH.test(value.contentHash) || !timestamp(value.receivedAt)
    || !Array.isArray(value.observations) || value.observations.length > 2000) throw failure();
  return value;
}

// These timestamps are UTC milliseconds written by this adapter. Compare batch
// IDs by ASCII order, matching the database column's C collation for ties.
function descending(a, b) {
  if (a.receivedAt !== b.receivedAt) return a.receivedAt < b.receivedAt ? 1 : -1;
  return a.batchId === b.batchId ? 0 : a.batchId < b.batchId ? 1 : -1;
}

export function createFileStore(directory) {
  requireInput(typeof directory === 'string' && directory.length > 0);
  const root = path.resolve(directory);

  async function sourceDirectory(sourceId, create) {
    identifiers(sourceId);
    if (create) await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const canonicalRoot = await fs.realpath(root);
    const location = path.join(canonicalRoot, sourceId);
    if (create) await fs.mkdir(location, { recursive: true, mode: 0o700 });
    // Reject symlinked source directories instead of following them outside root.
    const stat = await fs.lstat(location);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw failure();
    return location;
  }

  async function readFileBatch(location, filename, sourceId, expectedBatchId) {
    let handle;
    try {
      handle = await fs.open(path.join(location, filename), constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_RESPONSE_BYTES) throw failure();
      const bytes = await handle.readFile();
      if (bytes.length > MAX_RESPONSE_BYTES) throw failure();
      const stored = JSON.parse(bytes.toString('utf8'));
      if (typeof stored?.batchId !== 'string' || !BATCH_ID.test(stored.batchId)
        || batchFileName(stored.batchId) !== filename) throw failure();
      return validateStored(stored, sourceId, expectedBatchId ?? stored.batchId);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw failure();
    } finally { await handle?.close(); }
  }

  async function read(sourceId, batchId) {
    try {
      const location = await sourceDirectory(sourceId, false);
      return await readFileBatch(location, batchFileName(batchId), sourceId, batchId);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw failure();
    }
  }

  return {
    async get(sourceId, batchId) {
      identifiers(sourceId, batchId);
      requireInput(typeof batchId === 'string');
      return read(sourceId, batchId);
    },
    async put(batch, contentHash) {
      validateBatch(batch, contentHash);
      const stored = { ...batch, contentHash, receivedAt: new Date().toISOString() };
      let bytes;
      try { bytes = Buffer.from(JSON.stringify(stored)); } catch { throw failure('invalid_storage_input', 400); }
      requireInput(bytes.length <= MAX_RESPONSE_BYTES);
      let temporary;
      let handle;
      try {
        const location = await sourceDirectory(batch.sourceId, true);
        const destination = path.join(location, batchFileName(batch.batchId));
        temporary = path.join(location, `.pending-${randomUUID()}.tmp`);
        handle = await fs.open(temporary, 'wx', 0o600);
        await handle.writeFile(bytes);
        await handle.sync();
        await handle.close(); handle = undefined;
        try {
          // link() publishes a complete file exclusively. Concurrent writers
          // cannot overwrite a winner or reveal a partially written batch.
          await fs.link(temporary, destination);
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
          const existing = await read(batch.sourceId, batch.batchId);
          if (!existing) throw failure();
          return existingResult(existing, contentHash);
        }
        return { created: true, batch: stored };
      } catch (error) {
        if (error.code === 'batch_conflict') throw error;
        throw failure();
      } finally {
        await handle?.close().catch(() => {});
        // Only our uniquely created transient file is removed. A process crash
        // may leave a .tmp file; readers/listing never treat it as a batch.
        if (temporary) await fs.unlink(temporary).catch(() => {});
      }
    },
    async list(sourceId, options) {
      identifiers(sourceId);
      const { limit, before } = listOptions(options);
      try {
        const location = await sourceDirectory(sourceId, false);
        const entries = await fs.readdir(location, { withFileTypes: true });
        const rows = [];
        for (const entry of entries) {
          if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) continue;
          const stored = await readFileBatch(location, entry.name, sourceId);
          if (stored) rows.push(metadata(stored));
        }
        return rows.sort(descending).filter(row => !before || descending(row, before) > 0).slice(0, limit);
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw failure();
      }
    },
  };
}

function rowMetadata(row, sourceId) {
  if (!row || row.source_id !== sourceId || typeof row.batch_id !== 'string' || !BATCH_ID.test(row.batch_id)
    || !HASH.test(row.content_hash) || !timestamp(row.received_at)
    || !Number.isInteger(row.observation_count) || row.observation_count < 0 || row.observation_count > 2000) throw failure();
  return { sourceId: row.source_id, batchId: row.batch_id, contentHash: row.content_hash,
    receivedAt: row.received_at, observationCount: row.observation_count };
}

function rowBatch(row, sourceId, batchId) {
  const meta = rowMetadata(row, sourceId);
  const stored = validateStored({ ...row.payload, contentHash: meta.contentHash, receivedAt: meta.receivedAt }, sourceId, batchId);
  if (stored.observations.length !== meta.observationCount) throw failure();
  return stored;
}

export function createSupabaseStore({ url, key, fetchImpl = globalThis.fetch } = {}) {
  let origin;
  try {
    origin = new URL(url);
    requireInput(origin.protocol === 'https:' && !origin.username && !origin.password && !origin.search && !origin.hash
      && origin.pathname === '/' && typeof key === 'string' && key.length > 0 && key.length <= 8192 && !/[\r\n]/.test(key)
      && typeof fetchImpl === 'function');
  } catch { throw failure('invalid_storage_input', 400); }

  async function request(method, parameters, body, maxBytes = MAX_RESPONSE_BYTES) {
    const target = new URL('/rest/v1/model_input_batches', origin);
    for (const [name, value] of Object.entries(parameters)) target.searchParams.set(name, value);
    const controller = new AbortController();
    let timer;
    try {
      const operation = (async () => {
        const response = await fetchImpl(target.href, {
          method, redirect: 'error', signal: controller.signal,
          headers: { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }), Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json', Prefer: 'return=representation' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        if (response.redirected || response.status >= 300 && response.status < 400) throw failure();
        if (method === 'POST' && response.status === 409) { await response.body?.cancel(); return { conflict: true }; }
        if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
          await response.body?.cancel(); throw failure();
        }
        const length = response.headers.get('content-length');
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw failure();
        if (!response.body) throw failure();
        const reader = response.body.getReader();
        const chunks = []; let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) { await reader.cancel(); throw failure(); }
          chunks.push(value);
        }
        return { rows: JSON.parse(Buffer.concat(chunks, size).toString('utf8')) };
      })();
      return await Promise.race([operation, new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(failure()); }, REQUEST_TIMEOUT_MS);
      })]);
    } catch { controller.abort(); throw failure(); }
    finally { clearTimeout(timer); }
  }

  async function get(sourceId, batchId) {
    identifiers(sourceId, batchId);
    requireInput(typeof batchId === 'string');
    const { rows } = await request('GET', { source_id: `eq.${sourceId}`, batch_id: `eq.${batchId}`, select: DATA_COLUMNS, limit: '1' });
    if (!Array.isArray(rows) || rows.length > 1) throw failure();
    return rows.length ? rowBatch(rows[0], sourceId, batchId) : null;
  }

  return {
    get,
    async put(batch, contentHash) {
      validateBatch(batch, contentHash);
      const { rows, conflict } = await request('POST', { select: DATA_COLUMNS }, {
        source_id: batch.sourceId, batch_id: batch.batchId, content_hash: contentHash,
        payload: batch, observation_count: batch.observations.length,
      });
      if (conflict) {
        const existing = await get(batch.sourceId, batch.batchId);
        if (!existing) throw failure();
        return existingResult(existing, contentHash);
      }
      if (!Array.isArray(rows) || rows.length !== 1) throw failure();
      const stored = rowBatch(rows[0], batch.sourceId, batch.batchId);
      if (stored.contentHash !== contentHash) throw failure();
      return { created: true, batch: stored };
    },
    async list(sourceId, options) {
      identifiers(sourceId);
      const { limit, before } = listOptions(options);
      const parameters = { source_id: `eq.${sourceId}`, select: METADATA_COLUMNS, order: 'received_at.desc,batch_id.desc', limit: String(limit) };
      if (before) parameters.or = `(received_at.lt.${before.receivedAt},and(received_at.eq.${before.receivedAt},batch_id.lt.${before.batchId}))`;
      const { rows } = await request('GET', parameters, undefined, MAX_METADATA_BYTES);
      if (!Array.isArray(rows) || rows.length > limit) throw failure();
      return rows.map(row => rowMetadata(row, sourceId));
    },
  };
}
