import type { Json, Payload } from './types';

// Operator-facing views are deliberately separate from the complete runtime registry.
// An import dependency, empty schema or retained demo is not an operational dataset.
export const resourceViews: Record<string, { title: string; description: string; group: 'website'; view: 'areas' | 'geometry' }> = {
  'canonical/nakhon_ratchasima/admin_hierarchy': { title: 'รายชื่ออำเภอและตำบล', description: 'ชื่อและรหัสพื้นที่ที่ใช้ค้นหา เลือกพื้นที่ และเชื่อมกับค่าพยากรณ์', group: 'website', view: 'areas' },
  'geodata/nakhon-ratchasima-subdistricts': { title: 'ขอบเขตตำบลในนครราชสีมา', description: 'รูปพื้นที่สำหรับระบายสีพยากรณ์และเลือกตำบลบนแผนที่', group: 'website', view: 'geometry' },
  'geodata/nakhon-ratchasima-boundary': { title: 'เส้นรอบจังหวัดนครราชสีมา', description: 'เส้นขอบรอบนอกของพื้นที่จังหวัดบนแผนที่', group: 'website', view: 'geometry' },
  'geodata/thailand-adm1': { title: 'ขอบเขตจังหวัดรอบข้าง', description: 'แผนที่ประกอบสำหรับบอกตำแหน่งจังหวัด ไม่ใช่ค่าความเสี่ยง', group: 'website', view: 'geometry' },
};

// The everyday catalogue is separate from retained deep-link views and storage.
export const resourceGroups = [
  { id: 'areas', title: 'ข้อมูลพื้นที่', description: 'รายชื่อและรหัสอำเภอและตำบล สำหรับค้นหา เลือกพื้นที่ และเชื่อมกับข้อมูลพยากรณ์',
    keys: ['canonical/nakhon_ratchasima/admin_hierarchy'] },
  { id: 'maps', title: 'ชั้นข้อมูลแผนที่', description: 'ขอบเขตตำบล เส้นรอบจังหวัด และจังหวัดรอบข้างที่ใช้แสดงบนแผนที่',
    keys: ['geodata/nakhon-ratchasima-subdistricts', 'geodata/nakhon-ratchasima-boundary', 'geodata/thailand-adm1'] },
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
