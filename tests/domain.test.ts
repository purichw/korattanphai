import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import archiveJson from "../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json";
import type { NakhonRatchasimaDroughtForecastArchive } from "../src/types";
import { locations, nakhonRatchasimaHierarchy } from "../src/data/catalog";
import {
  getAreaChildren, getAppSitemap, getLocationById, getNakhonRatchasimaDistrictByCode,
  getNakhonRatchasimaDistrictBySlug, getNakhonRatchasimaDistricts, getNakhonRatchasimaPath,
  getNakhonRatchasimaProvinceTabPath, getNakhonRatchasimaSubdistrictByCode,
  NAKHON_RATCHASIMA_ID, NAKHON_RATCHASIMA_PROVINCE_CODE,
  parseNakhonRatchasimaRoute, resolveAppRoute,
} from "../src/domain";

const nakhonRatchasimaDroughtForecastArchive = archiveJson as NakhonRatchasimaDroughtForecastArchive;

describe("published geography and forecast contracts", () => {
  it("builds only real Korat locations without prototype provinces, farms or villages", () => {
    expect(locations).toHaveLength(322);
    expect(locations.filter(location => location.type === "province")).toHaveLength(1);
    expect(new Set(locations.map(location => location.id)).size).toBe(322);
    expect(getLocationById(NAKHON_RATCHASIMA_ID)).toMatchObject({ nameTh: "นครราชสีมา", provinceCode: NAKHON_RATCHASIMA_PROVINCE_CODE });
    expect(getAreaChildren(NAKHON_RATCHASIMA_ID)).toHaveLength(32);
    expect(getLocationById("FARM-001")).toBeUndefined();
    expect(getLocationById("TH-P17")).toBeUndefined();
    expect(locations.every(location => ["province", "district", "subdistrict"].includes(location.type))).toBe(true);
  });

  it("preserves all administrative identities and code-based joins", () => {
    const districts = getNakhonRatchasimaDistricts();
    expect(districts).toHaveLength(32);
    const areas = districts.flatMap(district => district.subdistricts);
    expect(areas).toHaveLength(289);
    expect(new Set(areas.map(area => area.subdistrictCode)).size).toBe(289);
    for (const district of districts) {
      expect(district.provinceCode).toBe("30");
      expect(district.parent).toBe(NAKHON_RATCHASIMA_ID);
      for (const area of district.subdistricts) {
        expect(area.subdistrictCode.startsWith(district.districtCode)).toBe(true);
        expect(area.parent).toBe(district.id);
        expect(getNakhonRatchasimaSubdistrictByCode(area.subdistrictCode)).toBe(area);
        expect(parseNakhonRatchasimaRoute(getNakhonRatchasimaPath(district, area))).toMatchObject({ valid: true, level: "subdistrict", district, subdistrict: area });
      }
    }
    expect(getNakhonRatchasimaSubdistrictByCode("t-302504")).toBeUndefined();
  });

  it("keeps province and district names separate from the subdistrict named Korat", () => {
    expect(nakhonRatchasimaHierarchy.province.nameTh).toBe("นครราชสีมา");
    expect(getNakhonRatchasimaDistrictByCode("3001")).toMatchObject({ nameTh: "เมืองนครราชสีมา", routingSlug: "mueang-nakhon-ratchasima" });
    expect(getNakhonRatchasimaSubdistrictByCode("301803")).toMatchObject({ nameTh: "โคราช", districtCode: "3018", routingSlug: "t-301803" });
    expect(getNakhonRatchasimaDistrictBySlug("wang-nam-khiao")?.districtCode).toBe("3025");
  });

  it("preserves current and old deep links without reviving nationwide prototype screens", () => {
    expect(getAppSitemap().map(route => route.pattern)).toEqual(["/login", "/", "/drought", "/{district-slug}", "/{district-slug}/{subdistrict-slug}", "/nakhon-ratchasima", "/nakhon-ratchasima/{district-slug}", "/nakhon-ratchasima/{district-slug}/{subdistrict-slug}"]);
    expect(resolveAppRoute("/login").kind).toBe("login");
    for (const home of ["/", "/nakhon-ratchasima", "/nakhon-ratchasima/"]) {
      expect(resolveAppRoute(home)).toMatchObject({ kind: "nakhon-ratchasima", isWorkspace: true, target: { valid: true, level: "province", tab: "overview" } });
    }
    expect(resolveAppRoute(getNakhonRatchasimaProvinceTabPath("drought"))).toMatchObject({ target: { valid: true, level: "province", tab: "drought" } });
    for (const district of getNakhonRatchasimaDistricts()) {
      expect(parseNakhonRatchasimaRoute(`/nakhon-ratchasima/${district.routingSlug}`)).toEqual(parseNakhonRatchasimaRoute(`/${district.routingSlug}`));
      for (const area of district.subdistricts) {
        const url = getNakhonRatchasimaPath(district, area);
        expect(parseNakhonRatchasimaRoute(`/nakhon-ratchasima${url}`)).toEqual(parseNakhonRatchasimaRoute(url));
      }
    }
    for (const url of ["/water", "/bangkok", "/drought/extra", "/wang-nam-khiao/t-300101", "/wang-nam-khiao/t-302504/extra"]) {
      expect(resolveAppRoute(url)).toMatchObject({ target: { valid: false, level: "not-found" } });
    }
  });

  it("integrates the rev03 drought forecast archive without collapsing T+ vintages", () => {
    const archive = nakhonRatchasimaDroughtForecastArchive;
    expect(archive.meta).toMatchObject({
      sourceOfTruth: "normalized_rev03_original_workbook",
      sourceWorkbookOriginal: "Drought_T1-6_rev03.xlsx",
      sourceSheet: "Master_Data_Drought_Final",
      locationSheet: "Master_Data_Drought_Final",
      provenance: "REAL",
      sourceRowCountOriginal: 58312,
      sourceRowCountDeduped: 36703,
      duplicateSourceRowsRemoved: 21609,
      sourceIdCount: 289,
      targetMonthCount: 127,
      horizonCount: 6,
      forecastVintageCount: 220218,
      sourceVintageKeyCount: 220218,
      forecastVintageIdentity: "sourceId + sourceMonth + horizon",
      totalCanonicalSubdistricts: 289,
      targetMonthStart: "2015-06",
      targetMonthEnd: "2025-12",
      issueMonthStart: "2015-06",
      issueMonthEnd: "2025-12",
      temporalInterpretation: "SOURCE_YEARMONTH_IS_ORIGIN_MONTH",
    });

    expect(archive.mapping).toMatchObject({
      sourceIdCount: 289,
      mappedSourceIdCount: 289,
      mappedCanonicalSubdistrictCount: 289,
      duplicateSourceIds: [],
      unmappedSourceIds: [],
      unmatchedSources: [],
      ambiguousSourceIds: [],
      ambiguousSources: [],
      duplicateCanonicalSubdistrictCodes: [],
    });
    expect(archive.mapping.sourceCorrections).toEqual([
      expect.objectContaining({ sourceId: "222", sourceAmphoeEnCorrected: "Phimai", subdistrictCode: "301512" }),
    ]);

    expect(archive.riskSemantics).toContainEqual(
      expect.objectContaining({
        forecastRisk: null,
        scopeStatus: "out_of_scope",
        labelTh: "อยู่นอกขอบเขตการศึกษา (การพยากรณ์)",
        mapStatus: "forecast-out-of-scope",
      }),
    );

    expect(archive.horizonSummary.map((row) => row.vintageCount)).toEqual([36703, 36703, 36703, 36703, 36703, 36703]);
    expect(archive.horizonSummary.map((row) => row.outOfScopeVintages)).toEqual([21844, 21844, 21844, 21844, 21844, 21844]);
    expect(archive.horizonSummary.map((row) => row.inScopeVintages)).toEqual([14859, 14859, 14859, 14859, 14859, 14859]);

    const latest = archive.targetMonths.find((month) => month.period === "2025-12");
    expect(latest?.horizons.map((horizon) => horizon.issueMonth)).toEqual([
      "2025-12", "2025-12", "2025-12", "2025-12", "2025-12", "2025-12",
    ]);
    expect(latest?.horizons.map((horizon) => horizon.targetMonth)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
    expect(latest?.horizons.map((horizon) => horizon.noRiskSubdistricts)).toEqual([0, 0, 0, 1, 19, 49]);
    expect(latest?.horizons.map((horizon) => horizon.moderateRiskSubdistricts)).toEqual([117, 116, 79, 51, 32, 9]);
    expect(latest?.horizons.map((horizon) => horizon.highRiskSubdistricts)).toEqual([0, 1, 38, 65, 66, 59]);
    expect(latest?.horizons.map((horizon) => horizon.outOfScopeSubdistricts)).toEqual([172, 172, 172, 172, 172, 172]);

    expect(archive.packedRiskByTargetMonth["2025-12"]["300806"]).toEqual([1, 1, 1, 2, 2, 2]);
    expect(archive.packedRiskByTargetMonth["2025-12"]["300101"]).toEqual([null, null, null, null, null, null]);
    expect(archive.locations.find((l) => l.subdistrictCode === "300806")).toMatchObject({
      sourceId: "101",
      districtCode: "3008",
      subdistrictCode: "300806",
    });
    expect(latest?.horizons.map((h) => h.horizon)).toEqual([1, 2, 3, 4, 5, 6]);

    const danKhunThotCodes = getNakhonRatchasimaDistrictByCode("3008")!.subdistricts.map((row) => row.subdistrictCode);
    const danKhunThotT1Risks = danKhunThotCodes.map((code) => archive.packedRiskByTargetMonth["2025-12"][code][0]);
    expect(danKhunThotCodes).toHaveLength(16);
    expect(danKhunThotT1Risks.filter((risk) => risk === null)).toHaveLength(10);
    expect(danKhunThotT1Risks.filter((risk) => risk !== null)).toHaveLength(6);
    expect(danKhunThotT1Risks.filter((risk) => risk === 1)).toHaveLength(6);
    expect(danKhunThotT1Risks.filter((risk) => risk === 2)).toHaveLength(0);
    expect(archive.locations.find((l) => l.sourceId === "222")).toMatchObject({
      sourceAmphoeEn: "Mueang Nakhon Ratchasima", sourceAmphoeEnCorrected: "Phimai", subdistrictCode: "301512",
    });
  });

  it("keeps real subdistrict and province geometry aligned with the published hierarchy", () => {
    const geoPath = path.resolve(process.cwd(), "public/geodata/nakhon-ratchasima-subdistricts.geojson");
    const geo = JSON.parse(fs.readFileSync(geoPath, "utf8")) as {
      features: Array<{
        properties: { Admin_code: string; P_code: string; Source_Nam: string };
        geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
      }>;
    };
    const matrixCodes = new Set(getNakhonRatchasimaDistricts().flatMap((district) => district.subdistricts.map((row) => row.subdistrictCode)));
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

    const boundaryPath = path.resolve(process.cwd(), "public/geodata/nakhon-ratchasima-boundary.geojson");
    const boundary = JSON.parse(fs.readFileSync(boundaryPath, "utf8")) as {
      type: "FeatureCollection";
      bbox?: number[];
      features: Array<{
        type: "Feature";
        properties: {
          derivedFrom: string;
          sourceFeatureCount: number;
          sourceAdminCodes: string[];
          boundaryRingCount: number;
        };
        geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
      }>;
    };
    const ringsForGeometry = (geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] }) =>
      geometry.type === "Polygon" ? (geometry.coordinates as number[][][]) : (geometry.coordinates as number[][][][]).flat();
    const bboxForRings = (rings: number[][][]) =>
      rings.reduce(
        (bbox, ring) => {
          ring.forEach(([longitude, latitude]) => {
            bbox[0] = Math.min(bbox[0], longitude);
            bbox[1] = Math.min(bbox[1], latitude);
            bbox[2] = Math.max(bbox[2], longitude);
            bbox[3] = Math.max(bbox[3], latitude);
          });
          return bbox;
        },
        [Infinity, Infinity, -Infinity, -Infinity],
      );
    const sourceBbox = bboxForRings(geo.features.flatMap((feature) => ringsForGeometry(feature.geometry)));

    expect(boundary.type).toBe("FeatureCollection");
    expect(boundary.features).toHaveLength(1);
    expect(boundary.bbox).toHaveLength(4);
    const boundaryFeature = boundary.features[0];
    expect(["Polygon", "MultiPolygon"]).toContain(boundaryFeature.geometry.type);
    expect(boundaryFeature.properties.derivedFrom).toBe("public/geodata/nakhon-ratchasima-subdistricts.geojson");
    expect(boundaryFeature.properties.sourceFeatureCount).toBe(289);
    expect(boundaryFeature.properties.sourceAdminCodes).toHaveLength(289);
    expect(new Set(boundaryFeature.properties.sourceAdminCodes)).toEqual(geoCodes);
    const boundaryRings = ringsForGeometry(boundaryFeature.geometry);
    expect(boundaryFeature.properties.boundaryRingCount).toBe(boundaryRings.length);
    expect(boundaryRings.length).toBeGreaterThan(0);
    boundaryRings.forEach((ring) => {
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring[0]).toEqual(ring.at(-1));
    });
    const boundaryBbox = bboxForRings(boundaryRings);
    boundaryBbox.forEach((value, index) => {
      expect(value).toBeCloseTo(boundary.bbox![index], 11);
      expect(value).toBeCloseTo(sourceBbox[index], 11);
    });
  });

 });
