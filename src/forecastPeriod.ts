/** Calendar-month arithmetic shared by forecast views and saved selections. */
export function shiftMonthPeriod(period: string, monthOffset: number) {
  const [year, monthIndex] = period.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null;
  const date = new Date(Date.UTC(year, monthIndex - 1 + monthOffset, 1));
  const shiftedMonth = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${date.getUTCFullYear()}-${shiftedMonth}`;
}

/** Excel Source_YearMonth is T; its horizon column predicts T + h. */
export function forecastTargetPeriod(originPeriod: string, horizon: number) {
  const target = shiftMonthPeriod(originPeriod, horizon);
  if (!target) throw new Error("Invalid forecast origin month");
  return target;
}

/** Product copy only; source keys and persisted horizon values stay unchanged. */
export function forecastHorizonLabel(horizon: number, style: "full" | "short" = "full") {
  return `${style === "full" ? "ล่วงหน้า " : ""}${horizon} เดือน`;
}
