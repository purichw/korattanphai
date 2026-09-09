import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { collectBatch, loadCollectorConfig } from '../../server/model-inputs/collector.mjs';
import { createHandler } from '../../server/model-inputs/handler.mjs';
import { createFileStore } from '../../server/model-inputs/storage.mjs';
import { hashBatch } from '../../server/model-inputs/contract.mjs';
import { acquireJobLock, runModelInputJob } from '../../server/model-inputs/job-runner.mjs';
import { evaluateFreshness, validateFreshnessPolicy } from '../../server/model-inputs/freshness.mjs';
import { readJson, safeDirectory, writeJson, checkedEndpoint } from '../../server/model-inputs/job-files.mjs';
import { backupModelInputs, restoreModelInputs, retentionInventory, validateArchive } from '../../server/model-inputs/recovery.mjs';

const fixture = name => fileURLToPath(new URL(`../../examples/model-inputs/${name}`, import.meta.url));
const configPath = fixture('local-json.config.json');
const token = 'test-only-operations-token-0123456789012345';
const now = () => '2026-09-09T10:00:00.000Z';
const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const batchFilename = batchId => `${createHash('sha256').update(batchId).digest('hex')}.json`;
async function temp() {
  const artifacts = fileURLToPath(new URL('../../artifacts/model-input-tests/', import.meta.url));
  await fs.mkdir(artifacts, { recursive: true });
  return fs.mkdtemp(path.join(artifacts, 'operations-'));
}
async function example(name = 'local-json.config.json') {
  const loaded = await loadCollectorConfig(fixture(name));
  return collectBatch(loaded.config, { baseDir: loaded.baseDir });
}
function receipt(batch, created = true) {
  return { created, batch: { sourceId: batch.sourceId, batchId: batch.batchId, contentHash: batch.contentHash ?? hashBatch(batch), observationCount: batch.observations.length, receivedAt: '2026-09-09T09:00:00.123456Z' } };
}
async function archiveFixture(directory, { count = 2 } = {}) {
  const original = await example();
  const batches = Array.from({ length: count }, (_, index) => {
    const batch = { ...original, batchId: `backup-${String(count - index).padStart(3, '0')}` };
    return { ...batch, contentHash: hashBatch(batch), receivedAt: `2026-09-08T09:00:00.${String(count - index).padStart(6, '0')}Z` };
  });
  const base = { schemaVersion: 1, kind: 'model-input-api-backup', sourceId: original.sourceId,
    captureStartedAt: '2026-09-09T09:00:00.000Z', captureCompletedAt: '2026-09-09T09:01:00.000Z',
    highWatermark: batches.length ? { receivedAt: batches[0].receivedAt, batchId: batches[0].batchId } : null, batches };
  const archive = { ...base, archiveHash: digest(base) };
  const archivePath = path.join(directory, 'backup.json');
  await writeJson(archivePath, archive);
  return { archive, archivePath };
}

test('job lock excludes live owners and explicit recovery only advances dead same-host generations', async () => {
  const directory = await temp();
  const first = await acquireJobLock(directory);
  await assert.rejects(acquireJobLock(directory), /job_locked/);
  await assert.rejects(acquireJobLock(directory, { recoverLock: true }), /job_locked/);
  await first.release();
  const second = await acquireJobLock(directory);
  await second.release();
  const crashed = await safeDirectory(path.join(directory, 'locks', '000000003'));
  await writeJson(path.join(crashed, 'owner.json'), { pid: 2147483647, hostname: os.hostname(), startedAt: now() });
  await assert.rejects(acquireJobLock(directory), /job_locked/);
  const recovered = await acquireJobLock(directory, { recoverLock: true });
  await recovered.release();
  assert.equal((await readJson(path.join(crashed, 'released.json'))).reason, 'owner_process_absent');
  assert.equal((await fs.readdir(path.join(directory, 'locks'))).length, 4);
});

test('concurrent lock contenders have exactly one winner and append-only publication never overwrites', async () => {
  const directory = await temp();
  const locks = await Promise.allSettled(Array.from({ length: 8 }, () => acquireJobLock(directory)));
  assert.equal(locks.filter(result => result.status === 'fulfilled').length, 1);
  for (const result of locks) if (result.status === 'fulfilled') await result.value.release();
  const filename = path.join(directory, 'unchanged.json');
  await writeJson(filename, { value: 1 });
  await assert.rejects(writeJson(filename, { value: 2 }), error => error.code === 'EEXIST');
  assert.deepEqual(await readJson(filename), { value: 1 });
});

test('an uncertain accepted POST resumes the same frozen batch without recollecting or duplicating', async () => {
  const directory = await temp(), bodies = [], accepted = new Map();
  const fetchImpl = async (_url, request) => {
    const batch = JSON.parse(request.body); bodies.push(request.body);
    const duplicate = accepted.has(batch.batchId); accepted.set(batch.batchId, batch);
    if (!duplicate) throw new Error('upstream secret that must not be persisted');
    return jsonResponse(receipt(batch, false), 200);
  };
  const failed = await runModelInputJob({ configPath, stateDir: directory, endpoint: 'https://example.invalid/api/model-inputs', token, fetchImpl, attempts: 1, now });
  assert.equal(failed.state, 'submission_failed');
  const completed = await runModelInputJob({ stateDir: directory, endpoint: 'https://example.invalid/api/model-inputs', token, fetchImpl, resumeRunId: failed.runId, now });
  assert.equal(completed.state, 'submitted'); assert.equal(completed.duplicate, true); assert.equal(accepted.size, 1);
  assert.equal(completed.freshness.receivedAt, '2026-09-09T09:00:00.123456Z');
  assert.equal(completed.freshness.fetchedAt, now());
  assert.equal(bodies[0], bodies[1]); assert.equal(completed.attempts, 2);
  const again = await runModelInputJob({ stateDir: directory, endpoint: 'https://example.invalid/api/model-inputs', token, fetchImpl, resumeRunId: failed.runId, now });
  assert.equal(again.alreadyComplete, true); assert.equal(bodies.length, 2);
  const runDir = path.join(directory, 'runs', failed.runId);
  const persisted = (await Promise.all((await fs.readdir(runDir)).map(name => fs.readFile(path.join(runDir, name), 'utf8')))).join('\n');
  for (const secret of [token, 'upstream secret', 'https://example.invalid', 'local-weather.json']) assert.equal(persisted.includes(secret), false);
});

test('retry count is bounded; terminal rejection stops immediately; wrong resume target is refused', async () => {
  const directory = await temp(); let calls = 0;
  const result = await runModelInputJob({ configPath, stateDir: directory, endpoint: 'https://example.invalid/api', token,
    fetchImpl: async () => { calls++; return new Response('', { status: 503 }); }, attempts: 3, sleep: async () => {}, now });
  assert.equal(result.state, 'submission_failed'); assert.equal(calls, 3);
  await assert.rejects(runModelInputJob({ stateDir: directory, endpoint: 'https://other.invalid/api', token, resumeRunId: result.runId }), /resume_target_mismatch/);
  const terminal = await runModelInputJob({ stateDir: directory, endpoint: 'https://example.invalid/api', token, resumeRunId: result.runId,
    fetchImpl: async () => { calls++; return new Response('', { status: 403 }); }, attempts: 3 });
  assert.equal(terminal.code, 'submission_http_403'); assert.equal(calls, 4);
});

test('long Retry-After freezes a deferred job and early resume makes no request', async () => {
  const directory = await temp(); let calls = 0;
  const fetchImpl = async () => { calls++; return new Response('', { status: 429, headers: { 'Retry-After': '60' } }); };
  const deferred = await runModelInputJob({ configPath, stateDir: directory, endpoint: 'https://example.invalid/api', token, fetchImpl, now });
  assert.equal(deferred.state, 'submission_deferred'); assert.equal(deferred.retryNotBeforeAt, '2026-09-09T10:01:00.000Z'); assert.equal(calls, 1);
  const early = await runModelInputJob({ stateDir: directory, endpoint: 'https://example.invalid/api', token, fetchImpl, now, resumeRunId: deferred.runId });
  assert.equal(early.state, 'submission_deferred'); assert.equal(calls, 1);
  const done = await runModelInputJob({ stateDir: directory, endpoint: 'https://example.invalid/api', token, resumeRunId: deferred.runId,
    now: () => '2026-09-09T10:02:00.000Z', fetchImpl: async (_url, request) => { calls++; return jsonResponse(receipt(JSON.parse(request.body)), 201); } });
  assert.equal(done.state, 'submitted'); assert.equal(calls, 2);
});

test('pending tamper is refused before any resumed submission and unsafe paths never receive writes', async () => {
  const directory = await temp();
  const failed = await runModelInputJob({ configPath, stateDir: directory, endpoint: 'https://example.invalid/api', token,
    fetchImpl: async () => new Response('', { status: 503 }), attempts: 1, now });
  const filename = path.join(directory, 'runs', failed.runId, 'pending.json');
  const pending = await readJson(filename); pending.batch.observations[0].value = 999;
  await fs.writeFile(filename, JSON.stringify(pending));
  await assert.rejects(runModelInputJob({ stateDir: directory, endpoint: 'https://example.invalid/api', token, resumeRunId: failed.runId,
    fetchImpl: async () => { assert.fail('tampered batch was submitted'); } }), /pending_batch_integrity_failed/);
  await fs.symlink(directory, path.join(directory, 'symlink'));
  await assert.rejects(safeDirectory(path.join(directory, 'symlink', 'outside')), /unsafe_directory/);
  await fs.symlink(filename, path.join(directory, 'alias.json'));
  await assert.rejects(readJson(path.join(directory, 'alias.json')), /invalid_json_file/);
  for (const url of ['https://name:secret@example.com/api', 'https://example.com/api?token=secret', 'http://public.example/api']) assert.throws(() => checkedEndpoint(url), /invalid_endpoint/);
});

test('freshness distinguishes unknown cadence, history, missing quality, and partial old observations', async () => {
  const batch = await example();
  const unknown = evaluateFreshness(batch, { fetchedAt: now(), now: now() });
  assert.equal(unknown.observationStatus, 'unknown'); assert.equal(unknown.fetchStatus, 'unknown');
  assert.equal(unknown.receivedAt, null); assert.equal(unknown.qualityCounts.missing, 1);
  const live = evaluateFreshness(batch, { fetchedAt: now(), now: now(), policy: { schemaVersion: 1, mode: 'operational', maxObservationAgeSeconds: 3600, maxFetchAgeSeconds: 300 } });
  assert.equal(live.observationStatus, 'stale'); assert.equal(live.fetchStatus, 'fresh');
  const history = evaluateFreshness(batch, { fetchedAt: now(), now: now(), policy: { schemaVersion: 1, mode: 'historical' } });
  assert.equal(history.observationStatus, 'historical');
  assert.throws(() => validateFreshnessPolicy({ schemaVersion: 1, mode: 'historical', maxObservationAgeSeconds: 60 }), /historical_policy/);
  const mixed = structuredClone(batch); mixed.observations[0].observedAt = now();
  assert.equal(evaluateFreshness(mixed, { fetchedAt: now(), now: now(), policy: { schemaVersion: 1, mode: 'operational', maxObservationAgeSeconds: 3600 } }).observationStatus, 'partial_stale');
  const future = structuredClone(batch); future.observations[0].observedAt = '2026-09-10T10:00:00Z';
  assert.equal(evaluateFreshness(future, { fetchedAt: now(), now: now() }).observationStatus, 'future_timestamp');
});

test('satellite/month and crop/inclusive-date periods retain distinct observation boundaries', async () => {
  const satellite = await example('satellite-features.config.json'), crop = await example('doae-crop-yield.config.json');
  const sat = evaluateFreshness(satellite, { fetchedAt: now(), now: now() });
  assert.equal(sat.latestObservationEndAt, '2026-09-01T00:00:00.000Z');
  const annual = evaluateFreshness(crop, { fetchedAt: now(), now: now(), policy: { schemaVersion: 1, mode: 'historical' } });
  assert.equal(annual.latestObservationEndAt, '2026-01-01T00:00:00.000Z'); assert.equal(annual.observationStatus, 'historical');
});

test('API GET export restores an empty local store and preserves hashes and original receipt times', async t => {
  const directory = await temp(), original = await example(), store = createFileStore(path.join(directory, 'source'));
  await store.put(original, hashBatch(original));
  const server = createServer(createHandler({ token, sourceId: original.sourceId, store, log: () => {} }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/model-inputs`, outputPath = path.join(directory, 'export.json');
  const exported = await backupModelInputs({ endpoint, token, sourceId: original.sourceId, outputPath });
  assert.equal(exported.batchCount, 1);
  const archiveText = await fs.readFile(outputPath, 'utf8'); assert.equal(archiveText.includes(token), false); assert.equal(archiveText.includes(endpoint), false);
  const targetDir = path.join(directory, 'restored');
  const restored = await restoreModelInputs({ archivePath: outputPath, targetDir });
  assert.equal(restored.verifiedBatchCount, 1); assert.equal(restored.actualProductionDataLossSeconds, null); assert.ok(restored.measuredRestoreSeconds >= 0);
  assert.deepEqual(await createFileStore(targetDir).get(original.sourceId, original.batchId), await store.get(original.sourceId, original.batchId));
  const replay = await restoreModelInputs({ archivePath: outputPath, targetDir, resume: true });
  assert.equal(replay.replayedBatchCount, 1);
  await assert.rejects(restoreModelInputs({ archivePath: outputPath, targetDir }), /restore_target_not_empty/);
  await assert.rejects(backupModelInputs({ endpoint, token, sourceId: original.sourceId, outputPath }), /backup_output_exists/);
});

test('backup follows verified pagination including microsecond ties and rejects foreign source, receipt drift, repeated cursors', async () => {
  const directory = await temp(), { archive } = await archiveFixture(directory, { count: 101 });
  let pages = 0;
  const fetchImpl = async url => {
    const target = new URL(url);
    if (target.searchParams.has('batchId')) return jsonResponse(archive.batches.find(batch => batch.batchId === target.searchParams.get('batchId')));
    pages++;
    const rows = target.searchParams.has('cursor') ? archive.batches.slice(100) : archive.batches.slice(0, 100);
    return jsonResponse({ items: rows.map(batch => receipt(batch).batch).map((item, index) => ({ ...item, receivedAt: rows[index].receivedAt })),
      nextCursor: pages === 1 ? Buffer.from(JSON.stringify({ receivedAt: rows.at(-1).receivedAt, batchId: rows.at(-1).batchId })).toString('base64url') : null });
  };
  const exported = await backupModelInputs({ endpoint: 'https://example.invalid/api', token, sourceId: archive.sourceId, outputPath: path.join(directory, 'paged.json'), fetchImpl, now });
  assert.equal(exported.batchCount, 101); assert.equal(pages, 2);
  const wrongMeta = { ...receipt(archive.batches[0]).batch, sourceId: 'other-source' };
  await assert.rejects(backupModelInputs({ endpoint: 'https://example.invalid/api', token, sourceId: archive.sourceId, outputPath: path.join(directory, 'bad.json'), fetchImpl: async () => jsonResponse({ items: [wrongMeta], nextCursor: null }), now }), /invalid_backup_metadata/);
  const driftMeta = { ...receipt(archive.batches[0]).batch, contentHash: 'f'.repeat(64) };
  await assert.rejects(backupModelInputs({ endpoint: 'https://example.invalid/api', token, sourceId: archive.sourceId, outputPath: path.join(directory, 'drift.json'),
    fetchImpl: async url => new URL(url).searchParams.has('batchId') ? jsonResponse(archive.batches[0]) : jsonResponse({ items: [driftMeta], nextCursor: null }), now }), /backup_receipt_mismatch/);
  assert.equal(await fs.lstat(path.join(directory, 'bad.json')).then(() => true, () => false), false);
});

test('archive tamper and hash-recomputed invalid payload fail before target creation; restore resume never overwrites a mismatch', async () => {
  const directory = await temp(), { archive, archivePath } = await archiveFixture(directory);
  const changed = structuredClone(archive); changed.batches[0].observations[0].value = 999;
  assert.throws(() => validateArchive(changed), /archive_checksum_mismatch/);
  const { archiveHash: _ignored, ...body } = changed; changed.archiveHash = digest(body);
  assert.throws(() => validateArchive(changed), /backup_batch_integrity_failed/);
  const invalidPath = path.join(directory, 'invalid.json'); await writeJson(invalidPath, changed);
  const rejectedTarget = path.join(directory, 'rejected');
  await assert.rejects(restoreModelInputs({ archivePath: invalidPath, targetDir: rejectedTarget }), /backup_batch_integrity_failed/);
  await assert.rejects(fs.stat(rejectedTarget), error => error.code === 'ENOENT');
  const targetDir = path.join(directory, 'restored'); await restoreModelInputs({ archivePath, targetDir });
  const targetBatch = path.join(targetDir, archive.sourceId, batchFilename(archive.batches[0].batchId));
  const altered = structuredClone(archive.batches[0]); altered.receivedAt = '2026-09-08T09:00:01Z'; await fs.writeFile(targetBatch, JSON.stringify(altered));
  await assert.rejects(restoreModelInputs({ archivePath, targetDir, resume: true }), /restore_existing_batch_mismatch/);
  assert.equal((await readJson(targetBatch)).receivedAt, altered.receivedAt);
});

test('an interrupted restore resumes from its manifest and matching partial files without replacing them', async () => {
  const directory = await temp(), { archive, archivePath } = await archiveFixture(directory), targetDir = await safeDirectory(path.join(directory, 'partial'));
  await writeJson(path.join(targetDir, '.restore-state.json'), { schemaVersion: 1, archiveHash: archive.archiveHash, sourceId: archive.sourceId, startedAt: now() });
  const sourceDir = await safeDirectory(path.join(targetDir, archive.sourceId));
  const first = path.join(sourceDir, batchFilename(archive.batches[0].batchId)); await writeJson(first, archive.batches[0]);
  const initialInode = (await fs.stat(first)).ino;
  const result = await restoreModelInputs({ archivePath, targetDir, resume: true, now });
  assert.equal(result.verifiedBatchCount, 2); assert.equal(result.replayedBatchCount, 1); assert.equal((await fs.stat(first)).ino, initialInode);
});

test('backup honors short quota waits and defers long waits without publishing a partial archive', async () => {
  const directory = await temp(); let calls = 0; const waits = [];
  const exported = await backupModelInputs({ endpoint: 'https://example.invalid/api', token, sourceId: 'local-demo', outputPath: path.join(directory, 'waited.json'), now,
    fetchImpl: async () => ++calls === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '60' } }) : jsonResponse({ items: [], nextCursor: null }),
    sleep: async milliseconds => waits.push(milliseconds) });
  assert.equal(calls, 2); assert.deepEqual(waits, [60_000]); assert.equal(exported.throttleWaitSeconds, 60);
  calls = 0;
  await assert.rejects(backupModelInputs({ endpoint: 'https://example.invalid/api', token, sourceId: 'local-demo', outputPath: path.join(directory, 'deferred.json'), now,
    fetchImpl: async () => { calls++; return new Response('', { status: 429, headers: { 'Retry-After': '600' } }); }, sleep: async () => assert.fail('long wait should defer') }),
  error => error.code === 'backup_deferred' && error.retryAfterSeconds === 600);
  assert.equal(calls, 1); await assert.rejects(fs.stat(path.join(directory, 'deferred.json')), error => error.code === 'ENOENT');
});

test('empty backups, verification-only and retention inventory report without deleting archives', async () => {
  const directory = await temp(), { archivePath } = await archiveFixture(directory, { count: 0 });
  const verification = await restoreModelInputs({ archivePath, verifyOnly: true, now });
  assert.equal(verification.state, 'verified'); assert.equal(verification.batchCount, 0);
  const inventory = await retentionInventory(directory, { now: '2026-12-09T09:00:00Z', retentionDays: 30 });
  assert.equal(inventory.mode, 'report_only'); assert.equal(inventory.deletedCount, 0); assert.equal(inventory.items[0].exceedsRetentionPolicy, true);
  assert.equal((await readJson(archivePath)).kind, 'model-input-api-backup');
  await assert.rejects(readJson(archivePath, 8), /invalid_file_size/);
});
