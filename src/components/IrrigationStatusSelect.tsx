import { Droplets } from "lucide-react";
import { irrigationCriteria, irrigationLabels, normalizeIrrigationCriterion, type ForecastMapColorMode, type IrrigationCriterion } from "../irrigation";
import { AppSelect } from "./AppSelect";

export type IrrigationFilter = { value: IrrigationCriterion; onChange: (value: IrrigationCriterion) => void };
export type ForecastMapIrrigation = IrrigationFilter & {
  colorMode: ForecastMapColorMode;
  onColorModeChange: (mode: ForecastMapColorMode) => void;
};

export function IrrigationStatusSelect({ value, onChange, compact = false }: IrrigationFilter & { compact?: boolean }) {
  return <AppSelect
    className="nr-irrigation-filter nr-local-map-select"
    label={compact ? undefined : "สถานะชลประทาน"}
    ariaLabel="สถานะชลประทาน"
    icon={compact ? undefined : <Droplets size={20} />}
    compactValue
    value={value}
    onChange={(next) => onChange(normalizeIrrigationCriterion(next))}
    options={irrigationCriteria.map((criterion) => ({ value: criterion, label: irrigationLabels[criterion], triggerLabel: compact && criterion === "all" ? "ชลประทาน: ทุกสถานะ" : undefined }))}
  />;
}
