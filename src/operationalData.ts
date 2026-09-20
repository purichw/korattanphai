import { forecastTargetPeriod } from './forecastPeriod';
import { businessMonth, isMonthPeriod, operationalFamily } from './data/operationalPolicy.mjs';

export type ActualKind = 'observed_measurement' | 'reported_observation' | 'observed_assessment';
export type ReviewStatus = 'preliminary' | 'verified' | 'revised' | 'rejected' | 'unknown';
export type PublicationStatus = 'eligible' | 'withheld' | 'withdrawn' | 'pending';
export type ActualRecord = {
  id: string; canonicalAreaCode: string; administrativeVersion: string;
  kind: ActualKind; validPeriod: string; coverageThrough: string;
  hazard: string; cropCode?: string; cropScope: 'crop_specific' | 'not_crop_specific' | 'all_crops';
  metricDefinitionId: string; value: number | string | null; unit?: string;
  categoryCode?: string; classificationVersion?: string;
  sourceId: string; sourceRecordId: string; reportedAt: string; reviewedAt?: string;
  ingestedAt: string; reviewStatus: ReviewStatus; publicationStatus: PublicationStatus;
  publicationPolicyId: string; revisionId: string; supersedesId?: string;
};
export type OperationalForecastRecord = {
  id: string; canonicalAreaCode: string; administrativeVersion: string;
  targetPeriod: string; issuePeriod: string; horizon: number;
  forecastRisk: 0 | 1 | 2 | null; scopeStatus: 'in_scope' | 'out_of_study_scope';
  hazard: string; cropCode?: string; metricDefinitionId: string; classificationVersion: string;
  sourceId: string; sourceRowKey: string; productId: string; runId: string;
  originBasis: 'verified_issue' | 'derived_reference' | 'unresolved';
  runKind: 'operational_forecast' | 'reforecast' | 'unverified';
  generatedAt?: string; firstPublishedAt?: string; eligibleUntil?: string;
  publicationStatus: PublicationStatus; publicationPolicyId?: string; freshnessPolicyId?: string;
};
export type OperationalRequest = {
  validPeriod: string; areaCode: string; hazard: string; cropCode?: string;
  metricDefinitionId: string; administrativeVersion: string;
  horizon?: number; productId?: string; runId?: string;
};
export type ActualPolicy = {
  id: string; sourceOrder: string[]; reviews: ReviewStatus[];
  metricDefinitionId: string; classificationVersion?: string;
};
export type ForecastPolicy = { id: string; freshnessPolicyId: string; sourceIds: string[] };
export type SourceBatch<T> = { status: 'ready'; records: T[]; revision: string }
  | { status: 'not_configured' | 'pending_policy' };
export type DataAvailability = 'available' | 'partial' | 'unavailable' | 'pending' | 'withheld' | 'error';
export type OperationalSnapshot = {
  family: 'actual' | 'forecast'; validPeriod: string; currentPeriod: string;
  availability: DataAvailability; reason: string; expectedCount: number; availableCount: number;
  actualRecords: ActualRecord[]; forecastRecords: OperationalForecastRecord[];
  reviewStatuses: ReviewStatus[]; coverageThrough: string | null;
  partialPeriod: boolean; sourceRevision: string | null;
  diagnostics: { id: string; reason: string }[];
};

const actualKinds: ActualKind[] = ['observed_measurement', 'reported_observation', 'observed_assessment'];
const hasTime = (value: string | undefined) => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function emptyOperationalSnapshot(request: OperationalRequest, now: string, expectedCount: number): OperationalSnapshot {
  const family = operationalFamily(request.validPeriod, now);
  return { family, validPeriod: request.validPeriod, currentPeriod: businessMonth(now), availability: 'unavailable',
    reason: 'no_eligible_records', expectedCount, availableCount: 0, actualRecords: [], forecastRecords: [],
    reviewStatuses: [], coverageThrough: null, partialPeriod: family === 'actual' && request.validPeriod === businessMonth(now),
    sourceRevision: null, diagnostics: [] };
}

export function resolveActualBatch(request: OperationalRequest, now: string, expectedCodes: string[], batch: SourceBatch<ActualRecord>, policy?: ActualPolicy) {
  const snapshot = emptyOperationalSnapshot(request, now, expectedCodes.length);
  if (snapshot.family !== 'actual') throw new Error('Actual cannot resolve a future period');
  if (batch.status !== 'ready') return { ...snapshot, reason: batch.status === 'not_configured' ? 'actual_source_not_configured' : 'publication_policy_unconfirmed' };
  snapshot.sourceRevision = batch.revision;
  if (!policy || policy.metricDefinitionId !== request.metricDefinitionId) return { ...snapshot, reason: 'publication_policy_unconfirmed' };
  const codes = new Set(expectedCodes);
  const candidates = new Map<string, ActualRecord[]>();
  const supersededIds = new Set<string>();
  let pending = false, withheld = false;
  for (const row of batch.records) {
    if (row.validPeriod !== request.validPeriod || row.hazard !== request.hazard || row.metricDefinitionId !== request.metricDefinitionId) continue;
    const reject = (reason: string) => snapshot.diagnostics.push({ id: row.id, reason });
    if (!codes.has(row.canonicalAreaCode)) { reject('outside_requested_geography_or_coarser_report'); continue; }
    if (row.administrativeVersion !== request.administrativeVersion) { reject('geography_version_mismatch'); continue; }
    if (row.cropScope === 'crop_specific' && row.cropCode !== request.cropCode) continue;
    if (!actualKinds.includes(row.kind) || !row.sourceRecordId || !row.revisionId || !policy.sourceOrder.includes(row.sourceId)) { reject('unconfirmed_provenance'); continue; }
    if (row.publicationPolicyId === policy.id && row.supersedesId) supersededIds.add(`${row.sourceId}|${row.canonicalAreaCode}|${row.supersedesId}`);
    if (row.publicationStatus !== 'eligible') {
      pending ||= row.publicationStatus === 'pending';
      withheld ||= row.publicationStatus === 'withheld' || row.publicationStatus === 'withdrawn';
      reject(row.publicationStatus); continue;
    }
    if (row.publicationPolicyId !== policy.id || !policy.reviews.includes(row.reviewStatus) || row.reviewStatus === 'rejected') { reject('review_not_eligible'); continue; }
    if (row.value === null || row.value === '' || (typeof row.value === 'number' && !Number.isFinite(row.value))) { reject('missing_value'); continue; }
    if (!hasTime(row.coverageThrough) || !hasTime(row.reportedAt) || !hasTime(row.ingestedAt) ||
        businessMonth(row.coverageThrough) !== request.validPeriod || Date.parse(row.coverageThrough) > Date.parse(now)) { reject('invalid_coverage'); continue; }
    if (row.categoryCode !== undefined && (!policy.classificationVersion || row.classificationVersion !== policy.classificationVersion)) { reject('unconfirmed_classification'); continue; }
    candidates.set(row.canonicalAreaCode, [...(candidates.get(row.canonicalAreaCode) ?? []), row]);
  }
  for (const rows of candidates.values()) {
    // Only documented source precedence and explicit supersession may resolve a
    // conflict. Never choose a maximum risk, import time or lexical revision.
    const source = policy.sourceOrder.find(id => rows.some(row => row.sourceId === id));
    const preferred = rows.filter(row => row.sourceId === source);
    const leaves = preferred.filter(row => !supersededIds.has(`${row.sourceId}|${row.canonicalAreaCode}|${row.id}`));
    if (leaves.length !== 1) {
      preferred.forEach(row => snapshot.diagnostics.push({ id: row.id, reason: 'ambiguous_revision' }));
    } else snapshot.actualRecords.push(leaves[0]);
  }
  snapshot.availableCount = snapshot.actualRecords.length;
  snapshot.availability = snapshot.availableCount ? snapshot.availableCount === snapshot.expectedCount ? 'available' : 'partial'
    : withheld ? 'withheld' : pending ? 'pending' : 'unavailable';
  snapshot.reason = snapshot.availableCount ? 'eligible_actual' : snapshot.availability === 'pending' ? 'pending_review'
    : snapshot.availability === 'withheld' ? 'publication_withheld' : 'no_eligible_records';
  snapshot.reviewStatuses = [...new Set(snapshot.actualRecords.map(row => row.reviewStatus))];
  snapshot.coverageThrough = snapshot.actualRecords.map(row => row.coverageThrough).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
  return snapshot;
}

export function resolveForecastBatch(request: OperationalRequest, now: string, expectedCodes: string[], batch: SourceBatch<OperationalForecastRecord>, policy?: ForecastPolicy) {
  const snapshot = emptyOperationalSnapshot(request, now, expectedCodes.length);
  if (snapshot.family !== 'forecast') throw new Error('Operational past/current periods cannot use forecasts');
  if (batch.status !== 'ready') return { ...snapshot, reason: batch.status === 'not_configured' ? 'forecast_source_not_configured' : 'publication_policy_unconfirmed' };
  snapshot.sourceRevision = batch.revision;
  if (!policy) return { ...snapshot, reason: 'publication_policy_unconfirmed' };
  const codes = new Set(expectedCodes);
  const matches = batch.records.filter(row => row.targetPeriod === request.validPeriod && row.horizon === request.horizon &&
    row.productId === request.productId && (!request.runId || row.runId === request.runId) && codes.has(row.canonicalAreaCode));
  let withheld = false;
  const eligible = matches.filter(row => {
    let reason = '';
    if (row.publicationStatus === 'withheld' || row.publicationStatus === 'withdrawn') { withheld = true; reason = row.publicationStatus; }
    else if (row.publicationStatus !== 'eligible' || row.publicationPolicyId !== policy.id || row.freshnessPolicyId !== policy.freshnessPolicyId) reason = 'publication_not_eligible';
    else if (row.runKind !== 'operational_forecast' || row.originBasis !== 'verified_issue' || !row.runId || !row.sourceRowKey || !policy.sourceIds.includes(row.sourceId)) reason = 'unconfirmed_provenance';
    else if (!hasTime(row.firstPublishedAt) || !hasTime(row.generatedAt) || !hasTime(row.eligibleUntil) ||
      Date.parse(row.firstPublishedAt!) > Date.parse(now) || Date.parse(row.generatedAt!) > Date.parse(row.firstPublishedAt!) ||
      Date.parse(row.eligibleUntil!) <= Date.parse(now) || businessMonth(row.firstPublishedAt!) >= row.targetPeriod) reason = 'forecast_not_fresh_or_issued';
    else if (!isMonthPeriod(row.issuePeriod) || row.horizon < 1 || row.horizon > 6 || !Number.isInteger(row.horizon) ||
      forecastTargetPeriod(row.issuePeriod, row.horizon) !== row.targetPeriod) reason = 'temporal_contract_unresolved';
    else if (row.hazard !== request.hazard || row.metricDefinitionId !== request.metricDefinitionId ||
      row.administrativeVersion !== request.administrativeVersion || (row.cropCode && row.cropCode !== request.cropCode)) reason = 'metric_or_scope_mismatch';
    else if (!(row.scopeStatus === 'out_of_study_scope' ? row.forecastRisk === null : [0, 1, 2].includes(row.forecastRisk as number))) reason = 'invalid_forecast_value';
    if (reason) snapshot.diagnostics.push({ id: row.id, reason });
    return !reason;
  });
  const vintages = new Set(eligible.map(row => `${row.productId}|${row.runId}|${row.issuePeriod}|${row.horizon}`));
  if (vintages.size > 1) return { ...snapshot, reason: 'ambiguous_vintage' };
  const counts = new Map<string, number>();
  eligible.forEach(row => counts.set(row.canonicalAreaCode, (counts.get(row.canonicalAreaCode) ?? 0) + 1));
  snapshot.forecastRecords = eligible.filter(row => counts.get(row.canonicalAreaCode) === 1);
  eligible.filter(row => counts.get(row.canonicalAreaCode)! > 1).forEach(row => snapshot.diagnostics.push({ id: row.id, reason: 'duplicate_area_vintage' }));
  snapshot.availableCount = snapshot.forecastRecords.filter(row => row.forecastRisk !== null).length;
  snapshot.availability = snapshot.forecastRecords.length ? snapshot.forecastRecords.length === expectedCodes.length ? 'available' : 'partial' : withheld ? 'withheld' : 'unavailable';
  snapshot.reason = snapshot.forecastRecords.length ? 'eligible_forecast' : withheld ? 'publication_withheld' : 'exact_vintage_unavailable';
  return snapshot;
}

export async function resolveOperationalData(request: OperationalRequest, now: string, expectedCodes: string[], adapters: {
  actual: () => Promise<SourceBatch<ActualRecord>>; forecast: () => Promise<SourceBatch<OperationalForecastRecord>>;
  actualPolicy?: ActualPolicy; forecastPolicy?: ForecastPolicy;
}): Promise<OperationalSnapshot> {
  const snapshot = emptyOperationalSnapshot(request, now, expectedCodes.length);
  try {
    return snapshot.family === 'actual'
      ? resolveActualBatch(request, now, expectedCodes, await adapters.actual(), adapters.actualPolicy)
      : resolveForecastBatch(request, now, expectedCodes, await adapters.forecast(), adapters.forecastPolicy);
  } catch {
    return { ...snapshot, availability: 'error', reason: 'request_failed' };
  }
}

export function comparableActual(forecast: OperationalForecastRecord, actual: ActualRecord) {
  const same = forecast.canonicalAreaCode === actual.canonicalAreaCode && forecast.administrativeVersion === actual.administrativeVersion &&
    forecast.targetPeriod === actual.validPeriod && forecast.hazard === actual.hazard && forecast.metricDefinitionId === actual.metricDefinitionId &&
    forecast.classificationVersion === actual.classificationVersion && actual.cropScope === 'crop_specific' && forecast.cropCode === actual.cropCode &&
    actual.publicationStatus === 'eligible' && ['verified', 'revised'].includes(actual.reviewStatus) && actual.categoryCode !== undefined &&
    forecast.forecastRisk !== null && forecast.runKind === 'operational_forecast' && forecast.originBasis === 'verified_issue';
  return { status: same ? 'matching_protocol_required' : 'not_evaluable', forecastRecordId: forecast.id,
    actualRecordId: actual.id, actualRevision: actual.revisionId, reason: same ? 'No scoring protocol is configured' : 'Definitions, provenance or coverage are not comparable' };
}
