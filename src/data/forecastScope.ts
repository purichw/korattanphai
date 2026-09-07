import hierarchy from './canonical/nakhon_ratchasima/admin_hierarchy.json';
import type { NakhonRatchasimaDroughtForecastArchive as Archive } from '../types';

export type ForecastQuery = { areaCode: string; originPeriod?: string | null };

export function forecastScopeCodes(areaCode: string): string[] {
  const codes = hierarchy.province.districts.flatMap((district) => district.subdistricts
    .filter((area) => areaCode === '30' || district.districtCode === areaCode || area.subdistrictCode === areaCode)
    .map((area) => area.subdistrictCode));
  if (!codes.length) throw new Error('Invalid forecast area');
  return codes;
}

export function forecastQueryPeriod(archive: Archive, period?: string | null) {
  return archive.targetMonths.some((month) => month.period === period) ? period! : archive.meta.targetMonthEnd;
}

export function projectForecastScope(archive: Archive, query: ForecastQuery): Archive {
  const originPeriod = forecastQueryPeriod(archive, query.originPeriod);
  const codes = new Set(forecastScopeCodes(query.areaCode));
  const locations = archive.locations.filter((location) => codes.has(location.subdistrictCode));
  return { ...archive, locations,
    targetMonths: archive.targetMonths.map((month) => ({ period: month.period, labelTh: month.labelTh,
      horizons: month.horizons.map(({ horizon, horizonLabel, issueMonth, targetMonth }) => ({ horizon, horizonLabel, issueMonth, targetMonth })) })),
    horizonSummary: [], validationExamples: {},
    loadedSelection: { originPeriod, areaCode: query.areaCode, horizonCount: archive.meta.horizonCount, subdistrictCount: codes.size },
    packedRiskByTargetMonth: { [originPeriod]: Object.fromEntries(locations.map((location) =>
      [location.subdistrictCode, archive.packedRiskByTargetMonth[originPeriod]![location.subdistrictCode]!])) },
  };
}
