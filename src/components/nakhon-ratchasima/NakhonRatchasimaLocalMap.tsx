import {
  type NakhonRatchasimaRouteTarget,
  getNakhonRatchasimaResearchPanelSummary,
  getNakhonRatchasimaMatrixRowBySubdistrictCode,
  getNakhonRatchasimaDistrictByCode,
  getNakhonRatchasimaPath,
  NAKHON_RATCHASIMA_ROUTE_BASE,
} from "../../domain";
import { type NakhonRatchasimaMapLayer, type NakhonRatchasimaDroughtForecastArchive, type NakhonRatchasimaDroughtForecastArchiveTargetMonth, type NakhonRatchasimaDroughtForecastArchiveRecord } from "../../types";
import {
  type LocalMapMode,
  type NakhonRatchasimaGeoCollection,
  type ProvinceContextGeoCollection,
  type LocalProvinceBoundaryGeoCollection,
  type LocalMapTransform,
  localFitTransform,
  type LocalMapPreview,
  type PreviewMode,
  type ClientPoint,
  type PinchStart,
  useMediaQuery,
  createProjection,
  NAKHON_RATCHASIMA_NEIGHBOR_BOUNDARY_ISOS,
  districtCodeForFeature,
  localMobileFitTransform,
  transformForLocalFocus,
  localMobileFitZoom,
  localFitZoom,
  localMobileOverviewPadding,
  localDesktopOverviewPadding,
  localMobileDistrictFocusZoom,
  localDistrictFocusZoom,
  localMobileSubdistrictFocusZoom,
  localSubdistrictFocusZoom,
  localMobileDistrictFocusPadding,
  localDesktopFocusPadding,
  localMobileSelectedFocusPadding,
  layerUsesResearchCriteriaMap,
  defaultLocalMapCriteria,
  type LocalMapCriteria,
  localCriteriaEqual,
  localResearchPeriodForSelectedMonth,
  clampLocalTransform as clampMapTransform,
  isLocalTransformVisuallySettled,
  localDeferredTransformCommitDelayMs,
  prefersReducedMotion,
  localButtonAnimationDurationMs,
  clamp,
  localMapWidth,
  localMapHeight,
  localMapScale,
  type NakhonRatchasimaGeoFeature,
  localResearchRecordForSubdistrict,
  localMapStatusForResearchRecord,
  statusForSubdistrict,
  localResearchRecordMatchesCriteria,
  localMinZoom,
  localMaxZoom as defaultLocalMaxZoom,
  pathForFeature,
  pathForGeometry,
  localPreviewTitleForTarget,
  localPreviewActionForTarget,
  formatThaiNumber,
  NAKHON_RATCHASIMA_NEIGHBOR_LABELS_TH,
  localLabelPriorityForStatus,
  localZoomStep,
  type LocalMapViewMode,
  localMapViewOptions,
  type LocalStudyCriterion,
  localStudyCriterionOptions,
  type LocalRiskCriterion,
  localRiskCriterionOptions,
  coverageLabel,
  localStatusPillTone,
  localResearchPeriodLabel,
  researchLatestPeriod,
  forecastArchiveLegendStatuses,
  forecastArchiveRiskCriterionOptions,
  localMapLegendStatusesForView,
  legendStatusesForContext,
  compactCoverageLabel,
  forecastArchiveCriteriaSummaryLabel,
  localMapCriteriaSummaryLabel,
  localMapModes,
} from "./workspaceModel";
import { type AppSelectOption, AppSelect } from "../AppSelect";
import {
  type ForecastArchiveHorizon,
  forecastArchiveRecordsForSelection,
  localMapStatusForForecastRecord,
  forecastArchiveRecordMatchesCriteria,
  forecastArchiveIssueMonthForSelection,
  forecastArchiveTargetMonthForSelection,
  forecastArchiveRecordValueLabel,
  forecastArchiveRecordLabel,
} from "./forecastModel";
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useLayoutEffect,
  type CSSProperties,
} from "react";
import { useFullscreenTarget } from "../../useFullscreenTarget";
import { loadLocalMapGeometry } from "../../data/localMapGeometry";
import {
  serializeMapTransform,
  isMapTransformEffectivelyEqual,
  interpolateMapTransform,
  isMapTransformSettled,
  getSequentialButtonZoomTarget,
  isMapWheelEventFromInteractiveTarget,
  getSharedMapWheelAction,
  getAnchoredZoomTransform,
} from "../../mapInteraction";
import {
  type MapLabelCandidate,
  projectedLabelPointForGeometries,
  projectedBoundsForGeometries,
  projectedLabelPointForGeometry,
  makeVisibleMapLabels,
} from "../../mapLabels";
import {
  Plus,
  Minus,
  LocateFixed,
  Minimize2,
  Maximize2,
  RotateCcw,
} from "lucide-react";
import { DroughtForecastArchiveMapFilters } from "./ForecastControls";
import { formatMonth } from "../../i18n";
import { forecastHorizonLabel } from "../../forecastPeriod";
import { MapPreviewFooter } from "../MapPreviewFooter";
import { irrigationColors, irrigationLabels, irrigationStatusFromSource } from "../../irrigation";
import { IrrigationStatusSelect, type ForecastMapIrrigation } from "../IrrigationStatusSelect";

const subdistrictInspectionPadding = { top: 100, right: 150, bottom: 100, left: 100 };

export function NakhonRatchasimaLocalMap({
  irrigation,
  filteredSubdistrictCodes,
  target,
  layer,
  mapMode,
  onMapModeChange,
  onNavigate,
  selectedMonth,
  monthOptions,
  onMonthChange,
  forecastArchive,
  forecastArchiveMonth,
  forecastArchiveHorizon,
  forecastArchiveIssueMonth,
  selectedSubdistrictCode: externalSelectedSubdistrictCode,
  onSelectedSubdistrictChange,
  researchCriteriaEnabled = true,
  showMonthFilter = true,
  compactForecast = false,
  overviewLayout = false,
}: {
  irrigation?: ForecastMapIrrigation;
  filteredSubdistrictCodes?: string[];
  target: NakhonRatchasimaRouteTarget;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange?: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
  forecastArchive?: NakhonRatchasimaDroughtForecastArchive;
  forecastArchiveMonth?: NakhonRatchasimaDroughtForecastArchiveTargetMonth | null;
  forecastArchiveHorizon?: ForecastArchiveHorizon;
  forecastArchiveIssueMonth?: string;
  selectedSubdistrictCode?: string | null;
  onSelectedSubdistrictChange?: (subdistrictCode: string | null) => void;
  researchCriteriaEnabled?: boolean;
  showMonthFilter?: boolean;
  compactForecast?: boolean;
  overviewLayout?: boolean;
}) {
  const routeSelectedSubdistrictCode = target.valid && target.level === "subdistrict" ? target.subdistrict.subdistrictCode : undefined;
  // Single-area inspection needs a closer fit; other routes keep their zoom limits.
  const singleAreaInspection = compactForecast && Boolean(routeSelectedSubdistrictCode);
  const localMaxZoom = singleAreaInspection ? 28 : defaultLocalMaxZoom;
  const clampLocalTransform = (next: LocalMapTransform) => clampMapTransform(next, localMaxZoom);
  const activeSelectedSubdistrictCode = externalSelectedSubdistrictCode ?? routeSelectedSubdistrictCode;
  const [geo, setGeo] = useState<NakhonRatchasimaGeoCollection | null>(null);
  const [provinceContextGeo, setProvinceContextGeo] = useState<ProvinceContextGeoCollection | null>(null);
  const [localProvinceBoundaryGeo, setLocalProvinceBoundaryGeo] = useState<LocalProvinceBoundaryGeoCollection | null>(null);
  const [error, setError] = useState(false);
  const [geometryAttempt, setGeometryAttempt] = useState(0);
  const [transform, setTransform] = useState<LocalMapTransform>(localFitTransform);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(activeSelectedSubdistrictCode ?? null);
  const [preview, setPreview] = useState<LocalMapPreview | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const transformLayerRef = useRef<SVGGElement | null>(null);
  const transformRef = useRef<LocalMapTransform>(transform);
  const animationFrame = useRef<number | null>(null);
  const animationRunId = useRef(0);
  const animationSettleTimer = useRef<number | null>(null);
  const transformStateCommitTimer = useRef<number | null>(null);
  const transformStateCommitRunId = useRef(0);
  const wheelAnimationFrame = useRef<number | null>(null);
  const wheelAnimationRunId = useRef(0);
  const wheelTargetTransform = useRef<LocalMapTransform | null>(null);
  const buttonTargetTransform = useRef<LocalMapTransform | null>(null);
  const suppressClick = useRef(false);
  const lastPointerType = useRef("mouse");
  const longPressTimer = useRef<number | null>(null);
  const previewDismissTimer = useRef<number | null>(null);
  const previewMode = useRef<PreviewMode | null>(null);
  const suppressHoverPreviewUntil = useRef(0);
  const suppressHoverPreviewForSubdistrictCode = useRef<string | null>(null);
  const preservePreviewOnSelectionSync = useRef(false);
  const touchPanReady = useRef(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number; k: number; moved: boolean } | null>(
    null,
  );
  const activePointers = useRef<globalThis.Map<number, ClientPoint>>(new globalThis.Map());
  const pinchStart = useRef<PinchStart | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreenTarget(canvasRef);
  const isMobileMap = useMediaQuery("(max-width: 720px)");
  const [inspectionPlotScale, setInspectionPlotScale] = useState(1);

  useEffect(() => {
    const svg = svgRef.current;
    if (!singleAreaInspection || !geo || !svg) return;
    // Label sizes are in viewBox units; keep the selected place readable on phones.
    const updateScale = () => {
      const rect = svg.getBoundingClientRect();
      setInspectionPlotScale(Math.min(rect.width / localMapWidth, rect.height / localMapHeight) || 1);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [geo, singleAreaInspection]);

  useEffect(() => {
    let active = true;
    setError(false);
    loadLocalMapGeometry<NakhonRatchasimaGeoCollection>("/geodata/nakhon-ratchasima-subdistricts.geojson")
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
  }, [geometryAttempt]);

  useEffect(() => {
    let active = true;
    loadLocalMapGeometry<ProvinceContextGeoCollection>("/geodata/thailand-adm1.geojson")
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

  useEffect(() => {
    let active = true;
    loadLocalMapGeometry<LocalProvinceBoundaryGeoCollection>("/geodata/nakhon-ratchasima-boundary.geojson")
      .then((data: LocalProvinceBoundaryGeoCollection) => {
        if (active) setLocalProvinceBoundaryGeo(data);
      })
      .catch(() => {
        if (active) setLocalProvinceBoundaryGeo(null);
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
  const localProvinceBoundaryFeature = useMemo(() => localProvinceBoundaryGeo?.features[0] ?? null, [localProvinceBoundaryGeo]);
  const focusFeatures = useMemo(() => {
    if (!geo) return [];
    if (activeSelectedSubdistrictCode) {
      const feature = geo.features.find((item) => item.properties.Admin_code === activeSelectedSubdistrictCode);
      return feature ? [feature] : [];
    }
    if (focusDistrictCode) return geo.features.filter((feature) => districtCodeForFeature(feature) === focusDistrictCode);
    return geo.features;
  }, [activeSelectedSubdistrictCode, focusDistrictCode, geo]);
  const fitTransform = useMemo(() => {
    if (!geo || !projection) return isMobileMap ? localMobileFitTransform : localFitTransform;
    if (compactForecast) return transformForLocalFocus(geo.features, projection, 1.25, 1, overviewLayout ? { top: 18, right: 18, bottom: 45, left: 70 } : { top: 18, right: 70, bottom: 18, left: 18 });
    return transformForLocalFocus(
      geo.features,
      projection,
      isMobileMap ? localMobileFitZoom : localFitZoom,
      isMobileMap ? localMobileFitZoom : localFitZoom,
      isMobileMap ? localMobileOverviewPadding : localDesktopOverviewPadding,
    );
  }, [compactForecast, geo, isMobileMap, overviewLayout, projection]);
  const districtFocusZoom = isMobileMap ? localMobileDistrictFocusZoom : localDistrictFocusZoom;
  const subdistrictFocusZoom = singleAreaInspection ? localMaxZoom : isMobileMap ? localMobileSubdistrictFocusZoom : localSubdistrictFocusZoom;
  const districtMinimumZoom = isMobileMap ? 1.72 : 1.12;
  const subdistrictMinimumZoom = isMobileMap ? 4 : 1.56;
  const districtFocusPadding = isMobileMap ? localMobileDistrictFocusPadding : localDesktopFocusPadding;
  const selectedFocusPadding = singleAreaInspection ? subdistrictInspectionPadding : isMobileMap ? localMobileSelectedFocusPadding : localDesktopFocusPadding;
  const targetTransform = useMemo(() => {
    if (!projection) return fitTransform;
    if (singleAreaInspection) {
      return transformForLocalFocus(focusFeatures, projection, localMaxZoom, 1, selectedFocusPadding, localMaxZoom);
    }
    if (compactForecast && (activeSelectedSubdistrictCode || focusDistrictCode)) {
      return transformForLocalFocus(focusFeatures, projection, localMaxZoom, 1, { top: 28, right: 78, bottom: 28, left: 28 });
    }
    if (activeSelectedSubdistrictCode) {
      return transformForLocalFocus(focusFeatures, projection, subdistrictFocusZoom, subdistrictMinimumZoom, selectedFocusPadding);
    }
    if (focusDistrictCode) {
      return transformForLocalFocus(focusFeatures, projection, districtFocusZoom, districtMinimumZoom, districtFocusPadding);
    }
    return fitTransform;
  }, [
    activeSelectedSubdistrictCode,
    compactForecast,
    districtFocusZoom,
    districtFocusPadding,
    districtMinimumZoom,
    fitTransform,
    focusDistrictCode,
    focusFeatures,
    projection,
    selectedFocusPadding,
    singleAreaInspection,
    localMaxZoom,
    subdistrictFocusZoom,
    subdistrictMinimumZoom,
  ]);
  const selectedFeature = useMemo(
    () => geo?.features.find((feature) => feature.properties.Admin_code === selectedCode) ?? null,
    [geo, selectedCode],
  );
  const previewedFeature = useMemo(
    () => geo?.features.find((feature) => feature.properties.Admin_code === preview?.subdistrictCode) ?? null,
    [geo, preview?.subdistrictCode],
  );
  const provinceMapTab = target.valid && target.level === "province" ? target.tab : null;
  const useForecastArchiveMap = Boolean(forecastArchive && forecastArchiveMonth && forecastArchiveHorizon);
  const useIrrigationColors = useForecastArchiveMap && irrigation?.colorMode === "irrigation";
  const irrigationByCode = useMemo(() => new Map(forecastArchive?.locations.map((location) =>
    [location.subdistrictCode, irrigationStatusFromSource(location.irrigationStatus)])), [forecastArchive]);
  const useResearchCriteriaMap = researchCriteriaEnabled && !useForecastArchiveMap && target.valid && layerUsesResearchCriteriaMap(layer.id, provinceMapTab);
  const filteredCodes = useMemo(() => filteredSubdistrictCodes === undefined ? null : new Set(filteredSubdistrictCodes), [filteredSubdistrictCodes]);
  const useFilterCriteriaMap = useResearchCriteriaMap || useForecastArchiveMap || filteredCodes !== null;
  const criteriaDefaults = useMemo(() => defaultLocalMapCriteria(provinceMapTab, layer.id), [layer.id, provinceMapTab]);
  const criteriaFromLocation = () => {
    const risk = new URLSearchParams(window.location.search).get("mapRisk");
    return useForecastArchiveMap && forecastArchiveRiskCriterionOptions.some((option) => option.value === risk)
      ? { ...criteriaDefaults, risk: risk as LocalMapCriteria["risk"] } : criteriaDefaults;
  };
  const [criteria, setCriteria] = useState<LocalMapCriteria>(criteriaFromLocation);
  const changeForecastRisk = (risk: LocalMapCriteria["risk"]) => {
    setCriteria((current) => ({ ...current, risk }));
    const url = new URL(window.location.href);
    if (risk === "all") url.searchParams.delete("mapRisk");
    else url.searchParams.set("mapRisk", risk);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const criteriaActive = !localCriteriaEqual(criteria, criteriaDefaults);
  const researchSummary = getNakhonRatchasimaResearchPanelSummary();
  const activeResearchPeriod = localResearchPeriodForSelectedMonth(selectedMonth, researchSummary);
  const forecastRecordsBySubdistrict = useMemo(
    () =>
      forecastArchive
        ? forecastArchiveRecordsForSelection(
            forecastArchive,
            forecastArchiveMonth,
            forecastArchiveHorizon ?? 1,
          )
        : new globalThis.Map<string, NakhonRatchasimaDroughtForecastArchiveRecord>(),
    [forecastArchive, forecastArchiveHorizon, forecastArchiveMonth],
  );

  const cancelPendingTransformStateCommit = () => {
    transformStateCommitRunId.current += 1;
    if (transformStateCommitTimer.current !== null) window.clearTimeout(transformStateCommitTimer.current);
    transformStateCommitTimer.current = null;
  };

  const writeTransformAttribute = (next: LocalMapTransform) => {
    const layer = transformLayerRef.current;
    const matrix = serializeMapTransform(next);
    if (layer?.getAttribute("transform") !== matrix) layer?.setAttribute("transform", matrix);
  };

  const applyTransientTransform = (next: LocalMapTransform) => {
    cancelPendingTransformStateCommit();
    const clamped = clampLocalTransform(next);
    transformRef.current = clamped;
    writeTransformAttribute(clamped);
    return clamped;
  };

  const commitTransform = (next: LocalMapTransform, options: { deferReactState?: boolean } = {}) => {
    const clamped = applyTransientTransform(next);
    if (options.deferReactState) {
      const runId = ++transformStateCommitRunId.current;
      transformStateCommitTimer.current = window.setTimeout(() => {
        transformStateCommitTimer.current = null;
        if (runId !== transformStateCommitRunId.current) return;
        if (!isLocalTransformVisuallySettled(transformRef.current, clamped)) return;
        setTransform((current) => (isMapTransformEffectivelyEqual(current, clamped) ? current : clamped));
      }, localDeferredTransformCommitDelayMs);
    } else {
      setTransform((current) => (isMapTransformEffectivelyEqual(current, clamped) ? current : clamped));
    }
    return clamped;
  };

  useEffect(() => {
    setCriteria(criteriaFromLocation());
  }, [criteriaDefaults, useForecastArchiveMap]);

  useLayoutEffect(() => {
    writeTransformAttribute(transformRef.current);
  });

  useEffect(() => {
    previewMode.current = preview?.mode ?? null;
  }, [preview?.mode]);

  useEffect(
    () => () => {
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
      if (animationSettleTimer.current !== null) window.clearTimeout(animationSettleTimer.current);
      if (transformStateCommitTimer.current !== null) window.clearTimeout(transformStateCommitTimer.current);
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

  const cancelButtonAnimation = ({ clearTarget = true }: { clearTarget?: boolean } = {}) => {
    animationRunId.current += 1;
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
    animationFrame.current = null;
    if (animationSettleTimer.current !== null) window.clearTimeout(animationSettleTimer.current);
    animationSettleTimer.current = null;
    cancelPendingTransformStateCommit();
    if (clearTarget) buttonTargetTransform.current = null;
  };

  const cancelWheelAnimation = () => {
    wheelAnimationRunId.current += 1;
    if (wheelAnimationFrame.current !== null) window.cancelAnimationFrame(wheelAnimationFrame.current);
    wheelAnimationFrame.current = null;
    wheelTargetTransform.current = null;
    cancelPendingTransformStateCommit();
  };

  const clearSettledButtonTarget = (target: LocalMapTransform) => {
    if (buttonTargetTransform.current && isMapTransformEffectivelyEqual(buttonTargetTransform.current, target)) {
      buttonTargetTransform.current = null;
    }
  };

  const animateTransform = (targetTransform: LocalMapTransform, options: { preserveButtonTarget?: boolean } = {}) => {
    cancelWheelAnimation();
    const clampedTarget = clampLocalTransform(targetTransform);
    const preserveButtonTarget = options.preserveButtonTarget ?? false;
    if (!preserveButtonTarget) buttonTargetTransform.current = null;

    if (prefersReducedMotion()) {
      cancelButtonAnimation({ clearTarget: !preserveButtonTarget });
      commitTransform(clampedTarget, { deferReactState: true });
      clearSettledButtonTarget(clampedTarget);
      return;
    }

    if (isMapTransformEffectivelyEqual(transformRef.current, clampedTarget)) {
      cancelButtonAnimation({ clearTarget: !preserveButtonTarget });
      commitTransform(clampedTarget);
      clearSettledButtonTarget(clampedTarget);
      return;
    }

    cancelButtonAnimation({ clearTarget: false });
    const runId = animationRunId.current;

    const start = transformRef.current;
    const startedAt = performance.now();
    const duration = localButtonAnimationDurationMs;

    animationSettleTimer.current = window.setTimeout(() => {
      if (runId !== animationRunId.current) return;
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
      animationSettleTimer.current = null;
      commitTransform(clampedTarget, { deferReactState: true });
      clearSettledButtonTarget(clampedTarget);
    }, duration + 24);

    const tick = (now: number) => {
      if (runId !== animationRunId.current) return;
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = {
        x: start.x + (clampedTarget.x - start.x) * eased,
        y: start.y + (clampedTarget.y - start.y) * eased,
        k: start.k + (clampedTarget.k - start.k) * eased,
      };
      const shouldSettle = progress >= 1 || isLocalTransformVisuallySettled(next, clampedTarget);

      applyTransientTransform(shouldSettle ? clampedTarget : next);

      if (!shouldSettle) {
        animationFrame.current = window.requestAnimationFrame(tick);
      } else {
        animationFrame.current = null;
        if (animationSettleTimer.current !== null) window.clearTimeout(animationSettleTimer.current);
        animationSettleTimer.current = null;
        commitTransform(clampedTarget, { deferReactState: true });
        clearSettledButtonTarget(clampedTarget);
      }
    };

    animationFrame.current = window.requestAnimationFrame(tick);
  };

  const scheduleWheelTransform = (targetTransform: LocalMapTransform) => {
    cancelButtonAnimation();

    const clampedTarget = clampLocalTransform(targetTransform);

    if (prefersReducedMotion()) {
      cancelWheelAnimation();
      commitTransform(clampedTarget, { deferReactState: true });
      return;
    }

    if (isMapTransformEffectivelyEqual(transformRef.current, clampedTarget)) {
      cancelWheelAnimation();
      commitTransform(clampedTarget);
      return;
    }

    wheelTargetTransform.current = clampedTarget;

    if (wheelAnimationFrame.current !== null) return;

    wheelAnimationRunId.current += 1;
    const runId = wheelAnimationRunId.current;

    const tick = () => {
      if (runId !== wheelAnimationRunId.current) return;
      const wheelTarget = wheelTargetTransform.current;
      if (!wheelTarget) {
        wheelAnimationFrame.current = null;
        return;
      }

      const next = clampLocalTransform(interpolateMapTransform(transformRef.current, wheelTarget));

      if (isMapTransformSettled(next, wheelTarget) || isLocalTransformVisuallySettled(next, wheelTarget)) {
        commitTransform(wheelTarget, { deferReactState: true });
        wheelTargetTransform.current = null;
        wheelAnimationFrame.current = null;
        return;
      }

      applyTransientTransform(next);
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
    const forecastRecord = forecastRecordsBySubdistrict.get(subdistrictCode);
    const status = useForecastArchiveMap
      ? localMapStatusForForecastRecord(forecastRecord)
      : useResearchCriteriaMap
      ? localMapStatusForResearchRecord(researchRecord, criteria.viewMode)
      : statusForSubdistrict(row, layer.id, mapMode);
    const matchesCriteria = (!filteredCodes || filteredCodes.has(subdistrictCode)) && (useForecastArchiveMap
      ? forecastArchiveRecordMatchesCriteria(forecastRecord, criteria.risk)
      : useResearchCriteriaMap
        ? localResearchRecordMatchesCriteria(researchRecord, criteria)
        : true);
    const path = district && subdistrict ? getNakhonRatchasimaPath(district, subdistrict) : NAKHON_RATCHASIMA_ROUTE_BASE;
    const districtPath = district ? getNakhonRatchasimaPath(district) : NAKHON_RATCHASIMA_ROUTE_BASE;

    return { district, districtPath, forecastRecord, matchesCriteria, path, researchRecord, row, status, subdistrict, subdistrictCode };
  };

  const previewPositionForClient = (point: ClientPoint) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return { x: 16, y: 16 };

    const topSelectors = compactForecast ? [".nr-local-map-criteria"] : [".nr-local-map-criteria", ".nr-map-controls"];
    const topReserved = topSelectors.reduce((reserved, selector) => {
      const element = canvas?.querySelector<HTMLElement>(selector);
      if (!element) return reserved;
      const elementRect = element.getBoundingClientRect();
      if (elementRect.bottom <= rect.top || elementRect.top >= rect.bottom) return reserved;
      return Math.max(reserved, Math.min(rect.height - 12, elementRect.bottom - rect.top + 10));
    }, 12);
    const bottomReserved = [".nr-map-legend", ".nr-map-bottom-modes", ".nr-map-attribution"].reduce((reserved, selector) => {
      const element = canvas?.querySelector<HTMLElement>(selector);
      if (!element) return reserved;
      const elementRect = element.getBoundingClientRect();
      if (elementRect.bottom <= rect.top || elementRect.top >= rect.bottom) return reserved;
      return Math.max(reserved, Math.min(rect.height - topReserved - 12, rect.bottom - elementRect.top + 10));
    }, 24);

    const leftReserved = overviewLayout ? 58 : 12;
    const rightReserved = compactForecast && !overviewLayout ? 52 : 12;
    const cardWidth = Math.min(344, Math.max(compactForecast ? 180 : 240, rect.width - rightReserved - leftReserved));
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : rect.height;
    const viewportSafeHeight = Math.max(260, viewportHeight - Math.max(rect.top, 0) - 24);
    const availableHeight = Math.max(compactForecast ? 1 : 180, rect.height - topReserved - bottomReserved);
    const cardHeight = Math.min(430, availableHeight, viewportSafeHeight);
    const gap = 14;
    const maxY = Math.max(topReserved, rect.height - bottomReserved - cardHeight);
    let x = point.clientX - rect.left + gap;
    let y = point.clientY - rect.top - 18;

    if (x + cardWidth > rect.width - rightReserved) x = point.clientX - rect.left - cardWidth - gap;
    if (y + cardHeight > rect.height - bottomReserved) y = maxY;

    return {
      x: clamp(x, leftReserved, Math.max(leftReserved, rect.width - cardWidth - rightReserved)),
      y: clamp(y, topReserved, maxY),
      maxHeight: cardHeight,
      width: cardWidth,
    };
  };

  const showSubdistrictPreview = (feature: NakhonRatchasimaGeoFeature, point: ClientPoint, mode: PreviewMode) => {
    if (mode === "hover") {
      const subdistrictCode = feature.properties.Admin_code;
      if (suppressHoverPreviewForSubdistrictCode.current === subdistrictCode) return;
      if (suppressHoverPreviewForSubdistrictCode.current && suppressHoverPreviewForSubdistrictCode.current !== subdistrictCode) {
        suppressHoverPreviewForSubdistrictCode.current = null;
      }
      if (Date.now() < suppressHoverPreviewUntil.current) return;
      if (previewMode.current === "selected" || previewMode.current === "touch") return;
    }
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
    animateTransform(transformForLocalFocus([feature], projection, subdistrictFocusZoom, subdistrictMinimumZoom, selectedFocusPadding, localMaxZoom));
  };

  const clearFeatureSelection = () => {
    if (routeSelectedSubdistrictCode) return;
    if (!activeSelectedSubdistrictCode && !selectedCode && !preview) return;
    suppressHoverPreviewForSubdistrictCode.current = activeSelectedSubdistrictCode ?? selectedCode ?? preview?.subdistrictCode ?? null;
    suppressHoverPreviewUntil.current = Date.now() + 450;
    previewMode.current = null;
    cancelPreviewDismiss();
    setSelectedCode(null);
    setPreview(null);
    preservePreviewOnSelectionSync.current = false;
    onSelectedSubdistrictChange?.(null);

    if (!projection || !geo) return;
    if (focusDistrictCode) {
      const districtFeatures = geo.features.filter((feature) => districtCodeForFeature(feature) === focusDistrictCode);
      animateTransform(transformForLocalFocus(districtFeatures, projection, districtFocusZoom, districtMinimumZoom, districtFocusPadding));
      return;
    }
    animateTransform(fitTransform);
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
    applyTransientTransform({
      x: start.center.x + panDelta.x - ((start.center.x - start.transform.x) / start.transform.k) * k,
      y: start.center.y + panDelta.y - ((start.center.y - start.transform.y) / start.transform.k) * k,
      k,
    });
    suppressClick.current = true;
  };

  const zoomFromPoint = (delta: number, center = { x: localMapWidth / 2, y: localMapHeight / 2 }, animated = true) => {
    const targetTransform = getSequentialButtonZoomTarget(
      transformRef.current,
      buttonTargetTransform.current,
      delta,
      center,
      localMinZoom,
      localMaxZoom,
    );
    buttonTargetTransform.current = clampLocalTransform(targetTransform);

    if (animated) animateTransform(targetTransform, { preserveButtonTarget: true });
    else {
      commitTransform(targetTransform);
      clearSettledButtonTarget(targetTransform);
    }
  };

  const handleMapWheel = (event: WheelEvent) => {
    if (isMapWheelEventFromInteractiveTarget(event.target)) return;

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
    const finalTransform = transformRef.current;
    dragStart.current = null;
    pinchStart.current = null;
    activePointers.current.clear();
    touchPanReady.current = false;
    commitTransform(finalTransform);
    setIsDragging(false);
  };

  useEffect(() => {
    if (!selectedCode || (selectedCode === routeSelectedSubdistrictCode && (!filteredCodes || filteredCodes.has(selectedCode)))) return;
    const feature = geo?.features.find((item) => item.properties.Admin_code === selectedCode);
    if (feature && featureModel(feature).matchesCriteria) return;
    setSelectedCode(null);
    setPreview(null);
    onSelectedSubdistrictChange?.(null);
  }, [
    activeResearchPeriod.period,
    criteria,
    filteredCodes,
    forecastArchive,
    forecastArchiveHorizon,
    forecastArchiveMonth,
    geo,
    onSelectedSubdistrictChange,
    routeSelectedSubdistrictCode,
    selectedCode,
    useForecastArchiveMap,
    useResearchCriteriaMap,
  ]);

  const featureModels = useMemo(
    () =>
      geo && projection
        ? geo.features.map((feature) => ({
            feature,
            featurePath: pathForFeature(feature, projection),
            ...featureModel(feature),
          }))
        : [],
    [
      activeResearchPeriod.period,
      criteria,
      filteredCodes,
      forecastArchive,
      forecastArchiveHorizon,
      forecastArchiveMonth,
      geo,
      layer.id,
      mapMode,
      projection,
      useForecastArchiveMap,
      useResearchCriteriaMap,
    ],
  );
  useEffect(() => {
    if (preview && filteredCodes && !filteredCodes.has(preview.subdistrictCode)) {
      setPreview(null);
      previewMode.current = null;
    }
  }, [filteredCodes, preview]);
  const provinceContextPaths = useMemo(
    () =>
      projection
        ? provinceContextFeatures.map((feature) => ({
            key: `${feature.properties.shapeISO}-${feature.properties.shapeName}`,
            path: pathForGeometry(feature.geometry, projection),
          }))
        : [],
    [projection, provinceContextFeatures],
  );

  if (error) {
    return <div className="nr-map-loading" role="alert"><p>ไม่สามารถโหลดขอบเขตตำบลนครราชสีมาได้</p><div className="nr-map-recovery-actions"><button type="button" className="secondary-button" onClick={() => setGeometryAttempt(value => value + 1)}>ลองโหลดแผนที่ใหม่</button>{overviewLayout && <button type="button" className="secondary-button" onClick={() => onNavigate("/drought")}>ดูคลังพยากรณ์ย้อนหลัง</button>}</div></div>;
  }

  if (!geo || !projection) {
    return <div className="nr-map-loading" role="status" aria-busy="true">กำลังโหลดขอบเขตตำบลนครราชสีมา...</div>;
  }

  const previewTitle = preview ? localPreviewTitleForTarget(target, preview) : "";
  const previewAction = preview ? localPreviewActionForTarget(target, preview) : null;
  const previewResearch = preview ? localResearchRecordForSubdistrict(preview.subdistrictCode, activeResearchPeriod.period) : undefined;
  const previewForecastRecord = preview ? forecastRecordsBySubdistrict.get(preview.subdistrictCode) : undefined;
  const previewCardStyle =
    preview && preview.mode !== "touch"
      ? ({
          left: `${preview.x}px`,
          top: `${preview.y}px`,
          "--nr-map-preview-max-height": `${preview.maxHeight ?? 360}px`,
          "--nr-map-preview-width": `${preview.width ?? 344}px`,
        } as CSSProperties & {
          "--nr-map-preview-max-height": string;
          "--nr-map-preview-width": string;
        })
      : undefined;
  const focusedFeatureModels = featureModels.filter((model) =>
    routeSelectedSubdistrictCode
      ? model.subdistrictCode === routeSelectedSubdistrictCode
      : !focusDistrictCode || model.row?.district_code === focusDistrictCode,
  );
  const criteriaMatchedCount = focusedFeatureModels.filter((model) => model.matchesCriteria).length;
  const focusAreaCount = focusedFeatureModels.length;
  const criteriaNarrowed = filteredCodes !== null || (useForecastArchiveMap
    ? criteria.risk !== criteriaDefaults.risk
    : criteria.study !== criteriaDefaults.study || criteria.risk !== criteriaDefaults.risk);
  const criteriaStatusText =
    useFilterCriteriaMap && criteriaNarrowed
      ? criteriaMatchedCount > 0
        ? `แสดง ${formatThaiNumber(criteriaMatchedCount)} จาก ${formatThaiNumber(focusAreaCount)} ตำบล`
        : "ไม่พบตำบลที่ตรงกับตัวกรอง"
      : null;
  const provinceBoundaryPath = localProvinceBoundaryFeature ? pathForGeometry(localProvinceBoundaryFeature.geometry, projection) : "";
  const provinceBoundaryClipId = "nr-local-province-boundary-clip";
  const forecastOutOfScopePatternId = "nr-forecast-out-of-scope-hatch";
  const activeFocusSubdistrictCode = activeSelectedSubdistrictCode ?? selectedCode;
  const showProvinceSilhouette =
    target.valid && target.level === "province" && !activeFocusSubdistrictCode && provinceBoundaryPath.length > 0;
  const focusCasingModels = showProvinceSilhouette
    ? []
    : activeFocusSubdistrictCode
      ? featureModels.filter((model) => model.subdistrictCode === activeFocusSubdistrictCode)
      : focusDistrictCode
        ? focusedFeatureModels
        : [];
  const localLabels = (() => {
    const candidates: MapLabelCandidate[] = [];

    if (target.valid && target.level === "province") {
      provinceContextFeatures.forEach((feature) => {
        const label = NAKHON_RATCHASIMA_NEIGHBOR_LABELS_TH[feature.properties.shapeISO];
        if (!label) return;
        const point = projectedLabelPointForGeometries([feature.geometry], projection);

        candidates.push({
          id: `neighbor-${feature.properties.shapeISO}`,
          text: label,
          x: point.x,
          y: point.y,
          bounds: projectedBoundsForGeometries([feature.geometry], projection),
          minZoom: localMinZoom,
          maxWidthRatio: 0.8,
          maxHeightRatio: 0.72,
          minFeatureArea: 3600,
          priority: 32,
          className: "is-neighbor-label",
        });
      });

      const provinceGeometries = geo.features.map((feature) => feature.geometry);
      const provincePoint = projectedLabelPointForGeometries(provinceGeometries, projection);

      candidates.push({
        id: "province-nakhon-ratchasima",
        text: "นครราชสีมา",
        x: provincePoint.x,
        y: provincePoint.y,
        bounds: projectedBoundsForGeometries(provinceGeometries, projection),
        minZoom: localMinZoom,
        maxWidthRatio: 0.52,
        maxHeightRatio: 0.42,
        minFeatureArea: 5200,
        force: isMobileMap,
        priority: 1200,
        className: "is-province-label",
      });

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
        const visibleModels = group.models.filter((model) => !useFilterCriteriaMap || model.matchesCriteria);
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
          minZoom: isMobileMap ? 1.72 : 1.14,
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
        const isCriteriaFiltered = useFilterCriteriaMap && !model.matchesCriteria;
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
      baseScreenFontSize: singleAreaInspection ? 14 / inspectionPlotScale : 10.2,
      minScreenFontSize: singleAreaInspection ? 12 / inspectionPlotScale : 8.8,
      maxScreenFontSize: singleAreaInspection ? 16 / inspectionPlotScale : 12.1,
      zoomFontBoost: 0.62,
      haloStrokeWidth: 3,
      collisionPadding: 7,
    });
  })();

  const mapPanelClassName = [
    "nr-map-panel",
    isDragging ? "is-dragging" : "",
    preview ? "has-preview" : "",
    preview?.mode === "touch" ? "has-touch-preview" : "",
    useFilterCriteriaMap ? "has-criteria-map" : "",
    useForecastArchiveMap ? "has-forecast-archive-map" : "",
    useIrrigationColors ? "has-irrigation-colors" : "",
    isMobileMap ? "is-mobile-map" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const scale = overviewLayout && projection ? localMapScale(projection, transform) : null;

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
      {useForecastArchiveMap ? (
        <DroughtForecastArchiveMapFilters
          irrigation={irrigation}
          showMonthFilter={showMonthFilter}
          selectedMonth={selectedMonth}
          monthOptions={monthOptions}
          onMonthChange={onMonthChange}
          riskCriterion={criteria.risk}
          onRiskCriterionChange={changeForecastRisk}
          onReset={() => changeForecastRisk(criteriaDefaults.risk)}
          resetDisabled={!criteriaActive}
          statusText={irrigation && irrigation.value !== "all" ? `${irrigationLabels[irrigation.value]} · ${criteriaStatusText}` : criteriaStatusText}
          compactValue={isMobileMap}
        />
      ) : useResearchCriteriaMap ? (
        <div
          className="nr-local-map-criteria"
          aria-label="ตัวกรองแผนที่จังหวัดนครราชสีมา"
        >
          <AppSelect
            className="nr-local-map-select"
            ariaLabel="เดือนข้อมูลบนแผนที่จังหวัดนครราชสีมา"
            value={selectedMonth}
            onChange={onMonthChange}
            options={monthOptions}
            compactValue={isMobileMap}
          />
          <AppSelect
            className="nr-local-map-select"
            ariaLabel="มุมมองแผนที่"
            value={criteria.viewMode}
            onChange={(viewMode) => setCriteria((current) => ({ ...current, viewMode: viewMode as LocalMapViewMode }))}
            options={localMapViewOptions}
            compactValue={isMobileMap}
          />
          <AppSelect
            className="nr-local-map-select"
            ariaLabel="สถานะข้อมูล"
            value={criteria.study}
            onChange={(study) => setCriteria((current) => ({ ...current, study: study as LocalStudyCriterion }))}
            options={localStudyCriterionOptions}
            compactValue={isMobileMap}
          />
          <AppSelect
            className="nr-local-map-select"
            ariaLabel="ระดับภัยแล้ง"
            value={criteria.risk}
            onChange={(risk) => setCriteria((current) => ({ ...current, risk: risk as LocalRiskCriterion }))}
            options={localRiskCriterionOptions}
            compactValue={isMobileMap}
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
          {criteriaStatusText && (
            <span className="nr-local-map-filter-status" role="status" aria-live="polite">
              {criteriaStatusText}
            </span>
          )}
        </div>
      ) : irrigation ? (
        <div className="nr-local-map-criteria is-forecast-archive-controls" aria-label="ตัวกรองพื้นที่บนแผนที่">
          <IrrigationStatusSelect {...irrigation} compact />
          {criteriaStatusText && <span className="nr-local-map-filter-status" role="status">{criteriaStatusText}</span>}
        </div>
      ) : null}
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
          cancelButtonAnimation();
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
          applyTransientTransform({
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
        onClick={(event) => {
          const pointerTarget = event.target as Element | null;
          if (pointerTarget?.closest("[data-nr-subdistrict-code]")) return;
          if (suppressClick.current) return;
          clearFeatureSelection();
        }}
      >
        {(showProvinceSilhouette || useForecastArchiveMap) && (
          <defs>
            {useForecastArchiveMap && (
              <pattern
                id={forecastOutOfScopePatternId}
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="7" height="7" fill="#e2e8e4" />
                <path d="M 0 0 L 0 7" stroke="#b8c4bd" strokeWidth="2" />
              </pattern>
            )}
            {showProvinceSilhouette && (
            <clipPath id={provinceBoundaryClipId} clipPathUnits="userSpaceOnUse">
              <path d={provinceBoundaryPath} clipRule="evenodd" />
            </clipPath>
            )}
          </defs>
        )}
        <rect width={localMapWidth} height={localMapHeight} className="nr-map-water" />
        <g ref={transformLayerRef} className="nr-map-transform-layer" transform={serializeMapTransform(transform)}>
          {provinceContextFeatures.length > 0 && (
            <g className="nr-map-neighbor-province-layer" aria-hidden="true">
              {provinceContextPaths.map((featurePath) => (
                <path key={featurePath.key} d={featurePath.path} />
              ))}
            </g>
          )}
          {!showProvinceSilhouette && focusCasingModels.length > 0 && (
            <g className="nr-map-focus-casing-layer" aria-hidden="true">
              {focusCasingModels.map((model) => (
                <path key={`${model.subdistrictCode}-focus-casing`} d={model.featurePath} />
              ))}
            </g>
          )}
          <g className="nr-map-context-layer" aria-hidden="true">
            {featureModels.map((model) => (
              <path
                key={`${model.subdistrictCode}-context`}
                d={model.featurePath}
                className={
                  focusDistrictCode && (model.row?.district_code ?? districtCodeForFeature(model.feature)) === focusDistrictCode
                    ? "is-context-focus"
                    : undefined
                }
              />
            ))}
          </g>
          {featureModels.map((model) => {
            const { feature, row, status, subdistrictCode } = model;
            const isInRouteScope = routeSelectedSubdistrictCode
              ? subdistrictCode === routeSelectedSubdistrictCode
              : !focusDistrictCode || row?.district_code === focusDistrictCode;
            const isSelected = activeSelectedSubdistrictCode === subdistrictCode || selectedCode === subdistrictCode;
            const isCriteriaFiltered = useFilterCriteriaMap && (!isInRouteScope || !model.matchesCriteria);
            const irrigationStatus = irrigationByCode.get(subdistrictCode) ?? "unknown";
            return (
              <path
                key={subdistrictCode}
                data-nr-subdistrict-code={subdistrictCode}
                data-irrigation-status={irrigationStatus}
                d={model.featurePath}
                className={[
                  "nr-map-shape",
                  `is-${status}`,
                  isInRouteScope ? "in-focus" : "out-of-focus",
                  isSelected ? "is-selected" : "",
                  isCriteriaFiltered ? "is-criteria-filtered" : "",
                ].join(" ")}
                style={useIrrigationColors ? { fill: irrigationColors[irrigationStatus] } : status === "forecast-out-of-scope" ? { fill: `url(#${forecastOutOfScopePatternId})` } : undefined}
                role="button"
                tabIndex={isCriteriaFiltered ? -1 : 0}
                aria-disabled={isCriteriaFiltered || undefined}
                aria-label={`${feature.properties.T_Name_T} ${feature.properties.A_Name_T} ${useIrrigationColors ? irrigationLabels[irrigationStatus] : coverageLabel(status, mapMode)}${isCriteriaFiltered ? " ไม่ตรงเงื่อนไขที่เลือก" : ""}`}
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
                  if (event.pointerType !== "touch") {
                    if (suppressHoverPreviewForSubdistrictCode.current === subdistrictCode) {
                      suppressHoverPreviewForSubdistrictCode.current = null;
                    }
                    schedulePreviewDismiss();
                  }
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
                  if (isSelected && !routeSelectedSubdistrictCode) {
                    event.preventDefault();
                    clearFeatureSelection();
                    (event.currentTarget as SVGElement & { blur?: () => void }).blur?.();
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
                    if (isSelected && !routeSelectedSubdistrictCode) {
                      clearFeatureSelection();
                      return;
                    }
                    focusFeature(feature);
                  }
                }}
              />
            );
          })}
          {showProvinceSilhouette && (
            <g className="nr-map-province-boundary-layer" clipPath={`url(#${provinceBoundaryClipId})`} aria-hidden="true">
              <path d={provinceBoundaryPath} />
            </g>
          )}
          {previewedFeature && (
            <g className="nr-map-preview-halo" aria-hidden="true">
              <path className="nr-map-preview-halo-outer" d={pathForFeature(previewedFeature, projection)} />
              <path className="nr-map-preview-halo-inner" d={pathForFeature(previewedFeature, projection)} />
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
              {localLabels.map((label) => {
                const isProvinceLabel = label.className?.includes("is-province-label");
                return (
                  <text
                    key={label.id}
                    className={["map-label", label.className].filter(Boolean).join(" ")}
                    x={label.x}
                    y={label.y}
                    fontSize={Number((label.fontSize * (isProvinceLabel ? 1.24 : 1)).toFixed(3))}
                    strokeWidth={Number((label.strokeWidth * (isProvinceLabel ? 1.12 : 1)).toFixed(3))}
                  >
                    {label.text}
                  </text>
                );
              })}
            </g>
          )}
        </g>
        {scale && <g className="nr-map-distance-scale" transform={`translate(${localMapWidth - scale.width - 26},${localMapHeight - 62})`} aria-label={`ระยะทางโดยประมาณ ${scale.distanceKm} กิโลเมตร`}>
          <rect x="-8" y="-23" width={scale.width + 38} height="34" rx="3" fill="white" fillOpacity=".88" />
          <path d={`M0 -3V3H${scale.width}V-3M${scale.width / 2} 0V3`} fill="none" stroke="#31584b" strokeWidth="3" />
          <text x="0" y="-9">0</text><text x={scale.width} y="-9" textAnchor="end">{scale.distanceKm} กม.</text>
        </g>}
      </svg>
      {preview && (
        <article
          className={`map-preview-card nr-map-preview-card is-${preview.mode}`}
          style={previewCardStyle}
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
            {useForecastArchiveMap && forecastArchiveMonth && (
              <div>
                <dt>เดือนที่พยากรณ์</dt>
                <dd>{formatMonth(previewForecastRecord?.targetMonth ?? forecastArchiveTargetMonthForSelection(forecastArchiveMonth, forecastArchiveHorizon ?? 1), "th")}</dd>
              </div>
            )}
            {useForecastArchiveMap && forecastArchiveMonth && (
              <div>
                <dt>เดือนตั้งต้น (T)</dt>
                <dd>
                  {formatMonth(
                    previewForecastRecord?.issueMonth ?? forecastArchiveIssueMonth ??
                      forecastArchiveIssueMonthForSelection(forecastArchiveMonth, forecastArchiveHorizon ?? 1),
                    "th",
                  )}{" "}
                  · {forecastHorizonLabel(forecastArchiveHorizon ?? 1)}
                </dd>
              </div>
            )}
            {useForecastArchiveMap && (
              <div>
                <dt>สถานะชลประทาน</dt>
                <dd>{irrigationLabels[irrigationStatusFromSource(forecastArchive?.locations.find((location) => location.subdistrictCode === preview.subdistrictCode)?.irrigationStatus)]}</dd>
              </div>
            )}
            {useForecastArchiveMap && (
              <div>
                <dt>ค่าที่พยากรณ์</dt>
                <dd>
                  {forecastArchiveRecordValueLabel(previewForecastRecord)} · {forecastArchiveRecordLabel(previewForecastRecord)}
                </dd>
              </div>
            )}
            {!useForecastArchiveMap && previewResearch && (
              <div>
                <dt>เดือนข้อมูล</dt>
                <dd>
                  {formatMonth(previewResearch.period, "th")}
                  {activeResearchPeriod.isFallback ? " · ใช้เดือนล่าสุดแทน" : ""}
                </dd>
              </div>
            )}
            {!useForecastArchiveMap && previewResearch && (
              <div>
                <dt>ภัยแล้ง</dt>
                <dd>{previewResearch.droughtRiskLabelTh}</dd>
              </div>
            )}
          </dl>
          <MapPreviewFooter
            action={
              previewAction
                ? {
                    label: previewAction.label,
                    onClick: () => {
                      dismissPreview();
                      onNavigate(previewAction.path);
                    },
                  }
                : null
            }
            fallback={
              useForecastArchiveMap
                ? previewForecastRecord
                  ? "รายการนี้เป็นคำพยากรณ์ย้อนหลัง ไม่ใช่ข้อมูลความเสียหายทางการ"
                  : "ไม่มีรายการพยากรณ์สำหรับรอบนี้"
                : "ยังไม่มีข้อมูลพอให้เปิดรายละเอียดระดับตำบล"
            }
          />
        </article>
      )}
      <div className="nr-map-legend" aria-label="คำอธิบายแผนที่จังหวัดนครราชสีมา">
        {useIrrigationColors ? <strong>สถานะชลประทาน</strong> : useForecastArchiveMap && forecastArchiveMonth ? (
          <strong>พยากรณ์ {formatMonth(forecastArchiveTargetMonthForSelection(forecastArchiveMonth, forecastArchiveHorizon ?? 1), "th")}</strong>
        ) : useResearchCriteriaMap ? (
          <strong>
            {localMapViewOptions.find((option) => option.value === criteria.viewMode)?.label} {localResearchPeriodLabel(activeResearchPeriod)}
          </strong>
        ) : (
          <>
            {provinceMapTab === "drought" && <strong>ภัยแล้ง {researchLatestPeriod(researchSummary)}</strong>}
          </>
        )}
        {useIrrigationColors ? (["irrigated", "rainfed", "unknown"] as const).map((status) => (
          <span key={status}><i style={{ backgroundColor: irrigationColors[status] }} />{irrigationLabels[status]}</span>
        )) : (useForecastArchiveMap
          ? forecastArchiveLegendStatuses
          : useResearchCriteriaMap
            ? localMapLegendStatusesForView(criteria.viewMode)
            : legendStatusesForContext(layer.id, provinceMapTab)
        ).map((status) => (
          <span key={status}>
            <i className={`is-${status}`} />
            {useFilterCriteriaMap && isMobileMap ? compactCoverageLabel(status, mapMode) : coverageLabel(status, mapMode)}
          </span>
        ))}
        {useFilterCriteriaMap && (
          <>
            {criteriaNarrowed && (
              <strong>{useForecastArchiveMap ? forecastArchiveCriteriaSummaryLabel(criteria) : localMapCriteriaSummaryLabel(criteria)}</strong>
            )}
            {!useForecastArchiveMap && activeResearchPeriod.isCleared && <span>ยังไม่มีชุดข้อมูลแผนที่ในรอบนี้</span>}
            {!useForecastArchiveMap && activeResearchPeriod.isFallback && <span>ไม่มีข้อมูลในเดือนที่เลือก จึงใช้เดือนล่าสุดแทน</span>}
          </>
        )}
      </div>
      {onMapModeChange && !useFilterCriteriaMap && (
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
