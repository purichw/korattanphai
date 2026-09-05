import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DashboardDetailPanel } from "../src/components/nakhon-ratchasima/SharedPanels";
import { localMapScale } from "../src/components/nakhon-ratchasima/workspaceModel";

afterEach(cleanup);

it("keeps a passive preview visible while its own button expands details", () => {
  render(<DashboardDetailPanel title="Details" icon={null} preview={<p>Preview</p>}><p>Evidence</p></DashboardDetailPanel>);
  const button = screen.getByRole("button", { name: "Details" });
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByText("Evidence")).not.toBeVisible();
  fireEvent.click(screen.getByText("Preview"));
  expect(button).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Evidence")).toBeVisible();
  expect(screen.getByText("Preview")).toBeVisible();
});

it("calculates a finite scale from projection and zoom instead of a static distance", () => {
  const projection = { x: (lon: number) => lon * 200, y: (lat: number) => 3260 - lat * 200 };
  const base = localMapScale(projection, { k: 1, x: 0, y: 0 });
  const zoom = localMapScale(projection, { k: 2, x: -380, y: -260 });
  expect(base.width).toBeGreaterThan(0);
  expect(base.width).toBeLessThanOrEqual(130);
  expect(zoom.width).toBeLessThanOrEqual(130);
  expect(zoom.distanceKm).toBeLessThan(base.distanceKm);
  expect(zoom.width / zoom.distanceKm).toBeCloseTo(2 * base.width / base.distanceKm);
});
