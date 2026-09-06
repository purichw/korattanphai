import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function buildForecastArchiveSummary(archive) {
  const month = archive.targetMonths.find((item) => item.period === archive.meta.targetMonthEnd)
    ?? archive.targetMonths.at(-1);
  if (!month) return { leadMonth: null, summary: null };
  const risks = archive.locations.map((location) =>
    archive.packedRiskByTargetMonth[month.period]?.[location.subdistrictCode]?.[0],
  );
  return {
    leadMonth: { period: month.period, labelTh: month.labelTh },
    summary: {
      totalSubdistricts: archive.meta.totalCanonicalSubdistricts,
      inScopeSubdistricts: risks.filter((risk) => risk === 0 || risk === 1 || risk === 2).length,
      riskSubdistricts: risks.filter((risk) => risk === 1 || risk === 2).length,
    },
  };
}

// The overview needs every origin month, but only the nearest forecast vintage.
export function buildForecastOverviewArchive(archive) {
  const targetMonths = archive.targetMonths.map((month) => ({
    ...month,
    horizons: month.horizons.filter((item) => item.horizon === 1),
  }));
  const packedRiskByTargetMonth = Object.fromEntries(Object.entries(archive.packedRiskByTargetMonth).map(([period, rows]) => [
    period,
    Object.fromEntries(Object.entries(rows).filter(([, risks]) => risks[0] !== undefined).map(([code, risks]) => [code, [risks[0]]])),
  ]));
  const vintageCount = Object.values(packedRiskByTargetMonth).reduce((count, rows) => count + Object.keys(rows).length, 0);
  return {
    ...archive,
    meta: {
      ...archive.meta,
      horizonCount: 1,
      forecastVintageCount: vintageCount,
      sourceVintageKeyCount: vintageCount,
      issueMonthStart: targetMonths[0]?.horizons[0]?.issueMonth ?? "",
    },
    targetMonths,
    horizonSummary: archive.horizonSummary.filter((item) => item.horizon === 1),
    validationExamples: {},
    packedRiskByTargetMonth,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const archive = JSON.parse(await fs.readFile("src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json", "utf8"));
  const directory = "src/data/generated";
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "forecast-archive-summary.json"), `${JSON.stringify(buildForecastArchiveSummary(archive), null, 2)}\n`);
  await fs.writeFile(path.join(directory, "forecast-overview-t1.json"), `${JSON.stringify(buildForecastOverviewArchive(archive))}\n`);
  console.log("[forecast-summary] Generated overview summary from canonical archive.");
}
