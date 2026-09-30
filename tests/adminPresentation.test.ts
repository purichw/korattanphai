import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CMS_RESOURCES } from '../shared/cmsResources.mjs';
import { resourceViews, referenceTable, isCutoverVerification } from '../src/admin/resourcePresentation';
import { forecastChoice, updateForecastChoice } from '../src/admin/dataPresentation';
import sources from '../src/data/canonical/source_registry.json';
import hierarchy from '../src/data/canonical/nakhon_ratchasima/admin_hierarchy.json';
import stations from '../src/data/canonical/nakhon_ratchasima/rainfall_stations.json';

describe('operator-facing data inventory', () => {
  it('only exposes reviewed real/reference resources, while retaining the complete runtime registry', () => {
    expect(CMS_RESOURCES).toHaveLength(45);
    for (const key of Object.keys(resourceViews)) expect(CMS_RESOURCES.some(resource => resource.key === key && resource.group !== 'retained')).toBe(true);
    expect(resourceViews['canonical/advisory']).toBeUndefined();
    expect(resourceViews['canonical/nakhon_ratchasima/rainfall_observations_24h']).toBeUndefined();
    expect(resourceViews['canonical/nakhon_ratchasima/drought_forecast_archive_rev02']).toBeUndefined();
    expect(resourceViews['canonical/nakhon_ratchasima/normalized_research_monthly_panel']).toBeUndefined();
  });
  it('projects real geography and station records without altering their source payload', () => {
    const before = JSON.stringify(hierarchy);
    const areas = referenceTable('canonical/nakhon_ratchasima/admin_hierarchy', hierarchy);
    expect(areas.rows).toHaveLength(289);
    expect(new Set(areas.rows.map(row => row.cells[0])).size).toBe(32);
    expect(areas.rows[0].cells).toEqual(['เมืองนครราชสีมา', 'ในเมือง', '300101']);
    expect(referenceTable('canonical/nakhon_ratchasima/rainfall_stations', stations).rows).toHaveLength(49);
    expect(JSON.stringify(hierarchy)).toBe(before);
  });
  it('keeps source row identity when excluding illustrative entries', () => {
    const payload = [{ ...sources[0], dataClass: 'CANONICAL_SYNTHETIC' }, sources[0]];
    expect(referenceTable('canonical/source_registry', payload).rows.map(row => row.index)).toEqual([1]);
  });
  it('uses actual geometry names from each shipped schema', () => {
    const cases = [
      ['nakhon-ratchasima-subdistricts', 'ตำบลธงชัยเหนือ · อำเภอปักธงชัย'],
      ['nakhon-ratchasima-boundary', 'จังหวัดนครราชสีมา'],
      ['thailand-adm1', 'Roi Et Province'],
      ['thailand-neighbor-context', 'Indonesia'],
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
