import advisoryJson from "./canonical/advisory.json";
import cropProfilesJson from "./canonical/crop_profiles.json";
import dataModelRegistryJson from "./canonical/data_model_registry.json";
import dataPeriodJson from "./canonical/data_period.json";
import eventDetailEnrichmentJson from "./canonical/event_detail_enrichment.json";
import farmerProfileJson from "./canonical/farmer_profile.json";
import fieldTasksJson from "./canonical/field_verification_tasks.json";
import historicalAnaloguesJson from "./canonical/historical_analogues.json";
import locationsJson from "./canonical/locations.json";
import longTermClimateJson from "./canonical/long_term_climate_illustrative.json";
import mapLayerCatalogJson from "./canonical/map_layer_catalog.json";
import nakhonRatchasimaAdminHierarchyJson from "./canonical/nakhon_ratchasima/admin_hierarchy.json";
import nakhonRatchasimaDistrictSubdistrictMatrixJson from "./canonical/nakhon_ratchasima/district_subdistrict_matrix.json";
import nakhonRatchasimaDwrEwsStationCoverageJson from "./canonical/nakhon_ratchasima/dwr_ews_station_coverage.json";
import nakhonRatchasimaEvidenceRecordsJson from "./canonical/nakhon_ratchasima/evidence_records.json";
import nakhonRatchasimaLocalSubsetJson from "./canonical/nakhon_ratchasima/local_subset.json";
import nakhonRatchasimaMapLayersJson from "./canonical/nakhon_ratchasima/map_layers.json";
import nakhonRatchasimaOpsmoacMonthlyReportsJson from "./canonical/nakhon_ratchasima/opsmoac_monthly_reports.json";
import nakhonRatchasimaRainfallMonthlyHistoryJson from "./canonical/nakhon_ratchasima/rainfall_monthly_history.json";
import nakhonRatchasimaRainfallObservations24hJson from "./canonical/nakhon_ratchasima/rainfall_observations_24h.json";
import nakhonRatchasimaRainfallSourceAuditJson from "./canonical/nakhon_ratchasima/rainfall_source_audit.json";
import nakhonRatchasimaRainfallStationsJson from "./canonical/nakhon_ratchasima/rainfall_stations.json";
import nakhonRatchasimaResearchMonthlyPanelJson from "./canonical/nakhon_ratchasima/normalized_research_monthly_panel.json";
import nakhonRatchasimaResearchPanelSummaryJson from "./canonical/nakhon_ratchasima/normalized_research_panel_summary.json";
import nakhonRatchasimaSourceMatrixJson from "./canonical/nakhon_ratchasima/source_matrix.json";
import nakhonRatchasimaSubdistrictRainfallCoverageJson from "./canonical/nakhon_ratchasima/subdistrict_rainfall_coverage.json";
import nakhonRatchasimaTemporalMatrixJson from "./canonical/nakhon_ratchasima/temporal_matrix.json";
import nationalMonthlyBackboneJson from "./canonical/national_monthly_backbone.json";
import outcomeAnalyticsJson from "./canonical/outcome_analytics.json";
import provinceMonthlyRiskJson from "./canonical/province_monthly_risk.json";
import riskEventsJson from "./canonical/risk_events.json";
import sourceRegistryJson from "./canonical/source_registry.json";
import usersJson from "./canonical/users.json";
import type {
  Advisory,
  CropProfile,
  EventEnrichment,
  FarmerProfile,
  FieldTask,
  LocationNode,
  MapLayerRecord,
  NakhonRatchasimaDwrEwsStationCoverage,
  ModelRegistryRecord,
  NakhonRatchasimaEvidenceRecord,
  NakhonRatchasimaHierarchy,
  NakhonRatchasimaLocalSubset,
  NakhonRatchasimaMapLayer,
  NakhonRatchasimaMatrixRow,
  NakhonRatchasimaOpsmoacMonthlyReports,
  NakhonRatchasimaRainfallCoverage,
  NakhonRatchasimaRainfallMonthlyHistory,
  NakhonRatchasimaRainfallObservations24h,
  NakhonRatchasimaRainfallSourceAudit,
  NakhonRatchasimaRainfallStations,
  NakhonRatchasimaResearchMonthlyPanel,
  NakhonRatchasimaResearchPanelSummary,
  NationalMonthlyBackbone,
  OutcomeMetric,
  ProvinceMonthRisk,
  RiskEvent,
  SourceRegistryRecord,
  UserPersona,
} from "../types";

export const nakhonRatchasimaHierarchy = nakhonRatchasimaAdminHierarchyJson as unknown as NakhonRatchasimaHierarchy;
export const nakhonRatchasimaLocalSubset = nakhonRatchasimaLocalSubsetJson as unknown as NakhonRatchasimaLocalSubset;
export const nakhonRatchasimaEvidenceRecords =
  (nakhonRatchasimaEvidenceRecordsJson as { records: NakhonRatchasimaEvidenceRecord[] }).records;
export const nakhonRatchasimaMapLayers =
  (nakhonRatchasimaMapLayersJson as { layers: NakhonRatchasimaMapLayer[] }).layers;
export const nakhonRatchasimaDistrictSubdistrictMatrix =
  nakhonRatchasimaDistrictSubdistrictMatrixJson as NakhonRatchasimaMatrixRow[];
export const nakhonRatchasimaDwrEwsStationCoverage =
  nakhonRatchasimaDwrEwsStationCoverageJson as NakhonRatchasimaDwrEwsStationCoverage;
export const nakhonRatchasimaOpsmoacMonthlyReports =
  nakhonRatchasimaOpsmoacMonthlyReportsJson as NakhonRatchasimaOpsmoacMonthlyReports;
export const nakhonRatchasimaRainfallMonthlyHistory =
  nakhonRatchasimaRainfallMonthlyHistoryJson as NakhonRatchasimaRainfallMonthlyHistory;
export const nakhonRatchasimaRainfallObservations24h =
  nakhonRatchasimaRainfallObservations24hJson as NakhonRatchasimaRainfallObservations24h;
export const nakhonRatchasimaRainfallSourceAudit =
  nakhonRatchasimaRainfallSourceAuditJson as NakhonRatchasimaRainfallSourceAudit;
export const nakhonRatchasimaRainfallStations =
  nakhonRatchasimaRainfallStationsJson as NakhonRatchasimaRainfallStations;
export const nakhonRatchasimaResearchPanelSummary =
  nakhonRatchasimaResearchPanelSummaryJson as NakhonRatchasimaResearchPanelSummary;
export const nakhonRatchasimaResearchMonthlyPanel =
  nakhonRatchasimaResearchMonthlyPanelJson as unknown as NakhonRatchasimaResearchMonthlyPanel;
export const nakhonRatchasimaSubdistrictRainfallCoverage =
  nakhonRatchasimaSubdistrictRainfallCoverageJson as NakhonRatchasimaRainfallCoverage;
export const nakhonRatchasimaSourceMatrix = nakhonRatchasimaSourceMatrixJson as Array<Record<string, string>>;
export const nakhonRatchasimaTemporalMatrix = nakhonRatchasimaTemporalMatrixJson as Array<Record<string, string>>;

const baseLocations = (locationsJson as LocationNode[]).map((location) =>
  location.id === "TH-P29"
    ? { ...location, provinceCode: "30", routingSlug: "nakhon-ratchasima" }
    : location,
);
const nakhonRatchasimaLocalLocations: LocationNode[] = nakhonRatchasimaHierarchy.province.districts.flatMap(
  (district) => {
    const { subdistricts, ...districtLocation } = district;
    return [
      {
        ...districtLocation,
        nameTh: district.nameTh,
        parent: "TH-P29",
        region: "Northeast",
      } as LocationNode,
      ...subdistricts.map((subdistrict) => ({
        ...subdistrict,
        parent: district.id,
        region: "Northeast",
      })),
    ];
  },
);

export const advisory = advisoryJson as Advisory;
export const cropProfiles = cropProfilesJson as CropProfile[];
export const dataModelRegistry = dataModelRegistryJson as ModelRegistryRecord[];
export const dataPeriod = dataPeriodJson as Record<string, unknown>;
export const eventEnrichment = eventDetailEnrichmentJson as Record<string, EventEnrichment>;
export const farmerProfile = farmerProfileJson as FarmerProfile;
export const fieldTasks = fieldTasksJson as FieldTask[];
export const historicalAnalogues = historicalAnaloguesJson as Record<string, unknown>;
export const locations = [...baseLocations, ...nakhonRatchasimaLocalLocations] as LocationNode[];
export const longTermClimate = longTermClimateJson as Array<Record<string, unknown>>;
export const mapLayerCatalog = mapLayerCatalogJson as MapLayerRecord[];
export const nationalMonthlyBackbone = nationalMonthlyBackboneJson as NationalMonthlyBackbone[];
export const outcomeAnalytics = outcomeAnalyticsJson as OutcomeMetric[];
export const provinceMonthlyRisk = provinceMonthlyRiskJson as ProvinceMonthRisk[];
export const riskEvents = riskEventsJson as RiskEvent[];
export const sourceRegistry = sourceRegistryJson as SourceRegistryRecord[];
export const users = usersJson as UserPersona[];

export const provinces = locations.filter((location) => location.type === "province");
export const seededDeepLocations = locations.filter(
  (location) => location.type !== "country" && location.type !== "province",
);

export const months = Array.from(new Set(provinceMonthlyRisk.map((record) => record.month))).sort();

export const operationalMonths = [...dataPeriodJson.observedSourceGroundedMonths,
  dataPeriodJson.currentOperationalMonth, ...dataPeriodJson.forecastSourceGroundedMonths];

export const hazards = Array.from(
  new Set([
    ...provinceMonthlyRisk.map((record) => record.primaryHazard),
    ...riskEvents.map((event) => event.hazard),
  ]),
).sort();

export const crops = Array.from(
  new Set([
    ...provinceMonthlyRisk.map((record) => record.mainCropExposure),
    ...riskEvents.flatMap((event) => event.crops.map((crop) => crop.crop)),
  ]),
).sort();

export const mapLayerGroups = Array.from(new Set(mapLayerCatalog.map((layer) => layer.group)));
