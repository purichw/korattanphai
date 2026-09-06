import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getNakhonRatchasimaDistrictByCode } from "../src/domain";
import { ForecastOverviewLoading, DroughtWorkspaceLoading } from "../src/components/nakhon-ratchasima/ForecastArchiveLoading";
import type { DroughtForecastWorkspaceTarget } from "../src/components/nakhon-ratchasima/forecastModel";

afterEach(cleanup);
const district = getNakhonRatchasimaDistrictByCode("3008")!;
const targets: DroughtForecastWorkspaceTarget[] = [
  { valid: true, level: "province", tab: "drought" },
  { valid: true, level: "district", district },
  { valid: true, level: "subdistrict", district, subdistrict: district.subdistricts.find((item) => item.subdistrictCode === "300806")! },
];

it("keeps the Home identity and one loading announcement without fake data or controls", () => {
  const { container } = render(<ForecastOverviewLoading failed={false} retry={vi.fn()} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("จังหวัดนครราชสีมา");
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(container.querySelector(".nr-loading-map")).not.toBeNull();
  expect(container.textContent).not.toContain("ทุกอำเภอ");
  expect(container.textContent).not.toMatch(/0 ตำบล|\d+%|ThaiWater|2568/);
  expect(container.querySelectorAll(".metric-card-value")).toHaveLength(6);
  for (const value of container.querySelectorAll(".metric-card-value")) expect(value.textContent).toBe("");
});

it.each(targets)("preserves the $level identity and appropriate page anatomy while loading", (target) => {
  const navigate = vi.fn();
  const { container } = render(<DroughtWorkspaceLoading target={target} failed={false} retry={vi.fn()} onNavigate={navigate} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(target.level === "subdistrict" ? "บ้านเก่า" : target.level === "district" ? "ด่านขุนทด" : "ภัยแล้ง");
  expect(screen.getAllByRole("status")).toHaveLength(1);
  const single = target.level === "subdistrict";
  expect(container.querySelectorAll(".nr-loading-chart")).toHaveLength(single ? 0 : 1);
  expect(container.querySelectorAll(".nr-loading-metrics .metric-card")).toHaveLength(single ? 1 : 5);
  expect(container.querySelector(".nr-loading-attention")).toBeNull();
  expect(container.textContent).not.toMatch(/undefined|0 ตำบล|\d+%/);
  fireEvent.click(screen.getByRole("button"));
  expect(navigate).toHaveBeenCalledWith(target.level === "province" ? "/" : single ? "/dan-khun-thot" : "/drought");
});

it("switches Home failure into a compact retry state, not indefinite skeletons", () => {
  const retry = vi.fn();
  const { container, rerender } = render(<ForecastOverviewLoading failed retry={retry} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("จังหวัดนครราชสีมา");
  expect(screen.getByRole("alert")).toHaveTextContent("โหลดข้อมูลพยากรณ์ไม่สำเร็จ กรุณาลองใหม่");
  expect(container.querySelector(".nr-skeleton")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
  expect(retry).toHaveBeenCalledOnce();
  rerender(<ForecastOverviewLoading failed={false} retry={retry} />);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("status")).toBeInTheDocument();
});

it.each(targets)("keeps $level back navigation and retry available when data fails", (target) => {
  const { container } = render(<DroughtWorkspaceLoading target={target} failed retry={vi.fn()} onNavigate={vi.fn()} />);
  expect(screen.getAllByRole("button")).toHaveLength(2);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(container.querySelector(".nr-skeleton")).toBeNull();
});
