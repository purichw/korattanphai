import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { collectBatch, validateCollectorConfig, submitBatch } from './collector.mjs';
import { hashBatch, validateBatch, MAX_BODY_BYTES } from './contract.mjs';
import { evaluateFreshness, validateFreshnessPolicy } from './freshness.mjs';
import { checkedEndpoint, jsonExists, operationError, readJson, safeDirectory, writeJson } from './job-files.mjs';

const RUN_ID = /^\d{8}T\d{9}Z-[a-f0-9-]{36}$/;
const endpointHash = endpoint => createHash('sha256').update(checkedEndpoint(endpoint).href).digest('hex');
const safeFailure = error => {
  const match = /^Submission returned HTTP (\d{3})$/.exec(error.message ?? '');
  return match ? `submission_http_${match[1]}` : 'collection_or_submission_failed';
};
function processAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return true;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}

/** Append-only generations avoid unlink/replace races during crash recovery. */
export async function acquireJobLock(stateDir, { recoverLock = false } = {}) {
  const root = await safeDirectory(stateDir);
  const locks = await safeDirectory(path.join(root, 'locks'));
  const generations = (await fs.readdir(locks)).filter(name => /^\d{9}$/.test(name)).sort();
  if (generations.length > 100_000) throw operationError('lock_history_limit');
  const previous = generations.at(-1);
  if (previous) {
    const prior = await safeDirectory(path.join(locks, previous), { create: false });
    if (!await jsonExists(path.join(prior, 'released.json'))) {
      const owner = await jsonExists(path.join(prior, 'owner.json'));
      const oldEnough = Date.now() - (await fs.stat(prior)).mtimeMs > 60_000;
      const recoverable = owner ? owner.hostname === os.hostname() && !processAlive(owner.pid) : oldEnough;
      if (!recoverLock || !recoverable) throw operationError('job_locked');
      try { await writeJson(path.join(prior, 'released.json'), { recoveredAt: new Date().toISOString(), reason: owner ? 'owner_process_absent' : 'owner_write_interrupted' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
  }
  const sequence = previous ? Number(previous) + 1 : 1;
  if (sequence > 999_999_999) throw operationError('lock_history_limit');
  const location = path.join(locks, String(sequence).padStart(9, '0'));
  try { await fs.mkdir(location, { mode: 0o700 }); } catch (error) { if (error.code === 'EEXIST') throw operationError('job_locked'); throw error; }
  await writeJson(path.join(location, 'owner.json'), { pid: process.pid, hostname: os.hostname(), startedAt: new Date().toISOString() });
  let released = false;
  return { root, async release() {
    if (!released) { await writeJson(path.join(location, 'released.json'), { releasedAt: new Date().toISOString() }); released = true; }
  } };
}

export async function runModelInputJob({ configPath, stateDir, endpoint, token, policy, resumeRunId, recoverLock = false, attempts = 3,
  fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => new Date().toISOString() } = {}) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 4) throw operationError('attempts_must_be_1_to_4');
  const targetHash = endpointHash(endpoint);
  if (typeof token !== 'string' || !/^[A-Za-z0-9._~+\/-]{32,512}={0,2}$/.test(token)) throw operationError('invalid_api_token');
  if (resumeRunId !== undefined && !RUN_ID.test(resumeRunId)) throw operationError('invalid_run_id');
  if (!resumeRunId && !configPath) throw operationError('config_required');
  if (resumeRunId && (configPath || policy)) throw operationError('resume_uses_frozen_batch_and_policy');
  const lock = await acquireJobLock(stateDir, { recoverLock });
  let runDir, runId, manifest, pending;
  try {
    const runs = await safeDirectory(path.join(lock.root, 'runs'));
    if (resumeRunId) {
      runId = resumeRunId;
      runDir = await safeDirectory(path.join(runs, runId), { create: false });
      manifest = await readJson(path.join(runDir, 'manifest.json'), 16 * 1024);
      if (manifest.schemaVersion !== 1 || manifest.runId !== runId || manifest.endpointHash !== targetHash) throw operationError('resume_target_mismatch');
      const completed = await jsonExists(path.join(runDir, 'complete.json'));
      pending = await readJson(path.join(runDir, 'pending.json'), MAX_BODY_BYTES + 16 * 1024);
      const canonical = validateBatch(pending.batch);
      if (pending.contentHash !== hashBatch(canonical) || canonical.sourceId !== manifest.sourceId) throw operationError('pending_batch_integrity_failed');
      pending.batch = canonical;
      validateFreshnessPolicy(manifest.freshnessPolicy);
      if (completed) {
        if (completed.schemaVersion !== 1 || completed.runId !== runId || completed.state !== 'submitted' || completed.sourceId !== canonical.sourceId
          || completed.batchId !== canonical.batchId || completed.contentHash !== pending.contentHash || typeof completed.duplicate !== 'boolean') throw operationError('invalid_job_completion');
        return { ...completed, alreadyComplete: true };
      }
    } else {
      const config = validateCollectorConfig(await readJson(configPath, 64 * 1024));
      if (config.source.type === 'file') {
        const filename = path.resolve(path.dirname(configPath), config.source.path);
        await safeDirectory(path.dirname(filename), { create: false });
        const stat = await fs.lstat(filename);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BODY_BYTES) throw operationError('unsafe_source_file');
      }
      runId = `${now().replace(/[-:.]/g, '')}-${randomUUID()}`;
      if (!RUN_ID.test(runId)) throw operationError('invalid_job_clock');
      runDir = await safeDirectory(path.join(runs, runId));
      manifest = { schemaVersion: 1, runId, sourceId: config.sourceId, startedAt: now(), endpointHash: targetHash, freshnessPolicy: validateFreshnessPolicy(policy) };
      await writeJson(path.join(runDir, 'manifest.json'), manifest);
      try {
        const batch = await collectBatch(config, { baseDir: path.dirname(path.resolve(configPath)), fetchImpl });
        pending = { batch, contentHash: hashBatch(batch), fetchedAt: now() };
        await writeJson(path.join(runDir, 'pending.json'), pending, MAX_BODY_BYTES + 16 * 1024);
      } catch {
        await writeJson(path.join(runDir, 'collection-failed.json'), { failedAt: now(), code: 'collection_failed', action: 'Start a new run after correcting the source; no batch was frozen for submission.' });
        return { runId, sourceId: config.sourceId, state: 'collection_failed' };
      }
    }
    const existingAttempts = (await fs.readdir(runDir)).filter(name => /^attempt-\d{4}-started.json$/.test(name)).length;
    if (existingAttempts + attempts > 1000) throw operationError('attempt_history_limit');
    const freshness = evaluateFreshness(pending.batch, { policy: manifest.freshnessPolicy, fetchedAt: pending.fetchedAt, now: now() });
    if (existingAttempts) {
      const priorFailure = await jsonExists(path.join(runDir, `attempt-${String(existingAttempts).padStart(4, '0')}-failed.json`));
      if (priorFailure?.retryNotBeforeAt && Date.parse(priorFailure.retryNotBeforeAt) > Date.parse(now())) {
        return { runId, sourceId: pending.batch.sourceId, batchId: pending.batch.batchId, state: 'submission_deferred', retryNotBeforeAt: priorFailure.retryNotBeforeAt, freshness };
      }
    }
    for (let index = 0; index < attempts; index++) {
      const attemptNumber = existingAttempts + index + 1;
      const prefix = path.join(runDir, `attempt-${String(attemptNumber).padStart(4, '0')}`);
      await writeJson(`${prefix}-started.json`, { startedAt: now(), batchId: pending.batch.batchId, contentHash: pending.contentHash });
      try {
        const result = await submitBatch(pending.batch, endpoint, { token, fetchImpl, retries: 0 });
        const complete = { schemaVersion: 1, runId, sourceId: pending.batch.sourceId, batchId: pending.batch.batchId, contentHash: pending.contentHash,
          state: 'submitted', observationCount: pending.batch.observations.length, completedAt: now(), duplicate: result.duplicate,
          attempts: attemptNumber, freshness: evaluateFreshness(pending.batch, { policy: manifest.freshnessPolicy, fetchedAt: pending.fetchedAt, receivedAt: result.receivedAt, now: now() }) };
        await writeJson(path.join(runDir, 'complete.json'), complete);
        return complete;
      } catch (error) {
        const code = safeFailure(error);
        const retryNotBeforeAt = error.status === 429 || error.retryAfterSeconds > 5
          ? new Date(Date.parse(now()) + Math.max(1, error.retryAfterSeconds ?? 60) * 1000).toISOString() : null;
        await writeJson(`${prefix}-failed.json`, { failedAt: now(), code, retryNotBeforeAt, action: 'Resume this run to replay the same frozen batch after retryNotBeforeAt, when present.' });
        if (retryNotBeforeAt) return { runId, sourceId: pending.batch.sourceId, batchId: pending.batch.batchId, state: 'submission_deferred', code, retryNotBeforeAt, freshness };
        const terminal = /^submission_http_(?:400|401|403|404|405|409|413|415|422)$/.test(code);
        if (index === attempts - 1 || terminal) return { runId, sourceId: pending.batch.sourceId, batchId: pending.batch.batchId, state: 'submission_failed', code, freshness };
        await sleep(Math.min(250 * 2 ** index, 2000));
      }
    }
  } finally { await lock.release(); }
}
