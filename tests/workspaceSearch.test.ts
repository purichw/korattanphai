import { beforeEach, describe, expect, it } from 'vitest';
import { buildWorkspaceSearchIndex, commitSearchHistory, readSearchHistory, searchDestination, searchHistoryKey, searchWorkspace } from '../src/workspaceSearch';
import { resolveAppRoute } from '../src/domain';

const index = buildWorkspaceSearchIndex(true);
describe('workspace search identities and matching', () => {
  it('keeps canonical levels and every destination independent of repeated names', () => {
    expect(index.filter(item => item.kind === 'province')).toHaveLength(1);
    expect(index.filter(item => item.kind === 'district')).toHaveLength(32);
    expect(index.filter(item => item.kind === 'subdistrict')).toHaveLength(289);
    expect(new Set(index.map(item => item.id)).size).toBe(index.length);
    for (const item of index.filter(item => item.path)) {
      const route = resolveAppRoute(new URL(item.path!, 'https://local.invalid').pathname);
      expect(route.kind).toBe('nakhon-ratchasima');
      if (route.kind === 'nakhon-ratchasima') expect(route.target.valid).toBe(true);
    }
    const hits = searchWorkspace(index, 'ปากช่อง', 'exact');
    expect(hits.slice(0, 2).map(hit => hit.entry.id)).toEqual(expect.arrayContaining(['district:3021', 'subdistrict:302101']));
    expect(hits.find(hit => hit.entry.id === 'subdistrict:302101')?.entry.context).toContain('อำเภอปากช่อง');
    const repeated = searchWorkspace(index, 'ในเมือง', 'exact').filter(hit => hit.entry.name === 'ในเมือง');
    expect(repeated.length).toBeGreaterThan(1);
    expect(new Set(repeated.map(hit => hit.entry.path)).size).toBe(repeated.length);
  });
  it('matches aliases, context, topics and Thai digits with visible explanations', () => {
    expect(searchWorkspace(index, 'KORAT', 'exact')[0].entry.id).toBe('province:30');
    expect(searchWorkspace(index, '๓๐๒๑๐๑', 'exact')[0].entry.id).toBe('subdistrict:302101');
    expect(searchWorkspace(index, 'pak chong', 'exact')[0].entry.id).toBe('district:3021');
    expect(searchWorkspace(index, 'ปากช่อง แผนที่', 'contains').some(hit => hit.entry.id === 'subdistrict:302101')).toBe(true);
    expect(searchWorkspace(index, 'ส่งออกข้อมูล', 'exact').map(hit => hit.entry.id)).toEqual(['tool:export']);
    expect(searchWorkspace(index, 'โคราช', 'exact')[0].matched).toBe('โคราช');
    expect(buildWorkspaceSearchIndex(false).some(item => item.action === 'export')).toBe(false);
  });
  it('retains Thai vowel/tone distinctions and rejects incomplete or unrelated queries', () => {
    expect(searchWorkspace(index, 'ป', 'contains')).toEqual([]);
    expect(searchWorkspace(index, ' ', 'contains')).toEqual([]);
    expect(searchWorkspace(index, 'เชียงใหม่', 'contains')).toEqual([]);
    expect(searchWorkspace(index, 'ปากชอง', 'exact')).toEqual([]);
    expect(searchWorkspace(index, 'ปาก', 'contains').length).toBeGreaterThan(0);
    expect(searchWorkspace(index, 'ปาก', 'exact')).toEqual([]);
  });
  it('preserves source month and lead time while replacing geographic scope', () => {
    const destination = new URL(searchDestination('/pak-chong/t-302101', '?mapLayer=forecast-archive&target=2025-12&horizon=4&district=3001&mapRisk=high&unrelated=secret', { ktpIrrigation: 'rainfed' }), 'https://example.test');
    expect(destination.pathname).toBe('/pak-chong/t-302101');
    expect(Object.fromEntries(destination.searchParams)).toEqual({ target: '2025-12', horizon: '4', mapLayer: 'forecast-archive', irrigation: 'rainfed' });
    expect(searchDestination('/', '?mapLayer=forecast-archive&target=2025-12&horizon=6')).toContain('horizon=1');
    expect(searchDestination('/drought', '?mapLayer=forecast-archive&target=2025-99&horizon=99')).toBe('/drought?horizon=1&mapLayer=forecast-archive');
    expect(searchDestination('/phimai', '?period=2026-08')).toBe('/phimai?horizon=1&mapLayer=forecast-archive');
    expect(searchDestination('/phimai', '?target=2025-12&horizon=6')).toBe('/phimai?target=2025-12&horizon=6&mapLayer=forecast-archive');
    expect(searchDestination('/drought?mapLayer=forecast-archive', '?period=2026-08')).toBe('/drought?horizon=1&mapLayer=forecast-archive');
  });
});

describe('per-account search history', () => {
  const values = new Map<string, string>();
  const historyStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  beforeEach(() => values.clear());
  it('keeps six unique committed queries and isolates accounts', () => {
    for (const word of ['ปากช่อง', 'พิมาย', 'โคราช', 'ในเมือง', 'สีคิ้ว', 'ด่านขุนทด', 'Pak Chong']) commitSearchHistory(historyStorage, 'account-a', word);
    expect(readSearchHistory(historyStorage, 'account-a')).toHaveLength(6);
    const recent = commitSearchHistory(historyStorage, 'account-a', ' PAK   CHONG ');
    expect(recent[0]).toBe('PAK CHONG');
    expect(recent.filter(item => /chong/i.test(item))).toHaveLength(1);
    expect(readSearchHistory(historyStorage, 'account-b')).toEqual([]);
    commitSearchHistory(historyStorage, 'account-b', 'พิมาย');
    historyStorage.removeItem(searchHistoryKey('account-a'));
    expect(readSearchHistory(historyStorage, 'account-a')).toEqual([]);
    expect(readSearchHistory(historyStorage, 'account-b')).toEqual(['พิมาย']);
    expect(commitSearchHistory(historyStorage, 'account-a', 'โคราช')).toEqual(['โคราช']);
  });
  it('ignores malformed storage and surfaces failed persistence to the UI', () => {
    historyStorage.setItem(searchHistoryKey('a'), '{bad json');
    expect(readSearchHistory(historyStorage, 'a')).toEqual([]);
    historyStorage.setItem(searchHistoryKey('a'), JSON.stringify([null, 5, '', 'ปากช่อง', 'ปากช่อง', 'x'.repeat(121)]));
    expect(readSearchHistory(historyStorage, 'a')).toEqual(['ปากช่อง']);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readSearchHistory(blocked, 'a')).toEqual([]);
    expect(() => commitSearchHistory(blocked, 'a', 'โคราช')).toThrow('blocked');
  });
});
