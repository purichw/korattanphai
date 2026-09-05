import { type NakhonRatchasimaDroughtForecastArchive, type NakhonRatchasimaDistrict, type NakhonRatchasimaSubdistrict, type NakhonRatchasimaMapLayer } from "../../types";
import {
  type LocalMapMode,
  localResearchPeriodForSelectedMonth,
  summarizeResearchAreaRecords,
  researchMonthlySeriesForSubdistrict,
  predictionReadinessSummaryForSubdistrictCodes,
  prefersReducedMotion,
  localResearchPeriodLabel,
} from "./workspaceModel";
import { type AppSelectOption } from "../AppSelect";
import { getNakhonRatchasimaResearchPanelSummary, getNakhonRatchasimaResearchSubdistrictMonth, getNakhonRatchasimaEvidenceForLocation } from "../../domain";
import { useDroughtForecastArchiveSelection } from "./forecastModel";
import {
  ResearchAreaHeading,
  ResearchSubdistrictProfilePanel,
  ResearchSubdistrictDataGapPanel,
  ResearchAreaSituationPanel,
  ResearchAreaDroughtHistoryPanel,
  ResearchAreaAgricultureImpactPanel,
  PredictionReadinessPanel,
  ResearchAreaSourceLimitsPanel,
} from "./ResearchPanels";
import { DroughtCompactForecastWorkspace } from "./DroughtForecastWorkspace";
import { ContentSection } from "../ContentSection";

export function SubdistrictView({
  droughtArchive,
  district,
  subdistrict,
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
  subdistrict: NakhonRatchasimaSubdistrict;
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
  const researchRecord = getNakhonRatchasimaResearchSubdistrictMonth(subdistrict.subdistrictCode, activeResearchPeriod.period);
  const stats = summarizeResearchAreaRecords(researchRecord ? [researchRecord] : [], 1);
  const monthlySeries = researchMonthlySeriesForSubdistrict(subdistrict.subdistrictCode, activeResearchPeriod.period);
  const evidence = getNakhonRatchasimaEvidenceForLocation({
    districtCode: district.districtCode,
    subdistrictCode: subdistrict.subdistrictCode,
  });
  const forecastArchive = useDroughtForecastArchiveSelection(droughtArchive);
  const subdistrictCodes = [subdistrict.subdistrictCode];
  const readiness = predictionReadinessSummaryForSubdistrictCodes(subdistrictCodes);
  const openPredictionReadinessMap = () => {
    onMapModeChange("prediction-readiness");
    window.requestAnimationFrame(() => {
      document.querySelector(".nr-subdistrict-map-status-row .nr-area-map-section, .nr-area-map-section")?.scrollIntoView({
        block: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  };

  return (
    <div className="nr-area-template is-subdistrict">
      <ResearchAreaHeading district={district} subdistrict={subdistrict} activePeriod={activeResearchPeriod} stats={stats} />

      <DroughtCompactForecastWorkspace
        level="subdistrict"
        title={`คาดการณ์ภัยแล้งของตำบล${subdistrict.nameTh}`}
        description="เลือก T+ ครั้งเดียวเพื่ออ่านสัญญาณพยากรณ์ของตำบลและตำแหน่งบนแผนที่ในบริบทเดียวกัน"
        scopeLabel={`ต.${subdistrict.nameTh} · อ.${district.nameTh}`}
        singleSubdistrict
        archive={droughtArchive}
        expectedSubdistrictCodes={subdistrictCodes}
        target={{ valid: true, level: "subdistrict", district, subdistrict }}
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

      <section className="nr-area-secondary-grid nr-subdistrict-secondary-grid" aria-label="ข้อมูลปฏิบัติการประกอบการคาดการณ์">
        <aside className="nr-subdistrict-rail" aria-label="โปรไฟล์และช่องว่างข้อมูลตำบล">
          <ResearchSubdistrictProfilePanel district={district} subdistrict={subdistrict} record={researchRecord} />
          <ResearchSubdistrictDataGapPanel stats={stats} activePeriod={activeResearchPeriod} />
        </aside>
        <ResearchAreaSituationPanel
          district={district}
          subdistrict={subdistrict}
          stats={stats}
          activePeriod={activeResearchPeriod}
        />
      </section>
      <ResearchAreaDroughtHistoryPanel title="สถานะภัยแล้งรายเดือนของตำบล" series={monthlySeries} isSubdistrict />
      <ResearchAreaAgricultureImpactPanel
        district={district}
        subdistrict={subdistrict}
        stats={stats}
        activePeriod={activeResearchPeriod}
      />
      <ContentSection
        className="nr-data-readiness-section"
        eyebrow="ความพร้อมข้อมูล"
        title="ก่อนใช้ข้อมูลเพื่อคาดการณ์หรือตัดสินใจ"
        description="แสดงระดับความพร้อมของข้อมูลตำบล โดยแยกจากระดับความรุนแรงของภัย"
      >
        <PredictionReadinessPanel
          month={localResearchPeriodLabel(activeResearchPeriod)}
          readiness={readiness}
          onOpenMap={openPredictionReadinessMap}
        />
      </ContentSection>
      <ResearchAreaSourceLimitsPanel
        district={district}
        subdistrict={subdistrict}
        stats={stats}
        directRecords={evidence.direct}
        inheritedRecords={evidence.inherited}
      />
    </div>
  );
}
