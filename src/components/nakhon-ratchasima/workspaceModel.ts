import {
  type NakhonRatchasimaProvinceTab,
  NAKHON_RATCHASIMA_LAYER_IDS,
  getNakhonRatchasimaResearchPeriods,
  getNakhonRatchasimaResearchSubdistrictMonth,
  getNakhonRatchasimaResearchSubdistrictLatest,
  type NakhonRatchasimaRouteTarget,
  getNakhonRatchasimaLocalSubsetForSubdistrict,
  getNakhonRatchasimaDistrictEvidence,
  summarizeNakhonRatchasimaDistrict,
  getNakhonRatchasimaDistricts,
  getNakhonRatchasimaMatrixRowsForDistrict,
  getNakhonRatchasimaDistrictByCode,
  getNakhonRatchasimaPath,
  getNakhonRatchasimaMatrixRowBySubdistrictCode,
  formatRai,
  getNakhonRatchasimaSourceRows,
  NAKHON_RATCHASIMA_ROUTE_BASE,
} from "../../domain";
import { sharedMapButtonZoomStep, isMapTransformEffectivelyEqual } from "../../mapInteraction";
import { useState, useEffect, type ReactNode } from "react";
import { type AppSelectOption } from "../AppSelect";
import {
  type NakhonRatchasimaResearchMonthlySubdistrictRecord,
  type NakhonRatchasimaResearchSubdistrictLatest,
  type NakhonRatchasimaResearchPanelSummary,
  type NakhonRatchasimaResearchDistrictLatest,
  type NakhonRatchasimaMatrixRow,
  type NakhonRatchasimaMapLayer,
  type NakhonRatchasimaDistrict,
  type NakhonRatchasimaEvidenceRecord,
} from "../../types";
import { formatMonth } from "../../i18n";

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
  | "admin"
  | "local-evidence"
  | "source-capability"
  | "district-evidence"
  | "research-drought-normal"
  | "research-drought-watch"
  | "research-drought-severe"
  | "research-study-ready"
  | "research-study-missing"
  | "forecast-no-risk"
  | "forecast-moderate"
  | "forecast-high"
  | "forecast-out-of-scope"
  | "forecast-missing"
  | "insufficient"
  | "no-data";

export type LocalMapMode = "prediction-readiness" | "evidence-coverage" | "source-readiness";

export type ProvinceDashboardTab = NakhonRatchasimaProvinceTab;

export type LocalMapViewMode = "risk" | "study";

export type LocalStudyCriterion = "all" | "studied" | "unstudied";

export type LocalRiskCriterion =
  | "all"
  | "green"
  | "yellow"
  | "red"
  | "forecast-no-risk"
  | "forecast-moderate"
  | "forecast-high"
  | "forecast-out-of-scope"
  | "forecast-missing";

export type LocalMapCriteria = {
  viewMode: LocalMapViewMode;
  study: LocalStudyCriterion;
  risk: LocalRiskCriterion;
};

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

export const hiddenLocalHydrologyLayerIds = new Set<string>([
  NAKHON_RATCHASIMA_LAYER_IDS.floodExtent,
  NAKHON_RATCHASIMA_LAYER_IDS.dwrEws,
  NAKHON_RATCHASIMA_LAYER_IDS.reservoirs,
  NAKHON_RATCHASIMA_LAYER_IDS.weatherContext,
  NAKHON_RATCHASIMA_LAYER_IDS.rainfallStations,
]);

export function provinceDashboardTabLabel(tab: ProvinceDashboardTab) {
  return tab === "drought" ? "ภัยแล้ง" : "ภาพรวม";
}

export function dashboardDefaultsForTab(tab: ProvinceDashboardTab): { layerId: string; mapMode: LocalMapMode } {
  if (tab === "drought") {
    return {
      layerId: NAKHON_RATCHASIMA_LAYER_IDS.drought,
      mapMode: "prediction-readiness",
    };
  }
  return {
    layerId: NAKHON_RATCHASIMA_LAYER_IDS.drought,
    mapMode: "prediction-readiness",
  };
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

export function clampLocalTransform(next: LocalMapTransform): LocalMapTransform {
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
  admin: "ขอบเขตการปกครอง",
  "local-evidence": "มีหลักฐานท้องถิ่น",
  "source-capability": "มีแหล่งข้อมูลตั้งต้น",
  "district-evidence": "มีหลักฐานระดับอำเภอ",
  "research-drought-normal": "ปกติ",
  "research-drought-watch": "เฝ้าระวัง",
  "research-drought-severe": "เสี่ยงสูง",
  "research-study-ready": "มีข้อมูลรองรับ",
  "research-study-missing": "ยังไม่พบข้อมูลรองรับ",
  "forecast-no-risk": "ไม่พบสัญญาณเสี่ยง",
  "forecast-moderate": "เสี่ยงปานกลาง",
  "forecast-high": "เสี่ยงสูง",
  "forecast-out-of-scope": "นอกขอบเขตการศึกษา",
  "forecast-missing": "ไม่มีข้อมูลในรอบนี้",
  insufficient: "ข้อมูลไม่พอคำนวณ",
  "no-data": "ยังไม่มีหลักฐานเชิงลึก",
};

export const localMapModes: Array<{
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

export const coverageLabelsByMode: Record<LocalMapMode, Record<LocalMapStatus, string>> = {
  "prediction-readiness": {
    admin: "ขอบเขตการปกครอง",
    "local-evidence": "พร้อมคาดการณ์ระดับพื้นที่",
    "source-capability": "มีข้อมูลตั้งต้น",
    "district-evidence": "มีบริบทระดับอำเภอ",
    "research-drought-normal": "ปกติ",
    "research-drought-watch": "เฝ้าระวัง",
    "research-drought-severe": "เสี่ยงสูง",
    "research-study-ready": "มีข้อมูลรองรับ",
    "research-study-missing": "ยังไม่พบข้อมูลรองรับ",
    "forecast-no-risk": "ไม่พบสัญญาณเสี่ยง",
    "forecast-moderate": "เสี่ยงปานกลาง",
    "forecast-high": "เสี่ยงสูง",
    "forecast-out-of-scope": "นอกขอบเขตการศึกษา",
    "forecast-missing": "ไม่มีข้อมูลในรอบนี้",
    insufficient: "ข้อมูลยังไม่เพียงพอ",
    "no-data": "ยังไม่พอคาดการณ์",
  },
  "evidence-coverage": coverageLabels,
  "source-readiness": {
    admin: "ขอบเขตการปกครอง",
    "local-evidence": "มีหลักฐานท้องถิ่น",
    "source-capability": "มีช่องทางข้อมูล",
    "district-evidence": "มีรายงานระดับอำเภอ",
    "research-drought-normal": "ปกติ",
    "research-drought-watch": "เฝ้าระวัง",
    "research-drought-severe": "เสี่ยงสูง",
    "research-study-ready": "มีข้อมูลรองรับ",
    "research-study-missing": "ยังไม่พบข้อมูลรองรับ",
    "forecast-no-risk": "ไม่พบสัญญาณเสี่ยง",
    "forecast-moderate": "เสี่ยงปานกลาง",
    "forecast-high": "เสี่ยงสูง",
    "forecast-out-of-scope": "นอกขอบเขตการศึกษา",
    "forecast-missing": "ไม่มีข้อมูลในรอบนี้",
    insufficient: "รอยืนยันแหล่งข้อมูล",
    "no-data": "ยังไม่พบแหล่งข้อมูลท้องถิ่น",
  },
};

export function coverageLabel(status: LocalMapStatus, mode: LocalMapMode) {
  return coverageLabelsByMode[mode][status];
}

export function compactCoverageLabel(status: LocalMapStatus, mode: LocalMapMode) {
  if (status === "forecast-no-risk") return "ไม่เสี่ยง";
  if (status === "forecast-moderate") return "ปานกลาง";
  if (status === "forecast-high") return "สูง";
  if (status === "forecast-out-of-scope") return "นอกขอบเขต";
  if (status === "forecast-missing") return "ไม่มีข้อมูล";

  if (mode === "prediction-readiness") {
    if (status === "research-drought-normal") return "ปกติ";
    if (status === "research-drought-watch") return "เฝ้าระวัง";
    if (status === "research-drought-severe") return "เสี่ยงสูง";
    if (status === "research-study-ready") return "มีข้อมูล";
    if (status === "research-study-missing") return "ไม่มีข้อมูล";
  }

  if (status === "research-study-ready") return "มีข้อมูล";
  if (status === "research-study-missing") return "ไม่มีข้อมูล";
  return coverageLabel(status, mode);
}

export function mapModeHelper(mode: LocalMapMode) {
  return localMapModes.find((item) => item.id === mode)?.helper ?? "";
}

export const localMapViewOptions: AppSelectOption[] = [
  { value: "risk", label: "ความเสี่ยงภัยแล้ง", triggerLabel: "ความเสี่ยง", group: "มุมมองแผนที่" },
  { value: "study", label: "สถานะข้อมูล", triggerLabel: "สถานะข้อมูล", group: "มุมมองแผนที่" },
];

export const localStudyCriterionOptions: AppSelectOption[] = [
  { value: "all", label: "ทุกตำบล", triggerLabel: "ทุกตำบล", group: "สถานะข้อมูล" },
  { value: "studied", label: "มีข้อมูลรองรับ", triggerLabel: "มีข้อมูล", group: "สถานะข้อมูล" },
  { value: "unstudied", label: "ยังไม่พบข้อมูลรองรับ", triggerLabel: "ไม่มีข้อมูล", group: "สถานะข้อมูล" },
];

export const localRiskCriterionOptions: AppSelectOption[] = [
  { value: "all", label: "ทุกระดับภัยแล้ง", triggerLabel: "ทุกระดับ", group: "ระดับภัยแล้ง" },
  { value: "green", label: "ปกติ", triggerLabel: "ปกติ", group: "ระดับภัยแล้ง" },
  { value: "yellow", label: "เฝ้าระวัง", triggerLabel: "เฝ้าระวัง", group: "ระดับภัยแล้ง" },
  { value: "red", label: "เสี่ยงสูง", triggerLabel: "เสี่ยงสูง", group: "ระดับภัยแล้ง" },
];

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

export function layerUsesResearchCriteriaMap(layerId: string, activeTab?: ProvinceDashboardTab | null) {
  if (activeTab === "drought") return true;
  return layerId === NAKHON_RATCHASIMA_LAYER_IDS.derivedAgriculturalRisk || layerId === NAKHON_RATCHASIMA_LAYER_IDS.drought;
}

export function defaultLocalMapCriteria(_activeTab?: ProvinceDashboardTab | null, _layerId?: string): LocalMapCriteria {
  return {
    viewMode: "risk",
    study: "all",
    risk: "all",
  };
}

export function localCriteriaEqual(a: LocalMapCriteria, b: LocalMapCriteria) {
  return a.viewMode === b.viewMode && a.study === b.study && a.risk === b.risk;
}

export function localMapCriteriaSummaryLabel(criteria: LocalMapCriteria) {
  const parts = [
    localStudyCriterionOptions.find((option) => option.value === criteria.study)?.label,
    localRiskCriterionOptions.find((option) => option.value === criteria.risk)?.label,
  ].filter((part): part is string => Boolean(part && !part.startsWith("ทุก")));
  return parts.length > 0 ? parts.join(" + ") : "ไม่มีเงื่อนไขเพิ่มเติม";
}

export function forecastArchiveCriteriaSummaryLabel(criteria: LocalMapCriteria) {
  const label = forecastArchiveRiskCriterionOptions.find((option) => option.value === criteria.risk)?.label;
  return label && !label.startsWith("ทุก") ? label : "ไม่มีเงื่อนไขเพิ่มเติม";
}

export type LocalResearchRecord =
  | NakhonRatchasimaResearchMonthlySubdistrictRecord
  | NakhonRatchasimaResearchSubdistrictLatest
  | undefined;

export type ActiveResearchPeriod = {
  period: string;
  isFallback: boolean;
  hasData: boolean;
  isCleared: boolean;
};

export const localResearchPendingLabel = "รอชุดข้อมูลใหม่";

export function localResearchPeriodForSelectedMonth(selectedMonth: string, summary: NakhonRatchasimaResearchPanelSummary): ActiveResearchPeriod {
  const periods = getNakhonRatchasimaResearchPeriods();
  if (periods.length === 0 || summary.meta.periodCount === 0 || !summary.meta.periodEnd) {
    return { period: "", isFallback: false, hasData: false, isCleared: true };
  }
  if (periods.includes(selectedMonth)) return { period: selectedMonth, isFallback: false, hasData: true, isCleared: false };
  return { period: summary.meta.periodEnd, isFallback: selectedMonth !== summary.meta.periodEnd, hasData: true, isCleared: false };
}

export function localResearchPeriodLabel(period: ActiveResearchPeriod | string | undefined | null) {
  const value = typeof period === "string" ? period : period?.period;
  return value ? formatMonth(value, "th") : localResearchPendingLabel;
}

export function localResearchPeriodDetail(activePeriod: ActiveResearchPeriod) {
  if (activePeriod.isCleared) return "ยังไม่มีชุดข้อมูลแผนที่ในรอบนี้";
  return activePeriod.isFallback ? "ไม่มีข้อมูลในเดือนที่เลือก จึงใช้เดือนล่าสุด" : "ตรงกับเดือนที่เลือก";
}

export function localResearchRecordForSubdistrict(subdistrictCode: string | undefined | null, period: string): LocalResearchRecord {
  if (!period) return undefined;
  return getNakhonRatchasimaResearchSubdistrictMonth(subdistrictCode, period) ?? getNakhonRatchasimaResearchSubdistrictLatest(subdistrictCode);
}

export function localRiskCriterionForRecord(record: LocalResearchRecord): Exclude<LocalRiskCriterion, "all"> | null {
  if (!record) return null;
  if (record.droughtRiskLevel >= 2) return "red";
  if (record.droughtRiskLevel === 1) return "yellow";
  return "green";
}

export function localStudyCriterionForRecord(record: LocalResearchRecord): Exclude<LocalStudyCriterion, "all"> {
  return record?.websiteImportStatus?.startsWith("READY") ? "studied" : "unstudied";
}

export function localResearchRecordMatchesCriteria(record: LocalResearchRecord, criteria: LocalMapCriteria) {
  if (criteria.study !== "all" && localStudyCriterionForRecord(record) !== criteria.study) return false;
  if (!record) return criteria.risk === "all";
  if (criteria.risk !== "all" && !["green", "yellow", "red"].includes(criteria.risk)) return false;
  if (criteria.risk !== "all" && localRiskCriterionForRecord(record) !== criteria.risk) return false;
  return true;
}

export function researchDroughtStatusForRecord(record: LocalResearchRecord): LocalMapStatus {
  if (!record) return "no-data";
  if (record.droughtRiskLevel >= 2) return "research-drought-severe";
  if (record.droughtRiskLevel === 1) return "research-drought-watch";
  return "research-drought-normal";
}

export function researchStudyStatusForRecord(record: LocalResearchRecord): LocalMapStatus {
  return localStudyCriterionForRecord(record) === "studied" ? "research-study-ready" : "research-study-missing";
}

export function localMapStatusForResearchRecord(
  record: LocalResearchRecord,
  viewMode: LocalMapViewMode,
): LocalMapStatus {
  if (viewMode === "study") return researchStudyStatusForRecord(record);
  return researchDroughtStatusForRecord(record);
}

export function localMapLegendStatusesForView(viewMode: LocalMapViewMode): LocalMapStatus[] {
  if (viewMode === "study") return ["research-study-ready", "research-study-missing"];
  return ["research-drought-severe", "research-drought-watch", "research-drought-normal"];
}

export const forecastArchiveLegendStatuses: LocalMapStatus[] = [
  "forecast-no-risk",
  "forecast-moderate",
  "forecast-high",
  "forecast-out-of-scope",
];

export function districtResearchRiskStatus(record: NakhonRatchasimaResearchDistrictLatest): LocalMapStatus {
  if (record.droughtSevereSubdistricts > 0) return "research-drought-severe";
  if (record.droughtWatchSubdistricts > 0) return "research-drought-watch";
  return "research-drought-normal";
}

export function localStatusPillTone(status: LocalMapStatus) {
  if (status === "forecast-high") return "severe";
  if (status === "forecast-moderate") return "watch";
  if (status === "forecast-no-risk") return "normal";
  if (status === "research-drought-severe") return "severe";
  if (status === "research-drought-watch") return "watch";
  if (status === "research-drought-normal" || status === "research-study-ready") return "normal";
  return "muted";
}

export function localLabelPriorityForStatus(status: LocalMapStatus) {
  if (status === "research-drought-severe" || status === "local-evidence") return 42;
  if (status === "forecast-high") return 42;
  if (status === "forecast-moderate") return 38;
  if (status === "research-drought-watch") return 32;
  if (status === "source-capability" || status === "district-evidence") return 24;
  if (status === "forecast-no-risk" || status === "research-drought-normal" || status === "research-study-ready") return 18;
  return 8;
}

export function legendStatusesForContext(layerId: string, activeTab?: ProvinceDashboardTab | null): LocalMapStatus[] {
  if (activeTab === "drought") return ["research-drought-severe", "research-drought-watch", "research-drought-normal"];
  return ["local-evidence", "source-capability", "district-evidence", "insufficient", "no-data"];
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
  });
}

export function districtCodeForFeature(feature: NakhonRatchasimaGeoFeature) {
  return `${feature.properties.P_code}${feature.properties.A_code}`;
}

export function evidenceStatusForSubdistrict(row: NakhonRatchasimaMatrixRow | undefined, layerId: string): LocalMapStatus {
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

export function predictionStatusForSubdistrict(row: NakhonRatchasimaMatrixRow | undefined, layerId: string): LocalMapStatus {
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

export function sourceReadinessStatusForSubdistrict(row: NakhonRatchasimaMatrixRow | undefined, layerId: string): LocalMapStatus {
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

export function statusForSubdistrict(
  row: NakhonRatchasimaMatrixRow | undefined,
  layerId: string,
  mapMode: LocalMapMode,
): LocalMapStatus {
  if (mapMode === "prediction-readiness") return predictionStatusForSubdistrict(row, layerId);
  if (mapMode === "source-readiness") return sourceReadinessStatusForSubdistrict(row, layerId);
  return evidenceStatusForSubdistrict(row, layerId);
}

export function subdistrictOptionForRow(
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

export function districtOptionForProvince(district: NakhonRatchasimaDistrict): AppSelectOption {
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

export function districtOptionsForProvince(): AppSelectOption[] {
  return getNakhonRatchasimaDistricts().map(districtOptionForProvince);
}

export function subdistrictOptionsForRoute(
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

export function pathForDistrictCode(districtCode: string) {
  const district = getNakhonRatchasimaDistrictByCode(districtCode);
  if (!district) return undefined;
  return getNakhonRatchasimaPath(district);
}

export function pathForSubdistrictCode(subdistrictCode: string) {
  const row = getNakhonRatchasimaMatrixRowBySubdistrictCode(subdistrictCode);
  const district = getNakhonRatchasimaDistrictByCode(row?.district_code);
  const subdistrict = district?.subdistricts.find((item) => item.subdistrictCode === subdistrictCode);
  if (!district || !subdistrict) return undefined;
  return getNakhonRatchasimaPath(district, subdistrict);
}

export function translateAccess(value: string) {
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
    "local bundle index referencing REAL sources": "ดัชนีข้อมูลที่อ้างอิงแหล่งข้อมูลจริง",
    runtime: "สถานะภายในระบบ",
  };
  return labels[value] ?? value;
}

export function translateLayerNoData(value: string) {
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

export function translateStatus(value: string) {
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
      "พร้อมแสดงสถานีและข้อมูลประมาณค่าแล้ว แต่ยังรอยืนยันค่าฝนสด",
    UI_SOURCE_VERIFIED: "ยืนยันแหล่งข้อมูลจากหน้าจอใช้งาน",
  };
  return labels[value] ?? value;
}

export function translateClassification(value: string) {
  if (value.startsWith("REAL")) return "ข้อมูลจริง";
  if (value === "DERIVED") return "ผลคำนวณจากข้อมูลตั้งต้น";
  if (value === "CANONICAL_SYNTHETIC") return "ข้อมูลต้นแบบ";
  if (value === "RUNTIME_STATE") return "สถานะจากการใช้งาน";
  return value;
}

export function formatThaiDate(value?: string | null) {
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

export function formatThaiDateTime(value?: string | null) {
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

export function formatThaiPeriod(value?: string | null) {
  if (!value) return "ไม่ระบุ";
  if (/^\d{4}-\d{2}$/.test(value)) return formatMonth(value, "th");
  const parts = value.split(/\s+to\s+/);
  if (parts.length === 2) return `${formatThaiDate(parts[0])} - ${formatThaiDate(parts[1])}`;
  return formatThaiDate(value);
}

export function translateScope(value: string) {
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

export function evidenceTitle(record: NakhonRatchasimaEvidenceRecord) {
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

export function translateFactKey(key: string) {
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

export function translateFactValue(value: unknown): string {
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

export function translateRecommendedUse(value: string) {
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

export function translateSpatialGranularity(value: string) {
  const labels: Record<string, string> = {
    "Asset / command-area / province depending dataset": "ระดับทรัพยากรน้ำ พื้นที่ชลประทาน หรือจังหวัดตามขอบเขตข้อมูล",
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

export function translateSourceLimitation(value: string) {
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

export function translateConfidenceLabel(value: string) {
  const labels: Record<string, string> = {
    HIGH: "สูง",
    LOW: "ต่ำ",
    "MEDIUM-HIGH": "ปานกลางถึงสูง",
    MEDIUM: "ปานกลาง",
  };
  return labels[value] ?? value;
}

export function translateLimitation(value: string) {
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
      "ข้อมูลอ้างอิงขอบเขตแผนที่ ต้องตรวจค่ารหัสจริงเมื่อเชื่อมข้อมูล",
    "Forecast/watch evidence, not observed flood impact.": "เป็นหลักฐานเชิงคาดการณ์/เฝ้าระวัง ไม่ใช่พื้นที่น้ำท่วมที่สังเกตแล้ว",
    "Historical DWR warning record. This bundle does not infer agricultural severity from the raw station value.":
      "เป็นบันทึกเตือนภัยย้อนหลังของสถานี DWR ข้อมูลส่วนนี้ไม่อนุมานระดับความเสียหายเกษตรจากค่าดิบของสถานี",
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

export function factRows(record: NakhonRatchasimaEvidenceRecord) {
  return Object.entries(record.facts).map(([key, value]) => ({
    label: translateFactKey(key),
    value: translateFactValue(value),
  }));
}

export function sourceAgencyFor(record: NakhonRatchasimaEvidenceRecord) {
  const source = getNakhonRatchasimaSourceRows().find((row) => row.source_id === record.source_id);
  return source?.source_agency ?? record.source_id;
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

export function researchDisplayPeriod(summary: NakhonRatchasimaResearchPanelSummary) {
  if (summary.meta.periodCount === 0 || !summary.meta.periodEnd) return localResearchPendingLabel;
  if (summary.meta.periodStart === summary.meta.periodEnd) return formatMonth(summary.meta.periodEnd, "th");
  return `${formatMonth(summary.meta.periodStart, "th")} ถึง ${formatMonth(summary.meta.periodEnd, "th")}`;
}

export function researchLatestPeriod(summary: NakhonRatchasimaResearchPanelSummary) {
  if (summary.meta.periodCount === 0 || !summary.meta.periodEnd) return localResearchPendingLabel;
  return formatMonth(summary.meta.periodEnd, "th");
}

export function researchJoinPolicyNote() {
  return "เชื่อมพื้นที่ด้วยรหัสจังหวัด รหัสอำเภอ และรหัสตำบลเท่านั้น รหัสจากงานวิจัยเดิมใช้เพื่ออ้างอิงแถวต้นทาง ไม่ใช่รหัสราชการ";
}

export function researchPeriodsEndingAt(period: string, count = 12) {
  if (!period) return [];
  const periods = getNakhonRatchasimaResearchPeriods();
  const endIndex = Math.max(0, periods.indexOf(period));
  return periods.slice(Math.max(0, endIndex - count + 1), endIndex + 1);
}

export function researchRecordsForSubdistrictCodes(subdistrictCodes: string[], period: string) {
  return subdistrictCodes
    .map((subdistrictCode) => getNakhonRatchasimaResearchSubdistrictMonth(subdistrictCode, period))
    .filter((record): record is NakhonRatchasimaResearchMonthlySubdistrictRecord => Boolean(record));
}

export function summarizeResearchAreaRecords(
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

export type ResearchAreaStats = ReturnType<typeof summarizeResearchAreaRecords>;

export type AgriculturalVisibilityFact = {
  id: string;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "default" | "good" | "watch" | "danger" | "muted";
  icon?: ReactNode;
};

export type PredictionReadinessSummary = ReturnType<typeof predictionReadinessSummary>;

export function researchMonthlySeriesForDistrict(district: NakhonRatchasimaDistrict, period: string, count = 12) {
  const subdistrictCodes = district.subdistricts.map((subdistrict) => subdistrict.subdistrictCode);
  return researchPeriodsEndingAt(period, count).map((month) => {
    const records = researchRecordsForSubdistrictCodes(subdistrictCodes, month);
    return {
      period: month,
      ...summarizeResearchAreaRecords(records, subdistrictCodes.length),
    };
  });
}

export function researchMonthlySeriesForSubdistrict(subdistrictCode: string, period: string, count = 12) {
  return researchPeriodsEndingAt(period, count).map((month) => {
    const records = researchRecordsForSubdistrictCodes([subdistrictCode], month);
    return {
      period: month,
      ...summarizeResearchAreaRecords(records, 1),
    };
  });
}

export function researchAreaDroughtLabel(stats: Pick<ResearchAreaStats, "droughtSevereSubdistricts" | "droughtWatchSubdistricts" | "droughtNormalSubdistricts" | "recordCount">) {
  if (stats.recordCount === 0) return "ไม่มีข้อมูล";
  if (stats.droughtSevereSubdistricts > 0) return "เสี่ยงสูง";
  if (stats.droughtWatchSubdistricts > 0) return "เฝ้าระวัง";
  return "ปกติ";
}

export function researchAreaDroughtTone(stats: Pick<ResearchAreaStats, "droughtSevereSubdistricts" | "droughtWatchSubdistricts" | "recordCount">) {
  if (stats.recordCount === 0) return "muted";
  if (stats.droughtSevereSubdistricts > 0 || stats.droughtWatchSubdistricts > 0) return "watch";
  return "good";
}

export function researchDistrictPath(record: NakhonRatchasimaResearchDistrictLatest) {
  const district = getNakhonRatchasimaDistrictByCode(record.districtCode);
  return district ? getNakhonRatchasimaPath(district) : NAKHON_RATCHASIMA_ROUTE_BASE;
}

export function researchSubdistrictPath(record: NakhonRatchasimaResearchSubdistrictLatest) {
  const district = getNakhonRatchasimaDistrictByCode(record.districtCode);
  const subdistrict = district?.subdistricts.find((item) => item.subdistrictCode === record.subdistrictCode);
  if (district && subdistrict) return getNakhonRatchasimaPath(district, subdistrict);
  if (district) return getNakhonRatchasimaPath(district);
  return NAKHON_RATCHASIMA_ROUTE_BASE;
}

export function predictionReadinessSummary() {
  const subdistrictCodes = getNakhonRatchasimaDistricts().flatMap((district) =>
    district.subdistricts.map((subdistrict) => subdistrict.subdistrictCode),
  );

  return predictionReadinessSummaryForSubdistrictCodes(subdistrictCodes);
}

export function predictionReadinessSummaryForSubdistrictCodes(subdistrictCodes: string[]) {
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
    "forecast-no-risk": 0,
    "forecast-moderate": 0,
    "forecast-high": 0,
    "forecast-out-of-scope": 0,
    "forecast-missing": 0,
    insufficient: 0,
    "no-data": 0,
  };
  const districtsWithPredictionInput = new Set<string>();
  const districtsInScope = new Set<string>();

  subdistrictCodes.forEach((subdistrictCode) => {
    const row = getNakhonRatchasimaMatrixRowBySubdistrictCode(subdistrictCode);
    const status = statusForSubdistrict(row, NAKHON_RATCHASIMA_LAYER_IDS.derivedAgriculturalRisk, "prediction-readiness");
    counts[status] += 1;
    if (row) districtsInScope.add(row.district_code);
    if (row && !["admin", "insufficient", "no-data"].includes(status)) {
      districtsWithPredictionInput.add(row.district_code);
    }
  });

  const totalSubdistricts = subdistrictCodes.length;
  const readySubdistricts = counts["local-evidence"];
  const sourceInputSubdistricts = counts["source-capability"];
  const districtContextSubdistricts = counts["district-evidence"];
  const blockedSubdistricts = counts.insufficient + counts["no-data"];
  const readiestLevelLabel =
    readySubdistricts > 0
      ? "พร้อมใช้ระดับพื้นที่"
      : sourceInputSubdistricts > 0
        ? "มีข้อมูลตั้งต้น"
        : districtContextSubdistricts > 0
          ? "มีบริบทระดับอำเภอ"
          : "ข้อมูลยังไม่เพียงพอ";

  return {
    districtCount: districtsInScope.size,
    districtSignalCount: districtsWithPredictionInput.size,
    totalSubdistricts,
    readySubdistricts,
    sourceInputSubdistricts,
    districtContextSubdistricts,
    blockedSubdistricts,
    readyPercent: totalSubdistricts > 0 ? (readySubdistricts / totalSubdistricts) * 100 : 0,
    readiestLevelLabel,
    readiestLevel:
      readySubdistricts > 0
        ? "ตำบลบางพื้นที่"
        : districtContextSubdistricts > 0
          ? "อำเภอบางพื้นที่"
          : "จังหวัด",
  };
}

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
    return { label: "กลับจังหวัด", path: NAKHON_RATCHASIMA_ROUTE_BASE };
  }
  return { label: "กลับอำเภอ", path: getNakhonRatchasimaPath(route.district) };
}
