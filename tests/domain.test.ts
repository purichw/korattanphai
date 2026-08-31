import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  authenticateUsername,
  loginUsers,
} from "../src/auth";
import {
  advisory,
  fieldTasks,
  locations,
  mapLayerCatalog,
  months,
  nakhonRatchasimaDistrictSubdistrictMatrix,
  nakhonRatchasimaDwrEwsStationCoverage,
  nakhonRatchasimaEvidenceRecords,
  nakhonRatchasimaHierarchy,
  nakhonRatchasimaMapLayers,
  nakhonRatchasimaOfficialWaterSnapshot,
  nakhonRatchasimaOpsmoacMonthlyReports,
  nakhonRatchasimaRainfallMonthlyHistory,
  nakhonRatchasimaRainfallObservations24h,
  nakhonRatchasimaRainfallSourceAudit,
  nakhonRatchasimaRainfallStations,
  nakhonRatchasimaSourceMatrix,
  nakhonRatchasimaSubdistrictRainfallCoverage,
  nakhonRatchasimaTemporalMatrix,
  provinceMonthlyRisk,
  provinces,
  sourceRegistry,
} from "../src/data/catalog";
import {
  appReducer,
  createInitialState,
} from "../src/store";
import {
  FARM_ID,
  getAreaChildren,
  getAppSitemap,
  getLayerAvailability,
  getFarmerVisibleAlerts,
  getLocationById,
  getNakhonRatchasimaDistrictBySlug,
  getNakhonRatchasimaDistricts,
  getNakhonRatchasimaEvidenceForLocation,
  getNakhonRatchasimaLocalSubsetForSubdistrict,
  getNakhonRatchasimaMatrixRowBySubdistrictCode,
  getNakhonRatchasimaOpsmoacMonthlyRows,
  getNakhonRatchasimaPath,
  getNakhonRatchasimaProvinceTabPath,
  getNakhonRatchasimaRainfallCoverageRecord,
  getNakhonRatchasimaRainfallStation,
  getNakhonRatchasimaRainfallStations,
  getProvinceWorkspacePath,
  MAIN_ADVISORY_ID,
  MAIN_EVENT_ID,
  MAIN_TASK_ID,
  NAKHON_RATCHASIMA_ID,
  NAKHON_RATCHASIMA_LAYER_IDS,
  NAKHON_RATCHASIMA_PROVINCE_CODE,
  NAKHON_RATCHASIMA_ROUTE_BASE,
  normalizeName,
  parseNakhonRatchasimaRoute,
  parseProvinceWorkspaceRoute,
  resolveAppRoute,
  slugifyProvinceName,
  summarizeNakhonRatchasimaPredictionReadiness,
  summarizeNakhonRatchasimaRainfallCoverage,
} from "../src/domain";

describe("canonical data integrity", () => {
  it("keeps nationwide province-month coverage intact", () => {
    expect(provinces).toHaveLength(77);
    expect(months).toHaveLength(22);
    expect(months[0]).toBe("2025-01");
    expect(months.at(-1)).toBe("2026-10");
    expect(provinceMonthlyRisk).toHaveLength(1694);

    for (const month of months) {
      const records = provinceMonthlyRisk.filter((record) => record.month === month);
      expect(records).toHaveLength(77);
    }
  });

  it("preserves the canonical workflow chain", () => {
    expect(fieldTasks.find((task) => task.id === MAIN_TASK_ID)?.riskEventId).toBe(MAIN_EVENT_ID);
    expect(advisory.id).toBe(MAIN_ADVISORY_ID);
    expect(advisory.linkedRiskEventId).toBe(MAIN_EVENT_ID);
    expect(locations.find((location) => location.id === FARM_ID)?.type).toBe("farm");
  });

  it("joins all canonical provinces to the static Thailand ADM1 GeoJSON", () => {
    const geoPath = path.resolve(process.cwd(), "public/geodata/thailand-adm1.geojson");
    const geo = JSON.parse(fs.readFileSync(geoPath, "utf8")) as {
      features: Array<{ properties: { shapeName: string } }>;
    };
    expect(geo.features).toHaveLength(77);
    const geoNames = new Set(
      geo.features.map((feature) => normalizeName(feature.properties.shapeName.replace(/\s+Province$/i, ""))),
    );
    for (const province of provinces) {
      expect(geoNames.has(normalizeName(province.name))).toBe(true);
    }
  });

  it("keeps the regional map context lightweight and source-labelled", () => {
    const contextPath = path.resolve(process.cwd(), "public/geodata/thailand-neighbor-context.geojson");
    const context = JSON.parse(fs.readFileSync(contextPath, "utf8")) as {
      properties: { source: string; countries: string[] };
      features: Array<{ properties: { shapeISO: string; shapeName: string } }>;
    };
    expect(context.properties.source).toContain("Natural Earth");
    expect(context.features).toHaveLength(11);
    expect(new Set(context.features.map((feature) => feature.properties.shapeISO))).toEqual(
      new Set(["IDN", "KHM", "LAO", "MMR", "VNM", "IND", "BGD", "CHN", "PHL", "MYS", "BRN"]),
    );
    expect(context.properties.countries).toHaveLength(11);
  });

  it("covers the audited source families and map layer provenance contract", () => {
    expect(new Set(sourceRegistry.map((source) => source.id))).toEqual(
      new Set([
        "SRC-TMD",
        "SRC-GISTDA-DROUGHT",
        "SRC-GISTDA-FLOOD",
        "SRC-RID",
        "SRC-HII-THAIWATER",
        "SRC-DWR-EWS",
        "SRC-OAE",
        "SRC-AGRIMAP-LDD",
        "SRC-DOAE",
        "SRC-DDPM",
      ]),
    );

    expect(new Set(mapLayerCatalog.map((layer) => layer.group))).toEqual(
      new Set(["risk", "agriculture", "hydrology", "weather", "planning", "operations"]),
    );

    for (const layer of mapLayerCatalog) {
      expect(layer.sourceIds.length).toBeGreaterThan(0);
      expect(layer.dataClass).toMatch(/REAL|DERIVED|CANONICAL_SYNTHETIC|RUNTIME_STATE/);
      expect(layer.noDataMeaningTh).toBeTruthy();
      expect(layer.unavailableMeaningTh).toBeTruthy();
      expect(layer.unsupportedMeaningTh).toBeTruthy();
    }

    const derived = mapLayerCatalog.find((layer) => layer.id === "derived-ag-risk");
    expect(derived?.dataClass).toBe("DERIVED");
    expect(derived?.description.toLowerCase()).not.toContain("official score");
  });
});

describe("runtime transition contract", () => {
  it("does not show a farmer alert before publication", () => {
    const state = createInitialState();
    expect(getFarmerVisibleAlerts(state)).toHaveLength(0);
  });

  it("distinguishes the initial province context from an explicit map selection", () => {
    const initial = createInitialState();
    expect(initial.selectedProvinceId).toBe(NAKHON_RATCHASIMA_ID);
    expect(initial.mapSelectedProvinceId).toBeNull();

    const mapSelected = appReducer(initial, { type: "selectMapProvince", provinceId: "TH-P10" });
    expect(mapSelected.selectedProvinceId).toBe("TH-P10");
    expect(mapSelected.mapSelectedProvinceId).toBe("TH-P10");

    const filterSelected = appReducer(mapSelected, { type: "selectProvince", provinceId: "TH-P17" });
    expect(filterSelected.selectedProvinceId).toBe("TH-P17");
    expect(filterSelected.mapSelectedProvinceId).toBeNull();
  });

  it("distinguishes layer no-data from low-risk state", () => {
    const initial = createInitialState();
    const unsupported = getLayerAvailability({
      ...initial,
      mapLayer: "drought-crop-water",
      selectedProvinceId: "TH-P01",
      selectedLocationId: "TH-P01",
    });
    expect(unsupported.status).toBe("no-data");

    const lowRiskProvince = provinceMonthlyRisk.find((record) => record.severity === "Normal");
    expect(lowRiskProvince).toBeTruthy();
    const lowRisk = getLayerAvailability({
      ...initial,
      mapLayer: "derived-ag-risk",
      selectedMonth: lowRiskProvince!.month,
      selectedProvinceId: lowRiskProvince!.provinceId,
      selectedLocationId: lowRiskProvince!.provinceId,
    });
    expect(lowRisk.status).toBe("low-risk");
  });

  it("moves verification, review, approval, publication, and farmer alert state", () => {
    const initial = createInitialState();
    const verified = appReducer(initial, {
      type: "submitVerification",
      submission: {
        fieldCondition: "Drying between rain episodes",
        cropStage: "Tillering",
        waterAvailability: "Limited",
        visibleStress: "Leaf rolling in some plots",
        farmerReportedIssues: "Supplementary irrigation delayed",
        note: "Representative demo observation",
        photoState: "Mock photo attached",
      },
    });
    expect(verified.runtime.taskStatus[MAIN_TASK_ID]).toBe("Submitted");
    expect(verified.runtime.eventConfidence[MAIN_EVENT_ID]).toBe("High");

    const submitted = appReducer(verified, { type: "submitAdvisoryForReview" });
    expect(submitted.runtime.advisoryStatus).toBe("Ready for Review");

    const approved = appReducer(submitted, { type: "approveAdvisory" });
    expect(approved.runtime.advisoryStatus).toBe("Approved");

    const published = appReducer(approved, { type: "publishAdvisory" });
    expect(published.runtime.advisoryStatus).toBe("Published");
    expect(published.runtime.deliveryRecords.length).toBeGreaterThan(0);
    expect(getFarmerVisibleAlerts(published)).toHaveLength(1);
  });
});

describe("Nakhon Ratchasima incremental research patch", () => {
  it("keeps TH-P29 as the single canonical province and adds district children under it", () => {
    expect(provinces.filter((province) => province.id === NAKHON_RATCHASIMA_ID)).toHaveLength(1);

    const province = getLocationById(NAKHON_RATCHASIMA_ID);
    expect(province?.nameTh).toBe("นครราชสีมา");
    expect(province?.provinceCode).toBe(NAKHON_RATCHASIMA_PROVINCE_CODE);
    expect(getAreaChildren(NAKHON_RATCHASIMA_ID)).toHaveLength(32);
    expect(getNakhonRatchasimaDistricts()).toHaveLength(32);
  });

  it("preserves the 32-district and 289-subdistrict code hierarchy", () => {
    const districtCodes = new Set(nakhonRatchasimaDistrictSubdistrictMatrix.map((row) => row.district_code));
    const subdistrictCodes = new Set(nakhonRatchasimaDistrictSubdistrictMatrix.map((row) => row.subdistrict_code));

    expect(nakhonRatchasimaHierarchy.province.nameTh).toBe("นครราชสีมา");
    expect(nakhonRatchasimaHierarchy.province.provinceCode).toBe("30");
    expect(nakhonRatchasimaHierarchy.province.districts).toHaveLength(32);
    expect(nakhonRatchasimaDistrictSubdistrictMatrix).toHaveLength(289);
    expect(districtCodes).toHaveLength(32);
    expect(subdistrictCodes).toHaveLength(289);

    for (const row of nakhonRatchasimaDistrictSubdistrictMatrix) {
      expect(row.province_code).toBe("30");
      expect(row.province_id).toBe(NAKHON_RATCHASIMA_ID);
      expect(row.district_code.startsWith("30")).toBe(true);
      expect(row.subdistrict_code.startsWith(row.district_code)).toBe(true);
      expect(row.no_data_rule).toBe("NO_DATA_IS_NOT_NO_RISK");
    }
  });

  it("keeps province, district, and subdistrict names from being collapsed into province aliases", () => {
    expect(nakhonRatchasimaHierarchy.province.nameTh).toBe("นครราชสีมา");
    expect(nakhonRatchasimaHierarchy.province.name).toBe("Nakhon Ratchasima");

    const mueangDistrict = nakhonRatchasimaHierarchy.province.districts.find(
      (district) => district.districtCode === "3001",
    );
    expect(mueangDistrict?.nameTh).toBe("เมืองนครราชสีมา");
    expect(mueangDistrict?.routingSlug).toBe("mueang-nakhon-ratchasima");

    const localNameRows = nakhonRatchasimaDistrictSubdistrictMatrix.filter((row) => row.subdistrict_th === "โคราช");
    expect(localNameRows).toHaveLength(1);
    expect(localNameRows[0]).toMatchObject({
      province_code: "30",
      province_id: NAKHON_RATCHASIMA_ID,
      district_code: "3018",
      district_th: "สูงเนิน",
      subdistrict_code: "301803",
      subdistrict_slug: "t-301803",
    });

    const districtNames = new Set(nakhonRatchasimaHierarchy.province.districts.map((district) => district.nameTh));
    expect(districtNames.has("นครราชสีมา")).toBe(false);
    expect(districtNames.has("โคราช")).toBe(false);

    const internalIds = [
      ...nakhonRatchasimaMapLayers.map((layer) => layer.id),
      ...nakhonRatchasimaSourceMatrix.map((source) => source.source_id),
      ...nakhonRatchasimaEvidenceRecords.map((record) => record.id),
    ];
    expect(internalIds.every((id) => !/korat/i.test(id))).toBe(true);
  });

  it("uses slugs only for routing and admin codes for business joins", () => {
    const district = getNakhonRatchasimaDistrictBySlug("wang-nam-khiao");
    expect(district?.districtCode).toBe("3025");

    const route = parseNakhonRatchasimaRoute("/wang-nam-khiao/t-302504");
    expect(route?.valid).toBe(true);
    if (!route?.valid || route.level !== "subdistrict") throw new Error("Expected Wang Nam Khiao / Udom Sap route");

    expect(route.district.districtCode).toBe("3025");
    expect(route.subdistrict.subdistrictCode).toBe("302504");
    expect(getNakhonRatchasimaPath(route.district, route.subdistrict)).toBe(
      "/wang-nam-khiao/t-302504",
    );
    expect(getNakhonRatchasimaLocalSubsetForSubdistrict(route.subdistrict.routingSlug)).toBeUndefined();
    expect(getNakhonRatchasimaLocalSubsetForSubdistrict(route.subdistrict.subdistrictCode)?.evidenceRefs).toEqual([
      "EVID-DWR-20250510-01",
      "EVID-DWR-20250510-04",
      "EVID-DWR-20250510-06",
    ]);
  });

  it("uses Nakhon Ratchasima as the root workspace and keeps legacy aliases", () => {
    expect(getAppSitemap().map((route) => route.pattern)).toEqual([
      "/login",
      "/",
      "/drought",
      "/{district-slug}",
      "/{district-slug}/{subdistrict-slug}",
      "/nakhon-ratchasima",
      "/nakhon-ratchasima/{district-slug}",
      "/nakhon-ratchasima/{district-slug}/{subdistrict-slug}",
    ]);
    expect(getAppSitemap().every((route) => !/korat/i.test(route.pattern))).toBe(true);

    expect(slugifyProvinceName("Nakhon Ratchasima Province")).toBe("nakhon-ratchasima");
    expect(getProvinceWorkspacePath(NAKHON_RATCHASIMA_ID)).toBe(NAKHON_RATCHASIMA_ROUTE_BASE);

    expect(resolveAppRoute("/")).toMatchObject({
      kind: "nakhon-ratchasima",
      isWorkspace: true,
      target: { level: "province", tab: "overview" },
    });
    expect(resolveAppRoute("/login").kind).toBe("login");
    expect(resolveAppRoute(NAKHON_RATCHASIMA_ROUTE_BASE)).toMatchObject({
      kind: "nakhon-ratchasima",
      isWorkspace: true,
      target: { level: "province", tab: "overview" },
    });
    expect(resolveAppRoute(getNakhonRatchasimaProvinceTabPath("drought"))).toMatchObject({
      kind: "nakhon-ratchasima",
      isWorkspace: true,
      target: { level: "province", tab: "drought" },
    });
    expect(resolveAppRoute("/water")).toMatchObject({
      kind: "nakhon-ratchasima",
      isWorkspace: true,
      target: { valid: false, level: "not-found" },
    });
    expect(resolveAppRoute("/mueang-nakhon-ratchasima")).toMatchObject({
      kind: "nakhon-ratchasima",
      isWorkspace: true,
    });
    const localNameRoute = resolveAppRoute("/sung-noen/t-301803");
    expect(localNameRoute).toMatchObject({ kind: "nakhon-ratchasima", isWorkspace: true });
    if (localNameRoute.kind !== "nakhon-ratchasima" || !localNameRoute.target.valid || localNameRoute.target.level !== "subdistrict") {
      throw new Error("Expected the real subdistrict route to resolve from hierarchy");
    }
    expect(localNameRoute.target.subdistrict.nameTh).toBe("โคราช");

    const legacyRoute = resolveAppRoute("/nakhon-ratchasima/wang-nam-khiao/t-302504");
    expect(legacyRoute).toMatchObject({ kind: "nakhon-ratchasima", isWorkspace: true });

    const provinceRoute = parseProvinceWorkspaceRoute(NAKHON_RATCHASIMA_ROUTE_BASE);
    expect(provinceRoute).toBeNull();

    expect(parseProvinceWorkspaceRoute(`${NAKHON_RATCHASIMA_ROUTE_BASE}/wang-nam-khiao`)).toBeNull();
  });

  it("does not turn missing local evidence into a normal or low-risk state", () => {
    const unseeded = getNakhonRatchasimaMatrixRowBySubdistrictCode("300101");
    expect(unseeded?.subdistrict_th).toBe("ในเมือง");
    expect(getNakhonRatchasimaLocalSubsetForSubdistrict("300101")).toBeUndefined();

    const evidence = getNakhonRatchasimaEvidenceForLocation({
      districtCode: "3001",
      subdistrictCode: "300101",
    });
    expect(evidence.direct).toHaveLength(0);
    expect(evidence.inherited.length).toBeGreaterThan(0);
    expect(unseeded?.no_data_rule).toBe("NO_DATA_IS_NOT_NO_RISK");
  });

  it("keeps forecast months and provenance semantics separate from observed impacts", () => {
    const temporalRows = new Map(nakhonRatchasimaTemporalMatrix.map((row) => [row.month, row]));
    expect(temporalRows.get("2026-08")?.temporal_semantics).toBe("CURRENT_OPERATIONAL");
    expect(temporalRows.get("2026-09")?.temporal_semantics).toBe("FORECAST_OUTLOOK");
    expect(temporalRows.get("2026-10")?.temporal_semantics).toBe("FORECAST_OUTLOOK");
    expect(temporalRows.get("2026-09")?.ui_rule).toContain("Forecast language only");
    expect(nakhonRatchasimaTemporalMatrix.map((row) => row.month)).toEqual(months);
    expect(
      nakhonRatchasimaTemporalMatrix.every((row) => row.canonical_period_alignment === "2025-01..2026-10"),
    ).toBe(true);

    const nakhonRatchasimaMonthly = provinceMonthlyRisk.filter((record) => record.provinceId === NAKHON_RATCHASIMA_ID);
    expect(nakhonRatchasimaMonthly).toHaveLength(22);
    expect(nakhonRatchasimaMonthly.every((record) => record.provenance.toLowerCase().includes("synthetic"))).toBe(true);
  });

  it("keeps expanded Nakhon Ratchasima province research coverage source-backed without fabricating local observations", () => {
    const sourceIds = new Set(nakhonRatchasimaSourceMatrix.map((row) => row.source_id));
    expect(sourceIds.has("SRC-DWR-EWS")).toBe(true);
    expect(sourceIds.has("SRC-DOAE-FARMER-REGISTRATION")).toBe(true);
    expect(sourceIds.has("SRC-OPSMOAC-NAKHON-RATCHASIMA-SITUATION")).toBe(true);

    expect(nakhonRatchasimaDwrEwsStationCoverage.meta.canonicalPeriodStart).toBe(months[0]);
    expect(nakhonRatchasimaDwrEwsStationCoverage.meta.canonicalPeriodEnd).toBe(months.at(-1));
    expect(nakhonRatchasimaDwrEwsStationCoverage.meta.canonicalMonthCount).toBe(months.length);
    expect(nakhonRatchasimaDwrEwsStationCoverage.meta.stationOptionCount).toBe(49);
    expect(nakhonRatchasimaDwrEwsStationCoverage.subdistricts).toHaveLength(30);

    const coverageCodes = new Set(
      nakhonRatchasimaDwrEwsStationCoverage.subdistricts.map((record) => record.subdistrict_code),
    );
    const matrixCoverageRows = nakhonRatchasimaDistrictSubdistrictMatrix.filter(
      (row) => row.hydrology_availability === "DWR_EWS_STATION_OR_COVERAGE_VERIFIED",
    );
    expect(matrixCoverageRows).toHaveLength(30);
    expect(new Set(matrixCoverageRows.map((row) => row.subdistrict_code))).toEqual(coverageCodes);
    expect(nakhonRatchasimaDwrEwsStationCoverage.subdistricts.every((record) => record.station_refs.length > 0)).toBe(
      true,
    );
    expect(nakhonRatchasimaDwrEwsStationCoverage.meta.usageRule).toContain("Month-specific hazard status");
  });

  it("tracks OPSMOAC monthly report readiness without turning it into local predictions", () => {
    const reportRows = getNakhonRatchasimaOpsmoacMonthlyRows();
    const reportByMonth = new Map(reportRows.map((row) => [row.month, row]));
    const readiness = summarizeNakhonRatchasimaPredictionReadiness();

    expect(nakhonRatchasimaOpsmoacMonthlyReports.meta.canonicalPeriodStart).toBe(months[0]);
    expect(nakhonRatchasimaOpsmoacMonthlyReports.meta.canonicalPeriodEnd).toBe(months.at(-1));
    expect(reportRows.map((row) => row.month)).toEqual(months);
    expect(readiness.indexedMonthlyReportCount).toBe(18);
    expect(readiness.linkedAttachmentMonthCount).toBe(12);
    expect(readiness.relatedWarningOnlyMonths).toEqual(["2025-04"]);
    expect(readiness.currentAndForecastMonths).toEqual(["2026-08", "2026-09", "2026-10"]);

    expect(reportByMonth.get("2026-07")?.report_status).toBe("MONTHLY_REPORT_INDEXED");
    expect(reportByMonth.get("2026-08")?.report_status).toBe("CURRENT_MONTH_AWAITING_OFFICIAL_REPORT_PARSE");
    expect(reportByMonth.get("2026-09")?.report_status).toBe("FORECAST_HORIZON_NO_OBSERVED_REPORT");
    expect(reportByMonth.get("2025-04")?.report_status).toBe("RELATED_WARNING_ONLY_ON_FIRST_INDEX_PAGE");
    expect(reportByMonth.get("2025-01")?.linked_attachment_count).toBeGreaterThan(0);
    expect(readiness.scopeRule).toContain("do not create district/subdistrict risk scores");
  });

  it("keeps Soeng Sang crop-health evidence as investigation, not a fabricated diagnosis", () => {
    const record = nakhonRatchasimaEvidenceRecords.find(
      (item) => item.id === "EVID-DOAE-20260820-SOENGSANG",
    );
    expect(record?.provenance).toBe("REAL");
    expect(record?.geography.district_code).toBe("3003");
    expect(record?.geography.subdistrict_code).toBeNull();
    expect(record?.facts.crop).toBe("banana");
    expect(record?.facts.status).toBe("surveillance/investigation");
    expect(record?.facts.confirmed_diagnosis).toBe(false);
    expect(record?.facts).not.toHaveProperty("affected_rai");
    expect(record?.limitation).toContain("Do not invent disease name");
  });

  it("validates local map layers and GISTDA subdistrict GeoJSON coverage", () => {
    expect(nakhonRatchasimaMapLayers.length).toBeGreaterThanOrEqual(14);
    expect(nakhonRatchasimaMapLayers.every((layer) => layer.noData)).toBe(true);
    expect(
      nakhonRatchasimaMapLayers.find((layer) => layer.id === NAKHON_RATCHASIMA_LAYER_IDS.derivedAgriculturalRisk)
        ?.classification,
    ).toBe("DERIVED");
    expect(nakhonRatchasimaMapLayers.find((layer) => layer.id === NAKHON_RATCHASIMA_LAYER_IDS.rainfallStations)).toMatchObject({
      labelTh: "ปริมาณฝนและสถานี",
      sourceId: "SRC-DWR-EWS; SRC-HII-THAIWATER; SRC-TMD",
      status: "STATION_COVERAGE_READY_LIVE_RAINFALL_PENDING",
    });

    const geoPath = path.resolve(process.cwd(), "public/geodata/nakhon-ratchasima-subdistricts.geojson");
    const geo = JSON.parse(fs.readFileSync(geoPath, "utf8")) as {
      features: Array<{
        properties: { Admin_code: string; P_code: string; Source_Nam: string };
        geometry: { coordinates: number[][][] | number[][][][] };
      }>;
    };
    const matrixCodes = new Set(nakhonRatchasimaDistrictSubdistrictMatrix.map((row) => row.subdistrict_code));
    const geoCodes = new Set(geo.features.map((feature) => feature.properties.Admin_code));
    expect(geo.features).toHaveLength(289);
    expect(geoCodes).toEqual(matrixCodes);
    expect(geo.features.every((feature) => feature.properties.P_code === "30")).toBe(true);

    const firstFeature = geo.features[0];
    const firstCoordinate = JSON.stringify(firstFeature.geometry.coordinates).match(/\[([0-9.]+),([0-9.]+)\]/);
    expect(firstFeature.properties.Source_Nam).toBe("DOPA");
    expect(firstCoordinate).toBeTruthy();
    expect(Number(firstCoordinate?.[1])).toBeGreaterThan(101);
    expect(Number(firstCoordinate?.[1])).toBeLessThan(103);
    expect(Number(firstCoordinate?.[2])).toBeGreaterThan(14);
    expect(Number(firstCoordinate?.[2])).toBeLessThan(16);
  });

  it("adds Nakhon Ratchasima rainfall station coverage without fabricating rainfall observations", () => {
    const rainfallSourceIds = new Set(nakhonRatchasimaRainfallSourceAudit.sources.map((source) => source.sourceId));
    expect(rainfallSourceIds).toEqual(new Set(["SRC-HII-THAIWATER", "SRC-DWR-EWS", "SRC-TMD"]));
    expect(nakhonRatchasimaRainfallSourceAudit.outcome).toMatchObject({
      current24hIngestStatus: "PROVINCE_STATION_SNAPSHOT_CAPTURED_NO_CONFIRMED_SUBDISTRICT_CROSSWALK",
      officialWaterSnapshotStatus: "THAIWATER_PUBLIC_PROVINCIAL_ENDPOINTS_CAPTURED",
      thaiWaterRain24StationCount: 104,
      thaiWaterRain24OverlapWithDwrCoverageStations: 0,
    });

    expect(nakhonRatchasimaRainfallStations.meta.provenance).toBe("REAL");
    expect(nakhonRatchasimaRainfallStations.stations).toHaveLength(49);
    expect(getNakhonRatchasimaRainfallStations()).toHaveLength(49);
    expect(
      nakhonRatchasimaRainfallStations.stations.every(
        (station) =>
          station.provenance === "REAL" &&
          station.latitude > 14 &&
          station.latitude < 16 &&
          station.longitude > 101 &&
          station.longitude < 103,
      ),
    ).toBe(true);
    expect(getNakhonRatchasimaRainfallStation("STN0981")?.subdistrictCode).toBe("302504");

    const coverageRecords = nakhonRatchasimaSubdistrictRainfallCoverage.records;
    expect(nakhonRatchasimaSubdistrictRainfallCoverage.meta.subdistrictCount).toBe(289);
    expect(coverageRecords).toHaveLength(289);
    expect(new Set(coverageRecords.map((record) => record.subdistrictCode))).toEqual(
      new Set(nakhonRatchasimaDistrictSubdistrictMatrix.map((row) => row.subdistrict_code)),
    );
    expect(coverageRecords.filter((record) => record.coverageStatus === "direct_station")).toHaveLength(29);
    expect(coverageRecords.filter((record) => record.coverageStatus === "nearest_station_proxy")).toHaveLength(260);
    expect(coverageRecords.filter((record) => record.coverageStatus === "no_source_available")).toHaveLength(0);

    for (const record of coverageRecords) {
      expect(["direct_station", "nearest_station_proxy", "no_source_available"]).toContain(record.coverageStatus);
      if (record.coverageStatus === "nearest_station_proxy") {
        expect(record.nearestStationId).toMatch(/^STN/);
        expect(record.distanceKm).toBeGreaterThan(0);
        expect(record.confidence).toMatch(/HIGH|MEDIUM|LOW/);
        expect(record.sourceTimestamp).toBeTruthy();
        expect(record.notLocalReading).toBe(true);
      }
    }

    const direct = getNakhonRatchasimaRainfallCoverageRecord("302504");
    expect(direct?.coverageStatus).toBe("direct_station");
    expect(direct?.directStationIds).toEqual(expect.arrayContaining(["STN0778", "STN0981", "STN0982"]));
    expect(direct?.notLocalReading).toBe(false);

    const proxy = getNakhonRatchasimaRainfallCoverageRecord("300101");
    expect(proxy?.coverageStatus).toBe("nearest_station_proxy");
    expect(proxy?.notLocalReading).toBe(true);
    expect(proxy?.interpretationTh).toContain("ไม่ใช่ค่าตรวจวัดในตำบล");

    const summary = summarizeNakhonRatchasimaRainfallCoverage();
    expect(summary.directStationSubdistricts).toBe(29);
    expect(summary.nearestProxySubdistricts).toBe(260);
    expect(summary.noSourceAvailable).toBe(0);
    expect(summary.observationCount).toBe(0);
    expect(summary.proxyPolicyTh).toContain("ห้ามแสดงเป็นค่าตรวจวัดในตำบลโดยตรง");

    expect(nakhonRatchasimaRainfallObservations24h.meta.unit).toBe("mm");
    expect(nakhonRatchasimaRainfallObservations24h.meta.accumulationWindow).toBe("24h");
    expect(nakhonRatchasimaRainfallObservations24h.meta.status).toBe(
      "THAIWATER_SNAPSHOT_AVAILABLE_NO_CONFIRMED_SUBDISTRICT_CROSSWALK",
    );
    expect(nakhonRatchasimaRainfallObservations24h.observations).toHaveLength(0);
    expect(nakhonRatchasimaRainfallObservations24h.historicalWarningSamples).toHaveLength(7);
    expect(nakhonRatchasimaRainfallObservations24h.historicalWarningSamples.every((sample) => sample.provenance === "REAL")).toBe(
      true,
    );
    expect(nakhonRatchasimaRainfallMonthlyHistory.meta.status).toBe(
      "REGIONAL_CONTEXT_ONLY_NO_SUBDISTRICT_MONTHLY_TOTALS",
    );
    expect(nakhonRatchasimaRainfallMonthlyHistory.meta.historicalIngestAttempt).toMatchObject({
      requestedFromMonth: "2025-01",
      status: "PUBLIC_PROVINCIAL_ENDPOINTS_RETURN_LATEST_ONLY",
    });
    expect(
      nakhonRatchasimaRainfallMonthlyHistory.records.every((record) => record.geographyScope !== "subdistrict"),
    ).toBe(true);
  });

  it("keeps the official ThaiWater snapshot source-labelled and separate from derived agricultural risk", () => {
    expect(nakhonRatchasimaOfficialWaterSnapshot.meta.provinceId).toBe(NAKHON_RATCHASIMA_ID);
    expect(nakhonRatchasimaOfficialWaterSnapshot.meta.provinceCode).toBe(NAKHON_RATCHASIMA_PROVINCE_CODE);
    expect(nakhonRatchasimaOfficialWaterSnapshot.meta.provenance).toBe("REAL");
    expect(nakhonRatchasimaOfficialWaterSnapshot.meta.sourceUrl).toBe("https://nakhonratchasima.thaiwater.net/");
    expect(nakhonRatchasimaOfficialWaterSnapshot.meta.usageNoteTh).toContain("แยกจากคะแนนความเสี่ยงเกษตร");

    expect(nakhonRatchasimaOfficialWaterSnapshot.rainfall24h.stationCount).toBe(104);
    expect(nakhonRatchasimaOfficialWaterSnapshot.rainfall24h.topStations[0]).toMatchObject({
      stationId: "1123748",
      districtTh: "เทพารักษ์",
      subdistrictTh: "บึงปรือ",
      rainfallMm: 33.5,
    });
    expect(nakhonRatchasimaOfficialWaterSnapshot.waterlevel.stationCount).toBe(49);
    expect(nakhonRatchasimaOfficialWaterSnapshot.waterlevel.counts.noData).toBe(29);
    expect(nakhonRatchasimaOfficialWaterSnapshot.situation.damUsableWater?.usableWaterPercent).toBe(29);
    expect(nakhonRatchasimaOfficialWaterSnapshot.situation.damUsableWater?.usableWaterMcm).toBe(351);
    expect(nakhonRatchasimaOfficialWaterSnapshot.situation.rain3dMax).toMatchObject({
      stationId: "1123748",
      value: 98,
    });
    expect(nakhonRatchasimaOfficialWaterSnapshot.situation.rain7dMax).toMatchObject({
      stationId: "1123748",
      value: 104,
    });

    const endpointIds = new Set(nakhonRatchasimaOfficialWaterSnapshot.endpoints.map((endpoint) => endpoint.id));
    expect(endpointIds).toEqual(
      new Set([
        "thaiwater-rain24",
        "thaiwater-rain1d",
        "thaiwater-rain3d",
        "thaiwater-rain7d",
        "thaiwater-rainfall-month",
        "thaiwater-temperature-week",
        "thaiwater-waterlevel",
        "thaiwater-dam",
        "thaiwater-dam-uses-water",
        "thaiwater-rainfall-forecast",
        "thaiwater-warning-province",
        "thaiwater-storm-data",
      ]),
    );
  });
});

describe("login contract", () => {
  it("allows only Pointy and Somsak with case-insensitive usernames", () => {
    expect(loginUsers.map((user) => user.name)).toEqual(["Pointy", "Somsak"]);
    expect(authenticateUsername("pointy")?.name).toBe("Pointy");
    expect(authenticateUsername("Pointy")?.name).toBe("Pointy");
    expect(authenticateUsername("Somsak")?.name).toBe("Somsak");
    expect(authenticateUsername("SOMSAK")?.name).toBe("Somsak");
    expect(authenticateUsername(" someone else ")).toBeNull();
  });
});
