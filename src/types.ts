export type Language = "th" | "en";

export type Severity = "Normal" | "Watch" | "Warning" | "Severe";

export type DataClass = "REAL" | "DERIVED" | "CANONICAL_SYNTHETIC" | "RUNTIME_STATE";

export interface ProvinceMonthRisk {
  month: string;
  provinceId: string;
  province: string;
  provinceTh: string;
  prototypeRegion: string;
  severity: Severity;
  confidence: "Low" | "Medium" | "High";
  primaryHazard: string;
  mainCropExposure: string;
  agriculturalAreaExposedRai: number;
  highRiskAreaRai: number;
  mode: string;
  provenance: string;
}

export interface LocationNode {
  id: string;
  name: string;
  nameTh?: string;
  type: "country" | "province" | "district" | "subdistrict" | "village" | "farm";
  parent?: string;
  coverage?: string;
  prototypeRegion?: string;
  region?: string;
  provinceCode?: string;
  districtCode?: string;
  subdistrictCode?: string;
  routingSlug?: string;
  routingSlugPolicy?: string;
  geometryAvailability?: string;
  geometryRef?: {
    sourceId: string;
    layerId: number | string;
    sourceKeys: Record<string, string> | string[];
    sourceCrs: string;
  };
  codeNameSourceId?: string;
  provenance?: string;
}

export interface NakhonRatchasimaSubdistrict extends LocationNode {
  type: "subdistrict";
  provinceCode: string;
  districtCode: string;
  subdistrictCode: string;
  routingSlug: string;
}

export interface NakhonRatchasimaDistrict extends LocationNode {
  type: "district";
  provinceCode: string;
  districtCode: string;
  routingSlug: string;
  subdistricts: NakhonRatchasimaSubdistrict[];
}

export interface NakhonRatchasimaHierarchy {
  meta: Record<string, unknown>;
  province: LocationNode & {
    id: "TH-P29";
    provinceCode: "30";
    routingSlug: "nakhon-ratchasima";
    districts: NakhonRatchasimaDistrict[];
  };
}

export type NakhonRatchasimaDroughtForecastArchiveRisk = 0 | 1 | 2 | null;

export type NakhonRatchasimaDroughtForecastArchiveScope = "in_scope" | "out_of_scope";

export interface NakhonRatchasimaDroughtForecastArchiveLocation {
  sourceId: string;
  sourceAreaKey: string;
  sourceTambonEn: string;
  sourceAmphoeEn: string;
  sourceAmphoeEnCorrected: string;
  sourceAdminCorrectionApplied: boolean;
  irrigationStatusRaw: string;
  irrigationStatus: string;
  provinceId: string;
  provinceCode: string;
  provinceNameTh: string;
  provinceNameEn: string;
  districtCode: string;
  districtId: string;
  districtNameTh: string;
  districtNameEn: string;
  districtSlug: string;
  subdistrictCode: string;
  subdistrictId: string;
  subdistrictNameTh: string;
  subdistrictSlug: string;
  matchStatus: "MATCHED";
  matchMethod: string;
  qualityFlags: string;
}

/** Forecast origin T and its calendar-month target T + horizon. */
export interface NakhonRatchasimaDroughtForecastArchiveHorizonSummary {
  horizon: 1 | 2 | 3 | 4 | 5 | 6;
  horizonLabel: string;
  issueMonth: string;
  targetMonth: string;
  vintageCount: number;
  inScopeSubdistricts: number;
  outOfScopeSubdistricts: number;
  noRiskSubdistricts: number;
  moderateRiskSubdistricts: number;
  highRiskSubdistricts: number;
}

/** Legacy type name; period identifies the Excel source month / forecast origin T. */
export interface NakhonRatchasimaDroughtForecastArchiveTargetMonth {
  period: string;
  labelTh: string;
  horizons: Pick<NakhonRatchasimaDroughtForecastArchiveHorizonSummary, 'horizon' | 'horizonLabel' | 'issueMonth' | 'targetMonth'>[];
}

/** Runtime projection: sourceYearMonth = issueMonth = T; targetMonth = T + horizon. */
export interface NakhonRatchasimaDroughtForecastArchiveRecord {
  sourceId: string;
  subdistrictCode: string;
  subdistrictNameTh: string;
  districtCode: string;
  districtNameTh: string;
  sourceYearMonth: string;
  targetMonth: string;
  issueMonth: string;
  horizon: 1 | 2 | 3 | 4 | 5 | 6;
  horizonLabel: string;
  forecastRisk: NakhonRatchasimaDroughtForecastArchiveRisk;
  riskLabelTh: string;
  scopeStatus: NakhonRatchasimaDroughtForecastArchiveScope;
  vintageKey: string;
  sourceVintageKey: string;
}

export interface NakhonRatchasimaDroughtForecastArchive {
  // Dataset metadata describes the full archive; this marks a partial runtime read.
  loadedSelection?: { originPeriod: string; areaCode: string; horizonCount: 1 | 6; subdistrictCount: number };
  meta: {
    sourceOfTruth: string;
    sourceWorkbook: string;
    sourceWorkbookOriginal: string;
    sourceWorkbookSha256: string;
    normalizedManifestSha256: string;
    datasetId: string;
    datasetVersion: string;
    sourceSheet: string;
    locationSheet: string;
    generatedAt: string;
    timezone: "Asia/Bangkok";
    provinceId: "TH-P29";
    provinceCode: "30";
    provinceNameTh: "นครราชสีมา";
    provinceNameEn: "Nakhon Ratchasima";
    provenance: DataClass;
    semanticsTh: string;
    sourceRowCountOriginal: number;
    sourceRowCountDeduped: number;
    duplicateSourceRowsRemoved: number;
    sourceIdCount: number;
    targetMonthCount: number;
    horizonCount: 1 | 6;
    forecastVintageCount: number;
    sourceVintageKeyCount: number;
    forecastVintageIdentity: string;
    totalCanonicalSubdistricts: number;
    periodStart: string;
    periodEnd: string;
    targetMonthStart: string;
    targetMonthEnd: string;
    issueMonthStart: string;
    issueMonthEnd: string;
    temporalInterpretation: "SOURCE_YEARMONTH_IS_ORIGIN_MONTH";
    targetMonthRule: string;
    issueMonthRule: string;
    temporalInterpretationEvidence: string[];
  };
  riskSemantics: Array<{
    forecastRisk: NakhonRatchasimaDroughtForecastArchiveRisk;
    scopeStatus: NakhonRatchasimaDroughtForecastArchiveScope;
    labelTh: string;
    mapStatus: string;
  }>;
  mapping: {
    sourceIdCount: number;
    mappedSourceIdCount: number;
    mappedCanonicalSubdistrictCount: number;
    duplicateSourceIds: string[];
    unmappedSourceIds: string[];
    unmatchedSources: Array<Record<string, string>>;
    ambiguousSourceIds: string[];
    ambiguousSources: Array<Record<string, unknown>>;
    duplicateCanonicalSubdistrictCodes: string[];
    sourceCorrections: Array<Record<string, string>>;
    geodataLabelOverrides: Array<Record<string, string>>;
  };
  locations: NakhonRatchasimaDroughtForecastArchiveLocation[];
  targetMonths: NakhonRatchasimaDroughtForecastArchiveTargetMonth[];
  horizonSummary: Array<{
    horizon: 1 | 2 | 3 | 4 | 5 | 6;
    horizonLabel: string;
    vintageCount: number;
    inScopeVintages: number;
    outOfScopeVintages: number;
    noRiskVintages: number;
    moderateRiskVintages: number;
    highRiskVintages: number;
  }>;
  validationExamples: Record<string, unknown>;
  packedRiskByTargetMonth: Record<string, Record<string, NakhonRatchasimaDroughtForecastArchiveRisk[]>>;
}

export interface AppState {
  language: Language;
  selectedMonth: string;
  toast?: string;
}
