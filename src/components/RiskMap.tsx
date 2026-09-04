import { useEffect, useMemo, useRef, useState } from "react";
import { Layers, LocateFixed, Maximize2, Minimize2, Minus, Plus, RotateCcw } from "lucide-react";
import { AppSelect } from "./AppSelect";
import { DataProvenanceChip, dataProvenanceChipKindFromText } from "./DataProvenanceChip";
import { MapPreviewFooter } from "./MapPreviewFooter";
import { NakhonRatchasimaWorkspaceSummary } from "./NakhonRatchasimaWorkspaceSummary";
import { mapLayerCatalog, months, provinceMonthlyRisk, provinces } from "../data/catalog";
import {
  formatRai,
  getFilteredProvinceRecords,
  getLayerAvailability,
  getLayerSources,
  getMapLayer,
  getNakhonRatchasimaResearchPanelSummary,
  getProvinceRecord,
  getProvinceWorkspacePath,
  hasSeededDrilldown,
  MAIN_EVENT_ID,
  NAKHON_RATCHASIMA_ID,
  normalizeName,
  severityTone,
} from "../domain";
import {
  labelLayerAvailability,
  labelLayerGroup,
  labelConfidence,
  labelCrop,
  labelHazard,
  labelProvinceProvenance,
  formatMonth,
  severityLabel,
  t,
} from "../i18n";
import {
  getAnchoredZoomTransform,
  getSharedMapWheelAction,
  interpolateMapTransform,
  isMapWheelEventFromInteractiveTarget,
  isMapTransformSettled,
  sharedMapButtonZoomStep,
} from "../mapInteraction";
import { makeVisibleMapLabels, projectedLabelPointForGeometry } from "../mapLabels";
import { useAppDispatch, useAppState } from "../store";
import type { MapLayerRecord, ProvinceMonthRisk, Severity } from "../types";
import { useFullscreenTarget } from "../useFullscreenTarget";

type GeoFeature = {
  type: "Feature";
  properties: {
    shapeName: string;
    shapeISO: string;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

type GeoCollection = {
  type: "FeatureCollection";
  name?: string;
  features: GeoFeature[];
};

type MapTransform = {
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
  transform: MapTransform;
};

type PreviewMode = "hover" | "pinned" | "touch";

type ProvincePreview = {
  record: ProvinceMonthRisk;
  mode: PreviewMode;
  x: number;
  y: number;
};

type NationalMapViewMode = "risk" | "study" | "irrigation";
type StudyCriterion = "all" | "studied" | "unstudied";
type IrrigationCriterion = "all" | "has" | "none" | "unknown";
type RiskCriterion = "all" | "green" | "yellow" | "red";

type NationalMapCriteria = {
  viewMode: NationalMapViewMode;
  study: StudyCriterion;
  irrigation: IrrigationCriterion;
  risk: RiskCriterion;
};

type GeoProjection = {
  x: (lon: number) => number;
  y: (lat: number) => number;
};

const mapWidth = 520;
const mapHeight = 720;
const countryFitZoom = 1.18;
const minZoom = 0.72;
const maxZoom = 3.2;
const zoomStep = sharedMapButtonZoomStep;
const provinceFocusZoom = 1.58;
const neighborContextCountries = new Set(["Myanmar", "Laos", "Cambodia", "Malaysia", "Vietnam"]);
const neighborBorderClipPadding = 44;
const neighborBorderMaxSegmentLength = 160;
const neighborBorderGeoPadding = {
  lon: 0.9,
  lat: 0.95,
};

function centeredTransform(k: number): MapTransform {
  return {
    x: Number(((mapWidth * (1 - k)) / 2).toFixed(3)),
    y: Number(((mapHeight * (1 - k)) / 2).toFixed(3)),
    k,
  };
}

const countryFitTransform = centeredTransform(countryFitZoom);

const severityFill: Record<Severity, string> = {
  Normal: "#e4eee3",
  Watch: "#f4df92",
  Warning: "#e99758",
  Severe: "#bf4748",
};

const evidenceFill: Record<Severity, string> = {
  Normal: "#dbe9e8",
  Watch: "#b9d3d8",
  Warning: "#6ba8b3",
  Severe: "#2e7485",
};

const provinceLabelPriority: Record<Severity, number> = {
  Normal: 10,
  Watch: 24,
  Warning: 34,
  Severe: 44,
};

const studyFill = {
  studied: "#2f7569",
  unstudied: "#e5ebe7",
};

const irrigationFill = {
  has: "#2f7569",
  none: "#f0b64f",
  unknown: "#e7ede9",
};

const noDataFill = "#eef4f0";
const unavailableFill = "#f6f6f1";

const defaultNationalMapCriteria: NationalMapCriteria = {
  viewMode: "risk",
  study: "all",
  irrigation: "all",
  risk: "all",
};

const nationalMapViewOptions = [
  { value: "risk", label: "ความเสี่ยง", group: "มุมมองแผนที่" },
  { value: "study", label: "พื้นที่ศึกษา", group: "มุมมองแผนที่" },
  { value: "irrigation", label: "ชลประทาน", group: "มุมมองแผนที่" },
];

const studyCriterionOptions = [
  { value: "all", label: "ทุกจังหวัด", group: "พื้นที่ศึกษา" },
  { value: "studied", label: "ศึกษาแล้ว", group: "พื้นที่ศึกษา" },
  { value: "unstudied", label: "ยังไม่ศึกษา", group: "พื้นที่ศึกษา" },
];

const irrigationCriterionOptions = [
  { value: "all", label: "ทุกพื้นที่น้ำ", group: "ชลประทาน" },
  { value: "has", label: "มีชลประทาน", group: "ชลประทาน" },
  { value: "none", label: "ไม่มีชลประทาน", group: "ชลประทาน" },
  { value: "unknown", label: "รอข้อมูล", group: "ชลประทาน" },
];

const riskCriterionOptions = [
  { value: "all", label: "ทุกระดับเสี่ยง", group: "ความเสี่ยง" },
  { value: "green", label: "เขียว", group: "ความเสี่ยง" },
  { value: "yellow", label: "เหลือง", group: "ความเสี่ยง" },
  { value: "red", label: "แดง", group: "ความเสี่ยง" },
];

function featureName(feature: GeoFeature) {
  return feature.properties.shapeName.replace(/\s+Province$/i, "");
}

function recordForFeature(feature: GeoFeature, records: ProvinceMonthRisk[]) {
  const normalized = normalizeName(featureName(feature));
  return records.find((record) => normalizeName(record.province) === normalized);
}

function getGeoBounds(geo: GeoCollection) {
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
  geo.features.forEach((feature) => visit(feature.geometry.coordinates));
  return { minLon, minLat, maxLon, maxLat };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampTransform(next: MapTransform): MapTransform {
  const k = clamp(Number(next.k.toFixed(3)), minZoom, maxZoom);

  if (k <= 1) {
    return centeredTransform(k);
  }

  return {
    x: clamp(next.x, mapWidth * (1 - k), 0),
    y: clamp(next.y, mapHeight * (1 - k), 0),
    k,
  };
}

function createGeoProjection(bounds: ReturnType<typeof getGeoBounds>): GeoProjection {
  const pad = 20;
  const contextLon = 2.6;
  const contextLat = 1.15;
  const projectionBounds = {
    minLon: bounds.minLon - contextLon,
    maxLon: bounds.maxLon + contextLon,
    minLat: bounds.minLat - contextLat,
    maxLat: bounds.maxLat + contextLat,
  };
  const midpointLat = (projectionBounds.minLat + projectionBounds.maxLat) / 2;
  const lonScale = Math.cos((midpointLat * Math.PI) / 180);
  const minX = projectionBounds.minLon * lonScale;
  const maxX = projectionBounds.maxLon * lonScale;
  const minY = projectionBounds.minLat;
  const maxY = projectionBounds.maxLat;
  const usableWidth = mapWidth - pad * 2;
  const usableHeight = mapHeight - pad * 2;
  const scale = Math.min(usableWidth / (maxX - minX), usableHeight / (maxY - minY));
  const projectedWidth = (maxX - minX) * scale;
  const projectedHeight = (maxY - minY) * scale;
  const offsetX = (mapWidth - projectedWidth) / 2 - minX * scale;
  const offsetY = (mapHeight - projectedHeight) / 2 + maxY * scale;

  return {
    x: (lon: number) => offsetX + lon * lonScale * scale,
    y: (lat: number) => offsetY - lat * scale,
  };
}

function pathForFeature(feature: GeoFeature, projection: GeoProjection) {
  const ringPath = (ring: number[][]) =>
    ring
      .map(([lon, lat], index) => `${index === 0 ? "M" : "L"}${projection.x(lon).toFixed(2)},${projection.y(lat).toFixed(2)}`)
      .join(" ") + "Z";

  if (feature.geometry.type === "MultiPolygon") {
    return (feature.geometry.coordinates as number[][][][])
      .flatMap((polygon) => polygon.map(ringPath))
      .join(" ");
  }
  return (feature.geometry.coordinates as number[][][]).map(ringPath).join(" ");
}

function pointInPaddedMap(point: { x: number; y: number }, padding = neighborBorderClipPadding) {
  return point.x >= -padding && point.x <= mapWidth + padding && point.y >= -padding && point.y <= mapHeight + padding;
}

function segmentCanAppearInMap(first: { x: number; y: number }, second: { x: number; y: number }) {
  const padding = neighborBorderClipPadding;
  if (first.x < -padding && second.x < -padding) return false;
  if (first.x > mapWidth + padding && second.x > mapWidth + padding) return false;
  if (first.y < -padding && second.y < -padding) return false;
  if (first.y > mapHeight + padding && second.y > mapHeight + padding) return false;
  return pointInPaddedMap(first, padding) || pointInPaddedMap(second, padding);
}

function segmentIsNearThailandBounds(first: number[], second: number[], bounds: ReturnType<typeof getGeoBounds>) {
  const midLon = (first[0] + second[0]) / 2;
  const midLat = (first[1] + second[1]) / 2;
  return (
    midLon >= bounds.minLon - neighborBorderGeoPadding.lon &&
    midLon <= bounds.maxLon + neighborBorderGeoPadding.lon &&
    midLat >= bounds.minLat - neighborBorderGeoPadding.lat &&
    midLat <= bounds.maxLat + neighborBorderGeoPadding.lat
  );
}

function contextBorderPathForFeature(feature: GeoFeature, projection: GeoProjection, bounds: ReturnType<typeof getGeoBounds>) {
  const segments: string[] = [];
  const appendRingSegments = (ring: number[][]) => {
    for (let index = 1; index < ring.length; index += 1) {
      const firstCoordinate = ring[index - 1];
      const secondCoordinate = ring[index];
      if (!segmentIsNearThailandBounds(firstCoordinate, secondCoordinate, bounds)) continue;
      const [firstLon, firstLat] = firstCoordinate;
      const [secondLon, secondLat] = secondCoordinate;
      const first = { x: projection.x(firstLon), y: projection.y(firstLat) };
      const second = { x: projection.x(secondLon), y: projection.y(secondLat) };
      const segmentLength = Math.hypot(first.x - second.x, first.y - second.y);
      if (segmentLength > neighborBorderMaxSegmentLength || !segmentCanAppearInMap(first, second)) continue;
      segments.push(`M${first.x.toFixed(2)},${first.y.toFixed(2)}L${second.x.toFixed(2)},${second.y.toFixed(2)}`);
    }
  };

  if (feature.geometry.type === "MultiPolygon") {
    (feature.geometry.coordinates as number[][][][]).forEach((polygon) => polygon.forEach(appendRingSegments));
  } else {
    (feature.geometry.coordinates as number[][][]).forEach(appendRingSegments);
  }

  return segments.join(" ");
}

function projectedBoundsForFeature(feature: GeoFeature, projection: GeoProjection) {
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

  visit(feature.geometry.coordinates);
  return { minX, minY, maxX, maxY };
}

function transformForProvinceFocus(feature: GeoFeature, projection: GeoProjection) {
  const bounds = projectedBoundsForFeature(feature, projection);
  const featureWidth = Math.max(1, bounds.maxX - bounds.minX);
  const featureHeight = Math.max(1, bounds.maxY - bounds.minY);
  const fitZoom = Math.min((mapWidth - 170) / featureWidth, (mapHeight - 210) / featureHeight);
  const k = clamp(Number(Math.min(provinceFocusZoom, Math.max(1.18, fitZoom)).toFixed(3)), 1.18, provinceFocusZoom);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return clampTransform({
    x: mapWidth / 2 - centerX * k,
    y: mapHeight / 2 - centerY * k,
    k,
  });
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function layerHasSeededProvince(layer: MapLayerRecord, provinceId: string) {
  if (!layer.seededLocationIds) return true;
  return layer.seededLocationIds.some((id) => id === provinceId || id.startsWith(`${provinceId}-`));
}

function riskCriterionForSeverity(severity: Severity): Exclude<RiskCriterion, "all"> {
  if (severity === "Normal") return "green";
  if (severity === "Watch") return "yellow";
  return "red";
}

function studyCriterionForProvince(provinceId: string | undefined): Exclude<StudyCriterion, "all"> {
  return provinceId && hasSeededDrilldown(provinceId) ? "studied" : "unstudied";
}

function irrigationCriterionForProvince(provinceId: string | undefined): Exclude<IrrigationCriterion, "all"> {
  if (provinceId !== NAKHON_RATCHASIMA_ID) return "unknown";
  const irrigationCount = getNakhonRatchasimaResearchPanelSummary().latest.irrigationCounts.Irrigation ?? 0;
  return irrigationCount > 0 ? "has" : "none";
}

function provinceMatchesMapCriteria(record: ProvinceMonthRisk | undefined, criteria: NationalMapCriteria) {
  if (!record) return false;
  if (criteria.study !== "all" && studyCriterionForProvince(record.provinceId) !== criteria.study) return false;
  if (criteria.irrigation !== "all" && irrigationCriterionForProvince(record.provinceId) !== criteria.irrigation) return false;
  if (criteria.risk !== "all" && riskCriterionForSeverity(record.severity) !== criteria.risk) return false;
  return true;
}

function nationalCriteriaEqual(a: NationalMapCriteria, b: NationalMapCriteria) {
  return a.viewMode === b.viewMode && a.study === b.study && a.irrigation === b.irrigation && a.risk === b.risk;
}

function mapViewFill(record: ProvinceMonthRisk, criteria: NationalMapCriteria) {
  if (criteria.viewMode === "study") return studyFill[studyCriterionForProvince(record.provinceId)];
  if (criteria.viewMode === "irrigation") return irrigationFill[irrigationCriterionForProvince(record.provinceId)];
  return severityFill[record.severity];
}

function mapCriteriaSummaryLabel(criteria: NationalMapCriteria) {
  const parts = [
    studyCriterionOptions.find((option) => option.value === criteria.study)?.label,
    irrigationCriterionOptions.find((option) => option.value === criteria.irrigation)?.label,
    riskCriterionOptions.find((option) => option.value === criteria.risk)?.label,
  ].filter((part): part is string => Boolean(part && !part.startsWith("ทุก")));
  return parts.length > 0 ? parts.join(" + ") : "ไม่มี criteria เพิ่มเติม";
}

function mapLegendItems(criteria: NationalMapCriteria, language: "th" | "en") {
  if (criteria.viewMode === "study") {
    return [
      { id: "studied", label: "ศึกษาแล้ว", color: studyFill.studied },
      { id: "unstudied", label: "ยังไม่ศึกษา", color: studyFill.unstudied },
    ];
  }
  if (criteria.viewMode === "irrigation") {
    return [
      { id: "has", label: "มีชลประทาน", color: irrigationFill.has },
      { id: "none", label: "ไม่มีชลประทาน", color: irrigationFill.none },
      { id: "unknown", label: "รอข้อมูล", color: irrigationFill.unknown },
    ];
  }
  return (["Normal", "Watch", "Warning", "Severe"] as Severity[]).map((severity) => ({
    id: severity,
    label: severityLabel(severity, language),
    color: severityFill[severity],
  }));
}

function provinceDetailPath(provinceId: string) {
  return getProvinceWorkspacePath(provinceId);
}

export function RiskMap({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: (path: string) => void;
}) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const language = state.language;
  const [geo, setGeo] = useState<GeoCollection | null>(null);
  const [contextGeo, setContextGeo] = useState<GeoCollection | null>(null);
  const [mapError, setMapError] = useState(false);
  const [preview, setPreview] = useState<ProvincePreview | null>(null);
  const [criteria, setCriteria] = useState<NationalMapCriteria>(defaultNationalMapCriteria);
  const criteriaActive = !nationalCriteriaEqual(criteria, defaultNationalMapCriteria);
  const mapMonthOptions = useMemo(
    () => months.map((month) => ({ value: month, label: formatMonth(month, language), group: month.slice(0, 4) })),
    [language],
  );
  const [transform, setTransform] = useState<MapTransform>(countryFitTransform);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const transformRef = useRef<MapTransform>(transform);
  const animationFrame = useRef<number | null>(null);
  const wheelAnimationFrame = useRef<number | null>(null);
  const wheelTargetTransform = useRef<MapTransform | null>(null);
  const suppressClick = useRef(false);
  const lastPointerType = useRef<PointerEvent["pointerType"]>("mouse");
  const longPressTimer = useRef<number | null>(null);
  const previewDismissTimer = useRef<number | null>(null);
  const previewMode = useRef<PreviewMode | null>(null);
  const touchPanReady = useRef(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number; k: number; moved: boolean } | null>(
    null,
  );
  const activePointers = useRef<Map<number, ClientPoint>>(new Map());
  const pinchStart = useRef<PinchStart | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreenTarget(canvasRef);

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
    if (preview?.mode !== "touch" && preview?.mode !== "pinned") return undefined;
    const dismissOnOutsideTap = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".map-preview-card") || target?.closest("[data-province-id]")) return;
      setPreview(null);
    };
    window.addEventListener("pointerdown", dismissOnOutsideTap);
    return () => window.removeEventListener("pointerdown", dismissOnOutsideTap);
  }, [preview?.mode]);

  useEffect(() => {
    let active = true;
    fetch("/geodata/thailand-adm1.geojson")
      .then((response) => response.json())
      .then((data: GeoCollection) => {
        if (active) {
          setGeo(data);
          setMapError(false);
        }
      })
      .catch(() => {
        if (active) setMapError(true);
      });

    fetch("/geodata/thailand-neighbor-context.geojson")
      .then((response) => {
        if (!response.ok) throw new Error("Neighbor context map unavailable");
        return response.json();
      })
      .then((data: GeoCollection) => {
        if (active) setContextGeo(data);
      })
      .catch(() => {
        if (active) setContextGeo(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedMonthRecords = useMemo(
    () => provinceMonthlyRisk.filter((record) => record.month === state.selectedMonth),
    [state.selectedMonth],
  );
  const filteredRecords = useMemo(() => getFilteredProvinceRecords(state), [state]);
  const criteriaFilteredRecords = useMemo(
    () => filteredRecords.filter((record) => provinceMatchesMapCriteria(record, criteria)),
    [criteria, filteredRecords],
  );
  const filteredProvinceIds = useMemo(
    () => new Set(criteriaFilteredRecords.map((record) => record.provinceId)),
    [criteriaFilteredRecords],
  );
  const selectedRecord = getProvinceRecord(state.selectedProvinceId, state.selectedMonth);
  const selectedProvince = provinces.find((province) => province.id === state.selectedProvinceId);
  const selectedLayer = getMapLayer(state.mapLayer);
  const layerAvailability = getLayerAvailability(state);
  const layerSources = getLayerSources(selectedLayer.id);
  const selectedProvincePath = selectedRecord ? provinceDetailPath(selectedRecord.provinceId) : null;
  const layerGroups = useMemo(
    () => Array.from(new Set(mapLayerCatalog.map((layer) => layer.group))),
    [],
  );

  const geoBounds = useMemo(() => (geo ? getGeoBounds(geo) : null), [geo]);
  const projection = useMemo(() => (geoBounds ? createGeoProjection(geoBounds) : null), [geoBounds]);
  const neighborContextFeatures = useMemo(
    () => contextGeo?.features.filter((feature) => neighborContextCountries.has(featureName(feature))) ?? [],
    [contextGeo],
  );
  const mapSelectedFeature = useMemo(
    () =>
      geo?.features.find(
        (feature) => recordForFeature(feature, selectedMonthRecords)?.provinceId === state.mapSelectedProvinceId,
      ) ?? null,
    [geo, selectedMonthRecords, state.mapSelectedProvinceId],
  );
  const previewedFeature = useMemo(
    () =>
      geo?.features.find(
        (feature) => recordForFeature(feature, selectedMonthRecords)?.provinceId === preview?.record.provinceId,
      ) ?? null,
    [geo, preview?.record.provinceId, selectedMonthRecords],
  );

  useEffect(() => {
    if (!preview) return;
    if (filteredProvinceIds.has(preview.record.provinceId)) return;
    setPreview(null);
  }, [filteredProvinceIds, preview]);

  const layerSupportsRecord = (record: ProvinceMonthRisk | undefined) => {
    if (!record) return false;
    if (selectedLayer.supportedMonths && !selectedLayer.supportedMonths.includes(state.selectedMonth)) return false;
    if (state.selectedHazard !== "All" && selectedLayer.supportedHazards && !selectedLayer.supportedHazards.includes(state.selectedHazard)) return false;
    if (state.selectedCrop !== "All" && selectedLayer.supportedCrops && !selectedLayer.supportedCrops.includes(state.selectedCrop)) return false;
    return layerHasSeededProvince(selectedLayer, record.provinceId);
  };
  const mapMatchedRecordCount = criteriaFilteredRecords.filter(layerSupportsRecord).length;
  const provinceLabels =
    geo && projection
      ? makeVisibleMapLabels(
          geo.features.flatMap((feature) => {
            const record = recordForFeature(feature, selectedMonthRecords);
            const layerAvailable = layerSupportsRecord(record);
            const filterMatch = !!record && filteredProvinceIds.has(record.provinceId) && layerAvailable;
            const isSelected = record?.provinceId === state.mapSelectedProvinceId || record?.provinceId === state.selectedProvinceId;
            const isPreviewed = record?.provinceId === preview?.record.provinceId;

            if (!record || (!filterMatch && !isSelected && !isPreviewed)) return [];

            const point = projectedLabelPointForGeometry(feature.geometry, projection);
            return [
              {
                id: record.provinceId,
                text: record.provinceTh,
                x: point.x,
                y: point.y,
                bounds: projectedBoundsForFeature(feature, projection),
                minZoom: 1.52,
                maxWidthRatio: 0.76,
                maxHeightRatio: 0.7,
                minFeatureArea: 1650,
                force: isSelected || isPreviewed,
                priority: (isSelected ? 240 : 0) + (isPreviewed ? 220 : 0) + provinceLabelPriority[record.severity],
                className: [
                  "is-province-label",
                  isSelected ? "is-selected-label" : "",
                  isPreviewed ? "is-previewed-label" : "",
                ]
                  .filter(Boolean)
                  .join(" "),
              },
            ];
          }),
          transform,
          {
            viewportWidth: mapWidth,
            viewportHeight: mapHeight,
            baseScreenFontSize: 10.4,
            minScreenFontSize: 9.4,
            maxScreenFontSize: 12.5,
            zoomFontBoost: 0.72,
            haloStrokeWidth: 3.1,
            collisionPadding: 9,
          },
        )
      : [];

  const fillForRecord = (record: ProvinceMonthRisk | undefined) => {
    if (!record) return unavailableFill;
    if (!layerSupportsRecord(record)) return noDataFill;
    if (criteria.viewMode === "risk") {
      if (selectedLayer.id === "derived-ag-risk" || selectedLayer.group === "agriculture") return severityFill[record.severity];
      if (selectedLayer.group === "operations") return record.severity === "Normal" ? "#cfd9d3" : "#2f6f58";
      return evidenceFill[record.severity];
    }
    return mapViewFill(record, criteria);
  };

  const focusProvinceRecord = (record: ProvinceMonthRisk) => {
    dispatch({ type: "selectMapProvince", provinceId: record.provinceId });
    if (record.provinceId === "TH-P17") {
      dispatch({ type: "selectEvent", eventId: MAIN_EVENT_ID });
    }
  };

  const zoomToProvince = (feature: GeoFeature) => {
    if (!projection) return;
    animateTransform(transformForProvinceFocus(feature, projection));
  };

  const focusProvince = (feature: GeoFeature) => {
    const record = recordForFeature(feature, selectedMonthRecords);
    if (!record) return;
    focusProvinceRecord(record);
    zoomToProvince(feature);
  };

  const cancelWheelAnimation = () => {
    if (wheelAnimationFrame.current !== null) window.cancelAnimationFrame(wheelAnimationFrame.current);
    wheelAnimationFrame.current = null;
    wheelTargetTransform.current = null;
  };

  const setClampedTransform = (next: MapTransform) => {
    const clamped = clampTransform(next);
    transformRef.current = clamped;
    setTransform(clamped);
  };

  const animateTransform = (target: MapTransform) => {
    cancelWheelAnimation();
    const clampedTarget = clampTransform(target);

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

  const scheduleWheelTransform = (target: MapTransform) => {
    if (animationFrame.current !== null) {
      window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }

    const clampedTarget = clampTransform(target);

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

      const next = clampTransform(interpolateMapTransform(transformRef.current, wheelTarget));

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
    if (!svg) return { x: mapWidth / 2, y: mapHeight / 2 };
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / mapWidth, rect.height / mapHeight) || 1;
    const offsetX = (rect.width - mapWidth * scale) / 2;
    const offsetY = (rect.height - mapHeight * scale) / 2;

    return {
      x: clamp((point.clientX - rect.left - offsetX) / scale, 0, mapWidth),
      y: clamp((point.clientY - rect.top - offsetY) / scale, 0, mapHeight),
    };
  };

  const svgDeltaForClient = (start: ClientPoint, point: ClientPoint) => {
    const svg = svgRef.current;
    if (!svg) return { x: point.clientX - start.clientX, y: point.clientY - start.clientY };
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / mapWidth, rect.height / mapHeight) || 1;

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
    if (previewMode.current === "touch" || previewMode.current === "pinned") return;
    cancelPreviewDismiss();
    previewDismissTimer.current = window.setTimeout(() => {
      setPreview(null);
      previewDismissTimer.current = null;
    }, 360);
  };

  const previewPositionForClient = (point: ClientPoint) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 16, y: 16 };
    const cardWidth = 268;
    const cardHeight = 286;
    const gap = 14;
    let x = point.clientX - rect.left + gap;
    let y = point.clientY - rect.top - 18;

    if (x + cardWidth > rect.width - 12) x = point.clientX - rect.left - cardWidth - gap;
    if (y + cardHeight > rect.height - 32) y = rect.height - cardHeight - 32;

    return {
      x: clamp(x, 12, Math.max(12, rect.width - cardWidth - 12)),
      y: clamp(y, 12, Math.max(12, rect.height - cardHeight - 32)),
    };
  };

  const showProvincePreview = (feature: GeoFeature, point: ClientPoint, mode: PreviewMode) => {
    const record = recordForFeature(feature, selectedMonthRecords);
    if (!record) {
      dismissPreview();
      return;
    }
    cancelPreviewDismiss();
    const position = mode === "touch" ? { x: 0, y: 0 } : previewPositionForClient(point);
    previewMode.current = mode;
    setPreview({ record, mode, ...position });
  };

  const openPreviewDetails = () => {
    if (!preview) return;
    const detailPath = provinceDetailPath(preview.record.provinceId);
    if (detailPath && onNavigate) {
      dismissPreview();
      onNavigate(detailPath);
      return;
    }
    if (previewedFeature) focusProvince(previewedFeature);
    else focusProvinceRecord(preview.record);
    dismissPreview();
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
    const k = clamp(Number((start.transform.k * (getPinchDistance(points) / start.distance)).toFixed(3)), minZoom, maxZoom);
    setClampedTransform({
      x: start.center.x + panDelta.x - ((start.center.x - start.transform.x) / start.transform.k) * k,
      y: start.center.y + panDelta.y - ((start.center.y - start.transform.y) / start.transform.k) * k,
      k,
    });
    suppressClick.current = true;
  };

  const zoomToPoint = (targetZoom: number, center = { x: mapWidth / 2, y: mapHeight / 2 }, animated = true) => {
    const current = transformRef.current;
    const target = getAnchoredZoomTransform(current, targetZoom, center, minZoom, maxZoom);

    if (animated) animateTransform(target);
    else setClampedTransform(target);
  };

  const zoomFromPoint = (delta: number, center = { x: mapWidth / 2, y: mapHeight / 2 }, animated = true) => {
    zoomToPoint(transformRef.current.k + delta, center, animated);
  };

  const handleMapWheel = (event: WheelEvent) => {
    if (isMapWheelEventFromInteractiveTarget(event.target)) return;

    const baseTransform = wheelTargetTransform.current ?? transformRef.current;
    const action = getSharedMapWheelAction(event, baseTransform.k, minZoom, maxZoom);

    if (action.type === "zoom") {
      event.preventDefault();
      if (Math.abs(action.k - baseTransform.k) > 0.003) {
        scheduleWheelTransform(getAnchoredZoomTransform(baseTransform, action.k, svgPointForClient(event), minZoom, maxZoom));
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
  }, []);

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

  const mapShellClassName = [
    "map-shell",
    compact ? "compact" : "",
    preview?.mode === "touch" ? "has-touch-preview" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={mapShellClassName} aria-label={t("map", language)}>
      <div className="map-toolbar">
        <div>
          <p className="eyebrow">{t("map", language)}</p>
          <h2>แผนที่ความเสี่ยงเกษตร 77 จังหวัด</h2>
        </div>
        <div className="map-tools" aria-label="ชั้นข้อมูลแผนที่">
          <div className="map-layer-picker">
            <Layers size={16} />
            <span>ชั้นข้อมูล</span>
            <AppSelect
              className="map-layer-select"
              ariaLabel="ชั้นข้อมูล"
              value={selectedLayer.id}
              onChange={(layer) => dispatch({ type: "setMapLayer", layer })}
              options={layerGroups.flatMap((group) =>
                mapLayerCatalog
                  .filter((layer) => layer.group === group)
                  .map((layer) => ({
                    value: layer.id,
                    label: layer.labelTh,
                    group: labelLayerGroup(group, language),
                  })),
              )}
            />
          </div>
          <div className="map-criteria-controls" aria-label="criteria แผนที่ประเทศ">
            <AppSelect
              className="map-criteria-select"
              ariaLabel="เดือนข้อมูลบนแผนที่ประเทศ"
              value={state.selectedMonth}
              onChange={(month) => dispatch({ type: "setMonth", month })}
              options={mapMonthOptions}
            />
            <AppSelect
              className="map-criteria-select"
              ariaLabel="มุมมองสีแผนที่"
              value={criteria.viewMode}
              onChange={(viewMode) => setCriteria((current) => ({ ...current, viewMode: viewMode as NationalMapViewMode }))}
              options={nationalMapViewOptions}
            />
            <AppSelect
              className="map-criteria-select"
              ariaLabel="ตัวกรองพื้นที่ศึกษา"
              value={criteria.study}
              onChange={(study) => setCriteria((current) => ({ ...current, study: study as StudyCriterion }))}
              options={studyCriterionOptions}
            />
            <AppSelect
              className="map-criteria-select"
              ariaLabel="ตัวกรองชลประทาน"
              value={criteria.irrigation}
              onChange={(irrigation) => setCriteria((current) => ({ ...current, irrigation: irrigation as IrrigationCriterion }))}
              options={irrigationCriterionOptions}
            />
            <AppSelect
              className="map-criteria-select"
              ariaLabel="ตัวกรองระดับความเสี่ยง"
              value={criteria.risk}
              onChange={(risk) => setCriteria((current) => ({ ...current, risk: risk as RiskCriterion }))}
              options={riskCriterionOptions}
            />
            <button
              type="button"
              className="map-criteria-reset"
              onClick={() => setCriteria(defaultNationalMapCriteria)}
              disabled={!criteriaActive}
              title="ล้าง criteria แผนที่ประเทศ"
            >
              <RotateCcw size={14} />
              <span>รีเซ็ต</span>
            </button>
            <span className="map-criteria-count">{mapMatchedRecordCount}/77 จังหวัด</span>
          </div>
        </div>
      </div>

      <div className="map-grid">
        <div
          ref={canvasRef}
          className={isDragging ? "map-canvas is-dragging" : "map-canvas"}
        >
          <div className="map-overlay-controls" aria-label="เครื่องมือซูมแผนที่">
            <button type="button" className="icon-button" onClick={() => zoomFromPoint(zoomStep)} disabled={transform.k >= maxZoom} title="ขยายแผนที่">
              <Plus size={16} />
            </button>
            <button type="button" className="icon-button" onClick={() => zoomFromPoint(-zoomStep)} disabled={transform.k <= minZoom} title="ย่อแผนที่">
              <Minus size={16} />
            </button>
            <button type="button" className="icon-button" onClick={() => animateTransform(countryFitTransform)} title="ดูทั้งประเทศ">
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
          {mapError ? (
            <div className="map-loading">ไม่สามารถโหลดแผนที่ได้</div>
          ) : !geo || !projection ? (
            <div className="map-loading">กำลังโหลดแผนที่...</div>
          ) : (
            <svg
              ref={svgRef}
              className="province-map-svg"
              viewBox={`0 0 ${mapWidth} ${mapHeight}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="แผนที่ความเสี่ยงรายจังหวัดของประเทศไทย"
              onPointerDown={(event) => {
                if (event.pointerType === "mouse" && event.button !== 0) return;
                lastPointerType.current = event.pointerType;
                const pointerTarget = event.target as Element | null;
                if (event.pointerType === "touch" && !pointerTarget?.closest("[data-province-id]")) {
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
              <rect className="map-water" width={mapWidth} height={mapHeight} />
              <g className="map-transform-layer" transform={`matrix(${transform.k} 0 0 ${transform.k} ${transform.x} ${transform.y})`}>
                {geoBounds && neighborContextFeatures.length > 0 && (
                  <g className="neighbor-layer" aria-hidden="true">
                    <g className="neighbor-fill-layer">
                      {neighborContextFeatures.map((feature) => (
                        <path
                          key={`${feature.properties.shapeISO}-${feature.properties.shapeName}-fill`}
                          d={pathForFeature(feature, projection)}
                          className="neighbor-shape"
                        />
                      ))}
                    </g>
                    <g className="neighbor-border-layer">
                      {neighborContextFeatures.map((feature) => {
                        const borderPath = contextBorderPathForFeature(feature, projection, geoBounds);
                        return borderPath ? (
                          <path
                            key={`${feature.properties.shapeISO}-${feature.properties.shapeName}-border`}
                            d={borderPath}
                            className="neighbor-border"
                          />
                        ) : null;
                      })}
                    </g>
                  </g>
                )}
                <g className="province-layer">
                  {geo.features.map((feature) => {
                    const record = recordForFeature(feature, selectedMonthRecords);
                    const layerAvailable = layerSupportsRecord(record);
                    const filterMatch = !!record && filteredProvinceIds.has(record.provinceId) && layerAvailable;
                    const isPreviewed = record?.provinceId === preview?.record.provinceId;
                    const fill = fillForRecord(record);
                    return (
                      <path
                        key={feature.properties.shapeISO}
                        data-province-id={record?.provinceId}
                        d={pathForFeature(feature, projection)}
                        className={[
                          "province-shape",
                          isPreviewed ? "previewed" : "",
                          filterMatch ? "match" : "dimmed",
                          layerAvailable ? "layer-available" : "layer-no-data",
                        ].join(" ")}
                        fill={fill}
                        stroke="#ffffff"
                        strokeWidth={0.8}
                        tabIndex={filterMatch ? 0 : -1}
                        role="button"
                        aria-disabled={!filterMatch || undefined}
                        aria-label={
                          record
                            ? `${record.provinceTh} ${severityLabel(record.severity, language)} ${layerAvailable ? selectedLayer.labelTh : "ไม่มีข้อมูลชั้นนี้"}${filterMatch ? "" : " ไม่ตรง criteria ที่เลือก"}`
                            : featureName(feature)
                        }
                        onPointerEnter={(event) => {
                          if (filterMatch && event.pointerType !== "touch" && previewMode.current !== "pinned" && previewMode.current !== "touch") {
                            showProvincePreview(feature, event, "hover");
                          }
                        }}
                        onPointerMove={(event) => {
                          if (filterMatch && event.pointerType !== "touch" && preview?.mode === "hover") showProvincePreview(feature, event, "hover");
                        }}
                        onFocus={() => {
                          if (!filterMatch) return;
                          if (lastPointerType.current === "touch") return;
                          const rect = canvasRef.current?.getBoundingClientRect();
                          showProvincePreview(
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
                          if (!filterMatch) {
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
                            showProvincePreview(feature, event, "touch");
                            focusProvince(feature);
                            (event.currentTarget as SVGElement & { blur?: () => void }).blur?.();
                            return;
                          }
                          showProvincePreview(feature, event, "pinned");
                          focusProvince(feature);
                          (event.currentTarget as SVGElement & { blur?: () => void }).blur?.();
                        }}
                        onKeyDown={(event) => {
                          if (!filterMatch) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            const rect = event.currentTarget.getBoundingClientRect();
                            showProvincePreview(
                              feature,
                              { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 },
                              "pinned",
                            );
                            focusProvince(feature);
                          }
                        }}
                      />
                    );
                  })}
                  {previewedFeature && (
                    <g className="province-preview-halo" aria-hidden="true">
                      <path d={pathForFeature(previewedFeature, projection)} />
                    </g>
                  )}
                  {mapSelectedFeature && (
                    <g className="province-selection-halo" aria-hidden="true">
                      <path
                        className="province-selection-halo-outer"
                        d={pathForFeature(mapSelectedFeature, projection)}
                      />
                      <path
                        className="province-selection-halo-inner"
                        d={pathForFeature(mapSelectedFeature, projection)}
                      />
                    </g>
                  )}
                  {provinceLabels.length > 0 && (
                    <g className="map-label-layer province-label-layer" aria-hidden="true">
                      {provinceLabels.map((label) => (
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
              </g>
            </svg>
          )}
          {preview && (
            <article
              className={`map-preview-card is-${preview.mode}`}
              style={preview.mode === "hover" ? { left: `${preview.x}px`, top: `${preview.y}px` } : undefined}
              role="dialog"
              aria-label={`ข้อมูลย่อจังหวัด${preview.record.provinceTh}`}
              onMouseEnter={cancelPreviewDismiss}
              onMouseLeave={schedulePreviewDismiss}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Escape") dismissPreview();
              }}
            >
              <header>
                <strong>{preview.record.provinceTh}</strong>
                <span className={`severity-pill ${severityTone[preview.record.severity]}`}>
                  {severityLabel(preview.record.severity, language)}
                </span>
              </header>
              <dl>
                <div>
                  <dt>ความเสี่ยงหลัก</dt>
                  <dd>{labelHazard(preview.record.primaryHazard, language)}</dd>
                </div>
                <div>
                  <dt>พืชที่ได้รับผลกระทบ</dt>
                  <dd>{labelCrop(preview.record.mainCropExposure, language)}</dd>
                </div>
                <div>
                  <dt>พื้นที่เกษตรเสี่ยง</dt>
                  <dd>{formatRai(preview.record.agriculturalAreaExposedRai)} ไร่</dd>
                </div>
                <div>
                  <dt>อัปเดต</dt>
                  <dd>{formatMonth(preview.record.month, language)}</dd>
                </div>
              </dl>
              <MapPreviewFooter action={{ label: "ดูรายละเอียด →", onClick: openPreviewDetails }} />
            </article>
          )}
        </div>

        <aside className="area-panel">
          <div className="status-row">
            <span className={`severity-pill ${selectedRecord ? severityTone[selectedRecord.severity] : ""}`}>
              {selectedRecord ? severityLabel(selectedRecord.severity, language) : "-"}
            </span>
            <span>{labelLayerAvailability(layerAvailability.status, language)}</span>
          </div>
          <h3>{selectedRecord?.provinceTh ?? selectedProvince?.nameTh ?? selectedProvince?.name}</h3>
          <div className="province-map-actions">
            {selectedProvincePath && onNavigate && (
              <button type="button" className="secondary-button province-workspace-open-button" onClick={() => onNavigate(selectedProvincePath)}>
                {selectedRecord?.provinceId === NAKHON_RATCHASIMA_ID ? "เปิดหน้าจังหวัด" : "เปิดโครงหน้าจังหวัด"}
              </button>
            )}
            {selectedRecord?.provinceId === "TH-P17" && (
              <button type="button" className="primary-button" onClick={() => dispatch({ type: "selectEvent", eventId: MAIN_EVENT_ID, section: "risks" })}>
                {t("openEvent", language)} ARE-2026-0825-NE
              </button>
            )}
          </div>
          {selectedRecord?.provinceId === NAKHON_RATCHASIMA_ID && <NakhonRatchasimaWorkspaceSummary compact />}
          <section className="layer-summary compact provenance-corner-host">
            <DataProvenanceChip kind={selectedLayer.dataClass} language={language} />
            <p className="eyebrow">{labelLayerGroup(selectedLayer.group, language)}</p>
            <strong>{selectedLayer.labelTh}</strong>
            <span>{layerAvailability.title}</span>
            <small>แหล่งอ้างอิง: {layerSources.map((source) => source.acronym).join(", ")}</small>
          </section>
          <section className="map-criteria-panel provenance-corner-host" aria-label="criteria ที่ใช้กับแผนที่">
            <DataProvenanceChip kind="DERIVED" language={language} />
            <p className="eyebrow">criteria แผนที่</p>
            <strong>{mapCriteriaSummaryLabel(criteria)}</strong>
            <span>รวมเงื่อนไขแบบ AND กับตัวกรองเดือน ภัย พืช และชั้นข้อมูลที่เลือกอยู่</span>
          </section>
          {selectedRecord && (
            <dl className="metric-list">
              <div>
                <dt>{t("hazard", language)}</dt>
                <dd>{labelHazard(selectedRecord.primaryHazard, language)}</dd>
              </div>
              <div>
                <dt>{t("crop", language)}</dt>
                <dd>{labelCrop(selectedRecord.mainCropExposure, language)}</dd>
              </div>
              <div>
                <dt>{t("exposedArea", language)}</dt>
                <dd>{formatRai(selectedRecord.agriculturalAreaExposedRai)} ไร่</dd>
              </div>
              <div>
                <dt>{t("confidence", language)}</dt>
                <dd>{labelConfidence(selectedRecord.confidence, language)}</dd>
              </div>
              <div>
                <dt>พื้นที่ศึกษา</dt>
                <dd>{studyCriterionForProvince(selectedRecord.provinceId) === "studied" ? "ศึกษาแล้ว" : "ยังไม่ศึกษา"}</dd>
              </div>
              <div>
                <dt>ชลประทาน</dt>
                <dd>{irrigationCriterionOptions.find((option) => option.value === irrigationCriterionForProvince(selectedRecord.provinceId))?.label}</dd>
              </div>
            </dl>
          )}
          {selectedRecord?.provinceId !== NAKHON_RATCHASIMA_ID && (
            <p className="empty-note">จังหวัดนี้มีโครงหน้าเตรียมไว้แล้ว แต่ยังไม่มีข้อมูล drill-down ระดับจังหวัดที่ยืนยัน</p>
          )}
          <div className="legend" aria-label="คำอธิบายระดับความเสี่ยง">
            {mapLegendItems(criteria, language).map((item) => (
              <span key={item.id}>
                <i style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
          <p className="provenance-note">
            {selectedLayer.noDataMeaningTh} ข้อมูลว่างในชั้นนี้ไม่เท่ากับความเสี่ยงต่ำ
          </p>
          {selectedRecord && <p className="provenance-note">{labelProvinceProvenance(selectedRecord.provenance, language)}</p>}
        </aside>
      </div>
    </section>
  );
}
