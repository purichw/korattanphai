import {
  type NakhonRatchasimaProvinceTab,
  type NakhonRatchasimaRouteTarget,
  getNakhonRatchasimaDistricts,
  getNakhonRatchasimaDistrictByCode,
  getNakhonRatchasimaSubdistrictByCode,
  getNakhonRatchasimaPath,
  getNakhonRatchasimaProvinceTabPath,
  NAKHON_RATCHASIMA_ROUTE_BASE,
} from "../../domain";
import { sharedMapButtonZoomStep, isMapTransformEffectivelyEqual } from "../../mapInteraction";
import { useState, useEffect, type ReactNode } from "react";
import { type AppSelectOption } from "../AppSelect";
import type { NakhonRatchasimaDistrict } from "../../types";

export type NakhonRatchasimaGeoFeature = {
  type: "Feature";
  properties: {
    Admin_code: string;
    P_code: string;
    A_code: string;
    T_code: string;
    P_Name_T: string;
    A_Name_T: string;
    T_Name_T: string;
    Source_Nam: string;
    Source_dat: number;
    Shape_Area: number;
    Shape_Leng: number;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

export type NakhonRatchasimaGeoCollection = {
  type: "FeatureCollection";
  features: NakhonRatchasimaGeoFeature[];
};

export type ProvinceContextGeoFeature = {
  type: "Feature";
  properties: {
    shapeName: string;
    shapeISO: string;
  };
  geometry: NakhonRatchasimaGeoFeature["geometry"];
};

export type ProvinceContextGeoCollection = {
  type: "FeatureCollection";
  features: ProvinceContextGeoFeature[];
};

export type LocalProvinceBoundaryGeoFeature = {
  type: "Feature";
  properties: {
    provinceCode: string;
    provinceNameTh: string;
    derivedFrom: string;
    sourceFeatureCount: number;
    sourceAdminCodes: string[];
  };
  bbox?: number[];
  geometry: NakhonRatchasimaGeoFeature["geometry"];
};

export type LocalProvinceBoundaryGeoCollection = {
  type: "FeatureCollection";
  bbox?: number[];
  features: LocalProvinceBoundaryGeoFeature[];
};

export type Projection = {
  x: (lon: number) => number;
  y: (lat: number) => number;
};

export const NAKHON_RATCHASIMA_NEIGHBOR_BOUNDARY_ISOS = new Set([
  "TH-16",
  "TH-19",
  "TH-25",
  "TH-26",
  "TH-27",
  "TH-31",
  "TH-32",
  "TH-36",
  "TH-40",
]);

export const NAKHON_RATCHASIMA_NEIGHBOR_LABELS_TH: Record<string, string> = {
  "TH-16": "ลพบุรี",
  "TH-19": "สระบุรี",
  "TH-25": "ปราจีนบุรี",
  "TH-26": "นครนายก",
  "TH-27": "สระแก้ว",
  "TH-31": "บุรีรัมย์",
  "TH-32": "สุรินทร์",
  "TH-36": "ชัยภูมิ",
  "TH-40": "ขอนแก่น",
};

export type LocalMapStatus =
  | "no-data"
  | "forecast-no-risk"
  | "forecast-moderate"
  | "forecast-high"
  | "forecast-out-of-scope"
  | "forecast-missing";

export type ProvinceDashboardTab = NakhonRatchasimaProvinceTab;
export type LocalRiskCriterion = "all" | Exclude<LocalMapStatus, "no-data">;
export type LocalMapCriteria = { risk: LocalRiskCriterion };

export type LocalMapTransform = {
  x: number;
  y: number;
  k: number;
};

export type ClientPoint = {
  clientX: number;
  clientY: number;
};

export type PinchStart = {
  distance: number;
  center: { x: number; y: number };
  clientCenter: ClientPoint;
  transform: LocalMapTransform;
};

export type PreviewMode = "hover" | "touch" | "selected";

export type LocalMapPreview = {
  mode: PreviewMode;
  x: number;
  y: number;
  maxHeight?: number;
  width?: number;
  subdistrictCode: string;
  subdistrictTh: string;
  districtTh: string;
  status: LocalMapStatus;
  path: string;
  districtPath: string;
};

export const localMapWidth = 760;

export const localMapHeight = 520;

export const localFitZoom = 0.98;

export const localMobileFitZoom = 1.04;

export const localMinZoom = 0.78;

export const localMaxZoom = 7.2;

export const localZoomStep = sharedMapButtonZoomStep;

export const localDistrictFocusZoom = 2.2;

export const localSubdistrictFocusZoom = 2.72;

export const localMobileDistrictFocusZoom = 3.45;

export const localMobileSubdistrictFocusZoom = 7;

export const localDesktopOverviewPadding = { top: 34, right: 28, bottom: 48, left: 28 };

export const localMobileOverviewPadding = { top: 38, right: 22, bottom: 82, left: 22 };

export const localDesktopFocusPadding = { top: 76, right: 82, bottom: 64, left: 38 };

export const localMobileDistrictFocusPadding = { top: 104, right: 22, bottom: 106, left: 22 };

export const localMobileSelectedFocusPadding = { top: 104, right: 22, bottom: 278, left: 22 };

export const localButtonAnimationDurationMs = 160;

export const localAnimationSnapPositionThreshold = 4;

export const localAnimationSnapZoomThreshold = 0.012;

export const localDeferredTransformCommitDelayMs = 180;

export const primaryCropLabelTh = "ข้าว";

export const primaryHazardLabelTh = "ภัยแล้ง";

export const primaryRiskScopeLabelTh = "ความเสี่ยงภัยแล้ง";

export function provinceDashboardTabLabel(tab: ProvinceDashboardTab) {
  return tab === "drought" ? "ภัยแล้ง" : "ภาพรวม";
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function centeredLocalTransform(k: number): LocalMapTransform {
  return {
    x: Number(((localMapWidth * (1 - k)) / 2).toFixed(3)),
    y: Number(((localMapHeight * (1 - k)) / 2).toFixed(3)),
    k,
  };
}

export const localFitTransform = centeredLocalTransform(localFitZoom);

export const localMobileFitTransform = centeredLocalTransform(localMobileFitZoom);

export function clampLocalTransform(next: LocalMapTransform, maxZoom = localMaxZoom): LocalMapTransform {
  const k = clamp(Number(next.k.toFixed(3)), localMinZoom, maxZoom);

  if (k <= 1) {
    return centeredLocalTransform(k);
  }

  return {
    x: clamp(next.x, localMapWidth * (1 - k), 0),
    y: clamp(next.y, localMapHeight * (1 - k), 0),
    k,
  };
}

export function isLocalTransformVisuallySettled(current: LocalMapTransform, target: LocalMapTransform) {
  return isMapTransformEffectivelyEqual(
    current,
    target,
    localAnimationSnapPositionThreshold,
    localAnimationSnapZoomThreshold,
  );
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

export const coverageLabels: Record<LocalMapStatus, string> = {
  "no-data": "ยังไม่มีข้อมูล",
  "forecast-no-risk": "ไม่พบสัญญาณเสี่ยง",
  "forecast-moderate": "เสี่ยงปานกลาง",
  "forecast-high": "เสี่ยงสูง",
  "forecast-out-of-scope": "นอกขอบเขตการศึกษา",
  "forecast-missing": "ไม่มีข้อมูลในรอบนี้",
};

export function coverageLabel(status: LocalMapStatus) {
  return coverageLabels[status];
}

export function compactCoverageLabel(status: LocalMapStatus) {
  if (status === "forecast-no-risk") return "ไม่เสี่ยง";
  if (status === "forecast-moderate") return "ปานกลาง";
  if (status === "forecast-high") return "สูง";
  if (status === "forecast-out-of-scope") return "นอกขอบเขต";
  return "ไม่มีข้อมูล";
}

export const forecastArchiveRiskCriterionOptions: AppSelectOption[] = [
  { value: "all", label: "ทุกสถานะพยากรณ์", triggerLabel: "ทุกสถานะ", group: "สถานะพยากรณ์" },
  {
    value: "forecast-no-risk",
    label: "ไม่มีความเสี่ยง",
    triggerLabel: "ไม่เสี่ยง",
    group: "สถานะพยากรณ์",
    badgeTone: "good",
  },
  {
    value: "forecast-moderate",
    label: "เสี่ยงปานกลาง",
    triggerLabel: "ปานกลาง",
    group: "สถานะพยากรณ์",
    badgeTone: "watch",
  },
  {
    value: "forecast-high",
    label: "เสี่ยงสูง",
    triggerLabel: "เสี่ยงสูง",
    group: "สถานะพยากรณ์",
    badgeTone: "danger",
  },
  {
    value: "forecast-out-of-scope",
    label: "นอกขอบเขตการศึกษา",
    triggerLabel: "นอกขอบเขต",
    group: "สถานะพยากรณ์",
    badgeTone: "muted",
  },
];

export function defaultLocalMapCriteria(): LocalMapCriteria {
  return { risk: "all" };
}

export function localCriteriaEqual(a: LocalMapCriteria, b: LocalMapCriteria) {
  return a.risk === b.risk;
}

export function forecastArchiveCriteriaSummaryLabel(criteria: LocalMapCriteria) {
  const label = forecastArchiveRiskCriterionOptions.find((option) => option.value === criteria.risk)?.label;
  return label && !label.startsWith("ทุก") ? label : "ไม่มีเงื่อนไขเพิ่มเติม";
}

export const forecastArchiveLegendStatuses: LocalMapStatus[] = [
  "forecast-no-risk",
  "forecast-moderate",
  "forecast-high",
  "forecast-out-of-scope",
];

export function localStatusPillTone(status: LocalMapStatus) {
  if (status === "forecast-high") return "severe";
  if (status === "forecast-moderate") return "watch";
  if (status === "forecast-no-risk") return "normal";
  return "muted";
}

export function localLabelPriorityForStatus(status: LocalMapStatus) {
  if (status === "forecast-high") return 42;
  if (status === "forecast-moderate") return 38;
  if (status === "forecast-no-risk") return 18;
  return 8;
}

export function localPreviewTitleForTarget(target: NakhonRatchasimaRouteTarget, preview: LocalMapPreview) {
  return target.valid && target.level === "province" ? preview.districtTh : preview.subdistrictTh;
}

export function localPreviewActionForTarget(target: NakhonRatchasimaRouteTarget, preview: LocalMapPreview) {
  if (!target.valid) return null;
  if (target.level === "province") return { label: "เปิดอำเภอนี้", path: preview.districtPath };
  if (target.level === "subdistrict" && preview.subdistrictCode === target.subdistrict.subdistrictCode) return null;
  return { label: "เปิดตำบลนี้", path: preview.path };
}

export function geometryBounds(features: NakhonRatchasimaGeoFeature[]) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const visit = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lon, lat] = coords as [number, number];
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      return;
    }
    if (Array.isArray(coords)) coords.forEach(visit);
  };

  features.forEach((feature) => visit(feature.geometry.coordinates));
  return { minLon, minLat, maxLon, maxLat };
}

export function createProjection(features: NakhonRatchasimaGeoFeature[]): Projection {
  const bounds = geometryBounds(features);
  const pad = 18;
  const lonSpan = Math.max(0.01, bounds.maxLon - bounds.minLon);
  const latSpan = Math.max(0.01, bounds.maxLat - bounds.minLat);
  const lonPad = lonSpan * 0.08;
  const latPad = latSpan * 0.08;
  const minLon = bounds.minLon - lonPad;
  const maxLon = bounds.maxLon + lonPad;
  const minLat = bounds.minLat - latPad;
  const maxLat = bounds.maxLat + latPad;
  const scale = Math.min(
    (localMapWidth - pad * 2) / Math.max(0.01, maxLon - minLon),
    (localMapHeight - pad * 2) / Math.max(0.01, maxLat - minLat),
  );
  const drawnWidth = (maxLon - minLon) * scale;
  const drawnHeight = (maxLat - minLat) * scale;
  const offsetX = (localMapWidth - drawnWidth) / 2 - minLon * scale;
  const offsetY = (localMapHeight - drawnHeight) / 2 + maxLat * scale;

  return {
    x: (lon: number) => offsetX + lon * scale,
    y: (lat: number) => offsetY - lat * scale,
  };
}

export function localMapScale(projection: Projection, transform: LocalMapTransform) {
  const unitsPerDegree = projection.x(1) - projection.x(0);
  const centerY = (localMapHeight / 2 - transform.y) / transform.k;
  const latitude = (projection.y(0) - centerY) / (projection.y(0) - projection.y(1));
  // Approximate east-west distance at the visible center of this local projection.
  const kmPerUnit = (111.32 * Math.cos(latitude * Math.PI / 180)) / (unitsPerDegree * transform.k);
  const distanceKm = [1, 2, 5, 10, 20, 25, 50, 100].filter((km) => km / kmPerUnit <= 130).at(-1) ?? 1;
  return { distanceKm, width: distanceKm / kmPerUnit };
}

export function pathForGeometry(geometry: NakhonRatchasimaGeoFeature["geometry"], projection: Projection) {
  const ringPath = (ring: number[][]) =>
    ring
      .map(([lon, lat], index) => `${index === 0 ? "M" : "L"}${projection.x(lon).toFixed(2)},${projection.y(lat).toFixed(2)}`)
      .join(" ") + "Z";

  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as number[][][][])
      .flatMap((polygon) => polygon.map(ringPath))
      .join(" ");
  }

  return (geometry.coordinates as number[][][]).map(ringPath).join(" ");
}

export function pathForFeature(feature: NakhonRatchasimaGeoFeature, projection: Projection) {
  return pathForGeometry(feature.geometry, projection);
}

export function projectedBoundsForFeatures(features: NakhonRatchasimaGeoFeature[], projection: Projection) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lon, lat] = coords as [number, number];
      const x = projection.x(lon);
      const y = projection.y(lat);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      return;
    }
    if (Array.isArray(coords)) coords.forEach(visit);
  };

  features.forEach((feature) => visit(feature.geometry.coordinates));
  return { minX, minY, maxX, maxY };
}

export function transformForLocalFocus(
  features: NakhonRatchasimaGeoFeature[],
  projection: Projection,
  focusZoom: number,
  minimumZoom: number,
  padding = localDesktopFocusPadding,
  maxZoom = localMaxZoom,
) {
  if (features.length === 0) return localFitTransform;
  const bounds = projectedBoundsForFeatures(features, projection);
  const featureWidth = Math.max(1, bounds.maxX - bounds.minX);
  const featureHeight = Math.max(1, bounds.maxY - bounds.minY);
  const usableWidth = Math.max(1, localMapWidth - padding.left - padding.right);
  const usableHeight = Math.max(1, localMapHeight - padding.top - padding.bottom);
  const fitZoom = Math.min(usableWidth / featureWidth, usableHeight / featureHeight);
  const k = clamp(Number(Math.min(focusZoom, Math.max(minimumZoom, fitZoom)).toFixed(3)), minimumZoom, focusZoom);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return clampLocalTransform({
    x: padding.left + usableWidth / 2 - centerX * k,
    y: padding.top + usableHeight / 2 - centerY * k,
    k,
  }, maxZoom);
}

export function districtCodeForFeature(feature: NakhonRatchasimaGeoFeature) {
  return `${feature.properties.P_code}${feature.properties.A_code}`;
}

export function districtOptionForProvince(district: NakhonRatchasimaDistrict): AppSelectOption {
  return {
    value: district.districtCode,
    label: district.nameTh ?? district.name,
    description: `${formatThaiNumber(district.subdistricts.length)} ตำบล`,
  };
}

export function districtOptionsForProvince(): AppSelectOption[] {
  return getNakhonRatchasimaDistricts().map(districtOptionForProvince);
}

export function subdistrictOptionsForRoute(route: NakhonRatchasimaRouteTarget): AppSelectOption[] {
  if (!route.valid || route.level === "subdistrict") return [];
  const districts = route.level === "district" ? [route.district] : getNakhonRatchasimaDistricts();
  return districts.flatMap(district => district.subdistricts.map(area => ({
    value: area.subdistrictCode,
    label: area.nameTh ?? area.name,
    group: route.level === "province" ? district.nameTh : undefined,
    description: route.level === "province" ? `${district.nameTh} · ${area.subdistrictCode}` : area.subdistrictCode,
  })));
}

export function pathForDistrictCode(districtCode: string) {
  const district = getNakhonRatchasimaDistrictByCode(districtCode);
  return district ? getNakhonRatchasimaPath(district) : undefined;
}

export function pathForSubdistrictCode(subdistrictCode: string) {
  const subdistrict = getNakhonRatchasimaSubdistrictByCode(subdistrictCode);
  const district = getNakhonRatchasimaDistrictByCode(subdistrict?.districtCode);
  return district && subdistrict ? getNakhonRatchasimaPath(district, subdistrict) : undefined;
}

export function formatThaiNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits,
  }).format(value);
}

export function buddhistYearGroupForPeriod(period: string) {
  const year = Number(period.slice(0, 4));
  return Number.isFinite(year) ? `พ.ศ. ${formatThaiNumber(year + 543)}` : undefined;
}

export function formatPercent(value: number, maximumFractionDigits = 0) {
  return `${formatThaiNumber(value, maximumFractionDigits)}%`;
}

export type AgriculturalVisibilityFact = {
  id: string;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "default" | "good" | "watch" | "danger" | "muted";
  icon?: ReactNode;
};

export function routeBackTargetForRoute(route: NakhonRatchasimaRouteTarget) {
  if (!route.valid) {
    return { label: "กลับภาพรวม", path: NAKHON_RATCHASIMA_ROUTE_BASE };
  }
  if (route.level === "province" && route.tab !== "overview") {
    return { label: "ภาพรวมจังหวัด", path: NAKHON_RATCHASIMA_ROUTE_BASE };
  }
  if (route.level === "province") {
    return null;
  }
  if (route.level === "district") {
    return { label: "กลับจังหวัด", path: getNakhonRatchasimaProvinceTabPath("drought") };
  }
  return { label: "กลับอำเภอ", path: getNakhonRatchasimaPath(route.district) };
}
