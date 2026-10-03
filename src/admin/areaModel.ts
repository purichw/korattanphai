import type { Json, Payload } from './types';

export const AREA_NAMES_KEY = 'canonical/nakhon_ratchasima/admin_hierarchy';
export const AREA_BOUNDARIES_KEY = 'geodata/nakhon-ratchasima-subdistricts';
export const isAreaResource = (key: string) => key === AREA_NAMES_KEY || key === AREA_BOUNDARIES_KEY;
export type ReferenceResource = { id: string; resource_key: string; title: string; resource_group: string; published_at: string | null; updated_at?: string; draft_id?: string | null };
export type ReferenceResourceData = ReferenceResource & { payload: Json; revision: number; state: 'draft' | 'published' };
export type AreaGeometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
export type AreaBoundary = { index: number; code: string; name: string; district: string; source: string; feature: Json; geometry: AreaGeometry | null };
export const areaStatusLabels = {
  linked: 'มีขอบเขต', missing: 'ไม่มีขอบเขต', duplicate: 'รหัสซ้ำ', invalid: 'รูปขอบเขตไม่สมบูรณ์',
  'name-mismatch': 'ชื่อไม่ตรงกับทะเบียน', 'invalid-code': 'รหัสพื้นที่ไม่สมบูรณ์', orphan: 'ไม่มีในทะเบียน', unknown: 'ยังตรวจสอบไม่ได้',
} as const;
export type AreaStatus = keyof typeof areaStatusLabels;
export type AreaRow = { id: string; code: string; name: string; districtCode: string; district: string; province: string; registered: boolean; boundaries: AreaBoundary[]; status: AreaStatus };
const object = (value: Json | undefined): Payload => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value: Json | undefined): Json[] => Array.isArray(value) ? value : [];
const text = (value: Json | undefined) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const nameKey = (value: string) => value.replace(/^(ตำบล|อำเภอ|ต\.|อ\.)\s*/u, '').trim();
export const areaSearchText = (value: string) => value.normalize('NFC').toLocaleLowerCase('th').replace(/[๐-๙]/g, digit => String(digit.charCodeAt(0) - 0x0e50)).trim();
export function areaPayloadAvailable(key: string, payload: Json | undefined) {
  const root = object(payload);
  return key === AREA_NAMES_KEY ? Array.isArray(object(root.province).districts)
    : root.type === 'Feature' || root.type === 'FeatureCollection' && Array.isArray(root.features);
}

// Rendering validation only, not a topology/land-survey certification.
export function areaGeometry(value: Json | undefined): AreaGeometry | null {
  const geometry = object(value);
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return null;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : list(geometry.coordinates);
  const valid = polygons.length > 0 && polygons.every(polygon => Array.isArray(polygon) && polygon.length > 0 && polygon.every(ring => {
    if (!Array.isArray(ring) || ring.length < 4) return false;
    if (!ring.every(point => Array.isArray(point) && point.length >= 2 && typeof point[0] === 'number' && typeof point[1] === 'number'
      && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)) return false;
    const first = ring[0] as number[]; const last = ring[ring.length - 1] as number[];
    return first[0] === last[0] && first[1] === last[1];
  }));
  return valid ? geometry as AreaGeometry : null;
}

/** Join only exact administrative codes; never infer a relationship from a name. */
export function joinAreaResources(names: Json | undefined, shapes: Json | undefined): AreaRow[] {
  if (!areaPayloadAvailable(AREA_NAMES_KEY, names)) names = undefined;
  if (!areaPayloadAvailable(AREA_BOUNDARIES_KEY, shapes)) shapes = undefined;
  const province = object(object(names).province);
  const shapeRoot = object(shapes);
  const boundaries: AreaBoundary[] = (shapeRoot.type === 'Feature' ? [shapeRoot] : list(shapeRoot.features)).map((feature, index) => {
    const properties = object(object(feature).properties);
    return { index, code: text(properties.Admin_code), name: nameKey(text(properties.T_Name_T)), district: nameKey(text(properties.A_Name_T)),
      source: text(properties.Source_Nam), feature, geometry: object(feature).type === 'Feature' ? areaGeometry(object(feature).geometry) : null };
  });
  const byCode = new Map<string, AreaBoundary[]>();
  boundaries.forEach(boundary => { if (boundary.code) byCode.set(boundary.code, [...(byCode.get(boundary.code) ?? []), boundary]); });
  const rows: AreaRow[] = list(province.districts).flatMap((value, districtIndex) => {
    const district = object(value);
    return list(district.subdistricts).map((item, index) => {
      const area = object(item); const code = text(area.subdistrictCode);
      return { id: `area-${districtIndex}-${index}`, code, name: text(area.nameTh) || 'ไม่ระบุชื่อ', district: text(district.nameTh) || 'ไม่ระบุอำเภอ',
        districtCode: text(district.districtCode), province: text(province.nameTh), registered: true,
        boundaries: code ? byCode.get(code) ?? [] : [], status: 'unknown' as AreaStatus };
    });
  });
  const counts = new Map<string, number>();
  rows.forEach(row => counts.set(row.code, (counts.get(row.code) ?? 0) + 1));
  rows.forEach(row => {
    row.status = !/^[0-9]{6}$/.test(row.code) ? 'invalid-code' : shapes === undefined ? 'unknown' : (counts.get(row.code) ?? 0) > 1 || row.boundaries.length > 1 ? 'duplicate'
      : !row.boundaries.length ? 'missing' : !row.boundaries[0].geometry ? 'invalid'
        : nameKey(row.name) !== row.boundaries[0].name || nameKey(row.district) !== row.boundaries[0].district ? 'name-mismatch' : 'linked';
  });
  boundaries.filter(boundary => !counts.has(boundary.code)).forEach(boundary => rows.push({ id: `boundary-${boundary.index}`, code: boundary.code,
    name: boundary.name || 'ไม่ระบุชื่อ', districtCode: '', district: names === undefined ? 'ยังตรวจสอบทะเบียนไม่ได้' : 'ขอบเขตที่ไม่มีในทะเบียน',
    province: '', registered: false, boundaries: [boundary], status: names === undefined ? 'unknown' : 'orphan' }));
  return rows;
}

export type AreaFilters = { query: string; district: string; tambon: string; status: string; sort: string };
export const defaultAreaFilters: AreaFilters = { query: '', district: 'all', tambon: 'all', status: 'all', sort: 'code' };
export function filterAreaRows(rows: AreaRow[], filters: AreaFilters) {
  const needle = areaSearchText(filters.query);
  return rows.filter(row => (filters.district === 'all' || row.districtCode === filters.district)
    && (filters.tambon === 'all' || row.id === filters.tambon)
    && (filters.status === 'all' || (filters.status === 'review' ? !['linked', 'unknown'].includes(row.status) : row.status === filters.status))
    && areaSearchText(`${row.name} ${row.code} ${row.district} ${row.districtCode}`).includes(needle))
    .sort((a, b) => filters.sort === 'name' ? a.name.localeCompare(b.name, 'th') || a.code.localeCompare(b.code)
      : a.code.localeCompare(b.code, 'th', { numeric: true }) * (filters.sort === 'code-desc' ? -1 : 1) || a.id.localeCompare(b.id));
}
export function groupAreaRows(rows: AreaRow[]) {
  const groups = new Map<string, { id: string; name: string; rows: AreaRow[] }>();
  rows.forEach(row => {
    const id = row.registered ? row.districtCode || row.district : 'unregistered';
    if (!groups.has(id)) groups.set(id, { id, name: row.district, rows: [] });
    groups.get(id)!.rows.push(row);
  });
  return [...groups.values()];
}
export function areaBoundaryExport(rows: AreaRow[]) {
  const features = new Map<number, Json>();
  rows.forEach(row => row.boundaries.forEach(boundary => features.set(boundary.index, boundary.feature)));
  return { type: 'FeatureCollection', features: [...features.values()] };
}
