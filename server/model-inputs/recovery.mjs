import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { BATCH_ID, SOURCE_ID, MAX_BODY_BYTES, validateBatch, hashBatch, validateReceivedAt, normalizeTimestamp } from './contract.mjs';
import { checkedEndpoint, operationError, parseRetryAfter, readJson, safeDirectory, writeJson } from './job-files.mjs';

export const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
export const MAX_ARCHIVE_BATCHES = 500;
const HASH = /^[a-f0-9]{64}$/;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fileName = id => `${createHash('sha256').update(id).digest('hex')}.json`;
const metadata = stored => ({ sourceId: stored.sourceId, batchId: stored.batchId, contentHash: stored.contentHash, receivedAt: stored.receivedAt, observationCount: stored.observations.length });
const timeKey = value => BigInt(Date.parse(value)) * 1000n + BigInt((/\.(\d+)/.exec(value)?.[1] ?? '').padEnd(6, '0').slice(3, 6));
const order = (a, b) => timeKey(a.receivedAt) === timeKey(b.receivedAt)
  ? a.batchId === b.batchId ? 0 : a.batchId < b.batchId ? -1 : 1
  : timeKey(a.receivedAt) < timeKey(b.receivedAt) ? -1 : 1;

function validateMetadata(row, sourceId) {
  if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).sort().join() !== 'batchId,contentHash,observationCount,receivedAt,sourceId'
    || row.sourceId !== sourceId || typeof row.batchId !== 'string' || !BATCH_ID.test(row.batchId)
    || typeof row.contentHash !== 'string' || !HASH.test(row.contentHash)
    || !Number.isInteger(row.observationCount) || row.observationCount < 1 || row.observationCount > 2000) throw operationError('invalid_backup_metadata');
  validateReceivedAt(row.receivedAt);
  return row;
}

function validateStored(stored, sourceId) {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw operationError('invalid_backup_batch');
  const { contentHash, receivedAt, ...body } = stored;
  const batch = validateBatch(body);
  if (batch.sourceId !== sourceId || contentHash !== hashBatch(batch) || Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) throw operationError('backup_batch_integrity_failed');
  validateReceivedAt(receivedAt);
  return { ...batch, contentHash, receivedAt };
}

async function requestJson(url, { token, fetchImpl, limit }) {
  const controller = new AbortController();
  let timer;
  try {
    const operation = (async () => {
      const response = await fetchImpl(url, { method: 'GET', redirect: 'manual', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: controller.signal });
      if (response.status === 429 || response.status === 503) {
        await response.body?.cancel();
        const error = operationError('backup_retry_requested');
        error.retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after')) ?? (response.status === 429 ? 60 : 1);
        throw error;
      }
      if (response.status !== 200 || response.redirected || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('content-type') ?? '')) {
        await response.body?.cancel(); throw operationError('backup_request_failed');
      }
      const length = response.headers.get('content-length');
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) { await response.body?.cancel(); throw operationError('backup_response_limit'); }
      if (!response.body) throw operationError('backup_response_empty');
      const reader = response.body.getReader(), chunks = []; let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit) { await reader.cancel(); throw operationError('backup_response_limit'); }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    })();
    return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(operationError('backup_request_timeout')); }, 15_000); })]);
  } catch (error) {
    controller.abort();
    if (error.code?.startsWith('backup_')) throw error;
    throw operationError('backup_request_failed');
  } finally { clearTimeout(timer); }
}

async function getJson(url, { budget, sleep, ...options }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await requestJson(url, options); }
    catch (error) {
      if (error.code !== 'backup_retry_requested') throw error;
      const delay = Math.max(1, error.retryAfterSeconds);
      if (attempt === 2 || delay > 60 || delay > budget.remainingSeconds) {
        const deferred = operationError('backup_deferred');
        deferred.retryAfterSeconds = delay;
        throw deferred;
      }
      budget.remainingSeconds -= delay;
      await sleep(delay * 1000);
    }
  }
}

export async function backupModelInputs({ endpoint, sourceId, token, outputPath, fetchImpl = fetch, now = () => new Date().toISOString(),
  sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) } = {}) {
  const base = checkedEndpoint(endpoint);
  if (!SOURCE_ID.test(sourceId ?? '') || typeof token !== 'string' || !/^[A-Za-z0-9._~+\/-]{32,512}={0,2}$/.test(token) || !outputPath) throw operationError('invalid_backup_options');
  await safeDirectory(path.dirname(path.resolve(outputPath)), { create: false });
  try { await fs.lstat(outputPath); throw operationError('backup_output_exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const captureStartedAt = normalizeTimestamp(now()), batches = [], seen = new Set();
  // Allows the default 60/minute API quota across 500 batches without busy retries.
  // Each wait is at most 60 seconds; the complete export has a 600-second wait budget.
  const budget = { remainingSeconds: 600 };
  let cursor = null, highWatermark = null, prior = null, bytes = 0;
  do {
    const url = new URL(base); url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const page = await getJson(url, { token, fetchImpl, limit: 128 * 1024, budget, sleep });
    if (!page || Object.keys(page).sort().join() !== 'items,nextCursor' || !Array.isArray(page.items) || page.items.length > 100
      || !(page.nextCursor === null || typeof page.nextCursor === 'string' && /^[A-Za-z0-9_-]{1,1000}$/.test(page.nextCursor))) throw operationError('invalid_backup_page');
    if (!page.items.length && page.nextCursor !== null) throw operationError('invalid_backup_cursor');
    for (const item of page.items) {
      validateMetadata(item, sourceId);
      if (seen.has(item.batchId) || prior && order(item, prior) >= 0) throw operationError('backup_pagination_not_monotonic');
      if (batches.length >= MAX_ARCHIVE_BATCHES) throw operationError('backup_batch_limit');
      seen.add(item.batchId); prior = item;
      highWatermark ??= { receivedAt: item.receivedAt, batchId: item.batchId };
      const singleUrl = new URL(base); singleUrl.searchParams.set('batchId', item.batchId);
      const stored = validateStored(await getJson(singleUrl, { token, fetchImpl, limit: MAX_BODY_BYTES + 16 * 1024, budget, sleep }), sourceId);
      if (JSON.stringify(metadata(stored)) !== JSON.stringify({ sourceId: item.sourceId, batchId: item.batchId, contentHash: item.contentHash, receivedAt: item.receivedAt, observationCount: item.observationCount })) throw operationError('backup_receipt_mismatch');
      bytes += Buffer.byteLength(JSON.stringify(stored));
      if (bytes > MAX_ARCHIVE_BYTES - 16 * 1024) throw operationError('backup_size_limit');
      batches.push(stored);
    }
    if (page.nextCursor) {
      let decoded;
      try { decoded = JSON.parse(Buffer.from(page.nextCursor, 'base64url').toString('utf8')); } catch { throw operationError('invalid_backup_cursor'); }
      if (Object.keys(decoded ?? {}).sort().join() !== 'batchId,receivedAt' || decoded.receivedAt !== prior.receivedAt || decoded.batchId !== prior.batchId || page.nextCursor === cursor) throw operationError('invalid_backup_cursor');
    }
    cursor = page.nextCursor;
  } while (cursor);
  const body = { schemaVersion: 1, kind: 'model-input-api-backup', sourceId, captureStartedAt, captureCompletedAt: normalizeTimestamp(now()), highWatermark, batches };
  const archive = { ...body, archiveHash: digest(body) };
  validateArchive(archive);
  await writeJson(outputPath, archive, MAX_ARCHIVE_BYTES);
  return { sourceId, batchCount: batches.length, observationCount: batches.reduce((sum, batch) => sum + batch.observations.length, 0), archiveHash: archive.archiveHash,
    captureStartedAt: body.captureStartedAt, captureCompletedAt: body.captureCompletedAt, throttleWaitSeconds: 600 - budget.remainingSeconds,
    coverage: 'Normalized batches visible through one source-scoped API; excludes database schema, auth, forecasts, and raw satellite/Storage assets.' };
}

export function validateArchive(archive) {
  if (!archive || typeof archive !== 'object' || Array.isArray(archive)
    || Object.keys(archive).sort().join() !== 'archiveHash,batches,captureCompletedAt,captureStartedAt,highWatermark,kind,schemaVersion,sourceId'
    || archive.schemaVersion !== 1 || archive.kind !== 'model-input-api-backup' || !SOURCE_ID.test(archive.sourceId ?? '')
    || !HASH.test(archive.archiveHash ?? '') || !Array.isArray(archive.batches) || archive.batches.length > MAX_ARCHIVE_BATCHES) throw operationError('invalid_archive');
  const { archiveHash, ...body } = archive;
  if (digest(body) !== archiveHash) throw operationError('archive_checksum_mismatch');
  const start = normalizeTimestamp(archive.captureStartedAt), end = normalizeTimestamp(archive.captureCompletedAt);
  if (Date.parse(start) > Date.parse(end)) throw operationError('invalid_capture_window');
  const seen = new Set(); let prior = null;
  for (const stored of archive.batches) {
    const canonical = validateStored(stored, archive.sourceId);
    if (JSON.stringify(canonical) !== JSON.stringify(stored) || seen.has(stored.batchId) || prior && order(stored, prior) >= 0) throw operationError('invalid_archive_order_or_batch');
    seen.add(stored.batchId); prior = stored;
  }
  const first = archive.batches[0];
  if (JSON.stringify(archive.highWatermark) !== JSON.stringify(first ? { receivedAt: first.receivedAt, batchId: first.batchId } : null)) throw operationError('invalid_archive_watermark');
  return archive;
}

export async function restoreModelInputs({ archivePath, targetDir, resume = false, verifyOnly = false, now = () => new Date().toISOString() } = {}) {
  const started = performance.now();
  const archive = validateArchive(await readJson(archivePath, MAX_ARCHIVE_BYTES));
  const result = { archiveHash: archive.archiveHash, sourceId: archive.sourceId, batchCount: archive.batches.length,
    recoveryPointAt: archive.captureCompletedAt, recoveryPointAgeSeconds: Math.max(0, (Date.parse(now()) - Date.parse(archive.captureCompletedAt)) / 1000),
    actualProductionDataLossSeconds: null, coverage: 'Source-scoped normalized batches only; original receivedAt is preserved. This does not restore Supabase as a whole or raw assets.' };
  if (verifyOnly) return { ...result, state: 'verified', verificationSeconds: (performance.now() - started) / 1000 };
  if (!targetDir) throw operationError('restore_target_required');
  const target = await safeDirectory(targetDir);
  const entries = await fs.readdir(target);
  const statePath = path.join(target, '.restore-state.json');
  if (!resume && entries.length) throw operationError('restore_target_not_empty');
  if (resume) {
    const state = await readJson(statePath, 16 * 1024);
    if (state.archiveHash !== archive.archiveHash || state.sourceId !== archive.sourceId) throw operationError('restore_resume_mismatch');
  } else await writeJson(statePath, { schemaVersion: 1, archiveHash: archive.archiveHash, sourceId: archive.sourceId, startedAt: now() });
  // Refuse unrelated paths even during resume. Never delete or overwrite them.
  if (entries.some(name => ![archive.sourceId, '.restore-state.json', '.restore-report.json'].includes(name) && !/^\.pending-[a-f0-9-]{36}\.tmp$/.test(name))) throw operationError('restore_unexpected_path');
  const sourceDir = await safeDirectory(path.join(target, archive.sourceId));
  const expectedFiles = new Set(archive.batches.map(batch => fileName(batch.batchId)));
  if ((await fs.readdir(sourceDir)).some(name => !expectedFiles.has(name) && !/^\.pending-[a-f0-9-]{36}\.tmp$/.test(name))) throw operationError('restore_unexpected_batch');
  let replayed = 0;
  for (const batch of archive.batches) {
    const destination = path.join(sourceDir, fileName(batch.batchId));
    try { await writeJson(destination, batch); }
    catch (error) {
      if (!resume || error.code !== 'EEXIST') throw error;
      const existing = validateStored(await readJson(destination), archive.sourceId);
      if (JSON.stringify(existing) !== JSON.stringify(batch)) throw operationError('restore_existing_batch_mismatch');
      replayed++;
    }
    const verified = validateStored(await readJson(destination), archive.sourceId);
    if (JSON.stringify(verified) !== JSON.stringify(batch)) throw operationError('restore_verification_failed');
  }
  const report = { ...result, state: 'restored', verifiedBatchCount: archive.batches.length, replayedBatchCount: replayed,
    completedAt: now(), measuredRestoreSeconds: (performance.now() - started) / 1000,
    metricNote: 'Recovery-point age is time since export, not measured data loss; restore duration is a local drill, not a production RTO guarantee.' };
  try { await writeJson(path.join(target, '.restore-report.json'), report); } catch (error) { if (!resume || error.code !== 'EEXIST') throw error; }
  return report;
}

/** Report policy candidates only. No archive is removed by this module. */
export async function retentionInventory(directory, { retentionDays = 30, now = new Date().toISOString() } = {}) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw operationError('invalid_retention_days');
  const root = await safeDirectory(directory, { create: false });
  const entries = await fs.readdir(root, { withFileTypes: true });
  if (entries.length > 10_000) throw operationError('inventory_limit');
  const items = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const archive = validateArchive(await readJson(path.join(root, entry.name), MAX_ARCHIVE_BYTES));
      const ageSeconds = (Date.parse(normalizeTimestamp(now)) - Date.parse(archive.captureCompletedAt)) / 1000;
      items.push({ file: entry.name, sourceId: archive.sourceId, archiveHash: archive.archiveHash, batchCount: archive.batches.length,
        captureCompletedAt: archive.captureCompletedAt, ageSeconds, exceedsRetentionPolicy: ageSeconds > retentionDays * 86400 });
    } catch { items.push({ file: entry.name, state: 'unverified', exceedsRetentionPolicy: null }); }
  }
  return { mode: 'report_only', retentionDays, checkedAt: now, items, deletedCount: 0 };
}
