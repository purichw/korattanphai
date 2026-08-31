import type { AppSelectOption } from "./AppSelect";
import { AppSelect } from "./AppSelect";
import { crops, hazards, months, provinces } from "../data/catalog";
import { getProvinceRecord } from "../domain";
import { formatMonth, labelCrop, labelHazard, t } from "../i18n";
import { useAppDispatch, useAppState } from "../store";

type ContextChip = {
  label: string;
  value: string;
};

type OperationalFiltersProps = {
  monthOptions?: AppSelectOption[];
  monthValue?: string;
  onMonthChange?: (month: string) => void;
  areaLabel?: string;
  areaValue?: string;
  areaOptions?: AppSelectOption[];
  areaPlaceholder?: string;
  onAreaChange?: (value: string) => void;
  contextChips?: ContextChip[];
  ariaLabel?: string;
  className?: string;
};

function filterCount(hasArea: boolean, contextChipCount: number) {
  return Math.min(6, 3 + (hasArea ? 1 : 0) + contextChipCount);
}

export function provinceOptionsForMonth(month: string): AppSelectOption[] {
  return provinces.map((province) => {
    const record = getProvinceRecord(province.id, month);
    return {
      value: province.id,
      label: record?.provinceTh ?? province.nameTh ?? province.name,
    };
  });
}

export function OperationalFilters({
  monthOptions,
  monthValue,
  onMonthChange,
  areaLabel,
  areaValue,
  areaOptions,
  areaPlaceholder,
  onAreaChange,
  contextChips = [],
  ariaLabel = "ตัวกรองการปฏิบัติการ",
  className,
}: OperationalFiltersProps) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const language = state.language;
  const selectedMonth = monthValue ?? state.selectedMonth;
  const changeMonth = onMonthChange ?? ((month: string) => dispatch({ type: "setMonth", month }));
  const baseMonthOptions =
    monthOptions ?? months.map((month) => ({ value: month, label: formatMonth(month, language) }));
  const resolvedMonthOptions = baseMonthOptions.some((option) => option.value === selectedMonth)
    ? baseMonthOptions
    : [
        {
          value: selectedMonth,
          label: `${formatMonth(selectedMonth, language)} · นอกชุดข้อมูล`,
          group: "เดือนที่เลือกอยู่",
          badge: "fallback",
          badgeTone: "watch" as const,
        },
        ...baseMonthOptions,
      ];
  const areaSelectConfig =
    areaLabel && areaOptions && onAreaChange
      ? {
          label: areaLabel,
          value: areaValue ?? "",
          onChange: onAreaChange,
          options: areaPlaceholder ? [{ value: "", label: areaPlaceholder, disabled: true }, ...areaOptions] : areaOptions,
        }
      : null;
  const itemCount = filterCount(Boolean(areaSelectConfig), contextChips.length);

  return (
    <section className={["control-band", `filter-count-${itemCount}`, className ?? ""].join(" ")} aria-label={ariaLabel}>
      <AppSelect
        label={t("month", language)}
        value={selectedMonth}
        onChange={changeMonth}
        options={resolvedMonthOptions}
      />
      <AppSelect
        label={t("hazard", language)}
        value={state.selectedHazard}
        onChange={(hazard) => dispatch({ type: "setHazard", hazard })}
        options={[
          { value: "All", label: t("all", language) },
          ...hazards.map((hazard) => ({ value: hazard, label: labelHazard(hazard, language) })),
        ]}
      />
      <AppSelect
        label={t("crop", language)}
        value={state.selectedCrop}
        onChange={(crop) => dispatch({ type: "setCrop", crop })}
        options={[
          { value: "All", label: t("all", language) },
          ...crops.map((crop) => ({ value: crop, label: labelCrop(crop, language) })),
        ]}
      />
      {areaSelectConfig && (
        <AppSelect
          label={areaSelectConfig.label}
          value={areaSelectConfig.value}
          onChange={areaSelectConfig.onChange}
          options={areaSelectConfig.options}
          menuClassName="app-select-menu-wide"
        />
      )}
      {contextChips.map((chip) => (
        <div key={`${chip.label}-${chip.value}`} className="context-chip">
          <span>{chip.label}</span>
          <strong>{chip.value}</strong>
        </div>
      ))}
    </section>
  );
}
