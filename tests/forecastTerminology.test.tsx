import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { forecastHorizonLabel, forecastTargetPeriod } from "../src/forecastPeriod";
import { formatMonth, formatMonthParts } from "../src/i18n";
import { DroughtForecastArchiveHorizonSelector } from "../src/components/nakhon-ratchasima/ForecastControls";
import { forecastArchiveHorizonValues } from "../src/components/nakhon-ratchasima/forecastModel";
import type { NakhonRatchasimaDroughtForecastArchiveTargetMonth } from "../src/types";

afterEach(cleanup);

it.each(forecastArchiveHorizonValues)("labels horizon %i without changing its numeric selection or target month", (horizon) => {
  expect(forecastHorizonLabel(horizon)).toBe(`ล่วงหน้า ${horizon} เดือน`);
  expect(forecastHorizonLabel(horizon, "short")).toBe(`${horizon} เดือน`);
  expect(forecastTargetPeriod("2025-12", horizon)).toBe(`2026-0${horizon}`);
  const month = { period: "2025-12", labelTh: "ธ.ค. 2568", horizons: [] } as NakhonRatchasimaDroughtForecastArchiveTargetMonth;
  const onHorizonChange = vi.fn();
  const { container } = render(<DroughtForecastArchiveHorizonSelector targetMonth={month} selectedHorizon={1} onHorizonChange={onHorizonChange} />);
  const tab = screen.getByRole("tab", { name: new RegExp(`^ล่วงหน้า ${horizon} เดือน`) });
  expect(tab.querySelector("strong")).toHaveTextContent(`${horizon} เดือน`);
  const targetPeriod = forecastTargetPeriod("2025-12", horizon);
  const dateParts = formatMonthParts(targetPeriod, "th");
  const dateLabel = tab.querySelector("span");
  expect(dateLabel).toHaveTextContent(formatMonth(targetPeriod, "th"));
  expect(dateLabel?.firstChild?.textContent).toBe(dateParts.month);
  expect(dateLabel?.querySelector("br")?.nextSibling?.textContent).toBe("2569");
  fireEvent.click(tab);
  expect(onHorizonChange).toHaveBeenCalledWith(horizon);
  expect(container.textContent).not.toMatch(/T\+/);
  expect(screen.getAllByRole("tab")).toHaveLength(6);
});
