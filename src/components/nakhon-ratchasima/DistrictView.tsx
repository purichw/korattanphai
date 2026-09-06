import { type NakhonRatchasimaDroughtForecastArchive, type NakhonRatchasimaDistrict, type NakhonRatchasimaMapLayer } from "../../types";
import {
  type LocalMapMode,
  localResearchPeriodForSelectedMonth,
  researchRecordsForSubdistrictCodes,
  summarizeResearchAreaRecords,
  researchMonthlySeriesForDistrict,
  predictionReadinessSummaryForSubdistrictCodes,
} from "./workspaceModel";
import { type AppSelectOption } from "../AppSelect";
import { getNakhonRatchasimaResearchPanelSummary } from "../../domain";
import { useDroughtForecastArchiveSelection } from "./forecastModel";
import {
  ResearchAreaHeading,
  ResearchAreaAttentionPanel,
  ResearchAreaSituationPanel,
  ResearchAreaAgricultureImpactPanel,
  PredictionReadinessPanel,
  ResearchAreaDroughtHistoryPanel,
  ResearchAreaSubdistrictsPanel,
} from "./ResearchPanels";
import { DroughtCompactForecastWorkspace } from "./DroughtForecastWorkspace";
import { ContentSection } from "../ContentSection";
import { DroughtOperationalDisclosure, useDroughtReadinessMap } from "./DroughtOperationalWorkspace";
import { pathWithForecastSelection } from "./forecastModel";
import { forecastSubdistrictCodesForIrrigation } from "../../irrigation";

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
  const forecastArchive = useDroughtForecastArchiveSelection(droughtArchive);
  const subdistrictCodes = district.subdistricts.map((subdistrict) => subdistrict.subdistrictCode);
  const activeRecords = researchRecordsForSubdistrictCodes(subdistrictCodes, activeResearchPeriod.period);
  const stats = summarizeResearchAreaRecords(activeRecords, district.subdistricts.length);
  const monthlySeries = researchMonthlySeriesForDistrict(district, activeResearchPeriod.period);
  const readiness = predictionReadinessSummaryForSubdistrictCodes(forecastSubdistrictCodesForIrrigation(droughtArchive, forecastArchive.selectedIrrigation, subdistrictCodes));
  const { readinessMap, openReadinessMap, closeReadinessMap } = useDroughtReadinessMap();
  const navigateWithForecast = (path: string) => onNavigate(pathWithForecastSelection(path, forecastArchive.selectedMonth?.period ?? selectedMonth, forecastArchive.selectedHorizon, forecastArchive.selectedIrrigation));

  return (
    <div className="nr-area-template is-district">
      <DroughtCompactForecastWorkspace
        readinessMap={readinessMap}
        onCloseReadinessMap={closeReadinessMap}
        level="district"
        title={`คาดการณ์ภัยแล้งของอำเภอ${district.nameTh}`}
        description="ดูพยากรณ์ล่วงหน้า 6 เดือนจากเดือนตั้งต้นเดียวกันและแผนที่รายตำบลของอำเภอนี้"
        scopeLabel={`อ.${district.nameTh}`}
        archive={droughtArchive}
        expectedSubdistrictCodes={subdistrictCodes}
        target={{ valid: true, level: "district", district }}
        selectedTargetMonth={forecastArchive.selectedMonth}
        selectedHorizon={forecastArchive.selectedHorizon}
        irrigation={forecastArchive.irrigation}
        onHorizonChange={forecastArchive.changeHorizon}
        layer={layer}
        mapMode={mapMode}
        onMapModeChange={onMapModeChange}
        onNavigate={onNavigate}
        selectedMonth={forecastArchive.selectedMonth?.period ?? selectedMonth}
        monthOptions={forecastArchive.targetMonthOptions.length > 0 ? forecastArchive.targetMonthOptions : monthOptions}
        onMonthChange={forecastArchive.changeTargetMonth ?? onMonthChange}
      />
      {stats.recordCount > 0 && <DroughtOperationalDisclosure title="สถานการณ์ภัยแล้งตามข้อมูลพื้นที่" description="สถานะรายเดือน ประวัติ และตำบลในอำเภอ">
      <ResearchAreaHeading district={district} activePeriod={activeResearchPeriod} stats={stats} />
      <section className="nr-area-secondary-grid" aria-label="ข้อมูลปฏิบัติการประกอบการคาดการณ์">
        <ResearchAreaAttentionPanel district={district} period={activeResearchPeriod.period} onNavigate={navigateWithForecast} />
        <ResearchAreaSituationPanel district={district} stats={stats} activePeriod={activeResearchPeriod} />
      </section>
      <section className="nr-area-lower-row" aria-label="ประวัติภัยแล้งและตำบลในอำเภอ">
        <ResearchAreaDroughtHistoryPanel title="สถานะภัยแล้งรายเดือนของอำเภอ" series={monthlySeries} />
        <ResearchAreaSubdistrictsPanel district={district} period={activeResearchPeriod.period} onNavigate={navigateWithForecast} />
      </section>
      </DroughtOperationalDisclosure>}
      {readiness.totalSubdistricts > 0 && <DroughtOperationalDisclosure title="ความพร้อมข้อมูลพื้นที่" description="หลักฐานประกอบ แยกจากความครบถ้วนของพยากรณ์" icon="crop">
      <ResearchAreaAgricultureImpactPanel district={district} stats={stats} activePeriod={activeResearchPeriod} />
      <ContentSection
        className="nr-data-readiness-section"
        eyebrow="ความพร้อมข้อมูล"
        title="ก่อนใช้ข้อมูลเพื่อคาดการณ์หรือตัดสินใจ"
        description="แสดงระดับความพร้อมของข้อมูลพื้นที่ โดยแยกจากระดับความรุนแรงของภัย"
      >
        <PredictionReadinessPanel
          readiness={readiness}
          onOpenMap={openReadinessMap}
        />
      </ContentSection>
      </DroughtOperationalDisclosure>}
    </div>
  );
}
