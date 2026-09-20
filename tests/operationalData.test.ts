import { describe, expect, it, vi } from 'vitest';
import { businessMonth, operationalFamily, nextBusinessMonth } from '../src/data/operationalPolicy.mjs';
import { comparableActual, resolveActualBatch, resolveForecastBatch, resolveOperationalData, type ActualRecord, type ActualPolicy, type OperationalForecastRecord, type OperationalRequest, type ForecastPolicy } from '../src/operationalData';
import { archivePath, operationalPath, readOperationalLocation } from '../src/operationalLocation';
import { forecastQueryPeriod, ArchivePeriodUnavailableError } from '../src/data/forecastScope';
import { validateOperationalContext } from '../src/useOperationalContext';

const now = '2026-09-20T05:00:00.000Z';
const codes = ['300101', '300102', '300103'];
const request: OperationalRequest = { areaCode: '3001', validPeriod: '2026-08', hazard: 'drought', cropCode: 'rice', metricDefinitionId: 'assessment-v1', administrativeVersion: 'admin-v1' };
const actualPolicy: ActualPolicy = { id: 'approved-actual', sourceOrder: ['official'], reviews: ['verified', 'revised'], metricDefinitionId: 'assessment-v1', classificationVersion: 'class-v1' };
const forecastPolicy: ForecastPolicy = { id: 'approved-forecast', freshnessPolicyId: 'approved-expiry', sourceIds: ['model'] };
const actual = (patch: Partial<ActualRecord> = {}): ActualRecord => ({ id: 'a1', canonicalAreaCode: codes[0], administrativeVersion: 'admin-v1', kind: 'observed_assessment', validPeriod: '2026-08', coverageThrough: '2026-08-31T16:59:59Z', hazard: 'drought', cropScope: 'crop_specific', cropCode: 'rice', metricDefinitionId: 'assessment-v1', value: 0, categoryCode: 'normal', classificationVersion: 'class-v1', sourceId: 'official', sourceRecordId: 'official-1', reportedAt: '2026-09-01T00:00:00Z', ingestedAt: '2026-09-01T03:00:00Z', reviewStatus: 'verified', publicationStatus: 'eligible', publicationPolicyId: 'approved-actual', revisionId: 'r1', ...patch });
const forecast = (patch: Partial<OperationalForecastRecord> = {}): OperationalForecastRecord => ({ id: 'f1', canonicalAreaCode: codes[0], administrativeVersion: 'admin-v1', targetPeriod: '2026-10', issuePeriod: '2026-09', horizon: 1, forecastRisk: 1, scopeStatus: 'in_scope', hazard: 'drought', cropCode: 'rice', metricDefinitionId: 'assessment-v1', classificationVersion: 'class-v1', sourceId: 'model', sourceRowKey: 'row-1', productId: 'p1', runId: 'run-1', originBasis: 'verified_issue', runKind: 'operational_forecast', generatedAt: '2026-09-01T00:00:00Z', firstPublishedAt: '2026-09-02T00:00:00Z', eligibleUntil: '2026-10-01T00:00:00Z', publicationStatus: 'eligible', publicationPolicyId: 'approved-forecast', freshnessPolicyId: 'approved-expiry', ...patch });
const future = { ...request, validPeriod: '2026-10', horizon: 1, productId: 'p1' };
const resolveActual = (records: ActualRecord[], req = request) => resolveActualBatch(req, now, codes, { status: 'ready', records, revision: 'batch-r1' }, actualPolicy);
const resolveForecast = (records: OperationalForecastRecord[], req = future) => resolveForecastBatch(req, now, codes, { status: 'ready', records, revision: 'model-r1' }, forecastPolicy);

describe('business calendar and legacy intent', () => {
  it('changes family at Bangkok midnight, not browser or UTC midnight', () => {
    expect(businessMonth('2026-09-30T16:59:59Z')).toBe('2026-09');
    expect(businessMonth('2026-09-30T17:00:00Z')).toBe('2026-10');
    expect(operationalFamily('2026-10', '2026-09-30T16:59:59Z')).toBe('forecast');
    expect(operationalFamily('2026-10', '2026-09-30T17:00:00Z')).toBe('actual');
    expect(nextBusinessMonth('2026-12-31T10:00:00Z')).toBe('2026-12-31T17:00:00.000Z');
  });
  it('keeps explicit archive intent and converts operational legacy T+h across years', () => {
    expect(readOperationalLocation('?mapLayer=forecast-archive&target=2025-12&horizon=6')).toEqual({ intent: 'archive' });
    expect(readOperationalLocation('?target=2025-12&horizon=6')).toEqual({ intent: 'operational', period: '2026-06' });
    expect(readOperationalLocation('?period=2024-01&horizon=6')).toEqual({ intent: 'operational', period: '2024-01' });
    expect(readOperationalLocation('?period=2026-13').intent).toBe('invalid');
    expect(readOperationalLocation('?target=2025-12&horizon=7').intent).toBe('invalid');
    expect(readOperationalLocation('?period=2026-01&period=2026-02').intent).toBe('invalid');
    expect(operationalPath('/phimai?target=2025-12&horizon=6&mapLayer=forecast-archive&irrigation=rainfed', '2026-06')).toBe('/phimai?period=2026-06');
    expect(archivePath('/phimai?period=2026-06')).toBe('/phimai?mapLayer=forecast-archive');
  });
  it('does not quietly replace an explicit missing archive origin with latest', () => {
    const archive = { targetMonths: [{ period: '2025-12' }], meta: { targetMonthEnd: '2025-12' } } as Parameters<typeof forecastQueryPeriod>[0];
    expect(forecastQueryPeriod(archive)).toBe('2025-12');
    expect(() => forecastQueryPeriod(archive, '2026-01')).toThrow(ArchivePeriodUnavailableError);
  });
  it('fails closed on a newer/unrecognized publication contract', () => {
    expect(() => validateOperationalContext({ policyVersion: 'unapproved' })).toThrow();
  });
});

describe('actual eligibility, coverage and revision axes', () => {
  it('preserves zero as an observation without making it a forecast risk', () => {
    const result = resolveActual([actual()]);
    expect(result).toMatchObject({ family: 'actual', availability: 'partial', availableCount: 1, expectedCount: 3, forecastRecords: [] });
    expect(result.actualRecords[0].value).toBe(0);
    expect(result.actualRecords[0].categoryCode).toBe('normal');
  });
  it('retains a partial-current-month cutoff and verified review independently', () => {
    expect(resolveActual([actual({ validPeriod: '2026-09', coverageThrough: '2026-09-18T00:00:00Z' })], { ...request, validPeriod: '2026-09' }))
      .toMatchObject({ partialPeriod: true, coverageThrough: '2026-09-18T00:00:00Z', reviewStatuses: ['verified'] });
  });
  it.each([{ value: null }, { reviewStatus: 'rejected' }, { reviewStatus: 'unknown' }, { publicationPolicyId: 'unapproved' },
    { kind: 'forecast' }, { coverageThrough: '2026-07-31T00:00:00Z' }, { classificationVersion: 'unconfirmed' },
    { cropCode: 'corn' }, { administrativeVersion: 'wrong-version' }, { canonicalAreaCode: '3001' }, { sourceRecordId: '' }])('excludes incompatible/unconfirmed records %j', patch => {
    expect(resolveActual([actual(patch as Partial<ActualRecord>)]).availableCount).toBe(0);
  });
  it('does not borrow the previous month', () => {
    expect(resolveActual([actual({ validPeriod: '2026-07' })]).actualRecords).toEqual([]);
  });
  it('keeps publication pending and withheld distinct from a request error', () => {
    expect(resolveActual([actual({ publicationStatus: 'pending' })]).availability).toBe('pending');
    expect(resolveActual([actual({ publicationStatus: 'withheld' })]).availability).toBe('withheld');
  });
  it('uses explicit supersession and never revives a withdrawn replacement', () => {
    const revision = actual({ id: 'a2', supersedesId: 'a1', revisionId: 'r2', reviewStatus: 'revised', value: 3 });
    expect(resolveActual([actual(), revision]).actualRecords.map(row => row.id)).toEqual(['a2']);
    expect(resolveActual([actual(), { ...revision, publicationStatus: 'withdrawn' }])).toMatchObject({ availableCount: 0, availability: 'withheld' });
    expect(resolveActual([actual(), actual({ id: 'conflict', value: 99 })]).availableCount).toBe(0);
  });
  it('uses canonical coverage, not only received rows, for 180/289', () => {
    const all = Array.from({ length: 289 }, (_, i) => `30${String(i).padStart(4, '0')}`);
    const result = resolveActualBatch(request, now, all, { status: 'ready', revision: 'r1', records: all.slice(0, 180).map(code => actual({ id: code, canonicalAreaCode: code })) }, actualPolicy);
    expect(result).toMatchObject({ availableCount: 180, expectedCount: 289, availability: 'partial' });
  });
});

describe('exact future vintage and provenance', () => {
  it('does not substitute another T+ or mix equally-valued runs', () => {
    expect(resolveForecast([forecast({ horizon: 2, issuePeriod: '2026-08' })]).reason).toBe('exact_vintage_unavailable');
    expect(resolveForecast([forecast(), forecast({ id: 'f2', runId: 'run-2' })]).reason).toBe('ambiguous_vintage');
    expect(resolveForecast([forecast(), forecast({ id: 'f2', runId: 'run-2' })], { ...future, runId: 'run-2' }).forecastRecords.map(row => row.id)).toEqual(['f2']);
  });
  it.each([{ runKind: 'reforecast' }, { originBasis: 'derived_reference' }, { firstPublishedAt: undefined },
    { eligibleUntil: '2026-09-01T00:00:00Z' }, { firstPublishedAt: '2026-10-01T00:00:00Z' },
    { issuePeriod: '2026-08' }, { publicationStatus: 'withdrawn' }, { freshnessPolicyId: 'guessed' }])('rejects unapproved vintage %j', patch => {
    expect(resolveForecast([forecast(patch as Partial<OperationalForecastRecord>)]).availableCount).toBe(0);
  });
  it('distinguishes 0, explicit outside and absent records', () => {
    const result = resolveForecast([forecast({ forecastRisk: 0 }), forecast({ id: 'f2', canonicalAreaCode: codes[1], forecastRisk: null, scopeStatus: 'out_of_study_scope' })]);
    expect(result).toMatchObject({ availableCount: 1, expectedCount: 3, availability: 'partial' });
    expect(result.forecastRecords.map(row => row.forecastRisk)).toEqual([0, null]);
    expect(resolveForecast([forecast({ forecastRisk: null })]).forecastRecords).toEqual([]);
  });
  it('never scores unlike observations or invents an accuracy protocol', () => {
    expect(comparableActual(forecast(), actual()).status).toBe('not_evaluable');
    expect(comparableActual(forecast(), actual({ validPeriod: '2026-10' })).status).toBe('matching_protocol_required');
    expect(comparableActual(forecast({ runKind: 'reforecast' }), actual({ validPeriod: '2026-10' })).status).toBe('not_evaluable');
  });
});

describe('no data-family fallback', () => {
  it.each(['missing', 'error'])('never calls forecast for a past/current %s actual response', async mode => {
    const actualAdapter = vi.fn(async () => { if (mode === 'error') throw new Error('network'); return { status: 'not_configured' as const }; });
    const forecastAdapter = vi.fn(async () => ({ status: 'ready' as const, records: [forecast()], revision: 'r1' }));
    const result = await resolveOperationalData(request, now, codes, { actual: actualAdapter, forecast: forecastAdapter });
    expect(forecastAdapter).not.toHaveBeenCalled();
    expect(result.availability).toBe(mode === 'error' ? 'error' : 'unavailable');
  });
  it('does not query actual for a future period', async () => {
    const actualAdapter = vi.fn(async () => ({ status: 'not_configured' as const }));
    await resolveOperationalData(future, now, codes, { actual: actualAdapter, forecast: async () => ({ status: 'pending_policy' }) });
    expect(actualAdapter).not.toHaveBeenCalled();
  });
});
