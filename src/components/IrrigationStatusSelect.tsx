import { Droplets } from "lucide-react";
import { irrigationCriteria, irrigationLabels, normalizeIrrigationCriterion, type IrrigationCriterion } from "../irrigation";
import { AppSelect } from "./AppSelect";

export type IrrigationFilter = { value: IrrigationCriterion; onChange: (value: IrrigationCriterion) => void };

export function IrrigationStatusSelect({ value, onChange, compact = false }: IrrigationFilter & { compact?: boolean }) {
  return <AppSelect
    className="nr-irrigation-filter"
    label={compact ? undefined : "สถานะชลประทาน"}
    ariaLabel="สถานะชลประทาน"
    icon={compact ? undefined : <Droplets size={20} />}
    compactValue
    value={value}
    onChange={(next) => onChange(normalizeIrrigationCriterion(next))}
    options={irrigationCriteria.map((criterion) => ({ value: criterion, label: irrigationLabels[criterion] }))}
  />;
}
