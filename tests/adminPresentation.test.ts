import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CMS_RESOURCES } from '../shared/cmsResources.mjs';
import { resourceViews, referenceCatalogGroups, referenceTable, isCutoverVerification } from '../src/admin/resourcePresentation';
import { forecastChoice, updateForecastChoice } from '../src/admin/dataPresentation';
import hierarchy from '../src/data/canonical/nakhon_ratchasima/admin_hierarchy.json';

describe('operator-facing data inventory', () => {
  it('only exposes geography used by the forecast website', () => {
    expect(CMS_RESOURCES).toHaveLength(5);
    for (const key of Object.keys(resourceViews)) expect(CMS_RESOURCES.some(resource => resource.key === key && resource.group !== 'retained')).toBe(true);
    expect(resourceViews['canonical/advisory']).toBeUndefined();
    expect(resourceViews['canonical/nakhon_ratchasima/rainfall_observations_24h']).toBeUndefined();
    expect(resourceViews['canonical/nakhon_ratchasima/drought_forecast_archive_rev02']).toBeUndefined();
    expect(resourceViews['canonical/nakhon_ratchasima/normalized_research_monthly_panel']).toBeUndefined();
    expect(resourceViews['canonical/source_registry']).toBeUndefined();
    expect(resourceViews['canonical/nakhon_ratchasima/rainfall_stations']).toBeUndefined();
    expect(resourceViews['canonical/nakhon_ratchasima/subdistrict_rainfall_coverage']).toBeUndefined();
  });
  it('projects real geography without altering its source payload', () => {
    const before = JSON.stringify(hierarchy);
    const areas = referenceTable('canonical/nakhon_ratchasima/admin_hierarchy', hierarchy);
    expect(areas.rows).toHaveLength(289);
    expect(new Set(areas.rows.map(row => row.cells[0])).size).toBe(32);
    expect(areas.rows[0].cells).toEqual(['เมืองนครราชสีมา', 'ในเมือง', '300101']);
    expect(JSON.stringify(hierarchy)).toBe(before);
  });
  it('groups only active resources and searches within the selected group', () => {
    const items = CMS_RESOURCES.map(resource => ({ id: resource.key, resource_key: resource.key }));
    const before = JSON.stringify(items);
    const groups = referenceCatalogGroups(items);
    expect(groups.map(group => group.id)).toEqual(['areas', 'maps']);
    expect(groups.flatMap(group => group.resources.map(resource => resource.resource_key))).toEqual([
      'canonical/nakhon_ratchasima/admin_hierarchy', 'geodata/nakhon-ratchasima-subdistricts',
      'geodata/nakhon-ratchasima-boundary', 'geodata/thailand-adm1',
    ]);
    const maps = referenceCatalogGroups(items, 'ชั้นข้อมูลแผนที่');
    expect(maps).toHaveLength(1);
    expect(maps[0].resources).toHaveLength(3);
    expect(referenceCatalogGroups(items, 'เส้นรอบจังหวัดนครราชสีมา')[0].resources.map(resource => resource.resource_key))
      .toEqual(['geodata/nakhon-ratchasima-boundary']);
    expect(referenceCatalogGroups(items, 'เส้นรอบจังหวัดนครราชสีมา', 'sources')).toEqual([]);
    for (const term of ['แหล่งข้อมูลอ้างอิง', 'รายชื่อและพิกัดสถานีฝน', 'สถานีฝนที่อยู่ใกล้แต่ละตำบล', 'ขอบเขตประเทศรอบข้าง']) {
      expect(referenceCatalogGroups(items, term)).toEqual([]);
    }
    expect(referenceCatalogGroups([], '')).toEqual([]);
    expect(JSON.stringify(items)).toBe(before);
  });
  it('does not revive retired reference features when an old resource is opened', () => {
    const retainedPayload = [{ id: 'retained-record', nameTh: 'ข้อมูลเดิม', dataClass: 'REAL' }];
    const before = JSON.stringify(retainedPayload);
    for (const key of ['canonical/source_registry', 'canonical/nakhon_ratchasima/rainfall_stations',
      'canonical/nakhon_ratchasima/subdistrict_rainfall_coverage', 'geodata/thailand-neighbor-context']) {
      expect(referenceTable(key, retainedPayload)).toEqual({ columns: [], rows: [] });
    }
    expect(JSON.stringify(retainedPayload)).toBe(before);
  });
  it('uses actual geometry names from each shipped schema', () => {
    const cases = [
      ['nakhon-ratchasima-subdistricts', 'ตำบลธงชัยเหนือ · อำเภอปักธงชัย'],
      ['nakhon-ratchasima-boundary', 'จังหวัดนครราชสีมา'],
      ['thailand-adm1', 'Roi Et Province'],
    ];
    for (const [file, name] of cases) {
      const payload = JSON.parse(readFileSync(`public/geodata/${file}.geojson`, 'utf8'));
      expect(referenceTable(`geodata/${file}`, payload).rows[0].cells[0]).toBe(name);
    }
  });
  it('only suppresses the exact unpublished cutover check, never user drafts with similar titles', () => {
    const verification = { id: '0414a977-22b3-43db-ae00-80a6ca6fff38', state: 'draft', source_filename: 'cms-cutover-verification.json' };
    expect(isCutoverVerification(verification)).toBe(true);
    expect(isCutoverVerification({ ...verification, id: 'operator-owned' })).toBe(false);
    expect(isCutoverVerification({ ...verification, state: 'accepted' })).toBe(false);
    expect(isCutoverVerification({ ...verification, source_filename: 'real-data.xlsx' })).toBe(false);
  });
});

describe('no-code forecast corrections', () => {
  const row = { subdistrictCode: '300101', targetMonth: '2026-01', horizonMonths: 1, status: 'predicted', riskCode: 1 };
  it('preserves exact forecast identity while updating risk and status together', () => {
    expect(updateForecastChoice(row, '0')).toEqual({ ...row, riskCode: 0 });
    expect(updateForecastChoice(row, '2')).toEqual({ ...row, riskCode: 2 });
    expect(updateForecastChoice(row, 'out_of_scope')).toEqual({ ...row, riskCode: null, status: 'out_of_scope' });
    expect(row.riskCode).toBe(1);
  });
  it('never turns blank, missing or unresolved values into no-risk', () => {
    expect(forecastChoice({ ...row, riskCode: null })).toBe('');
    expect(forecastChoice({ ...row, riskCode: null, status: 'out_of_scope' })).toBe('out_of_scope');
    expect(forecastChoice({ ...row, riskCode: 0 })).toBe('0');
    expect(forecastChoice({ ...row, status: 'unresolved' })).toBe('');
    expect(updateForecastChoice(row, 'invalid')).toEqual(row);
  });
});
