import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import overviewJson from "../src/data/generated/forecast-overview-t1.json";
import type { NakhonRatchasimaDroughtForecastArchive } from "../src/types";
import { ForecastRiskAttention } from "../src/components/nakhon-ratchasima/ForecastRiskAttention";
import { forecastArchiveSummaryForSelection } from "../src/components/nakhon-ratchasima/forecastModel";
import { forecastSlice } from "./fixtures/forecast-slice.mjs";

afterEach(cleanup);

type Archive = NakhonRatchasimaDroughtForecastArchive;
const hrefForSubdistrict = (code: string) => `/drought?subdistrict=${code}&target=2025-12&horizon=1`;

function overviewSlice(period: string, areaCode = "30"): Archive {
  return forecastSlice(overviewJson, { p_origin_period: period, p_area_code: areaCode }) as unknown as Archive;
}

function summaryFor(archive: Archive) {
  const period = archive.loadedSelection!.originPeriod;
  const month = archive.targetMonths.find((item) => item.period === period)!;
  return forecastArchiveSummaryForSelection(archive, month, 1, archive.locations.map((location) => location.subdistrictCode));
}

function expectRiskRecords(archive: Archive, risk: 1 | 2, href = hrefForSubdistrict) {
  const period = archive.loadedSelection!.originPeriod;
  const expected = archive.locations
    .filter((location) => archive.packedRiskByTargetMonth[period]?.[location.subdistrictCode]?.[0] === risk)
    .sort((a, b) => a.subdistrictCode.localeCompare(b.subdistrictCode));
  const region = screen.getByRole("region", { name: risk === 2 ? "รายชื่อตำบลเสี่ยงสูง" : "รายชื่อตำบลเสี่ยงปานกลาง" });
  const links = within(region).getAllByRole("link");
  expect(links).toHaveLength(expected.length);
  expected.forEach((location, index) => {
    expect(links[index]).toHaveAttribute("href", href(location.subdistrictCode));
    expect(links[index]).toHaveTextContent(`ต.${location.subdistrictNameTh}`);
    expect(links[index]).toHaveTextContent(`อ.${location.districtNameTh}`);
  });
}

it("defaults to all 117 moderate-risk records when the selected DB overview month has no high risk", () => {
  const archive = overviewSlice("2025-12");
  const summary = summaryFor(archive);
  expect(summary).toMatchObject({ highRiskSubdistricts: 0, moderateRiskSubdistricts: 117, outOfScopeSubdistricts: 172 });
  const { container } = render(<ForecastRiskAttention summary={summary} hrefForSubdistrict={hrefForSubdistrict} />);

  expect(screen.getByRole("heading", { name: "ตำบลที่พยากรณ์มีความเสี่ยง" })).toBeInTheDocument();
  const controls = screen.getByRole("group", { name: "ระดับความเสี่ยงที่แสดง" });
  expect(within(controls).getByRole("button", { name: "เสี่ยงสูง (0)" })).toHaveAttribute("aria-pressed", "false");
  expect(within(controls).getByRole("button", { name: "เสี่ยงปานกลาง (117)" })).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelector("section[data-risk='1']")).toBeInTheDocument();
  expectRiskRecords(archive, 1);
  expect(screen.queryByText("ไม่พบตำบลที่พยากรณ์เสี่ยงสูง")).not.toBeInTheDocument();
});

it("allows selecting an empty high-risk level without falling back to moderate records", () => {
  const archive = overviewSlice("2025-12");
  const { container } = render(<ForecastRiskAttention summary={summaryFor(archive)} hrefForSubdistrict={hrefForSubdistrict} />);

  fireEvent.click(screen.getByRole("button", { name: "เสี่ยงสูง (0)" }));
  expect(screen.getByRole("button", { name: "เสี่ยงสูง (0)" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "เสี่ยงปานกลาง (117)" })).toHaveAttribute("aria-pressed", "false");
  expect(container.querySelector("section[data-risk='2']")).toBeInTheDocument();
  expect(screen.getByText("ไม่พบตำบลที่พยากรณ์เสี่ยงสูง")).toBeInTheDocument();
  expect(screen.queryAllByRole("link")).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "เสี่ยงปานกลาง (117)" }));
  expectRiskRecords(archive, 1);
  expect(screen.queryByText("ไม่พบตำบลที่พยากรณ์เสี่ยงสูง")).not.toBeInTheDocument();
});

it("shows every high-risk record first and switches to every moderate record for a real mixed-risk month", () => {
  const archive = overviewSlice("2025-03");
  const summary = summaryFor(archive);
  expect(summary).toMatchObject({ highRiskSubdistricts: 75, moderateRiskSubdistricts: 31 });
  const { container } = render(<ForecastRiskAttention summary={summary} hrefForSubdistrict={hrefForSubdistrict} />);

  expect(screen.getByRole("button", { name: "เสี่ยงสูง (75)" })).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelector("section[data-risk='2']")).toBeInTheDocument();
  expectRiskRecords(archive, 2);
  fireEvent.click(screen.getByRole("button", { name: "เสี่ยงปานกลาง (31)" }));
  expect(screen.getByRole("button", { name: "เสี่ยงสูง (75)" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "เสี่ยงปานกลาง (31)" })).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelector("section[data-risk='1']")).toBeInTheDocument();
  expectRiskRecords(archive, 1);
});

it("keeps district identities and the caller's forecast and irrigation query on every drill-down link", () => {
  const archive = overviewSlice("2025-03", "3001");
  const summary = summaryFor(archive);
  expect(summary).toMatchObject({ totalSubdistricts: 25, highRiskSubdistricts: 1, moderateRiskSubdistricts: 6, outOfScopeSubdistricts: 18 });
  const href = (code: string) => `/mueang-nakhon-ratchasima/t-${code}?mapLayer=forecast-archive&target=2025-03&horizon=1&irrigation=irrigation#forecast`;
  render(<ForecastRiskAttention summary={summary} hrefForSubdistrict={href} />);

  expectRiskRecords(archive, 2, href);
  expect(screen.getByRole("link")).toHaveTextContent("ต.โคกกรวด");
  fireEvent.click(screen.getByRole("button", { name: "เสี่ยงปานกลาง (6)" }));
  expectRiskRecords(archive, 1, href);
});

it("excludes null and missing vintages from both risk lists without changing their identities", () => {
  const archive = structuredClone(overviewSlice("2025-03", "3001"));
  const rows = archive.packedRiskByTargetMonth["2025-03"]!;
  const missingLocation = archive.locations.find((location) => rows[location.subdistrictCode]?.[0] === 1)!;
  // A sparse response models missing data distinctly from the source's explicit nulls.
  delete rows[missingLocation.subdistrictCode];
  const nullLocations = archive.locations.filter((location) => rows[location.subdistrictCode]?.[0] === null);
  const summary = summaryFor(archive);
  expect(summary).toMatchObject({ highRiskSubdistricts: 1, moderateRiskSubdistricts: 5, outOfScopeSubdistricts: 18, missingSubdistricts: 1 });
  render(<ForecastRiskAttention summary={summary} hrefForSubdistrict={hrefForSubdistrict} />);

  expectRiskRecords(archive, 2);
  fireEvent.click(screen.getByRole("button", { name: "เสี่ยงปานกลาง (5)" }));
  expectRiskRecords(archive, 1);
  const visibleHrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
  for (const location of [...nullLocations, missingLocation]) {
    expect(visibleHrefs).not.toContain(hrefForSubdistrict(location.subdistrictCode));
  }
});

it("distinguishes a scope with no forecast values from a valid scope with zero selected risk", () => {
  const period = "2025-03";
  const province = overviewSlice(period);
  const outOfScopeLocation = province.locations.find((location) => province.packedRiskByTargetMonth[period]![location.subdistrictCode]?.[0] === null)!;
  const summary = summaryFor(overviewSlice(period, outOfScopeLocation.subdistrictCode));
  expect(summary).toMatchObject({ totalSubdistricts: 1, inScopeSubdistricts: 0, outOfScopeSubdistricts: 1, missingSubdistricts: 0 });
  render(<ForecastRiskAttention summary={summary} hrefForSubdistrict={hrefForSubdistrict} />);

  expect(screen.getByText("ไม่มีค่าพยากรณ์ในขอบเขตที่เลือก")).toBeInTheDocument();
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  expect(screen.queryByText("ไม่พบตำบลที่พยากรณ์เสี่ยงสูง")).not.toBeInTheDocument();
});
