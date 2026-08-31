import {
  advisory,
  eventEnrichment,
  fieldTasks,
  farmerProfile,
  locations,
  mapLayerCatalog,
  nakhonRatchasimaDistrictSubdistrictMatrix,
  nakhonRatchasimaEvidenceRecords,
  nakhonRatchasimaHierarchy,
  nakhonRatchasimaLocalSubset,
  nakhonRatchasimaMapLayers,
  nakhonRatchasimaOfficialWaterSnapshot,
  nakhonRatchasimaOpsmoacMonthlyReports,
  nakhonRatchasimaRainfallMonthlyHistory,
  nakhonRatchasimaRainfallObservations24h,
  nakhonRatchasimaRainfallSourceAudit,
  nakhonRatchasimaRainfallStations,
  nakhonRatchasimaResearchMonthlyPanel,
  nakhonRatchasimaResearchPanelSummary,
  nakhonRatchasimaSourceMatrix,
  nakhonRatchasimaSubdistrictRainfallCoverage,
  nakhonRatchasimaTemporalMatrix,
  nakhonRatchasimaThaiWaterDroughtForecast,
  nationalMonthlyBackbone,
  outcomeAnalytics,
  provinceMonthlyRisk,
  riskEvents,
  sourceRegistry,
} from "./data/catalog";
import type {
  AppState,
  AppSection,
  AuditEntry,
  DataClass,
  DeliveryRecord,
  EventEnrichment,
  FieldTask,
  LayerAvailability,
  LocationNode,
  NakhonRatchasimaDistrict,
  NakhonRatchasimaEvidenceRecord,
  NakhonRatchasimaMapLayer,
  NakhonRatchasimaMatrixRow,
  NakhonRatchasimaOfficialWaterSnapshot,
  NakhonRatchasimaRainfallCoverageRecord,
  NakhonRatchasimaRainfallConfidence,
  NakhonRatchasimaResearchDistrictLatest,
  NakhonRatchasimaResearchMonthlyPanel,
  NakhonRatchasimaResearchMonthlySubdistrictRecord,
  NakhonRatchasimaResearchPanelSummary,
  NakhonRatchasimaResearchSubdistrictLatest,
  NakhonRatchasimaSubdistrict,
  NakhonRatchasimaThaiWaterDroughtForecast,
  MapLayerRecord,
  ProvinceMonthRisk,
  RiskEvent,
  Severity,
  SourceRegistryRecord,
} from "./types";

export const MAIN_EVENT_ID = "ARE-2026-0825-NE";
export const MAIN_TASK_ID = "FV-0825-NE-01";
export const MAIN_ADVISORY_ID = "ADV-2026-824";
export const FARM_ID = "FARM-001";
export const DEFAULT_MAP_LAYER_ID = "derived-ag-risk";
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
export const NAKHON_RATCHASIMA_LAYER_IDS = {
  adminSubdistrict: "nr-admin-subdistrict",
  localEvidenceSubset: "nr-local-evidence-subset",
  drought: "nr-drought",
  floodExtent: "nr-flood-extent",
  dwrEws: "nr-dwr-ews",
  reservoirs: "nr-reservoirs",
  weatherContext: "nr-weather-context",
  rainfallStations: "nr-rainfall-stations",
  cropExposure: "nr-crop-exposure",
  suitability: "nr-suitability",
  pestEvents: "nr-pest-events",
  derivedAgriculturalRisk: "nr-derived-ag-risk",
  runtimeVerification: "nr-runtime-verification",
  syntheticFallback: "nr-synthetic-fallback",
} as const;

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
    source: "normalized Excel drought panel",
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

export const severityOrder: Record<Severity, number> = {
  Normal: 0,
  Watch: 1,
  Warning: 2,
  Severe: 3,
};

export const severityTone: Record<Severity, string> = {
  Normal: "normal",
  Watch: "watch",
  Warning: "warning",
  Severe: "severe",
};

export function normalizeName(name: string) {
  return name
    .replace(/\bProvince\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function slugifyProvinceName(name: string) {
  return name
    .replace(/\bProvince\b/gi, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getProvinceWorkspacePath(provinceId: string) {
  if (provinceId === NAKHON_RATCHASIMA_ID) return NAKHON_RATCHASIMA_ROUTE_BASE;
  const province = locations.find((location) => location.type === "province" && location.id === provinceId);
  if (!province) return null;
  const slug = province.routingSlug || slugifyProvinceName(province.name);
  return slug ? `/${slug}` : null;
}

export type ProvinceWorkspaceRouteTarget =
  | { valid: true; level: "province"; province: LocationNode; path: string; placeholder: boolean }
  | { valid: false; level: "not-found"; slug: string };

export function parseProvinceWorkspaceRoute(pathname: string): ProvinceWorkspaceRouteTarget | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/" || normalized === "/login") return null;

  const parts = normalized.slice(1).split("/");
  if (parts.length !== 1 || !parts[0]) return null;

  const slug = parts[0];
  const province = locations.find((location) => {
    if (location.type !== "province") return false;
    return location.routingSlug === slug || slugifyProvinceName(location.name) === slug;
  });

  if (!province) return { valid: false, level: "not-found", slug };

  return {
    valid: true,
    level: "province",
    province,
    path: getProvinceWorkspacePath(province.id) ?? normalized,
    placeholder: province.id !== NAKHON_RATCHASIMA_ID,
  };
}

export function formatRai(value: number) {
  return new Intl.NumberFormat("th-TH").format(value);
}

export function getProvinceRecord(
  provinceId: string,
  month: string,
): ProvinceMonthRisk | undefined {
  return provinceMonthlyRisk.find(
    (record) => record.provinceId === provinceId && record.month === month,
  );
}

export function normalizeMapLayerId(layerId: string | undefined) {
  if (!layerId || layerId === "risk") return DEFAULT_MAP_LAYER_ID;
  if (layerId === "evidence") return "drought-crop-water";
  if (!mapLayerCatalog.some((layer) => layer.id === layerId)) return DEFAULT_MAP_LAYER_ID;
  return layerId;
}

export function getMapLayer(layerId: string | undefined): MapLayerRecord {
  const normalized = normalizeMapLayerId(layerId);
  return mapLayerCatalog.find((layer) => layer.id === normalized) ?? mapLayerCatalog[0];
}

export function getSource(sourceId: string): SourceRegistryRecord | undefined {
  return sourceRegistry.find((source) => source.id === sourceId);
}

export function getLayerSources(layerId: string | undefined): SourceRegistryRecord[] {
  return getMapLayer(layerId).sourceIds
    .map((sourceId) => getSource(sourceId))
    .filter((source): source is SourceRegistryRecord => Boolean(source));
}

function layerSupportsSelection(layer: MapLayerRecord, state: Pick<AppState, "selectedMonth" | "selectedHazard" | "selectedCrop" | "selectedProvinceId" | "selectedLocationId">) {
  const hazardSupported =
    state.selectedHazard === "All" || !layer.supportedHazards || layer.supportedHazards.includes(state.selectedHazard);
  const cropSupported =
    state.selectedCrop === "All" || !layer.supportedCrops || layer.supportedCrops.includes(state.selectedCrop);
  const monthSupported = !layer.supportedMonths || layer.supportedMonths.includes(state.selectedMonth);
  const seededSupported =
    !layer.seededLocationIds ||
    layer.seededLocationIds.includes(state.selectedProvinceId) ||
    layer.seededLocationIds.includes(state.selectedLocationId) ||
    layer.seededLocationIds.some((id) => id.startsWith(`${state.selectedProvinceId}-`));
  return { hazardSupported, cropSupported, monthSupported, seededSupported };
}

export function getLayerAvailability(
  state: Pick<AppState, "selectedMonth" | "selectedHazard" | "selectedCrop" | "selectedProvinceId" | "selectedLocationId" | "mapLayer">,
): LayerAvailability {
  const layer = getMapLayer(state.mapLayer);
  const supports = layerSupportsSelection(layer, state);
  const selectedRecord = getProvinceRecord(state.selectedProvinceId, state.selectedMonth);

  if (!supports.hazardSupported || !supports.cropSupported) {
    return { status: "unsupported", title: layer.unsupportedMeaningTh, detail: layer.unsupportedMeaning };
  }
  if (!supports.monthSupported || !selectedRecord) {
    return { status: "no-data", title: layer.noDataMeaningTh, detail: layer.noDataMeaning };
  }
  if (!supports.seededSupported) {
    return { status: layer.status === "reference" ? "source-unavailable" : "no-data", title: layer.noDataMeaningTh, detail: layer.noDataMeaning };
  }
  if (layer.status === "reference" || layer.status === "token-required") {
    return { status: "source-unavailable", title: layer.unavailableMeaningTh, detail: layer.unavailableMeaning };
  }
  if (layer.id === DEFAULT_MAP_LAYER_ID && selectedRecord.severity === "Normal") {
    return {
      status: "low-risk",
      title: "มีข้อมูล และระดับที่คำนวณได้อยู่ในเกณฑ์ปกติ",
      detail: "Data exists and the derived prototype risk is low/normal for this selection.",
    };
  }
  return {
    status: "available",
    title: layer.descriptionTh,
    detail: layer.description,
  };
}

export function getLayerDataClass(layerId: string | undefined): DataClass {
  return getMapLayer(layerId).dataClass;
}

export function getFilteredProvinceRecords(state: Pick<AppState, "selectedMonth" | "selectedHazard" | "selectedCrop">) {
  return provinceMonthlyRisk.filter((record) => {
    if (record.month !== state.selectedMonth) return false;
    if (state.selectedHazard !== "All" && record.primaryHazard !== state.selectedHazard) return false;
    if (state.selectedCrop !== "All" && record.mainCropExposure !== state.selectedCrop) return false;
    return true;
  });
}

export function summarizeNationalRecords(records: ProvinceMonthRisk[]) {
  return records.reduce(
    (summary, record) => {
      summary.exposedRai += record.agriculturalAreaExposedRai;
      summary.highRiskRai += record.highRiskAreaRai;
      summary.severityCounts[record.severity] += 1;
      summary.cropExposure[record.mainCropExposure] =
        (summary.cropExposure[record.mainCropExposure] ?? 0) + record.agriculturalAreaExposedRai;
      return summary;
    },
    {
      exposedRai: 0,
      highRiskRai: 0,
      severityCounts: { Normal: 0, Watch: 0, Warning: 0, Severe: 0 } as Record<Severity, number>,
      cropExposure: {} as Record<string, number>,
    },
  );
}

export function getRuntimeEvent(state: AppState, eventId = state.selectedEventId): RiskEvent {
  const event = riskEvents.find((item) => item.id === eventId) ?? riskEvents[0];
  const runtime = state.runtime;
  return {
    ...event,
    confidence: runtime.eventConfidence[event.id] ?? event.confidence,
    status: runtime.eventStatus[event.id] ?? event.status,
    workflow:
      event.id === MAIN_EVENT_ID
        ? {
            verification: runtime.taskStatus[MAIN_TASK_ID] === "Submitted" ? "Verified" : event.workflow.verification,
            advisory: runtime.advisoryStatus,
            approval: runtime.advisoryStatus === "Published" || runtime.advisoryStatus === "Approved" ? "Approved" : event.workflow.approval,
            publication: runtime.advisoryStatus === "Published" ? "Published" : event.workflow.publication,
          }
        : event.workflow,
  };
}

export function getEventEnrichment(eventId: string): EventEnrichment {
  return eventEnrichment[eventId] ?? eventEnrichment[MAIN_EVENT_ID];
}

export function getEventAuditTrail(state: AppState, eventId: string): AuditEntry[] {
  const base = getEventEnrichment(eventId).auditTrail ?? [];
  const runtime = state.runtime.eventAuditTrail[eventId] ?? [];
  return [...base, ...runtime];
}

export function getTask(taskId: string): FieldTask {
  return fieldTasks.find((task) => task.id === taskId) ?? fieldTasks[0];
}

export function getTaskStatus(state: AppState, taskId: string) {
  return state.runtime.taskStatus[taskId] ?? getTask(taskId).status;
}

export function getAreaChildren(locationId: string): LocationNode[] {
  return locations.filter((location) => location.parent === locationId);
}

export function hasSeededDrilldown(provinceId: string) {
  return getAreaChildren(provinceId).length > 0;
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
  | { kind: "home"; isWorkspace: false; path: "/" }
  | { kind: "nakhon-ratchasima"; isWorkspace: true; path: string; target: NakhonRatchasimaRouteTarget }
  | { kind: "province-workspace"; isWorkspace: true; path: string; target: ProvinceWorkspaceRouteTarget }
  | { kind: "not-found"; isWorkspace: false; path: string };

export function getAppSitemap() {
  return appSitemap;
}

export function resolveAppRoute(pathname: string): AppRouteTarget {
  const normalized = pathname.replace(/\/+$/, "") || "/";

  if (normalized === "/login") return { kind: "login", isWorkspace: false, path: "/login" };

  const localRoute = parseNakhonRatchasimaRoute(normalized);
  if (localRoute) {
    return {
      kind: "nakhon-ratchasima",
      isWorkspace: true,
      path: normalized,
      target: localRoute,
    };
  }

  const provinceRoute = parseProvinceWorkspaceRoute(normalized);
  if (provinceRoute) {
    return {
      kind: "province-workspace",
      isWorkspace: true,
      path: normalized,
      target: provinceRoute,
    };
  }

  return { kind: "not-found", isWorkspace: false, path: normalized };
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

export function getNakhonRatchasimaMatrixRowBySubdistrictCode(
  subdistrictCode: string | undefined,
): NakhonRatchasimaMatrixRow | undefined {
  if (!subdistrictCode) return undefined;
  return nakhonRatchasimaDistrictSubdistrictMatrix.find((row) => row.subdistrict_code === subdistrictCode);
}

export function getNakhonRatchasimaMatrixRowsForDistrict(districtCode: string) {
  return nakhonRatchasimaDistrictSubdistrictMatrix.filter((row) => row.district_code === districtCode);
}

function localSubsetDistrict(districtCode: string | undefined) {
  if (!districtCode) return undefined;
  return nakhonRatchasimaLocalSubset.districts.find((district) => district.districtCode === districtCode);
}

export function getNakhonRatchasimaLocalSubsetForSubdistrict(subdistrictCode: string | undefined) {
  if (!subdistrictCode) return undefined;
  return nakhonRatchasimaLocalSubset.districts
    .flatMap((district) => district.subdistricts)
    .find((subdistrict) => subdistrict.subdistrictCode === subdistrictCode);
}

export function getNakhonRatchasimaDistrictEvidence(districtCode: string | undefined) {
  return localSubsetDistrict(districtCode)?.districtOnlyEvidence ?? [];
}

export function getNakhonRatchasimaEvidenceRecord(evidenceId: string): NakhonRatchasimaEvidenceRecord | undefined {
  return nakhonRatchasimaEvidenceRecords.find((record) => record.id === evidenceId);
}

export function getNakhonRatchasimaEvidenceForLocation(location: {
  districtCode?: string;
  subdistrictCode?: string;
}) {
  const direct = nakhonRatchasimaEvidenceRecords.filter((record) => {
    const geography = record.geography;
    if (location.subdistrictCode) return geography.subdistrict_code === location.subdistrictCode;
    if (location.districtCode) return geography.district_code === location.districtCode && !geography.subdistrict_code;
    return geography.province_code === NAKHON_RATCHASIMA_PROVINCE_CODE && !geography.district_code && !geography.subdistrict_code;
  });
  const inherited = nakhonRatchasimaEvidenceRecords.filter((record) => {
    const geography = record.geography;
    if (location.subdistrictCode) {
      return (
        (geography.district_code === location.districtCode && !geography.subdistrict_code) ||
        (geography.province_code === NAKHON_RATCHASIMA_PROVINCE_CODE && !geography.district_code)
      );
    }
    if (location.districtCode) {
      return geography.province_code === NAKHON_RATCHASIMA_PROVINCE_CODE && !geography.district_code;
    }
    return false;
  });
  return { direct, inherited };
}

export function summarizeNakhonRatchasimaDistrict(district: NakhonRatchasimaDistrict) {
  const rows = getNakhonRatchasimaMatrixRowsForDistrict(district.districtCode);
  const seededSubdistricts = rows.filter((row) => getNakhonRatchasimaLocalSubsetForSubdistrict(row.subdistrict_code));
  const stationRows = rows.filter((row) => row.hydrology_availability === "DWR_EWS_STATION_OR_COVERAGE_VERIFIED");
  const districtEvidence = getNakhonRatchasimaDistrictEvidence(district.districtCode);
  return {
    subdistrictCount: rows.length,
    seededSubdistrictCount: seededSubdistricts.length,
    localEvidenceCount:
      seededSubdistricts.filter(
        (row) => getNakhonRatchasimaLocalSubsetForSubdistrict(row.subdistrict_code)?.coverageClass === "REAL_LOCAL_EVIDENCE",
      ).length + districtEvidence.length,
    stationCoverageCount: stationRows.length,
    hasDistrictOnlyEvidence: districtEvidence.length > 0,
  };
}

export function summarizeNakhonRatchasimaProvince() {
  const districts = getNakhonRatchasimaDistricts();
  return districts.reduce(
    (summary, district) => {
      const districtSummary = summarizeNakhonRatchasimaDistrict(district);
      summary.subdistrictCount += districtSummary.subdistrictCount;
      summary.seededSubdistrictCount += districtSummary.seededSubdistrictCount;
      summary.localEvidenceCount += districtSummary.localEvidenceCount;
      summary.stationCoverageCount += districtSummary.stationCoverageCount;
      if (districtSummary.localEvidenceCount > 0) summary.seededDistrictCount += 1;
      return summary;
    },
    {
      districtCount: districts.length,
      subdistrictCount: 0,
      seededDistrictCount: 0,
      seededSubdistrictCount: 0,
      localEvidenceCount: 0,
      stationCoverageCount: 0,
    },
  );
}

export function getNakhonRatchasimaMapLayers(): NakhonRatchasimaMapLayer[] {
  return nakhonRatchasimaMapLayers;
}

export function getNakhonRatchasimaOfficialWaterSnapshot(): NakhonRatchasimaOfficialWaterSnapshot {
  return nakhonRatchasimaOfficialWaterSnapshot;
}

export function getNakhonRatchasimaThaiWaterDroughtForecast(): NakhonRatchasimaThaiWaterDroughtForecast {
  return nakhonRatchasimaThaiWaterDroughtForecast;
}

export function getNakhonRatchasimaSourceRows() {
  return nakhonRatchasimaSourceMatrix;
}

export function getNakhonRatchasimaOpsmoacMonthlyRows() {
  return nakhonRatchasimaOpsmoacMonthlyReports.months;
}

export function getNakhonRatchasimaRainfallSourceAudit() {
  return nakhonRatchasimaRainfallSourceAudit;
}

export function getNakhonRatchasimaRainfallStations() {
  return nakhonRatchasimaRainfallStations.stations;
}

export function getNakhonRatchasimaRainfallStation(stationId: string | undefined | null) {
  if (!stationId) return undefined;
  return nakhonRatchasimaRainfallStations.stations.find((station) => station.stationId === stationId);
}

export function getNakhonRatchasimaRainfallCoverageRecords() {
  return nakhonRatchasimaSubdistrictRainfallCoverage.records;
}

export function getNakhonRatchasimaRainfallCoverageRecord(
  subdistrictCode: string | undefined | null,
): NakhonRatchasimaRainfallCoverageRecord | undefined {
  if (!subdistrictCode) return undefined;
  return nakhonRatchasimaSubdistrictRainfallCoverage.records.find(
    (record) => record.subdistrictCode === subdistrictCode,
  );
}

export function getNakhonRatchasimaRainfallCoverageForDistrict(districtCode: string | undefined | null) {
  if (!districtCode) return [];
  return nakhonRatchasimaSubdistrictRainfallCoverage.records.filter(
    (record) => record.districtCode === districtCode,
  );
}

export function getNakhonRatchasimaRainfallObservations24h() {
  return nakhonRatchasimaRainfallObservations24h.observations;
}

export function getNakhonRatchasimaHistoricalRainfallWarnings() {
  return nakhonRatchasimaRainfallObservations24h.historicalWarningSamples;
}

export function getNakhonRatchasimaRainfallMonthlyContext() {
  return nakhonRatchasimaRainfallMonthlyHistory.records;
}

export function getNakhonRatchasimaResearchPanelSummary(): NakhonRatchasimaResearchPanelSummary {
  return nakhonRatchasimaResearchPanelSummary;
}

export function getNakhonRatchasimaResearchMonthlyPanel(): NakhonRatchasimaResearchMonthlyPanel {
  return nakhonRatchasimaResearchMonthlyPanel;
}

export function getNakhonRatchasimaResearchPeriods() {
  return Object.keys(nakhonRatchasimaResearchMonthlyPanel.periods).sort();
}

function droughtRiskLabelFromLevel(level: number) {
  if (level >= 2) return "รุนแรง";
  if (level === 1) return "เฝ้าระวัง";
  return "ปกติ";
}

export function getNakhonRatchasimaResearchSubdistrictMonth(
  subdistrictCode: string | undefined | null,
  period: string | undefined | null,
): NakhonRatchasimaResearchMonthlySubdistrictRecord | undefined {
  if (!subdistrictCode || !period) return undefined;
  const packed = nakhonRatchasimaResearchMonthlyPanel.periods[period]?.[subdistrictCode];
  if (!packed) return undefined;
  const [rainfallMm, droughtRiskLevel, droughtRiskConflict, irrigationLegendIndex, websiteImportStatusReady] = packed;
  return {
    period,
    subdistrictCode,
    rainfallMm,
    rainfallUnit: "mm",
    droughtRiskLevel,
    droughtRiskLabelTh: droughtRiskLabelFromLevel(droughtRiskLevel),
    droughtRiskConflict,
    irrigationStatus: nakhonRatchasimaResearchMonthlyPanel.irrigationLegend[irrigationLegendIndex] ?? "Unknown",
    websiteImportStatus: websiteImportStatusReady ? "READY" : "NOT_READY",
  };
}

export function getNakhonRatchasimaResearchSubdistrictLatest(
  subdistrictCode: string | undefined | null,
): NakhonRatchasimaResearchSubdistrictLatest | undefined {
  if (!subdistrictCode) return undefined;
  return nakhonRatchasimaResearchPanelSummary.subdistrictsLatest.find(
    (record) => record.subdistrictCode === subdistrictCode,
  );
}

export function getNakhonRatchasimaResearchDistrictLatest(
  districtCode: string | undefined | null,
): NakhonRatchasimaResearchDistrictLatest | undefined {
  if (!districtCode) return undefined;
  return nakhonRatchasimaResearchPanelSummary.districtsLatest.find(
    (record) => record.districtCode === districtCode,
  );
}

export function summarizeNakhonRatchasimaRainfallCoverage(districtCode?: string) {
  const records = districtCode
    ? getNakhonRatchasimaRainfallCoverageForDistrict(districtCode)
    : nakhonRatchasimaSubdistrictRainfallCoverage.records;
  const confidenceCounts = records.reduce(
    (summary, record) => {
      if (record.confidence) summary[record.confidence] += 1;
      return summary;
    },
    { HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<NakhonRatchasimaRainfallConfidence, number>,
  );

  return {
    totalSubdistricts: records.length,
    directStationSubdistricts: records.filter((record) => record.coverageStatus === "direct_station").length,
    nearestProxySubdistricts: records.filter((record) => record.coverageStatus === "nearest_station_proxy").length,
    noSourceAvailable: records.filter((record) => record.coverageStatus === "no_source_available").length,
    stationCount: nakhonRatchasimaRainfallStations.stations.length,
    observationCount: nakhonRatchasimaRainfallObservations24h.observations.length,
    historicalWarningSampleCount: nakhonRatchasimaRainfallObservations24h.historicalWarningSamples.length,
    monthlyContextRecordCount: nakhonRatchasimaRainfallMonthlyHistory.records.length,
    confidenceCounts,
    latestSourceTimestamp: String(nakhonRatchasimaSubdistrictRainfallCoverage.meta.generatedAt ?? ""),
    current24hStatus: nakhonRatchasimaRainfallObservations24h.meta.status,
    monthlyHistoryStatus: nakhonRatchasimaRainfallMonthlyHistory.meta.status,
    proxyPolicyTh: String(nakhonRatchasimaSubdistrictRainfallCoverage.meta.proxyPolicyTh ?? ""),
  };
}

export function summarizeNakhonRatchasimaPredictionReadiness() {
  const summary = summarizeNakhonRatchasimaProvince();
  const reportRows = getNakhonRatchasimaOpsmoacMonthlyRows();
  const indexedMonthlyReports = reportRows.filter((row) => row.report_status === "MONTHLY_REPORT_INDEXED");
  const currentAndForecastRows = reportRows.filter(
    (row) => row.temporal_semantics === "CURRENT_OPERATIONAL_MONTH" || row.temporal_semantics === "FORECAST_OUTLOOK",
  );

  return {
    canonicalMonthCount: reportRows.length,
    indexedMonthlyReportCount: indexedMonthlyReports.length,
    linkedAttachmentMonthCount: indexedMonthlyReports.filter((row) => row.linked_attachment_count > 0).length,
    relatedWarningOnlyMonths: reportRows
      .filter((row) => row.report_status === "RELATED_WARNING_ONLY_ON_FIRST_INDEX_PAGE")
      .map((row) => row.month),
    currentAndForecastMonths: currentAndForecastRows.map((row) => row.month),
    localPredictionInputSubdistricts: summary.seededSubdistrictCount,
    dwrSourcePathwaySubdistricts: summary.stationCoverageCount,
    totalSubdistricts: summary.subdistrictCount,
    scopeRule: nakhonRatchasimaOpsmoacMonthlyReports.meta.scopeRule,
  };
}

export function getTopRisks(state: Pick<AppState, "selectedMonth" | "runtime">) {
  const statusWeight = (event: RiskEvent) => {
    if (event.id === MAIN_EVENT_ID && state.runtime.advisoryStatus !== "Published") return 4;
    if (event.status.includes("Under Review")) return 4;
    if (event.status.includes("Active")) return 3;
    if (event.status.includes("Forecast")) return 2;
    if (event.status.includes("Monitoring")) return 1;
    return 0;
  };
  return riskEvents
    .filter((event) => event.month === state.selectedMonth || event.id === MAIN_EVENT_ID)
    .sort((a, b) => {
      const statusDelta = statusWeight(b) - statusWeight(a);
      if (statusDelta !== 0) return statusDelta;
      const severityDelta = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDelta !== 0) return severityDelta;
      return b.confidence.localeCompare(a.confidence);
    })
    .slice(0, 4);
}

export function getActionQueue(state: AppState) {
  const items: Array<{ id: string; label: string; detail: string; section: AppSection }> = [];
  const pendingTasks = fieldTasks.filter((task) => getTaskStatus(state, task.id) !== "Submitted");
  items.push(
    ...pendingTasks.map((task) => ({
      id: task.id,
      label: "Field verification pending",
      detail: `${task.farmerGroup} · ${task.crop}`,
      section: "workflows" as AppSection,
    })),
  );

  if (state.runtime.advisoryStatus === "Draft Ready" || state.runtime.advisoryStatus === "Changes Requested") {
    items.push({
      id: MAIN_ADVISORY_ID,
      label: "Advisory draft ready",
      detail: "Edit and submit for supervisor review",
      section: "workflows",
    });
  }
  if (state.runtime.advisoryStatus === "Ready for Review") {
    items.push({
      id: MAIN_ADVISORY_ID,
      label: "Awaiting approval",
      detail: "Supervisor review queue",
      section: "workflows",
    });
  }
  if (state.runtime.advisoryStatus === "Approved") {
    items.push({
      id: MAIN_ADVISORY_ID,
      label: "Publication pending",
      detail: "Select channels and publish alert",
      section: "alerts",
    });
  }
  return items;
}

export function monthContext(month: string) {
  return nationalMonthlyBackbone.find((record) => record.month === month) ?? nationalMonthlyBackbone[2];
}

export function getProvinceTrend(provinceId: string, monthsToShow = 6) {
  return provinceMonthlyRisk
    .filter((record) => record.provinceId === provinceId)
    .slice(-monthsToShow)
    .map((record) => ({
      month: record.month,
      severity: record.severity,
      score: severityOrder[record.severity],
      hazard: record.primaryHazard,
    }));
}

export function getFilteredEvents(state: Pick<AppState, "selectedMonth" | "selectedHazard" | "selectedCrop">) {
  return riskEvents.filter((event) => {
    const monthMatches = event.month === state.selectedMonth || event.id === MAIN_EVENT_ID;
    const hazardMatches = state.selectedHazard === "All" || event.hazard === state.selectedHazard;
    const cropMatches = state.selectedCrop === "All" || event.crops.some((crop) => crop.crop === state.selectedCrop);
    return monthMatches && hazardMatches && cropMatches;
  });
}

export function getOutcomeForEvent(eventId: string) {
  return outcomeAnalytics.find((metric) => metric.riskEventId === eventId);
}

export function getFarmerVisibleAlerts(state: AppState) {
  return state.runtime.farmerAlerts.filter((alert) =>
    farmerProfile.linkedRiskEventIds.includes(alert.linkedRiskEventId),
  );
}

export function buildDeliveryRecords(channels: string[]): DeliveryRecord[] {
  return channels.map((channel, index) => ({
    channel,
    targeted: 2600 + index * 430,
    delivered: 2410 + index * 397,
    viewed: 1380 + index * 230,
    acknowledged: 720 + index * 120,
  }));
}

export function nowAudit(action: string, actor: string): AuditEntry {
  return {
    at: new Date().toISOString(),
    action,
    actor,
  };
}

export { advisory, fieldTasks, farmerProfile, riskEvents };
