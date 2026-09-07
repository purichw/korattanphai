import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { forecastRiskShare, type DroughtForecastTrendMonth, type ForecastArchiveHorizon } from "./forecastModel";
import { formatPercent, formatThaiNumber, useMediaQuery } from "./workspaceModel";

type Detail = { index: number; pinned: boolean } | null;
const categories = [
  { key: "normalSubdistricts", className: "is-normal", label: "ไม่พบสัญญาณเสี่ยง (0)", short: "ไม่เสี่ยง" },
  { key: "moderateRiskSubdistricts", className: "is-moderate", label: "เสี่ยงปานกลาง (1)", short: "ปานกลาง" },
  { key: "highRiskSubdistricts", className: "is-high", label: "เสี่ยงสูง (2)", short: "สูง" },
] as const;

export function DroughtForecastTrendGraph({ months, unit = "percent", activeHorizon }: {
  months: DroughtForecastTrendMonth[];
  unit?: "percent" | "count";
  activeHorizon?: ForecastArchiveHorizon;
}) {
  const compactChart = useMediaQuery("(max-width: 720px)");
  const figureRef = useRef<HTMLElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const tooltipId = useId();
  const [size, setSize] = useState({ width: compactChart ? 360 : 720, height: compactChart ? 230 : 300 });
  const [detail, setDetail] = useState<Detail>(null);

  // Match SVG coordinates to its container so labels keep their CSS-pixel size.
  useLayoutEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const measure = () => {
      const width = Math.floor(plot.clientWidth);
      const height = Math.floor(plot.clientHeight);
      if (width && height) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { setDetail(null); }, [months, unit, activeHorizon]);
  useEffect(() => {
    if (!detail) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!figureRef.current?.contains(event.target as Node)) setDetail(null);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetail(null);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [detail]);

  const { width, height } = size;
  const padding = { top: 30, right: 8, bottom: 52, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = Math.max(height - padding.top - padding.bottom, 1);
  const maximum = unit === "percent" ? 100 : Math.max(...months.map(month => month.inScopeSubdistricts), 1);
  const xStep = plotWidth / Math.max(months.length, 1);
  const barWidth = Math.min(xStep * .56, 64);
  const yForValue = (value: number) => padding.top + (1 - value / maximum) * plotHeight;
  const valueFor = (count: number, month: DroughtForecastTrendMonth) => unit === "count"
    ? count : (forecastRiskShare(count, month.inScopeSubdistricts) ?? 0) * 100;
  const formatValue = (value: number) => unit === "percent" ? formatPercent(value, 1) : formatThaiNumber(value);
  const shareFor = (count: number, month: DroughtForecastTrendMonth) => month.inScopeSubdistricts > 0
    ? formatPercent(count / month.inScopeSubdistricts * 100, 1) : "ไม่มีค่าพยากรณ์";
  const zeroY = yForValue(0);
  const guideValues = Array.from(new Set([0, .25, .5, .75, 1].map(share => Math.round(maximum * share)))).sort((a, b) => a - b);
  const coverageFor = (month: DroughtForecastTrendMonth) => `มีค่าพยากรณ์ ${month.inScopeSubdistricts}/${month.totalSubdistricts} ตำบล · นอกขอบเขต ${month.outOfScopeSubdistricts} · ไม่มีข้อมูล ${month.missingSubdistricts}`;
  const descriptionFor = (month: DroughtForecastTrendMonth) => `T+${month.monthIndex} · ${month.labelTh} · ${categories.map(category => `${category.label} ${month[category.key]} ตำบล (${shareFor(month[category.key], month)})`).join(" · ")} · ${coverageFor(month)}`;
  const title = `แนวโน้ม${unit === "percent" ? "สัดส่วน" : "จำนวน"}ตำบลเสี่ยงภัยแล้ง 6 เดือนข้างหน้า`;
  const detailMonth = detail ? months[detail.index] : undefined;

  return <figure ref={figureRef} className="nr-forecast-line-graph nr-drought-forecast-graph" data-unit={unit}
    onPointerLeave={() => setDetail(current => current?.pinned ? current : null)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDetail(null); }}>
    <div ref={plotRef} className="nr-forecast-bar-plot">
      <svg className="nr-forecast-line-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <title>{title}</title>
        <desc>{months.map(descriptionFor).join("; ")}</desc>
        {months.map((month, index) => activeHorizon === month.monthIndex && <rect key={month.period}
          className="nr-drought-forecast-active-column" x={padding.left + xStep * index + 2} y={8}
          width={xStep - 4} height={zeroY - 4} rx={4} />)}
        {guideValues.map(value => <g key={value} className="nr-forecast-graph-guide">
          <line x1={padding.left} y1={yForValue(value)} x2={width - padding.right} y2={yForValue(value)} />
          <text x={padding.left - 8} y={yForValue(value) + 4}>{formatValue(value)}</text>
        </g>)}
        {months.map((month, index) => {
          const x = padding.left + xStep * (index + .5);
          const moderate = valueFor(month.moderateRiskSubdistricts, month);
          const total = valueFor(month.riskSubdistricts, month);
          const unavailable = month.inScopeSubdistricts === 0;
          return <g key={month.period} className={`nr-forecast-point-group${activeHorizon === month.monthIndex ? " is-active" : ""}`}>
            <title>{descriptionFor(month)}</title>
            {!unavailable && <>
              {month.moderateRiskSubdistricts > 0 && <rect className="nr-drought-forecast-bar is-moderate" data-count={month.moderateRiskSubdistricts} x={x - barWidth / 2} y={yForValue(moderate)} width={barWidth} height={zeroY - yForValue(moderate)} />}
              {month.highRiskSubdistricts > 0 && <rect className="nr-drought-forecast-bar is-high" data-count={month.highRiskSubdistricts} x={x - barWidth / 2} y={yForValue(total)} width={barWidth} height={yForValue(moderate) - yForValue(total)} />}
              {total === 0 && <line className="nr-drought-forecast-zero" x1={x - barWidth / 2} x2={x + barWidth / 2} y1={zeroY} y2={zeroY} />}
            </>}
            <text className={`nr-drought-forecast-point-label${unavailable ? " is-unavailable" : ""}`} x={x} y={yForValue(total) - 10}>
              {unavailable ? "ไม่มีค่า" : formatValue(total)}
            </text>
            <text className="nr-forecast-axis-date" x={x} y={height - 28}>
              <tspan x={x}>T+{month.monthIndex}</tspan>
              <tspan x={x} dy="16">{compactChart || width < 520 ? month.labelTh.replace(/\d{2}(\d{2})$/, "$1") : month.labelTh}</tspan>
            </text>
          </g>;
        })}
      </svg>
      {months.map((month, index) => <button key={month.period} ref={node => { buttons.current[index] = node; }}
        type="button" className="nr-forecast-bar-target" aria-label={`รายละเอียด T+${month.monthIndex} · ${month.labelTh}`}
        aria-describedby={detail?.index === index ? tooltipId : undefined}
        style={{ left: `${(padding.left + xStep * index) / width * 100}%`, width: `${xStep / width * 100}%` }}
        onPointerEnter={event => { if (event.pointerType !== "touch") setDetail(current => current?.pinned ? current : { index, pinned: false }); }}
        onFocus={() => setDetail({ index, pinned: true })}
        onClick={() => setDetail({ index, pinned: true })}
        onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % months.length : event.key === "ArrowLeft" ? (index - 1 + months.length) % months.length : event.key === "Home" ? 0 : event.key === "End" ? months.length - 1 : null;
          if (next !== null) { event.preventDefault(); buttons.current[next]?.focus(); }
        }} />)}
      {detailMonth && <div id={tooltipId} role="tooltip" className={`nr-forecast-bar-tooltip${detail!.index < months.length / 2 ? " is-right" : ""}`}>
        <strong>T+{detailMonth.monthIndex} · {detailMonth.labelTh}</strong>
        <dl>{categories.map(category => <div key={category.key}>
          <dt><i className={category.className} aria-hidden="true" />{category.short}</dt>
          <dd>{formatThaiNumber(detailMonth[category.key])} ตำบล <span>({shareFor(detailMonth[category.key], detailMonth)})</span></dd>
        </div>)}</dl>
        <p>{coverageFor(detailMonth)}</p>
      </div>}
    </div>
    <figcaption className="nr-forecast-line-legend nr-drought-forecast-legend">
      {categories.map(category => <span key={category.key}>
        <i className={category.className} aria-hidden="true" /><span className="nr-legend-full">{category.label}</span><span className="nr-legend-short" aria-hidden="true">{category.short}</span>
      </span>)}
      <span><i className="is-out-of-scope" aria-hidden="true" /><span className="nr-legend-full">นอกขอบเขตการศึกษา</span><span className="nr-legend-short" aria-hidden="true">นอกขอบเขต</span></span>
    </figcaption>
  </figure>;
}
