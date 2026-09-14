import hierarchy from './data/canonical/nakhon_ratchasima/admin_hierarchy.json';
import { readIrrigationSelection } from './irrigation';

export const searchKinds = { province: 'จังหวัด', district: 'อำเภอ', subdistrict: 'ตำบล', tool: 'หน้าและเครื่องมือ' } as const;
export type SearchKind = keyof typeof searchKinds;
export type SearchMatchMode = 'contains' | 'exact';
export type SearchEntry = {
  id: string; kind: SearchKind; name: string; title: string; context: string;
  code?: string; districtCode?: string; path?: string; action?: 'export';
  aliases: string[]; tags: string[]; contextKeywords: string[];
};
export type SearchHit = { entry: SearchEntry; matched: string; score: number };
export const searchSuggestions = ['ปากช่อง', 'ในเมือง', 'โคราช', 'พยากรณ์ภัยแล้ง'];
export const searchQueryLimit = 120;

export function normalizeSearchQuery(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('th-TH')
    .replace(/[๐-๙]/g, digit => String(digit.charCodeAt(0) - 0x0e50)).trim().replace(/\s+/g, ' ');
}

// Keep the reference's Thai minimum; never strip Thai vowels or tone marks.
export function isSearchQueryReady(query: string) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return false;
  if (/[\u0E00-\u0E7F]/u.test(normalized) && !/[a-z0-9]/i.test(normalized)) {
    return (normalized.match(/[\u0E01-\u0E3A\u0E40-\u0E4E]/gu)?.length ?? 0) >= 2;
  }
  return true;
}

const province = hierarchy.province;
export const searchDistrictOptions = province.districts.map(district => ({ value: district.districtCode, label: `อำเภอ${district.nameTh}` }));
const provinceKeywords = [province.nameTh, province.name, province.provinceCode, 'โคราช', 'Korat'];
const areaTags = ['ข้อมูลพื้นที่', 'แผนที่', 'พยากรณ์ภัยแล้ง'];

/** Stable identities include geography level. Names are searchable labels, never join keys. */
export function buildWorkspaceSearchIndex(includeExport: boolean): SearchEntry[] {
  const entries: SearchEntry[] = [{
    id: `province:${province.provinceCode}`, kind: 'province', name: province.nameTh,
    title: `จังหวัด${province.nameTh}`, context: 'ภาพรวมจังหวัดนครราชสีมา', code: province.provinceCode,
    path: '/', aliases: [province.name, 'โคราช', 'Korat'], tags: areaTags, contextKeywords: ['ภาพรวม'],
  }];
  for (const district of province.districts) {
    const path = `/${district.routingSlug}`;
    entries.push({ id: `district:${district.districtCode}`, kind: 'district', name: district.nameTh,
      title: `อำเภอ${district.nameTh}`, context: `จังหวัด${province.nameTh}`, code: district.districtCode,
      districtCode: district.districtCode, path, aliases: [district.name], tags: areaTags, contextKeywords: provinceKeywords });
    for (const subdistrict of district.subdistricts) {
      entries.push({ id: `subdistrict:${subdistrict.subdistrictCode}`, kind: 'subdistrict', name: subdistrict.nameTh,
        title: `ตำบล${subdistrict.nameTh}`, context: `อำเภอ${district.nameTh} · จังหวัด${province.nameTh}`,
        code: subdistrict.subdistrictCode, districtCode: district.districtCode,
        path: `${path}/${subdistrict.routingSlug}`, aliases: subdistrict.name !== subdistrict.nameTh ? [subdistrict.name] : [],
        tags: areaTags, contextKeywords: [...provinceKeywords, district.nameTh, district.name, district.districtCode] });
    }
  }
  entries.push({ id: 'page:drought', kind: 'tool', name: 'พยากรณ์ภัยแล้ง', title: 'พยากรณ์ภัยแล้ง',
    context: 'จังหวัดนครราชสีมา · หน้าพยากรณ์ล่วงหน้า 1–6 เดือน', path: '/drought',
    aliases: ['ภัยแล้ง', 'forecast', 'drought', 'T+'], tags: ['พยากรณ์ภัยแล้ง', 'การวิเคราะห์', 'แผนที่'], contextKeywords: provinceKeywords });
  if (includeExport) entries.push({ id: 'tool:export', kind: 'tool', name: 'ส่งออก Excel', title: 'ส่งออก Excel',
    context: 'เครื่องมือรายงาน · เลือกพื้นที่และรอบข้อมูลก่อนดาวน์โหลด', action: 'export',
    aliases: ['Excel', 'ดาวน์โหลด', 'ดาวน์โหลดตาราง', 'export'], tags: ['รายงาน', 'ส่งออกข้อมูล'], contextKeywords: [] });
  return entries;
}

export function searchWorkspace(entries: SearchEntry[], query: string, mode: SearchMatchMode): SearchHit[] {
  const needle = normalizeSearchQuery(query).slice(0, searchQueryLimit);
  if (!isSearchQueryReady(needle)) return [];
  const words = needle.split(' ');
  const hits: SearchHit[] = [];
  for (const entry of entries) {
    const fields = [
      { value: entry.name, rank: 0 }, { value: entry.title, rank: 0 }, { value: entry.code ?? '', rank: 0 },
      ...entry.aliases.map(value => ({ value, rank: 1 })),
      { value: entry.context, rank: 4 }, ...entry.contextKeywords.map(value => ({ value, rank: 4 })),
      ...entry.tags.map(value => ({ value, rank: 5 })),
    ].filter(field => field.value).map(field => ({ ...field, normalized: normalizeSearchQuery(field.value) }));
    const matching = fields.filter(field => mode === 'exact' ? field.normalized === needle : field.normalized.includes(needle));
    const best = matching.map(field => ({ ...field, score: field.rank * 10 + (field.normalized === needle ? 0 : field.normalized.startsWith(needle) ? 1 : 2) }))
      .sort((a, b) => a.score - b.score)[0];
    if (best) hits.push({ entry, score: best.score, matched: best.value });
    else if (mode === 'contains' && words.every(word => fields.some(field => field.normalized.includes(word)))) {
      hits.push({ entry, score: 60, matched: fields.filter(field => words.some(word => field.normalized.includes(word))).map(field => field.value).slice(0, 3).join(' · ') });
    }
  }
  return hits.sort((a, b) => a.score - b.score || a.entry.title.localeCompare(b.entry.title, 'th') || a.entry.id.localeCompare(b.entry.id));
}

/** Copy only forecast context, never the old geographic scope or arbitrary query parameters. */
export function searchDestination(path: string, search: string, historyState?: unknown) {
  const current = new URLSearchParams(search);
  const next = new URLSearchParams();
  const period = current.get('target') ?? '';
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) next.set('target', period);
  const horizon = current.get('horizon') ?? '1';
  next.set('horizon', path === '/' ? '1' : /^[1-6]$/.test(horizon) ? horizon : '1');
  next.set('mapLayer', current.get('mapLayer') === 'irrigation' ? 'irrigation' : 'forecast-archive');
  const irrigation = readIrrigationSelection(search, historyState);
  if (irrigation !== 'all') next.set('irrigation', irrigation);
  return `${path}?${next.toString()}`;
}

export function searchHistoryKey(userId: string) { return `korat-tan-phai-search-history-v1:${encodeURIComponent(userId)}`; }
export function readSearchHistory(storage: Pick<Storage, 'getItem'>, userId: string): string[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(searchHistoryKey(userId)) ?? '[]');
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.filter((item): item is string => {
      if (typeof item !== 'string' || !item.trim() || item.length > searchQueryLimit) return false;
      const key = normalizeSearchQuery(item);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 6);
  } catch { return []; }
}
export function commitSearchHistory(storage: Pick<Storage, 'getItem' | 'setItem'>, userId: string, query: string) {
  const value = query.trim().replace(/\s+/g, ' ').slice(0, searchQueryLimit);
  const history = readSearchHistory(storage, userId);
  if (!isSearchQueryReady(value)) return history;
  const next = [value, ...history.filter(item => normalizeSearchQuery(item) !== normalizeSearchQuery(value))].slice(0, 6);
  storage.setItem(searchHistoryKey(userId), JSON.stringify(next));
  return next;
}
