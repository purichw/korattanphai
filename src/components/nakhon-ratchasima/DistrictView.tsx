import type { NakhonRatchasimaDroughtForecastArchive, NakhonRatchasimaDistrict } from "../../types";
import { useDroughtForecastArchiveSelection } from "./forecastModel";
import { DroughtCompactForecastWorkspace } from "./DroughtForecastWorkspace";

export function DistrictView({ droughtArchive, district, onNavigate }: {
  droughtArchive: NakhonRatchasimaDroughtForecastArchive;
  district: NakhonRatchasimaDistrict;
  onNavigate: (path: string) => void;
}) {
  const forecastArchive = useDroughtForecastArchiveSelection(droughtArchive);
  const subdistrictCodes = district.subdistricts.map((subdistrict) => subdistrict.subdistrictCode);
  return (
    <div className="nr-area-template is-district">
      <DroughtCompactForecastWorkspace
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
        onNavigate={onNavigate}
        selectedMonth={forecastArchive.selectedMonth?.period ?? ""}
        monthOptions={forecastArchive.targetMonthOptions}
        onMonthChange={forecastArchive.changeTargetMonth}
      />
    </div>
  );
}
