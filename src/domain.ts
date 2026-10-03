import { locations, nakhonRatchasimaHierarchy } from "./data/catalog";
import type { LocationNode, NakhonRatchasimaDistrict, NakhonRatchasimaSubdistrict } from "./types";

export const NAKHON_RATCHASIMA_ID = "TH-P29";
export const NAKHON_RATCHASIMA_PROVINCE_CODE = "30";
export const NAKHON_RATCHASIMA_ROUTE_BASE = "/";
export const NAKHON_RATCHASIMA_LEGACY_ROUTE_BASE = "/nakhon-ratchasima";
export type NakhonRatchasimaProvinceTab = "overview" | "drought";
export const NAKHON_RATCHASIMA_PROVINCE_TABS: ReadonlyArray<{
  id: NakhonRatchasimaProvinceTab;
  path: string;
}> = [
  { id: "overview", path: NAKHON_RATCHASIMA_ROUTE_BASE },
  { id: "drought", path: "/drought" },
] as const;
const NAKHON_RATCHASIMA_RESERVED_PROVINCE_TABS = ["drought"] as const;
type NakhonRatchasimaReservedProvinceTab = (typeof NAKHON_RATCHASIMA_RESERVED_PROVINCE_TABS)[number];

function isNakhonRatchasimaReservedProvinceTab(value: string): value is NakhonRatchasimaReservedProvinceTab {
  return NAKHON_RATCHASIMA_RESERVED_PROVINCE_TABS.includes(value as NakhonRatchasimaReservedProvinceTab);
}
export const appSitemap = [
  {
    id: "login",
    pattern: "/login",
    scope: "auth",
    source: "static",
  },
  {
    id: "nakhon-ratchasima-home",
    pattern: "/",
    scope: "province",
    source: "canonical Nakhon Ratchasima hierarchy",
  },
  {
    id: "nakhon-ratchasima-drought",
    pattern: "/drought",
    scope: "province",
    source: "published rev03 forecast archive",
  },
  {
    id: "nakhon-ratchasima-district",
    pattern: "/{district-slug}",
    scope: "district",
    source: "canonical Nakhon Ratchasima hierarchy",
  },
  {
    id: "nakhon-ratchasima-subdistrict",
    pattern: "/{district-slug}/{subdistrict-slug}",
    scope: "subdistrict",
    source: "canonical Nakhon Ratchasima hierarchy",
  },
  {
    id: "legacy-nakhon-ratchasima-province",
    pattern: "/nakhon-ratchasima",
    scope: "province",
    source: "legacy alias",
  },
  {
    id: "legacy-nakhon-ratchasima-district",
    pattern: "/nakhon-ratchasima/{district-slug}",
    scope: "district",
    source: "legacy alias",
  },
  {
    id: "legacy-nakhon-ratchasima-subdistrict",
    pattern: "/nakhon-ratchasima/{district-slug}/{subdistrict-slug}",
    scope: "subdistrict",
    source: "legacy alias",
  },
] as const;

export function formatRai(value: number) {
  return new Intl.NumberFormat("th-TH").format(value);
}

export function getAreaChildren(locationId: string): LocationNode[] {
  return locations.filter((location) => location.parent === locationId);
}

export function getLocationById(locationId: string): LocationNode | undefined {
  return locations.find((location) => location.id === locationId);
}

export function getNakhonRatchasimaDistricts(): NakhonRatchasimaDistrict[] {
  return nakhonRatchasimaHierarchy.province.districts;
}

export function getNakhonRatchasimaDistrictBySlug(slug: string | undefined) {
  if (!slug) return undefined;
  return getNakhonRatchasimaDistricts().find((district) => district.routingSlug === slug);
}

export function getNakhonRatchasimaDistrictByCode(code: string | undefined) {
  if (!code) return undefined;
  return getNakhonRatchasimaDistricts().find((district) => district.districtCode === code);
}

export function getNakhonRatchasimaSubdistrictByCode(code: string | undefined) {
  if (!code) return undefined;
  for (const district of getNakhonRatchasimaDistricts()) {
    const subdistrict = district.subdistricts.find((item) => item.subdistrictCode === code);
    if (subdistrict) return subdistrict;
  }
  return undefined;
}

export function getNakhonRatchasimaSubdistrictByRoute(
  districtSlug: string | undefined,
  subdistrictSlug: string | undefined,
) {
  const district = getNakhonRatchasimaDistrictBySlug(districtSlug);
  if (!district || !subdistrictSlug) return undefined;
  return district.subdistricts.find((subdistrict) => subdistrict.routingSlug === subdistrictSlug);
}

export type NakhonRatchasimaRouteTarget =
  | { valid: true; level: "province"; tab: NakhonRatchasimaProvinceTab; district?: undefined; subdistrict?: undefined }
  | { valid: true; level: "district"; district: NakhonRatchasimaDistrict; subdistrict?: undefined }
  | {
      valid: true;
      level: "subdistrict";
      district: NakhonRatchasimaDistrict;
      subdistrict: NakhonRatchasimaSubdistrict;
    }
  | { valid: false; level: "not-found"; district?: undefined; subdistrict?: undefined };

export function parseNakhonRatchasimaRoute(pathname: string): NakhonRatchasimaRouteTarget | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/login") return null;

  const routePath = normalized.startsWith(`${NAKHON_RATCHASIMA_LEGACY_ROUTE_BASE}/`)
    ? normalized.slice(NAKHON_RATCHASIMA_LEGACY_ROUTE_BASE.length) || "/"
    : normalized === NAKHON_RATCHASIMA_LEGACY_ROUTE_BASE
      ? "/"
      : normalized;

  if (!routePath.startsWith("/")) {
    return null;
  }

  const [districtSlug, subdistrictSlug, extra] = routePath.slice(1).split("/");
  if (extra) return { valid: false, level: "not-found" };
  if (!districtSlug) return { valid: true, level: "province", tab: "overview" };
  if (isNakhonRatchasimaReservedProvinceTab(districtSlug)) {
    return subdistrictSlug
      ? { valid: false, level: "not-found" }
      : { valid: true, level: "province", tab: districtSlug };
  }

  const district = getNakhonRatchasimaDistrictBySlug(districtSlug);
  if (!district) return { valid: false, level: "not-found" };
  if (!subdistrictSlug) return { valid: true, level: "district", district };

  const subdistrict = district.subdistricts.find((item) => item.routingSlug === subdistrictSlug);
  if (!subdistrict) return { valid: false, level: "not-found" };
  return { valid: true, level: "subdistrict", district, subdistrict };
}

export type AppRouteTarget =
  | { kind: "login"; isWorkspace: false; path: "/login" }
  | { kind: "nakhon-ratchasima"; isWorkspace: true; path: string; target: NakhonRatchasimaRouteTarget }
  | { kind: "not-found"; isWorkspace: false; path: string };

export function getAppSitemap() {
  return appSitemap;
}

export function resolveAppRoute(pathname: string): AppRouteTarget {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/login") return { kind: "login", isWorkspace: false, path: "/login" };
  const localRoute = parseNakhonRatchasimaRoute(normalized);
  return localRoute
    ? { kind: "nakhon-ratchasima", isWorkspace: true, path: normalized, target: localRoute }
    : { kind: "not-found", isWorkspace: false, path: normalized };
}

export function isWorkspaceAppRoute(pathname: string) {
  return resolveAppRoute(pathname).isWorkspace;
}

export function getNakhonRatchasimaPath(district?: NakhonRatchasimaDistrict, subdistrict?: NakhonRatchasimaSubdistrict) {
  if (district && subdistrict) return `/${district.routingSlug}/${subdistrict.routingSlug}`;
  if (district) return `/${district.routingSlug}`;
  return NAKHON_RATCHASIMA_ROUTE_BASE;
}

export function getNakhonRatchasimaProvinceTabPath(tab: NakhonRatchasimaProvinceTab) {
  return NAKHON_RATCHASIMA_PROVINCE_TABS.find((item) => item.id === tab)?.path ?? NAKHON_RATCHASIMA_ROUTE_BASE;
}
