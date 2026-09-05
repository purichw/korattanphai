import { type NakhonRatchasimaDroughtForecastArchive, type NakhonRatchasimaDistrict, type NakhonRatchasimaMapLayer } from "../../types";
import {
  type LocalMapMode,
  localResearchPeriodForSelectedMonth,
  researchRecordsForSubdistrictCodes,
  summarizeResearchAreaRecords,
  researchMonthlySeriesForDistrict,
  predictionReadinessSummaryForSubdistrictCodes,
  prefersReducedMotion,
  localResearchPeriodLabel,
} from "./workspaceModel";
import { type AppSelectOption } from "../AppSelect";
import { getNakhonRatchasimaResearchPanelSummary, getNakhonRatchasimaEvidenceForLocation } from "../../domain";
import { useDroughtForecastArchiveSelection } from "./forecastModel";
import {
  ResearchAreaHeading,
  ResearchAreaAttentionPanel,
  ResearchAreaSituationPanel,
  ResearchAreaAgricultureImpactPanel,
  PredictionReadinessPanel,
  ResearchAreaDroughtHistoryPanel,
  ResearchAreaSubdistrictsPanel,
  ResearchAreaSourceLimitsPanel,
} from "./ResearchPanels";
import { DroughtCompactForecastWorkspace } from "./DroughtForecastWorkspace";
import { ContentSection } from "../ContentSection";

export function DistrictView({
  droughtArchive,
  district,
  layer,
  mapMode,
  onMapModeChange,
  onNavigate,
  selectedMonth,
  monthOptions,
  onMonthChange,
}: {
  droughtArchive: NakhonRatchasimaDroughtForecastArchive;
  district: NakhonRatchasimaDistrict;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
}) {
  const research = getNakhonRatchasimaResearchPanelSummary();
  const activeResearchPeriod = localResearchPeriodForSelectedMonth(selectedMonth, research);
  const subdistrictCodes = district.subdistricts.map((subdistrict) => subdistrict.subdistrictCode);
  const activeRecords = researchRecordsForSubdistrictCodes(subdistrictCodes, activeResearchPeriod.period);
  const stats = summarizeResearchAreaRecords(activeRecords, district.subdistricts.length);
  const monthlySeries = researchMonthlySeriesForDistrict(district, activeResearchPeriod.period);
  const evidence = getNakhonRatchasimaEvidenceForLocation({ districtCode: district.districtCode });
  const forecastArchive = useDroughtForecastArchiveSelection(droughtArchive);
  const readiness = predictionReadinessSummaryForSubdistrictCodes(subdistrictCodes);
  const openPredictionReadinessMap = () => {
    onMapModeChange("prediction-readiness");
    window.requestAnimationFrame(() => {
      document.querySelector(".nr-area-map-section")?.scrollIntoView({
        block: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  };

  return (
    <div className="nr-area-template is-district">
      <ResearchAreaHeading district={district} activePeriod={activeResearchPeriod} stats={stats} />
      <DroughtCompactForecastWorkspace
        level="district"
        title={`คาดการณ์ภัยแล้งของอำเภอ${district.nameTh}`}
        description="เลือก T+ ครั้งเดียวเพื่ออ่านแนวโน้มพยากรณ์และแผนที่รายตำบลของอำเภอนี้ในบริบทเดียวกัน"
        scopeLabel={`อ.${district.nameTh}`}
        archive={droughtArchive}
        expectedSubdistrictCodes={subdistrictCodes}
        target={{ valid: true, level: "district", district }}
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
      />
      <section className="nr-area-secondary-grid" aria-label="ข้อมูลปฏิบัติการประกอบการคาดการณ์">
        <ResearchAreaAttentionPanel district={district} period={activeResearchPeriod.period} onNavigate={onNavigate} />
        <ResearchAreaSituationPanel district={district} stats={stats} activePeriod={activeResearchPeriod} />
      </section>
      <ResearchAreaAgricultureImpactPanel district={district} stats={stats} activePeriod={activeResearchPeriod} />
      <ContentSection
        className="nr-data-readiness-section"
        eyebrow="ความพร้อมข้อมูล"
        title="ก่อนใช้ข้อมูลเพื่อคาดการณ์หรือตัดสินใจ"
        description="แสดงระดับความพร้อมของข้อมูลพื้นที่ โดยแยกจากระดับความรุนแรงของภัย"
      >
        <PredictionReadinessPanel
          month={localResearchPeriodLabel(activeResearchPeriod)}
          readiness={readiness}
          onOpenMap={openPredictionReadinessMap}
        />
      </ContentSection>
      <section className="nr-area-lower-row" aria-label="ประวัติภัยแล้งและตำบลในอำเภอ">
        <ResearchAreaDroughtHistoryPanel title="สถานะภัยแล้งรายเดือนของอำเภอ" series={monthlySeries} />
        <ResearchAreaSubdistrictsPanel district={district} period={activeResearchPeriod.period} onNavigate={onNavigate} />
      </section>
      <ResearchAreaSourceLimitsPanel
        district={district}
        stats={stats}
        directRecords={evidence.direct}
        inheritedRecords={evidence.inherited}
      />
    </div>
  );
}
