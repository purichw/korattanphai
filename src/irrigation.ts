import type { NakhonRatchasimaDroughtForecastArchive } from "./types";

export const irrigationCriteria = ["all", "irrigated", "rainfed", "unknown"] as const;
export type IrrigationCriterion = typeof irrigationCriteria[number];
export type IrrigationStatus = Exclude<IrrigationCriterion, "all">;
export type ForecastMapColorMode = "forecast" | "irrigation";

export const irrigationColors: Record<IrrigationStatus, string> = {
  irrigated: "#397fc5",
  rainfed: "#9262b7",
  unknown: "#87939e",
};

export const irrigationLabels: Record<IrrigationCriterion, string> = {
  all: "ทุกสถานะ",
  irrigated: "เข้าถึงชลประทาน",
  rainfed: "พึ่งน้ำฝน (ไม่มีชลประทาน)",
  unknown: "ยังไม่มีข้อมูลชลประทาน",
};

export function normalizeIrrigationCriterion(value: string | null | undefined): IrrigationCriterion {
  return irrigationCriteria.includes(value as IrrigationCriterion) ? value as IrrigationCriterion : "all";
}

export function readIrrigationSelection(search: string, historyState?: unknown): IrrigationCriterion {
  const state = historyState && typeof historyState === "object" ? historyState as Record<string, unknown> : {};
  return typeof state.ktpIrrigation === "string" && irrigationCriteria.includes(state.ktpIrrigation as IrrigationCriterion)
    ? state.ktpIrrigation as IrrigationCriterion
    : normalizeIrrigationCriterion(new URLSearchParams(search).get("irrigation"));
}

export function irrigationHistoryState(historyState: unknown, criterion: IrrigationCriterion) {
  return { ...(historyState && typeof historyState === "object" ? historyState : {}), ktpIrrigation: criterion };
}

export function irrigationStatusFromSource(value: string | null | undefined): IrrigationStatus {
  const status = value?.trim().toLowerCase();
  if (status === "irrigation" || status === "irragation") return "irrigated";
  if (status === "rainfed") return "rainfed";
  return "unknown";
}

export function forecastSubdistrictCodesForIrrigation(
  archive: NakhonRatchasimaDroughtForecastArchive,
  criterion: IrrigationCriterion,
  expectedCodes?: string[],
): string[] {
  const codes = expectedCodes ?? archive.locations.map((location) => location.subdistrictCode);
  if (criterion === "all") return codes;
  const locations = new Map(archive.locations.map((location) => [location.subdistrictCode, location]));
  // Irrigation availability is location metadata, independent of forecast risk/null.
  return codes.filter((code) => irrigationStatusFromSource(locations.get(code)?.irrigationStatus) === criterion);
}
