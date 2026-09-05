import type { NakhonRatchasimaDroughtForecastArchive } from '../types';

// Supabase builds resolve the legacy loader here so raw forecast JSON is not
// emitted as a publicly downloadable asset. Failure must never trigger fallback.
const disabledLoader = {
  getCached: (): NakhonRatchasimaDroughtForecastArchive | null => null,
  load: async (): Promise<NakhonRatchasimaDroughtForecastArchive> => { throw new Error('Static forecast provider disabled'); },
};
export const forecastArchiveLoader = disabledLoader;
export const forecastOverviewLoader = disabledLoader;
