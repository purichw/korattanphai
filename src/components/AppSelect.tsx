import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

export type AppSelectOption = {
  value: string;
  label: string;
  group?: string;
  description?: string;
  badge?: string;
  badgeTone?: "good" | "watch" | "muted";
  disabled?: boolean;
};

type AppSelectProps = {
  value: string;
  options: AppSelectOption[];
  onChange: (value: string) => void;
  label?: string;
  ariaLabel?: string;
  icon?: ReactNode;
  className?: string;
  menuClassName?: string;
};

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("th-TH");
}

export function AppSelect({
  value,
  options,
  onChange,
  label,
  ariaLabel,
  icon,
  className,
  menuClassName,
}: AppSelectProps) {
  const generatedId = useId().replaceAll(":", "");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const searchRef = useRef("");
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const firstEnabledIndex = options.findIndex((option) => !option.disabled);
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex);
  const selectedOption = options[selectedIndex] ?? options[firstEnabledIndex] ?? options[0];
  const listboxId = `${generatedId}-listbox`;
  const labelId = `${generatedId}-label`;
  const valueId = `${generatedId}-value`;
  const activeOptionId = activeIndex >= 0 ? `${generatedId}-option-${activeIndex}` : undefined;
  const enabledIndexes = useMemo(
    () => options.map((option, index) => (option.disabled ? -1 : index)).filter((index) => index >= 0),
    [options],
  );

  useEffect(() => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex);
  }, [firstEnabledIndex, selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId, isOpen]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const openMenu = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex);
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    searchRef.current = "";
  };

  const moveActive = (step: number) => {
    if (enabledIndexes.length === 0) return;
    const currentPosition = enabledIndexes.indexOf(activeIndex);
    const fallbackPosition = step > 0 ? -1 : 0;
    const nextPosition = (currentPosition >= 0 ? currentPosition : fallbackPosition) + step;
    const normalizedPosition = (nextPosition + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[normalizedPosition]);
  };

  const chooseIndex = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    closeMenu();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleTypeahead = (key: string) => {
    if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    searchRef.current = `${searchRef.current}${key}`;
    const search = normalizeSearch(searchRef.current);
    const matchIndex = options.findIndex((option) => {
      if (option.disabled) return false;
      const labelText = normalizeSearch(
        [option.label, option.description, option.group, option.badge].filter(Boolean).join(" "),
      );
      return labelText.startsWith(search) || labelText.includes(search);
    });
    if (matchIndex >= 0) {
      setActiveIndex(matchIndex);
      setIsOpen(true);
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      searchRef.current = "";
      searchTimeoutRef.current = null;
    }, 650);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(event.key === "Home" ? enabledIndexes[0] : enabledIndexes[enabledIndexes.length - 1]);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isOpen) {
        chooseIndex(activeIndex);
      } else {
        openMenu();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === "Tab") {
      closeMenu();
      return;
    }

    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      handleTypeahead(event.key);
    }
  };

  let currentGroup: string | undefined;

  return (
    <div
      ref={rootRef}
      className={[
        "app-select-field",
        icon ? "has-leading-icon" : "",
        label ? "has-visible-label" : "",
        isOpen ? "is-open" : "",
        className ?? "",
      ].join(" ")}
    >
      {label && (
        <span id={labelId} className="app-select-label">
          {label}
        </span>
      )}
      {icon && (
        <span className="app-select-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        className="app-select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen ? activeOptionId : undefined}
        aria-labelledby={label ? `${labelId} ${valueId}` : undefined}
        aria-label={label ? undefined : ariaLabel}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span id={valueId} className="app-select-value">
          {selectedOption?.label ?? ""}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {isOpen && (
        <>
          <div
            className="app-select-backdrop"
            aria-hidden="true"
            onPointerDown={(event) => {
              event.preventDefault();
              closeMenu();
            }}
          />
          <div
            id={listboxId}
            className={["app-select-menu", menuClassName ?? ""].join(" ")}
            role="listbox"
            aria-labelledby={label ? labelId : undefined}
            aria-label={label ? undefined : ariaLabel}
          >
            <div className="app-select-menu-header" role="presentation">
              {label ?? ariaLabel ?? "ตัวเลือก"}
            </div>
            {options.map((option, index) => {
              const showGroup = option.group && option.group !== currentGroup;
              currentGroup = option.group;
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <div key={option.value}>
                  {showGroup && (
                    <div className="app-select-group" role="presentation">
                      {option.group}
                    </div>
                  )}
                  <div
                    id={`${generatedId}-option-${index}`}
                    className={[
                      "app-select-option",
                      option.description ? "has-description" : "",
                      option.badge ? "has-badge" : "",
                      isSelected ? "is-selected" : "",
                      isActive ? "is-active" : "",
                      option.disabled ? "is-disabled" : "",
                    ].join(" ")}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    data-select-value={option.value}
                    onMouseEnter={() => {
                      if (!option.disabled) setActiveIndex(index);
                    }}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => chooseIndex(index)}
                  >
                    <span className="app-select-option-copy">
                      <span>{option.label}</span>
                      {option.description && <small>{option.description}</small>}
                    </span>
                    {option.badge && (
                      <span className={`app-select-badge is-${option.badgeTone ?? "muted"}`}>{option.badge}</span>
                    )}
                    <Check size={16} aria-hidden="true" />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
