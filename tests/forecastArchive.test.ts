import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import archiveJson from "../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json";
import overviewSummary from "../src/data/generated/forecast-archive-summary.json";
import { buildForecastArchiveSummary, buildForecastOverviewArchive } from "../scripts/generate-forecast-summary.mjs";
import overviewArchive from "../src/data/generated/forecast-overview-t1.json";

beforeEach(() => vi.resetModules());
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("forecast archive loading", () => {
  it("does not fetch until requested, shares the pending request, and reuses the validated result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => archiveJson });
    vi.stubGlobal("fetch", fetchMock);
    const { loadForecastArchive, getCachedForecastArchive } = await import("../src/data/forecastArchive");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCachedForecastArchive()).toBeNull();
    const first = loadForecastArchive();
    expect(loadForecastArchive()).toBe(first);
    expect(await first).toEqual(archiveJson);
    expect(await loadForecastArchive()).toBe(getCachedForecastArchive());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["http", "json", "shape"])("allows retry after a %s failure without caching invalid data", async (failure) => {
    const response = failure === "http" ? { ok: false } : {
      ok: true,
      json: failure === "json" ? async () => { throw new SyntaxError("Invalid JSON"); } : async () => ({}),
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(response).mockResolvedValue({ ok: true, json: async () => archiveJson });
    vi.stubGlobal("fetch", fetchMock);
    const { loadForecastArchive, getCachedForecastArchive } = await import("../src/data/forecastArchive");
    await expect(loadForecastArchive()).rejects.toThrow();
    expect(getCachedForecastArchive()).toBeNull();
    await expect(loadForecastArchive()).resolves.toEqual(archiveJson);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("times out stalled requests and permits a fresh attempt", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
    })).mockResolvedValue({ ok: true, json: async () => archiveJson });
    vi.stubGlobal("fetch", fetchMock);
    const { loadForecastArchive } = await import("../src/data/forecastArchive");
    const failure = expect(loadForecastArchive()).rejects.toThrow("Load timed out");
    await vi.advanceTimersByTimeAsync(30_000);
    await failure;
    await expect(loadForecastArchive()).resolves.toEqual(archiveJson);
  });

  it("never caches a structurally valid archive with unapproved provenance", async () => {
    const rejectedArchive = { ...archiveJson, meta: { ...archiveJson.meta, sourceWorkbookSha256: "unapproved" } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => rejectedArchive })
      .mockResolvedValueOnce({ ok: true, json: async () => archiveJson });
    vi.stubGlobal("fetch", fetchMock);
    const { loadForecastArchive, getCachedForecastArchive } = await import("../src/data/forecastArchive");
    await expect(loadForecastArchive()).rejects.toThrow("Invalid database forecast archive");
    expect(getCachedForecastArchive()).toBeNull();
    await expect(loadForecastArchive()).resolves.toEqual(archiveJson);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never caches a late body after the deadline or replaces a successful retry with it', async () => {
    vi.useFakeTimers();
    let finish!: (value: unknown) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: () => new Promise(resolve => { finish = resolve; }) })
      .mockResolvedValue({ ok: true, json: async () => archiveJson });
    vi.stubGlobal('fetch', fetchMock);
    const { loadForecastArchive, getCachedForecastArchive } = await import('../src/data/forecastArchive');
    const waiting = expect(loadForecastArchive()).rejects.toThrow('Load timed out');
    await vi.advanceTimersByTimeAsync(30_000); await waiting;
    expect(getCachedForecastArchive()).toBeNull();
    const fresh = await loadForecastArchive();
    finish({ ...archiveJson, meta: { ...archiveJson.meta, sourceWorkbookSha256: 'unapproved' } });
    await Promise.resolve(); await Promise.resolve();
    expect(getCachedForecastArchive()).toBe(fresh);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("overview forecast summary", () => {
  it("projects every T+1 vintage exactly without inventing other horizons", () => {
    expect(JSON.stringify(overviewArchive)).toBe(JSON.stringify(buildForecastOverviewArchive(archiveJson)));
    expect(overviewArchive.meta.horizonCount).toBe(1);
    expect(overviewArchive.meta.targetMonthCount).toBe(127);
    expect(Object.entries(archiveJson.packedRiskByTargetMonth).every(([period, rows]) =>
      Object.entries(rows).every(([code, risks]) => {
        const projected = overviewArchive.packedRiskByTargetMonth[period][code];
        return projected.length === 1 && projected[0] === risks[0];
      }),
    )).toBe(true);
  }, 20_000);

  it("keeps full and overview caches separate", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => overviewArchive })
      .mockResolvedValueOnce({ ok: true, json: async () => archiveJson });
    vi.stubGlobal("fetch", fetchMock);
    const { forecastOverviewLoader, forecastArchiveLoader } = await import("../src/data/forecastArchive");
    await expect(forecastOverviewLoader.load()).resolves.toEqual(overviewArchive);
    expect(forecastArchiveLoader.getCached()).toBeNull();
    await expect(forecastArchiveLoader.load()).resolves.toEqual(archiveJson);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("matches the source archive and preserves the latest target/T+1 coverage", () => {
    expect(overviewSummary).toEqual(buildForecastArchiveSummary(archiveJson));
    expect(overviewSummary).toEqual({
      leadMonth: { period: "2025-12", labelTh: "ธ.ค. 2568" },
      summary: { totalSubdistricts: 289, inScopeSubdistricts: 117, riskSubdistricts: 117 },
    });
  });

  it("does not count missing or out-of-scope values as no-risk", () => {
    const archive = {
      meta: { targetMonthEnd: "2025-12", totalCanonicalSubdistricts: 5 },
      targetMonths: [{ period: "2025-12", labelTh: "ธ.ค. 2568" }],
      locations: ["a", "b", "c", "d", "e"].map((subdistrictCode) => ({ subdistrictCode })),
      packedRiskByTargetMonth: { "2025-12": { a: [0], b: [1], c: [2], d: [null] } },
    };
    expect(buildForecastArchiveSummary(archive).summary).toEqual({
      totalSubdistricts: 5, inScopeSubdistricts: 3, riskSubdistricts: 2,
    });
  });
});
