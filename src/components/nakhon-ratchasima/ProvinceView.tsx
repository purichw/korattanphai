import { type NakhonRatchasimaDroughtForecastArchive, type NakhonRatchasimaMapLayer, type NakhonRatchasimaResearchPanelSummary } from "../../types";
import { type ProvinceDashboardTab, type LocalMapMode } from "./workspaceModel";
import { type AppSelectOption } from "../AppSelect";
import { useDroughtForecastArchiveSelection } from "./forecastModel";
import { DroughtCompactForecastWorkspace } from "./DroughtForecastWorkspace";
import {
  ResearchSubdistrictAttentionPanel,
  ResearchDroughtSituationPanel,
  ResearchDroughtDistrictPanel,
  AgricultureImpactPanel,
  PredictionReadinessPanel,
} from "./ResearchPanels";
import { ProvinceForecastOverview } from "./ProvinceForecastOverview";
import { useAppState } from "../../store";
import { useState } from "react";
import {
  getNakhonRatchasimaResearchPanelSummary,
  getProvinceRecord,
  NAKHON_RATCHASIMA_ID,
} from "../../domain";
import { DroughtOperationalDisclosure, useDroughtReadinessMap } from "./DroughtOperationalWorkspace";
import { pathWithForecastSelection } from "./forecastModel";
import { dataProvenanceChipKindFromText } from "../DataProvenanceChip";

export function ResearchProvinceDataView({
  droughtArchive,
  activeTab,
  layer,
  mapMode,
  onMapModeChange,
  onNavigate,
  research,
  selectedMonth,
  monthOptions,
  onMonthChange,
  selectedSubdistrictCode,
  onSelectedSubdistrictChange,
}: {
  droughtArchive: NakhonRatchasimaDroughtForecastArchive;
  activeTab: Extract<ProvinceDashboardTab, "drought">;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  research: NakhonRatchasimaResearchPanelSummary;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
  selectedSubdistrictCode: string | null;
  onSelectedSubdistrictChange: (subdistrictCode: string | null) => void;
}) {
  const attentionRecords = research.droughtAttentionLatest;
  const attentionTitle = "ตำบลภัยแล้งที่ควรตรวจสอบ";
  const forecastArchive = useDroughtForecastArchiveSelection(droughtArchive);
  const provinceRecord = getProvinceRecord(NAKHON_RATCHASIMA_ID, selectedMonth);
  const hasAgriculture = provinceRecord && dataProvenanceChipKindFromText(provinceRecord.provenance) === "REAL";
  const { readinessMap, openReadinessMap, closeReadinessMap } = useDroughtReadinessMap();
  const navigateWithForecast = (path: string) => onNavigate(pathWithForecastSelection(path, forecastArchive.selectedMonth?.period ?? selectedMonth, forecastArchive.selectedHorizon));

  return (
    <section className={`nr-drought-dashboard nr-research-dashboard is-${activeTab}`}>
      <DroughtCompactForecastWorkspace
        readinessMap={readinessMap}
        onCloseReadinessMap={closeReadinessMap}
        level="province"
        title="คาดการณ์ภัยแล้ง 6 เดือน (T+1 ถึง T+6)"
        description="เลือกช่วงเวลา T+ เพื่ออ่านกราฟแนวโน้มและแผนที่พยากรณ์ในบริบทเดียวกัน"
        scopeLabel="จ.นครราชสีมา"
        archive={droughtArchive}
        target={{ valid: true, level: "province", tab: activeTab }}
        selectedTargetMonth={forecastArchive.selectedMonth}
        selectedHorizon={forecastArchive.selectedHorizon}
        onHorizonChange={forecastArchive.changeHorizon}
        layer={layer}
        mapMode={mapMode}
        onMapModeChange={onMapModeChange}
        onNavigate={onNavigate}
        selectedMonth={forecastArchive.selectedMonth?.period ?? selectedMonth}
        monthOptions={forecastArchive.targetMonthOptions.length > 0 ? forecastArchive.targetMonthOptions : monthOptions}
        onMonthChange={forecastArchive.changeTargetMonth ?? onMonthChange}
        selectedSubdistrictCode={selectedSubdistrictCode}
        onSelectedSubdistrictChange={onSelectedSubdistrictChange}
      />
      <DroughtOperationalDisclosure title="สถานการณ์ภัยแล้งตามข้อมูลพื้นที่" description="สถานะย้อนหลังและข้อมูลรายอำเภอ">
      <section className="nr-drought-secondary-grid" aria-label="ข้อมูลปฏิบัติการประกอบการคาดการณ์">
        <ResearchSubdistrictAttentionPanel title={attentionTitle} records={attentionRecords} onNavigate={navigateWithForecast} />
        <ResearchDroughtSituationPanel research={research} />
      </section>
      <ResearchDroughtDistrictPanel research={research} onNavigate={navigateWithForecast} />
      </DroughtOperationalDisclosure>
      <DroughtOperationalDisclosure title={hasAgriculture ? "พื้นที่เกษตรและความพร้อมข้อมูล" : "ความพร้อมข้อมูลพื้นที่"} description="หลักฐานพื้นที่และข้อจำกัดก่อนตัดสินใจ" icon="crop">
        <AgricultureImpactPanel provinceRecord={provinceRecord} />
        <PredictionReadinessPanel onOpenMap={openReadinessMap} />
      </DroughtOperationalDisclosure>
    </section>
  );
}

export function ProvinceView({
  droughtArchive,
  activeTab,
  layer,
  mapMode,
  onMapModeChange,
  onNavigate,
  selectedMonth,
  monthOptions,
  onMonthChange,
}: {
  droughtArchive: NakhonRatchasimaDroughtForecastArchive | null;
  activeTab: ProvinceDashboardTab;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
}) {
  const state = useAppState();
  const [selectedMapSubdistrictCode, setSelectedMapSubdistrictCode] = useState<string | null>(null);
  const researchSummary = getNakhonRatchasimaResearchPanelSummary();
  const provinceRecord =
    getProvinceRecord(NAKHON_RATCHASIMA_ID, selectedMonth) ?? getProvinceRecord(NAKHON_RATCHASIMA_ID, state.selectedMonth);

  return (
    <>
      {activeTab === "overview" ? (
        <ProvinceForecastOverview provinceRecord={provinceRecord} layer={layer} mapMode={mapMode} onMapModeChange={onMapModeChange} onNavigate={onNavigate} />
      ) : droughtArchive ? (
        <ResearchProvinceDataView
          droughtArchive={droughtArchive}
          activeTab={activeTab}
          layer={layer}
          mapMode={mapMode}
          onMapModeChange={onMapModeChange}
          onNavigate={onNavigate}
          research={researchSummary}
          selectedMonth={selectedMonth}
          monthOptions={monthOptions}
          onMonthChange={onMonthChange}
          selectedSubdistrictCode={selectedMapSubdistrictCode}
          onSelectedSubdistrictChange={setSelectedMapSubdistrictCode}
        />
      ) : null}
    </>
  );
}
