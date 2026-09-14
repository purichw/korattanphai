import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, History, MapPin, Search, X } from 'lucide-react';
import { AppSelect } from './AppSelect';
import { buildWorkspaceSearchIndex, commitSearchHistory, isSearchQueryReady, readSearchHistory, searchDestination,
  searchDistrictOptions, searchHistoryKey, searchKinds, searchQueryLimit, searchSuggestions, searchWorkspace,
  type SearchEntry, type SearchKind, type SearchMatchMode } from '../workspaceSearch';

const pageSize = 24;
export function WorkspaceSearchContent({ userId, includeExport, onNavigate, onExport, onClose }: {
  userId: string; includeExport: boolean; onNavigate: (path: string) => void; onExport: () => void; onClose: () => void;
}) {
  const index = useMemo(() => buildWorkspaceSearchIndex(includeExport), [includeExport]);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [district, setDistrict] = useState('all');
  const [tag, setTag] = useState('all');
  const [mode, setMode] = useState<SearchMatchMode>('contains');
  const [filtersOpen, setFiltersOpen] = useState(() => window.matchMedia('(min-width: 601px)').matches);
  const filtersId = useId();
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [history, setHistory] = useState<string[]>(() => {
    try { return readSearchHistory(window.localStorage, userId); } catch { return []; }
  });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const queryInput = useRef<HTMLInputElement>(null);
  // A cached lazy child can mount before its parent calls showModal; wait for
  // that commit to finish, and never refocus a dialog that has been dismissed.
  useEffect(() => {
    const frame = requestAnimationFrame(() => queryInput.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === searchHistoryKey(userId) || event.key === null) {
        try { setHistory(readSearchHistory(window.localStorage, userId)); } catch { setHistory([]); }
      }
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [userId]);
  const raw = useMemo(() => searchWorkspace(index, query, mode), [index, query, mode]);
  const filtered = raw.filter(({ entry }) => (kind === 'all' || entry.kind === kind)
    && (district === 'all' || entry.districtCode === district) && (tag === 'all' || entry.tags.includes(tag)));
  const visible = filtered.slice(0, visibleCount);
  const hasFilters = kind !== 'all' || district !== 'all' || tag !== 'all';
  const tags = [...new Set(raw.flatMap(({ entry }) => entry.tags))];
  const districts = new Set(raw.map(({ entry }) => entry.districtCode));
  function resetFilters() { setKind('all'); setDistrict('all'); setTag('all'); setVisibleCount(pageSize); }
  function updateQuery(value: string) { setQuery(value); resetFilters(); setNotice(''); setError(''); }
  function remember(value = query) {
    try { setHistory(commitSearchHistory(window.localStorage, userId, value)); }
    catch { setError('ไม่สามารถบันทึกประวัติการค้นหาบนอุปกรณ์นี้ได้'); }
  }
  function clearHistory() {
    try {
      window.localStorage.removeItem(searchHistoryKey(userId)); setHistory([]); setError('');
      setNotice('ล้างประวัติการค้นหาแล้ว');
    } catch { setError('ไม่สามารถล้างประวัติการค้นหาได้ กรุณาตรวจสอบการตั้งค่าเบราว์เซอร์แล้วลองอีกครั้ง'); }
  }
  function openResult(entry: SearchEntry) {
    remember(); onClose();
    if (entry.action === 'export') onExport();
    else if (entry.path) onNavigate(searchDestination(entry.path, window.location.search, window.history.state));
  }
  return <div className="workspace-search">
      <p className="workspace-search-intro">ค้นหาชื่อพื้นที่ รหัสพื้นที่ ชื่อเรียกอื่น หรือหัวข้อที่เกี่ยวข้องในจังหวัดนครราชสีมา</p>
      <form className="workspace-search-form" onSubmit={event => { event.preventDefault(); remember(); }}>
        <label className="workspace-search-field"><Search size={20} aria-hidden="true" /><span className="sr-only">คำค้นหา</span>
          <input ref={queryInput} type="search" aria-label="คำค้นหา" placeholder="ระบุชื่อพื้นที่ รหัสพื้นที่ หรือหัวข้อ" value={query}
            maxLength={searchQueryLimit} onChange={event => updateQuery(event.target.value)} />
        </label>
        {query && <button type="button" className="icon-button" aria-label="ล้างคำค้นหา" onClick={() => updateQuery('')}><X size={19} /></button>}
        <button className="primary-button" type="submit">ค้นหา</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="workspace-search-notice" role="status">{notice}</p>}
      {!query.trim() ? <section aria-label="คำค้นหาแนะนำและประวัติ">
        <div className="workspace-search-history-heading"><h3><History size={17} aria-hidden="true" />{history.length ? 'คำค้นหาล่าสุด' : 'คำค้นหาแนะนำ'}</h3>
          {history.length > 0 && <button type="button" className="secondary-button" onClick={clearHistory}>ล้างประวัติการค้นหา</button>}</div>
        <div className="workspace-search-chips">{(history.length ? history : searchSuggestions).map(value => <button type="button" key={value}
          onClick={() => { updateQuery(value); remember(value); }}>{value}</button>)}</div>
        <p className="workspace-search-note">ประวัติการค้นหาจัดเก็บแยกตามบัญชีผู้ใช้บนเบราว์เซอร์นี้ สูงสุด 6 คำค้นหา</p>
      </section> : <>
        <div className="workspace-search-summary" role="status" aria-live="polite" aria-atomic="true">
          <h3>ผลการค้นหา “{query.trim()}”</h3>
          <span>พบ {filtered.length.toLocaleString('th-TH')}{hasFilters ? ` จาก ${raw.length.toLocaleString('th-TH')}` : ''} รายการ</span>
        </div>
        <button type="button" className="secondary-button workspace-search-filter-toggle" aria-expanded={filtersOpen} aria-controls={filtersOpen ? filtersId : undefined}
          onClick={() => setFiltersOpen(value => !value)}>{filtersOpen ? 'ซ่อนตัวกรอง' : 'แสดงตัวกรอง'}{hasFilters ? ' (กำลังใช้งาน)' : ''}</button>
        {filtersOpen && <section id={filtersId} className="workspace-search-filters" aria-label="ตัวกรองผลการค้นหา">
          <AppSelect label="ประเภทข้อมูล" value={kind} options={[{ value: 'all', label: 'ทุกประเภท' },
            ...Object.entries(searchKinds).map(([value, label]) => ({ value, label }))]} onChange={value => { setKind(value); setVisibleCount(pageSize); }} />
          <AppSelect label="อำเภอ" value={district} options={[{ value: 'all', label: 'ทุกอำเภอ' },
            ...searchDistrictOptions.filter(option => districts.has(option.value) || option.value === district)]} onChange={value => { setDistrict(value); setVisibleCount(pageSize); }} />
          <AppSelect label="หัวข้อ" value={tag} options={[{ value: 'all', label: 'ทุกหัวข้อ' }, ...[...new Set([...tags, ...(tag === 'all' ? [] : [tag])])].map(value => ({ value, label: value }))]}
            onChange={value => { setTag(value); setVisibleCount(pageSize); }} />
          <fieldset className="workspace-search-match"><legend>วิธีการค้นหา</legend><div>
            <button type="button" aria-pressed={mode === 'contains'} onClick={() => { setMode('contains'); resetFilters(); }}>มีคำค้นหาอยู่ภายใน</button>
            <button type="button" aria-pressed={mode === 'exact'} onClick={() => { setMode('exact'); resetFilters(); }}>ตรงกับคำค้นหาทั้งหมด</button>
          </div></fieldset>
        </section>}
        {hasFilters && <button type="button" className="secondary-button workspace-search-reset" onClick={resetFilters}>ล้างตัวกรอง</button>}
        {!filtered.length && <div className="workspace-search-empty">
          <h3>{isSearchQueryReady(query) ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา' : 'กรุณาระบุคำค้นหาเพิ่มเติม'}</h3>
          <p>{!isSearchQueryReady(query) ? 'กรุณาระบุคำค้นหาภาษาไทยอย่างน้อย 2 ตัวอักษร หรือระบุรหัสพื้นที่'
            : hasFilters ? 'กรุณาล้างตัวกรอง หรือปรับประเภทข้อมูล อำเภอ และหัวข้อ'
            : 'กรุณาตรวจสอบการสะกด หรือค้นหาด้วยชื่อเรียกอื่น รหัสพื้นที่ หรือหัวข้อที่เกี่ยวข้อง'}</p>
        </div>}
        <div className="workspace-search-groups">{(Object.keys(searchKinds) as SearchKind[]).map(group => {
          const matches = visible.filter(hit => hit.entry.kind === group);
          if (!matches.length) return null;
          return <section key={group} aria-label={`ผลการค้นหาประเภท${searchKinds[group]}`}>
            <h3>{searchKinds[group]} <span>{filtered.filter(hit => hit.entry.kind === group).length} รายการ</span></h3>
            <ul>{matches.map(({ entry, matched }) => <li key={entry.id}>
              <button type="button" className="workspace-search-result" onClick={() => openResult(entry)}>
                <MapPin size={19} aria-hidden="true" /><span className="workspace-search-result-copy">
                  <strong>{entry.title}</strong><span>{entry.context}</span>
                  {entry.code && <span>รหัสพื้นที่ {entry.code}</span>}
                  <small>ตรงกับ: {matched}</small>
                </span><ArrowRight size={18} aria-hidden="true" />
              </button>
              <div className="workspace-search-result-tags" aria-label={`หัวข้อของ${entry.title}`}>{entry.tags.map(value => <button type="button" key={value}
                aria-label={`กรองหัวข้อ ${value}`} aria-pressed={tag === value} onClick={() => { setTag(value); setVisibleCount(pageSize); }}>{value}</button>)}</div>
            </li>)}</ul>
          </section>;
        })}</div>
        {visible.length < filtered.length && <button type="button" className="secondary-button workspace-search-more"
          onClick={() => setVisibleCount(count => count + pageSize)}>แสดงผลการค้นหาเพิ่มเติม ({visible.length} จาก {filtered.length} รายการ)</button>}
      </>}
    </div>;
}
