import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, LoaderCircle, Search, SearchX, X } from "lucide-react";

export type AppSelectOption = {
  value: string;
  label: string;
  triggerLabel?: string;
  group?: string;
  description?: string;
  badge?: string;
  badgeTone?: "good" | "watch" | "danger" | "muted";
  disabled?: boolean;
  searchText?: string;
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
  compactValue?: boolean;
  align?: "center" | "start";
  loadingLabel?: string;
  searchable?: boolean;
};

function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("th-TH")
    .replace(/[๐-๙]/g, digit => String(digit.charCodeAt(0) - 0x0e50)).replace(/[.\s]/g, "");
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
  compactValue = false,
  align = "center",
  loadingLabel,
  searchable,
}: AppSelectProps) {
  const generatedId = useId().replaceAll(":", "");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const searchRef = useRef("");
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const canSearch = searchable ?? options.length >= 8;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const firstEnabledIndex = options.findIndex((option) => !option.disabled);
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex);
  const selectedOption = options[selectedIndex] ?? options[firstEnabledIndex] ?? options[0];
  const listboxId = `${generatedId}-listbox`;
  const labelId = `${generatedId}-label`;
  const valueId = `${generatedId}-value`;
  const loadingId = `${generatedId}-loading`;
  const visibleOptions = useMemo(() => {
    const terms = canSearch ? query.trim().split(/\s+/).map(normalizeSearch).filter(Boolean) : [];
    return options.map((option, index) => ({ option, index })).filter(({ option }) => {
      const text = normalizeSearch([option.label, option.triggerLabel, option.value, option.searchText,
        option.description, option.group, option.badge].filter(Boolean).join(" "));
      return terms.every(term => text.includes(term));
    });
  }, [options, query, canSearch]);
  const enabledIndexes = useMemo(
    () => visibleOptions.filter(({ option }) => !option.disabled).map(({ index }) => index),
    [visibleOptions],
  );
  const currentActiveIndex = enabledIndexes.includes(activeIndex) ? activeIndex : (enabledIndexes[0] ?? -1);
  const activeOptionId = currentActiveIndex >= 0 ? `${generatedId}-option-${currentActiveIndex}` : undefined;

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
    const option = document.getElementById(activeOptionId);
    const list = document.getElementById(listboxId);
    if (!canSearch) { option?.scrollIntoView({ block: "nearest" }); return; }
    // Scroll only the results, keeping the search field and page position fixed.
    if (option && list) {
      const itemBox = option.getBoundingClientRect();
      const listBox = list.getBoundingClientRect();
      if (itemBox.top < listBox.top) list.scrollTop += itemBox.top - listBox.top;
      else if (itemBox.bottom > listBox.bottom) list.scrollTop += itemBox.bottom - listBox.bottom;
    }
  }, [activeOptionId, isOpen, canSearch, listboxId, query]);

  useEffect(() => {
    if (!isOpen || !canSearch) return;
    // Touch users can browse without opening the keyboard; desktop can type immediately.
    if (window.matchMedia?.("(min-width: 721px)").matches) inputRef.current?.focus({ preventScroll: true });
    const viewport = window.visualViewport;
    const updateViewport = () => {
      rootRef.current?.style.setProperty("--app-select-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      rootRef.current?.style.setProperty("--app-select-viewport-bottom", `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`);
    };
    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    return () => { viewport?.removeEventListener("resize", updateViewport); viewport?.removeEventListener("scroll", updateViewport); };
  }, [isOpen, canSearch]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const openMenu = () => {
    setQuery("");
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex);
    setIsOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    searchRef.current = "";
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  };

  const moveActive = (step: number) => {
    if (enabledIndexes.length === 0) return;
    const currentPosition = enabledIndexes.indexOf(currentActiveIndex);
    const fallbackPosition = step > 0 ? -1 : 0;
    const nextPosition = (currentPosition >= 0 ? currentPosition : fallbackPosition) + step;
    const normalizedPosition = (nextPosition + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[normalizedPosition]);
  };

  const chooseIndex = (index: number) => {
    const option = options[index];
    if (!option || option.disabled || !enabledIndexes.includes(index)) return;
    onChange(option.value);
    closeMenu();
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
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
    if (event.nativeEvent.isComposing) return;
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
        chooseIndex(currentActiveIndex);
      } else {
        openMenu();
      }
      return;
    }

    if (event.key === "Escape") {
      if (!isOpen) return;
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }

    if (event.key === "Tab") {
      closeMenu();
      return;
    }

    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      if (canSearch) {
        setQuery(event.key); setActiveIndex(-1); setIsOpen(true);
        window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      } else handleTypeahead(event.key);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      event.preventDefault(); chooseIndex(currentActiveIndex);
    }
  };

  let currentGroup: string | undefined;

  return (
    <div
      ref={rootRef}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) closeMenu(); }}
      onKeyDown={event => {
        if (isOpen && event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault(); event.stopPropagation(); closeMenu(true);
        }
      }}
      className={[
        "app-select-field",
        icon ? "has-leading-icon" : "",
        label ? "has-visible-label" : "",
        `is-align-${align}`,
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
        aria-busy={Boolean(loadingLabel) || undefined}
        aria-describedby={loadingLabel ? loadingId : undefined}
        title={loadingLabel}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span id={valueId} className="app-select-value">
          {(compactValue ? selectedOption?.triggerLabel : undefined) ?? selectedOption?.label ?? ""}
        </span>
        {loadingLabel ? <LoaderCircle size={17} className="app-select-spinner" aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
      </button>
      {loadingLabel && <span id={loadingId} className="sr-only">{loadingLabel}</span>}
      {isOpen && (
        <>
          <div
            className="app-select-backdrop"
            aria-hidden="true"
            onPointerDown={(event) => {
              event.preventDefault();
              closeMenu(true);
            }}
          />
          <div
            className={["app-select-menu", canSearch ? "is-searchable" : "", menuClassName ?? ""].join(" ")}
            role="presentation"
          >
            <div className="app-select-menu-header" role="presentation">
              <span>{label ?? ariaLabel ?? "ตัวเลือก"}</span>
              <button type="button" className="app-select-menu-close" aria-label="ปิดตัวเลือก" onClick={() => closeMenu(true)}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            {canSearch && <div className="app-select-search">
              <Search size={17} aria-hidden="true" />
              <input ref={inputRef} type="text" role="searchbox" aria-label={`ค้นหาตัวเลือก ${label ?? ariaLabel ?? ""}`}
                aria-controls={listboxId} aria-autocomplete="list" aria-activedescendant={activeOptionId}
                autoComplete="off" spellCheck={false} placeholder="ค้นหา..." value={query}
                onChange={event => { setQuery(event.target.value); setActiveIndex(-1); }} onKeyDown={handleSearchKeyDown} />
              {query && <button type="button" aria-label="ล้างคำค้นตัวเลือก" title="ล้างคำค้น" onClick={() => {
                setQuery(""); setActiveIndex(selectedIndex); inputRef.current?.focus({ preventScroll: true });
              }}><X size={16} aria-hidden="true" /></button>}
            </div>}
            <div
              id={listboxId}
              className="app-select-options"
              role="listbox"
              aria-labelledby={label ? labelId : undefined}
              aria-label={label ? undefined : ariaLabel}
            >
              {visibleOptions.map(({ option, index }) => {
                const showGroup = option.group && option.group !== currentGroup;
                currentGroup = option.group;
                const isSelected = option.value === value;
                const isActive = index === currentActiveIndex;
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
            {canSearch && !visibleOptions.length && <div className="app-select-empty" role="status">
              <SearchX size={24} aria-hidden="true" /><strong>ไม่พบตัวเลือก</strong><span>ลองใช้คำค้นอื่น</span>
            </div>}
            {canSearch && visibleOptions.length > 0 && <span className="sr-only" role="status">{visibleOptions.length} ตัวเลือก</span>}
          </div>
        </>
      )}
    </div>
  );
}
