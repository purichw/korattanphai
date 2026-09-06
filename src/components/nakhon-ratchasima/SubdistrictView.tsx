import { type NakhonRatchasimaDroughtForecastArchive, type NakhonRatchasimaDistrict, type NakhonRatchasimaSubdistrict, type NakhonRatchasimaMapLayer } from "../../types";
import {
  type LocalMapMode,
  localResearchPeriodForSelectedMonth,
  summarizeResearchAreaRecords,
  researchMonthlySeriesForSubdistrict,
} from "./workspaceModel";
import { type AppSelectOption } from "../AppSelect";
import { getNakhonRatchasimaResearchPanelSummary, getNakhonRatchasimaResearchSubdistrictMonth } from "../../domain";
import { useDroughtForecastArchiveSelection } from "./forecastModel";
import {
  ResearchAreaHeading,
  ResearchSubdistrictProfilePanel,
  ResearchSubdistrictDataGapPanel,
  ResearchAreaSituationPanel,
  ResearchAreaDroughtHistoryPanel,
} from "./ResearchPanels";
import { DroughtCompactForecastWorkspace } from "./DroughtForecastWorkspace";
import { DroughtOperationalDisclosure } from "./DroughtOperationalWorkspace";

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

  return (
    <div className="nr-area-template is-subdistrict">
      <DroughtCompactForecastWorkspace
        level="subdistrict"
        title={`คาดการณ์ภัยแล้งของตำบล${subdistrict.nameTh}`}
        description="เลือก T+ เพื่ออ่านพยากรณ์ล่วงหน้า 1–6 เดือนจากเดือนตั้งต้นของตำบลและแสดงผลบนแผนที่"
        scopeLabel={`ต.${subdistrict.nameTh} · อ.${district.nameTh}`}
        singleSubdistrict
        archive={droughtArchive}
        expectedSubdistrictCodes={subdistrictCodes}
        target={{ valid: true, level: "subdistrict", district, subdistrict }}
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
    </div>
  );
}
