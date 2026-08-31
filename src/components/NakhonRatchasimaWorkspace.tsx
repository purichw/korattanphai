import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Database,
  Gauge,
  Leaf,
  LocateFixed,
  Maximize2,
  Minimize2,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { AppSelect, type AppSelectOption } from "./AppSelect";
import { AuditTrailFootnotes, type AuditTrailSection } from "./AuditTrail";
import { ContentSection } from "./ContentSection";
import { DataProvenanceChip, DataProvenanceLegend, dataProvenanceChipKindFromText, type DataProvenanceChipKind } from "./DataProvenanceChip";
import { OperationalFilters } from "./OperationalFilters";
import { MetricCard, PageSummary } from "./PageSummary";
import {
  getAnchoredZoomTransform,
  getSharedMapWheelAction,
  interpolateMapTransform,
  isMapTransformSettled,
  sharedMapButtonZoomStep,
} from "../mapInteraction";
import {
  makeVisibleMapLabels,
  type MapLabelCandidate,
  projectedBoundsForGeometries,
  projectedLabelPointForGeometries,
  projectedLabelPointForGeometry,
} from "../mapLabels";
import { useFullscreenTarget } from "../useFullscreenTarget";
import {
  formatRai,
  getNakhonRatchasimaDistrictByCode,
  getNakhonRatchasimaDistrictEvidence,
  getNakhonRatchasimaDistricts,
  getNakhonRatchasimaEvidenceForLocation,
  getNakhonRatchasimaEvidenceRecord,
  getNakhonRatchasimaLocalSubsetForSubdistrict,
  getNakhonRatchasimaMapLayers,
  getNakhonRatchasimaMatrixRowBySubdistrictCode,
  getNakhonRatchasimaMatrixRowsForDistrict,
  getNakhonRatchasimaPath,
  getNakhonRatchasimaProvinceTabPath,
  getNakhonRatchasimaResearchPanelSummary,
  getNakhonRatchasimaResearchPeriods,
  getNakhonRatchasimaResearchSubdistrictMonth,
  getNakhonRatchasimaResearchSubdistrictLatest,
  getNakhonRatchasimaSourceRows,
  getNakhonRatchasimaThaiWaterDroughtForecast,
  getProvinceRecord,
  NAKHON_RATCHASIMA_ID,
  NAKHON_RATCHASIMA_LAYER_IDS,
  NAKHON_RATCHASIMA_ROUTE_BASE,
  type NakhonRatchasimaProvinceTab,
  type NakhonRatchasimaRouteTarget,
  summarizeNakhonRatchasimaDistrict,
  summarizeNakhonRatchasimaProvince,
} from "../domain";
import { formatMonth, labelConfidence, severityLabel } from "../i18n";
import { useAppDispatch, useAppState } from "../store";
import type {
  DataClass,
  NakhonRatchasimaDistrict,
  NakhonRatchasimaEvidenceRecord,
  NakhonRatchasimaMapLayer,
  NakhonRatchasimaMatrixRow,
  NakhonRatchasimaResearchDistrictLatest,
  NakhonRatchasimaResearchMonthlySubdistrictRecord,
  NakhonRatchasimaResearchPanelSummary,
  NakhonRatchasimaResearchSubdistrictLatest,
  NakhonRatchasimaSubdistrict,
  NakhonRatchasimaThaiWaterDroughtForecast,
  NakhonRatchasimaThaiWaterDroughtForecastMonth,
  ProvinceMonthRisk,
} from "../types";

type NakhonRatchasimaGeoFeature = {
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

type NakhonRatchasimaGeoCollection = {
  type: "FeatureCollection";
  features: NakhonRatchasimaGeoFeature[];
};

type ProvinceContextGeoFeature = {
  type: "Feature";
  properties: {
    shapeName: string;
    shapeISO: string;
  };
  geometry: NakhonRatchasimaGeoFeature["geometry"];
};

type ProvinceContextGeoCollection = {
  type: "FeatureCollection";
  features: ProvinceContextGeoFeature[];
};

type Projection = {
  x: (lon: number) => number;
  y: (lat: number) => number;
};

const NAKHON_RATCHASIMA_NEIGHBOR_BOUNDARY_ISOS = new Set([
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

type LocalMapStatus =
  | "admin"
  | "local-evidence"
  | "source-capability"
  | "district-evidence"
  | "research-drought-normal"
  | "research-drought-watch"
  | "research-drought-severe"
  | "research-study-ready"
  | "research-study-missing"
  | "insufficient"
  | "no-data";

type LocalMapMode = "prediction-readiness" | "evidence-coverage" | "source-readiness";
type ProvinceDashboardTab = NakhonRatchasimaProvinceTab;
type LocalMapViewMode = "risk" | "study";
type LocalStudyCriterion = "all" | "studied" | "unstudied";
type LocalRiskCriterion = "all" | "green" | "yellow" | "red";

type LocalMapCriteria = {
  viewMode: LocalMapViewMode;
  study: LocalStudyCriterion;
  risk: LocalRiskCriterion;
};

type LocalMapTransform = {
  x: number;
  y: number;
  k: number;
};

type ClientPoint = {
  clientX: number;
  clientY: number;
};

type PinchStart = {
  distance: number;
  center: { x: number; y: number };
  clientCenter: ClientPoint;
  transform: LocalMapTransform;
};

type PreviewMode = "hover" | "touch" | "selected";

type LocalMapPreview = {
  mode: PreviewMode;
  x: number;
  y: number;
  subdistrictCode: string;
  subdistrictTh: string;
  districtTh: string;
  status: LocalMapStatus;
  path: string;
  districtPath: string;
};

const localMapWidth = 760;
const localMapHeight = 520;
const localFitZoom = 0.98;
const localMinZoom = 0.78;
const localMaxZoom = 5.2;
const localZoomStep = sharedMapButtonZoomStep;
const localDistrictFocusZoom = 2.2;
const localSubdistrictFocusZoom = 2.72;
const primaryCropLabelTh = "ข้าว";
const primaryHazardLabelTh = "ภัยแล้ง";
const primaryRiskScopeLabelTh = "ความเสี่ยงภัยแล้ง";
const hiddenLocalHydrologyLayerIds = new Set<string>([
  NAKHON_RATCHASIMA_LAYER_IDS.floodExtent,
  NAKHON_RATCHASIMA_LAYER_IDS.dwrEws,
  NAKHON_RATCHASIMA_LAYER_IDS.reservoirs,
  NAKHON_RATCHASIMA_LAYER_IDS.weatherContext,
  NAKHON_RATCHASIMA_LAYER_IDS.rainfallStations,
]);

const provinceDashboardTabs: Array<{
  id: ProvinceDashboardTab;
  path: string;
  label: string;
  helper: string;
}> = [
  {
    id: "overview",
    path: getNakhonRatchasimaProvinceTabPath("overview"),
    label: "ภาพรวม",
    helper: "สรุปสถานการณ์วันนี้และพื้นที่ที่ต้องติดตาม",
  },
  {
    id: "drought",
    path: getNakhonRatchasimaProvinceTabPath("drought"),
    label: "ภัยแล้ง",
    helper: "สถานะภัยแล้งและรายการข้อมูลที่ต้องตรวจสอบ",
  },
];

function dashboardDefaultsForTab(tab: ProvinceDashboardTab): { layerId: string; mapMode: LocalMapMode } {
  if (tab === "drought") {
    return {
      layerId: NAKHON_RATCHASIMA_LAYER_IDS.drought,
      mapMode: "prediction-readiness",
    };
  }
  return {
    layerId: NAKHON_RATCHASIMA_LAYER_IDS.derivedAgriculturalRisk,
    mapMode: "prediction-readiness",
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function centeredLocalTransform(k: number): LocalMapTransform {
  return {
    x: Number(((localMapWidth * (1 - k)) / 2).toFixed(3)),
    y: Number(((localMapHeight * (1 - k)) / 2).toFixed(3)),
    k,
  };
}

const localFitTransform = centeredLocalTransform(localFitZoom);

function clampLocalTransform(next: LocalMapTransform): LocalMapTransform {
  const k = clamp(Number(next.k.toFixed(3)), localMinZoom, localMaxZoom);

  if (k <= 1) {
    return centeredLocalTransform(k);
  }

  return {
    x: clamp(next.x, localMapWidth * (1 - k), 0),
    y: clamp(next.y, localMapHeight * (1 - k), 0),
    k,
  };
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const coverageLabels: Record<LocalMapStatus, string> = {
  admin: "ขอบเขตการปกครอง",
  "local-evidence": "มีหลักฐานท้องถิ่น",
  "source-capability": "มีแหล่งข้อมูลตั้งต้น",
  "district-evidence": "มีหลักฐานระดับอำเภอ",
  "research-drought-normal": "ปกติในชุดข้อมูล",
  "research-drought-watch": "เฝ้าระวังในชุดข้อมูล",
  "research-drought-severe": "เสี่ยงสูงในชุดข้อมูล",
  "research-study-ready": "มีข้อมูลในระบบ",
  "research-study-missing": "ไม่มีข้อมูลในระบบ",
  insufficient: "ข้อมูลไม่พอคำนวณ",
  "no-data": "ยังไม่มีหลักฐานเชิงลึก",
};

const localMapModes: Array<{
  id: LocalMapMode;
  label: string;
  helper: string;
}> = [
  {
    id: "prediction-readiness",
    label: "ความพร้อมคาดการณ์",
    helper: "อ่านว่าข้อมูลนำเข้าส่วนไหนพร้อมพอสำหรับโมเดล ไม่ใช่ระดับภัยที่เกิดแล้ว",
  },
  {
    id: "evidence-coverage",
    label: "หลักฐานรองรับ",
    helper: "แยกหลักฐานท้องถิ่น แหล่งข้อมูล และบริบทระดับอำเภอ",
  },
  {
    id: "source-readiness",
    label: "ความพร้อมแหล่งข้อมูล",
    helper: "ดูพื้นที่ที่มีช่องทางดึงข้อมูลต่อสำหรับการคำนวณ",
  },
];

const coverageLabelsByMode: Record<LocalMapMode, Record<LocalMapStatus, string>> = {
  "prediction-readiness": {
    admin: "ขอบเขตการปกครอง",
    "local-evidence": "พร้อมคาดการณ์ระดับพื้นที่",
    "source-capability": "มีข้อมูลนำเข้าตั้งต้น",
    "district-evidence": "มีบริบทระดับอำเภอ",
    "research-drought-normal": "ปกติในชุดข้อมูล",
    "research-drought-watch": "เฝ้าระวังในชุดข้อมูล",
    "research-drought-severe": "เสี่ยงสูงในชุดข้อมูล",
    "research-study-ready": "มีข้อมูลในระบบ",
    "research-study-missing": "ไม่มีข้อมูลในระบบ",
    insufficient: "ต้องเติมข้อมูลก่อนคำนวณ",
    "no-data": "ยังไม่พอคาดการณ์",
  },
  "evidence-coverage": coverageLabels,
  "source-readiness": {
    admin: "ขอบเขตการปกครอง",
    "local-evidence": "มีหลักฐานท้องถิ่น",
    "source-capability": "มีช่องทางข้อมูล",
    "district-evidence": "มีรายงานระดับอำเภอ",
    "research-drought-normal": "ปกติในชุดข้อมูล",
    "research-drought-watch": "เฝ้าระวังในชุดข้อมูล",
    "research-drought-severe": "เสี่ยงสูงในชุดข้อมูล",
    "research-study-ready": "มีข้อมูลในระบบ",
    "research-study-missing": "ไม่มีข้อมูลในระบบ",
    insufficient: "รอเชื่อมแหล่งข้อมูล",
    "no-data": "ยังไม่พบแหล่งข้อมูลท้องถิ่น",
  },
};

function coverageLabel(status: LocalMapStatus, mode: LocalMapMode) {
  return coverageLabelsByMode[mode][status];
}

function mapModeHelper(mode: LocalMapMode) {
  return localMapModes.find((item) => item.id === mode)?.helper ?? "";
}

const localMapViewOptions: AppSelectOption[] = [
  { value: "risk", label: "ความเสี่ยงภัยแล้ง", group: "มุมมองสี" },
  { value: "study", label: "ข้อมูลในระบบ", group: "มุมมองสี" },
];

const localStudyCriterionOptions: AppSelectOption[] = [
  { value: "all", label: "ทุกตำบล", group: "ข้อมูลในระบบ" },
  { value: "studied", label: "มีข้อมูลในระบบ", group: "ข้อมูลในระบบ" },
  { value: "unstudied", label: "ไม่มีข้อมูลในระบบ", group: "ข้อมูลในระบบ" },
];

const localRiskCriterionOptions: AppSelectOption[] = [
  { value: "all", label: "ทุกระดับภัยแล้ง", group: "ความเสี่ยงภัยแล้ง" },
  { value: "green", label: "ปกติ", group: "ความเสี่ยงภัยแล้ง" },
  { value: "yellow", label: "เฝ้าระวัง", group: "ความเสี่ยงภัยแล้ง" },
  { value: "red", label: "เสี่ยงสูง", group: "ความเสี่ยงภัยแล้ง" },
];

function layerUsesResearchCriteriaMap(layerId: string, activeTab?: ProvinceDashboardTab | null) {
  if (activeTab === "drought") return true;
  return layerId === NAKHON_RATCHASIMA_LAYER_IDS.derivedAgriculturalRisk || layerId === NAKHON_RATCHASIMA_LAYER_IDS.drought;
}

function defaultLocalMapCriteria(_activeTab?: ProvinceDashboardTab | null, _layerId?: string): LocalMapCriteria {
  return {
    viewMode: "risk",
    study: "all",
    risk: "all",
  };
}

function localCriteriaEqual(a: LocalMapCriteria, b: LocalMapCriteria) {
  return a.viewMode === b.viewMode && a.study === b.study && a.risk === b.risk;
}

function localMapCriteriaSummaryLabel(criteria: LocalMapCriteria) {
  const parts = [
    localStudyCriterionOptions.find((option) => option.value === criteria.study)?.label,
    localRiskCriterionOptions.find((option) => option.value === criteria.risk)?.label,
  ].filter((part): part is string => Boolean(part && !part.startsWith("ทุก")));
  return parts.length > 0 ? parts.join(" + ") : "ไม่มีเงื่อนไขเพิ่มเติม";
}

function localResearchPeriodForSelectedMonth(selectedMonth: string, summary: NakhonRatchasimaResearchPanelSummary) {
  const periods = getNakhonRatchasimaResearchPeriods();
  if (periods.includes(selectedMonth)) return { period: selectedMonth, isFallback: false };
  return { period: summary.meta.periodEnd, isFallback: selectedMonth !== summary.meta.periodEnd };
}

type LocalResearchRecord =
  | NakhonRatchasimaResearchMonthlySubdistrictRecord
  | NakhonRatchasimaResearchSubdistrictLatest
  | undefined;

function localResearchRecordForSubdistrict(subdistrictCode: string | undefined | null, period: string) {
  return getNakhonRatchasimaResearchSubdistrictMonth(subdistrictCode, period) ?? getNakhonRatchasimaResearchSubdistrictLatest(subdistrictCode);
}

function localRiskCriterionForRecord(record: LocalResearchRecord): Exclude<LocalRiskCriterion, "all"> | null {
  if (!record) return null;
  if (record.droughtRiskLevel >= 2) return "red";
  if (record.droughtRiskLevel === 1) return "yellow";
  return "green";
}

function localStudyCriterionForRecord(record: LocalResearchRecord): Exclude<LocalStudyCriterion, "all"> {
  return record?.websiteImportStatus?.startsWith("READY") ? "studied" : "unstudied";
}

function localResearchRecordMatchesCriteria(record: LocalResearchRecord, criteria: LocalMapCriteria) {
  if (criteria.study !== "all" && localStudyCriterionForRecord(record) !== criteria.study) return false;
  if (!record) return criteria.risk === "all";
  if (criteria.risk !== "all" && localRiskCriterionForRecord(record) !== criteria.risk) return false;
  return true;
}

function researchDroughtStatusForRecord(record: LocalResearchRecord): LocalMapStatus {
  if (!record) return "no-data";
  if (record.droughtRiskLevel >= 2) return "research-drought-severe";
  if (record.droughtRiskLevel === 1) return "research-drought-watch";
  return "research-drought-normal";
}

function researchStudyStatusForRecord(record: LocalResearchRecord): LocalMapStatus {
  return localStudyCriterionForRecord(record) === "studied" ? "research-study-ready" : "research-study-missing";
}

function localMapStatusForResearchRecord(
  record: LocalResearchRecord,
  viewMode: LocalMapViewMode,
): LocalMapStatus {
  if (viewMode === "study") return researchStudyStatusForRecord(record);
  return researchDroughtStatusForRecord(record);
}

function localMapLegendStatusesForView(viewMode: LocalMapViewMode): LocalMapStatus[] {
  if (viewMode === "study") return ["research-study-ready", "research-study-missing"];
  return ["research-drought-severe", "research-drought-watch", "research-drought-normal"];
}

function districtResearchRiskStatus(record: NakhonRatchasimaResearchDistrictLatest): LocalMapStatus {
  if (record.droughtSevereSubdistricts > 0) return "research-drought-severe";
  if (record.droughtWatchSubdistricts > 0) return "research-drought-watch";
  return "research-drought-normal";
}

function localStatusPillTone(status: LocalMapStatus) {
  if (status === "research-drought-severe") return "severe";
  if (status === "research-drought-watch") return "watch";
  if (status === "research-drought-normal" || status === "research-study-ready") return "normal";
  return "muted";
}

function localLabelPriorityForStatus(status: LocalMapStatus) {
  if (status === "research-drought-severe" || status === "local-evidence") return 42;
  if (status === "research-drought-watch") return 32;
  if (status === "source-capability" || status === "district-evidence") return 24;
  if (status === "research-drought-normal" || status === "research-study-ready") return 18;
  return 8;
}

function predictionUseForStatus(status: LocalMapStatus) {
  const labels: Record<LocalMapStatus, string> = {
    admin: "ใช้เป็นขอบเขตเชื่อมข้อมูล",
    "local-evidence": "ใช้เป็นข้อมูลนำเข้าเฉพาะพื้นที่ได้",
    "source-capability": "ใช้เป็นช่องทางดึงตัวแปรเพิ่ม",
    "district-evidence": "ใช้เป็นบริบทระดับอำเภอ",
    "research-drought-normal": "ใช้เป็นสถานะภัยแล้งหลังจัดมาตรฐานข้อมูลแล้ว",
    "research-drought-watch": "ใช้เป็นสถานะเฝ้าระวังภัยแล้งหลังจัดมาตรฐานข้อมูลแล้ว",
    "research-drought-severe": "ใช้เป็นสถานะเสี่ยงสูงที่สรุปจากข้อมูลตำบล",
    "research-study-ready": "มีข้อมูลในระบบจากชุดข้อมูลที่จัดมาตรฐานแล้ว",
    "research-study-missing": "ยังไม่มีข้อมูลในระบบจากชุดข้อมูลที่จัดมาตรฐานแล้ว",
    insufficient: "ต้องเติมหลักฐานก่อนคำนวณ",
    "no-data": "ยังไม่พอสำหรับคาดการณ์เฉพาะพื้นที่",
  };
  return labels[status];
}

function legendStatusesForContext(layerId: string, activeTab?: ProvinceDashboardTab | null): LocalMapStatus[] {
  if (activeTab === "drought") return ["research-drought-severe", "research-drought-watch", "research-drought-normal"];
  return ["local-evidence", "source-capability", "district-evidence", "insufficient", "no-data"];
}

function localPreviewTitleForTarget(target: NakhonRatchasimaRouteTarget, preview: LocalMapPreview) {
  return target.valid && target.level === "province" ? preview.districtTh : preview.subdistrictTh;
}

function localPreviewActionForTarget(target: NakhonRatchasimaRouteTarget, preview: LocalMapPreview) {
  if (!target.valid) return null;
  if (target.level === "province") return { label: "เปิดอำเภอนี้", path: preview.districtPath };
  if (target.level === "subdistrict" && preview.subdistrictCode === target.subdistrict.subdistrictCode) return null;
  return { label: "เปิดตำบลนี้", path: preview.path };
}

function geometryBounds(features: NakhonRatchasimaGeoFeature[]) {
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

function createProjection(features: NakhonRatchasimaGeoFeature[]): Projection {
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

function pathForGeometry(geometry: NakhonRatchasimaGeoFeature["geometry"], projection: Projection) {
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

function pathForFeature(feature: NakhonRatchasimaGeoFeature, projection: Projection) {
  return pathForGeometry(feature.geometry, projection);
}

function projectedBoundsForFeatures(features: NakhonRatchasimaGeoFeature[], projection: Projection) {
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

function transformForLocalFocus(
  features: NakhonRatchasimaGeoFeature[],
  projection: Projection,
  focusZoom: number,
  minimumZoom: number,
) {
  if (features.length === 0) return localFitTransform;
  const bounds = projectedBoundsForFeatures(features, projection);
  const featureWidth = Math.max(1, bounds.maxX - bounds.minX);
  const featureHeight = Math.max(1, bounds.maxY - bounds.minY);
  const fitZoom = Math.min((localMapWidth - 190) / featureWidth, (localMapHeight - 155) / featureHeight);
  const k = clamp(Number(Math.min(focusZoom, Math.max(minimumZoom, fitZoom)).toFixed(3)), minimumZoom, focusZoom);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return clampLocalTransform({
    x: localMapWidth / 2 - centerX * k,
    y: localMapHeight / 2 - centerY * k,
    k,
  });
}

function districtCodeForFeature(feature: NakhonRatchasimaGeoFeature) {
  return `${feature.properties.P_code}${feature.properties.A_code}`;
}

function evidenceStatusForSubdistrict(row: NakhonRatchasimaMatrixRow | undefined, layerId: string): LocalMapStatus {
  if (!row) return "no-data";
  const subset = getNakhonRatchasimaLocalSubsetForSubdistrict(row.subdistrict_code);
  const districtEvidence = getNakhonRatchasimaDistrictEvidence(row.district_code);

  if (layerId === NAKHON_RATCHASIMA_LAYER_IDS.adminSubdistrict) return "admin";
  if (layerId === NAKHON_RATCHASIMA_LAYER_IDS.derivedAgriculturalRisk) {
    return subset?.coverageClass === "REAL_LOCAL_EVIDENCE" ? "insufficient" : "no-data";
  }
  if (layerId === NAKHON_RATCHASIMA_LAYER_IDS.pestEvents) return districtEvidence.length > 0 ? "district-evidence" : "no-data";
  if (layerId === NAKHON_RATCHASIMA_LAYER_IDS.dwrEws) {
    if (row.dwr_station_refs && !row.dwr_station_refs.includes("COVERAGE")) return "local-evidence";
    return row.hydrology_availability === "DWR_EWS_STATION_OR_COVERAGE_VERIFIED" ? "source-capability" : "no-data";
  }
  if (subset?.coverageClass === "REAL_LOCAL_EVIDENCE") return "local-evidence";
  if (subset?.coverageClass === "REAL_SOURCE_CAPABILITY") return "source-capability";
  if (districtEvidence.length > 0) return "district-evidence";
  return "no-data";
}

function predictionStatusForSubdistrict(row: NakhonRatchasimaMatrixRow | undefined, layerId: string): LocalMapStatus {
  if (!row) return "no-data";
  if (layerId === NAKHON_RATCHASIMA_LAYER_IDS.adminSubdistrict) return "admin";

  const subset = getNakhonRatchasimaLocalSubsetForSubdistrict(row.subdistrict_code);
  const districtEvidence = getNakhonRatchasimaDistrictEvidence(row.district_code);
  const hasDwrPathway = row.hydrology_availability === "DWR_EWS_STATION_OR_COVERAGE_VERIFIED";

  if (subset?.coverageClass === "REAL_LOCAL_EVIDENCE") return "local-evidence";
  if (hasDwrPathway || subset?.coverageClass === "REAL_SOURCE_CAPABILITY") return "source-capability";
  if (districtEvidence.length > 0) return "district-evidence";
  if (layerId === NAKHON_RATCHASIMA_LAYER_IDS.derivedAgriculturalRisk) return "insufficient";
  return "no-data";
}

function sourceReadinessStatusForSubdistrict(row: NakhonRatchasimaMatrixRow | undefined, layerId: string): LocalMapStatus {
  if (!row) return "no-data";
  if (layerId === NAKHON_RATCHASIMA_LAYER_IDS.adminSubdistrict) return "admin";

  const subset = getNakhonRatchasimaLocalSubsetForSubdistrict(row.subdistrict_code);
  const districtEvidence = getNakhonRatchasimaDistrictEvidence(row.district_code);
  const hasDirectStation = Boolean(row.dwr_station_refs && !row.dwr_station_refs.includes("COVERAGE"));
  const hasDwrPathway = row.hydrology_availability === "DWR_EWS_STATION_OR_COVERAGE_VERIFIED";

  if (hasDirectStation || subset?.coverageClass === "REAL_LOCAL_EVIDENCE") return "local-evidence";
  if (hasDwrPathway || subset?.coverageClass === "REAL_SOURCE_CAPABILITY") return "source-capability";
  if (districtEvidence.length > 0) return "district-evidence";
  return "no-data";
}

function statusForSubdistrict(
  row: NakhonRatchasimaMatrixRow | undefined,
  layerId: string,
  mapMode: LocalMapMode,
): LocalMapStatus {
  if (mapMode === "prediction-readiness") return predictionStatusForSubdistrict(row, layerId);
  if (mapMode === "source-readiness") return sourceReadinessStatusForSubdistrict(row, layerId);
  return evidenceStatusForSubdistrict(row, layerId);
}

function subdistrictOptionForRow(
  row: NakhonRatchasimaMatrixRow,
  layer: NakhonRatchasimaMapLayer,
  mapMode: LocalMapMode,
  includeDistrictContext: boolean,
): AppSelectOption {
  const status = statusForSubdistrict(row, layer.id, mapMode);
  const statusLabel = coverageLabel(status, mapMode);
  return {
    value: row.subdistrict_code,
    label: row.subdistrict_th,
    group: includeDistrictContext ? row.district_th : undefined,
    description: includeDistrictContext ? `${row.district_th} · ${statusLabel}` : `${row.subdistrict_code} · ${statusLabel}`,
  };
}

function districtOptionForProvince(district: NakhonRatchasimaDistrict): AppSelectOption {
  const summary = summarizeNakhonRatchasimaDistrict(district);
  const hasLocalEvidence = summary.localEvidenceCount > 0;
  const hasStationPathway = summary.stationCoverageCount > 0;
  const readinessLabel = hasLocalEvidence
    ? `มีหลักฐาน/บริบท ${formatThaiNumber(summary.localEvidenceCount)} รายการ`
    : hasStationPathway
      ? `มีข้อมูลนำเข้าตั้งต้น ${formatThaiNumber(summary.stationCoverageCount)} ตำบล`
      : "ยังไม่มีหลักฐานเชิงลึก";

  return {
    value: district.districtCode,
    label: district.nameTh ?? district.name,
    description: `${formatThaiNumber(summary.subdistrictCount)} ตำบล · ${readinessLabel}`,
    badge: hasLocalEvidence ? "มีข้อมูล" : hasStationPathway ? "มีข้อมูลตั้งต้น" : "รอข้อมูล",
    badgeTone: hasLocalEvidence ? "good" : hasStationPathway ? "watch" : "muted",
  };
}

function districtOptionsForProvince(): AppSelectOption[] {
  return getNakhonRatchasimaDistricts().map(districtOptionForProvince);
}

function subdistrictOptionsForRoute(
  route: NakhonRatchasimaRouteTarget,
  layer: NakhonRatchasimaMapLayer,
  mapMode: LocalMapMode,
): AppSelectOption[] {
  if (!route.valid || route.level === "subdistrict") return [];
  if (route.level === "district") {
    return getNakhonRatchasimaMatrixRowsForDistrict(route.district.districtCode).map((row) =>
      subdistrictOptionForRow(row, layer, mapMode, false),
    );
  }
  return getNakhonRatchasimaDistricts().flatMap((district) =>
    getNakhonRatchasimaMatrixRowsForDistrict(district.districtCode).map((row) =>
      subdistrictOptionForRow(row, layer, mapMode, true),
    ),
  );
}

function pathForDistrictCode(districtCode: string) {
  const district = getNakhonRatchasimaDistrictByCode(districtCode);
  if (!district) return undefined;
  return getNakhonRatchasimaPath(district);
}

function pathForSubdistrictCode(subdistrictCode: string) {
  const row = getNakhonRatchasimaMatrixRowBySubdistrictCode(subdistrictCode);
  const district = getNakhonRatchasimaDistrictByCode(row?.district_code);
  const subdistrict = district?.subdistricts.find((item) => item.subdistrictCode === subdistrictCode);
  if (!district || !subdistrict) return undefined;
  return getNakhonRatchasimaPath(district, subdistrict);
}

function translateAccess(value: string) {
  const labels: Record<string, string> = {
    DOCUMENTED_STANDARD_NOT_CONFIRMED_PUBLIC_ENDPOINT: "มีมาตรฐานอ้างอิง แต่จุดเชื่อมต่อสาธารณะยังต้องตรวจ",
    PUBLIC_DOWNLOAD: "ดาวน์โหลดสาธารณะ",
    PUBLIC_LIVE_API: "บริการข้อมูลสาธารณะ",
    PUBLIC_WEB_REPORT: "รายงานเว็บสาธารณะ",
    PUBLIC_WEB_REPORT_AND_DOCUMENTED_STANDARD_NEEDS_INGEST_AUDIT:
      "รายงานเว็บสาธารณะและมาตรฐานข้อมูล ต้องตรวจการเชื่อมข้อมูลเพิ่ม",
    PUBLIC_WEB_REPORT_INDEX: "ดัชนีรายงานเว็บสาธารณะ",
    TOKEN_REQUIRED: "ต้องใช้สิทธิ์เข้าถึง",
    UI_ONLY: "มีเฉพาะหน้าจอใช้งาน",
    UNKNOWN: "ยังต้องตรวจสอบ",
    "internal calculation": "คำนวณภายในระบบ",
    "local bundle index referencing REAL sources": "ดัชนีข้อมูลในชุดข้อมูลที่อ้างอิงแหล่งข้อมูลจริง",
    runtime: "สถานะภายในระบบ",
  };
  return labels[value] ?? value;
}

function translateLayerNoData(value: string) {
  const labels: Record<string, string> = {
    "boundary unavailable": "ไม่สามารถโหลดขอบเขตพื้นที่ได้",
    "ข้อมูลยังไม่เชื่อมต่อ": "ข้อมูลยังไม่เชื่อมต่อ",
    "ชั้นข้อมูลยังไม่เชื่อมต่อ; ห้ามตีความเป็นความเสี่ยง": "ชั้นข้อมูลยังไม่เชื่อมต่อ ห้ามตีความเป็นความเสี่ยง",
    "ไม่มีข้อมูลชั้นนี้หรือยังไม่ดึงข้อมูล": "ไม่มีข้อมูลชั้นนี้หรือยังไม่ดึงข้อมูล",
    "ไม่มีข้อมูลระดับตำบลที่ยืนยัน": "ไม่มีข้อมูลระดับตำบลที่ยืนยัน",
    "ไม่มีข้อมูลระดับพื้นที่นี้จากผลิตภัณฑ์ที่เลือก": "ไม่มีข้อมูลระดับพื้นที่นี้จากผลิตภัณฑ์ที่เลือก",
    "ไม่มีรายงานระดับพื้นที่ที่ยืนยัน ไม่ได้แปลว่าไม่มีความเสี่ยง": "ไม่มีรายงานระดับพื้นที่ที่ยืนยัน ไม่ได้แปลว่าไม่มีความเสี่ยง",
    "ไม่มีสถานีที่ยืนยันในพื้นที่นี้": "ไม่มีสถานีที่ยืนยันในพื้นที่นี้",
    "ไม่มีสถานีตรงพื้นที่หรือยังไม่ยืนยันค่าฝนสด; สถานีใกล้สุดไม่ใช่ค่าตรวจวัดในตำบล":
      "ไม่มีสถานีตรงพื้นที่หรือยังไม่ยืนยันค่าฝนสด สถานีใกล้สุดไม่ใช่ค่าตรวจวัดในตำบล",
    "ยังไม่มีการตรวจสอบภาคสนาม": "ยังไม่มีการตรวจสอบภาคสนาม",
    "ยังไม่มีค่าปัจจุบัน/พิกัดที่ยืนยัน": "ยังไม่มีค่าปัจจุบันหรือพิกัดที่ยืนยัน",
    "ข้อมูลไม่เพียงพอ — ห้ามแสดงสีเขียว": "ข้อมูลไม่เพียงพอ ห้ามแสดงสีเขียว",
    "พื้นที่นี้ยังไม่มีหลักฐานเชิงลึกที่ seed ไว้ — ไม่ได้แปลว่าไม่มีความเสี่ยง":
      "พื้นที่นี้ยังไม่มีหลักฐานเชิงลึกที่เตรียมไว้ ไม่ได้แปลว่าไม่มีความเสี่ยง",
    "n/a": "ไม่เกี่ยวข้อง",
  };
  return labels[value] ?? value;
}

function translateStatus(value: string) {
  const labels: Record<string, string> = {
    CAPABILITY_VERIFIED_VALUES_NOT_INGESTED: "ยืนยันความสามารถของแหล่งข้อมูลแล้ว แต่ยังไม่ดึงค่าจริงเข้าระบบ",
    EXISTING_WORKFLOW: "ใช้กระบวนงานเดิมของต้นแบบ",
    IMPLEMENT_AFTER_EVIDENCE_INGESTION: "รอหลักฐานเพียงพอก่อนคำนวณ",
    PARTIAL_NAKHON_RATCHASIMA_STATIONS_VERIFIED: "ยืนยันสถานีบางพื้นที่ของนครราชสีมาแล้ว",
    PRESERVE_AS_FALLBACK_NOT_OFFICIAL: "เก็บเป็นค่าทดแทนของต้นแบบ ไม่ใช่ข้อมูลทางการ",
    READY_TO_INTEGRATE: "พร้อมใช้เป็นชั้นอ้างอิง",
    REFERENCE_ASSETS_VERIFIED_CURRENT_TELEMETRY_NOT_BULK_INGESTED:
      "ยืนยันรายการอ้างอิงแล้ว แต่ยังไม่ดึงค่าปัจจุบันจำนวนมาก",
    REGIONAL_CONTEXT_READY: "ใช้เป็นบริบทระดับภูมิภาคได้",
    REPORT_BASED_PARTIAL_LOCAL_EVIDENCE: "มีหลักฐานบางส่วนจากรายงาน",
    SEEDED_DEEP_DEMO_SUBSET: "มีข้อมูลเชิงลึกเฉพาะพื้นที่ที่เตรียมไว้",
    SOURCE_READY_KEEP_OBSERVED_FORECAST_RECURRENCE_SEPARATE:
      "แหล่งข้อมูลพร้อม แต่ต้องแยกข้อมูลที่สังเกตแล้ว คาดการณ์ และประวัติซ้ำ",
    STATS_SOURCE_READY_SPATIAL_NOT_BULK_INGESTED: "แหล่งสถิติพร้อม แต่ยังไม่เชื่อมเชิงพื้นที่ครบ",
    STATION_COVERAGE_READY_LIVE_RAINFALL_PENDING:
      "พร้อมแสดงสถานีและข้อมูลตัวแทนแล้ว แต่ยังรอเชื่อมค่าฝนสดที่ยืนยัน",
    UI_SOURCE_VERIFIED: "ยืนยันแหล่งข้อมูลจากหน้าจอใช้งาน",
  };
  return labels[value] ?? value;
}

function translateClassification(value: string) {
  if (value.startsWith("REAL")) return "ข้อมูลจริง";
  if (value === "DERIVED") return "ค่าที่ระบบคำนวณ";
  if (value === "CANONICAL_SYNTHETIC") return "ข้อมูลต้นแบบ";
  if (value === "RUNTIME_STATE") return "สถานะจากการใช้งาน";
  return value;
}

function formatThaiDate(value?: string | null) {
  if (!value) return "ไม่ระบุ";
  if (/^\d{4}-\d{2}$/.test(value)) return formatMonth(value, "th");
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const date = new Date(`${value.slice(0, 10)}T00:00:00+07:00`);
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatThaiDateTime(value?: string | null) {
  if (!value) return "ไม่ระบุ";
  const normalized = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(value)
    ? `${value.replace(/\s+/, "T")}+07:00`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return formatThaiDate(value);
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatThaiPeriod(value?: string | null) {
  if (!value) return "ไม่ระบุ";
  if (/^\d{4}-\d{2}$/.test(value)) return formatMonth(value, "th");
  const parts = value.split(/\s+to\s+/);
  if (parts.length === 2) return `${formatThaiDate(parts[0])} - ${formatThaiDate(parts[1])}`;
  return formatThaiDate(value);
}

function translateScope(value: string) {
  const labels: Record<string, string> = {
    "district master": "บัญชีอำเภอ",
    "large reservoir assets": "รายการอ่างเก็บน้ำขนาดใหญ่",
    "Northeast regional context": "บริบทระดับภาคอีสาน",
    "Northeast regional context; Nakhon Ratchasima province is in Northeast":
      "บริบทระดับภาคอีสาน ซึ่งครอบคลุมนครราชสีมา",
    "province": "ระดับจังหวัด",
    "province watch": "เฝ้าระวังระดับจังหวัด",
    "province/basin": "ระดับจังหวัด/ลุ่มน้ำ",
    "30 matched DWR EWS station/covered-village subdistricts in Nakhon Ratchasima":
      "30 ตำบลที่จับคู่กับสถานีหรือหมู่บ้านครอบคลุมของ DWR",
    "Nakhon Ratchasima provincial report index": "ดัชนีรายงานระดับจังหวัดนครราชสีมา",
    "province/district/subdistrict report filters": "ตัวกรองรายงานระดับจังหวัด อำเภอ และตำบล",
    "Soeng Sang district banana production area": "พื้นที่ปลูกกล้วยในอำเภอเสิงสาง",
    "station/subdistrict": "ระดับสถานี/ตำบล",
    "subdistrict geometry": "ขอบเขตตำบล",
    "subdistrict master": "บัญชีตำบล",
    "Thailand national context; meteorological context for Nakhon Ratchasima province, not a local measurement":
      "บริบทอากาศระดับประเทศ ใช้ประกอบนครราชสีมา แต่ไม่ใช่ค่าตรวจวัดรายพื้นที่",
    "Thailand national/regional context": "บริบทระดับประเทศ/ภูมิภาค",
    "Upper Thailand/regional context": "บริบทภาคเหนือตอนบน/ภูมิภาค",
  };
  return labels[value] ?? value;
}

function evidenceTitle(record: NakhonRatchasimaEvidenceRecord) {
  const labels: Record<string, string> = {
    ADMIN_BOUNDARY: "หลักฐานขอบเขตการปกครอง",
    ADMIN_CODES: "หลักฐานรหัสพื้นที่ปกครอง",
    ADMIN_COUNT: "จำนวนพื้นที่ปกครอง",
    CROP_REGISTRATION_REPORT_CAPABILITY: "ความพร้อมรายงานทะเบียนเกษตรกร",
    DWR_EWS_WARNING: "บันทึกเตือนภัยจากสถานี DWR",
    FORECAST_HORIZON_SUPPORT: "หลักฐานช่วงคาดการณ์",
    GEOMETRY_CAPABILITY: "ความพร้อมขอบเขตแผนที่",
    HYDROLOGY_STATION_COVERAGE: "ความครอบคลุมสถานีเตือนภัยน้ำ",
    OFFICIAL_WARNING: "ประกาศเฝ้าระวังจากหน่วยงาน",
    PEST_DISEASE_SURVEILLANCE: "เฝ้าระวังศัตรูพืช/โรคพืช",
    PROVINCIAL_AG_DISASTER_REPORT_INDEX: "ดัชนีรายงานภัยพิบัติเกษตรจังหวัด",
    RESERVOIR_REFERENCE: "รายการอ้างอิงอ่างเก็บน้ำ",
    WATER_STATUS: "บริบทสถานการณ์น้ำ",
    WEATHER_FORECAST_CONTEXT: "บริบทพยากรณ์อากาศ",
    WEATHER_OBSERVED_CONTEXT: "บริบทอากาศย้อนหลัง",
  };
  return labels[record.evidence_type] ?? "หลักฐานจากแหล่งข้อมูล";
}

function translateFactKey(key: string) {
  const labels: Record<string, string> = {
    capacity_mcm: "ความจุ",
    combined_storage_approx_pct_capacity: "น้ำรวมโดยประมาณ",
    confirmed_diagnosis: "ยืนยันการวินิจฉัยแล้ว",
    canonical_month_count: "จำนวนเดือนในช่วงข้อมูล",
    canonical_period_end: "สิ้นสุดช่วงข้อมูล",
    canonical_period_start: "เริ่มช่วงข้อมูล",
    current_and_forecast_months: "เดือนปัจจุบัน/คาดการณ์",
    crop: "พืช",
    district_code_range: "ช่วงรหัสอำเภอ",
    district_count: "จำนวนอำเภอ",
    district_th: "อำเภอ",
    direct_station_subdistrict_count: "ตำบลที่มีสถานีโดยตรง",
    first_code: "รหัสแรก",
    geometry_type: "ชนิดขอบเขตแผนที่",
    hazards: "ภัยที่กล่าวถึง",
    indexed_monthly_report_count: "เดือนที่มีรายงานรายเดือน",
    join_fields: "ฟิลด์ที่ใช้เชื่อมข้อมูล",
    last_code: "รหัสสุดท้าย",
    linked_attachment_month_count: "เดือนที่มีไฟล์แนบ",
    matched_district_count: "อำเภอที่จับคู่ได้",
    matched_subdistrict_count: "ตำบลที่จับคู่ได้",
    matrix_file: "ไฟล์ตารางเชื่อมข้อมูล",
    metadata_fields: "ฟิลด์ข้อมูลกำกับ",
    nakhon_ratchasima_included: "มีนครราชสีมาในพื้นที่เฝ้าระวัง",
    narrative: "คำอธิบาย",
    national_mean_rainfall_anomaly_pct: "ฝนเฉลี่ยประเทศต่างจากปกติ",
    national_mean_temperature_anomaly_c: "อุณหภูมิเฉลี่ยประเทศต่างจากปกติ",
    northeast_forecast_rainfall_mm_max: "ฝนคาดการณ์สูงสุดภาคอีสาน",
    northeast_forecast_rainfall_mm_min: "ฝนคาดการณ์ต่ำสุดภาคอีสาน",
    october_supported_selectable_horizon: "รองรับการเลือกช่วงคาดการณ์เดือนตุลาคม",
    planning_context: "บริบทวางแผนน้ำ",
    query_formats: "รูปแบบข้อมูลที่เรียกได้",
    rainy_days_max: "จำนวนวันฝนตกสูงสุด",
    rainy_days_min: "จำนวนวันฝนตกต่ำสุด",
    record_count: "จำนวนรายการ",
    reported_value: "ค่าที่รายงาน",
    related_warning_only_months: "เดือนที่มีประกาศเกี่ยวข้องเท่านั้น",
    report_note_daily_cutoff: "รายงานรองรับรอบตัดข้อมูลรายวัน",
    report_note_subdistrict_level_can_show_name_list: "ระดับตำบลแสดงรายชื่อได้",
    reservoir_count_reported: "จำนวนอ่างที่รายงาน",
    reservoirs: "อ่างเก็บน้ำอ้างอิง",
    sample_analysis: "สถานะผลตัวอย่าง",
    source_crs: "ระบบพิกัดต้นทาง",
    station_id: "รหัสสถานี",
    station_name: "ชื่อสถานี",
    station_options: "ตัวเลือกสถานี",
    station_or_covered_village_rows: "แถวสถานี/หมู่บ้านครอบคลุม",
    status: "สถานะ",
    subdistrict_count: "จำนวนตำบล",
    subdistrict_th: "ตำบล",
    supports_crop_group_and_type_filters: "รองรับตัวกรองกลุ่ม/ชนิดพืช",
    supports_district_filter: "รองรับตัวกรองอำเภอ",
    supports_production_year_filter: "รองรับตัวกรองปีการผลิต",
    supports_province_filter: "รองรับตัวกรองจังหวัด",
    supports_subdistrict_filter: "รองรับตัวกรองตำบล",
    trigger: "ตัวกระตุ้น",
    visible_monthly_reports: "รายงานรายเดือนที่พบ",
    village_count: "จำนวนหมู่บ้าน",
  };
  return labels[key] ?? key;
}

function translateFactValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่ใช่";
  if (typeof value === "number") return new Intl.NumberFormat("th-TH").format(value);
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) return value.map((item) => translateFactValue(item)).join(", ");
    return value
      .map((item) => {
        if (typeof item === "object" && item && "name_th" in item && "capacity_mcm" in item) {
          const reservoir = item as { name_th: string; capacity_mcm: number };
          return `${reservoir.name_th} ${formatRai(reservoir.capacity_mcm)} ล้าน ลบ.ม.`;
        }
        return String(item);
      })
      .join(" · ");
  }
  if (typeof value !== "string") return String(value);
  if (/^\d{4}-\d{2}$/.test(value)) return formatMonth(value, "th");

  const labels: Record<string, string> = {
    banana: "กล้วย",
    "Drought / Agricultural Water Stress": "ภัยแล้ง / ความเครียดน้ำเกษตร",
    "Drought / Flood water-management context": "บริบทจัดการน้ำสำหรับภัยแล้งและน้ำท่วม",
    esriGeometryPolygon: "ขอบเขตพื้นที่แบบโพลีกอนจากบริการแผนที่",
    "flash flood": "น้ำป่าไหลหลาก",
    "forest runoff": "น้ำไหลหลากจากพื้นที่ป่า",
    "Heavy rain occurred in parts of the Northeast at times; rainfall also decreased during part of mid-month.":
      "บางช่วงมีฝนหนักในบางพื้นที่ของภาคอีสาน และมีช่วงที่ฝนลดลงกลางเดือน",
    "Heavy to very heavy rain possible in some locations.": "บางพื้นที่อาจมีฝนหนักถึงหนักมาก",
    "June–July dry-spell/water-allocation concern": "ข้อกังวลช่วงฝนทิ้งช่วงและการจัดสรรน้ำ มิ.ย.-ก.ค.",
    Rainfall: "ปริมาณฝน",
    "Rainy conditions continue; heavy/very heavy rain possible in some locations.":
      "ยังมีฝนต่อเนื่อง และบางพื้นที่อาจมีฝนหนักถึงหนักมาก",
    "reported as under detailed analysis": "อยู่ระหว่างการวิเคราะห์ละเอียด",
    "surveillance/investigation": "เฝ้าระวัง/อยู่ระหว่างตรวจสอบ",
    "Upper Thailand transitions out of rainy season around mid-October.":
      "ประเทศไทยตอนบนจะเริ่มออกจากฤดูฝนราวกลางเดือนตุลาคม",
    WATCH: "เฝ้าระวัง",
    "Water level warning": "เตือนระดับน้ำ",
    waterlogging: "น้ำท่วมขัง",
  };
  return labels[value] ?? value;
}

function translateRecommendedUse(value: string) {
  const labels: Record<string, string> = {
    "Current Aug-2026 district-level crop-health surveillance; do not invent tambon or diagnosis":
      "ใช้เป็นตัวอย่างการเฝ้าระวังสุขภาพพืชระดับอำเภอใน ส.ค. 2569 โดยไม่สร้างตำบลหรือผลวินิจฉัยเพิ่มเอง",
    "Historical flash-flood/heavy-rain evidence + hydrology drill-down":
      "ใช้เป็นตัวอย่างหลักฐานน้ำหลาก/ฝนหนักย้อนหลัง และการเจาะดูข้อมูลน้ำระดับพื้นที่",
    "Station/source-availability example; do not invent an event":
      "ใช้เป็นตัวอย่างพื้นที่ที่มีสถานีหรือแหล่งข้อมูลรองรับ แต่ยังไม่สร้างเหตุการณ์เอง",
  };
  return labels[value] ?? value;
}

function translateSpatialGranularity(value: string) {
  const labels: Record<string, string> = {
    "Asset / command-area / province depending dataset": "ระดับทรัพยากรน้ำ พื้นที่ชลประทาน หรือจังหวัดตามชุดข้อมูล",
    "Asset point / reservoir system": "ระดับอ่างเก็บน้ำหรือระบบอ่าง",
    "District/subdistrict station locations where published": "ตำแหน่งสถานีระดับอำเภอ/ตำบลตามที่เผยแพร่",
    "Event report geography": "พื้นที่ตามรายงานเหตุการณ์",
    "Field parcel / soil suitability unit / admin": "ระดับแปลง หน่วยความเหมาะสมดิน หรือพื้นที่ปกครอง",
    "National / Basin / Province / Station depending product": "ระดับประเทศ ลุ่มน้ำ จังหวัด หรือสถานีตามผลิตภัณฑ์",
    "National / Province / District": "ระดับประเทศ จังหวัด หรืออำเภอ",
    "National / Regional / Station depending product": "ระดับประเทศ ภูมิภาค หรือสถานีตามผลิตภัณฑ์",
    "National; province; district; subdistrict; irrigation/basin; parcel capability":
      "รองรับระดับประเทศ จังหวัด อำเภอ ตำบล เขตชลประทาน/ลุ่มน้ำ และแปลงตามผลิตภัณฑ์",
    "Polygon/grid depending product": "โพลีกอนหรือกริดตามผลิตภัณฑ์",
    "Province summary + district list": "สรุประดับจังหวัดและรายชื่ออำเภอ",
    "Province report index; district/subdistrict only when a report body names local areas":
      "ดัชนีรายงานระดับจังหวัด อำเภอ/ตำบลใช้ได้เมื่อเนื้อหารายงานระบุพื้นที่",
    "Province/district/subdistrict report path": "รายงานที่เลือกได้ระดับจังหวัด อำเภอ และตำบล",
    "Report/admin/event-based": "ตามรายงาน พื้นที่ปกครอง หรือเหตุการณ์",
    "Station / tambon / district": "ระดับสถานี ตำบล หรืออำเภอ",
    "Subdistrict (sibling province/district/village layers)": "ระดับตำบล โดยมีชั้นข้อมูลระดับจังหวัด อำเภอ และหมู่บ้านประกอบ",
    "Tambon/local geography where station resolves": "ระดับตำบลหรือพื้นที่ท้องถิ่นเมื่อผูกกับสถานีได้",
    "Thailand / Province / District / Subdistrict according to UI": "ประเทศไทย จังหวัด อำเภอ หรือตำบลตามหน้าจอใช้งาน",
  };
  return labels[value] ?? value;
}

function translateSourceLimitation(value: string) {
  const labels: Record<string, string> = {
    "Actual Nakhon Ratchasima values not fabricated; API public/auth state must be tested during integration.":
      "ยังไม่สร้างค่าจริงของนครราชสีมาเอง ต้องทดสอบสิทธิ์บริการข้อมูลตอนเชื่อมต่อจริง",
    "Corroboration/count source, not canonical code API.": "ใช้ยืนยันจำนวน/บริบท ไม่ใช่บริการรหัสพื้นที่หลัก",
    "Coverage does not mean current hazard. Month-specific warning/readings evidence is required before showing observed risk or affected rai.":
      "ความครอบคลุมข้อมูลไม่ได้แปลว่ามีภัยปัจจุบัน ต้องมีคำเตือนหรือค่าตรวจวัดรายเดือนก่อนแสดงภัยที่สังเกตแล้วหรือพื้นที่เสียหาย",
    "CRS EPSG:32647; transform for web map. Validate feature values during ingestion.":
      "พิกัดต้นทาง EPSG:32647 ต้องแปลงสำหรับเว็บ และตรวจค่าฟีเจอร์ตอนนำเข้า",
    "Current telemetry endpoint/coverage needs audit for province-specific ingest.":
      "จุดเชื่อมต่อและขอบเขตค่าปัจจุบันต้องตรวจเพิ่มก่อนนำเข้าระดับจังหวัด",
    "Do not copy 35% into every tambon.": "ห้ามคัดลอกค่า 35% ไปใช้กับทุกตำบล",
    "Do not invent disease diagnosis, tambon, severity, rai, or farmer count.":
      "ห้ามสร้างผลวินิจฉัยโรค ตำบล ระดับความรุนแรง พื้นที่ไร่ หรือจำนวนเกษตรกรเอง",
    "Detailed event report; do not generalize to all Soeng Sang tambons.":
      "เป็นรายงานเหตุการณ์เฉพาะ ห้ามเหมารวมทุกตำบลในเสิงสาง",
    "GISTDA Crops Drought provides better spatial crop-water product if authenticated values are available.":
      "ถ้าเข้าถึงค่า GISTDA เช็คแล้งได้ จะเหมาะกว่าสำหรับพื้นที่พืช/น้ำเชิงพื้นที่",
    "Report index evidence only in this patch; do not infer affected tambons until individual reports are parsed.":
      "รอบนี้เป็นหลักฐานระดับดัชนีรายงานเท่านั้น ห้ามอนุมานตำบลที่ได้รับผลกระทบก่อน parse รายงานรายฉบับ",
    "Observed extent, forecast, recurrence are distinct products.": "ข้อมูลที่สังเกตแล้ว คาดการณ์ และประวัติซ้ำเป็นคนละผลิตภัณฑ์",
    "Province/basin context only; no uniform tambon allocation.": "เป็นบริบทจังหวัด/ลุ่มน้ำ ห้ามกระจายเป็นค่ารายตำบลแบบเท่ากัน",
    "Reference capacities only; not live storage.": "เป็นความจุอ้างอิง ไม่ใช่ปริมาณน้ำสด",
    "UI verified; bulk values not exported in this bundle.": "ยืนยันหน้าจอแล้ว แต่ชุดนี้ไม่ได้ส่งออกค่าจำนวนมาก",
    "Useful for crop presence/exposure research, but no crop area values were bulk-ingested in this patch.":
      "ใช้ต่อยอดวิจัยพื้นที่พืชและพื้นที่สัมผัสความเสี่ยงได้ แต่รอบนี้ยังไม่ได้นำเข้าค่าพื้นที่พืชจำนวนมาก",
    "Use only where station/event names and coordinates can be crosswalked.": "ใช้เฉพาะพื้นที่ที่ผูกชื่อสถานี/เหตุการณ์และพิกัดกับรหัสได้",
    "Warning/watch source, not observed impact extent.": "เป็นแหล่งเฝ้าระวัง/เตือน ไม่ใช่ขอบเขตผลกระทบที่สังเกตแล้ว",
    "Watch ≠ observed flood.": "ประกาศเฝ้าระวังไม่เท่ากับน้ำท่วมที่เกิดขึ้นแล้ว",
    "Weather forecast ≠ official agricultural consequence.":
      "พยากรณ์อากาศไม่เท่ากับผลกระทบด้านเกษตรอย่างเป็นทางการ",
  };
  return labels[value] ?? value;
}

function translateConfidenceLabel(value: string) {
  const labels: Record<string, string> = {
    HIGH: "สูง",
    LOW: "ต่ำ",
    "MEDIUM-HIGH": "ปานกลางถึงสูง",
    MEDIUM: "ปานกลาง",
  };
  return labels[value] ?? value;
}

function translateLimitation(value: string) {
  const labels: Record<string, string> = {
    "Agricultural consequence requires exposure/vulnerability derivation.":
      "ผลกระทบด้านเกษตรต้องคำนวณต่อจากข้อมูลพื้นที่เสี่ยงและความเปราะบาง",
    "Count/list corroboration only; codes come from DOPA/TIS-derived companion sources.":
      "ใช้ยืนยันจำนวนและรายการเท่านั้น รหัสอ้างอิงจากแหล่ง DOPA/TIS ที่เกี่ยวข้อง",
    "DOPA/BORA code-name evidence; source is an operational document.":
      "เป็นหลักฐานชื่อ-รหัสจาก DOPA/BORA ในเอกสารปฏิบัติงาน",
    "DOPA/TIS-derived terminology publication; not a verified live DOPA subdistrict registry endpoint.":
      "เป็นเอกสารคำศัพท์ที่อ้างอิง DOPA/TIS ไม่ใช่ทะเบียนตำบลสดของ DOPA ที่ยืนยันแล้ว",
    "Geometry payload is referenced, not embedded; validate actual key values at ingestion.":
      "ชุดข้อมูลอ้างอิงขอบเขตแผนที่ ต้องตรวจค่ารหัสจริงเมื่อเชื่อมข้อมูล",
    "Forecast/watch evidence, not observed flood impact.": "เป็นหลักฐานเชิงคาดการณ์/เฝ้าระวัง ไม่ใช่พื้นที่น้ำท่วมที่สังเกตแล้ว",
    "Historical DWR warning record. This bundle does not infer agricultural severity from the raw station value.":
      "เป็นบันทึกเตือนภัยย้อนหลังของสถานี DWR ชุดข้อมูลนี้ไม่อนุมานระดับความเสียหายเกษตรจากค่าดิบของสถานี",
    "National values cannot be assigned to a Nakhon Ratchasima district/subdistrict.":
      "ค่าระดับประเทศห้ามนำไปผูกเป็นค่าระดับอำเภอหรือตำบลของนครราชสีมา",
    "No exact Nakhon Ratchasima province/district probability from this evidence.":
      "หลักฐานนี้ยังไม่มีความน่าจะเป็นเฉพาะระดับจังหวัดหรืออำเภอของนครราชสีมา",
    "Not evidence that every Nakhon Ratchasima area flooded.":
      "ไม่ใช่หลักฐานว่าทุกพื้นที่ของนครราชสีมามีน้ำท่วม",
    "Province/basin context only; no uniform tambon severity.":
      "เป็นบริบทระดับจังหวัด/ลุ่มน้ำเท่านั้น ห้ามนำไปกระจายเป็นระดับความรุนแรงรายตำบลแบบเท่ากัน",
    "Reference capacities, not current storage.": "เป็นความจุอ้างอิง ไม่ใช่ปริมาณน้ำปัจจุบัน",
    "Regional forecast; no official Nakhon Ratchasima subdistrict probability.":
      "เป็นพยากรณ์ระดับภูมิภาค ไม่ใช่ความน่าจะเป็นรายตำบลของนครราชสีมา",
    "Do not invent disease name, severity, affected rai, farmer count, or tambon.":
      "ห้ามสร้างชื่อโรค ระดับความรุนแรง พื้นที่เสียหาย จำนวนเกษตรกร หรือตำบล หากแหล่งข้อมูลไม่ได้ระบุ",
    "Index confirms report availability and attachment paths only. It can support prediction validation/readiness after detail parsing, but cannot assign district/subdistrict impacts, crops, or rai by itself.":
      "ดัชนียืนยันว่ามีรายงานและตำแหน่งไฟล์แนบเท่านั้น ใช้ช่วยตรวจความพร้อมของการคาดการณ์ได้หลังอ่านรายละเอียด แต่ยังห้ามแจกผลกระทบ อำเภอ ตำบล พืช หรือไร่เอง",
    "No DOAE crop-area values were extracted in this patch; do not use this as affected crop area until queried and normalized.":
      "รอบนี้ยังไม่ได้ดึงค่าพื้นที่พืชจาก DOAE ห้ามใช้เป็นพื้นที่พืชได้รับผลกระทบจนกว่าจะเรียกข้อมูลและจัดมาตรฐานแล้ว",
    "Station/source coverage only; not a monthly warning, observed flood, crop impact, or affected-rai measurement.":
      "เป็น coverage ของสถานีหรือแหล่งข้อมูลเท่านั้น ไม่ใช่คำเตือนรายเดือน น้ำท่วมที่สังเกตแล้ว ผลกระทบพืช หรือพื้นที่เสียหายเป็นไร่",
  };
  return labels[value] ?? value;
}

function factRows(record: NakhonRatchasimaEvidenceRecord) {
  return Object.entries(record.facts).map(([key, value]) => ({
    label: translateFactKey(key),
    value: translateFactValue(value),
  }));
}

function sourceAgencyFor(record: NakhonRatchasimaEvidenceRecord) {
  const source = getNakhonRatchasimaSourceRows().find((row) => row.source_id === record.source_id);
  return source?.source_agency ?? record.source_id;
}

function EvidenceCard({ record, inherited = false }: { record: NakhonRatchasimaEvidenceRecord; inherited?: boolean }) {
  return (
    <article className={inherited ? "nr-evidence-card inherited provenance-corner-host" : "nr-evidence-card provenance-corner-host"}>
      <DataProvenanceChip kind={record.provenance} />
      <p className="eyebrow">รหัสหลักฐาน {record.source_id}</p>
      <h3>{evidenceTitle(record)}</h3>
      <p>{inherited ? `บริบทที่สืบทอดจาก${translateScope(record.geography.scope)}` : sourceAgencyFor(record)}</p>
      <dl className="nr-fact-grid">
        <div>
          <dt>ช่วงข้อมูล</dt>
          <dd>{record.observation_period ? formatThaiPeriod(record.observation_period) : `${formatThaiDate(record.forecast_valid_from)} - ${formatThaiDate(record.forecast_valid_to)}`}</dd>
        </div>
        <div>
          <dt>อัปเดต ณ</dt>
          <dd>{formatThaiDate(record.as_of_date)}</dd>
        </div>
        {factRows(record).slice(0, 6).map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="provenance-note">{translateLimitation(record.limitation)}</p>
    </article>
  );
}

function EmptyLocalEvidence() {
  return (
    <div className="nr-no-data">
      <AlertTriangle size={18} />
      <div>
        <strong>พื้นที่นี้ยังไม่มีหลักฐานเชิงลึกระดับท้องถิ่นในชุดข้อมูลนี้</strong>
        <p>ข้อมูลว่างไม่เท่ากับความเสี่ยงต่ำ และระบบจะไม่แสดงเป็นสีเขียวหรือ “ปกติ” โดยไม่มีหลักฐานรองรับ</p>
      </div>
    </div>
  );
}

function formatThaiNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits,
  }).format(value);
}

function formatPercent(value: number, maximumFractionDigits = 0) {
  return `${formatThaiNumber(value, maximumFractionDigits)}%`;
}

function researchDisplayPeriod(summary: NakhonRatchasimaResearchPanelSummary) {
  return `${formatMonth(summary.meta.periodStart, "th")} ถึง ${formatMonth(summary.meta.periodEnd, "th")}`;
}

function researchLatestPeriod(summary: NakhonRatchasimaResearchPanelSummary) {
  return formatMonth(summary.meta.periodEnd, "th");
}

function researchJoinPolicyNote() {
  return "เชื่อมพื้นที่ด้วยรหัสจังหวัด รหัสอำเภอ และรหัสตำบลเท่านั้น รหัสจากงานวิจัยเดิมใช้เพื่ออ้างอิงแถวต้นทาง ไม่ใช่รหัสราชการ";
}

function researchPeriodsEndingAt(period: string, count = 12) {
  const periods = getNakhonRatchasimaResearchPeriods();
  const endIndex = Math.max(0, periods.indexOf(period));
  return periods.slice(Math.max(0, endIndex - count + 1), endIndex + 1);
}

function researchRecordsForSubdistrictCodes(subdistrictCodes: string[], period: string) {
  return subdistrictCodes
    .map((subdistrictCode) => getNakhonRatchasimaResearchSubdistrictMonth(subdistrictCode, period))
    .filter((record): record is NakhonRatchasimaResearchMonthlySubdistrictRecord => Boolean(record));
}

function summarizeResearchAreaRecords(
  records: NakhonRatchasimaResearchMonthlySubdistrictRecord[],
  totalSubdistricts: number,
) {
  const rainfallValues = records.map((record) => record.rainfallMm).filter((value) => Number.isFinite(value));
  const topRainfallRecord = records.reduce<NakhonRatchasimaResearchMonthlySubdistrictRecord | undefined>(
    (top, record) => (!top || record.rainfallMm > top.rainfallMm ? record : top),
    undefined,
  );
  const irrigationCounts = records.reduce<Record<string, number>>((counts, record) => {
    counts[record.irrigationStatus] = (counts[record.irrigationStatus] ?? 0) + 1;
    return counts;
  }, {});

  return {
    totalSubdistricts,
    recordCount: records.length,
    missingCount: Math.max(0, totalSubdistricts - records.length),
    rainfallAvgMm: rainfallValues.length > 0 ? rainfallValues.reduce((sum, value) => sum + value, 0) / rainfallValues.length : null,
    rainfallMaxMm: rainfallValues.length > 0 ? Math.max(...rainfallValues) : null,
    rainfallMinMm: rainfallValues.length > 0 ? Math.min(...rainfallValues) : null,
    topRainfallRecord,
    droughtNormalSubdistricts: records.filter((record) => record.droughtRiskLevel === 0).length,
    droughtWatchSubdistricts: records.filter((record) => record.droughtRiskLevel === 1).length,
    droughtSevereSubdistricts: records.filter((record) => record.droughtRiskLevel >= 2).length,
    droughtConflictKeys: records.filter((record) => record.droughtRiskConflict).length,
    irrigationCounts,
  };
}

type ResearchAreaStats = ReturnType<typeof summarizeResearchAreaRecords>;

function researchMonthlySeriesForDistrict(district: NakhonRatchasimaDistrict, period: string, count = 12) {
  const subdistrictCodes = district.subdistricts.map((subdistrict) => subdistrict.subdistrictCode);
  return researchPeriodsEndingAt(period, count).map((month) => {
    const records = researchRecordsForSubdistrictCodes(subdistrictCodes, month);
    return {
      period: month,
      ...summarizeResearchAreaRecords(records, subdistrictCodes.length),
    };
  });
}

function researchMonthlySeriesForSubdistrict(subdistrictCode: string, period: string, count = 12) {
  return researchPeriodsEndingAt(period, count).map((month) => {
    const records = researchRecordsForSubdistrictCodes([subdistrictCode], month);
    return {
      period: month,
      ...summarizeResearchAreaRecords(records, 1),
    };
  });
}

function researchAreaDroughtLabel(stats: Pick<ResearchAreaStats, "droughtSevereSubdistricts" | "droughtWatchSubdistricts" | "droughtNormalSubdistricts" | "recordCount">) {
  if (stats.recordCount === 0) return "ไม่มีข้อมูล";
  if (stats.droughtSevereSubdistricts > 0) return "เสี่ยงสูง";
  if (stats.droughtWatchSubdistricts > 0) return "เฝ้าระวัง";
  return "ปกติ";
}

function researchAreaDroughtTone(stats: Pick<ResearchAreaStats, "droughtSevereSubdistricts" | "droughtWatchSubdistricts" | "recordCount">) {
  if (stats.recordCount === 0) return "muted";
  if (stats.droughtSevereSubdistricts > 0 || stats.droughtWatchSubdistricts > 0) return "watch";
  return "good";
}

function researchDistrictPath(record: NakhonRatchasimaResearchDistrictLatest) {
  const district = getNakhonRatchasimaDistrictByCode(record.districtCode);
  return district ? getNakhonRatchasimaPath(district) : NAKHON_RATCHASIMA_ROUTE_BASE;
}

function researchSubdistrictPath(record: NakhonRatchasimaResearchSubdistrictLatest) {
  const district = getNakhonRatchasimaDistrictByCode(record.districtCode);
  const subdistrict = district?.subdistricts.find((item) => item.subdistrictCode === record.subdistrictCode);
  if (district && subdistrict) return getNakhonRatchasimaPath(district, subdistrict);
  if (district) return getNakhonRatchasimaPath(district);
  return NAKHON_RATCHASIMA_ROUTE_BASE;
}

function predictionReadinessSummary() {
  const districts = getNakhonRatchasimaDistricts();
  const counts: Record<LocalMapStatus, number> = {
    admin: 0,
    "local-evidence": 0,
    "source-capability": 0,
    "district-evidence": 0,
    "research-drought-normal": 0,
    "research-drought-watch": 0,
    "research-drought-severe": 0,
    "research-study-ready": 0,
    "research-study-missing": 0,
    insufficient: 0,
    "no-data": 0,
  };
  const districtsWithPredictionInput = new Set<string>();

  districts.forEach((district) => {
    getNakhonRatchasimaMatrixRowsForDistrict(district.districtCode).forEach((row) => {
      const status = statusForSubdistrict(row, NAKHON_RATCHASIMA_LAYER_IDS.derivedAgriculturalRisk, "prediction-readiness");
      counts[status] += 1;
      if (!["admin", "insufficient", "no-data"].includes(status)) {
        districtsWithPredictionInput.add(row.district_code);
      }
    });
  });

  const totalSubdistricts = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const readySubdistricts = counts["local-evidence"];
  const sourceInputSubdistricts = counts["source-capability"];
  const districtContextSubdistricts = counts["district-evidence"];
  const blockedSubdistricts = counts.insufficient + counts["no-data"];

  return {
    districtCount: districts.length,
    districtSignalCount: districtsWithPredictionInput.size,
    totalSubdistricts,
    readySubdistricts,
    sourceInputSubdistricts,
    districtContextSubdistricts,
    blockedSubdistricts,
    readyPercent: totalSubdistricts > 0 ? (readySubdistricts / totalSubdistricts) * 100 : 0,
    readiestLevel:
      readySubdistricts > 0
        ? "ตำบลบางพื้นที่"
        : districtContextSubdistricts > 0
          ? "อำเภอบางพื้นที่"
          : "จังหวัด",
  };
}

function OfficialMetricCard({
  icon,
  label,
  value,
  detail,
  tone = "default",
  provenance,
}: {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  detail: ReactNode;
  tone?: "default" | "watch" | "good" | "muted";
  provenance?: DataProvenanceChipKind;
}) {
  return (
    <MetricCard
      element="article"
      className="nr-official-metric"
      icon={icon}
      label={label}
      value={value}
      detail={detail}
      tone={tone}
      provenance={provenance}
    />
  );
}

function ProvinceDashboardTabBar({
  activeTab,
  onChange,
}: {
  activeTab: ProvinceDashboardTab;
  onChange: (tab: ProvinceDashboardTab) => void;
}) {
  return (
    <section className="nr-dashboard-tabs" role="tablist" aria-label="หมวดข้อมูลจังหวัดนครราชสีมา">
      {provinceDashboardTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
        >
          <strong>{tab.label}</strong>
          <span>{tab.helper}</span>
        </button>
      ))}
    </section>
  );
}

function ProvinceDashboardHeading({ research }: { research: NakhonRatchasimaResearchPanelSummary }) {
  return (
    <section className="nr-dashboard-heading" aria-label="หัวข้อแดชบอร์ดจังหวัดนครราชสีมา">
      <div>
        <p className="eyebrow">ศูนย์ปฏิบัติการจังหวัด</p>
        <h2>จังหวัดนครราชสีมา</h2>
        <p>แดชบอร์ดสถานการณ์เกษตรและภัยแล้ง โดยแยกจังหวัด 32 อำเภอ 289 ตำบล และใช้รหัสพื้นที่เป็นแกนเชื่อมข้อมูล</p>
      </div>
      <div className="nr-dashboard-update">
        <div className="nr-dashboard-update-label">
          <span>แหล่งข้อมูลหลัก</span>
          <DataProvenanceChip kind="REAL" />
        </div>
        <strong>แหล่งข้อมูลหลัก: ข้อมูลสถานการณ์เกษตรและภัยแล้งที่จัดมาตรฐานแล้ว</strong>
        <small>
          {researchDisplayPeriod(research)} · เดือนล่าสุดในชุดข้อมูล {researchLatestPeriod(research)}
        </small>
      </div>
      <DataProvenanceLegend
        className="nr-dashboard-provenance-legend"
        kinds={["REAL", "DERIVED", "PROXY", "PENDING_SOURCE"]}
      />
    </section>
  );
}

function DashboardSection({
  eyebrow,
  title,
  description,
  provenance = "REAL",
  className = "",
  children,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  provenance?: DataProvenanceChipKind;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={["nr-dashboard-section", className].filter(Boolean).join(" ")}>
      <div className="nr-dashboard-section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <DataProvenanceChip kind={provenance} />
      </div>
      {children}
    </section>
  );
}

function DashboardAccordionSection({
  eyebrow,
  title,
  description,
  provenance = "REAL",
  icon,
  className = "",
  children,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  provenance?: DataProvenanceChipKind;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={["nr-panel nr-source-readiness nr-dashboard-accordion", className].filter(Boolean).join(" ")}>
      <details className="nr-source-disclosure">
        <summary>
          <span className="nr-source-summary-title">
            <span className="panel-icon" aria-hidden="true">
              {icon}
            </span>
            <span>
              <span className="eyebrow">{eyebrow}</span>
              <strong>{title}</strong>
              {description ? <small>{description}</small> : null}
            </span>
          </span>
          <span className="nr-source-summary-meta">
            <DataProvenanceChip kind={provenance} />
            <span className="nr-source-summary-action" aria-hidden="true" />
          </span>
        </summary>
        <div className="nr-dashboard-accordion-body">{children}</div>
      </details>
    </section>
  );
}

const dataGovernanceGuardrailItems = [
  <>ใช้ <code>TH-P29</code> เป็นจังหวัดเดิม ไม่สร้างจังหวัดนครราชสีมาซ้ำ</>,
  <>ป้ายชื่อระดับจังหวัดต้องใช้ “นครราชสีมา” หรือ “จังหวัดนครราชสีมา” เท่านั้น</>,
  <>การเชื่อมข้อมูลใช้รหัสจังหวัด/อำเภอ/ตำบลเท่านั้น ไม่ใช้ชื่อหรือที่อยู่เว็บ</>,
  <>ข้อมูลจริงจากแหล่งข้อมูลไม่เท่ากับคะแนนความเสี่ยงรวมที่ระบบคำนวณ</>,
  <>พื้นที่ที่ยังไม่มีหลักฐานเชิงลึกต้องแสดงว่า “ยังไม่มีข้อมูล” ไม่ใช่ “ปกติ”</>,
];

function DataGovernanceGuardrailList() {
  return (
    <ul className="clean-list">
      {dataGovernanceGuardrailItems.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function DataGovernanceGuardrailAccordion() {
  return (
    <section className="nr-panel nr-guardrail">
      <details>
        <summary>
          <span className="panel-icon" aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <strong>ข้อกำกับข้อมูลสำคัญ</strong>
        </summary>
        <DataGovernanceGuardrailList />
      </details>
    </section>
  );
}

function SourceTruthNote({
  research,
  droughtForecast,
}: {
  research: NakhonRatchasimaResearchPanelSummary;
  droughtForecast: NakhonRatchasimaThaiWaterDroughtForecast;
}) {
  const selectedLabel = "ภัยแล้ง";
  const forecastSourceLabel = `ข้อมูลพยากรณ์ 6 เดือน · รอบ ${formatMonth(droughtForecast.meta.issueMonth, "th")}`;
  const forecastHeading = "พยากรณ์ภัยแล้ง · ข้อมูลย้อนหลังและความเสี่ยงจากชุดข้อมูลที่จัดมาตรฐานแล้ว";
  const periodValue = formatMonth(droughtForecast.meta.issueMonth, "th");
  const periodDescription = `พยากรณ์ภัยแล้ง ${formatThaiNumber(droughtForecast.monthly.length)} เดือนล่าสุด`;

  return (
    <section className="nr-source-truth-note" aria-label="แหล่งข้อมูลหลักของหน้าจังหวัดนครราชสีมา">
      <div>
        <p className="eyebrow">{selectedLabel}</p>
        <strong>{forecastHeading}</strong>
        <span>
          พยากรณ์ใช้ {forecastSourceLabel} · ข้อมูลย้อนหลังและภัยแล้งใช้ชุดข้อมูลที่จัดมาตรฐานแล้ว{" "}
          {formatThaiNumber(research.meta.normalizedRowCount)} รายการ ครอบคลุม {formatThaiNumber(research.meta.districtCount)} อำเภอ /{" "}
          {formatThaiNumber(research.meta.subdistrictCount)} ตำบล · รหัสจากงานวิจัยเดิมไม่ใช่รหัสราชการ
        </span>
      </div>
      <div className="nr-source-truth-period">
        <DataProvenanceChip kind="REAL" />
        <strong>{periodValue}</strong>
        <span>{periodDescription}</span>
      </div>
    </section>
  );
}

function ResearchStatGrid({ children }: { children: ReactNode }) {
  return <div className="nr-research-stat-grid">{children}</div>;
}

function formatForecastAxisDate(value: string) {
  return formatThaiDate(value).replace(/\s+\d{4}$/, "");
}

type DroughtForecastBand = "normal" | "watch" | "severe";

const DROUGHT_FORECAST_BAND_RANK: Record<DroughtForecastBand, number> = {
  normal: 0,
  watch: 1,
  severe: 2,
};

function droughtForecastBand(month: NakhonRatchasimaThaiWaterDroughtForecastMonth): DroughtForecastBand {
  if (month.riskPercent >= 0.5) return "severe";
  if (month.riskSubdistricts > 0) return "watch";
  return "normal";
}

function highestDroughtForecastBand(first: DroughtForecastBand, second: DroughtForecastBand) {
  return DROUGHT_FORECAST_BAND_RANK[first] >= DROUGHT_FORECAST_BAND_RANK[second] ? first : second;
}

function droughtForecastBandLabel(band: DroughtForecastBand, scope: "area" | "single" = "area") {
  if (scope === "single") {
    const labels: Record<DroughtForecastBand, string> = {
      normal: "ไม่เสี่ยง",
      watch: "เสี่ยงแล้ง",
      severe: "เสี่ยงแล้ง",
    };
    return labels[band];
  }
  const labels: Record<DroughtForecastBand, string> = {
    normal: "ไม่พบพื้นที่เสี่ยง",
    watch: "มีพื้นที่เสี่ยง",
    severe: "เกินครึ่งพื้นที่",
  };
  return labels[band];
}

function droughtForecastHasRiskSignal(forecast: NakhonRatchasimaThaiWaterDroughtForecast) {
  return forecast.monthly.some((month) => month.riskSubdistricts > 0);
}

function DroughtForecastTrendGraph({
  forecast,
  singleSubdistrict = false,
}: {
  forecast: NakhonRatchasimaThaiWaterDroughtForecast;
  singleSubdistrict?: boolean;
}) {
  const months = forecast.monthly;
  const width = 720;
  const height = 300;
  const padding = { top: 28, right: 34, bottom: 54, left: 62 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const denominator = Math.max(...months.map((month) => month.totalSubdistricts), forecast.meta.thaiWaterSubdistricts, 1);
  const threshold = Math.round(denominator * 0.5);
  const xStep = months.length > 1 ? plotWidth / (months.length - 1) : 0;
  const yForValue = (value: number) => padding.top + (1 - Math.min(value, denominator) / denominator) * plotHeight;
  const points = months.map((month, index) => ({
    month,
    band: droughtForecastBand(month),
    x: padding.left + xStep * index,
    y: yForValue(month.riskSubdistricts),
  }));
  const zeroY = yForValue(0);
  const thresholdY = yForValue(threshold);
  const areaPath = [
    `M ${points[0]?.x ?? padding.left} ${zeroY}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${points[points.length - 1]?.x ?? padding.left} ${zeroY}`,
    "Z",
  ].join(" ");
  const guideValues = Array.from(new Set([0, Math.round(denominator * 0.25), threshold, Math.round(denominator * 0.75), denominator])).sort(
    (a, b) => a - b,
  );
  const segments = points.slice(1).map((point, index) => {
    const from = points[index]!;
    return {
      from,
      to: point,
      band: highestDroughtForecastBand(from.band, point.band),
    };
  });

  return (
    <figure className="nr-forecast-line-graph nr-drought-forecast-graph">
      <svg
        className="nr-forecast-line-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="กราฟพยากรณ์จำนวนตำบลเสี่ยงภัยแล้ง 6 เดือน"
      >
        <title>กราฟพยากรณ์จำนวนตำบลเสี่ยงภัยแล้ง 6 เดือน</title>
        {guideValues.map((value) => {
          const y = yForValue(value);
          return (
            <g key={value} className="nr-forecast-graph-guide">
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} />
              <text x={padding.left - 10} y={y + 4}>{formatThaiNumber(value, 0)}</text>
            </g>
          );
        })}
        <path className="nr-drought-forecast-graph-area" d={areaPath} />
        <line
          className="nr-drought-forecast-graph-threshold"
          x1={padding.left}
          y1={thresholdY}
          x2={width - padding.right}
          y2={thresholdY}
        />
        <text className="nr-drought-forecast-threshold-label is-start" x={padding.left + 8} y={thresholdY - 8}>
          {singleSubdistrict ? "เส้นอ้างอิงเมื่อพบความเสี่ยง" : `เกณฑ์ครึ่งพื้นที่ ${formatThaiNumber(threshold)} ตำบล`}
        </text>
        {segments.map((segment) => (
          <line
            key={`${segment.from.month.period}-${segment.to.month.period}`}
            className={`nr-drought-forecast-line-segment is-${segment.band}`}
            x1={segment.from.x}
            y1={segment.from.y}
            x2={segment.to.x}
            y2={segment.to.y}
          />
        ))}
        {points.map((point) => (
          <g key={point.month.period} className="nr-forecast-point-group">
            <title>
              {point.month.labelTh} · {droughtForecastBandLabel(point.band, singleSubdistrict ? "single" : "area")} · {formatThaiNumber(point.month.riskSubdistricts)} ตำบล
            </title>
            <circle className={`nr-drought-forecast-point is-${point.band}`} cx={point.x} cy={point.y} r="7" />
            <text className={`nr-drought-forecast-point-label is-${point.band}`} x={point.x} y={point.y - 14}>
              {formatThaiNumber(point.month.riskSubdistricts)}
            </text>
            <text className="nr-forecast-axis-date" x={point.x} y={height - 21}>
              {point.month.labelTh.replace(/\s+\d{4}$/, "")}
            </text>
          </g>
        ))}
        <text className="nr-forecast-axis-unit" x={padding.left - 8} y={padding.top - 10}>ตำบล</text>
      </svg>
      <figcaption className="nr-forecast-line-legend nr-drought-forecast-legend">
        <span><i className="is-normal" />{singleSubdistrict ? "ไม่เสี่ยง" : "ไม่พบพื้นที่เสี่ยง"}</span>
        <span><i className="is-watch" />{singleSubdistrict ? "เสี่ยงแล้ง" : "มีพื้นที่เสี่ยง"}</span>
        <span><i className="is-severe" />{singleSubdistrict ? "เสี่ยงแล้ง" : "เกินครึ่งพื้นที่"}</span>
        <span><i className="is-threshold" />เส้นอ้างอิง</span>
      </figcaption>
    </figure>
  );
}

function droughtForecastRecordIsRisk(record: NakhonRatchasimaThaiWaterDroughtForecast["records"][number]) {
  return record.statusEn !== "norisk" && !record.statusTh.includes("ไม่เสี่ยง");
}

function droughtForecastForArea({
  forecast,
  expectedSubdistrictCodes,
}: {
  forecast: NakhonRatchasimaThaiWaterDroughtForecast;
  expectedSubdistrictCodes: string[];
}) {
  const expectedSet = new Set(expectedSubdistrictCodes);
  const records = forecast.records.filter((record) => expectedSet.has(record.subdistrictCode));
  const matchedSet = new Set(records.map((record) => record.subdistrictCode));
  const totalSubdistricts = expectedSubdistrictCodes.length;
  const monthly = forecast.monthly.map((month) => {
    const periodRecords = records.filter((record) => record.period === month.period);
    const riskSubdistricts = periodRecords.filter(droughtForecastRecordIsRisk).length;
    const normalSubdistricts = periodRecords.filter((record) => !droughtForecastRecordIsRisk(record)).length;
    return {
      ...month,
      riskSubdistricts,
      normalSubdistricts,
      totalSubdistricts,
      riskPercent: totalSubdistricts > 0 ? riskSubdistricts / totalSubdistricts : 0,
      sourceTypes: Array.from(new Set(periodRecords.map((record) => record.statusTh))).filter(Boolean),
    };
  });

  return {
    forecast: {
      ...forecast,
      meta: {
        ...forecast.meta,
        thaiWaterSubdistricts: totalSubdistricts,
        rowCount: records.length,
      },
      monthly,
      records,
    },
    matchedSubdistricts: matchedSet.size,
    missingSubdistricts: Math.max(0, totalSubdistricts - matchedSet.size),
    totalSubdistricts,
    hasData: records.length > 0,
  };
}

function ResearchAreaForecastPanel({
  district,
  subdistrict,
  droughtForecast,
}: {
  district: NakhonRatchasimaDistrict;
  subdistrict?: NakhonRatchasimaSubdistrict;
  droughtForecast: NakhonRatchasimaThaiWaterDroughtForecast;
}) {
  const expectedSubdistrictCodes = subdistrict
    ? [subdistrict.subdistrictCode]
    : district.subdistricts.map((item) => item.subdistrictCode);
  const droughtArea = droughtForecastForArea({ forecast: droughtForecast, expectedSubdistrictCodes });
  const areaLabel = subdistrict ? `ตำบล${subdistrict.nameTh}` : `อำเภอ${district.nameTh}`;
  const hasDroughtRiskSignal = droughtForecastHasRiskSignal(droughtArea.forecast);
  const droughtCoverageRemark = subdistrict
    ? "ตำบลนี้มีข้อมูลพยากรณ์"
    : `ครอบคลุม ${formatThaiNumber(droughtArea.matchedSubdistricts)}/${formatThaiNumber(droughtArea.totalSubdistricts)} ตำบล`;

  return (
    <DashboardSection
      eyebrow="พยากรณ์"
      title={`สัญญาณพยากรณ์สำหรับ${areaLabel}`}
      description="พยากรณ์ภัยแล้ง 6 เดือนกรองตามรหัสตำบลของพื้นที่นี้เมื่อมีข้อมูล ไม่เติมค่าจำลองแทนพื้นที่ที่ไม่มีรายการ"
      provenance={droughtArea.hasData ? "REAL" : "PENDING_SOURCE"}
      className="nr-forecast-priority-section nr-area-forecast-section"
    >
      <div className="nr-area-forecast-block is-drought">
        <div className="nr-area-forecast-block-heading">
          <span>ภัยแล้ง 6 เดือน</span>
          <strong>พยากรณ์ภัยแล้งของพื้นที่นี้</strong>
        </div>
        {droughtArea.hasData ? (
          <DroughtForecastTrendGraph forecast={droughtArea.forecast} singleSubdistrict={Boolean(subdistrict)} />
        ) : (
          <EmptyLocalEvidence />
        )}
        <p className={`nr-compact-note${droughtArea.hasData && !hasDroughtRiskSignal ? " nr-forecast-remark" : ""}`}>
          {droughtArea.hasData
            ? hasDroughtRiskSignal
              ? `กรองข้อมูลพยากรณ์ตาม${subdistrict ? "รหัสตำบล" : "รหัสอำเภอ"} ${droughtCoverageRemark} มีพื้นที่ขาดข้อมูล ${formatThaiNumber(droughtArea.missingSubdistricts)} ตำบล`
              : `กราฟเป็น 0 ทุกเดือน เพราะข้อมูลพยากรณ์ระบุว่าไม่เสี่ยงในช่วงพยากรณ์นี้ หลังกรองตาม${subdistrict ? "รหัสตำบล" : "รหัสอำเภอ"} (${droughtCoverageRemark})`
            : "ยังไม่มีรายการพยากรณ์ภัยแล้งของพื้นที่นี้ในชุดข้อมูลพยากรณ์"}
        </p>
      </div>
    </DashboardSection>
  );
}

function DroughtForecastPriorityPanel({ forecast }: { forecast: NakhonRatchasimaThaiWaterDroughtForecast }) {
  const months = forecast.monthly;
  const lead = months[0];

  if (months.length === 0 || !lead) {
    return (
      <DashboardSection
        eyebrow="ข้อมูลพยากรณ์"
        title="พยากรณ์พื้นที่เสี่ยงภัยแล้ง 6 เดือน"
        description="ยังไม่มีรายการพยากรณ์ภัยแล้งที่อ่านได้ จึงไม่สร้างค่าจำลองแทน"
        provenance="PENDING_SOURCE"
        className="nr-forecast-priority-section nr-drought-forecast-section is-empty"
      >
        <EmptyLocalEvidence />
      </DashboardSection>
    );
  }

  const peak = months.reduce(
    (highest, month) => (month.riskSubdistricts > highest.riskSubdistricts ? month : highest),
    lead,
  );
  const ending = months[months.length - 1] ?? lead;

  return (
    <DashboardSection
      eyebrow="ข้อมูลพยากรณ์"
      title="พยากรณ์พื้นที่เสี่ยงภัยแล้ง 6 เดือน"
      description="ใช้เป็นสัญญาณล่วงหน้าของหน้าภัยแล้ง ก่อนเทียบกับข้อมูลย้อนหลังและรายการพื้นที่ที่ควรตรวจสอบ"
      provenance="REAL"
      className="nr-forecast-priority-section nr-drought-forecast-section"
    >
      <div className="nr-forecast-priority-grid">
        <DroughtForecastTrendGraph forecast={forecast} />
        <div className="nr-forecast-summary-stack">
          <div className={`nr-forecast-lead-card nr-drought-forecast-lead-card is-${droughtForecastBand(lead)}`}>
            <span>เดือนแรกของพยากรณ์</span>
            <strong>{droughtForecastBandLabel(droughtForecastBand(lead))}</strong>
            <b>{formatThaiNumber(lead.riskSubdistricts)} ตำบล</b>
            <small>{lead.labelTh}</small>
          </div>
          <MetricCard
            label="เดือนที่เสี่ยงสูงสุด"
            value={`${formatThaiNumber(peak.riskSubdistricts)} ตำบล`}
            detail={`${peak.labelTh} · ${formatPercent(peak.riskPercent * 100, 1)}`}
            provenance="REAL"
            tone={droughtForecastBand(peak) === "severe" ? "watch" : "default"}
          />
          <MetricCard
            label="รอบข้อมูล"
            value={formatMonth(forecast.meta.issueMonth, "th")}
            detail={`${formatThaiNumber(months.length)} เดือน ถึง ${ending.labelTh}`}
            provenance="REAL"
          />
        </div>
      </div>
      <div className="nr-forecast-primary-strip nr-drought-forecast-month-strip" aria-label="พยากรณ์ภัยแล้งรายเดือน 6 เดือน">
        {months.map((month) => (
          <span key={month.period} className={`is-${droughtForecastBand(month)}`}>
            <small>{month.labelTh}</small>
            <strong>{droughtForecastBandLabel(droughtForecastBand(month))}</strong>
            <b>{formatThaiNumber(month.riskSubdistricts)} ตำบล</b>
          </span>
        ))}
      </div>
      <p className="nr-compact-note">
        ข้อมูลนี้เป็นพยากรณ์พื้นที่เสี่ยงภัยแล้ง แยกจากข้อมูลภัยแล้งย้อนหลังที่จัดมาตรฐานแล้ว
      </p>
    </DashboardSection>
  );
}

function ResearchDroughtSituationPanel({ research }: { research: NakhonRatchasimaResearchPanelSummary }) {
  return (
    <DashboardSection
      eyebrow="ชุดข้อมูลภัยแล้ง"
      title="สถานการณ์ภัยแล้งจากชุดข้อมูล"
      description="ใช้สถานะภัยแล้งที่จัดมาตรฐานแล้วเป็นแกนหลัก เพื่อแยกพื้นที่เฝ้าระวังออกจากพื้นที่ปกติในเดือนล่าสุด"
      provenance="DERIVED"
      className="nr-drought-situation-section"
    >
      <ResearchStatGrid>
        <MetricCard label="เฝ้าระวังเดือนล่าสุด" value={`${formatThaiNumber(research.latest.droughtWatchSubdistricts)} ตำบล`} provenance="DERIVED" tone="watch" />
        <MetricCard label="ปกติเดือนล่าสุด" value={`${formatThaiNumber(research.latest.droughtNormalSubdistricts)} ตำบล`} provenance="DERIVED" tone="good" />
      </ResearchStatGrid>
    </DashboardSection>
  );
}

function ResearchDroughtDistrictPanel({
  research,
  onNavigate,
}: {
  research: NakhonRatchasimaResearchPanelSummary;
  onNavigate: (path: string) => void;
}) {
  const districts = [...research.districtsLatest]
    .sort(
      (a, b) =>
        b.droughtSevereSubdistricts - a.droughtSevereSubdistricts ||
        b.droughtWatchSubdistricts - a.droughtWatchSubdistricts ||
        b.droughtConflictKeys - a.droughtConflictKeys,
    )
    .slice(0, 6);

  return (
    <DashboardSection
      eyebrow="พื้นที่ติดตาม"
      title="พื้นที่ที่ควรติดตาม"
      description="จัดอันดับเพื่อชี้พื้นที่ที่ควรตรวจสอบต่อ ไม่ใช่การประกาศภัยรายอำเภอ"
      provenance="DERIVED"
      className="nr-follow-up-section"
    >
      <div className="nr-research-list">
        {districts.map((record) => {
          const status = districtResearchRiskStatus(record);
          const riskCount = record.droughtSevereSubdistricts + record.droughtWatchSubdistricts;
          return (
            <button key={record.districtCode} type="button" onClick={() => onNavigate(researchDistrictPath(record))}>
              <span>อ.{record.districtNameTh}</span>
              <b>{coverageLabel(status, "prediction-readiness")} · {formatThaiNumber(riskCount)} ตำบลเสี่ยง</b>
            </button>
          );
        })}
      </div>
    </DashboardSection>
  );
}

function ResearchSubdistrictAttentionPanel({
  title,
  records,
  onNavigate,
}: {
  title: string;
  records: NakhonRatchasimaResearchSubdistrictLatest[];
  onNavigate: (path: string) => void;
}) {
  return (
    <section className="nr-panel nr-research-attention">
      <div className="nr-module-title-row">
        <PanelTitle icon={<MapPin size={18} />} title={title} />
        <DataProvenanceChip kind="DERIVED" />
      </div>
      <div className="nr-research-list">
        {records.slice(0, 5).map((record) => (
          <button key={record.subdistrictCode} type="button" onClick={() => onNavigate(researchSubdistrictPath(record))}>
            <span>ต.{record.subdistrictNameTh} · อ.{record.districtNameTh}</span>
            <b>{record.droughtRiskLabelTh}</b>
          </button>
        ))}
      </div>
      <p className="provenance-note">เปิดพื้นที่เพื่อดูลำดับชั้นพื้นที่ จังหวัดนครราชสีมา → อำเภอ → ตำบล</p>
    </section>
  );
}

function ResearchSourceLimitsPanel({ research }: { research: NakhonRatchasimaResearchPanelSummary }) {
  return (
    <DashboardAccordionSection
      eyebrow="ตรวจสอบข้อมูล"
      title="ที่มา ความสด และข้อจำกัด"
      description="หลักฐานและข้อจำกัดของข้อมูลอยู่ท้ายส่วนหลัก เพื่อไม่แย่งความสนใจจากแดชบอร์ด"
      provenance="REAL"
      icon={<Database size={18} />}
      className="nr-research-source-section"
    >
      <dl className="nr-research-source-grid">
        <div>
          <dt>ข้อตกลงชุดข้อมูล</dt>
          <dd>ข้อมูลสถานการณ์และภัยแล้งที่จัดมาตรฐานแล้ว</dd>
        </div>
        <div>
          <dt>ข้อมูลพยากรณ์</dt>
          <dd>พยากรณ์ภัยแล้ง 6 เดือนล่าสุด</dd>
        </div>
        <div>
          <dt>ข้อมูลรายเดือน</dt>
          <dd>ตารางสถานการณ์ภัยแล้งรายพื้นที่</dd>
        </div>
        <div>
          <dt>ขอบเขตการใช้</dt>
          <dd>ใช้เฉพาะสถานะภัยแล้ง ความพร้อมข้อมูลพื้นที่ และกฎเชื่อมรหัสพื้นที่</dd>
        </div>
      </dl>
      <p className="nr-compact-note">{researchJoinPolicyNote()} · ข้อมูลพยากรณ์ภัยแล้งแยกจากรายการย้อนหลังที่จัดมาตรฐานแล้ว</p>
      <div className="nr-research-source-guardrails">
        <div className="nr-module-title-row">
          <PanelTitle icon={<AlertTriangle size={18} />} title="ข้อกำกับข้อมูลสำคัญ" />
        </div>
        <DataGovernanceGuardrailList />
      </div>
    </DashboardAccordionSection>
  );
}

function ResearchAreaHeading({
  district,
  subdistrict,
  activePeriod,
  stats,
}: {
  district: NakhonRatchasimaDistrict;
  subdistrict?: NakhonRatchasimaSubdistrict;
  activePeriod: { period: string; isFallback: boolean };
  stats: ResearchAreaStats;
}) {
  const isSubdistrict = subdistrict !== undefined;
  const areaLabel = isSubdistrict ? "ระดับตำบล" : "ระดับอำเภอ";
  const title = subdistrict?.nameTh ?? district.nameTh;
  const locationLine = subdistrict
    ? `จังหวัดนครราชสีมา → อำเภอ${district.nameTh} → ตำบล${subdistrict.nameTh}`
    : `จังหวัดนครราชสีมา → อำเภอ${district.nameTh} → ${formatThaiNumber(stats.totalSubdistricts)} ตำบล`;

  return (
    <section className="nr-dashboard-heading nr-area-heading" aria-label={`หัวข้อแดชบอร์ด${areaLabel}`}>
      <div>
        <p className="eyebrow">{areaLabel} · {subdistrict?.subdistrictCode ?? district.districtCode}</p>
        <h2>{title}</h2>
        <p>{locationLine} ใช้ข้อมูลรายเดือนจากชุดข้อมูลที่จัดมาตรฐานแล้วเป็นแกนหลัก</p>
      </div>
      <div className="summary-strip nr-area-heading-metrics">
        <MetricCard
          label="ข้อมูลในระบบ"
          value={isSubdistrict ? (stats.recordCount > 0 ? "มีข้อมูล" : "ไม่มีข้อมูล") : `${stats.recordCount}/${stats.totalSubdistricts} ตำบล`}
          detail={`${formatMonth(activePeriod.period, "th")}${activePeriod.isFallback ? " · ใช้เดือนล่าสุดแทน" : ""}`}
          provenance={stats.recordCount > 0 ? "REAL" : "PENDING_SOURCE"}
        />
        <MetricCard
          label="สถานะภัยแล้ง"
          value={researchAreaDroughtLabel(stats)}
          detail={isSubdistrict ? "จากรายการข้อมูลตำบล" : `${formatThaiNumber(stats.droughtWatchSubdistricts + stats.droughtSevereSubdistricts)} ตำบลเฝ้าระวัง`}
          provenance={stats.recordCount > 0 ? "DERIVED" : "PENDING_SOURCE"}
          tone={researchAreaDroughtTone(stats)}
        />
        <MetricCard
          label="ข้อมูลที่ต้องตรวจซ้ำ"
          value={isSubdistrict ? (stats.droughtConflictKeys > 0 ? "พบรายการ" : "ไม่พบ") : `${formatThaiNumber(stats.droughtConflictKeys)} ชุด`}
          provenance={stats.droughtConflictKeys > 0 ? "DERIVED" : "REAL"}
          tone={stats.droughtConflictKeys > 0 ? "watch" : "good"}
        />
        <MetricCard
          label="ช่องว่างข้อมูล"
          value={isSubdistrict ? (stats.missingCount > 0 ? "ขาดข้อมูล" : "ครบ") : `${formatThaiNumber(stats.missingCount)} ตำบล`}
          detail={isSubdistrict ? "รายการรายเดือนของพื้นที่นี้" : `จากทั้งหมด ${formatThaiNumber(stats.totalSubdistricts)} ตำบล`}
          provenance={stats.missingCount > 0 ? "PENDING_SOURCE" : "REAL"}
          tone={stats.missingCount > 0 ? "watch" : "good"}
        />
      </div>
      <DataProvenanceLegend
        className="nr-dashboard-provenance-legend"
        kinds={["REAL", "DERIVED", "PENDING_SOURCE"]}
      />
    </section>
  );
}

function ResearchAreaSituationPanel({
  district,
  subdistrict,
  stats,
  activePeriod,
}: {
  district: NakhonRatchasimaDistrict;
  subdistrict?: NakhonRatchasimaSubdistrict;
  stats: ResearchAreaStats;
  activePeriod: { period: string; isFallback: boolean };
}) {
  const isSubdistrict = Boolean(subdistrict);

  return (
    <DashboardSection
      eyebrow="ข้อมูลรายเดือน"
      title={isSubdistrict ? "สถานการณ์ตำบลจากชุดข้อมูล" : "สถานการณ์อำเภอจากชุดข้อมูล"}
      description={
        isSubdistrict
          ? "แสดงข้อมูลรายตำบลตรงจากตารางข้อมูลรายเดือน ถ้ารายการข้อมูลขาดจะไม่เดาค่าทดแทน"
          : "สรุปจากรายการรายตำบลในอำเภอนี้ ไม่ใช้ข้อมูลจำลองหรือหลักฐานเก่าเป็นตัวเลขหลัก"
      }
      provenance={stats.recordCount > 0 ? "REAL" : "PENDING_SOURCE"}
      className="nr-area-situation-section"
    >
      <ResearchStatGrid>
        <MetricCard
          label="รอบข้อมูล"
          value={formatMonth(activePeriod.period, "th")}
          detail={activePeriod.isFallback ? "เดือนที่เลือกไม่มีในชุดข้อมูล จึงใช้เดือนล่าสุด" : "ตรงกับเดือนที่เลือก"}
          provenance="REAL"
        />
        <MetricCard
          label="ข้อมูลในระบบ"
          value={isSubdistrict ? (stats.recordCount > 0 ? "มีข้อมูล" : "ไม่มีข้อมูล") : `${formatThaiNumber(stats.recordCount)}/${formatThaiNumber(stats.totalSubdistricts)} ตำบล`}
          provenance={stats.recordCount > 0 ? "REAL" : "PENDING_SOURCE"}
        />
        <MetricCard
          label="พื้นที่เฝ้าระวัง"
          value={isSubdistrict ? researchAreaDroughtLabel(stats) : `${formatThaiNumber(stats.droughtWatchSubdistricts + stats.droughtSevereSubdistricts)} ตำบล`}
          provenance={stats.recordCount > 0 ? "DERIVED" : "PENDING_SOURCE"}
          tone={researchAreaDroughtTone(stats)}
        />
        <MetricCard
          label="ข้อมูลที่ต้องตรวจซ้ำ"
          value={isSubdistrict ? (stats.droughtConflictKeys > 0 ? "พบรายการ" : "ไม่พบ") : `${formatThaiNumber(stats.droughtConflictKeys)} ชุด`}
          detail="รายการที่ต้องตรวจทานจากข้อมูลรายเดือน"
          provenance={stats.droughtConflictKeys > 0 ? "DERIVED" : "REAL"}
          tone={stats.droughtConflictKeys > 0 ? "watch" : "good"}
        />
      </ResearchStatGrid>
      <p className="nr-compact-note">{researchJoinPolicyNote()}</p>
    </DashboardSection>
  );
}

function ResearchAreaMapSection({
  target,
  layer,
  mapMode,
  onMapModeChange,
  onNavigate,
  selectedMonth,
  monthOptions,
  onMonthChange,
}: {
  target: Extract<NakhonRatchasimaRouteTarget, { valid: true; level: "district" | "subdistrict" }>;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
}) {
  return (
    <DashboardSection
      eyebrow="แผนที่"
      title={target.level === "district" ? "แผนที่ตำบลในอำเภอ" : "แผนที่ตำบลที่เลือก"}
      description="ใช้ตัวกรองร่วมกันบนแผนที่: ข้อมูลในระบบและระดับความเสี่ยง สามารถกรองซ้อนกันแบบตรงทุกเงื่อนไขได้"
      provenance="REAL"
      className="nr-area-map-section"
    >
      <NakhonRatchasimaLocalMap
        target={target}
        layer={layer}
        mapMode={mapMode}
        onMapModeChange={onMapModeChange}
        onNavigate={onNavigate}
        selectedMonth={selectedMonth}
        monthOptions={monthOptions}
        onMonthChange={onMonthChange}
      />
    </DashboardSection>
  );
}

function ResearchAreaDroughtHistoryPanel({
  title,
  series,
  isSubdistrict = false,
}: {
  title: string;
  series: Array<{ period: string } & ResearchAreaStats>;
  isSubdistrict?: boolean;
}) {
  const hasData = series.some((point) => point.recordCount > 0);
  const maxRiskCount = Math.max(1, ...series.map((point) => point.droughtWatchSubdistricts + point.droughtSevereSubdistricts));

  return (
    <DashboardSection
      eyebrow="ภัยแล้งย้อนหลัง"
      title={title}
      description="สถานะภัยแล้งอ่านจากข้อมูลรายเดือนที่จัดมาตรฐานแล้ว และแยกรายการที่ต้องตรวจทานออกจากค่าหลัก"
      provenance={hasData ? "DERIVED" : "PENDING_SOURCE"}
      className="nr-area-chart-section"
    >
      {hasData ? (
        <>
          <div className="nr-area-drought-trend" aria-label={title}>
            {series.map((point) => {
              const riskCount = point.droughtWatchSubdistricts + point.droughtSevereSubdistricts;
              const statusClass =
                point.recordCount === 0
                  ? "is-missing"
                  : point.droughtSevereSubdistricts > 0
                    ? "is-severe"
                    : point.droughtWatchSubdistricts > 0
                      ? "is-watch"
                      : "is-normal";
              return (
                <span key={point.period} className={statusClass}>
                  <i style={{ height: `${Math.max(10, (riskCount / maxRiskCount) * 100)}%` }} />
                  <small>{formatMonth(point.period, "th").replace("25", "")}</small>
                  <b>{isSubdistrict ? researchAreaDroughtLabel(point) : `${formatThaiNumber(riskCount)}/${formatThaiNumber(point.totalSubdistricts)}`}</b>
                </span>
              );
            })}
          </div>
          <p className="nr-compact-note">สีของกราฟแยกปกติ เฝ้าระวัง และเสี่ยงสูงตามข้อมูลที่ resolve แล้ว</p>
        </>
      ) : (
        <EmptyLocalEvidence />
      )}
    </DashboardSection>
  );
}

function ResearchAreaSubdistrictsPanel({
  district,
  period,
  onNavigate,
}: {
  district: NakhonRatchasimaDistrict;
  period: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <DashboardSection
      eyebrow="ลำดับชั้นพื้นที่"
      title="ตำบลในอำเภอนี้"
      description="ทุกตำบลในอำเภอใช้โครงเดียวกันและดึงรายการรายเดือนจากชุดข้อมูลที่จัดมาตรฐานแล้ว"
      provenance="REAL"
      className="nr-area-subdistrict-section"
    >
      <div className="nr-subdistrict-grid nr-area-subdistrict-grid">
        {district.subdistricts.map((subdistrict) => {
          const record = localResearchRecordForSubdistrict(subdistrict.subdistrictCode, period);
          const status = localMapStatusForResearchRecord(record, "risk");
          return (
            <button
              key={subdistrict.subdistrictCode}
              type="button"
              className={`nr-subdistrict-card is-${status}`}
              onClick={() => onNavigate(getNakhonRatchasimaPath(district, subdistrict))}
            >
              <strong>{subdistrict.nameTh}</strong>
              <span>{subdistrict.subdistrictCode}</span>
              <small>{record ? record.droughtRiskLabelTh : "ไม่มีข้อมูล"}</small>
            </button>
          );
        })}
      </div>
    </DashboardSection>
  );
}

function ResearchAreaAttentionPanel({
  district,
  period,
  onNavigate,
}: {
  district: NakhonRatchasimaDistrict;
  period: string;
  onNavigate: (path: string) => void;
}) {
  const rows = district.subdistricts
    .map((subdistrict) => ({
      subdistrict,
      record: localResearchRecordForSubdistrict(subdistrict.subdistrictCode, period),
    }))
    .sort(
      (a, b) =>
        (b.record?.droughtRiskLevel ?? -1) - (a.record?.droughtRiskLevel ?? -1),
    )
    .slice(0, 5);

  return (
    <DashboardSection
      eyebrow="พื้นที่ติดตาม"
      title="ตำบลที่ควรเปิดดูต่อ"
      description="เรียงจากระดับภัยแล้งในเดือนที่เลือก"
      provenance="DERIVED"
      className="nr-area-side-section"
    >
      <div className="nr-research-list">
        {rows.map(({ subdistrict, record }) => (
          <button key={subdistrict.subdistrictCode} type="button" onClick={() => onNavigate(getNakhonRatchasimaPath(district, subdistrict))}>
            <span>ต.{subdistrict.nameTh}</span>
            <b>{record ? record.droughtRiskLabelTh : "ไม่มีข้อมูล"}</b>
          </button>
        ))}
      </div>
    </DashboardSection>
  );
}

function ResearchSubdistrictProfilePanel({
  district,
  subdistrict,
  record,
}: {
  district: NakhonRatchasimaDistrict;
  subdistrict: NakhonRatchasimaSubdistrict;
  record: LocalResearchRecord;
}) {
  return (
    <DashboardSection
      eyebrow="พื้นที่"
      title="โปรไฟล์ตำบล"
      description="ข้อมูลอ้างอิงพื้นที่และรายการรายเดือนที่มีในชุดข้อมูล"
      provenance={record ? "REAL" : "PENDING_SOURCE"}
      className="nr-area-side-section"
    >
      <dl className="nr-compact-list">
        <div>
          <dt>จังหวัด</dt>
          <dd>นครราชสีมา</dd>
        </div>
        <div>
          <dt>อำเภอ</dt>
          <dd>{district.nameTh}</dd>
        </div>
        <div>
          <dt>ตำบล</dt>
          <dd>{subdistrict.nameTh}</dd>
        </div>
        <div>
          <dt>รหัสตำบล</dt>
          <dd>{subdistrict.subdistrictCode}</dd>
        </div>
      </dl>
    </DashboardSection>
  );
}

function ResearchAreaSourceLimitsPanel({
  district,
  subdistrict,
  stats,
  directRecords,
  inheritedRecords,
}: {
  district: NakhonRatchasimaDistrict;
  subdistrict?: NakhonRatchasimaSubdistrict;
  stats: ResearchAreaStats;
  directRecords: NakhonRatchasimaEvidenceRecord[];
  inheritedRecords: NakhonRatchasimaEvidenceRecord[];
}) {
  const areaName = subdistrict ? `ตำบล${subdistrict.nameTh} อำเภอ${district.nameTh}` : `อำเภอ${district.nameTh}`;

  return (
    <DashboardAccordionSection
      eyebrow="ตรวจสอบข้อมูล"
      title="ที่มา ความสด และข้อจำกัด"
      description="รายละเอียดตรวจสอบถูกพับไว้ท้ายหน้า เพื่อให้แดชบอร์ดหลักอ่านสถานการณ์ก่อน"
      provenance="REAL"
      icon={<Database size={18} />}
      className="nr-research-source-section nr-area-source-section"
    >
      <dl className="nr-research-source-grid">
        <div>
          <dt>พื้นที่</dt>
          <dd>{areaName}</dd>
        </div>
        <div>
          <dt>ข้อตกลงชุดข้อมูล</dt>
          <dd>ข้อมูลสถานการณ์และภัยแล้งที่จัดมาตรฐานแล้ว</dd>
        </div>
        <div>
          <dt>ข้อมูลรายเดือนที่ใช้อยู่</dt>
          <dd>ตารางสถานการณ์ภัยแล้งรายพื้นที่</dd>
        </div>
        <div>
          <dt>ความครอบคลุมในเดือนที่เลือก</dt>
          <dd>
            {formatThaiNumber(stats.recordCount)}/{formatThaiNumber(stats.totalSubdistricts)} ตำบล
          </dd>
        </div>
        <div>
          <dt>ข้อมูลที่ต้องตรวจซ้ำ</dt>
          <dd>{stats.droughtConflictKeys > 0 ? `${formatThaiNumber(stats.droughtConflictKeys)} รายการต้องตรวจซ้ำ` : "ไม่พบรายการที่ต้องตรวจซ้ำในพื้นที่นี้"}</dd>
        </div>
        <div>
          <dt>หลักฐานประกอบอื่น</dt>
          <dd>
            ตรงพื้นที่ {formatThaiNumber(directRecords.length)} รายการ · สืบทอดจากระดับสูงกว่า {formatThaiNumber(inheritedRecords.length)} รายการ
          </dd>
        </div>
      </dl>
      <p className="nr-compact-note">{researchJoinPolicyNote()}</p>
      <div className="nr-research-source-guardrails">
        <div className="nr-module-title-row">
          <PanelTitle icon={<AlertTriangle size={18} />} title="ข้อกำกับข้อมูลสำคัญ" />
        </div>
        <DataGovernanceGuardrailList />
      </div>
    </DashboardAccordionSection>
  );
}

function ResearchProvinceDataView({
  activeTab,
  layer,
  mapMode,
  onMapModeChange,
  onNavigate,
  research,
  droughtForecast,
  selectedMonth,
  monthOptions,
  onMonthChange,
  selectedSubdistrictCode,
  onSelectedSubdistrictChange,
}: {
  activeTab: Extract<ProvinceDashboardTab, "drought">;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  research: NakhonRatchasimaResearchPanelSummary;
  droughtForecast: NakhonRatchasimaThaiWaterDroughtForecast;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
  selectedSubdistrictCode: string | null;
  onSelectedSubdistrictChange: (subdistrictCode: string | null) => void;
}) {
  const attentionRecords = research.droughtAttentionLatest;
  const attentionTitle = "ตำบลภัยแล้งที่ควรตรวจสอบ";

  return (
    <section className={`nr-dashboard-layout nr-research-dashboard is-${activeTab}`}>
      <div className="nr-dashboard-main">
        <DroughtForecastPriorityPanel forecast={droughtForecast} />
        <ResearchDroughtSituationPanel research={research} />
        <ProvinceDashboardMapCard
          activeTab={activeTab}
          layer={layer}
          mapMode={mapMode}
          onMapModeChange={onMapModeChange}
          onNavigate={onNavigate}
          selectedMonth={selectedMonth}
          monthOptions={monthOptions}
          onMonthChange={onMonthChange}
          selectedSubdistrictCode={selectedSubdistrictCode}
          onSelectedSubdistrictChange={onSelectedSubdistrictChange}
        />
        <div className="nr-dashboard-module-grid">
          <ResearchDroughtDistrictPanel research={research} onNavigate={onNavigate} />
        </div>
        <ResearchSourceLimitsPanel research={research} />
      </div>
      <aside className="nr-dashboard-aside">
        <ResearchSubdistrictAttentionPanel title={attentionTitle} records={attentionRecords} onNavigate={onNavigate} />
      </aside>
    </section>
  );
}

function ProvinceSituationCards({ provinceRecord }: { provinceRecord: ProvinceMonthRisk | undefined }) {
  return (
    <section className="nr-dashboard-situation" aria-label="ภาพรวมสถานการณ์วันนี้">
      <div className="nr-dashboard-section-heading">
        <div>
          <p className="eyebrow">ภาพรวมสถานการณ์วันนี้</p>
          <h2>ข้อมูลเกษตรที่เจ้าหน้าที่ควรรู้ก่อนเปิดพื้นที่</h2>
        </div>
        <span className="nr-inline-status">อ้างอิงชุดข้อมูลเกษตรล่าสุด</span>
      </div>
      <div className="nr-dashboard-situation-cards">
        <OfficialMetricCard
          icon={<ShieldAlert size={18} />}
          label="ความเสี่ยงภัยแล้งเดือนนี้"
          value={provinceRecord ? severityLabel(provinceRecord.severity, "th") : "รอข้อมูล"}
          detail={
            provinceRecord
              ? `${primaryHazardLabelTh} · ${primaryCropLabelTh} · ${formatMonth(provinceRecord.month, "th")}`
              : "ยังไม่มี record ของเดือนที่เลือก"
          }
          tone={provinceRecord ? (provinceRecord.severity === "Normal" ? "good" : "default") : "muted"}
          provenance="DERIVED"
        />
        <OfficialMetricCard
          icon={<Leaf size={18} />}
          label="พืชที่เกี่ยวข้อง"
          value={provinceRecord ? primaryCropLabelTh : "รอข้อมูล"}
          detail={provinceRecord ? `ภัยหลัก: ${primaryHazardLabelTh}` : "ยังไม่มี record ของเดือนที่เลือก"}
          tone="default"
          provenance={provinceRecord ? dataProvenanceChipKindFromText(provinceRecord.provenance) : "PENDING_SOURCE"}
        />
        <OfficialMetricCard
          icon={<Gauge size={18} />}
          label="พื้นที่เปิดรับ"
          value={provinceRecord ? `${formatRai(provinceRecord.agriculturalAreaExposedRai)} ไร่` : "รอข้อมูล"}
          detail={provinceRecord ? `พื้นที่เสี่ยงสูง ${formatRai(provinceRecord.highRiskAreaRai)} ไร่` : "ยังไม่คำนวณ"}
          tone={provinceRecord && provinceRecord.highRiskAreaRai > 0 ? "watch" : "default"}
          provenance={provinceRecord ? "DERIVED" : "PENDING_SOURCE"}
        />
        <OfficialMetricCard
          icon={<Database size={18} />}
          label="ความเชื่อมั่น"
          value={provinceRecord ? labelConfidence(provinceRecord.confidence, "th") : "รอข้อมูล"}
          detail={provinceRecord ? formatMonth(provinceRecord.month, "th") : "เลือกเดือนอื่นเพื่อดูข้อมูล"}
          tone="default"
          provenance={provinceRecord ? dataProvenanceChipKindFromText(provinceRecord.provenance) : "PENDING_SOURCE"}
        />
      </div>
    </section>
  );
}

function ProvinceDashboardMapCard({
  activeTab,
  layer,
  mapMode,
  onMapModeChange,
  onNavigate,
  selectedMonth,
  monthOptions,
  onMonthChange,
  selectedSubdistrictCode,
  onSelectedSubdistrictChange,
}: {
  activeTab: ProvinceDashboardTab;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
  selectedSubdistrictCode: string | null;
  onSelectedSubdistrictChange: (subdistrictCode: string | null) => void;
}) {
  const research = getNakhonRatchasimaResearchPanelSummary();
  const activeResearchPeriod = localResearchPeriodForSelectedMonth(selectedMonth, research);
  const title = activeTab === "drought" ? "แผนที่ภัยแล้งจากชุดข้อมูล" : "แผนที่ความเสี่ยงภัยแล้ง";
  const helper =
    activeTab === "drought"
      ? `ชุดข้อมูลภัยแล้ง · ${formatMonth(activeResearchPeriod.period, "th")} · สีแสดงสถานะปกติ/เฝ้าระวัง/เสี่ยงสูง`
      : `${primaryRiskScopeLabelTh} · ${mapModeHelper(mapMode)}`;

  return (
    <section className="nr-dashboard-map-card" aria-label={title}>
      <div className="nr-dashboard-map-header">
        <div>
          <p className="eyebrow">แผนที่</p>
          <h2>{title}</h2>
          <span>{helper}</span>
        </div>
      </div>
      <NakhonRatchasimaLocalMap
        target={{ valid: true, level: "province", tab: activeTab }}
        layer={layer}
        mapMode={mapMode}
        onMapModeChange={onMapModeChange}
        onNavigate={onNavigate}
        selectedMonth={selectedMonth}
        monthOptions={monthOptions}
        onMonthChange={onMonthChange}
        selectedSubdistrictCode={selectedSubdistrictCode}
        onSelectedSubdistrictChange={onSelectedSubdistrictChange}
      />
    </section>
  );
}

function AgricultureImpactPanel({ provinceRecord }: { provinceRecord: ProvinceMonthRisk | undefined }) {
  return (
    <section className="nr-dashboard-module nr-agri-impact-module">
      <div className="nr-module-title-row">
        <PanelTitle icon={<Leaf size={18} />} title="พื้นที่เกษตรที่ระบบมองเห็น" />
        <DataProvenanceChip kind={provinceRecord ? dataProvenanceChipKindFromText(provinceRecord.provenance) : "PENDING_SOURCE"} />
      </div>
      {provinceRecord ? (
        <>
          <dl className="nr-compact-list">
            <div>
              <dt>พืชหลัก</dt>
              <dd>{primaryCropLabelTh}</dd>
            </div>
            <div>
              <dt>พื้นที่เปิดรับ</dt>
              <dd>{formatRai(provinceRecord.agriculturalAreaExposedRai)} ไร่</dd>
            </div>
            <div>
              <dt>พื้นที่เสี่ยงสูง</dt>
              <dd>{formatRai(provinceRecord.highRiskAreaRai)} ไร่</dd>
            </div>
            <div>
              <dt>ความเชื่อมั่น</dt>
              <dd>{labelConfidence(provinceRecord.confidence, "th")}</dd>
            </div>
          </dl>
          <p className="nr-compact-note">ไม่ใช่ตัวเลขเสียหายทางการ</p>
        </>
      ) : (
        <EmptyLocalEvidence />
      )}
    </section>
  );
}

function PredictionReadinessPanel({
  month,
  onOpenMap,
}: {
  month: string;
  onOpenMap: () => void;
}) {
  const readiness = predictionReadinessSummary();
  const readyPercentLabel = formatPercent(readiness.readyPercent, 1);

  return (
    <section className="nr-panel nr-prediction-readiness" aria-label="สถานะข้อมูลสำหรับคาดการณ์">
      <div className="nr-module-title-row">
        <PanelTitle icon={<Gauge size={18} />} title="สถานะข้อมูลสำหรับคาดการณ์" />
        <DataProvenanceChip kind="DERIVED" />
      </div>
      <p className="nr-readiness-lede">
        สรุปว่าระบบพร้อมใช้ข้อมูลระดับไหนกับโมเดลคาดการณ์ โดยอ่านจากหลักฐานและช่องทางข้อมูลที่มีอยู่ ไม่ใช่ระดับภัยที่เกิดแล้ว
      </p>
      <div className="nr-readiness-overview">
        <article className="nr-readiness-level-card">
          <span>ระดับที่พร้อมที่สุด</span>
          <strong>{readiness.readiestLevel}</strong>
          <small>
            รอบข้อมูล {month} · {formatThaiNumber(readiness.readySubdistricts)} จาก {formatThaiNumber(readiness.totalSubdistricts)} ตำบลพร้อมระดับพื้นที่
          </small>
          <div className="nr-readiness-progress" aria-label={`พร้อมคาดการณ์ระดับพื้นที่ ${readyPercentLabel}`}>
            <i style={{ width: `${readiness.readyPercent}%` }} />
          </div>
        </article>
        <dl className="nr-readiness-stat-grid">
          <div>
            <dt>พร้อมระดับพื้นที่</dt>
            <dd>{formatThaiNumber(readiness.readySubdistricts)} ตำบล</dd>
          </div>
          <div>
            <dt>มีข้อมูลนำเข้าตั้งต้น</dt>
            <dd>{formatThaiNumber(readiness.sourceInputSubdistricts)} ตำบล</dd>
          </div>
          <div>
            <dt>มีบริบทระดับอำเภอ</dt>
            <dd>{formatThaiNumber(readiness.districtContextSubdistricts)} ตำบล</dd>
          </div>
          <div>
            <dt>ยังต้องเติมก่อนคำนวณ</dt>
            <dd>{formatThaiNumber(readiness.blockedSubdistricts)} ตำบล</dd>
          </div>
        </dl>
      </div>
      <div className="nr-readiness-footer">
        <div>
          <strong>หลักฐานอยู่คนละชั้นกับ readiness</strong>
          <p>
            กล่องนี้เป็นสรุปสำหรับการคาดการณ์ รายการหลักฐาน แหล่งข้อมูล และข้อจำกัดยังอยู่ในรายละเอียดท้ายหน้าเพื่อการตรวจสอบต่อ
          </p>
        </div>
        <button type="button" className="secondary-button nr-readiness-map-action" onClick={onOpenMap}>
          ดูชั้นความพร้อมบนแผนที่
        </button>
      </div>
    </section>
  );
}

function AgriculturalRiskContextPanel({ provinceRecord }: { provinceRecord: ProvinceMonthRisk | undefined }) {
  return (
    <section className="nr-panel nr-agri-context">
      <div className="nr-module-title-row">
        <PanelTitle icon={<Leaf size={18} />} title="บริบทความเสี่ยงภัยแล้ง" />
        <DataProvenanceChip kind={provinceRecord ? dataProvenanceChipKindFromText(provinceRecord.provenance) : "PENDING_SOURCE"} />
      </div>
      {provinceRecord ? (
        <>
          <dl className="nr-compact-list">
            <div>
              <dt>เดือน</dt>
              <dd>{formatMonth(provinceRecord.month, "th")}</dd>
            </div>
            <div>
              <dt>ภัยหลัก</dt>
              <dd>{primaryHazardLabelTh}</dd>
            </div>
            <div>
              <dt>พืชที่เกี่ยวข้อง</dt>
              <dd>{primaryCropLabelTh}</dd>
            </div>
            <div>
              <dt>ความเชื่อมั่น</dt>
              <dd>{labelConfidence(provinceRecord.confidence, "th")}</dd>
            </div>
          </dl>
          <p className="nr-compact-note">ส่วนนี้เป็นบริบทจาก record ต้นแบบ ไม่ใช่ประกาศผลกระทบทางการ</p>
        </>
      ) : (
        <EmptyLocalEvidence />
      )}
    </section>
  );
}

function NakhonRatchasimaLocalMap({
  target,
  layer,
  mapMode,
  onMapModeChange,
  onNavigate,
  selectedMonth,
  monthOptions,
  onMonthChange,
  selectedSubdistrictCode: externalSelectedSubdistrictCode,
  onSelectedSubdistrictChange,
}: {
  target: NakhonRatchasimaRouteTarget;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange?: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
  selectedSubdistrictCode?: string | null;
  onSelectedSubdistrictChange?: (subdistrictCode: string | null) => void;
}) {
  const routeSelectedSubdistrictCode = target.valid && target.level === "subdistrict" ? target.subdistrict.subdistrictCode : undefined;
  const activeSelectedSubdistrictCode = externalSelectedSubdistrictCode ?? routeSelectedSubdistrictCode;
  const [geo, setGeo] = useState<NakhonRatchasimaGeoCollection | null>(null);
  const [provinceContextGeo, setProvinceContextGeo] = useState<ProvinceContextGeoCollection | null>(null);
  const [error, setError] = useState(false);
  const [transform, setTransform] = useState<LocalMapTransform>(localFitTransform);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(activeSelectedSubdistrictCode ?? null);
  const [preview, setPreview] = useState<LocalMapPreview | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const transformRef = useRef<LocalMapTransform>(transform);
  const animationFrame = useRef<number | null>(null);
  const wheelAnimationFrame = useRef<number | null>(null);
  const wheelTargetTransform = useRef<LocalMapTransform | null>(null);
  const suppressClick = useRef(false);
  const lastPointerType = useRef("mouse");
  const longPressTimer = useRef<number | null>(null);
  const previewDismissTimer = useRef<number | null>(null);
  const previewMode = useRef<PreviewMode | null>(null);
  const preservePreviewOnSelectionSync = useRef(false);
  const touchPanReady = useRef(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number; k: number; moved: boolean } | null>(
    null,
  );
  const activePointers = useRef<globalThis.Map<number, ClientPoint>>(new globalThis.Map());
  const pinchStart = useRef<PinchStart | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreenTarget(canvasRef);

  useEffect(() => {
    let active = true;
    fetch("/geodata/nakhon-ratchasima-subdistricts.geojson")
      .then((response) => {
        if (!response.ok) throw new Error("Nakhon Ratchasima geometry unavailable");
        return response.json();
      })
      .then((data: NakhonRatchasimaGeoCollection) => {
        if (active) {
          setGeo(data);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/geodata/thailand-adm1.geojson")
      .then((response) => {
        if (!response.ok) throw new Error("Province context map unavailable");
        return response.json();
      })
      .then((data: ProvinceContextGeoCollection) => {
        if (active) setProvinceContextGeo(data);
      })
      .catch(() => {
        if (active) setProvinceContextGeo(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const focusDistrictCode = target.valid && target.level !== "province" ? target.district.districtCode : undefined;
  const projection = useMemo(() => (geo ? createProjection(geo.features) : null), [geo]);
  const provinceContextFeatures = useMemo(
    () => provinceContextGeo?.features.filter((feature) => NAKHON_RATCHASIMA_NEIGHBOR_BOUNDARY_ISOS.has(feature.properties.shapeISO)) ?? [],
    [provinceContextGeo],
  );
  const focusFeatures = useMemo(() => {
    if (!geo) return [];
    if (activeSelectedSubdistrictCode) {
      const feature = geo.features.find((item) => item.properties.Admin_code === activeSelectedSubdistrictCode);
      return feature ? [feature] : [];
    }
    if (focusDistrictCode) return geo.features.filter((feature) => districtCodeForFeature(feature) === focusDistrictCode);
    return geo.features;
  }, [activeSelectedSubdistrictCode, focusDistrictCode, geo]);
  const targetTransform = useMemo(() => {
    if (!projection) return localFitTransform;
    if (activeSelectedSubdistrictCode) {
      return transformForLocalFocus(focusFeatures, projection, localSubdistrictFocusZoom, 1.56);
    }
    if (focusDistrictCode) {
      return transformForLocalFocus(focusFeatures, projection, localDistrictFocusZoom, 1.12);
    }
    return localFitTransform;
  }, [activeSelectedSubdistrictCode, focusDistrictCode, focusFeatures, projection]);
  const selectedFeature = useMemo(
    () => geo?.features.find((feature) => feature.properties.Admin_code === selectedCode) ?? null,
    [geo, selectedCode],
  );
  const previewedFeature = useMemo(
    () => geo?.features.find((feature) => feature.properties.Admin_code === preview?.subdistrictCode) ?? null,
    [geo, preview?.subdistrictCode],
  );
  const provinceMapTab = target.valid && target.level === "province" ? target.tab : null;
  const useResearchCriteriaMap = target.valid && layerUsesResearchCriteriaMap(layer.id, provinceMapTab);
  const criteriaDefaults = useMemo(() => defaultLocalMapCriteria(provinceMapTab, layer.id), [layer.id, provinceMapTab]);
  const [criteria, setCriteria] = useState<LocalMapCriteria>(criteriaDefaults);
  const criteriaActive = !localCriteriaEqual(criteria, criteriaDefaults);
  const researchSummary = getNakhonRatchasimaResearchPanelSummary();
  const activeResearchPeriod = localResearchPeriodForSelectedMonth(selectedMonth, researchSummary);

  useEffect(() => {
    setCriteria(criteriaDefaults);
  }, [criteriaDefaults]);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    previewMode.current = preview?.mode ?? null;
  }, [preview?.mode]);

  useEffect(
    () => () => {
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
      if (wheelAnimationFrame.current !== null) window.cancelAnimationFrame(wheelAnimationFrame.current);
      if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
      if (previewDismissTimer.current !== null) window.clearTimeout(previewDismissTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!geo || !projection) return;
    setSelectedCode(activeSelectedSubdistrictCode ?? null);
    if (preservePreviewOnSelectionSync.current) {
      preservePreviewOnSelectionSync.current = false;
    } else {
      setPreview(null);
    }
    animateTransform(targetTransform);
  }, [activeSelectedSubdistrictCode, geo, projection, targetTransform]);

  useEffect(() => {
    if (preview?.mode !== "touch" && preview?.mode !== "selected") return undefined;
    const dismissOnOutsideTap = (event: PointerEvent) => {
      const eventTarget = event.target as Element | null;
      if (eventTarget?.closest(".nr-map-preview-card") || eventTarget?.closest("[data-nr-subdistrict-code]")) return;
      setPreview(null);
    };
    window.addEventListener("pointerdown", dismissOnOutsideTap);
    return () => window.removeEventListener("pointerdown", dismissOnOutsideTap);
  }, [preview?.mode]);

  const cancelWheelAnimation = () => {
    if (wheelAnimationFrame.current !== null) window.cancelAnimationFrame(wheelAnimationFrame.current);
    wheelAnimationFrame.current = null;
    wheelTargetTransform.current = null;
  };

  const setClampedTransform = (next: LocalMapTransform) => {
    const clamped = clampLocalTransform(next);
    transformRef.current = clamped;
    setTransform(clamped);
  };

  const animateTransform = (targetTransform: LocalMapTransform) => {
    cancelWheelAnimation();
    const clampedTarget = clampLocalTransform(targetTransform);

    if (prefersReducedMotion()) {
      setClampedTransform(clampedTarget);
      return;
    }

    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);

    const start = transformRef.current;
    const startedAt = performance.now();
    const duration = 180;

    const tick = (now: number) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = {
        x: start.x + (clampedTarget.x - start.x) * eased,
        y: start.y + (clampedTarget.y - start.y) * eased,
        k: start.k + (clampedTarget.k - start.k) * eased,
      };

      transformRef.current = next;
      setTransform(next);

      if (progress < 1) {
        animationFrame.current = window.requestAnimationFrame(tick);
      } else {
        animationFrame.current = null;
        setClampedTransform(clampedTarget);
      }
    };

    animationFrame.current = window.requestAnimationFrame(tick);
  };

  const scheduleWheelTransform = (targetTransform: LocalMapTransform) => {
    if (animationFrame.current !== null) {
      window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }

    const clampedTarget = clampLocalTransform(targetTransform);

    if (prefersReducedMotion()) {
      cancelWheelAnimation();
      setClampedTransform(clampedTarget);
      return;
    }

    wheelTargetTransform.current = clampedTarget;

    if (wheelAnimationFrame.current !== null) return;

    const tick = () => {
      const wheelTarget = wheelTargetTransform.current;
      if (!wheelTarget) {
        wheelAnimationFrame.current = null;
        return;
      }

      const next = clampLocalTransform(interpolateMapTransform(transformRef.current, wheelTarget));

      if (isMapTransformSettled(next, wheelTarget)) {
        setClampedTransform(wheelTarget);
        wheelTargetTransform.current = null;
        wheelAnimationFrame.current = null;
        return;
      }

      transformRef.current = next;
      setTransform(next);
      wheelAnimationFrame.current = window.requestAnimationFrame(tick);
    };

    wheelAnimationFrame.current = window.requestAnimationFrame(tick);
  };

  const svgPointForClient = (point: ClientPoint) => {
    const svg = svgRef.current;
    if (!svg) return { x: localMapWidth / 2, y: localMapHeight / 2 };
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / localMapWidth, rect.height / localMapHeight) || 1;
    const offsetX = (rect.width - localMapWidth * scale) / 2;
    const offsetY = (rect.height - localMapHeight * scale) / 2;

    return {
      x: clamp((point.clientX - rect.left - offsetX) / scale, 0, localMapWidth),
      y: clamp((point.clientY - rect.top - offsetY) / scale, 0, localMapHeight),
    };
  };

  const svgDeltaForClient = (start: ClientPoint, point: ClientPoint) => {
    const svg = svgRef.current;
    if (!svg) return { x: point.clientX - start.clientX, y: point.clientY - start.clientY };
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / localMapWidth, rect.height / localMapHeight) || 1;

    return {
      x: (point.clientX - start.clientX) / scale,
      y: (point.clientY - start.clientY) / scale,
    };
  };

  const cancelPreviewDismiss = () => {
    if (previewDismissTimer.current === null) return;
    window.clearTimeout(previewDismissTimer.current);
    previewDismissTimer.current = null;
  };

  const dismissPreview = () => {
    cancelPreviewDismiss();
    previewMode.current = null;
    setPreview(null);
  };

  const schedulePreviewDismiss = () => {
    if (previewMode.current === "touch" || previewMode.current === "selected") return;
    cancelPreviewDismiss();
    previewDismissTimer.current = window.setTimeout(() => {
      setPreview(null);
      previewDismissTimer.current = null;
    }, 110);
  };

  const featureModel = (feature: NakhonRatchasimaGeoFeature) => {
    const subdistrictCode = feature.properties.Admin_code;
    const row = getNakhonRatchasimaMatrixRowBySubdistrictCode(subdistrictCode);
    const district = getNakhonRatchasimaDistrictByCode(row?.district_code);
    const subdistrict = district?.subdistricts.find((item) => item.subdistrictCode === subdistrictCode);
    const researchRecord = localResearchRecordForSubdistrict(subdistrictCode, activeResearchPeriod.period);
    const status = useResearchCriteriaMap
      ? localMapStatusForResearchRecord(researchRecord, criteria.viewMode)
      : statusForSubdistrict(row, layer.id, mapMode);
    const matchesCriteria = useResearchCriteriaMap ? localResearchRecordMatchesCriteria(researchRecord, criteria) : true;
    const path = district && subdistrict ? getNakhonRatchasimaPath(district, subdistrict) : NAKHON_RATCHASIMA_ROUTE_BASE;
    const districtPath = district ? getNakhonRatchasimaPath(district) : NAKHON_RATCHASIMA_ROUTE_BASE;

    return { district, districtPath, matchesCriteria, path, researchRecord, row, status, subdistrict, subdistrictCode };
  };

  const previewPositionForClient = (point: ClientPoint) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 16, y: 16 };
    const cardWidth = 276;
    const cardHeight = 360;
    const gap = 14;
    const topReserved = useResearchCriteriaMap ? 112 : 12;
    const bottomReserved = useResearchCriteriaMap ? 78 : 32;
    const maxY = Math.max(topReserved, rect.height - bottomReserved - cardHeight);
    let x = point.clientX - rect.left + gap;
    let y = point.clientY - rect.top - 18;

    if (x + cardWidth > rect.width - 12) x = point.clientX - rect.left - cardWidth - gap;
    if (y + cardHeight > rect.height - bottomReserved) y = maxY;

    return {
      x: clamp(x, 12, Math.max(12, rect.width - cardWidth - 12)),
      y: clamp(y, topReserved, maxY),
    };
  };

  const showSubdistrictPreview = (feature: NakhonRatchasimaGeoFeature, point: ClientPoint, mode: PreviewMode) => {
    if (mode === "hover" && (previewMode.current === "selected" || previewMode.current === "touch")) return;
    const model = featureModel(feature);
    if (!model.district || !model.subdistrict) {
      dismissPreview();
      return;
    }
    if (!model.matchesCriteria) {
      dismissPreview();
      return;
    }
    cancelPreviewDismiss();
    const position = mode === "touch" ? { x: 0, y: 0 } : previewPositionForClient(point);
    previewMode.current = mode;
    setPreview({
      mode,
      ...position,
      districtPath: model.districtPath,
      districtTh: model.district.nameTh ?? feature.properties.A_Name_T,
      path: model.path,
      status: model.status,
      subdistrictCode: model.subdistrictCode,
      subdistrictTh: model.subdistrict.nameTh ?? feature.properties.T_Name_T,
    });
  };

  const focusFeature = (feature: NakhonRatchasimaGeoFeature) => {
    if (!projection) return;
    const model = featureModel(feature);
    if (!model.district || !model.subdistrict) return;
    if (!model.matchesCriteria) return;
    setSelectedCode(model.subdistrictCode);
    preservePreviewOnSelectionSync.current = true;
    onSelectedSubdistrictChange?.(model.subdistrictCode);
    animateTransform(transformForLocalFocus([feature], projection, localSubdistrictFocusZoom, 1.56));
  };

  const getPinchPoints = () => Array.from(activePointers.current.values()).slice(0, 2);

  const getPinchDistance = ([first, second]: ClientPoint[]) => {
    const deltaX = second.clientX - first.clientX;
    const deltaY = second.clientY - first.clientY;
    return Math.hypot(deltaX, deltaY);
  };

  const getPinchClientCenter = ([first, second]: ClientPoint[]): ClientPoint => ({
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2,
  });

  const startPinch = () => {
    const points = getPinchPoints();
    if (points.length < 2) return;
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    const clientCenter = getPinchClientCenter(points);
    pinchStart.current = {
      distance: getPinchDistance(points),
      center: svgPointForClient(clientCenter),
      clientCenter,
      transform: transformRef.current,
    };
    dragStart.current = null;
    touchPanReady.current = true;
    setIsDragging(true);
  };

  const updatePinch = () => {
    const start = pinchStart.current;
    const points = getPinchPoints();
    if (!start || points.length < 2 || start.distance <= 0) return;
    const clientCenter = getPinchClientCenter(points);
    const panDelta = svgDeltaForClient(start.clientCenter, clientCenter);
    const k = clamp(Number((start.transform.k * (getPinchDistance(points) / start.distance)).toFixed(3)), localMinZoom, localMaxZoom);
    setClampedTransform({
      x: start.center.x + panDelta.x - ((start.center.x - start.transform.x) / start.transform.k) * k,
      y: start.center.y + panDelta.y - ((start.center.y - start.transform.y) / start.transform.k) * k,
      k,
    });
    suppressClick.current = true;
  };

  const zoomToPoint = (targetZoom: number, center = { x: localMapWidth / 2, y: localMapHeight / 2 }, animated = true) => {
    const current = transformRef.current;
    const targetTransform = getAnchoredZoomTransform(current, targetZoom, center, localMinZoom, localMaxZoom);

    if (animated) animateTransform(targetTransform);
    else setClampedTransform(targetTransform);
  };

  const zoomFromPoint = (delta: number, center = { x: localMapWidth / 2, y: localMapHeight / 2 }, animated = true) => {
    zoomToPoint(transformRef.current.k + delta, center, animated);
  };

  const handleMapWheel = (event: WheelEvent) => {
    const baseTransform = wheelTargetTransform.current ?? transformRef.current;
    const action = getSharedMapWheelAction(event, baseTransform.k, localMinZoom, localMaxZoom);

    if (action.type === "zoom") {
      event.preventDefault();
      if (Math.abs(action.k - baseTransform.k) > 0.003) {
        scheduleWheelTransform(
          getAnchoredZoomTransform(baseTransform, action.k, svgPointForClient(event), localMinZoom, localMaxZoom),
        );
      }
      return;
    }

    if (action.type === "contain") event.preventDefault();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    canvas.addEventListener("wheel", handleMapWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleMapWheel);
  }, [geo, projection]);

  const finishDrag = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    dragStart.current = null;
    pinchStart.current = null;
    activePointers.current.clear();
    touchPanReady.current = false;
    setIsDragging(false);
  };

  useEffect(() => {
    if (!selectedCode || selectedCode === routeSelectedSubdistrictCode) return;
    const record = localResearchRecordForSubdistrict(selectedCode, activeResearchPeriod.period);
    if (localResearchRecordMatchesCriteria(record, criteria)) return;
    setSelectedCode(null);
    setPreview(null);
    onSelectedSubdistrictChange?.(null);
  }, [activeResearchPeriod.period, criteria, onSelectedSubdistrictChange, routeSelectedSubdistrictCode, selectedCode]);

  if (error) {
    return <div className="nr-map-loading">ไม่สามารถโหลดขอบเขตตำบลนครราชสีมาได้</div>;
  }

  if (!geo || !projection) {
    return <div className="nr-map-loading">กำลังโหลดขอบเขตตำบลนครราชสีมา...</div>;
  }

  const previewTitle = preview ? localPreviewTitleForTarget(target, preview) : "";
  const previewAction = preview ? localPreviewActionForTarget(target, preview) : null;
  const previewResearch = preview ? localResearchRecordForSubdistrict(preview.subdistrictCode, activeResearchPeriod.period) : undefined;
  const featureModels = geo.features.map((feature) => ({
    feature,
    ...featureModel(feature),
  }));
  const focusedFeatureModels = featureModels.filter((model) =>
    activeSelectedSubdistrictCode
      ? model.subdistrictCode === activeSelectedSubdistrictCode
      : !focusDistrictCode || model.row?.district_code === focusDistrictCode,
  );
  const criteriaMatchedCount = focusedFeatureModels.filter((model) => model.matchesCriteria).length;
  const focusAreaCount = focusedFeatureModels.length;
  const localLabels = (() => {
    const candidates: MapLabelCandidate[] = [];

    if (target.valid && target.level === "province") {
      const districtGroups = new globalThis.Map<
        string,
        { districtTh: string; models: Array<(typeof featureModels)[number]> }
      >();

      featureModels.forEach((model) => {
        const districtCode = model.row?.district_code ?? districtCodeForFeature(model.feature);
        const districtTh = model.district?.nameTh ?? model.feature.properties.A_Name_T;
        const existing = districtGroups.get(districtCode);
        if (existing) {
          existing.models.push(model);
        } else {
          districtGroups.set(districtCode, { districtTh, models: [model] });
        }
      });

      districtGroups.forEach((group, districtCode) => {
        const visibleModels = group.models.filter((model) => !useResearchCriteriaMap || model.matchesCriteria);
        if (visibleModels.length === 0) return;

        const geometries = group.models.map((model) => model.feature.geometry);
        const point = projectedLabelPointForGeometries(geometries, projection);
        const priority = visibleModels.reduce(
          (highest, model) => Math.max(highest, localLabelPriorityForStatus(model.status)),
          0,
        );

        candidates.push({
          id: `district-${districtCode}`,
          text: group.districtTh,
          x: point.x,
          y: point.y,
          bounds: projectedBoundsForGeometries(geometries, projection),
          minZoom: 1.14,
          maxWidthRatio: 0.74,
          maxHeightRatio: 0.66,
          minFeatureArea: 2600,
          priority: priority + visibleModels.length * 0.3,
          className: "is-district-label",
        });
      });

      const highlightedSubdistrictCodes = new Set(
        [activeSelectedSubdistrictCode, selectedCode, preview?.subdistrictCode].filter(Boolean),
      );

      featureModels
        .filter((model) => highlightedSubdistrictCodes.has(model.subdistrictCode))
        .forEach((model) => {
          const point = projectedLabelPointForGeometry(model.feature.geometry, projection);
          candidates.push({
            id: `subdistrict-${model.subdistrictCode}`,
            text: model.subdistrict?.nameTh ?? model.feature.properties.T_Name_T,
            x: point.x,
            y: point.y,
            bounds: projectedBoundsForGeometries([model.feature.geometry], projection),
            minZoom: localFitZoom,
            maxWidthRatio: 0.88,
            maxHeightRatio: 0.74,
            minFeatureArea: 420,
            force: true,
            priority: 260 + localLabelPriorityForStatus(model.status),
            className: "is-subdistrict-label is-featured-label",
          });
        });
    } else {
      focusedFeatureModels.forEach((model) => {
        const isSelected = model.subdistrictCode === activeSelectedSubdistrictCode || model.subdistrictCode === selectedCode;
        const isPreviewed = model.subdistrictCode === preview?.subdistrictCode;
        const isCriteriaFiltered = useResearchCriteriaMap && !model.matchesCriteria;
        const isSubdistrictRoute = target.valid && target.level === "subdistrict";

        if (isCriteriaFiltered && !isSelected && !isPreviewed) return;

        const point = projectedLabelPointForGeometry(model.feature.geometry, projection);
        candidates.push({
          id: `subdistrict-${model.subdistrictCode}`,
          text: model.subdistrict?.nameTh ?? model.feature.properties.T_Name_T,
          x: point.x,
          y: point.y,
          bounds: projectedBoundsForGeometries([model.feature.geometry], projection),
          minZoom: isSubdistrictRoute ? 1.36 : 1.92,
          maxWidthRatio: isSubdistrictRoute ? 0.94 : 0.78,
          maxHeightRatio: 0.72,
          minFeatureArea: isSubdistrictRoute ? 420 : 1150,
          force: isSelected || isPreviewed || isSubdistrictRoute,
          priority: (isSelected ? 260 : 0) + (isPreviewed ? 240 : 0) + localLabelPriorityForStatus(model.status),
          className: [
            "is-subdistrict-label",
            isSelected ? "is-selected-label" : "",
            isPreviewed ? "is-previewed-label" : "",
          ]
            .filter(Boolean)
            .join(" "),
        });
      });
    }

    return makeVisibleMapLabels(candidates, transform, {
      viewportWidth: localMapWidth,
      viewportHeight: localMapHeight,
      baseScreenFontSize: 10.2,
      minScreenFontSize: 8.8,
      maxScreenFontSize: 12.1,
      zoomFontBoost: 0.62,
      haloStrokeWidth: 3,
      collisionPadding: 7,
    });
  })();

  const mapPanelClassName = [
    "nr-map-panel",
    isDragging ? "is-dragging" : "",
    preview?.mode === "touch" ? "has-touch-preview" : "",
    useResearchCriteriaMap ? "has-criteria-map" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={canvasRef} className={mapPanelClassName}>
      <div className="map-overlay-controls nr-map-controls" aria-label="เครื่องมือซูมแผนที่นครราชสีมา">
        <button type="button" className="icon-button" onClick={() => zoomFromPoint(localZoomStep)} disabled={transform.k >= localMaxZoom} title="ขยายแผนที่">
          <Plus size={16} />
        </button>
        <button type="button" className="icon-button" onClick={() => zoomFromPoint(-localZoomStep)} disabled={transform.k <= localMinZoom} title="ย่อแผนที่">
          <Minus size={16} />
        </button>
        <button type="button" className="icon-button" onClick={() => animateTransform(targetTransform)} title="กลับมุมมองพื้นที่นี้">
          <LocateFixed size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "ออกจากเต็มจอ" : "เปิดแผนที่เต็มจอ"}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      {useResearchCriteriaMap && (
        <div className="nr-local-map-criteria" aria-label="ตัวกรองแผนที่จังหวัดนครราชสีมา">
          <AppSelect
            className="nr-local-map-select"
            ariaLabel="เดือนข้อมูลบนแผนที่จังหวัดนครราชสีมา"
            value={selectedMonth}
            onChange={onMonthChange}
            options={monthOptions}
          />
          <AppSelect
            className="nr-local-map-select"
            ariaLabel="มุมมองสีแผนที่"
            value={criteria.viewMode}
            onChange={(viewMode) => setCriteria((current) => ({ ...current, viewMode: viewMode as LocalMapViewMode }))}
            options={localMapViewOptions}
          />
          <AppSelect
            className="nr-local-map-select"
            ariaLabel="ตัวกรองข้อมูลในระบบ"
            value={criteria.study}
            onChange={(study) => setCriteria((current) => ({ ...current, study: study as LocalStudyCriterion }))}
            options={localStudyCriterionOptions}
          />
          <AppSelect
            className="nr-local-map-select"
            ariaLabel="ตัวกรองระดับความเสี่ยง"
            value={criteria.risk}
            onChange={(risk) => setCriteria((current) => ({ ...current, risk: risk as LocalRiskCriterion }))}
            options={localRiskCriterionOptions}
          />
          <button
            type="button"
            className="nr-local-map-reset"
            onClick={() => setCriteria(criteriaDefaults)}
            disabled={!criteriaActive}
            title="ล้างเงื่อนไขแผนที่"
          >
            <RotateCcw size={14} />
            <span>รีเซ็ต</span>
          </button>
          <span className="nr-local-map-count">
            {formatThaiNumber(criteriaMatchedCount)}/{formatThaiNumber(focusAreaCount)} ตำบล
          </span>
        </div>
      )}
      <svg
        ref={svgRef}
        className="nr-map-svg"
        viewBox={`0 0 ${localMapWidth} ${localMapHeight}`}
        role="img"
        aria-label="แผนที่ตำบลจังหวัดนครราชสีมา"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          lastPointerType.current = event.pointerType;
          const pointerTarget = event.target as Element | null;
          if (event.pointerType === "touch" && !pointerTarget?.closest("[data-nr-subdistrict-code]")) {
            dismissPreview();
          }
          cancelWheelAnimation();
          if (animationFrame.current !== null) {
            window.cancelAnimationFrame(animationFrame.current);
            animationFrame.current = null;
          }
          const captureTarget = event.target as Element & { setPointerCapture?: (pointerId: number) => void };
          activePointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
          if (activePointers.current.size >= 2) {
            event.preventDefault();
            captureTarget.setPointerCapture?.(event.pointerId);
            startPinch();
            return;
          }
          const current = transformRef.current;
          dragStart.current = {
            x: event.clientX,
            y: event.clientY,
            tx: current.x,
            ty: current.y,
            k: current.k,
            moved: false,
          };
          if (event.pointerType === "touch") {
            if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
            touchPanReady.current = false;
            longPressTimer.current = window.setTimeout(() => {
              if (!dragStart.current || !activePointers.current.has(event.pointerId)) return;
              touchPanReady.current = true;
              setIsDragging(true);
              captureTarget.setPointerCapture?.(event.pointerId);
            }, 260);
          } else {
            touchPanReady.current = true;
            captureTarget.setPointerCapture?.(event.pointerId);
          }
        }}
        onPointerMove={(event) => {
          if (!dragStart.current && !pinchStart.current) return;
          if (activePointers.current.has(event.pointerId)) {
            activePointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
          }
          if (pinchStart.current) {
            event.preventDefault();
            updatePinch();
            return;
          }
          const start = dragStart.current;
          if (!start) return;
          if (event.pointerType === "touch" && !touchPanReady.current) {
            const movedX = Math.abs(event.clientX - start.x);
            const movedY = Math.abs(event.clientY - start.y);
            if (movedX > 8 || movedY > 8) {
              if (longPressTimer.current !== null) {
                window.clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
              dragStart.current = null;
              activePointers.current.delete(event.pointerId);
              if (movedX > 4 || movedY > 4) suppressClick.current = true;
            }
            return;
          }
          event.preventDefault();
          const delta = svgDeltaForClient(
            { clientX: start.x, clientY: start.y },
            event,
          );
          if (Math.abs(delta.x) > 2 || Math.abs(delta.y) > 2) {
            if (!start.moved) {
              start.moved = true;
              setIsDragging(true);
            }
            suppressClick.current = true;
          }
          setClampedTransform({
            x: start.tx + delta.x,
            y: start.ty + delta.y,
            k: start.k,
          });
        }}
        onPointerUp={(event) => {
          if (dragStart.current?.moved || pinchStart.current) event.preventDefault();
          activePointers.current.delete(event.pointerId);
          const captureTarget = event.target as Element & {
            hasPointerCapture?: (pointerId: number) => boolean;
            releasePointerCapture?: (pointerId: number) => void;
          };
          if (captureTarget.hasPointerCapture?.(event.pointerId)) captureTarget.releasePointerCapture?.(event.pointerId);
          if (activePointers.current.size >= 2) {
            startPinch();
          } else if (activePointers.current.size === 1 && pinchStart.current) {
            const [point] = activePointers.current.values();
            const current = transformRef.current;
            dragStart.current = {
              x: point.clientX,
              y: point.clientY,
              tx: current.x,
              ty: current.y,
              k: current.k,
              moved: false,
            };
            pinchStart.current = null;
          } else {
            finishDrag();
          }
          window.setTimeout(() => {
            suppressClick.current = false;
          }, 0);
        }}
        onPointerCancel={(event) => {
          activePointers.current.delete(event.pointerId);
          finishDrag();
        }}
        onLostPointerCapture={(event) => {
          activePointers.current.delete(event.pointerId);
          if (activePointers.current.size === 0) finishDrag();
        }}
        onDragStart={(event) => {
          event.preventDefault();
        }}
      >
        <rect width={localMapWidth} height={localMapHeight} className="nr-map-water" />
        <g className="nr-map-transform-layer" transform={`matrix(${transform.k} 0 0 ${transform.k} ${transform.x} ${transform.y})`}>
          {provinceContextFeatures.length > 0 && (
            <g className="nr-map-neighbor-province-layer" aria-hidden="true">
              {provinceContextFeatures.map((feature) => (
                <path
                  key={`${feature.properties.shapeISO}-${feature.properties.shapeName}`}
                  d={pathForGeometry(feature.geometry, projection)}
                />
              ))}
            </g>
          )}
          <g className="nr-map-context-layer" aria-hidden="true">
            {geo.features.map((feature) => (
              <path
                key={`${feature.properties.Admin_code}-context`}
                d={pathForFeature(feature, projection)}
                className={focusDistrictCode && districtCodeForFeature(feature) === focusDistrictCode ? "is-context-focus" : undefined}
              />
            ))}
          </g>
          {featureModels.map((model) => {
            const { feature, row, status, subdistrictCode } = model;
            const isInRouteScope = activeSelectedSubdistrictCode
              ? subdistrictCode === activeSelectedSubdistrictCode
              : !focusDistrictCode || row?.district_code === focusDistrictCode;
            const isSelected = activeSelectedSubdistrictCode === subdistrictCode;
            const isCriteriaFiltered = useResearchCriteriaMap && (!isInRouteScope || !model.matchesCriteria);
            return (
              <path
                key={subdistrictCode}
                data-nr-subdistrict-code={subdistrictCode}
                d={pathForFeature(feature, projection)}
                className={[
                  "nr-map-shape",
                  `is-${status}`,
                  isInRouteScope ? "in-focus" : "out-of-focus",
                  isSelected || selectedCode === subdistrictCode ? "is-selected" : "",
                  isCriteriaFiltered ? "is-criteria-filtered" : "",
                ].join(" ")}
                role="button"
                tabIndex={isCriteriaFiltered ? -1 : 0}
                aria-disabled={isCriteriaFiltered || undefined}
                aria-label={`${feature.properties.T_Name_T} ${feature.properties.A_Name_T} ${coverageLabel(status, mapMode)}${isCriteriaFiltered ? " ไม่ตรงเงื่อนไขที่เลือก" : ""}`}
                onPointerEnter={(event) => {
                  if (!isCriteriaFiltered && event.pointerType !== "touch") showSubdistrictPreview(feature, event, "hover");
                }}
                onPointerMove={(event) => {
                  if (!isCriteriaFiltered && event.pointerType !== "touch" && preview?.mode === "hover") showSubdistrictPreview(feature, event, "hover");
                }}
                onFocus={() => {
                  if (isCriteriaFiltered) return;
                  if (lastPointerType.current === "touch") return;
                  const rect = canvasRef.current?.getBoundingClientRect();
                  showSubdistrictPreview(
                    feature,
                    { clientX: (rect?.left ?? 0) + 24, clientY: (rect?.top ?? 0) + 24 },
                    "hover",
                  );
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== "touch") schedulePreviewDismiss();
                }}
                onBlur={schedulePreviewDismiss}
                onClick={(event) => {
                  if (isCriteriaFiltered) {
                    event.preventDefault();
                    return;
                  }
                  if (suppressClick.current) {
                    event.preventDefault();
                    suppressClick.current = false;
                    return;
                  }
                  if (lastPointerType.current === "touch") {
                    event.preventDefault();
                    showSubdistrictPreview(feature, event, "touch");
                    focusFeature(feature);
                    (event.currentTarget as SVGElement & { blur?: () => void }).blur?.();
                    return;
                  }
                  showSubdistrictPreview(feature, event, "selected");
                  focusFeature(feature);
                  (event.currentTarget as SVGElement & { blur?: () => void }).blur?.();
                }}
                onKeyDown={(event) => {
                  if (isCriteriaFiltered) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    focusFeature(feature);
                  }
                }}
              >
                <title>{`${feature.properties.T_Name_T} / ${feature.properties.A_Name_T} / ${coverageLabel(status, mapMode)}`}</title>
              </path>
            );
          })}
          {previewedFeature && (
            <g className="nr-map-preview-halo" aria-hidden="true">
              <path d={pathForFeature(previewedFeature, projection)} />
            </g>
          )}
          {selectedFeature && (
            <g className="nr-map-selection-halo" aria-hidden="true">
              <path className="nr-map-selection-halo-outer" d={pathForFeature(selectedFeature, projection)} />
              <path className="nr-map-selection-halo-inner" d={pathForFeature(selectedFeature, projection)} />
            </g>
          )}
          {localLabels.length > 0 && (
            <g className="map-label-layer nr-map-label-layer" aria-hidden="true">
              {localLabels.map((label) => (
                <text
                  key={label.id}
                  className={["map-label", label.className].filter(Boolean).join(" ")}
                  x={label.x}
                  y={label.y}
                  fontSize={label.fontSize}
                  strokeWidth={label.strokeWidth}
                >
                  {label.text}
                </text>
              ))}
            </g>
          )}
        </g>
      </svg>
      {preview && (
        <article
          className={`map-preview-card nr-map-preview-card is-${preview.mode}`}
          style={preview.mode !== "touch" ? { left: `${preview.x}px`, top: `${preview.y}px` } : undefined}
          role="dialog"
          aria-label={`ข้อมูลย่อพื้นที่${previewTitle}`}
          onMouseEnter={cancelPreviewDismiss}
          onMouseLeave={schedulePreviewDismiss}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header>
            <strong>{previewTitle}</strong>
            <span className={`severity-pill ${localStatusPillTone(preview.status)}`}>{coverageLabel(preview.status, mapMode)}</span>
          </header>
          <dl>
            {target.valid && target.level === "province" && (
              <div>
                <dt>ตำบลที่ชี้</dt>
                <dd>{preview.subdistrictTh}</dd>
              </div>
            )}
            <div>
              <dt>อำเภอ</dt>
              <dd>{preview.districtTh}</dd>
            </div>
            <div>
              <dt>รหัสตำบล</dt>
              <dd>{preview.subdistrictCode}</dd>
            </div>
            <div>
              <dt>สถานะข้อมูล</dt>
              <dd>{coverageLabel(preview.status, mapMode)}</dd>
            </div>
            {previewResearch && (
              <div>
                <dt>เดือนข้อมูล</dt>
                <dd>
                  {formatMonth(previewResearch.period, "th")}
                  {activeResearchPeriod.isFallback ? " · ใช้เดือนล่าสุดจากชุดข้อมูลแทน" : ""}
                </dd>
              </div>
            )}
            {previewResearch && (
              <div>
                <dt>ภัยแล้ง</dt>
                <dd>{previewResearch.droughtRiskLabelTh}</dd>
              </div>
            )}
            <div>
              <dt>ใช้กับการคาดการณ์</dt>
              <dd>{predictionUseForStatus(preview.status)}</dd>
            </div>
          </dl>
          {previewAction ? (
            <button
              type="button"
              className="map-preview-action"
              onClick={() => {
                dismissPreview();
                onNavigate(previewAction.path);
              }}
            >
              {previewAction.label}
            </button>
          ) : (
            <p className="map-preview-note">ยังไม่มีข้อมูลพอให้เปิดรายละเอียดระดับตำบล</p>
          )}
        </article>
      )}
      <div className="nr-map-legend" aria-label="คำอธิบายแผนที่จังหวัดนครราชสีมา">
        {useResearchCriteriaMap ? (
          <strong>
            {localMapViewOptions.find((option) => option.value === criteria.viewMode)?.label} {formatMonth(activeResearchPeriod.period, "th")}
          </strong>
        ) : (
          <>
            {provinceMapTab === "drought" && <strong>ภัยแล้ง {researchLatestPeriod(researchSummary)}</strong>}
          </>
        )}
        {(useResearchCriteriaMap ? localMapLegendStatusesForView(criteria.viewMode) : legendStatusesForContext(layer.id, provinceMapTab)).map((status) => (
          <span key={status}>
            <i className={`is-${status}`} />
            {coverageLabel(status, mapMode)}
          </span>
        ))}
        {useResearchCriteriaMap && (
          <>
            {criteriaActive && <strong>{localMapCriteriaSummaryLabel(criteria)}</strong>}
            {activeResearchPeriod.isFallback && <span>เดือนที่เลือกไม่มีในชุดข้อมูล จึงใช้เดือนล่าสุดของชุดข้อมูลแทน</span>}
          </>
        )}
      </div>
      {onMapModeChange && !useResearchCriteriaMap && (
        <div className="nr-map-bottom-modes" aria-label="เลือกมุมมองข้อมูลบนแผนที่">
          {localMapModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={mapMode === mode.id ? "active" : ""}
              onClick={() => onMapModeChange(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NakhonRatchasimaBreadcrumbs({
  target,
  onNavigate,
}: {
  target: NakhonRatchasimaRouteTarget;
  onNavigate: (path: string) => void;
}) {
  if (!target.valid) return null;
  const activeProvinceTab = target.level === "province" ? provinceDashboardTabs.find((tab) => tab.id === target.tab) : undefined;
  return (
    <nav className="nr-breadcrumbs" aria-label="เส้นทางพื้นที่">
      <button type="button" onClick={() => onNavigate(NAKHON_RATCHASIMA_ROUTE_BASE)}>
        จังหวัดนครราชสีมา
      </button>
      {target.level === "province" && activeProvinceTab && activeProvinceTab.id !== "overview" && (
        <>
          <span>/</span>
          <strong>{activeProvinceTab.label}</strong>
        </>
      )}
      {target.level !== "province" && (
        <>
          <span>/</span>
          <button type="button" onClick={() => onNavigate(getNakhonRatchasimaPath(target.district))}>
            {target.district.nameTh}
          </button>
        </>
      )}
      {target.level === "subdistrict" && (
        <>
          <span>/</span>
          <strong>{target.subdistrict.nameTh}</strong>
        </>
      )}
    </nav>
  );
}

function routeBackTargetForRoute(route: NakhonRatchasimaRouteTarget) {
  if (!route.valid) {
    return { label: "กลับภาพรวม", path: NAKHON_RATCHASIMA_ROUTE_BASE };
  }
  if (route.level === "province" && route.tab !== "overview") {
    return { label: "กลับภาพรวมจังหวัด", path: NAKHON_RATCHASIMA_ROUTE_BASE };
  }
  if (route.level === "province") {
    return null;
  }
  if (route.level === "district") {
    return { label: "กลับจังหวัด", path: NAKHON_RATCHASIMA_ROUTE_BASE };
  }
  return { label: "กลับอำเภอ", path: getNakhonRatchasimaPath(route.district) };
}

function NakhonRatchasimaLayerInspector({ layer }: { layer: NakhonRatchasimaMapLayer }) {
  return (
    <section className="nr-inspector">
      <div>
        <p className="eyebrow">{translateClassification(layer.classification)} · {translateAccess(layer.access)}</p>
        <h3>{layer.labelTh}</h3>
        <p>{translateStatus(layer.status)}</p>
      </div>
      <dl className="nr-compact-list">
        <div>
          <dt>การเชื่อมข้อมูล</dt>
          <dd>ใช้รหัสพื้นที่ ไม่ใช้ชื่อหรือที่อยู่เว็บ</dd>
        </div>
        <div>
          <dt>เมื่อไม่มีข้อมูล</dt>
          <dd>{translateLayerNoData(layer.noData)}</dd>
        </div>
      </dl>
    </section>
  );
}

function ProvinceView({
  activeTab,
  layer,
  mapMode,
  onMapModeChange,
  onLayerChange,
  onNavigate,
  selectedMonth,
  monthOptions,
  onMonthChange,
}: {
  activeTab: ProvinceDashboardTab;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onLayerChange: (layerId: string) => void;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
}) {
  const state = useAppState();
  const [selectedMapSubdistrictCode, setSelectedMapSubdistrictCode] = useState<string | null>(null);
  const droughtForecast = getNakhonRatchasimaThaiWaterDroughtForecast();
  const researchSummary = getNakhonRatchasimaResearchPanelSummary();
  const provinceRecord =
    getProvinceRecord(NAKHON_RATCHASIMA_ID, selectedMonth) ?? getProvinceRecord(NAKHON_RATCHASIMA_ID, state.selectedMonth);

  const applyDashboardMode = (tab: ProvinceDashboardTab) => {
    const nextDefaults = dashboardDefaultsForTab(tab);
    onLayerChange(nextDefaults.layerId);
    onMapModeChange(nextDefaults.mapMode);
  };

  const selectDashboardTab = (tab: ProvinceDashboardTab) => {
    applyDashboardMode(tab);
    onNavigate(getNakhonRatchasimaProvinceTabPath(tab));
  };

  const openPredictionReadinessMap = () => {
    onLayerChange(NAKHON_RATCHASIMA_LAYER_IDS.derivedAgriculturalRisk);
    onMapModeChange("prediction-readiness");
    if (activeTab !== "overview") {
      onNavigate(getNakhonRatchasimaProvinceTabPath("overview"));
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.querySelector(".nr-dashboard-map-card")?.scrollIntoView({
          block: "center",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      });
    });
  };

  return (
    <>
      <ProvinceDashboardHeading research={researchSummary} />
      <ProvinceDashboardTabBar activeTab={activeTab} onChange={selectDashboardTab} />
      {activeTab === "overview" ? (
        <ProvinceSituationCards provinceRecord={provinceRecord} />
      ) : (
        <SourceTruthNote
          research={researchSummary}
          droughtForecast={droughtForecast}
        />
      )}

      {activeTab === "overview" ? (
        <>
          <section className={`nr-dashboard-layout is-${activeTab}`}>
            <div className="nr-dashboard-main">
              <ProvinceDashboardMapCard
                activeTab={activeTab}
                layer={layer}
                mapMode={mapMode}
                onMapModeChange={onMapModeChange}
                onNavigate={onNavigate}
                selectedMonth={selectedMonth}
                monthOptions={monthOptions}
                onMonthChange={onMonthChange}
                selectedSubdistrictCode={selectedMapSubdistrictCode}
                onSelectedSubdistrictChange={setSelectedMapSubdistrictCode}
              />
              <AgricultureImpactPanel provinceRecord={provinceRecord} />
            </div>
            <aside className="nr-dashboard-aside">
              <AgriculturalRiskContextPanel provinceRecord={provinceRecord} />
            </aside>
          </section>

          <ContentSection
            className="nr-data-readiness-section"
            eyebrow="ความพร้อมข้อมูล"
            title="ก่อนใช้ข้อมูลเพื่อคาดการณ์หรือตัดสินใจ"
            description="ส่วนนี้บอกว่าข้อมูลระดับพื้นที่พร้อมแค่ไหน และอะไรยังไม่ควรถูกตีความเป็นระดับความเสี่ยง"
          >
            <div className="nr-data-readiness-stack">
              <PredictionReadinessPanel month={formatMonth(selectedMonth, "th")} onOpenMap={openPredictionReadinessMap} />
            </div>
          </ContentSection>
        </>
      ) : (
        <ResearchProvinceDataView
          activeTab={activeTab}
          layer={layer}
          mapMode={mapMode}
          onMapModeChange={onMapModeChange}
          onNavigate={onNavigate}
          research={researchSummary}
          droughtForecast={droughtForecast}
          selectedMonth={selectedMonth}
          monthOptions={monthOptions}
          onMonthChange={onMonthChange}
          selectedSubdistrictCode={selectedMapSubdistrictCode}
          onSelectedSubdistrictChange={setSelectedMapSubdistrictCode}
        />
      )}
    </>
  );
}

function DistrictView({
  district,
  layer,
  mapMode,
  onMapModeChange,
  onNavigate,
  selectedMonth,
  monthOptions,
  onMonthChange,
}: {
  district: NakhonRatchasimaDistrict;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
}) {
  const research = getNakhonRatchasimaResearchPanelSummary();
  const activeResearchPeriod = localResearchPeriodForSelectedMonth(selectedMonth, research);
  const activeRecords = researchRecordsForSubdistrictCodes(
    district.subdistricts.map((subdistrict) => subdistrict.subdistrictCode),
    activeResearchPeriod.period,
  );
  const stats = summarizeResearchAreaRecords(activeRecords, district.subdistricts.length);
  const monthlySeries = researchMonthlySeriesForDistrict(district, activeResearchPeriod.period);
  const evidence = getNakhonRatchasimaEvidenceForLocation({ districtCode: district.districtCode });
  const droughtForecast = getNakhonRatchasimaThaiWaterDroughtForecast();

  return (
    <>
      <ResearchAreaHeading district={district} activePeriod={activeResearchPeriod} stats={stats} />

      <section className="nr-dashboard-layout nr-area-dashboard is-district">
        <div className="nr-dashboard-main">
          <ResearchAreaForecastPanel
            district={district}
            droughtForecast={droughtForecast}
          />
          <ResearchAreaSituationPanel district={district} stats={stats} activePeriod={activeResearchPeriod} />
          <ResearchAreaMapSection
            target={{ valid: true, level: "district", district }}
            layer={layer}
            mapMode={mapMode}
            onMapModeChange={onMapModeChange}
            onNavigate={onNavigate}
            selectedMonth={selectedMonth}
            monthOptions={monthOptions}
            onMonthChange={onMonthChange}
          />
          <div className="nr-dashboard-module-grid">
            <ResearchAreaDroughtHistoryPanel title="สถานะภัยแล้งรายเดือนของอำเภอ" series={monthlySeries} />
          </div>
          <ResearchAreaSubdistrictsPanel district={district} period={activeResearchPeriod.period} onNavigate={onNavigate} />
        </div>
        <aside className="nr-dashboard-aside">
          <ResearchAreaAttentionPanel district={district} period={activeResearchPeriod.period} onNavigate={onNavigate} />
          <DashboardSection
            eyebrow="ข้อมูลที่ยังไม่มี"
            title="ช่องว่างของพื้นที่"
            description="ถ้าชุดข้อมูลไม่มีรายการหรือยังไม่ระบุสถานะ ระบบจะแสดงเป็นไม่มีข้อมูล ไม่เติมค่าจำลอง"
            provenance={stats.missingCount > 0 ? "PENDING_SOURCE" : "REAL"}
            className="nr-area-side-section"
          >
            <ResearchStatGrid>
              <MetricCard label="ตำบลไม่มีรายการข้อมูล" value={`${formatThaiNumber(stats.missingCount)} ตำบล`} provenance={stats.missingCount > 0 ? "PENDING_SOURCE" : "REAL"} />
            </ResearchStatGrid>
          </DashboardSection>
        </aside>
      </section>
      <ResearchAreaSourceLimitsPanel
        district={district}
        stats={stats}
        directRecords={evidence.direct}
        inheritedRecords={evidence.inherited}
      />
    </>
  );
}

function SubdistrictView({
  district,
  subdistrict,
  layer,
  mapMode,
  onMapModeChange,
  onNavigate,
  selectedMonth,
  monthOptions,
  onMonthChange,
}: {
  district: NakhonRatchasimaDistrict;
  subdistrict: NakhonRatchasimaSubdistrict;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
}) {
  const research = getNakhonRatchasimaResearchPanelSummary();
  const activeResearchPeriod = localResearchPeriodForSelectedMonth(selectedMonth, research);
  const researchRecord = getNakhonRatchasimaResearchSubdistrictMonth(subdistrict.subdistrictCode, activeResearchPeriod.period);
  const stats = summarizeResearchAreaRecords(researchRecord ? [researchRecord] : [], 1);
  const monthlySeries = researchMonthlySeriesForSubdistrict(subdistrict.subdistrictCode, activeResearchPeriod.period);
  const evidence = getNakhonRatchasimaEvidenceForLocation({
    districtCode: district.districtCode,
    subdistrictCode: subdistrict.subdistrictCode,
  });
  const droughtForecast = getNakhonRatchasimaThaiWaterDroughtForecast();

  return (
    <>
      <ResearchAreaHeading district={district} subdistrict={subdistrict} activePeriod={activeResearchPeriod} stats={stats} />

      <section className="nr-dashboard-layout nr-area-dashboard is-subdistrict">
        <div className="nr-dashboard-main">
          <ResearchAreaForecastPanel
            district={district}
            subdistrict={subdistrict}
            droughtForecast={droughtForecast}
          />
          <ResearchAreaSituationPanel
            district={district}
            subdistrict={subdistrict}
            stats={stats}
            activePeriod={activeResearchPeriod}
          />
          <ResearchAreaMapSection
            target={{ valid: true, level: "subdistrict", district, subdistrict }}
            layer={layer}
            mapMode={mapMode}
            onMapModeChange={onMapModeChange}
            onNavigate={onNavigate}
            selectedMonth={selectedMonth}
            monthOptions={monthOptions}
            onMonthChange={onMonthChange}
          />
          <div className="nr-dashboard-module-grid">
            <ResearchAreaDroughtHistoryPanel title="สถานะภัยแล้งรายเดือนของตำบล" series={monthlySeries} isSubdistrict />
          </div>
        </div>
        <aside className="nr-dashboard-aside">
          <ResearchSubdistrictProfilePanel district={district} subdistrict={subdistrict} record={researchRecord} />
          <DashboardSection
            eyebrow="ข้อมูลที่ยังไม่มี"
            title="ช่องว่างของตำบล"
            description="ค่าที่ไม่มีในชุดข้อมูลจะแสดงเป็นไม่มีข้อมูล ไม่ใช้สถานีหรือหลักฐานเก่าแทนตัวเลขหลัก"
            provenance={stats.recordCount > 0 ? "REAL" : "PENDING_SOURCE"}
            className="nr-area-side-section"
          >
            <ResearchStatGrid>
              <MetricCard label="รายการข้อมูลรายเดือน" value={stats.recordCount > 0 ? "มีข้อมูล" : "ไม่มีข้อมูล"} provenance={stats.recordCount > 0 ? "REAL" : "PENDING_SOURCE"} />
              <MetricCard label="รายการตรวจซ้ำ" value={stats.droughtConflictKeys > 0 ? "พบรายการ" : "ไม่พบ"} provenance={stats.droughtConflictKeys > 0 ? "DERIVED" : "REAL"} tone={stats.droughtConflictKeys > 0 ? "watch" : "good"} />
            </ResearchStatGrid>
          </DashboardSection>
        </aside>
      </section>
      <ResearchAreaSourceLimitsPanel
        district={district}
        subdistrict={subdistrict}
        stats={stats}
        directRecords={evidence.direct}
        inheritedRecords={evidence.inherited}
      />
    </>
  );
}

function SourceDecisionFootnotes() {
  const provinceEvidence = getNakhonRatchasimaEvidenceForLocation({}).direct.slice(0, 4);
  const sections: AuditTrailSection[] = [
    {
      id: "decision-evidence",
      title: "หลักฐานที่เกี่ยวข้องกับการตัดสินใจ",
      columns: 4,
      items: provinceEvidence.map((record) => ({
        id: record.id,
        provenance: record.provenance,
        eyebrow: sourceAgencyFor(record),
        title: evidenceTitle(record),
        body: translateScope(record.geography.scope),
      })),
    },
  ];

  return <AuditTrailFootnotes sections={sections} />;
}

function SourceFreshness() {
  const sourceRows = getNakhonRatchasimaSourceRows().filter((row) =>
    [
      "SRC-GISTDA-ADMIN-BOUNDARY",
      "SRC-DOAE-FARMER-REGISTRATION",
      "SRC-DOAE-SOENGSANG-20260820",
      "SRC-OPSMOAC-NAKHON-RATCHASIMA-SITUATION",
    ].includes(row.source_id),
  );

  return (
    <section className="nr-panel nr-source-readiness">
      <details className="nr-source-disclosure">
        <summary>
          <span className="nr-source-summary-title">
            <span className="panel-icon" aria-hidden="true">
              <Database size={18} />
            </span>
            <span>
              <strong>ที่มา ความสด และข้อจำกัดของข้อมูล</strong>
              <small>{sourceRows.length} แหล่งข้อมูลหลัก เปิดดูรายละเอียดเทคนิคเมื่อต้องตรวจสอบ</small>
            </span>
          </span>
          <span className="nr-source-summary-action" aria-hidden="true" />
        </summary>
        <p className="provenance-note">
          ตารางนี้แสดงว่าแต่ละแหล่งใช้ทำอะไรและมีข้อจำกัดอะไร รายละเอียดเทคนิคยังเปิดดูได้ แต่ไม่ดันออกมาเป็นการ์ดยาวบนหน้าหลัก
        </p>
        <SourceDecisionFootnotes />
        <div className="nr-source-table-wrap">
          <table className="nr-source-table">
            <thead>
              <tr>
                <th>ชุดข้อมูล</th>
                <th>ใช้สำหรับ</th>
                <th>สถานะ</th>
                <th>รอบข้อมูล</th>
                <th>ข้อจำกัด</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.map((row) => (
                <tr key={row.source_id}>
                  <td className="nr-source-dataset-cell">
                    <DataProvenanceChip kind="REAL" />
                    <strong>{row.source_agency}</strong>
                    <span>{translateFactValue(row.dataset_system_name)}</span>
                  </td>
                  <td>{translateSpatialGranularity(row.spatial_granularity)}</td>
                  <td>
                    <span className="nr-inline-status">{translateAccess(row.access_classification)}</span>
                  </td>
                  <td>{translateFactValue(row.temporal_granularity || row.update_cadence || "ต้องตรวจสอบ")}</td>
                  <td>
                    <details>
                      <summary>{translateSourceLimitation(row.limitation)}</summary>
                      <dl className="nr-source-detail-list">
                        <div>
                          <dt>ชื่อชุดข้อมูล</dt>
                          <dd>{translateFactValue(row.dataset_system_name)}</dd>
                        </div>
                        <div>
                          <dt>วิธีเข้าถึง</dt>
                          <dd>{translateFactValue(row.access_method)}</dd>
                        </div>
                        <div>
                          <dt>กุญแจเชื่อมข้อมูล</dt>
                          <dd>{translateFactValue(row.geographic_join_keys)}</dd>
                        </div>
                        <div>
                          <dt>ลิงก์ต้นทาง</dt>
                          <dd>{row.source_url}</dd>
                        </div>
                      </dl>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="panel-header">
      <span>{icon}</span>
      <h2>{title}</h2>
    </div>
  );
}

export function NakhonRatchasimaWorkspace({
  route,
  onNavigate,
}: {
  route: NakhonRatchasimaRouteTarget;
  onNavigate: (path: string) => void;
}) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const layers = getNakhonRatchasimaMapLayers();
  const visibleLayers = useMemo(
    () => layers.filter((layer) => !hiddenLocalHydrologyLayerIds.has(layer.id)),
    [layers],
  );
  const hasScopedDataGovernanceSection =
    route.valid && (route.level === "district" || route.level === "subdistrict" || (route.level === "province" && route.tab === "drought"));
  const researchPeriods = useMemo(() => getNakhonRatchasimaResearchPeriods(), []);
  const [workspaceMonth, setWorkspaceMonth] = useState(() =>
    researchPeriods.includes(state.selectedMonth) ? state.selectedMonth : researchPeriods[researchPeriods.length - 1],
  );
  const researchMonthOptions = useMemo(() => {
    const periods = researchPeriods.slice().reverse();
    const options = periods.map((period) => ({
      value: period,
      label: formatMonth(period, "th"),
      group: period.slice(0, 4),
    }));
    if (periods.includes(workspaceMonth)) return options;
    return [
      {
        value: workspaceMonth,
        label: `${formatMonth(workspaceMonth, "th")} · นอกชุดข้อมูล`,
        group: "เดือนที่เลือกอยู่",
        badge: "ใช้เดือนล่าสุดแทน",
        badgeTone: "watch" as const,
      },
      ...options,
    ];
  }, [researchPeriods, workspaceMonth]);
  const handleWorkspaceMonthChange = (month: string) => {
    setWorkspaceMonth(month);
    dispatch({ type: "setMonth", month });
  };
  const initialDashboardDefaults =
    route.valid && route.level === "province"
      ? dashboardDefaultsForTab(route.tab)
      : {
          layerId: NAKHON_RATCHASIMA_LAYER_IDS.derivedAgriculturalRisk,
          mapMode: "prediction-readiness" as LocalMapMode,
        };
  const [selectedLayerId, setSelectedLayerId] = useState(initialDashboardDefaults.layerId);
  const [mapMode, setMapMode] = useState<LocalMapMode>(initialDashboardDefaults.mapMode);
  const selectedLayer = visibleLayers.find((layer) => layer.id === selectedLayerId) ?? visibleLayers[0] ?? layers[0];

  const provinceRouteTab = route.valid && route.level === "province" ? route.tab : null;
  useEffect(() => {
    if (!provinceRouteTab) return;
    const nextDefaults = dashboardDefaultsForTab(provinceRouteTab);
    setSelectedLayerId(nextDefaults.layerId);
    setMapMode(nextDefaults.mapMode);
  }, [provinceRouteTab]);

  const selectDistrictFromFilter = (districtCode: string) => {
    const path = pathForDistrictCode(districtCode);
    if (path) onNavigate(path);
  };
  const selectSubdistrictFromFilter = (subdistrictCode: string) => {
    const path = pathForSubdistrictCode(subdistrictCode);
    if (path) onNavigate(path);
  };
  const areaFilterConfig =
    !route.valid || route.level === "subdistrict"
      ? null
      : route.level === "province"
        ? {
            label: "อำเภอ",
            value: "",
            options: districtOptionsForProvince(),
            placeholder: "เลือกอำเภอ",
            onChange: selectDistrictFromFilter,
          }
        : {
            label: "ตำบล",
            value: "",
            options: subdistrictOptionsForRoute(route, selectedLayer, mapMode),
            placeholder: "เลือกตำบลในอำเภอนี้",
            onChange: selectSubdistrictFromFilter,
          };
  const routeBackTarget = routeBackTargetForRoute(route);
  const handleRouteBack = () => {
    if (routeBackTarget) onNavigate(routeBackTarget.path);
  };

  if (!route.valid) {
    return (
      <div className="page-stack nr-workspace">
        <section className="nr-panel">
          <PanelTitle icon={<AlertTriangle size={18} />} title="ไม่พบพื้นที่" />
          <p>ที่อยู่เว็บนี้ไม่ตรงกับอำเภอหรือตำบลในจังหวัดนครราชสีมา กรุณากลับไปภาพรวมจังหวัด</p>
          <button type="button" className="primary-button" onClick={() => onNavigate(NAKHON_RATCHASIMA_ROUTE_BASE)}>
            กลับภาพรวม
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack nr-workspace">
      <section className="nr-route-bar">
        {routeBackTarget && (
          <div className="nr-route-actions">
            <button type="button" className="secondary-button" onClick={handleRouteBack}>
              <ArrowLeft size={16} />
              {routeBackTarget.label}
            </button>
          </div>
        )}
        <NakhonRatchasimaBreadcrumbs target={route} onNavigate={onNavigate} />
      </section>

      <OperationalFilters
        monthOptions={route.valid ? researchMonthOptions : undefined}
        monthValue={route.valid ? workspaceMonth : undefined}
        onMonthChange={route.valid ? handleWorkspaceMonthChange : undefined}
        areaLabel={areaFilterConfig?.label}
        areaValue={areaFilterConfig?.value}
        areaOptions={areaFilterConfig?.options}
        areaPlaceholder={areaFilterConfig?.placeholder}
        onAreaChange={areaFilterConfig?.onChange}
        ariaLabel="ตัวกรองข้อมูลพื้นที่นครราชสีมา"
      />

      {route.level === "province" && (
        <ProvinceView
          activeTab={route.tab}
          layer={selectedLayer}
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          onLayerChange={setSelectedLayerId}
          onNavigate={onNavigate}
          selectedMonth={workspaceMonth}
          monthOptions={researchMonthOptions}
          onMonthChange={handleWorkspaceMonthChange}
        />
      )}
      {route.level === "district" && (
        <DistrictView
          district={route.district}
          layer={selectedLayer}
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          onNavigate={onNavigate}
          selectedMonth={workspaceMonth}
          monthOptions={researchMonthOptions}
          onMonthChange={handleWorkspaceMonthChange}
        />
      )}
      {route.level === "subdistrict" && (
        <SubdistrictView
          district={route.district}
          subdistrict={route.subdistrict}
          layer={selectedLayer}
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          onNavigate={onNavigate}
          selectedMonth={workspaceMonth}
          monthOptions={researchMonthOptions}
          onMonthChange={handleWorkspaceMonthChange}
        />
      )}

      {!hasScopedDataGovernanceSection && <SourceFreshness />}

      {!hasScopedDataGovernanceSection && <DataGovernanceGuardrailAccordion />}
    </div>
  );
}
