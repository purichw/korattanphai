import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

it("shares pending and parsed geometry across preloading and map mounts", async () => {
  const geometry = { type: "FeatureCollection", features: [] };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => geometry });
  vi.stubGlobal("fetch", fetchMock);
  const { preloadLocalMapGeometry, loadLocalMapGeometry } = await import("../src/data/localMapGeometry");
  const preload = preloadLocalMapGeometry();
  const first = loadLocalMapGeometry("/geodata/nakhon-ratchasima-subdistricts.geojson");
  expect(loadLocalMapGeometry("/geodata/nakhon-ratchasima-subdistricts.geojson")).toBe(first);
  await preload;
  expect(await first).toBe(geometry);
  await loadLocalMapGeometry("/geodata/nakhon-ratchasima-boundary.geojson");
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("does not cache failures or fail the main geometry when optional context fails", async () => {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => ({
    ok: url.endsWith("nakhon-ratchasima-subdistricts.geojson"), json: async () => ({ features: [] }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  const { preloadLocalMapGeometry, loadLocalMapGeometry } = await import("../src/data/localMapGeometry");
  const result = await preloadLocalMapGeometry();
  expect(result.map((entry) => entry.status)).toEqual(["fulfilled", "rejected", "rejected"]);
  await expect(loadLocalMapGeometry("/geodata/nakhon-ratchasima-subdistricts.geojson")).resolves.toEqual({ features: [] });
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ features: ["context"] }) });
  await expect(loadLocalMapGeometry("/geodata/thailand-adm1.geojson")).resolves.toEqual({ features: ["context"] });
  expect(fetchMock).toHaveBeenCalledTimes(4);
});
