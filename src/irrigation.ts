import type { NakhonRatchasimaDroughtForecastArchive } from "./types";

export const irrigationCriteria = ["all", "irrigated", "rainfed", "unknown"] as const;
export type IrrigationCriterion = typeof irrigationCriteria[number];
export type IrrigationStatus = Exclude<IrrigationCriterion, "all">;

export const irrigationLabels: Record<IrrigationCriterion, string> = {
  all: "ทุกสถานะ",
  irrigated: "เข้าถึงชลประทาน",
  rainfed: "พึ่งน้ำฝน (ไม่มีชลประทาน)",
  unknown: "ยังไม่มีข้อมูลชลประทาน",
};

export function normalizeIrrigationCriterion(value: string | null | undefined): IrrigationCriterion {
  return irrigationCriteria.includes(value as IrrigationCriterion) ? value as IrrigationCriterion : "all";
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
