import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, ChevronDown, ChevronRight, Download, Filter, History, Info, List, ListChecks, Map, MapPinned, RefreshCw, RotateCcw, Search, Unlink, X } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { MetricGrid } from '../components/PageSummary';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { WorkspaceEmptyState } from '../components/WorkspaceEmptyState';
import type { createAdminClient } from './client';
import { useAdminRead } from './useAdminRead';
import type { AuditEntry } from './types';
import { referenceCsv } from './referenceExport';
import { AREA_BOUNDARIES_KEY, AREA_NAMES_KEY, areaBoundaryExport, areaPayloadAvailable, areaStatusLabels, defaultAreaFilters, filterAreaRows, groupAreaRows, joinAreaResources, type AreaFilters, type AreaRow, type ReferenceResource, type ReferenceResourceData } from './areaModel';
import { AreaBoundaryMap } from './AreaBoundaryMap';
import './areas.css';

type Props = { api: ReturnType<typeof createAdminClient>; primary: ReferenceResourceData; onNavigate: (url: string) => void; onReload: () => void; refreshing: boolean; error: string };
function download(bytes: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type })); const link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AreaWorkspace(props: Props) {
  const [version, setVersion] = useState(0);
  const [pair, setPair] = useState<{ id: string; data?: ReferenceResourceData; error: string; refreshing: boolean }>();
  const catalog = useAdminRead<ReferenceResource[]>(props.api, 'resource-catalog', {}, version);
  const counterpartKey = props.primary.resource_key === AREA_NAMES_KEY ? AREA_BOUNDARIES_KEY : AREA_NAMES_KEY;
  // Pair the explicitly opened revision (including an old link/draft) with the
  // published counterpart. Never silently replace it with a working draft.
  const counterpart = catalog.data?.find(resource => resource.resource_key === counterpartKey);
  const reload = () => { props.onReload(); setVersion(value => value + 1); };
  const currentPair = pair?.id === counterpart?.id ? pair : undefined;
  return <>
    {counterpart && <AreaPair api={props.api} counterpartId={counterpart.id} version={version} onRead={setPair} />}
    <AreaBrowser {...props} companion={currentPair?.data} companionError={catalog.error || currentPair?.error || (!catalog.loading && !counterpart ? 'ยังไม่มีข้อมูลอีกชุดที่เผยแพร่ใน CMS' : '')}
      refreshing={props.refreshing || catalog.refreshing || Boolean(counterpart && (!currentPair || currentPair.refreshing))} onReload={reload} />
  </>;
}
function AreaPair({ api, counterpartId, version, onRead }: { api: Props['api']; counterpartId: string; version: number; onRead: (value: { id: string; data?: ReferenceResourceData; error: string; refreshing: boolean }) => void }) {
  const companion = useAdminRead<ReferenceResourceData>(api, 'resource-get', { body: { id: counterpartId } }, version);
  useEffect(() => { onRead({ id: counterpartId, data: companion.data, error: companion.error, refreshing: companion.refreshing }); }, [onRead, counterpartId, companion.data, companion.error, companion.refreshing]);
  return null;
}

function AreaBrowser({ api, primary, companion, companionError = '', onNavigate, onReload, refreshing, error }: Props & { companion?: ReferenceResourceData; companionError?: string }) {
  const resources = [primary, companion].filter((item): item is ReferenceResourceData => Boolean(item));
  const names = resources.find(item => item.resource_key === AREA_NAMES_KEY);
  const boundaries = resources.find(item => item.resource_key === AREA_BOUNDARIES_KEY);
  const namesAvailable = areaPayloadAvailable(AREA_NAMES_KEY, names?.payload);
  const boundariesAvailable = areaPayloadAvailable(AREA_BOUNDARIES_KEY, boundaries?.payload);
  const payloadError = resources.some(item => !areaPayloadAvailable(item.resource_key, item.payload)) ? 'รูปแบบข้อมูลพื้นที่ไม่สมบูรณ์ กรุณาตรวจไฟล์ต้นฉบับ' : '';
  const rows = useMemo(() => joinAreaResources(names?.payload, boundaries?.payload), [names?.payload, boundaries?.payload]);
  const [filters, setFilters] = useState<AreaFilters>(defaultAreaFilters);
  const [mode, setMode] = useState<'list' | 'map'>(primary.resource_key === AREA_BOUNDARIES_KEY ? 'map' : 'list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(4);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string>();
  const [inspect, setInspect] = useState<AreaRow | null>(null);
  const [history, setHistory] = useState<{ title: string; entries: AuditEntry[] } | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [historyError, setHistoryError] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => filterAreaRows(rows, filters), [rows, filters]);
  const groups = useMemo(() => groupAreaRows(filtered), [filtered]);
  const allGroups = useMemo(() => groupAreaRows(rows), [rows]);
  const pages = Math.max(1, Math.ceil(groups.length / pageSize)); const currentPage = Math.min(page, pages - 1);
  const visibleGroups = groups.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const chosen = rows.filter(row => selected.has(row.id));
  const exportedBoundaries = areaBoundaryExport(chosen);
  const districts = allGroups.filter(group => group.id !== 'unregistered');
  const tambons = rows.filter(row => filters.district === 'all' || row.districtCode === filters.district);
  const registryCount = rows.filter(row => row.registered).length;
  const linkedCount = rows.filter(row => row.status === 'linked').length;
  const reviewCount = rows.filter(row => !['linked', 'unknown'].includes(row.status)).length;
  const hasFilters = Boolean(filters.query || filters.district !== 'all' || filters.tambon !== 'all' || filters.status !== 'all');
  const revisionKey = resources.map(item => `${item.id}:${item.revision}`).join('|');
  useEffect(() => { setSelected(new Set()); setInspect(null); setActive(undefined); setNotice(''); }, [revisionKey]);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 0; }, [currentPage, pageSize, filters]);
  function update(key: keyof AreaFilters, value: string) {
    setFilters(previous => ({ ...previous, [key]: value, ...(key === 'district' ? { tambon: 'all' } : {}) })); setPage(0); setCollapsed(new Set());
    if (key !== 'sort') { setSelected(new Set()); setActive(key === 'tambon' && value !== 'all' ? value : undefined); setNotice(''); }
  }
  function reset() { setFilters(defaultAreaFilters); setPage(0); setCollapsed(new Set()); setSelected(new Set()); setActive(undefined); setNotice(''); }
  function toggleRows(changes: AreaRow[], checked: boolean) { setNotice(''); setSelected(previous => { const next = new Set(previous); changes.forEach(row => checked ? next.add(row.id) : next.delete(row.id)); return next; }); }
  function open(row: AreaRow) { setActive(row.id); setInspect(row); }
  function checkbox(changes: AreaRow[], label: string) {
    const count = changes.filter(row => selected.has(row.id)).length;
    return <input type="checkbox" aria-label={label} checked={changes.length > 0 && count === changes.length} disabled={refreshing || !changes.length}
      ref={element => { if (element) element.indeterminate = count > 0 && count < changes.length; }} onChange={event => toggleRows(changes, event.target.checked)} />;
  }
  function exportSelection(geometry: boolean) {
    if (geometry) download(JSON.stringify(exportedBoundaries, null, 2), 'ขอบเขตตำบลที่เลือก.geojson', 'application/geo+json');
    else download(referenceCsv(['อำเภอ', 'ตำบล', 'รหัสตำบล', 'สถานะขอบเขต'], chosen.map(row => ({ cells: [row.registered ? row.district : row.boundaries[0]?.district || '', row.name, row.code, areaStatusLabels[row.status]] }))), 'ข้อมูลพื้นที่ที่เลือก.csv', 'text/csv;charset=utf-8');
    setNotice(`ดาวน์โหลด ${geometry ? exportedBoundaries.features.length : chosen.length} ${geometry ? 'รูปขอบเขต' : 'รายการ'}แล้ว`);
  }
  return <section className="cms-reference is-detail cms-area-workspace" aria-labelledby="cms-area-title" aria-busy={refreshing}>
    <div className="cms-context-bar cms-reference-context"><nav aria-label="เส้นทางหน้าผู้ดูแล"><a href="/admin" onClick={event => { event.preventDefault(); onNavigate('/admin'); }}><ArrowLeft size={15} />จัดการข้อมูล</a><ChevronRight size={14} /><span aria-current="page">ข้อมูลพื้นที่</span></nav>
      <button className="icon-button" aria-label="โหลดข้อมูลพื้นที่ใหม่" title="โหลดข้อมูลพื้นที่ใหม่" disabled={refreshing || historyBusy} onClick={onReload}><RefreshCw size={17} /></button></div>
    <header className="cms-list-heading"><div className="cms-section-heading"><span className="cms-section-icon"><MapPinned size={28} /></span><div><h1 id="cms-area-title">ข้อมูลพื้นที่</h1><p className="cms-help">รายชื่อ รหัส และขอบเขตตำบลในนครราชสีมา</p></div></div></header>
    {(error || companionError || payloadError) && <div className="cms-error" role="alert"><p>{error || companionError || payloadError} · ข้อมูลที่โหลดไม่ได้จะไม่ถูกนับเป็นพื้นที่ที่ไม่มีขอบเขต</p><button className="secondary-button" disabled={refreshing} onClick={onReload}><RefreshCw size={16} />ลองโหลดใหม่</button></div>}
    <MetricGrid className="cms-resource-metrics cms-area-metrics" ariaLabel="สรุปข้อมูลพื้นที่ทั้งหมด" metrics={[
      { value: namesAvailable ? registryCount : 'ไม่ทราบ', label: 'ตำบลในทะเบียน', detail: namesAvailable ? `${districts.length} อำเภอ` : 'ยังโหลดทะเบียนไม่ได้', icon: <Building2 size={23} />, className: 'cms-resource-area-metric' },
      { value: namesAvailable && boundariesAvailable ? linkedCount : 'ไม่ทราบ', label: 'ชื่อและรหัสตรงกับขอบเขต', icon: <Map size={23} /> },
      { value: namesAvailable && boundariesAvailable ? reviewCount : 'ไม่ทราบ', label: 'ต้องตรวจสอบ', icon: <Unlink size={23} />, className: 'cms-resource-total-metric' },
    ]} />
    <div className="cms-area-revisions">{resources.map(item => <span key={item.id}>{item.resource_key === AREA_NAMES_KEY ? 'ทะเบียนพื้นที่' : 'ขอบเขตตำบล'} · รุ่น {item.revision} · {item.state === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}</span>)}</div>
    <section className="cms-area-browser" aria-label="ค้นหาและตรวจข้อมูลพื้นที่">
      <div className="cms-area-viewbar"><div className="cms-area-modes" role="group" aria-label="มุมมองข้อมูลพื้นที่">
        <button aria-pressed={mode === 'list'} onClick={() => setMode('list')}><List size={18} />รายชื่อ</button><button aria-pressed={mode === 'map'} onClick={() => setMode('map')}><Map size={18} />แผนที่</button></div>
        <button className="cms-record-text-action" aria-pressed={selectionMode} disabled={refreshing} onClick={() => { setSelectionMode(value => !value); setSelected(new Set()); setNotice(''); }}>
          {selectionMode ? <X size={16} /> : <ListChecks size={16} />}{selectionMode ? 'ยกเลิกการเลือก' : 'เลือกเพื่อดาวน์โหลด'}</button></div>
      <div className="cms-area-filters">
        <div className="cms-area-search-row"><label className="cms-search"><Search size={18} aria-hidden="true" /><input aria-label="ค้นหาพื้นที่" placeholder="ค้นหาอำเภอ ตำบล หรือรหัสพื้นที่" value={filters.query} onChange={event => update('query', event.target.value)} /></label>
          <button className="secondary-button cms-area-filter-toggle" aria-expanded={filtersOpen} aria-controls="cms-area-filter-options" onClick={() => setFiltersOpen(value => !value)}><Filter size={17} />ตัวกรอง{hasFilters && <span className="cms-area-filter-dot" />}</button></div>
        <div id="cms-area-filter-options" className={`cms-area-filter-options${filtersOpen ? ' is-open' : ''}`}>
          <AppSelect label="อำเภอ" searchable value={filters.district} onChange={value => update('district', value)} options={[{ value: 'all', label: 'ทุกอำเภอ' }, ...districts.map(group => ({ value: group.id, label: group.name, searchText: group.id }))]} />
          <AppSelect label="ตำบล" searchable value={filters.tambon} onChange={value => update('tambon', value)} options={[{ value: 'all', label: 'ทุกตำบล' }, ...tambons.map(row => ({ value: row.id, label: row.name, description: `${row.code} · ${row.registered ? row.district : row.boundaries[0]?.district || ''}`, searchText: `${row.code} ${row.district}` }))]} />
          <AppSelect label="สถานะขอบเขต" value={filters.status} onChange={value => update('status', value)} options={[{ value: 'all', label: 'ทุกสถานะ' }, { value: 'review', label: 'รายการที่ต้องตรวจสอบ' }, ...Object.entries(areaStatusLabels).map(([value, label]) => ({ value, label }))]} />
          <AppSelect label="เรียงลำดับ" value={filters.sort} onChange={value => update('sort', value)} options={[{ value: 'code', label: 'รหัสพื้นที่ น้อยไปมาก' }, { value: 'code-desc', label: 'รหัสพื้นที่ มากไปน้อย' }, { value: 'name', label: 'ชื่อ ก–ฮ' }]} />
        </div>
      </div>
      <div className="cms-area-results"><span role="status">พบ <strong>{filtered.length}</strong> จาก {rows.length} รายการ · {groups.filter(group => group.id !== 'unregistered').length} อำเภอ</span>
        {hasFilters && <button className="cms-record-text-action" onClick={reset}><RotateCcw size={15} />ล้างตัวกรอง</button>}
        {mode === 'list' && groups.length > 0 && <button className="cms-record-text-action" onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(groups.map(group => group.id)))}>{collapsed.size ? 'ขยายทุกกลุ่ม' : 'ย่อทุกกลุ่ม'}</button>}</div>
      {selectionMode && <div className="cms-area-selection"><label className="cms-record-checkbox">{checkbox(filtered, 'เลือกทุกพื้นที่ตามตัวกรอง')}<span>เลือกผลลัพธ์ทั้งหมด ({filtered.length})</span></label><span>เลือก {chosen.length} รายการ (รวมทุกหน้า)</span>
        <button className="secondary-button" disabled={!chosen.length || refreshing} onClick={() => exportSelection(false)}><Download size={16} />รายชื่อ (CSV)</button>
        <button className="secondary-button" disabled={!exportedBoundaries.features.length || refreshing} onClick={() => exportSelection(true)}><Download size={16} />ขอบเขต (GeoJSON) · {exportedBoundaries.features.length}</button>
        <button className="icon-button" aria-label="ล้างรายการที่เลือก" title="ล้างรายการที่เลือก" disabled={!chosen.length} onClick={() => setSelected(new Set())}><X size={16} /></button></div>}
      {notice && <p className="cms-success" role="status">{notice}</p>}
      {!filtered.length ? <WorkspaceEmptyState className="cms-area-empty" title="ไม่พบพื้นที่ตามตัวกรองนี้" action={hasFilters ? <button className="secondary-button" onClick={reset}><RotateCcw size={16} />ล้างตัวกรอง</button> : undefined} />
        : mode === 'list' ? <>
          <div className="cms-area-groups" ref={scroller} tabIndex={0} role="region" aria-label="รายชื่อตำบลแบ่งตามอำเภอ">
            {visibleGroups.map(group => <section className="cms-area-group" key={group.id} aria-label={group.name}>
              <div className="cms-area-group-heading">{selectionMode && <label className="cms-record-checkbox">{checkbox(group.rows, `เลือกกลุ่ม ${group.name}`)}</label>}
                <button aria-expanded={!collapsed.has(group.id)} aria-controls={`cms-group-${group.id}`} onClick={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })}>
                  {collapsed.has(group.id) ? <ChevronRight size={18} /> : <ChevronDown size={18} />}<strong>{group.id === 'unregistered' ? group.name : `อ.${group.name}`}</strong><span>{group.rows.length} / {allGroups.find(item => item.id === group.id)?.rows.length ?? 0} {group.id === 'unregistered' ? 'รูปขอบเขต' : 'ตำบล'}</span></button></div>
              <div id={`cms-group-${group.id}`} hidden={collapsed.has(group.id)}><table className="cms-area-table"><caption className="sr-only">{group.name}</caption><thead><tr>{selectionMode && <th scope="col">เลือก</th>}<th scope="col">ตำบล</th><th scope="col">รหัสตำบล</th><th scope="col">สถานะขอบเขต</th><th scope="col"><span className="sr-only">รายละเอียด</span></th></tr></thead>
                <tbody>{group.rows.map(row => <tr key={row.id} className={active === row.id ? 'is-active' : ''}>{selectionMode && <td className="cms-area-check"><label className="cms-record-checkbox">{checkbox([row], `เลือก ${row.name} ${row.code}`)}</label></td>}
                  <td className="cms-area-name">{row.name}</td><td className="cms-area-code">{row.code || 'ไม่ระบุรหัส'}</td><td className="cms-area-status-cell"><AreaStatus row={row} /></td>
                  <td className="cms-area-action"><button className="cms-record-text-action" aria-label={`ดูรายละเอียด ${row.name} ${row.code}`} onClick={() => open(row)}>ดูรายละเอียด<ArrowRight size={15} /></button></td></tr>)}</tbody></table></div>
            </section>)}
          </div>
          <footer className="cms-record-footer"><div className="cms-record-pagination"><AppSelect ariaLabel="จำนวนกลุ่มต่อหน้า" value={String(pageSize)} onChange={value => { setPageSize(Number(value)); setPage(0); }} options={[4, 8, 16, 32].map(value => ({ value: String(value), label: `${value} กลุ่ม` }))} />
            <button className="icon-button" aria-label="ข้อมูลหน้าก่อน" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={17} /></button><span>หน้า {currentPage + 1} / {pages}</span>
            <button className="icon-button" aria-label="ข้อมูลหน้าถัดไป" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}><ArrowRight size={17} /></button></div></footer>
        </> : <div className="cms-area-map-layout"><AreaBoundaryMap rows={filtered} selectedId={active} onPick={open} />
          <aside className="cms-area-map-list" aria-label="พื้นที่บนแผนที่"><h3>ผลการค้นหา <span>{filtered.length}</span></h3><div>{filtered.map(row => <div className="cms-area-map-item" key={row.id}>{selectionMode && <label className="cms-record-checkbox">{checkbox([row], `เลือก ${row.name} ${row.code}`)}</label>}<button aria-label={`ดูขอบเขต ${row.name} ${row.code}`} onClick={() => open(row)}><strong>{row.name}</strong><span>{row.code} · {row.registered ? `อ.${row.district}` : row.district}</span><AreaStatus row={row} /></button></div>)}</div></aside></div>}
    </section>
    <details className="cms-technical cms-resource-history"><summary><History size={19} /><span>ประวัติและไฟล์ต้นฉบับ<small>ทะเบียนพื้นที่และขอบเขตแผนที่</small></span></summary>
      {historyError && <p className="cms-error" role="alert">{historyError}</p>}
      {resources.map(item => <div className="cms-area-source" key={item.id}><div><h3>{item.resource_key === AREA_NAMES_KEY ? 'ทะเบียนอำเภอและตำบล' : 'ขอบเขตตำบล'}</h3><SourceVersion item={item} /></div><div className="cms-actions">
        <button className="secondary-button" onClick={() => download(JSON.stringify(item.payload, null, 2), `${item.resource_key.split('/').pop()}_r${item.revision}.json`, 'application/json')}><Download size={16} />ไฟล์ต้นฉบับ (JSON)</button>
        <button className="secondary-button" disabled={historyBusy || refreshing} onClick={async () => { setHistoryBusy(true); setHistoryError(''); try { const entries = await api<AuditEntry[]>('resource-history', { body: { id: item.id } }); setHistory({ title: item.resource_key === AREA_NAMES_KEY ? 'ทะเบียนอำเภอและตำบล' : 'ขอบเขตตำบล', entries }); } catch (failure) { setHistoryError(failure instanceof Error ? failure.message : 'โหลดประวัติไม่สำเร็จ'); } finally { setHistoryBusy(false); } }}><History size={16} />ประวัติการแก้ไข</button></div></div>)}
      <p className="cms-help">ข้อมูลสำหรับตรวจสอบ การเปลี่ยนรหัสหรือขอบเขตต้องตรวจความสัมพันธ์กับข้อมูลพยากรณ์ก่อน</p>
    </details>
    {inspect && <AreaDetail row={inspect} names={names} boundaries={boundaries} initialMap={mode === 'map'} onClose={() => setInspect(null)} />}
    {history && <WorkspaceDialog title={`ประวัติ ${history.title}`} bounded onClose={() => setHistory(null)} closeLabel="ปิดประวัติ">{history.entries.length ? <div className="cms-audit">{history.entries.map(entry => <article key={entry.id}><strong>รุ่น {entry.revision} · {entry.action === 'publish' ? 'เผยแพร่' : entry.action === 'edit' ? 'แก้ไข' : 'สร้างฉบับร่าง'}</strong><p>{entry.reason}</p><time>{new Date(entry.occurred_at).toLocaleString('th-TH')}</time></article>)}</div> : <WorkspaceEmptyState icon={History} title="ยังไม่มีประวัติการแก้ไข" />}</WorkspaceDialog>}
  </section>;
}

function AreaStatus({ row }: { row: AreaRow }) {
  const Icon = row.status === 'linked' ? Check : row.status === 'unknown' ? Info : Unlink;
  return <span className={`cms-area-status is-${row.status}`}><Icon size={14} aria-hidden="true" />{areaStatusLabels[row.status]}</span>;
}
function SourceVersion({ item }: { item?: ReferenceResourceData }) {
  if (!item) return <p className="cms-help">ยังโหลดข้อมูลไม่ได้</p>;
  const date = item.updated_at || item.published_at;
  return <p className="cms-help">รุ่นแก้ไข {item.revision} · {item.state === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}{date && Number.isFinite(Date.parse(date)) ? ` · ${new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</p>;
}
function AreaDetail({ row, names, boundaries, initialMap, onClose }: { row: AreaRow; names?: ReferenceResourceData; boundaries?: ReferenceResourceData; initialMap: boolean; onClose: () => void }) {
  const [map, setMap] = useState(initialMap);
  const mapRows = useMemo(() => [row], [row]);
  return <WorkspaceDialog title={`ตำบล${row.name}`} description={`${row.registered ? `อ.${row.district}` : row.district} · ${row.code || 'ไม่ระบุรหัส'}`}
    className="cms-record-dialog cms-area-dialog" bounded onClose={onClose} closeLabel="ปิดรายละเอียดพื้นที่" footer={<button className="secondary-button" onClick={onClose}>ปิด</button>}>
    <div className="cms-area-modes" role="group" aria-label="รายละเอียดพื้นที่"><button aria-pressed={!map} onClick={() => setMap(false)}><List size={17} />ข้อมูลทั่วไป</button><button aria-pressed={map} onClick={() => setMap(true)}><Map size={17} />ขอบเขตแผนที่</button></div>
    <AreaStatus row={row} />
    {map ? <><AreaBoundaryMap rows={mapRows} selectedId={row.id} /><dl className="cms-area-detail-fields"><div><dt>จำนวนรูปขอบเขต</dt><dd>{row.boundaries.length}</dd></div><div><dt>แหล่งขอบเขต</dt><dd>{[...new Set(row.boundaries.map(item => item.source).filter(Boolean))].join(', ') || 'ไม่ระบุ'}</dd></div>
      <div><dt>ชื่อในไฟล์ขอบเขต</dt><dd>{row.boundaries.map(item => `${item.name} · ${item.district}`).join(', ') || 'ไม่มีข้อมูล'}</dd></div></dl><SourceVersion item={boundaries} /></>
      : <><dl className="cms-area-detail-fields">{[['จังหวัด', row.province || 'ไม่ระบุ'], ['อำเภอ', row.registered ? row.district : 'ไม่มีข้อมูลทะเบียน'], ['ตำบล', row.name], ['รหัสตำบล', row.code || 'ไม่ระบุ']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><SourceVersion item={names} /></>}
  </WorkspaceDialog>;
}
