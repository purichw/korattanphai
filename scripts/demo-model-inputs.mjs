import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { startModelInputServer } from './serve-model-inputs.mjs';
import { prepareModelRequest, forecastCellsForReview } from '../server/model-inputs/model-contract.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const demoRoot = join(projectRoot, 'artifacts/model-input-demo');
await mkdir(demoRoot, { recursive: true });
const directory = await mkdtemp(join(demoRoot, 'run-'));
const token = randomBytes(32).toString('hex');
const fixture = await readFile(join(projectRoot, 'examples/model-inputs/local-weather.csv'));
const upstream = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
  response.end(fixture);
});
let api;
const close = (server) => new Promise((done) => {
  if (!server?.listening) return done();
  server.close(done);
  server.closeIdleConnections();
});
try {
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const config = JSON.parse(await readFile(join(projectRoot, 'examples/model-inputs/local-csv.config.json'), 'utf8'));
  config.source = { type: 'http', url: `http://127.0.0.1:${upstream.address().port}/observations.csv`, allowHttp: true };
  const configPath = join(directory, 'source.config.json');
  await writeFile(configPath, JSON.stringify(config, null, 2), { flag: 'wx', mode: 0o600 });
  const env = { MODEL_INPUT_API_TOKEN: token, MODEL_INPUT_SOURCE_ID: 'local-demo', MODEL_INPUT_PORT: '0', MODEL_INPUT_DATA_DIR: join(directory, 'batches') };
  api = startModelInputServer(env);
  await once(api, 'listening');
  let endpoint = `http://127.0.0.1:${api.address().port}/api/model-inputs`;
  const runCollector = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/collect-model-inputs.mjs', '--config', configPath, '--submit', endpoint], {
      cwd: projectRoot, env: { ...process.env, MODEL_INPUT_API_TOKEN: token }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '', errors = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) return reject(new Error(errors || 'Demo collector failed.'));
      try { resolve(JSON.parse(output)); } catch { reject(new Error('Invalid collector receipt.')); }
    });
  });
  const first = await runCollector();
  const repeat = await runCollector();
  assert.equal(first.status, 201);
  assert.equal(repeat.status, 200);
  assert.equal(first.batchId, repeat.batchId);
  await close(api);
  api = startModelInputServer(env);
  await once(api, 'listening');
  endpoint = `http://127.0.0.1:${api.address().port}/api/model-inputs`;
  const response = await fetch(`${endpoint}?batchId=${encodeURIComponent(first.batchId)}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  const batch = await response.json();
  assert(batch.observations.some((row) => row.value === 0 && row.quality === 'reported'));
  assert(batch.observations.some((row) => row.value === null && row.quality === 'missing'));
  const outputPath = join(directory, 'model-readable-batch.json');
  await writeFile(outputPath, `${JSON.stringify(batch, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  // The two domain fixtures exercise the same API with the model team's source ID.
  await close(api);
  env.MODEL_INPUT_SOURCE_ID = 'korat-model-team';
  api = startModelInputServer(env);
  await once(api, 'listening');
  endpoint = `http://127.0.0.1:${api.address().port}/api/model-inputs`;
  const typedBatches = [];
  for (const filename of ['satellite-features.config.json', 'doae-crop-yield.config.json']) {
    const { collectBatch, loadCollectorConfig, submitBatch } = await import('../server/model-inputs/collector.mjs');
    const { config: typedConfig, baseDir } = await loadCollectorConfig(join(projectRoot, 'examples/model-inputs', filename));
    const typedBatch = await collectBatch(typedConfig, { baseDir });
    const receipt = await submitBatch(typedBatch, endpoint, { token });
    assert.equal(receipt.status, 201);
    const persisted = await fetch(`${endpoint}?batchId=${typedBatch.batchId}`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(persisted.status, 200);
    typedBatches.push(await persisted.json());
  }
  const modelRequest = prepareModelRequest({ batches: typedBatches, originMonth: '2026-08', informationCutoff: '2026-09-08T00:00:00Z', subdistrictCodes: ['300806'] });
  const modelRequestPath = join(directory, 'satellite-crop-model-request.json');
  await writeFile(modelRequestPath, `${JSON.stringify(modelRequest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  const exampleResult = {
    schemaVersion: 1, runId: 'example-only-no-model-run', modelVersion: 'untrained-contract-example',
    originMonth: modelRequest.originMonth, informationCutoff: modelRequest.informationCutoff,
    createdAt: '2026-09-08T00:00:00.000Z', scope: modelRequest.scope, inputBatches: modelRequest.inputBatches,
    predictions: modelRequest.horizons.map((horizonMonths) => ({
      subdistrictCode: '300806', horizonMonths,
      targetMonth: new Date(Date.UTC(2026, 7 + horizonMonths, 1)).toISOString().slice(0, 7),
      status: 'insufficient_data', riskCode: null,
    })),
  };
  const resultPath = join(directory, 'forecast-result-contract-example.json');
  await writeFile(resultPath, `${JSON.stringify(exampleResult, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  const reviewCells = forecastCellsForReview(exampleResult);
  assert.deepEqual(reviewCells.map((row) => row.targetMonth), ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
  console.log(JSON.stringify({
    demonstration: 'Synthetic station, satellite and crop data; no provider or production connection.',
    source: 'Local HTTP CSV', firstSubmission: first.status, repeatedSubmission: repeat.status,
    batchId: batch.batchId, observationCount: batch.observations.length,
    persistedAfterRestart: true, missingAndZeroPreserved: true, outputPath,
    satelliteAndCropBatchesReadFromApi: typedBatches.length,
    modelRequestPath, forecastContractExamplePath: resultPath,
    completeFeatureMonths: modelRequest.completeFeatureMonths,
    forecastCells: reviewCells.length, modelExecuted: false, forecastPublished: false,
  }, null, 2));
} finally {
  await close(api);
  await close(upstream);
}
