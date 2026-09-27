import archiveUrl from "./canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json?url";
import overviewUrl from "./generated/forecast-overview-t1.json?url";
import { meta as staticForecastRevision } from './canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json';
import type { NakhonRatchasimaDroughtForecastArchive } from "../types";
import { validateDatabaseArchive } from "./supabaseForecastArchive";
import { withLoadDeadline, LoadTimeoutError } from './loadDeadline';
import { reportOperationalEvent } from '../operationalTelemetry';

function createArchiveLoader(url: string, horizonCount: 1 | 6) {
  let cachedArchive: NakhonRatchasimaDroughtForecastArchive | null = null;
  let pendingArchive: Promise<NakhonRatchasimaDroughtForecastArchive> | null = null;

  function getCached() {
    return cachedArchive;
  }

  function load(): Promise<NakhonRatchasimaDroughtForecastArchive> {
    if (cachedArchive) return Promise.resolve(cachedArchive);
    if (pendingArchive) return pendingArchive;
    const controller = new AbortController();
    const startedAt = performance.now();
    pendingArchive = withLoadDeadline(controller, () => fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Forecast archive unavailable");
        const archive = await response.json() as NakhonRatchasimaDroughtForecastArchive;
        if (controller.signal.aborted) throw controller.signal.reason;
        if (
          archive?.meta?.provinceCode !== "30" ||
          archive.meta.horizonCount !== horizonCount ||
          !Array.isArray(archive.locations) || !Array.isArray(archive.targetMonths) ||
          !archive.packedRiskByTargetMonth || typeof archive.packedRiskByTargetMonth !== "object" ||
          archive.locations.length !== archive.meta.totalCanonicalSubdistricts ||
          archive.targetMonths.length !== archive.meta.targetMonthCount ||
          !archive.targetMonths.every((month) => Array.isArray(month.horizons) && archive.packedRiskByTargetMonth[month.period])
        ) throw new Error("Invalid forecast archive");
        cachedArchive = validateDatabaseArchive(archive, horizonCount, staticForecastRevision);
        return cachedArchive;
      }))
      .then((archive) => {
        reportOperationalEvent({ event: 'forecast_load', code: 'LOAD_OK', durationMs: performance.now() - startedAt });
        return archive;
      })
      .catch((error: unknown) => {
        pendingArchive = null;
        reportOperationalEvent({ event: 'forecast_load', code: error instanceof LoadTimeoutError ? 'LOAD_TIMEOUT' : 'LOAD_FAILED', durationMs: performance.now() - startedAt });
        throw error;
      });
    return pendingArchive;
  }
  return { getCached, load };
}

export const forecastArchiveLoader = createArchiveLoader(archiveUrl, 6);
export const forecastOverviewLoader = createArchiveLoader(overviewUrl, 1);
export const getCachedForecastArchive = forecastArchiveLoader.getCached;
export const loadForecastArchive = forecastArchiveLoader.load;
