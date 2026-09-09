import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InputError, hashBatch, validateBatch } from '../../server/model-inputs/contract.mjs';
import { prepareModelRequest, validateForecastResult, forecastCellsForReview } from '../../server/model-inputs/model-contract.mjs';

const code = '300806';
const hash = 'a'.repeat(64);
const invalid = error => error instanceof InputError && error.status === 400;
const satellite = (changes = {}) => ({
  subdistrictCode: code, period: '2025-12', availableAt: '2026-01-01T00:00:00Z',
  metric: 'ndvi', value: -0.2, unit: '1', quality: 'reported', validPixelFraction: 0.8,
  product: 'test-satellite', productVersion: 'v1', processingVersion: 'qa-v1', resolutionMeters: 250,
  spatialAggregation: 'area_weighted_mean', temporalAggregation: 'mean', ...changes,
});
const crop = (changes = {}) => ({
  subdistrictCode: code, cropCode: 'rice', seasonId: '2025-annual', periodType: 'calendar_year', periodStart: '2025-01-01', periodEnd: '2025-12-31',
  availableAt: '2026-01-01T00:00:00Z', agency: 'DOAE', datasetVersion: 'test-v1',
  plantedAreaRai: 100, harvestedAreaRai: 90, productionTonnes: 45, yieldKgPerRai: 500, yieldAreaBasis: 'harvested', quality: 'reported', ...changes,
});
const batch = (kind, observations, changes = {}) => ({ schemaVersion: 1, sourceId: `${kind}-feed`, batchId: 'batch-1', kind, observations, ...changes });
const request = (batches, changes = {}) => prepareModelRequest({
  batches, originMonth: '2025-12', informationCutoff: '2026-01-02T07:00:00+07:00', subdistrictCodes: [code], ...changes,
});
const result = (changes = {}) => ({
  schemaVersion: 1, runId: 'run-1', modelVersion: 'model-team-v1', originMonth: '2025-12',
  informationCutoff: '2026-01-02T07:00:00+07:00', createdAt: '2026-01-02T08:00:00+07:00',
  scope: { subdistrictCodes: [code] }, inputBatches: [{ sourceId: 'satellite-feed', batchId: 'batch-1', contentHash: hash }],
  predictions: [
    { horizonMonths: 1, status: 'predicted', riskCode: 0 },
    { horizonMonths: 2, status: 'predicted', riskCode: 1 },
    { horizonMonths: 3, status: 'predicted', riskCode: 2 },
    { horizonMonths: 4, status: 'out_of_scope', riskCode: null },
    { horizonMonths: 5, status: 'insufficient_data', riskCode: null },
    { horizonMonths: 6, status: 'predicted', riskCode: 0 },
  ].map(row => ({ subdistrictCode: code, targetMonth: `2026-0${row.horizonMonths}`, ...row })),
  ...changes,
});

test('model handoff labels the 36-month history and 0.5 pixel threshold as explicit draft assumptions', () => {
  const input = batch('satellite', [satellite()]);
  const original = structuredClone(input);
  const prepared = request([input]);
  assert.equal(prepared.featureSchema, 'satellite-crop-v1-draft');
  assert.deepEqual(prepared.assumptions, { historyMonths: 36, minimumValidPixelFraction: 0.5,
    requiredMetrics: ['precipitation', 'ndvi', 'land_surface_temperature'] });
  assert.deepEqual(prepared.horizons, [1, 2, 3, 4, 5, 6]);
  assert.equal(prepared.monthlyFeatures.length, 36);
  assert.equal(prepared.monthlyFeatures[0].period, '2023-01');
  assert.equal(prepared.monthlyFeatures.at(-1).period, '2025-12');
  assert.equal(prepared.informationCutoff, '2026-01-02T00:00:00.000Z');
  assert.deepEqual(input, original);
  assert.equal(Object.hasOwn(prepared, 'predictions'), false);
});

test('as-of filtering excludes later publications, future periods and other scopes without imputing zero', () => {
  const observations = [
    satellite(),
    satellite({ metric: 'ndmi', availableAt: '2026-01-03T00:00:00Z' }),
    satellite({ metric: 'precipitation', unit: 'mm', temporalAggregation: 'sum', value: 0, availableAt: '2026-01-02T07:00:00+07:00' }),
    satellite({ metric: 'soil_moisture', unit: 'm3/m3', value: null, quality: 'missing', validPixelFraction: 0 }),
    satellite({ subdistrictCode: '300807' }),
  ];
  const prepared = request([batch('satellite', observations)], { historyMonths: 1 });
  const row = prepared.monthlyFeatures[0];
  assert.equal(row.features.ndvi.value, -0.2);
  assert.equal(row.features.precipitation.value, 0);
  assert.equal(row.features.ndmi, null);
  assert.equal(row.features.land_surface_temperature, null);
  assert.equal(row.features.soil_moisture.value, null);
  assert.deepEqual(row.missingOrUnusableMetrics, ['land_surface_temperature']);
  assert.deepEqual(prepared.excluded, { afterCutoff: 1, outsideScopeOrWindow: 1 });
  assert.equal(prepared.completeFeatureMonths, 0);
  // A later cutoff still must not admit a month after the chosen forecast origin.
  const future = request([batch('satellite', [satellite(), satellite({ period: '2026-01', availableAt: '2026-02-01T00:00:00Z' })])],
    { informationCutoff: '2026-02-02T00:00:00Z', historyMonths: 1 });
  assert.equal(future.excluded.outsideScopeOrWindow, 1);
  assert.deepEqual(future.monthlyFeatures.map(item => item.period), ['2025-12']);
});

test('validity flags distinguish low pixel coverage and suspect observations from usable reported metrics', () => {
  const rows = [
    satellite({ validPixelFraction: 0.5 }),
    satellite({ metric: 'ndmi', validPixelFraction: 0.499 }),
    satellite({ metric: 'precipitation', unit: 'mm', temporalAggregation: 'sum', value: 0 }),
    satellite({ metric: 'land_surface_temperature', unit: 'degC', value: 20, quality: 'suspect' }),
    satellite({ metric: 'soil_moisture', unit: 'm3/m3', value: 0.25 }),
  ];
  const requiredMetrics = ['precipitation', 'ndvi', 'ndmi', 'land_surface_temperature', 'soil_moisture'];
  const prepared = request([batch('satellite', rows)], { historyMonths: 1, requiredMetrics });
  assert.deepEqual(prepared.monthlyFeatures[0].missingOrUnusableMetrics, ['ndmi', 'land_surface_temperature']);
  assert.equal(prepared.monthlyFeatures[0].features.ndmi.value, -0.2, 'Raw provenance remains available alongside the unusable flag');
  const complete = request([batch('satellite', rows.map(row => ({ ...row, quality: 'reported' })))],
    { historyMonths: 1, minimumValidPixelFraction: 0.4, requiredMetrics });
  assert.equal(complete.completeFeatureMonths, 1);
  assert.deepEqual(complete.monthlyFeatures[0].missingOrUnusableMetrics, []);
});

test('optional NDMI and soil moisture are retained in the feature schema without silently becoming mandatory', () => {
  const rows = [satellite(), satellite({ metric: 'precipitation', unit: 'mm', temporalAggregation: 'sum', value: 0 }),
    satellite({ metric: 'land_surface_temperature', unit: 'degC', value: 24 })];
  const optional = request([batch('satellite', rows)], { historyMonths: 1 });
  assert.equal(optional.completeFeatureMonths, 1);
  assert.deepEqual(optional.monthlyFeatures[0].missingOrUnusableMetrics, []);
  assert.equal(optional.monthlyFeatures[0].features.ndmi, null);
  assert.equal(optional.monthlyFeatures[0].features.soil_moisture, null);
  const configured = request([batch('satellite', rows)], { historyMonths: 1,
    requiredMetrics: ['precipitation', 'ndvi', 'ndmi', 'land_surface_temperature', 'soil_moisture'] });
  assert.equal(configured.completeFeatureMonths, 0);
  assert.deepEqual(configured.monthlyFeatures[0].missingOrUnusableMetrics, ['ndmi', 'soil_moisture']);
});

test('crop outputs retain one annual record instead of being copied into monthly satellite features', () => {
  const rows = [crop(), crop({ cropCode: 'cassava', availableAt: '2026-01-03T00:00:00Z' })];
  const prepared = request([batch('crop', rows)], { historyMonths: 12 });
  assert.equal(prepared.historicalCropOutcomes.length, 1);
  assert.equal(prepared.historicalCropOutcomes[0].seasonId, '2025-annual');
  assert.equal(prepared.historicalCropOutcomes[0].periodType, 'calendar_year');
  assert.equal(prepared.historicalCropOutcomes[0].periodStart, '2025-01-01');
  assert.equal(prepared.historicalCropOutcomes[0].periodEnd, '2025-12-31');
  assert.equal(prepared.historicalCropOutcomes[0].yieldAreaBasis, 'harvested');
  assert.equal(prepared.historicalCropOutcomes[0].yieldKgPerRai, 500);
  assert.equal(prepared.monthlyFeatures.length, 12);
  assert.ok(prepared.monthlyFeatures.every(row => Object.values(row.features).every(value => value === null)));
  assert.equal(prepared.excluded.afterCutoff, 1);
  const futureCrop = request([batch('crop', [crop({ periodType: 'crop_season', seasonId: '2025-main', periodStart: '2025-09-01', periodEnd: '2026-01-31', availableAt: '2026-02-01T00:00:00Z' })])],
    { informationCutoff: '2026-02-02T00:00:00Z', historyMonths: 1 });
  assert.deepEqual(futureCrop.historicalCropOutcomes, []);
  assert.equal(futureCrop.excluded.outsideScopeOrWindow, 1);
});

test('history-window boundaries and canonical scope are explicit and reject invalid run configurations', () => {
  const prepared = request([batch('satellite', [satellite(), satellite({ period: '2025-10', availableAt: '2025-11-01T00:00:00Z' })])],
    { historyMonths: 2, subdistrictCodes: ['300807', code] });
  assert.deepEqual(prepared.scope.subdistrictCodes, [code, '300807']);
  assert.equal(prepared.monthlyFeatures.length, 4);
  assert.equal(prepared.excluded.outsideScopeOrWindow, 1);
  for (const changes of [{ subdistrictCodes: ['309999'] }, { subdistrictCodes: ['บ้านเก่า'] }, { subdistrictCodes: [code, code] },
    { subdistrictCodes: [] }, { historyMonths: 0 }, { historyMonths: 121 }, { historyMonths: 1.5 },
    { minimumValidPixelFraction: -0.1 }, { minimumValidPixelFraction: 1.1 }, { minimumValidPixelFraction: Infinity },
    { informationCutoff: '2025-12-31T23:59:59Z' }, { originMonth: '2025-13' }, { originMonth: '2568-12' }]) {
    assert.throws(() => request([batch('satellite', [satellite()])], changes), invalid);
  }
});

test('input hashes survive canonical timestamps and stored metadata while tampering and overlapping versions fail closed', () => {
  const original = batch('satellite', [satellite()]);
  const normalized = validateBatch(original);
  const signed = { ...original, receivedAt: '2026-01-04T00:00:00Z', contentHash: hashBatch(normalized) };
  assert.equal(request([signed, structuredClone(signed)], { historyMonths: 1 }).inputBatches.length, 1);
  const offsetEquivalent = { ...signed, observations: [satellite({ availableAt: '2026-01-01T07:00:00+07:00' })] };
  assert.equal(request([offsetEquivalent], { historyMonths: 1 }).inputBatches[0].contentHash, signed.contentHash);
  assert.throws(() => request([{ ...signed, observations: [satellite({ value: 0.4 })] }]), /contentHash/);
  assert.throws(() => request([{ ...signed, contentHash: 'b'.repeat(64) }]), /contentHash/);
  assert.throws(() => request([original, batch('satellite', [satellite({ value: 0.3 })])]), /Conflicting input batch versions/);
  assert.throws(() => request([original, batch('satellite', [satellite({ productVersion: 'v2' })], { batchId: 'batch-2' })]), /Overlapping satellite versions/);
  assert.throws(() => request([batch('crop', [crop()]), batch('crop', [crop({ datasetVersion: 'test-v2' })], { batchId: 'batch-2' })]), /Overlapping crop outcome versions/);
});

test('forecast result accepts every explicit risk/availability category and projects T+1–T+6 through the year boundary', () => {
  const value = result();
  const normalized = validateForecastResult(value);
  assert.equal(normalized.informationCutoff, '2026-01-02T00:00:00.000Z');
  assert.equal(normalized.createdAt, '2026-01-02T01:00:00.000Z');
  const cells = forecastCellsForReview(value);
  assert.deepEqual(cells.map(cell => cell.horizonMonths), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(cells.map(cell => cell.targetMonth), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  assert.deepEqual(cells.map(cell => cell.risk), [0, 1, 2, null, null, 0]);
  assert.deepEqual(cells.map(cell => cell.status), ['predicted', 'predicted', 'predicted', 'out_of_scope', 'insufficient_data', 'predicted']);
  assert.ok(cells.every(cell => cell.sourceMonth === '2025-12' && cell.subdistrictCode === code));
});

test('each scoped area requires all six unique horizons with exact forward months', () => {
  const value = result();
  const secondArea = value.predictions.map(row => ({ ...row, subdistrictCode: '300807' }));
  const twoAreas = result({ scope: { subdistrictCodes: ['300807', code] }, predictions: [...value.predictions, ...secondArea] });
  assert.deepEqual(validateForecastResult(twoAreas).scope.subdistrictCodes, [code, '300807']);
  for (const predictions of [value.predictions.slice(0, 5), [...value.predictions, value.predictions[0]],
    value.predictions.map((row, index) => index === 5 ? { ...value.predictions[0] } : row),
    value.predictions.map((row, index) => index === 0 ? { ...row, horizonMonths: 0 } : row),
    value.predictions.map((row, index) => index === 0 ? { ...row, targetMonth: '2025-12' } : row),
    value.predictions.map((row, index) => index === 0 ? { ...row, subdistrictCode: '300807' } : row)]) {
    assert.throws(() => validateForecastResult(result({ predictions })), invalid);
  }
});

test('risk/status mismatch never converts missing evidence into no-risk predictions', () => {
  for (const changes of [{ status: 'predicted', riskCode: null }, { status: 'predicted', riskCode: 3 },
    { status: 'predicted', riskCode: '0' }, { status: 'predicted', riskCode: false },
    { status: 'out_of_scope', riskCode: 0 }, { status: 'insufficient_data', riskCode: 1 }, { status: 'normal', riskCode: 0 }]) {
    const value = result(); value.predictions[0] = { ...value.predictions[0], ...changes };
    assert.throws(() => validateForecastResult(value), invalid);
    assert.throws(() => forecastCellsForReview(value), invalid);
  }
});

test('result provenance, scope, timestamps and exact envelope keys are mandatory before review', () => {
  for (const changes of [{ modelVersion: '' }, { runId: '../run' }, { scope: { subdistrictCodes: ['309999'] } },
    { createdAt: '2026-01-01T00:00:00Z' }, { informationCutoff: '2025-12-31T23:59:59Z' },
    { inputBatches: [] }, { inputBatches: [{ sourceId: 'satellite-feed', batchId: 'batch-1', contentHash: 'invalid' }] },
    { inputBatches: [result().inputBatches[0], result().inputBatches[0]] }, { confidence: 0.99 }]) {
    assert.throws(() => validateForecastResult(result(changes)), invalid);
  }
  const extraCell = result(); extraCell.predictions[0].confidence = 0.99;
  assert.throws(() => validateForecastResult(extraCell), invalid);
});
