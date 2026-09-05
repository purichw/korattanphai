const localMapUrls = [
  "/geodata/nakhon-ratchasima-subdistricts.geojson",
  "/geodata/thailand-adm1.geojson",
  "/geodata/nakhon-ratchasima-boundary.geojson",
] as const;

const requests = new Map<string, Promise<unknown>>();

export function loadLocalMapGeometry<T>(url: typeof localMapUrls[number]): Promise<T> {
  const cached = requests.get(url);
  if (cached) return cached as Promise<T>;
  const request = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error("Local map geometry unavailable");
      return response.json();
    })
    .catch((error: unknown) => {
      requests.delete(url);
      throw error;
    });
  requests.set(url, request);
  return request;
}

export function preloadLocalMapGeometry() {
  // Optional context failures must not prevent the main boundary from loading.
  return Promise.allSettled(localMapUrls.map((url) => loadLocalMapGeometry(url)));
}
