import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA_FIELDS } from '../../shared/dataFields.mjs';
import { validateBatch, hashBatch } from '../../server/model-inputs/contract.mjs';
import { validateCmsPayload, inspectCmsPayload, checkDraft, contentHash } from '../../server/admin-data/contract.mjs';

export const stationBatch = {
  schemaVersion: 1, sourceId: 'cms-test', batchId: 'zero-rain-v1',
  observations: [{ stationId: 'TEST-001', observedAt: '2026-09-01T07:00:00+07:00', metric: 'rainfall',
    value: 0, unit: 'mm', aggregation: 'sum', periodMinutes: 60, quality: 'reported', sourceRecordId: '001' }],
};

test('CMS and integration accept the same fields, normalized values and content hash', () => {
  const accepted = validateCmsPayload('station', stationBatch);
  assert.deepEqual(accepted, validateBatch(stationBatch));
  assert.equal(contentHash(accepted), hashBatch(validateBatch(stationBatch)));
  assert.equal(accepted.observations[0].value, 0);
  assert.equal(accepted.observations[0].sourceRecordId, '001');
  assert.equal(accepted.observations[0].observedAt, '2026-09-01T00:00:00.000Z');
  assert.deepEqual(DATA_FIELDS.station.map(field => field.key).sort(), Object.keys(stationBatch.observations[0]).sort());
});

test('invalid rows remain repairable but can never pass acceptance validation', () => {
  const payload = structuredClone(stationBatch);
  payload.observations[0].value = null;
  assert.doesNotThrow(() => checkDraft({ title: 'Repair', kind: 'station', sourceFilename: 'rain.xlsx', payload }));
  const report = inspectCmsPayload('station', payload);
  assert.equal(report.valid, false);
  assert.equal(report.issues[0].row, 1);
  payload.observations[0].quality = 'missing';
  assert.equal(inspectCmsPayload('station', payload).valid, true);
  assert.equal(validateCmsPayload('station', payload).observations[0].value, null);
});

test('unknown fields, duplicate identities, invalid dates, mismatched kinds are not silently dropped', () => {
  for (const row of [
    { ...stationBatch.observations[0], unrecognized: 5 },
    { ...stationBatch.observations[0], observedAt: '2026-02-30T00:00:00Z' },
    { ...stationBatch.observations[0], unit: 'cm' },
  ]) assert.equal(inspectCmsPayload('station', { ...stationBatch, observations: [row] }).valid, false);
  assert.equal(inspectCmsPayload('station', { ...stationBatch, observations: Array(2).fill(stationBatch.observations[0]) }).valid, false);
  assert.throws(() => validateCmsPayload('satellite', stationBatch));
});

test('satellite optional provenance fields survive CMS exactly as they do API ingestion', () => {
  const batch = { schemaVersion: 1, sourceId: 'cms-test', batchId: 'sat-v1', kind: 'satellite', observations: [{
    subdistrictCode: '300101', period: '2026-08', availableAt: '2026-09-01T00:00:00Z', metric: 'ndvi', value: 0,
    unit: '1', quality: 'reported', validPixelFraction: 0.9, product: 'TEST', productVersion: '1', processingVersion: '1',
    resolutionMeters: 250, spatialAggregation: 'area_weighted_mean', temporalAggregation: 'mean',
    geometryVersion: '1', maskVersion: '1', nativeSupportMeters: 500, sourceArtifactHash: 'a'.repeat(64), sourceRecordId: '001',
  }] };
  assert.deepEqual(validateCmsPayload('satellite', batch), validateBatch(batch));
  assert.deepEqual(DATA_FIELDS.satellite.map(field => field.key).sort(), Object.keys(batch.observations[0]).sort());
  batch.observations[0].subdistrictCode = '100101';
  assert.equal(inspectCmsPayload('satellite', batch).valid, false);
});

test('crop nullable fields and denominator are retained, not replaced with derived values', () => {
  const batch = { schemaVersion: 1, sourceId: 'cms-test', batchId: 'crop-v1', kind: 'crop', observations: [{
    subdistrictCode: '300101', cropCode: 'rice', seasonId: '2025', periodType: 'calendar_year',
    periodStart: '2025-01-01', periodEnd: '2025-12-31', availableAt: '2026-01-01T00:00:00Z', agency: 'DOAE',
    datasetVersion: '1', plantedAreaRai: 0, harvestedAreaRai: null, productionTonnes: null, yieldKgPerRai: null,
    yieldAreaBasis: 'unspecified', quality: 'reported', sourceRecordId: '001',
  }] };
  assert.deepEqual(validateCmsPayload('crop', batch), validateBatch(batch));
  assert.deepEqual(DATA_FIELDS.crop.map(field => field.key).sort(), Object.keys(batch.observations[0]).sort());
});
