// Independent test projection of the source fixture; never used by the live loader.
export const forecastRevision = archive => ({ ...archive.meta, publishedAt: '2026-09-06T10:00:00Z' });
export function forecastSlice(archive, { p_area_code = '30', p_origin_period } = {}) {
  const originPeriod = archive.targetMonths.some(m => m.period === p_origin_period) ? p_origin_period : archive.meta.targetMonthEnd;
  const locations = archive.locations.filter(l => p_area_code === '30' || l.districtCode === p_area_code || l.subdistrictCode === p_area_code)
    .sort((a, b) => a.subdistrictCode.localeCompare(b.subdistrictCode));
  return { ...archive, locations,
    targetMonths: archive.targetMonths.map(m => ({ period: m.period, labelTh: m.labelTh,
      horizons: m.horizons.map(({ horizon, horizonLabel, issueMonth, targetMonth }) => ({ horizon, horizonLabel, issueMonth, targetMonth })) })),
    horizonSummary: [], validationExamples: {},
    loadedSelection: { originPeriod, areaCode: p_area_code, horizonCount: archive.meta.horizonCount, subdistrictCount: locations.length },
    packedRiskByTargetMonth: { [originPeriod]: Object.fromEntries(locations.map(l => [l.subdistrictCode, archive.packedRiskByTargetMonth[originPeriod][l.subdistrictCode]])) },
  };
}
