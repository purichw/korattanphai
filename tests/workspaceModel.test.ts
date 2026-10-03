import { expect, it } from 'vitest';
import { getNakhonRatchasimaDistricts, parseNakhonRatchasimaRoute } from '../src/domain';
import {
  coverageLabel, compactCoverageLabel, defaultLocalMapCriteria, districtOptionsForProvince,
  localStatusPillTone, pathForDistrictCode, pathForSubdistrictCode, subdistrictOptionsForRoute,
} from '../src/components/nakhon-ratchasima/workspaceModel';

it('area selectors and links use the same published geographic identities without evidence badges', () => {
  const districts = getNakhonRatchasimaDistricts();
  const options = districtOptionsForProvince();
  expect(options).toHaveLength(32);
  expect(options.map(option => option.value)).toEqual(districts.map(district => district.districtCode));
  for (const [index, district] of districts.entries()) {
    expect(options[index].badge).toBeUndefined();
    expect(options[index].description).toBe(`${district.subdistricts.length} ตำบล`);
    const route = parseNakhonRatchasimaRoute(pathForDistrictCode(district.districtCode)!)!;
    expect(subdistrictOptionsForRoute(route).map(option => option.value)).toEqual(district.subdistricts.map(area => area.subdistrictCode));
    for (const area of district.subdistricts) {
      const path = pathForSubdistrictCode(area.subdistrictCode)!;
      expect(parseNakhonRatchasimaRoute(path)).toMatchObject({ valid: true, level: 'subdistrict', subdistrict: area });
    }
  }
  expect(subdistrictOptionsForRoute({ valid: true, level: 'province', tab: 'drought' })).toHaveLength(289);
  expect(subdistrictOptionsForRoute({ valid: false, level: 'not-found' })).toEqual([]);
  expect(pathForSubdistrictCode('t-300101')).toBeUndefined();
  expect(pathForSubdistrictCode('309999')).toBeUndefined();
  expect(pathForDistrictCode('1001')).toBeUndefined();
});

it('no data and out-of-scope cannot be presented as the lowest forecast risk', () => {
  expect(defaultLocalMapCriteria()).toEqual({ risk: 'all' });
  for (const status of ['no-data', 'forecast-missing', 'forecast-out-of-scope'] as const) {
    expect(localStatusPillTone(status)).toBe('muted');
    expect(coverageLabel(status)).not.toBe(coverageLabel('forecast-no-risk'));
    expect(compactCoverageLabel(status)).not.toBe(compactCoverageLabel('forecast-no-risk'));
  }
  expect(coverageLabel('no-data')).toBe('ยังไม่มีข้อมูล');
  expect(coverageLabel('forecast-missing')).not.toBe(coverageLabel('forecast-out-of-scope'));
});
