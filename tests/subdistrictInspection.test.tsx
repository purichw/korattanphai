import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DroughtForecastArchiveHorizonSelector } from "../src/components/nakhon-ratchasima/ForecastControls";
import { clampLocalTransform, localMaxZoom, transformForLocalFocus } from "../src/components/nakhon-ratchasima/workspaceModel";
import type { NakhonRatchasimaDroughtForecastArchiveTargetMonth, NakhonRatchasimaGeoFeature } from "../src/types";

afterEach(cleanup);

it("supports roving keyboard selection without merging six horizons", () => {
  const onChange = vi.fn();
  render(<DroughtForecastArchiveHorizonSelector targetMonth={{ period: "2025-12" } as NakhonRatchasimaDroughtForecastArchiveTargetMonth} selectedHorizon={4} onHorizonChange={onChange} />);
  const tabs = screen.getAllByRole("tab");
  expect(tabs).toHaveLength(6);
  expect(tabs.filter(tab => tab.tabIndex === 0)).toEqual([tabs[3]]);
  for (const [key, horizon] of [["ArrowRight",5],["ArrowLeft",3],["Home",1],["End",6]] as const) {
    fireEvent.keyDown(tabs[3], { key });
    expect(onChange).toHaveBeenLastCalledWith(horizon);
    expect(tabs[horizon - 1]).toHaveFocus();
  }
});

it("keeps the default map limit and permits an explicit single-area limit", () => {
  const next = { x: -1000, y: -800, k: 20 };
  expect(clampLocalTransform(next).k).toBe(localMaxZoom);
  expect(clampLocalTransform(next, 28)).toEqual(next);
  expect(clampLocalTransform({ ...next, k: 40 }, 28).k).toBe(28);
});

it("fits real geometry bounds within padding without raising other map limits", () => {
  const feature = { geometry: { type: "Polygon", coordinates: [[[10,10],[30,10],[30,20],[10,20],[10,10]]] } } as NakhonRatchasimaGeoFeature;
  const projection = { x: (lon: number) => lon, y: (lat: number) => lat };
  const padding = { top: 100, right: 150, bottom: 100, left: 100 };
  const standard = transformForLocalFocus([feature], projection, 28, 1, padding);
  const inspection = transformForLocalFocus([feature], projection, 28, 1, padding, 28);
  expect(standard.k).toBe(localMaxZoom);
  expect(inspection.k).toBeGreaterThan(localMaxZoom);
  expect(10 * inspection.k + inspection.x).toBeGreaterThanOrEqual(padding.left);
  expect(30 * inspection.k + inspection.x).toBeLessThanOrEqual(760 - padding.right);
  expect(10 * inspection.k + inspection.y).toBeGreaterThanOrEqual(padding.top);
  expect(20 * inspection.k + inspection.y).toBeLessThanOrEqual(520 - padding.bottom);
});
