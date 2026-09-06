import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Edit3, Leaf, MapPin, ShieldAlert, TrendingUp, X } from "lucide-react";
import type { AppSelectOption } from "./AppSelect";
import { AppSelect } from "./AppSelect";
import { months, provinces } from "../data/catalog";
import { getProvinceRecord } from "../domain";
import { formatMonth, t } from "../i18n";
import { useAppDispatch, useAppState } from "../store";

type ContextChip = {
  label: string;
  value: string;
};

type FilterSummaryFact = {
  label: string;
  value: string;
};

type FilterSummaryItem = {
  id: string;
  label: string;
  value: string;
  icon: ReactNode;
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
  quickFacts?: FilterSummaryFact[];
  ariaLabel?: string;
  className?: string;
  compactOverview?: boolean;
};

const scopedHazardOptions: AppSelectOption[] = [{ value: "All", label: "ภัยแล้ง" }];
const scopedCropOptions: AppSelectOption[] = [{ value: "All", label: "ข้าว" }];

function filterCount(hasArea: boolean, contextChipCount: number) {
  return Math.min(6, 3 + (hasArea ? 1 : 0) + contextChipCount);
}

function labelForOption(options: AppSelectOption[], value: string, fallback: string) {
  const selected = options.find((option) => option.value === value);
  return selected?.triggerLabel ?? selected?.label ?? fallback;
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
  quickFacts = [],
  ariaLabel = "ตัวกรองการปฏิบัติการ",
  className,
  compactOverview = false,
}: OperationalFiltersProps) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const sheetTitleId = `${useId().replaceAll(":", "")}-filter-sheet-title`;
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const editButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
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
          label: `${formatMonth(selectedMonth, language)} · ไม่มีข้อมูลในรอบนี้`,
          group: "เดือนที่เลือก",
          badge: "ใช้รอบล่าสุด",
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
  const itemCount = filterCount(Boolean(areaSelectConfig), compactOverview ? 0 : contextChips.length);
  const monthLabel = labelForOption(resolvedMonthOptions, selectedMonth, formatMonth(selectedMonth, language));
  const hazardLabel = labelForOption(scopedHazardOptions, state.selectedHazard, scopedHazardOptions[0].label);
  const cropLabel = labelForOption(scopedCropOptions, state.selectedCrop, scopedCropOptions[0].label);
  const areaSummaryLabel = areaSelectConfig
    ? labelForOption(areaSelectConfig.options, areaSelectConfig.value, areaPlaceholder ?? areaSelectConfig.label)
    : null;
  const summaryItems = useMemo<FilterSummaryItem[]>(() => {
    const items: FilterSummaryItem[] = [
      { id: "month", label: t("month", language), value: monthLabel, icon: <CalendarDays size={16} /> },
      { id: "hazard", label: t("hazard", language), value: hazardLabel, icon: <ShieldAlert size={16} /> },
      { id: "crop", label: t("crop", language), value: cropLabel, icon: <Leaf size={16} /> },
    ];
    if (areaSummaryLabel) {
      items.push({ id: "area", label: areaSelectConfig?.label ?? "พื้นที่", value: areaSummaryLabel, icon: <MapPin size={16} /> });
    }
    contextChips.forEach((chip) => {
      items.push({
        id: `context-${chip.label}-${chip.value}`,
        label: chip.label,
        value: chip.value,
        icon: compactOverview ? <TrendingUp size={16} /> : <MapPin size={16} />,
      });
    });
    return items;
  }, [areaSelectConfig?.label, areaSummaryLabel, compactOverview, contextChips, cropLabel, hazardLabel, language, monthLabel]);

  useEffect(() => {
    if (!isEditorOpen) return;

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFirstControl = window.requestAnimationFrame(() => {
      sheetRef.current?.querySelector<HTMLButtonElement>(".operational-filter-sheet-close")?.focus();
    });

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        if (sheetRef.current?.querySelector(".app-select-field.is-open")) return;
        event.preventDefault();
        setIsEditorOpen(false);
        return;
      }

      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusableElements = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("aria-hidden"));
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.body.classList.add("has-operational-filter-sheet");
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFirstControl);
      document.body.classList.remove("has-operational-filter-sheet");
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [isEditorOpen]);

  const closeEditor = () => setIsEditorOpen(false);

  return (
    <section
      className={["control-band", "operational-filters", `filter-count-${itemCount}`, compactOverview ? "is-overview-filter" : "", className ?? ""].join(" ")}
      aria-label={ariaLabel}
    >
      <div className="operational-filter-fields">
        <AppSelect
          label={t("month", language)}
          icon={compactOverview ? <CalendarDays size={20} /> : undefined}
          compactValue={compactOverview}
          value={selectedMonth}
          onChange={changeMonth}
          options={resolvedMonthOptions}
        />
        {compactOverview ? <div className="operational-fixed-field"><ShieldAlert size={20} aria-hidden="true" /><span>ภัย<strong>{hazardLabel}</strong></span></div> : <AppSelect
          label={t("hazard", language)}
          value={state.selectedHazard}
          onChange={(hazard) => dispatch({ type: "setHazard", hazard })}
          options={scopedHazardOptions}
        />}
        {compactOverview ? <div className="operational-fixed-field"><Leaf size={20} aria-hidden="true" /><span>พืช<strong>{cropLabel}</strong></span></div> : <AppSelect
          label={t("crop", language)}
          value={state.selectedCrop}
          onChange={(crop) => dispatch({ type: "setCrop", crop })}
          options={scopedCropOptions}
        />}
        {areaSelectConfig && (
          <AppSelect
            label={areaSelectConfig.label}
            icon={compactOverview ? <MapPin size={20} /> : undefined}
            value={areaSelectConfig.value}
            onChange={areaSelectConfig.onChange}
            options={areaSelectConfig.options}
            menuClassName="app-select-menu-wide"
          />
        )}
        {!compactOverview && contextChips.map((chip) => (
          <div key={`${chip.label}-${chip.value}`} className="context-chip">
            <span>{chip.label}</span>
            <strong>{chip.value}</strong>
          </div>
        ))}
      </div>

      <div className="operational-filter-mobile-summary" aria-label="สรุปตัวกรองข้อมูล">
        <div className="operational-filter-summary-head">
          <strong>ตัวกรองข้อมูล</strong>
          <button
            ref={editButtonRef}
            type="button"
            className="operational-filter-edit"
            aria-label="แก้ไขตัวกรองข้อมูล"
            onClick={() => setIsEditorOpen(true)}
          >
            แก้ไข
            <Edit3 size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="operational-filter-chip-row">
          {summaryItems.map((item) => compactOverview && !["month", "area"].includes(item.id) ? (
            <div key={item.id} className={`operational-filter-chip is-fixed is-${item.id}`}>
              <span aria-hidden="true">{item.icon}</span><b>{item.value}</b>
            </div>
          ) : (
            <button
              key={item.id}
              type="button"
              className={`operational-filter-chip is-${item.id}`}
              aria-label={`แก้ไขตัวกรอง${item.label}: ${item.value}`}
              onClick={() => setIsEditorOpen(true)}
            >
              <span aria-hidden="true">{item.icon}</span>
              <b>{item.value}</b>
            </button>
          ))}
        </div>
        {quickFacts.length > 0 && (
          <dl className="operational-filter-facts" aria-label="ข้อมูลสรุปพื้นที่">
            {quickFacts.map((fact) => (
              <div key={`${fact.label}-${fact.value}`}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {isEditorOpen && (
        <>
          <div className="operational-filter-sheet-backdrop" aria-hidden="true" onPointerDown={closeEditor} />
          <div
            ref={sheetRef}
            className="operational-filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={sheetTitleId}
          >
            <span className="operational-filter-sheet-handle" aria-hidden="true" />
            <header className="operational-filter-sheet-header">
              <h2 id={sheetTitleId}>ตัวกรองข้อมูล</h2>
              <button type="button" className="operational-filter-sheet-close" aria-label="ปิดตัวกรองข้อมูล" onClick={closeEditor}>
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="operational-filter-sheet-fields">
              <div className="operational-filter-sheet-row">
                <span>เดือน</span>
                <AppSelect
                  ariaLabel="เลือกเดือน"
                  value={selectedMonth}
                  onChange={changeMonth}
                  options={resolvedMonthOptions}
                  compactValue
                  menuClassName="app-select-menu-wide"
                  className="operational-filter-sheet-select"
                />
              </div>
              <div className="operational-filter-sheet-row">
                <span>ภัย</span>
                {compactOverview ? <strong>{hazardLabel}</strong> : <AppSelect
                  ariaLabel="เลือกภัย"
                  value={state.selectedHazard}
                  onChange={(hazard) => dispatch({ type: "setHazard", hazard })}
                  options={scopedHazardOptions}
                  compactValue
                  className="operational-filter-sheet-select"
                />}
              </div>
              <div className="operational-filter-sheet-row">
                <span>พืช</span>
                {compactOverview ? <strong>{cropLabel}</strong> : <AppSelect
                  ariaLabel="เลือกพืช"
                  value={state.selectedCrop}
                  onChange={(crop) => dispatch({ type: "setCrop", crop })}
                  options={scopedCropOptions}
                  compactValue
                  className="operational-filter-sheet-select"
                />}
              </div>
              {areaSelectConfig && (
                <div className="operational-filter-sheet-row">
                  <span>พื้นที่</span>
                  <AppSelect
                    ariaLabel={`เลือก${areaSelectConfig.label}`}
                    value={areaSelectConfig.value}
                    onChange={areaSelectConfig.onChange}
                    options={areaSelectConfig.options}
                    compactValue
                    menuClassName="app-select-menu-wide"
                    className="operational-filter-sheet-select"
                  />
                </div>
              )}
              {contextChips.map((chip) => (
                <div key={`sheet-${chip.label}-${chip.value}`} className="operational-filter-sheet-static-row">
                  <span>{chip.label}</span>
                  <strong>{chip.value}</strong>
                </div>
              ))}
            </div>
            <button type="button" className="primary-button operational-filter-sheet-submit" onClick={closeEditor}>
              แสดงผล
            </button>
          </div>
        </>
      )}
    </section>
  );
}
