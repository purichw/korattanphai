import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import hierarchy from '../src/data/canonical/nakhon_ratchasima/admin_hierarchy.json';
import { areaBoundaryExport, areaGeometry, defaultAreaFilters, filterAreaRows, groupAreaRows, joinAreaResources } from '../src/admin/areaModel';

const polygon = { type: 'Polygon', coordinates: [[[101, 14], [102, 14], [102, 15], [101, 14]]] };
const feature = (code = '300101', name = 'ในเมือง', geometry: unknown = polygon) => ({ type: 'Feature', properties: { Admin_code: code, T_Name_T: `ตำบล${name}`, A_Name_T: 'อำเภอเมืองนครราชสีมา', Source_Nam: 'DOPA' }, geometry });
const names = { province: { nameTh: 'นครราชสีมา', districts: [{ districtCode: '3001', nameTh: 'เมืองนครราชสีมา', subdistricts: [{ subdistrictCode: '300101', nameTh: 'ในเมือง' }, { subdistrictCode: '300102', nameTh: 'โพธิ์กลาง' }] }] } };
const shapes = (...features: ReturnType<typeof feature>[]) => JSON.parse(JSON.stringify({ type: 'FeatureCollection', features }));
describe('CMS area projection', () => {
  it('joins the complete seed by code without mutating either source', () => {
    const boundaries = JSON.parse(readFileSync('public/geodata/nakhon-ratchasima-subdistricts.geojson', 'utf8'));
    const before = JSON.stringify([hierarchy, boundaries]);
    const rows = joinAreaResources(hierarchy, boundaries);
    expect(rows).toHaveLength(289); expect(groupAreaRows(rows)).toHaveLength(32);
    expect(rows.filter(row => row.status === 'linked')).toHaveLength(289);
    expect(JSON.stringify([hierarchy, boundaries])).toBe(before);
  });
  it('distinguishes missing, unloaded, bad shape, duplicate code and different source names', () => {
    expect(joinAreaResources(names, undefined).map(row => row.status)).toEqual(['unknown', 'unknown']);
    expect(joinAreaResources(names, { type: 'FeatureCollection', features: null }).map(row => row.status)).toEqual(['unknown', 'unknown']);
    expect(joinAreaResources(names, shapes(feature())).map(row => row.status)).toEqual(['linked', 'missing']);
    expect(joinAreaResources(names, shapes(feature(), feature()))[0].status).toBe('duplicate');
    expect(joinAreaResources(names, shapes(feature('300101', 'ชื่ออื่น')))[0].status).toBe('name-mismatch');
    expect(joinAreaResources(names, shapes(feature('300101', 'ในเมือง', { type: 'Point', coordinates: [101, 14] })))[0].status).toBe('invalid');
    const repeated = structuredClone(names); repeated.province.districts[0].subdistricts.push(repeated.province.districts[0].subdistricts[0]);
    expect(joinAreaResources(repeated, shapes(feature())).filter(row => row.status === 'duplicate')).toHaveLength(2);
  });
  it('retains unmatched features, never joins by display names or claims missing registry during load failure', () => {
    const data = shapes(feature('999999'));
    const rows = joinAreaResources(names, data);
    expect(rows.map(row => row.status)).toEqual(['missing', 'missing', 'orphan']);
    expect(rows[2].code).toBe('999999');
    expect(joinAreaResources(undefined, data)[0].status).toBe('unknown');
  });
  it('filters name/code, Thai digits, district, tambon and status together, preserving group membership', () => {
    const rows = joinAreaResources(names, shapes(feature()));
    expect(filterAreaRows(rows, { ...defaultAreaFilters, query: '๓๐๐๑๐๑' })).toEqual([rows[0]]);
    expect(filterAreaRows(rows, { ...defaultAreaFilters, district: '3001', tambon: rows[1].id, status: 'missing' })).toEqual([rows[1]]);
    expect(filterAreaRows(rows, { ...defaultAreaFilters, status: 'review' })).toEqual([rows[1]]);
    expect(filterAreaRows(rows, { ...defaultAreaFilters, query: 'ไม่มี' })).toEqual([]);
    expect(groupAreaRows(filterAreaRows(rows, { ...defaultAreaFilters, sort: 'code-desc' }))[0].rows[0]).toBe(rows[1]);
  });
  it('exports original geometry and properties exactly once, including holes and null geometries for review', () => {
    const data = shapes(feature(), feature('300102', 'โพธิ์กลาง', null));
    const rows = joinAreaResources(names, data);
    expect(areaBoundaryExport([rows[0], rows[0], rows[1]])).toEqual(data);
    expect(areaBoundaryExport([rows[0]]).features[0]).toBe(rows[0].boundaries[0].feature);
  });
  it('rejects unrenderable coordinates without throwing and accepts polygon holes / multipolygons', () => {
    expect(areaGeometry({ type: 'Polygon', coordinates: [] })).toBeNull();
    expect(areaGeometry({ type: 'Polygon', coordinates: [[[999, 14], [102, 14], [102, 15], [999, 14]]] })).toBeNull();
    expect(areaGeometry({ type: 'Polygon', coordinates: [[[101, 14], [102, 14], [102, 15], [101, 15]]] })).toBeNull();
    expect(areaGeometry(polygon)).toEqual(polygon);
    const multi = { type: 'MultiPolygon', coordinates: [polygon.coordinates] };
    expect(areaGeometry(multi)).toEqual(multi);
  });
});
