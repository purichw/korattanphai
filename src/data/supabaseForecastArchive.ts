import type { SupabaseClient } from '@supabase/supabase-js';
import type { NakhonRatchasimaDroughtForecastArchive } from '../types';

export const FORECAST_DATASET_ID = '9b299cef-c704-4139-8085-18664253cc80';
export const FORECAST_DATASET_VERSION = 'drought-rev02-9b299cefc704';

export function validateDatabaseArchive(value: unknown, horizonCount: 1 | 6): NakhonRatchasimaDroughtForecastArchive {
  const archive = value as NakhonRatchasimaDroughtForecastArchive | null;
  if (!archive || archive.meta?.sourceOfTruth !== 'normalized_rev02_forecast_archive_workbook' ||
      archive.meta.provinceCode !== '30' || archive.meta.horizonCount !== horizonCount ||
      archive.meta.forecastVintageCount !== 289 * 127 * horizonCount ||
      !Array.isArray(archive.locations) || archive.locations.length !== 289 ||
      !Array.isArray(archive.targetMonths) || archive.targetMonths.length !== 127 ||
      !archive.packedRiskByTargetMonth) throw new Error('Invalid database forecast archive');
  const codes = new Set(archive.locations.map((l) => l.subdistrictCode));
  if (codes.size !== 289 || new Set(archive.targetMonths.map((m) => m.period)).size !== 127) throw new Error('Duplicate forecast keys');
  for (const month of archive.targetMonths) {
    const rows = archive.packedRiskByTargetMonth[month.period];
    if (!rows || Object.keys(rows).length !== codes.size || month.horizons?.length !== horizonCount) throw new Error('Incomplete database month');
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
  let cached: NakhonRatchasimaDroughtForecastArchive | null = null;
  let pending: Promise<NakhonRatchasimaDroughtForecastArchive> | null = null;
  let controller: AbortController | null = null;
  let generation = 0;
  return {
    getCached: () => cached,
    clear() {
      generation++;
      controller?.abort();
      controller = null;
      cached = null;
      pending = null;
    },
    load(): Promise<NakhonRatchasimaDroughtForecastArchive> {
      if (pending) return pending;
      const epoch = generation;
      const request = new AbortController();
      controller = request;
      const timer = setTimeout(() => request.abort(), 30_000);
      pending = (async () => {
        const client = await getClient();
        if (!client) throw new Error('Database unavailable');
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (sessionError || session?.user.id !== userId || request.signal.aborted) throw new Error('Session changed');
        if (cached) return cached;
        const { data, error } = await client.rpc('ktp_load_forecast_archive', {
          p_version: FORECAST_DATASET_VERSION, p_horizon_count: horizonCount,
        }).abortSignal(request.signal);
        if (error) throw new Error('Forecast database unavailable');
        if (epoch !== generation || request.signal.aborted) throw new Error('Session changed');
        const { data: current } = await client.auth.getSession();
        if (current.session?.user.id !== userId) throw new Error('Session changed');
        cached = validateDatabaseArchive(data, horizonCount);
        return cached;
      })().finally(() => {
        clearTimeout(timer);
        if (epoch === generation) { pending = null; controller = null; }
      });
      return pending;
    },
  };
}
