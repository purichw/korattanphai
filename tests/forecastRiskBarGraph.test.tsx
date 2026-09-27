import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DroughtForecastTrendGraph } from "../src/components/nakhon-ratchasima/ForecastRiskBarGraph";
import type { DroughtForecastTrendMonth } from "../src/components/nakhon-ratchasima/forecastModel";

beforeEach(() => vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const month: DroughtForecastTrendMonth = {
  monthIndex: 1, period: "2026-01", labelTh: "Jan 2026",
  riskSubdistricts: 3, moderateRiskSubdistricts: 2, highRiskSubdistricts: 1,
  normalSubdistricts: 1, totalSubdistricts: 5, inScopeSubdistricts: 4,
  outOfScopeSubdistricts: 1, missingSubdistricts: 0, riskPercent: 75,
};

it.each(["percent", "count"] as const)("softens the stack without changing %s segment geometry", unit => {
  const { container } = render(<DroughtForecastTrendGraph months={[month]} unit={unit} />);
  const moderate = container.querySelector<SVGRectElement>(".nr-drought-forecast-bar.is-moderate")!;
  const high = container.querySelector<SVGRectElement>(".nr-drought-forecast-bar.is-high")!;
  const y = (node: Element) => Number(node.getAttribute("y"));
  const height = (node: Element) => Number(node.getAttribute("height"));
  expect(height(moderate) / height(high)).toBeCloseTo(2);
  expect(y(high) + height(high)).toBeCloseTo(y(moderate));
  expect(container.querySelector(".nr-drought-forecast-point-label")).toHaveTextContent(unit === "percent" ? "75%" : "3");
  expect(moderate.parentElement).toBe(high.parentElement);
  const clipId = moderate.parentElement!.getAttribute("clip-path")!.slice(5, -1);
  const cap = document.getElementById(clipId)!.querySelector("path")!;
  expect(cap.getAttribute("d")!.match(/Q/g)).toHaveLength(2);
  expect(container.querySelector(".nr-drought-forecast-bar-outline")).toHaveAttribute("d", cap.getAttribute("d"));
  for (const bar of [moderate, high]) {
    const gradient = document.getElementById(bar.getAttribute("fill")!.slice(5, -1))!;
    expect(gradient.tagName).toBe("linearGradient");
    expect(gradient.closest("svg")).toBe(bar.ownerSVGElement);
  }
});

it("keeps paint IDs isolated across shared chart instances", () => {
  const { container } = render(<><DroughtForecastTrendGraph months={[month]} /><DroughtForecastTrendGraph months={[month]} /></>);
  const ids = [...container.querySelectorAll("[id]")].map(node => node.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it("does not paint missing forecasts or turn valid zero risk into a bar", () => {
  const zero = { ...month, riskSubdistricts: 0, moderateRiskSubdistricts: 0, highRiskSubdistricts: 0, normalSubdistricts: 4, riskPercent: 0 };
  const unavailable = { ...zero, monthIndex: 2, period: "2026-02", inScopeSubdistricts: 0, normalSubdistricts: 0, outOfScopeSubdistricts: 5, riskPercent: null };
  const { container } = render(<DroughtForecastTrendGraph months={[zero, unavailable]} />);
  expect(container.querySelectorAll(".nr-drought-forecast-bar, clipPath, .nr-drought-forecast-bar-outline")).toHaveLength(0);
  expect(container.querySelectorAll(".nr-drought-forecast-zero")).toHaveLength(1);
  expect(container.querySelectorAll(".nr-drought-forecast-point-label.is-unavailable")).toHaveLength(1);
});
