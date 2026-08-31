export type Language = "th" | "en";

export type Severity = "Normal" | "Watch" | "Warning" | "Severe";

export type DataClass = "REAL" | "DERIVED" | "CANONICAL_SYNTHETIC" | "RUNTIME_STATE";

export type LayerAvailabilityStatus = "available" | "low-risk" | "no-data" | "source-unavailable" | "unsupported";

export interface SourceRegistryRecord {
  id: string;
  acronym: string;
  name: string;
  nameTh: string;
  owner: string;
  ownerTh: string;
  category: "meteorology" | "satellite" | "hydrology" | "agriculture" | "planning" | "operations";
  dataClass: DataClass;
  coverage: string;
  coverageTh: string;
  freshness: string;
  freshnessTh: string;
  accessMode: string;
  accessModeTh: string;
  url: string;
  prototypeUse: string;
  prototypeUseTh: string;
  limitation: string;
  limitationTh: string;
}

export interface MapLayerRecord {
  id: string;
  group: "risk" | "agriculture" | "hydrology" | "weather" | "planning" | "operations";
  label: string;
  labelTh: string;
  description: string;
  descriptionTh: string;
  sourceIds: string[];
  dataClass: DataClass;
  geographyGranularity: string;
  geographyGranularityTh: string;
  temporalGranularity: string;
  temporalGranularityTh: string;
  accessMode: string;
  accessModeTh: string;
  supportedMonths?: string[];
  supportedHazards?: string[];
  supportedCrops?: string[];
  seededLocationIds?: string[];
  status: "available" | "cached" | "reference" | "token-required" | "unsupported";
  noDataMeaning: string;
  noDataMeaningTh: string;
  unavailableMeaning: string;
  unavailableMeaningTh: string;
  unsupportedMeaning: string;
  unsupportedMeaningTh: string;
}

export interface LayerAvailability {
  status: LayerAvailabilityStatus;
  title: string;
  detail: string;
}

export interface RiskFusionComponent {
  id: string;
  label: string;
  labelTh: string;
  sourceIds: string[];
  dataClass: DataClass;
  value: string;
  valueTh: string;
  interpretation: string;
  interpretationTh: string;
}

export interface RiskFusionBreakdown {
  id: string;
  formula: string;
  formulaTh: string;
  resultLabel: string;
  resultLabelTh: string;
  components: RiskFusionComponent[];
}

export type PersonaRole =
  | "National Agricultural Officer"
  | "Provincial Agricultural Officer"
  | "District Agricultural Officer"
  | "Agricultural Extension Officer"
  | "Agricultural / Climate Analyst"
  | "Water / Irrigation Authority"
  | "Supervisor / Approver"
  | "Farmer";

export type AppSection =
  | "overview"
  | "risks"
  | "map"
  | "forecast"
  | "crops"
  | "workflows"
  | "alerts"
  | "planning"
  | "models";

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

export type NakhonRatchasimaCoverageClass =
  | "REAL_LOCAL_EVIDENCE"
  | "REAL_SOURCE_CAPABILITY"
  | "REAL_DISTRICT_EVIDENCE";

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

export interface NakhonRatchasimaLocalSubset {
  meta: Record<string, unknown>;
  provinceContextEvidence: Array<{
    evidenceRef: string;
    coverageClass: string;
    topic?: string;
    recommendedDemoUse?: string;
    summaryTh?: string;
    displayRule?: string;
  }>;
  districts: Array<{
    districtCode: string;
    districtId: string;
    districtTh: string;
    districtEn: string;
    subdistricts: Array<{
      subdistrictCode: string;
      locationId: string;
      subdistrictTh: string;
      coverageClass: NakhonRatchasimaCoverageClass;
      evidenceRefs: string[];
      sourceCapabilities: string[];
      recommendedDemoUse: string;
    }>;
    districtOnlyEvidence?: Array<{
      coverageClass: NakhonRatchasimaCoverageClass;
      evidenceRefs: string[];
      hazard: string;
      crop: string;
      status: string;
      recommendedDemoUse: string;
    }>;
  }>;
}

export interface NakhonRatchasimaEvidenceRecord {
  id: string;
  provenance: DataClass;
  source_id: string;
  evidence_type: string;
  hazard?: string;
  observation_period?: string | null;
  as_of_date?: string | null;
  forecast_issued_at?: string | null;
  forecast_valid_from?: string | null;
  forecast_valid_to?: string | null;
  geography: {
    province_code?: string;
    district_code?: string | null;
    subdistrict_code?: string | null;
    scope: string;
  };
  facts: Record<string, unknown>;
  limitation: string;
}

export interface NakhonRatchasimaMapLayer {
  id: string;
  group: string;
  labelTh: string;
  classification: string;
  sourceId: string;
  access: string;
  geometry: string;
  join: string;
  defaultVisible: boolean;
  status: string;
  noData: string;
}

export interface NakhonRatchasimaMatrixRow {
  province_code: string;
  province_id: string;
  district_code: string;
  district_th: string;
  district_en: string;
  district_slug: string;
  subdistrict_code: string;
  subdistrict_id: string;
  subdistrict_th: string;
  subdistrict_slug: string;
  geometry_availability: string;
  weather_availability: string;
  drought_availability: string;
  flood_availability: string;
  hydrology_availability: string;
  crop_availability: string;
  suitability_availability: string;
  pest_availability: string;
  source_list: string;
  confidence: "MEDIUM" | "HIGH";
  no_data_rule: "NO_DATA_IS_NOT_NO_RISK";
  dwr_station_refs: string;
}

export interface NakhonRatchasimaDwrEwsStationCoverage {
  meta: {
    generatedAt: string;
    sourceId: string;
    sourceUrl: string;
    provinceCode: string;
    provinceNameTh: string;
    canonicalPeriodStart: string;
    canonicalPeriodEnd: string;
    canonicalMonthCount: number;
    capturedAt: string;
    sourceTableRows: number;
    stationOptionCount: number;
    matchedSubdistrictCount: number;
    matchedDistrictCount: number;
    usageRule: string;
    noDataRule: string;
  };
  subdistricts: Array<{
    district_code: string;
    district_th: string;
    subdistrict_code: string;
    subdistrict_th: string;
    coverage_class: "REAL_SOURCE_CAPABILITY";
    station_refs: string[];
    direct_station_refs: string[];
    covered_village_count: number;
    project_years_th: string[];
    period_status: string;
    limitation: string;
  }>;
}

export type NakhonRatchasimaRainfallCoverageStatus =
  | "direct_station"
  | "nearest_station_proxy"
  | "no_source_available";

export type NakhonRatchasimaRainfallConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface NakhonRatchasimaRainfallSourceAudit {
  meta: Record<string, unknown>;
  sources: Array<Record<string, unknown>>;
  outcome: Record<string, unknown>;
}

export interface NakhonRatchasimaRainfallStation {
  stationId: string;
  stationNameTh: string;
  agency: string;
  agencyAcronym: string;
  provinceCode: string;
  provinceTh: string;
  districtCode: string | null;
  districtTh: string;
  subdistrictCode: string | null;
  subdistrictTh: string;
  latitude: number;
  longitude: number;
  projectYearTh: string;
  activeStatus: string;
  provenance: DataClass;
  sourceId: string;
  sourceUrl: string;
  capturedAt: string;
  usageNoteTh: string;
}

export interface NakhonRatchasimaRainfallStations {
  meta: Record<string, unknown>;
  stations: NakhonRatchasimaRainfallStation[];
}

export interface NakhonRatchasimaRainfallCoverageRecord {
  provinceCode: string;
  districtCode: string;
  districtTh: string;
  subdistrictCode: string;
  subdistrictTh: string;
  coverageStatus: NakhonRatchasimaRainfallCoverageStatus;
  directStationIds: string[];
  nearestStationId: string | null;
  nearestStationNameTh: string | null;
  nearestStationDistrictTh: string | null;
  nearestStationSubdistrictTh: string | null;
  distanceKm: number | null;
  confidence: NakhonRatchasimaRainfallConfidence | null;
  confidenceTh: string | null;
  sourceIds: string[];
  sourceTimestamp: string | null;
  provenance: DataClass;
  noDataReason: string | null;
  notLocalReading: boolean;
  interpretationTh: string;
}

export interface NakhonRatchasimaRainfallCoverage {
  meta: Record<string, unknown>;
  records: NakhonRatchasimaRainfallCoverageRecord[];
}

export interface NakhonRatchasimaHistoricalRainfallWarningSample {
  evidenceId: string;
  stationId: string;
  stationNameTh: string;
  districtCode: string | null;
  subdistrictCode: string | null;
  observedAt: string | null;
  reportedValue: number;
  unit: "mm";
  provenance: DataClass;
  sourceId: string;
  usageNoteTh: string;
}

export interface NakhonRatchasimaRainfallObservations24h {
  meta: Record<string, unknown> & {
    status: string;
    unit: "mm";
    accumulationWindow: "24h";
    observationCount: number;
  };
  observations: Array<{
    stationId: string;
    observedAt: string;
    accumulationWindow: "24h";
    rainfallMm: number;
    freshness: string;
    provenance: DataClass;
    sourceId: string;
  }>;
  historicalWarningSamples: NakhonRatchasimaHistoricalRainfallWarningSample[];
}

export interface NakhonRatchasimaRainfallMonthlyHistory {
  meta: Record<string, unknown> & {
    status: string;
  };
  records: Array<{
    evidenceId: string;
    month: string | null;
    scope: string;
    sourceId: string;
    provenance: DataClass;
    facts: Record<string, unknown>;
    usageNoteTh: string;
  }>;
}

export interface NakhonRatchasimaResearchMonthlyProvinceSummary {
  period: string;
  subdistrictCount: number;
  rainfallAvgMm: number;
  rainfallMinMm: number;
  rainfallMaxMm: number;
  droughtNormalSubdistricts: number;
  droughtWatchSubdistricts: number;
  droughtSevereSubdistricts: number;
  droughtConflictKeys: number;
  irrigationCounts: Record<string, number>;
}

export interface NakhonRatchasimaResearchDistrictLatest {
  districtCode: string;
  districtNameTh: string;
  districtSlug: string;
  subdistrictCount: number;
  rainfallAvgMm: number;
  rainfallMaxMm: number;
  rainfallMinMm: number;
  topRainfallSubdistrictTh: string;
  droughtNormalSubdistricts: number;
  droughtWatchSubdistricts: number;
  droughtSevereSubdistricts: number;
  droughtConflictKeys: number;
  irrigationCounts: Record<string, number>;
}

export interface NakhonRatchasimaResearchSubdistrictLatest {
  period: string;
  districtCode: string;
  districtNameTh: string;
  districtSlug: string;
  subdistrictCode: string;
  subdistrictNameTh: string;
  subdistrictSlug: string;
  sourceResearchId: string;
  rainfallMm: number;
  rainfallUnit: "mm";
  rainfallProvenanceClass: string;
  droughtRiskLevel: number;
  droughtRiskLabelTh: string;
  droughtRiskConflict: boolean;
  droughtRiskResolutionPolicy: string;
  droughtProvenanceClass: string;
  irrigationStatus: string;
  qualityFlags: string[];
  websiteImportStatus: string;
}

export type NakhonRatchasimaResearchMonthlyPackedRecord = [
  rainfallMm: number,
  droughtRiskLevel: number,
  droughtRiskConflict: boolean,
  irrigationLegendIndex: number,
  websiteImportStatusReady: boolean,
];

export interface NakhonRatchasimaResearchMonthlyPanel {
  meta: {
    source: string;
    packing: string;
    generatedAt: string;
  };
  irrigationLegend: string[];
  periods: Record<string, Record<string, NakhonRatchasimaResearchMonthlyPackedRecord>>;
}

export interface NakhonRatchasimaResearchMonthlySubdistrictRecord {
  period: string;
  subdistrictCode: string;
  rainfallMm: number;
  rainfallUnit: "mm";
  droughtRiskLevel: number;
  droughtRiskLabelTh: string;
  droughtRiskConflict: boolean;
  irrigationStatus: string;
  websiteImportStatus: string;
}

export interface NakhonRatchasimaResearchPanelSummary {
  meta: {
    sourceOfTruth: string;
    sourceWorkbook: string;
    sourceCsv: string;
    sourceSheets: string[];
    provinceId: "TH-P29";
    provinceCode: "30";
    provinceNameTh: "นครราชสีมา";
    districtCount: number;
    subdistrictCount: number;
    periodStart: string;
    periodEnd: string;
    periodCount: number;
    normalizedRowCount: number;
    timezone: "Asia/Bangkok";
    generatedAt: string;
    dataSourceNoticeTh: string;
    conflictPolicyTh: string;
    joinPolicyTh: string;
    unavailablePrimaryDataTh: string[];
  };
  latest: NakhonRatchasimaResearchMonthlyProvinceSummary;
  monthlyProvince: NakhonRatchasimaResearchMonthlyProvinceSummary[];
  districtsLatest: NakhonRatchasimaResearchDistrictLatest[];
  subdistrictsLatest: NakhonRatchasimaResearchSubdistrictLatest[];
  topRainfallLatest: NakhonRatchasimaResearchSubdistrictLatest[];
  droughtAttentionLatest: NakhonRatchasimaResearchSubdistrictLatest[];
  droughtConflictLatest: NakhonRatchasimaResearchSubdistrictLatest[];
  qualitySummary: Array<Record<string, string>>;
  attentionFlagCounts: Record<string, number>;
  resolutionRules: Array<Record<string, string>>;
  droughtConflictSample: Array<Record<string, string>>;
}

export interface NakhonRatchasimaOfficialWaterEndpoint {
  id: string;
  labelTh: string;
  url: string;
  status: number;
  lastModified: string | null;
  statusNoteTh: string;
}

export interface NakhonRatchasimaOfficialWaterStationMetric {
  stationId: string;
  stationNameTh: string;
  districtTh: string;
  subdistrictTh: string;
  value: number;
  unit: "mm" | "celsius";
  observedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  agencyTh: string;
}

export interface NakhonRatchasimaOfficialWaterSnapshot {
  meta: {
    fetchedAt: string;
    forecastFetchedAt?: string;
    timezone: "Asia/Bangkok";
    provinceCode: "30";
    provinceId: "TH-P29";
    provinceNameTh: "นครราชสีมา";
    sourceNameTh: string;
    sourceUrl: string;
    apiBaseUrl: string;
    provenance: DataClass;
    scopeNoteTh: string;
    usageNoteTh: string;
  };
  endpoints: NakhonRatchasimaOfficialWaterEndpoint[];
  situation: {
    stormStatusTh: string;
    publicWarningCount: number;
    disasterAreas: {
      floodDistricts: number | null;
      droughtDistricts: number | null;
      noteTh: string;
      provenance: DataClass;
    };
    rain1dMax: NakhonRatchasimaOfficialWaterStationMetric | null;
    rain3dMax: NakhonRatchasimaOfficialWaterStationMetric | null;
    rain7dMax: NakhonRatchasimaOfficialWaterStationMetric | null;
    monthlyRainMax: NakhonRatchasimaOfficialWaterStationMetric | null;
    temperatureWeek: {
      maxC: number;
      minC: number;
      stationId: string;
      stationNameTh: string;
      districtTh: string;
      subdistrictTh: string;
      observedAt: string | null;
      periodStart: string | null;
      agencyTh: string;
    } | null;
    damUsableWater: {
      observedDate: string;
      usableWaterMcm: number;
      usableWaterPercent: number;
      storageMcm: number;
      storagePercent: number;
      releasedMcm: number;
      largeReservoirCount: number;
      mediumReservoirCount: number;
      sourceNoteTh: string;
    } | null;
  };
  rainfall24h: {
    stationCount: number;
    observedAtLatest: string | null;
    counts: {
      veryHeavy: number;
      heavy: number;
      moderate: number;
      light: number;
      noRain: number;
    };
    topStations: Array<{
      stationId: string;
      stationNameTh: string;
      districtTh: string;
      subdistrictTh: string;
      rainfallMm: number;
      observedAt: string;
    }>;
  };
  waterlevel: {
    stationCount: number;
    observedAtLatest: string | null;
    counts: {
      overflow: number;
      high: number;
      normal: number;
      low: number;
      criticalLow: number;
      noData: number;
    };
    keyStations: Array<{
      stationId: string;
      stationNameTh: string;
      districtTh: string;
      subdistrictTh: string;
      riverName: string;
      storagePercent: number | null;
      diffBankM: number | null;
      observedAt: string;
    }>;
  };
  forecast7d: Array<{
    day: number;
    forecastDate: string;
    rainfallMm: number;
    labelTh: string;
    mediaTimestamp: string | null;
    statusNoteTh: string;
  }>;
}

export interface NakhonRatchasimaThaiWaterDroughtForecastRecord {
  period: string;
  subdistrictCode: string;
  subdistrictNameTh: string;
  districtCode: string;
  districtNameTh: string;
  statusTh: string;
  statusEn: string;
}

export interface NakhonRatchasimaThaiWaterDroughtForecastMonth {
  monthIndex: number;
  period: string;
  labelTh: string;
  riskSubdistricts: number;
  normalSubdistricts: number;
  totalSubdistricts: number;
  riskPercent: number;
  sourceTypes: string[];
  riskTypeTh: string;
  normalTypeTh: string;
}

export interface NakhonRatchasimaThaiWaterDroughtForecast {
  meta: {
    sourceNameTh: string;
    sourceUrl: string;
    upstreamFile: string;
    issueMonth: string;
    generatedAt: string;
    timezone: "Asia/Bangkok";
    provinceCode: "30";
    provinceId: "TH-P29";
    provinceNameTh: "นครราชสีมา";
    provenance: DataClass;
    semanticsTh: string;
    totalCanonicalSubdistricts: number;
    thaiWaterSubdistricts: number;
    rowCount: number;
  };
  coverage: {
    matchedSubdistricts: number;
    missingSubdistricts: Array<{
      subdistrictCode: string;
      districtCode: string;
      districtNameTh: string;
      subdistrictNameTh: string;
    }>;
    extraSubdistrictCodes: string[];
  };
  monthly: NakhonRatchasimaThaiWaterDroughtForecastMonth[];
  records: NakhonRatchasimaThaiWaterDroughtForecastRecord[];
}

export type NakhonRatchasimaOpsmoacReportStatus =
  | "MONTHLY_REPORT_INDEXED"
  | "RELATED_WARNING_ONLY_ON_FIRST_INDEX_PAGE"
  | "CURRENT_MONTH_AWAITING_OFFICIAL_REPORT_PARSE"
  | "FORECAST_HORIZON_NO_OBSERVED_REPORT"
  | "NO_MONTHLY_REPORT_ON_FIRST_INDEX_PAGE";

export interface NakhonRatchasimaOpsmoacMonthlyReports {
  meta: {
    sourceId: string;
    sourceAgency: string;
    sourceUrl: string;
    capturedAt: string;
    canonicalPeriodStart: string;
    canonicalPeriodEnd: string;
    canonicalMonthCount: number;
    firstIndexVisibleRows: number;
    firstIndexTotalRows: number;
    indexedMonthlyReportCount: number;
    linkedAttachmentMonthCount: number;
    relatedWarningOnlyMonths: string[];
    currentAndForecastMonths: string[];
    scopeRule: string;
  };
  months: Array<{
    month: string;
    temporal_semantics: string;
    report_status: NakhonRatchasimaOpsmoacReportStatus;
    report_title?: string;
    related_title?: string;
    published_date?: string;
    published_date_th?: string;
    source_url: string;
    index_view_count?: number;
    linked_attachment_count: number;
    sample_file_urls: string[];
    sample_file_sizes: string[];
    sample_daily_labels: string[];
    prediction_use: string;
    ui_rule: string;
  }>;
}

export interface RiskCropExposure {
  crop: string;
  areaRai: number;
  highRiskRai: number;
  stage: string;
  sensitivity: string;
}

export interface RiskEvent {
  id: string;
  title: string;
  hazard: string;
  severity: Severity;
  confidence: "Low" | "Medium" | "High";
  status: string;
  primaryLocation: string;
  region: string;
  month: string;
  timeHorizon: string;
  summary: string;
  sourceContext: {
    official: string;
    url: string;
    localAssessment: string;
  };
  crops: RiskCropExposure[];
  workflow: {
    verification: string;
    advisory: string;
    approval: string;
    publication: string;
  };
}

export interface EvidenceMetricSet {
  [key: string]: string | number | undefined;
  rainfallAnomalyPct?: number;
  soilMoistureIndex?: number;
  vegetationStressIndex?: number;
  temperatureAnomalyC?: number;
  waterAvailability?: string;
  forecastProbabilityPct?: number;
  modelAgreement?: string;
  evidenceLabel?: string;
}

export interface AuditEntry {
  at: string;
  action: string;
  actor: string;
}

export interface EventEnrichment {
  owner: string;
  assignedTeam: string;
  expectedPeriod: string;
  priorityReason: string;
  locationIds: string[];
  communities: string;
  irrigationStatus: string;
  drivers: Array<{ label: string; value: string; provenance: string }>;
  expectedImpacts: string[];
  recommendedActions: Record<"farmers" | "extension" | "officers" | "water", string[]>;
  evidence: EvidenceMetricSet;
  auditTrail: AuditEntry[];
}

export interface FieldTask {
  id: string;
  riskEventId: string;
  locationId: string;
  assignedUserId: string;
  priority: string;
  status: string;
  crop: string;
  dueAt: string;
  farmerGroup: string;
  checklist: string[];
  seedObservation: {
    fieldCondition: string;
    cropStage: string;
    waterAvailability: string;
    visibleStress: string;
    farmerReportedIssues: string;
    note: string;
  };
}

export interface Advisory {
  id: string;
  linkedRiskEventId: string;
  title: string;
  status: string;
  targetAudience: string;
  targetGeography: string;
  validFrom: string;
  validTo: string;
  riskSummary: string;
  actions: string[];
  provenance: {
    officialContext: string;
    localAssessment: string;
  };
}

export interface UserPersona {
  id: string;
  username: string;
  name: string;
  role: PersonaRole;
  scope: string;
}

export interface FarmerProfile {
  farmerUserId: string;
  farmId: string;
  farmName: string;
  locationId: string;
  crop: string;
  cropStage: string;
  areaRai: number;
  irrigation: string;
  linkedRiskEventIds: string[];
  seasonalRisk: Array<{
    month: string;
    hazard: string;
    severity: string;
  }>;
  inboxSeed: Array<{
    id: string;
    title: string;
    status: string;
    linkedAdvisoryId?: string;
  }>;
  publicationRule: string;
}

export interface CropProfile {
  crop: string;
  stageSummary: string;
  augustCondition: string;
  seasonalOutlook: string;
  provincePresenceRule: string;
  activeEventIds: string[];
  topActions: string[];
}

export interface NationalMonthlyBackbone {
  month: string;
  label: string;
  mode: string;
  nationalContext: string | string[];
  prototypeUse: string;
  source: string;
  sourceType: string;
  sourceUrl: string;
}

export interface OutcomeMetric {
  riskEventId: string;
  predictedHighRiskAreaRai: number;
  verifiedAffectedAreaRai: number;
  advisoryReachPct: number;
  fieldVerificationCompletionPct: number;
  avgApprovalHours: number;
  forecastConfidenceAtIssue: string;
  interventionCompletionPct: number;
  farmerAcknowledgementPct: number;
  observedOutcome: string;
  provenance: string;
}

export interface ModelRegistryRecord {
  id: string;
  name: string;
  family: string;
  status: string;
  coverage: string;
  freshness: string;
  version: string;
  limitations: string;
  provenance: string;
}

export interface VerificationSubmission {
  fieldCondition: string;
  cropStage: string;
  waterAvailability: string;
  visibleStress: string;
  farmerReportedIssues: string;
  note: string;
  photoState: string;
}

export interface DeliveryRecord {
  channel: string;
  targeted: number;
  delivered: number;
  viewed: number;
  acknowledged: number;
}

export interface FarmerAlert {
  id: string;
  linkedAdvisoryId: string;
  linkedRiskEventId: string;
  title: string;
  createdAt: string;
  read: boolean;
}

export interface RuntimeState {
  taskStatus: Record<string, string>;
  taskSubmissions: Record<string, VerificationSubmission>;
  eventConfidence: Record<string, RiskEvent["confidence"]>;
  eventStatus: Record<string, string>;
  eventAuditTrail: Record<string, AuditEntry[]>;
  advisoryStatus: string;
  advisoryActions: string[];
  advisoryVersionHistory: AuditEntry[];
  selectedChannels: string[];
  deliveryRecords: DeliveryRecord[];
  farmerAlerts: FarmerAlert[];
}

export interface AppState {
  language: Language;
  personaId: string;
  section: AppSection;
  selectedMonth: string;
  selectedHazard: string;
  selectedCrop: string;
  selectedProvinceId: string;
  mapSelectedProvinceId: string | null;
  selectedLocationId: string;
  selectedEventId: string;
  selectedTaskId: string;
  mapLayer: string;
  toast?: string;
  runtime: RuntimeState;
}
