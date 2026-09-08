import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getNakhonRatchasimaDistrictByCode } from "../src/domain";
import { ForecastOverviewLoading, DroughtWorkspaceLoading } from "../src/components/nakhon-ratchasima/ForecastArchiveLoading";
import type { DroughtForecastWorkspaceTarget } from "../src/components/nakhon-ratchasima/forecastModel";
import { ForecastArchiveRequest, ForecastMonthSelect } from "../src/components/ForecastArchiveRequest";
import { AppSelect } from "../src/components/AppSelect";

afterEach(cleanup);

it("keeps month-change feedback inside month controls and clears it on completion", () => {
  const request = { archive: null, pending: true, changingPeriod: true, failed: false, retry: vi.fn(), requestPeriod: vi.fn() };
  const options = [{ value: "2025-12", label: "ธ.ค. 2568" }];
  const content = <>
    <ForecastMonthSelect ariaLabel="เดือนตั้งต้น" value="2025-12" options={options} onChange={vi.fn()} />
    <ForecastMonthSelect ariaLabel="เดือนตั้งต้นบนแผนที่" value="2025-12" options={options} onChange={vi.fn()} />
    <AppSelect ariaLabel="สถานะ" value="all" options={[{ value: "all", label: "ทุกสถานะ" }]} onChange={vi.fn()} />
  </>;
  const { container, rerender } = render(<ForecastArchiveRequest request={request}>{content}</ForecastArchiveRequest>);
  const status = screen.getByRole("status");
  expect(status).toHaveClass("sr-only");
  expect(status).toHaveTextContent("ขณะนี้ยังแสดงรอบเดิม");
  expect(status.closest('[aria-busy="true"]')).toBeNull();
  for (const name of ["เดือนตั้งต้น", "เดือนตั้งต้นบนแผนที่"]) {
    const month = screen.getByRole("combobox", { name, exact: true });
    expect(month).toHaveAttribute("aria-busy", "true");
    expect(month).toHaveAccessibleDescription("กำลังโหลดเดือนที่เลือก · ขณะนี้ยังแสดงรอบเดิม");
    expect(month).toHaveTextContent("ธ.ค. 2568");
    expect(month).toBeEnabled();
  }
  expect(screen.getByRole("combobox", { name: "สถานะ" })).not.toHaveAttribute("aria-busy");
  expect(container.querySelectorAll(".app-select-spinner")).toHaveLength(2);

  rerender(<ForecastArchiveRequest request={{ ...request, pending: false, changingPeriod: false }}>{content}</ForecastArchiveRequest>);
  expect(status).toBeEmptyDOMElement();
  expect(container.querySelectorAll(".app-select-spinner, [aria-busy=true], [aria-describedby]")).toHaveLength(0);

  // Same-period freshness checks do not look like a user-requested month change.
  rerender(<ForecastArchiveRequest request={{ ...request, changingPeriod: false }}>{content}</ForecastArchiveRequest>);
  expect(status).toBeEmptyDOMElement();
  expect(container.querySelector(".app-select-spinner")).toBeNull();
});

it("leaves static month controls unchanged outside a forecast request", () => {
  const { container } = render(<ForecastMonthSelect ariaLabel="เดือน" value="2025-12"
    options={[{ value: "2025-12", label: "ธ.ค. 2568" }]} onChange={vi.fn()} />);
  expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-busy");
  expect(container.querySelector(".app-select-spinner")).toBeNull();
});

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
  expect(container.querySelectorAll(".nr-loading-support")).toHaveLength(0);
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
