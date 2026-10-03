import { withLoadDeadline, LoadTimeoutError } from './loadDeadline';
import { reportOperationalEvent } from '../operationalTelemetry';
import { cmsReferencesEnabled, loadCmsGeometry } from './cmsReferences';

const localMapUrls = [
  "/geodata/nakhon-ratchasima-subdistricts.geojson",
  "/geodata/thailand-adm1.geojson",
  "/geodata/nakhon-ratchasima-boundary.geojson",
] as const;

const requests = new Map<string, Promise<unknown>>();

export function loadLocalMapGeometry<T>(url: typeof localMapUrls[number]): Promise<T> {
  const cached = requests.get(url);
  if (cached) return cached as Promise<T>;
  const controller = new AbortController();
  const startedAt = performance.now();
  const request = withLoadDeadline(controller, () => cmsReferencesEnabled ? loadCmsGeometry<T>(url) : fetch(url, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error("Local map geometry unavailable");
      return response.json();
    }))
    .then((geometry) => {
      reportOperationalEvent({ event: 'map_load', code: 'LOAD_OK', durationMs: performance.now() - startedAt });
      return geometry;
    })
    .catch((error: unknown) => {
      requests.delete(url);
      reportOperationalEvent({ event: 'map_load', code: error instanceof LoadTimeoutError ? 'LOAD_TIMEOUT' : 'LOAD_FAILED', durationMs: performance.now() - startedAt });
      throw error;
    });
  requests.set(url, request);
  return request;
}

export function preloadLocalMapGeometry() {
  // Optional context failures must not prevent the main boundary from loading.
  return Promise.allSettled(localMapUrls.map((url) => loadLocalMapGeometry(url)));
}
