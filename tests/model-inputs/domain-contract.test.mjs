import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { normalizeTimestamp, InputError } from '../../server/model-inputs/contract.mjs';
import { isKoratSubdistrict, validateDomainBatch } from '../../server/model-inputs/domain-contract.mjs';

const dependencies = { normalizeTimestamp, InputError };
const satellite = (changes = {}) => ({
  subdistrictCode: '300806', period: '2026-08', availableAt: '2026-09-01T07:00:00+07:00',
  metric: 'ndvi', value: -0.2, unit: '1', quality: 'reported', validPixelFraction: 0.8,
  product: 'SATELLITE_PRODUCT', productVersion: 'v1', processingVersion: 'mask-v2', resolutionMeters: 250,
  spatialAggregation: 'area_weighted_mean', temporalAggregation: 'mean', ...changes,
});
const crop = (changes = {}) => ({
  subdistrictCode: '300806', cropCode: 'rice', seasonId: '2025-main', periodType: 'crop_season', periodStart: '2025-11-01',
  periodEnd: '2026-01-31', availableAt: '2026-02-01T07:00:00+07:00', agency: 'DOAE', datasetVersion: '2026-release-1',
  plantedAreaRai: 100, harvestedAreaRai: 90, productionTonnes: 45, yieldKgPerRai: 500, yieldAreaBasis: 'harvested', quality: 'reported', ...changes,
});
const envelope = (kind, observations) => ({ schemaVersion: 1, sourceId: `${kind}-feed`, batchId: 'batch-1', kind, observations });
const validate = (kind, rows) => validateDomainBatch(envelope(kind, rows), dependencies);
const invalid = error => error instanceof InputError && error.status === 400 && error.code === 'invalid_batch';

test('Korat joins accept exactly the real 289 subdistrict codes, not names or plausible unassigned codes', () => {
  const matrix = JSON.parse(readFileSync(new URL('../../src/data/canonical/nakhon_ratchasima/district_subdistrict_matrix.json', import.meta.url), 'utf8'));
  assert.equal(matrix.length, 289);
  assert.ok(matrix.every(row => isKoratSubdistrict(row.subdistrict_code)));
  for (const code of ['30', '3008', '309999', '100101', 't-300806', 'บ้านเก่า', 300806, null]) assert.equal(isKoratSubdistrict(code), false);
});

test('satellite normalization preserves negative NDVI, zero, provenance, missing values and UTC availability without mutating input', () => {
  const input = envelope('satellite', [satellite({ product: ' SATELLITE_PRODUCT ', sourceRecordId: 'row:1' }),
    satellite({ metric: 'ndmi', value: 0 }),
    satellite({ metric: 'soil_moisture', unit: 'm3/m3', value: null, quality: 'missing', validPixelFraction: 0 })]);
  const before = structuredClone(input);
  const result = validateDomainBatch(input, dependencies);
  assert.deepEqual(input, before);
  assert.equal(result.kind, 'satellite');
  assert.equal(result.observations[0].value, -0.2);
  assert.equal(result.observations[0].availableAt, '2026-09-01T00:00:00.000Z');
  assert.equal(result.observations[0].product, 'SATELLITE_PRODUCT');
  assert.equal(result.observations[0].sourceRecordId, 'row:1');
  assert.equal(result.observations[1].value, 0);
  assert.equal(result.observations[2].value, null);
});

test('satellite metrics enforce their own units, finite ranges and monthly aggregation', () => {
  for (const row of [satellite({ value: -1 }), satellite({ value: 1 }), satellite({ metric: 'land_surface_temperature', unit: 'degC', value: -15 }),
    satellite({ metric: 'precipitation', unit: 'mm', temporalAggregation: 'sum', value: 0 }),
    satellite({ metric: 'soil_moisture', unit: 'm3/m3', value: 1, spatialAggregation: 'coarse_grid_proxy' })]) {
    assert.equal(validate('satellite', [row]).observations[0].value, row.value);
  }
  for (const changes of [{ value: -1.01 }, { value: 1.01 }, { value: Infinity }, { value: NaN }, { value: '0.2' },
    { unit: '%' }, { metric: 'temperature' }, { temporalAggregation: 'sum' }, { spatialAggregation: 'nearest_tambon' },
    { metric: 'precipitation', unit: 'mm', temporalAggregation: 'sum', value: -1 },
    { metric: 'precipitation', unit: 'mm', temporalAggregation: 'mean', value: 1 },
    { metric: 'soil_moisture', unit: 'm3/m3', value: 1.1 }, { metric: 'soil_moisture', unit: '%', value: 0.5 }]) {
    assert.throws(() => validate('satellite', [satellite(changes)]), invalid);
  }
});

test('satellite availability cannot leak an unfinished monthly observation, including offset/calendar boundaries', () => {
  assert.equal(validate('satellite', [satellite({ period: '2024-02', availableAt: '2024-03-01T00:00:00Z' })]).observations[0].period, '2024-02');
  for (const changes of [{ period: '2026-13' }, { period: '2569-08' }, { period: '1899-08' }, { period: '2101-08' },
    { availableAt: '2026-08-31T23:59:59.999Z' }, { availableAt: '2026-09-01T00:00:00+07:00' },
    { availableAt: '2026-09-01T00:00:00' }, { availableAt: '2026-02-30T00:00:00Z' }, { availableAt: '2026-09-01' }]) {
    assert.throws(() => validate('satellite', [satellite(changes)]), invalid);
  }
});

test('satellite quality, pixel coverage, spatial resolution and source provenance are explicit', () => {
  assert.equal(validate('satellite', [satellite({ quality: 'suspect' })]).observations[0].quality, 'suspect');
  for (const changes of [{ value: null }, { quality: 'missing' }, { value: null, quality: 'suspect' },
    { validPixelFraction: 0 }, { validPixelFraction: -0.1 }, { validPixelFraction: 1.1 }, { validPixelFraction: null },
    { resolutionMeters: 0 }, { resolutionMeters: Infinity }, { product: '' }, { productVersion: ' ' },
    { processingVersion: 'ใหม่' }, { product: 'x'.repeat(129) }, { productVersion: 'bad\nversion' }, { sourceRecordId: '' }]) {
    assert.throws(() => validate('satellite', [satellite(changes)]), invalid);
  }
});

test('DOAE crop records preserve declared period grain, independent measures and explicit missingness', () => {
  const first = crop({ plantedAreaRai: 1, harvestedAreaRai: 2, productionTonnes: 999, yieldKgPerRai: 123 });
  const result = validate('crop', [first]);
  assert.equal(result.kind, 'crop');
  assert.equal(result.observations[0].periodType, 'crop_season');
  assert.equal(result.observations[0].periodStart, '2025-11-01');
  assert.equal(result.observations[0].periodEnd, '2026-01-31');
  assert.equal(result.observations[0].yieldAreaBasis, 'harvested');
  assert.equal(result.observations[0].availableAt, '2026-02-01T00:00:00.000Z');
  for (const key of ['plantedAreaRai', 'harvestedAreaRai', 'productionTonnes', 'yieldKgPerRai']) assert.equal(result.observations[0][key], first[key]);
  const missing = crop({ plantedAreaRai: null, harvestedAreaRai: null, productionTonnes: null, yieldKgPerRai: null, quality: 'missing' });
  assert.equal(validate('crop', [missing]).observations[0].yieldKgPerRai, null);
  const partial = crop({ plantedAreaRai: null, harvestedAreaRai: 0, productionTonnes: null, yieldKgPerRai: null, quality: 'suspect' });
  assert.equal(validate('crop', [partial]).observations[0].harvestedAreaRai, 0);
});

test('crop records reject invalid periods, availability, identifiers, agency, negative measurements and misleading missing quality', () => {
  for (const changes of [{ periodStart: '2026-02-01' }, { periodStart: '2025-02-29' }, { periodEnd: '2026-02-30' },
    { periodStart: '2568-11-01' }, { periodEnd: '2026-01' }, { availableAt: '2026-01-31T23:59:59.999Z' },
    { availableAt: '2026-02-01T00:00:00+07:00' }, { cropCode: '../rice' }, { seasonId: 'ฤดูหลัก' },
    { agency: 'OAE' }, { datasetVersion: '' }, { plantedAreaRai: -1 }, { harvestedAreaRai: Infinity },
    { productionTonnes: '45' }, { yieldKgPerRai: NaN }, { quality: 'missing' }, { periodType: 'fiscal_year' }, { yieldAreaBasis: 'inferred' },
    { plantedAreaRai: null, harvestedAreaRai: null, productionTonnes: null, yieldKgPerRai: null, quality: 'reported' }]) {
    assert.throws(() => validate('crop', [crop(changes)]), invalid);
  }
  assert.equal(validate('crop', [crop({ periodStart: '2024-02-29', periodEnd: '2024-02-29', availableAt: '2024-03-01T00:00:00Z' })]).observations[0].periodStart, '2024-02-29');
});

test('annual crop records declare a full Gregorian calendar year and never invent harvest dates or yield basis', () => {
  const annual = crop({ seasonId: '2025-annual', periodType: 'calendar_year', periodStart: '2025-01-01', periodEnd: '2025-12-31', yieldAreaBasis: 'unspecified' });
  const normalized = validate('crop', [annual]).observations[0];
  assert.equal(normalized.periodType, 'calendar_year');
  assert.equal(normalized.periodStart, '2025-01-01');
  assert.equal(normalized.periodEnd, '2025-12-31');
  assert.equal(normalized.yieldAreaBasis, 'unspecified');
  assert.equal(Object.hasOwn(normalized, 'harvestStart'), false);
  assert.equal(Object.hasOwn(normalized, 'harvestEnd'), false);
  for (const changes of [{ periodStart: '2025-02-01' }, { periodEnd: '2025-11-30' }, { periodEnd: '2026-12-31' },
    { periodStart: '2568-01-01', periodEnd: '2568-12-31' }, { availableAt: '2025-12-31T23:59:59Z' }]) {
    assert.throws(() => validate('crop', [{ ...annual, ...changes }]), invalid);
  }
  for (const basis of ['harvested', 'planted', 'unspecified']) assert.equal(validate('crop', [{ ...annual, yieldAreaBasis: basis }]).observations[0].yieldAreaBasis, basis);
  for (const field of ['periodType', 'periodStart', 'periodEnd', 'yieldAreaBasis']) {
    const incomplete = { ...annual }; delete incomplete[field];
    assert.throws(() => validate('crop', [incomplete]), invalid);
  }
  assert.throws(() => validate('crop', [{ ...annual, harvestStart: '2025-10-01' }]), invalid);
});

test('optional satellite geometry, mask, native support and artifact provenance are validated and retained', () => {
  const row = satellite({ geometryVersion: ' boundary-v1 ', maskVersion: ' crop-mask-v2 ', nativeSupportMeters: 1000, sourceArtifactHash: 'AB'.repeat(32) });
  const normalized = validate('satellite', [row]).observations[0];
  assert.equal(normalized.geometryVersion, 'boundary-v1');
  assert.equal(normalized.maskVersion, 'crop-mask-v2');
  assert.equal(normalized.nativeSupportMeters, 1000);
  assert.equal(normalized.sourceArtifactHash, 'ab'.repeat(32));
  assert.equal(Object.hasOwn(validate('satellite', [satellite()]).observations[0], 'sourceArtifactHash'), false);
  for (const changes of [{ geometryVersion: '' }, { maskVersion: null }, { nativeSupportMeters: 0 }, { nativeSupportMeters: '1000' },
    { nativeSupportMeters: Infinity }, { sourceArtifactHash: 'ab'.repeat(31) }, { sourceArtifactHash: 'g'.repeat(64) }, { sourceArtifactHash: null }]) {
    assert.throws(() => validate('satellite', [satellite(changes)]), invalid);
  }
  assert.throws(() => validate('crop', [crop({ geometryVersion: 'boundary-v1' })]), invalid);
});

test('domain rows reject missing/unknown fields and noncanonical geography', () => {
  for (const [kind, make] of [['satellite', satellite], ['crop', crop]]) {
    for (const row of [null, [], make({ subdistrictCode: '309999' }), make({ stationId: 'station-1' }), make({ periodMinutes: 60 })]) {
      assert.throws(() => validate(kind, [row]), invalid);
    }
    const absent = make(); delete absent.availableAt;
    assert.throws(() => validate(kind, [absent]), invalid);
  }
});

test('canonical satellite/crop identities reject duplicates without collapsing products, crops or seasons', () => {
  assert.throws(() => validate('satellite', [satellite(), satellite({ product: ' SATELLITE_PRODUCT ', availableAt: '2026-09-02T00:00:00Z', processingVersion: 'mask-v3' })]), invalid);
  assert.equal(validate('satellite', [satellite(), satellite({ productVersion: 'v2' })]).observations.length, 2);
  assert.throws(() => validate('crop', [crop(), crop({ datasetVersion: ' 2026-release-1 ', yieldKgPerRai: 600 })]), invalid);
  assert.equal(validate('crop', [crop(), crop({ seasonId: '2025-second' }), crop({ cropCode: 'cassava' })]).observations.length, 3);
});
