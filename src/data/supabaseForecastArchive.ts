import type { SupabaseClient } from '@supabase/supabase-js';
import type { NakhonRatchasimaDroughtForecastArchive } from '../types';
import { forecastTargetPeriod } from '../forecastPeriod';
import { forecastQueryPeriod, forecastScopeCodes, projectForecastScope, type ForecastQuery } from './forecastScope';

export const FORECAST_DATASET_ID = 'a3be4448-6c8e-4039-b574-4674e261ee9b';
export const FORECAST_DATASET_VERSION = 'drought-rev03-a3be44486c8e';
export const FORECAST_SOURCE_SHA256 = 'a3be44486c8e8039f5744674e261ee9b27306f0c78b46bd1ce62e8903d4915b4';

type ForecastRevision = Pick<NakhonRatchasimaDroughtForecastArchive['meta'],
  'datasetId' | 'datasetVersion' | 'sourceWorkbookSha256' | 'targetMonthCount' | 'targetMonthStart' | 'targetMonthEnd'> & { publishedAt?: string };
const originalRevision: ForecastRevision = { datasetId: FORECAST_DATASET_ID, datasetVersion: FORECAST_DATASET_VERSION,
  sourceWorkbookSha256: FORECAST_SOURCE_SHA256, targetMonthCount: 127, targetMonthStart: '2015-06', targetMonthEnd: '2025-12' };

function validateRevision(value: unknown): ForecastRevision {
  const revision = value as NakhonRatchasimaDroughtForecastArchive['meta'] & { publishedAt: string };
  if (!revision || revision.sourceOfTruth !== 'normalized_rev03_original_workbook' ||
      revision.temporalInterpretation !== 'SOURCE_YEARMONTH_IS_ORIGIN_MONTH' || revision.provinceCode !== '30' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(revision.datasetId) || !revision.datasetVersion ||
      !/^[0-9a-f]{64}$/.test(revision.sourceWorkbookSha256) || !Number.isFinite(Date.parse(revision.publishedAt)) ||
      !Number.isInteger(revision.targetMonthCount) || revision.targetMonthCount < 1 ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(revision.targetMonthStart) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(revision.targetMonthEnd) || revision.targetMonthEnd < revision.targetMonthStart) {
    throw new Error('Invalid published forecast revision');
  }
  return revision;
}

export function validateDatabaseArchive(value: unknown, horizonCount: 1 | 6, query?: ForecastQuery, revision = originalRevision): NakhonRatchasimaDroughtForecastArchive {
  const archive = value as NakhonRatchasimaDroughtForecastArchive | null;
  const expectedCodes = query ? forecastScopeCodes(query.areaCode) : null;
  const expectedCount = expectedCodes?.length ?? 289;
  if (!archive || archive.meta?.sourceOfTruth !== 'normalized_rev03_original_workbook' ||
      archive.meta.datasetId !== revision.datasetId || archive.meta.datasetVersion !== revision.datasetVersion ||
      archive.meta.sourceWorkbookSha256 !== revision.sourceWorkbookSha256 ||
      archive.meta.targetMonthStart !== revision.targetMonthStart || archive.meta.targetMonthEnd !== revision.targetMonthEnd ||
      archive.meta.targetMonthCount !== revision.targetMonthCount ||
      archive.meta.temporalInterpretation !== 'SOURCE_YEARMONTH_IS_ORIGIN_MONTH' ||
      archive.meta.provinceCode !== '30' || archive.meta.horizonCount !== horizonCount ||
      archive.meta.forecastVintageCount !== 289 * revision.targetMonthCount * horizonCount ||
      !Array.isArray(archive.locations) || archive.locations.length !== expectedCount ||
      !Array.isArray(archive.targetMonths) || archive.targetMonths.length !== revision.targetMonthCount ||
      !archive.packedRiskByTargetMonth) throw new Error('Invalid database forecast archive');
  const codes = new Set(archive.locations.map((l) => l.subdistrictCode));
  if (codes.size !== expectedCount || new Set(archive.locations.map((l) => l.sourceId)).size !== expectedCount ||
      expectedCodes?.some((code) => !codes.has(code)) ||
      new Set(archive.targetMonths.map((m) => m.period)).size !== revision.targetMonthCount) throw new Error('Duplicate forecast keys');
  const period = query ? forecastQueryPeriod(archive, query.originPeriod) : null;
  if (query && (archive.loadedSelection?.areaCode !== query.areaCode || archive.loadedSelection.originPeriod !== period ||
      archive.loadedSelection.horizonCount !== horizonCount || archive.loadedSelection.subdistrictCount !== expectedCount ||
      Object.keys(archive.packedRiskByTargetMonth).length !== 1)) throw new Error('Wrong forecast selection');
  for (const month of archive.targetMonths) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month.period) || month.period < revision.targetMonthStart || month.period > revision.targetMonthEnd ||
        !month.horizons?.every((h, i) => h.horizon === i + 1 && h.issueMonth === month.period &&
          h.targetMonth === forecastTargetPeriod(month.period, h.horizon))) throw new Error('Invalid forecast origin/target');
    if (month.horizons?.length !== horizonCount) throw new Error('Incomplete database month');
    if (period && month.period !== period) continue;
    const rows = archive.packedRiskByTargetMonth[month.period];
    if (!rows || Object.keys(rows).length !== codes.size) throw new Error('Incomplete database month');
    for (const code of codes) {
      const risks = rows[code];
      if (!Array.isArray(risks) || risks.length !== horizonCount || !risks.every((risk) => risk === null || risk === 0 || risk === 1 || risk === 2)) {
        throw new Error('Missing/invalid database vintage');
      }
    }
  }
  return archive;
}

export function createSupabaseForecastLoader(userId: string, horizonCount: 1 | 6, getClient: () => Promise<SupabaseClient | null>) {
  const cache = new Map<string, NakhonRatchasimaDroughtForecastArchive>();
  const pending = new Map<string, Promise<NakhonRatchasimaDroughtForecastArchive>>();
  const controllers = new Set<AbortController>();
  let generation = 0;
  let activeRevision: ForecastRevision | null = null;
  const revisionKey = (revision: ForecastRevision) => `${revision.datasetId}|${revision.datasetVersion}|${revision.sourceWorkbookSha256}`;
  const keyFor = (query: ForecastQuery) => `${query.areaCode}|${query.originPeriod ?? ''}`;
  function getCached(query: ForecastQuery = { areaCode: '30' }) {
    const exact = cache.get(keyFor(query));
    if (exact) return exact;
    for (const archive of cache.values()) {
      const selection = archive.loadedSelection!;
      if (selection.originPeriod === forecastQueryPeriod(archive, query.originPeriod) &&
          query.areaCode.startsWith(selection.areaCode)) return projectForecastScope(archive, query);
    }
    return null;
  }
  return {
    getCached,
    clear() {
      generation++;
      controllers.forEach((controller) => controller.abort());
      controllers.clear(); cache.clear(); pending.clear();
      activeRevision = null;
    },
    load(query: ForecastQuery = { areaCode: '30' }): Promise<NakhonRatchasimaDroughtForecastArchive> {
      forecastScopeCodes(query.areaCode);
      const key = keyFor(query);
      const existing = pending.get(key);
      if (existing) return existing;
      const epoch = generation;
      const request = new AbortController();
      controllers.add(request);
      const timer = setTimeout(() => request.abort(), 30_000);
      const task = (async () => {
        const client = await getClient();
        if (!client) throw new Error('Database unavailable');
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (sessionError || session?.user.id !== userId || request.signal.aborted) throw new Error('Session changed');
        // Never let a cache hit bypass the server's published revision check.
        const latest = await client.rpc('ktp_latest_forecast_revision').abortSignal(request.signal);
        if (latest.error) throw new Error('Forecast revision unavailable');
        const revision = validateRevision(latest.data);
        if (epoch !== generation || request.signal.aborted) throw new Error('Session changed');
        const { data: checked, error: checkError } = await client.auth.getSession();
        if (checkError || checked.session?.user.id !== userId || epoch !== generation || request.signal.aborted) throw new Error('Session changed');
        if (activeRevision && Date.parse(revision.publishedAt!) < Date.parse(activeRevision.publishedAt!)) throw new Error('Forecast revision changed');
        if (!activeRevision || revisionKey(activeRevision) !== revisionKey(revision)) cache.clear();
        activeRevision = revision;
        const cached = getCached(query);
        if (cached) return cached;
        const { data, error } = await client.rpc('ktp_load_forecast_slice', {
          p_version: revision.datasetVersion, p_horizon_count: horizonCount,
          p_area_code: query.areaCode, p_origin_period: query.originPeriod ?? null,
        }).abortSignal(request.signal);
        if (error) throw new Error('Forecast database unavailable');
        if (epoch !== generation || request.signal.aborted) throw new Error('Session changed');
        if (revisionKey(activeRevision) !== revisionKey(revision)) throw new Error('Forecast revision changed');
        const { data: current, error: currentError } = await client.auth.getSession();
        if (currentError || current.session?.user.id !== userId || epoch !== generation || request.signal.aborted) throw new Error('Session changed');
        if (revisionKey(activeRevision) !== revisionKey(revision)) throw new Error('Forecast revision changed');
        const validated = validateDatabaseArchive(data, horizonCount, query, revision);
        cache.set(key, validated);
        // Bound per-account memory; do not persist protected predictions to disk.
        while (cache.size > 16) cache.delete(cache.keys().next().value!);
        return validated;
      })().finally(() => {
        clearTimeout(timer);
        controllers.delete(request);
        if (epoch === generation) pending.delete(key);
      });
      pending.set(key, task);
      return task;
    },
  };
}
