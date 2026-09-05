import archiveUrl from "./canonical/nakhon_ratchasima/drought_forecast_archive_rev02.json?url";
import overviewUrl from "./generated/forecast-overview-t1.json?url";
import type { NakhonRatchasimaDroughtForecastArchive } from "../types";

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
    const timeout = setTimeout(() => controller.abort(), 30_000);
    pendingArchive = fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Forecast archive unavailable");
        const archive = await response.json() as NakhonRatchasimaDroughtForecastArchive;
        if (
          archive?.meta?.provinceCode !== "30" ||
          archive.meta.horizonCount !== horizonCount ||
          !Array.isArray(archive.locations) || !Array.isArray(archive.targetMonths) ||
          !archive.packedRiskByTargetMonth || typeof archive.packedRiskByTargetMonth !== "object" ||
          archive.locations.length !== archive.meta.totalCanonicalSubdistricts ||
          archive.targetMonths.length !== archive.meta.targetMonthCount ||
          !archive.targetMonths.every((month) => Array.isArray(month.horizons) && archive.packedRiskByTargetMonth[month.period])
        ) throw new Error("Invalid forecast archive");
        cachedArchive = archive;
        return archive;
      })
      .catch((error: unknown) => {
        pendingArchive = null;
        throw error;
      })
      .finally(() => clearTimeout(timeout));
    return pendingArchive;
  }
  return { getCached, load };
}

export const forecastArchiveLoader = createArchiveLoader(archiveUrl, 6);
export const forecastOverviewLoader = createArchiveLoader(overviewUrl, 1);
export const getCachedForecastArchive = forecastArchiveLoader.getCached;
export const loadForecastArchive = forecastArchiveLoader.load;
