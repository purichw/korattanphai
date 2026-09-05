import { type NakhonRatchasimaDroughtForecastArchive, type NakhonRatchasimaMapLayer, type NakhonRatchasimaResearchPanelSummary } from "../../types";
import { type ProvinceDashboardTab, type LocalMapMode, prefersReducedMotion } from "./workspaceModel";
import { type AppSelectOption } from "../AppSelect";
import { useDroughtForecastArchiveSelection } from "./forecastModel";
import { DroughtCompactForecastWorkspace } from "./DroughtForecastWorkspace";
import {
  ResearchSubdistrictAttentionPanel,
  ResearchDroughtSituationPanel,
  ResearchDroughtDistrictPanel,
  ResearchSourceLimitsPanel,
  AgricultureImpactPanel,
  PredictionReadinessPanel,
} from "./ResearchPanels";
import { ProvinceForecastOverview } from "./ProvinceForecastOverview";
import { NakhonRatchasimaLocalMap } from "./NakhonRatchasimaLocalMap";
import { useAppState } from "../../store";
import { useState } from "react";
import {
  getNakhonRatchasimaResearchPanelSummary,
  getProvinceRecord,
  NAKHON_RATCHASIMA_ID,
} from "../../domain";
import { ContentSection } from "../ContentSection";
import { formatMonth } from "../../i18n";

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

  return (
    <section className={`nr-drought-dashboard nr-research-dashboard is-${activeTab}`}>
      <DroughtCompactForecastWorkspace
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
      <section className="nr-drought-secondary-grid" aria-label="ข้อมูลปฏิบัติการประกอบการคาดการณ์">
        <ResearchSubdistrictAttentionPanel title={attentionTitle} records={attentionRecords} onNavigate={onNavigate} />
        <ResearchDroughtSituationPanel research={research} />
      </section>
      <ResearchDroughtDistrictPanel research={research} onNavigate={onNavigate} />
      <ResearchSourceLimitsPanel research={research} />
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
  const [showReadinessMap, setShowReadinessMap] = useState(false);
  const researchSummary = getNakhonRatchasimaResearchPanelSummary();
  const provinceRecord =
    getProvinceRecord(NAKHON_RATCHASIMA_ID, selectedMonth) ?? getProvinceRecord(NAKHON_RATCHASIMA_ID, state.selectedMonth);

  const openPredictionReadinessMap = () => {
    setShowReadinessMap(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.querySelector(".nr-overview-readiness-map")?.scrollIntoView({
          block: "center",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      });
    });
  };

  return (
    <>
      {activeTab === "overview" ? (
        <>
          <ProvinceForecastOverview layer={layer} mapMode={mapMode} onMapModeChange={onMapModeChange} onNavigate={onNavigate} />

          <section className="nr-overview-support-grid" aria-label="ข้อมูลเกษตรและความพร้อมข้อมูล">
            <div>
              <p className="nr-forecast-overview-support-note">ข้อมูลประกอบจากชุดข้อมูลเกษตรของระบบ · {provinceRecord ? formatMonth(provinceRecord.month, "th") : "ไม่ระบุเดือน"} · ตัวเลขไร่และความเชื่อมั่นเป็นคนละชุดกับพยากรณ์รายตำบล</p>
              <AgricultureImpactPanel provinceRecord={provinceRecord} />
            </div>
            <ContentSection
              className="nr-data-readiness-section"
              eyebrow="ความพร้อมข้อมูล"
              title="ก่อนใช้ข้อมูลเพื่อคาดการณ์หรือตัดสินใจ"
              description="แสดงระดับความพร้อมของข้อมูลพื้นที่ และแยกสิ่งที่ยังไม่ควรตีความเป็นระดับความเสี่ยง"
            >
              <div className="nr-data-readiness-stack">
                <PredictionReadinessPanel month={formatMonth(selectedMonth, "th")} onOpenMap={openPredictionReadinessMap} />
              </div>
            </ContentSection>
          </section>
          {showReadinessMap && <section className="nr-overview-readiness-map">
            <h3>แผนที่ความพร้อมข้อมูลพื้นที่</h3>
            <button type="button" className="secondary-button" onClick={() => setShowReadinessMap(false)}>ปิดแผนที่ความพร้อม</button>
            <NakhonRatchasimaLocalMap
              target={{ valid: true, level: "province", tab: "overview" }}
              layer={layer}
              mapMode="prediction-readiness"
              researchCriteriaEnabled={false}
              onNavigate={onNavigate}
              selectedMonth={selectedMonth}
              monthOptions={monthOptions}
              onMonthChange={onMonthChange}
            />
          </section>}
        </>
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
