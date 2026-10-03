import type { NakhonRatchasimaDroughtForecastArchive, NakhonRatchasimaDistrict, NakhonRatchasimaSubdistrict } from "../../types";
import { useDroughtForecastArchiveSelection } from "./forecastModel";
import { DroughtCompactForecastWorkspace } from "./DroughtForecastWorkspace";

export function SubdistrictView({ droughtArchive, district, subdistrict, onNavigate }: {
  droughtArchive: NakhonRatchasimaDroughtForecastArchive;
  district: NakhonRatchasimaDistrict;
  subdistrict: NakhonRatchasimaSubdistrict;
  onNavigate: (path: string) => void;
}) {
  const forecastArchive = useDroughtForecastArchiveSelection(droughtArchive);
  const subdistrictCodes = [subdistrict.subdistrictCode];
  return (
    <div className="nr-area-template is-subdistrict">
      <DroughtCompactForecastWorkspace
        level="subdistrict"
        title={`คาดการณ์ภัยแล้งของตำบล${subdistrict.nameTh}`}
        description="เลือกระยะพยากรณ์ล่วงหน้า 1–6 เดือนจากเดือนตั้งต้นของตำบลและแสดงผลบนแผนที่"
        scopeLabel={`ต.${subdistrict.nameTh} · อ.${district.nameTh}`}
        singleSubdistrict
        archive={droughtArchive}
        expectedSubdistrictCodes={subdistrictCodes}
        target={{ valid: true, level: "subdistrict", district, subdistrict }}
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
