import type { NakhonRatchasimaDroughtForecastArchive } from "../../types";
import { useDroughtForecastArchiveSelection } from "./forecastModel";
import { DroughtCompactForecastWorkspace } from "./DroughtForecastWorkspace";
import { useState } from "react";
import type { ProvinceDashboardTab } from "./workspaceModel";
import { ProvinceForecastOverview } from "./ProvinceForecastOverview";

function ProvinceDroughtView({ droughtArchive, onNavigate }: {
  droughtArchive: NakhonRatchasimaDroughtForecastArchive;
  onNavigate: (path: string) => void;
}) {
  const forecastArchive = useDroughtForecastArchiveSelection(droughtArchive);
  const [selectedSubdistrictCode, onSelectedSubdistrictChange] = useState<string | null>(null);
  return (
    <div className="nr-drought-dashboard nr-research-dashboard is-drought">
      <DroughtCompactForecastWorkspace
        level="province"
        title="เปรียบเทียบพยากรณ์ภัยแล้งล่วงหน้า 6 เดือน"
        description="ดูพยากรณ์ล่วงหน้า 6 เดือนจากเดือนตั้งต้นเดียวกันและแผนที่พยากรณ์"
        scopeLabel="จ.นครราชสีมา"
        archive={droughtArchive}
        target={{ valid: true, level: "province", tab: "drought" }}
        selectedTargetMonth={forecastArchive.selectedMonth}
        selectedHorizon={forecastArchive.selectedHorizon}
        irrigation={forecastArchive.irrigation}
        onHorizonChange={forecastArchive.changeHorizon}
        onNavigate={onNavigate}
        selectedMonth={forecastArchive.selectedMonth?.period ?? ""}
        monthOptions={forecastArchive.targetMonthOptions}
        onMonthChange={forecastArchive.changeTargetMonth}
        selectedSubdistrictCode={selectedSubdistrictCode}
        onSelectedSubdistrictChange={onSelectedSubdistrictChange}
      />
    </div>
  );
}

export function ProvinceView({ droughtArchive, activeTab, onNavigate }: {
  droughtArchive: NakhonRatchasimaDroughtForecastArchive | null;
  activeTab: ProvinceDashboardTab;
  onNavigate: (path: string) => void;
}) {
  return activeTab === "overview" ? <ProvinceForecastOverview onNavigate={onNavigate} />
    : droughtArchive ? <ProvinceDroughtView droughtArchive={droughtArchive} onNavigate={onNavigate} /> : null;
}
