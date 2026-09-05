import { type NakhonRatchasimaDroughtForecastArchive, type NakhonRatchasimaDistrict, type NakhonRatchasimaSubdistrict, type NakhonRatchasimaMapLayer } from "../../types";
import {
  type LocalMapMode,
  localResearchPeriodForSelectedMonth,
  summarizeResearchAreaRecords,
  researchMonthlySeriesForSubdistrict,
  predictionReadinessSummaryForSubdistrictCodes,
} from "./workspaceModel";
import { type AppSelectOption } from "../AppSelect";
import { getNakhonRatchasimaResearchPanelSummary, getNakhonRatchasimaResearchSubdistrictMonth } from "../../domain";
import { useDroughtForecastArchiveSelection } from "./forecastModel";
import { forecastSubdistrictCodesForIrrigation } from "../../irrigation";
import {
  ResearchAreaHeading,
  ResearchSubdistrictProfilePanel,
  ResearchSubdistrictDataGapPanel,
  ResearchAreaSituationPanel,
  ResearchAreaDroughtHistoryPanel,
  ResearchAreaAgricultureImpactPanel,
  PredictionReadinessPanel,
} from "./ResearchPanels";
import { DroughtCompactForecastWorkspace } from "./DroughtForecastWorkspace";
import { ContentSection } from "../ContentSection";
import { DroughtOperationalDisclosure, useDroughtReadinessMap } from "./DroughtOperationalWorkspace";

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
  const forecastArchive = useDroughtForecastArchiveSelection(droughtArchive);
  const subdistrictCodes = [subdistrict.subdistrictCode];
  const readiness = predictionReadinessSummaryForSubdistrictCodes(forecastSubdistrictCodesForIrrigation(droughtArchive, forecastArchive.selectedIrrigation, subdistrictCodes));
  const { readinessMap, openReadinessMap, closeReadinessMap } = useDroughtReadinessMap();

  return (
    <div className="nr-area-template is-subdistrict">
      <DroughtCompactForecastWorkspace
        readinessMap={readinessMap}
        onCloseReadinessMap={closeReadinessMap}
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
        irrigation={{ value: forecastArchive.selectedIrrigation, onChange: forecastArchive.changeIrrigation }}
        onHorizonChange={forecastArchive.changeHorizon}
        layer={layer}
        mapMode={mapMode}
        onMapModeChange={onMapModeChange}
        onNavigate={onNavigate}
        selectedMonth={forecastArchive.selectedMonth?.period ?? selectedMonth}
        monthOptions={forecastArchive.targetMonthOptions.length > 0 ? forecastArchive.targetMonthOptions : monthOptions}
        onMonthChange={forecastArchive.changeTargetMonth ?? onMonthChange}
      />

      {stats.recordCount > 0 && <DroughtOperationalDisclosure title="สถานการณ์ภัยแล้งตามข้อมูลพื้นที่" description="โปรไฟล์ตำบล สถานะรายเดือน และช่องว่างข้อมูล">
      <ResearchAreaHeading district={district} subdistrict={subdistrict} activePeriod={activeResearchPeriod} stats={stats} />
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
      </DroughtOperationalDisclosure>}
      {readiness.totalSubdistricts > 0 && <DroughtOperationalDisclosure title="ความพร้อมข้อมูลของตำบล" description="หลักฐานประกอบ แยกจากความครบถ้วนของพยากรณ์" icon="crop">
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
          scope="single"
          readiness={readiness}
          onOpenMap={openReadinessMap}
        />
      </ContentSection>
      </DroughtOperationalDisclosure>}
    </div>
  );
}
