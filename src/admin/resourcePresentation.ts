import type { Json, Payload } from './types';

// Operator-facing views are deliberately separate from the complete runtime registry.
// An import dependency, empty schema or retained demo is not an operational dataset.
export const resourceViews: Record<string, { title: string; description: string; group: 'website' | 'reference'; view: 'areas' | 'geometry' | 'sources' | 'stations' | 'coverage' }> = {
  'canonical/nakhon_ratchasima/admin_hierarchy': { title: 'รายชื่ออำเภอและตำบล', description: 'ชื่อและรหัสพื้นที่ที่ใช้ค้นหา เลือกพื้นที่ และเชื่อมกับค่าพยากรณ์', group: 'website', view: 'areas' },
  'geodata/nakhon-ratchasima-subdistricts': { title: 'ขอบเขตตำบลในนครราชสีมา', description: 'รูปพื้นที่สำหรับระบายสีพยากรณ์และเลือกตำบลบนแผนที่', group: 'website', view: 'geometry' },
  'geodata/nakhon-ratchasima-boundary': { title: 'เส้นรอบจังหวัดนครราชสีมา', description: 'เส้นขอบรอบนอกของพื้นที่จังหวัดบนแผนที่', group: 'website', view: 'geometry' },
  'geodata/thailand-adm1': { title: 'ขอบเขตจังหวัดรอบข้าง', description: 'แผนที่ประกอบสำหรับบอกตำแหน่งจังหวัด ไม่ใช่ค่าความเสี่ยง', group: 'website', view: 'geometry' },
  'geodata/thailand-neighbor-context': { title: 'ขอบเขตประเทศรอบข้าง', description: 'พื้นหลังแผนที่สำหรับบอกตำแหน่งประเทศไทย', group: 'website', view: 'geometry' },
  'canonical/source_registry': { title: 'แหล่งข้อมูลอ้างอิง', description: 'แหล่งอ้างอิงด้านอากาศ ภัยแล้ง น้ำ และพื้นที่เกษตร สำหรับอ่านประกอบ', group: 'reference', view: 'sources' },
  'canonical/nakhon_ratchasima/rainfall_stations': { title: 'รายชื่อและพิกัดสถานีฝน', description: 'ทะเบียนสถานีที่มีแหล่งอ้างอิง ใช้ตรวจตำแหน่ง ยังไม่มีค่าฝนสด', group: 'reference', view: 'stations' },
  'canonical/nakhon_ratchasima/subdistrict_rainfall_coverage': { title: 'สถานีฝนที่อยู่ใกล้แต่ละตำบล', description: 'ระยะห่างและสถานีอ้างอิง สถานีใกล้เคียงไม่ใช่ค่าฝนที่วัดในตำบล', group: 'reference', view: 'coverage' },
};

// The everyday catalogue is separate from retained deep-link views and storage.
export const resourceGroups = [
  { id: 'areas', title: 'ข้อมูลพื้นที่', description: 'รายชื่อ รหัส และขอบเขตตำบล จัดกลุ่มตามอำเภอ พร้อมแผนที่และสถานะการเชื่อมข้อมูล',
    keys: ['canonical/nakhon_ratchasima/admin_hierarchy', 'geodata/nakhon-ratchasima-subdistricts'] },
  { id: 'maps', title: 'ชั้นข้อมูลแผนที่', description: 'เส้นรอบจังหวัดและจังหวัดรอบข้างที่ใช้ประกอบแผนที่',
    keys: ['geodata/nakhon-ratchasima-boundary', 'geodata/thailand-adm1'] },
  { id: 'sources', title: 'แหล่งข้อมูลอ้างอิง', description: resourceViews['canonical/source_registry'].description,
    keys: ['canonical/source_registry'] },
] as const;

export function referenceCatalogGroups<T extends { resource_key: string }>(items: readonly T[], query = '', group = 'all') {
  const term = query.trim().toLocaleLowerCase('th');
  return resourceGroups.flatMap(category => {
    if (group !== 'all' && group !== category.id) return [];
    const categoryMatch = category.title.toLocaleLowerCase('th').includes(term);
    const resources = category.keys.flatMap(key => {
      const item = items.find(value => value.resource_key === key);
      const view = resourceViews[key];
      return item && (!term || categoryMatch || `${view.title} ${view.description}`.toLocaleLowerCase('th').includes(term)) ? [item] : [];
    });
    return resources.length ? [{ ...category, resources }] : [];
  });
}

// These are contextual references, not verified inputs to the published model.
const droughtReferenceSourceIds = new Set(['SRC-TMD', 'SRC-GISTDA-DROUGHT', 'SRC-RID', 'SRC-OAE', 'SRC-AGRIMAP-LDD']);

export const sourceFields = [
  { key: 'nameTh', label: 'ชื่อแหล่งข้อมูล' }, { key: 'ownerTh', label: 'หน่วยงานเจ้าของข้อมูล' },
  { key: 'coverageTh', label: 'พื้นที่ที่ครอบคลุม' }, { key: 'freshnessTh', label: 'รอบปรับปรุงและวันที่อ้างอิง' },
  { key: 'limitationTh', label: 'ข้อจำกัดในการใช้ข้อมูล' }, { key: 'url', label: 'เว็บไซต์แหล่งข้อมูล' },
];
export type ReferenceRow = { index: number; cells: string[] };
const record = (value: Json | undefined): Payload => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = (value: Json | undefined): Json[] => Array.isArray(value) ? value : [];
const text = (value: Json | undefined) => value === null || value === undefined || value === '' ? 'ไม่ระบุ' : String(value);

/** Read projections only: no values, shape, identifiers or publication rules are rewritten. */
export function referenceTable(key: string, payload: Json): { columns: string[]; rows: ReferenceRow[] } {
  const view = resourceViews[key]?.view;
  const root = record(payload);
  if (view === 'areas') return { columns: ['อำเภอ', 'ตำบล', 'รหัสตำบล'], rows: array(record(root.province).districts).flatMap(district => {
    const item = record(district);
    return array(item.subdistricts).map(area => ({ index: 0, cells: [text(item.nameTh), text(record(area).nameTh), text(record(area).subdistrictCode)] }));
  }).map((row, index) => ({ ...row, index })) };
  if (view === 'sources') return { columns: ['แหล่งข้อมูล', 'หน่วยงาน', 'พื้นที่ที่ครอบคลุม', 'การใช้งาน'], rows: array(payload).flatMap((item, index) => {
    const source = record(item);
    return source.dataClass === 'REAL' && typeof source.id === 'string' && droughtReferenceSourceIds.has(source.id)
      ? [{ index, cells: [text(source.nameTh), text(source.ownerTh), text(source.coverageTh), 'อ้างอิงประกอบ'] }] : [];
  }) };
  if (view === 'stations') return { columns: ['สถานี', 'อำเภอ / ตำบล', 'ละติจูด', 'ลองจิจูด'], rows: array(root.stations).flatMap((item, index) => {
    const station = record(item);
    return station.provenance === 'REAL' ? [{ index, cells: [text(station.stationNameTh), `${text(station.districtTh)} / ${text(station.subdistrictTh)}`, text(station.latitude), text(station.longitude)] }] : [];
  }) };
  if (view === 'coverage') return { columns: ['อำเภอ / ตำบล', 'สถานีอ้างอิง', 'ระยะห่าง (กม.)', 'ความหมาย'], rows: array(root.records).flatMap((item, index) => {
    const area = record(item);
    return area.provenance === 'REAL' ? [{ index, cells: [`${text(area.districtTh)} / ${text(area.subdistrictTh)}`, text(area.nearestStationNameTh), text(area.distanceKm), area.coverageStatus === 'direct_station' ? 'มีสถานีในตำบล' : area.coverageStatus === 'nearest_station_proxy' ? 'ใช้สถานีใกล้เคียง ไม่ใช่ค่าฝนในตำบล' : 'ยังไม่มีสถานีอ้างอิง'] }] : [];
  }) };
  if (view === 'geometry') return { columns: ['พื้นที่', 'ลักษณะข้อมูล'], rows: (root.type === 'Feature' ? [root] : array(root.features)).map((feature, index) => {
    const properties = record(record(feature).properties);
    const name = properties.T_Name_T ? [properties.T_Name_T, properties.A_Name_T].filter(Boolean).join(' · ')
      : properties.provinceNameTh ?? properties.shapeName ?? properties.nameTh ?? properties.name;
    return { index, cells: [name ? text(name) : `${resourceViews[key].title} · พื้นที่ ${index + 1}`, 'ขอบเขตพื้นที่บนแผนที่'] };
  }) };
  return { columns: [], rows: [] };
}

// This exact unpublished verification artifact is recorded in CMS_CUTOVER_20260928.md.
// Never classify real operator drafts by a title containing "test" or "ทดสอบ".
export function isCutoverVerification(item: { id: string; state: string; source_filename: string }) {
  return item.id === '0414a977-22b3-43db-ae00-80a6ca6fff38' && item.state === 'draft' && item.source_filename === 'cms-cutover-verification.json';
}
