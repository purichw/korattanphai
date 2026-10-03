import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronRight, ChevronUp, Clock, Database, Download, FileText, Folder, Grid2X2, History, Map, MapPin, MapPinned, RefreshCw, Search, Users } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { WorkspaceEmptyState } from '../components/WorkspaceEmptyState';
import { createAdminClient } from './client';
import type { Json, AuditEntry } from './types';
import { referenceCatalogGroups, referenceTable, resourceGroups, resourceViews } from './resourcePresentation';
import { useAdminRead } from './useAdminRead';
import { MetricGrid } from '../components/PageSummary';
import { ReferenceRecords } from './ReferenceRecords';
import { ReferenceRecordDialog } from './ReferenceRecordDialog';
import type { ReferenceRow } from './resourcePresentation';

type Resource = { id: string; resource_key: string; title: string; resource_group: string; published_at: string | null; updated_at?: string; draft_id?: string | null };
type ResourceDraft = Resource & { payload: Json; revision: number; state: 'draft' | 'published' };
const groupIcons = { areas: MapPin, maps: Map };
const resourceIcons: Record<string, typeof MapPin> = {
  'canonical/nakhon_ratchasima/admin_hierarchy': MapPinned,
  'geodata/nakhon-ratchasima-subdistricts': Users,
  'geodata/nakhon-ratchasima-boundary': Map,
  'geodata/thailand-adm1': Grid2X2,
};
function downloadResource(item: ResourceDraft) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(item.payload, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${item.resource_key.split('/').pop()}_r${item.revision}.json`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReferenceResources({ api, resourceId, onNavigate, refreshVersion = 0 }: { api: ReturnType<typeof createAdminClient>; resourceId: string | null; onNavigate: (url: string) => void; refreshVersion?: number }) {
  const read = useAdminRead<ResourceDraft | Resource[]>(api, resourceId ? 'resource-get' : 'resource-catalog', resourceId ? { body: { id: resourceId } } : {}, refreshVersion);
  const items = resourceId ? [] : read.data as Resource[] | undefined ?? [];
  const item = resourceId ? read.data as ResourceDraft | undefined : undefined;
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [error, setError] = useState('');
  const [operationBusy, setBusy] = useState(false);
  const busy = operationBusy || read.refreshing;
  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [inspect, setInspect] = useState<ReferenceRow | null>(null);
  const view = item ? resourceViews[item.resource_key] : undefined;
  const table = useMemo(() => item ? referenceTable(item.resource_key, item.payload) : { columns: [], rows: [] }, [item]);
  const queryText = query.trim().toLocaleLowerCase('th');
  const selected = referenceCatalogGroups(items, queryText, group);
  const resourceCount = selected.reduce((count, category) => count + category.resources.length, 0);
  useEffect(() => {
    setError(''); setQuery(''); setInspect(null); setHistory(null);
  }, [api, resourceId]);
  useEffect(() => { setMapExpanded(Boolean(queryText) || group === 'maps'); }, [queryText, group]);
  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setError(''); setBusy(true);
    try { await operation(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'ดำเนินการไม่สำเร็จ'); } finally { setBusy(false); }
  }
  const title = item ? view?.title ?? 'ข้อมูลเดิมที่เก็บประวัติ' : 'ข้อมูลประกอบเว็บไซต์';
  const Icon = item ? resourceIcons[item.resource_key] ?? Database : Folder;
  const Heading = resourceId ? 'h1' : 'h2';
  const updated = item?.updated_at || item?.published_at;
  const updatedDate = updated && Number.isFinite(Date.parse(updated)) ? new Date(updated) : null;
  const dateTitle = item?.updated_at ? 'บันทึกล่าสุด' : 'เผยแพร่เมื่อ';
  const districtCount = view?.view === 'areas' ? new Set(table.rows.map(row => row.cells[0])).size : null;
  return <section className={`cms-reference${!resourceId ? ' is-catalog' : ' is-detail'}`} aria-labelledby="cms-reference-title" aria-busy={busy}>
    {resourceId && <div className="cms-context-bar cms-reference-context"><nav aria-label="เส้นทางหน้าผู้ดูแล"><a href="/admin" onClick={event => { event.preventDefault(); onNavigate('/admin'); }}><ArrowLeft size={15} aria-hidden="true" />จัดการข้อมูล</a><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{title}</span></nav>
      <button className="icon-button" disabled={busy} aria-busy={read.refreshing} aria-label="โหลดข้อมูลประกอบใหม่" title="โหลดข้อมูลประกอบใหม่" onClick={() => { setError(''); read.reload(); }}><RefreshCw size={16} /></button></div>}
    <div className="cms-list-heading"><div className="cms-section-heading"><span className="cms-section-icon"><Icon size={resourceId ? 28 : 23} aria-hidden="true" /></span><div><Heading id="cms-reference-title">{title}</Heading>
      <p className="cms-help">{item ? view?.description ?? 'ข้อมูลชุดนี้ไม่ได้อยู่ในรายการใช้งานปัจจุบัน ต้นฉบับและประวัติยังคงอยู่'
        : 'รายชื่อพื้นที่และขอบเขตแผนที่ที่ใช้แสดงข้อมูลพยากรณ์ เลือกเปิดเพื่อดูรายละเอียด'}</p>
      {item && !view && <p className="cms-help">รุ่นแก้ไข {item.revision} · {item.state === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง ยังไม่เปลี่ยนเว็บไซต์'}</p>}</div></div>
      {!resourceId && <div className="cms-actions">
        <button className="icon-button" disabled={busy} aria-busy={read.refreshing} aria-label="โหลดข้อมูลประกอบใหม่" title="โหลดข้อมูลประกอบใหม่" onClick={() => { setError(''); read.reload(); }}><RefreshCw size={16} /></button></div>}</div>
    {(error || read.error) && <p role="alert" className="cms-error">{error || read.error}{read.error && read.data ? ' · กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า' : ''}</p>}
    {read.loading ? <p role="status">กำลังโหลดข้อมูลประกอบ</p> : read.error && !read.data ? null : <>
      {!item ? <>
        <div className="cms-filter-row cms-reference-filters"><label className="cms-search"><Search size={18} /><input aria-label="ค้นหาข้อมูลประกอบ" value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาหมวดหรือชื่อข้อมูล" /></label>
          <AppSelect ariaLabel="หมวดข้อมูล" value={group} onChange={setGroup} options={[{ value: 'all', label: 'ทุกหมวด' }, ...resourceGroups.map(category => ({ value: category.id, label: category.title }))]} /></div>
        <div className="cms-resource-list is-grouped" id="cms-resource-list">{selected.map(category => {
          const Icon = groupIcons[category.id];
          const resource = category.resources[0];
          const hasDraft = category.resources.some(value => value.draft_id);
          return <article className="cms-resource-group" data-group={category.id} key={category.id}>
            <div className="cms-resource-row"><span className="cms-resource-icon"><Icon size={25} strokeWidth={2} aria-hidden="true" /></span><div className="cms-resource-copy"><h3>{category.title}</h3><p>{category.description}</p>
              <small><BookOpen size={12} aria-hidden="true" />{category.id === 'maps' ? `${category.resources.length} ชั้นข้อมูล` : 'รายชื่ออำเภอและตำบล'}{hasDraft ? ' · มีฉบับร่างที่บันทึกไว้' : ''}</small></div>
              {category.id === 'maps' ? <button className="secondary-button" disabled={busy} aria-expanded={mapExpanded} aria-controls="cms-map-resource-list" onClick={() => setMapExpanded(value => !value)}>
                {mapExpanded ? 'ย่อชั้นข้อมูล' : 'ดูชั้นข้อมูล'}{mapExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                : <button className="secondary-button" disabled={busy} onClick={() => onNavigate(`/admin?resource=${resource.draft_id ?? resource.id}`)}>เปิดข้อมูล<ArrowRight size={16} /></button>}
            </div>
            {category.id === 'maps' && <div className="cms-map-resource-list" id="cms-map-resource-list" hidden={!mapExpanded}>
              {category.resources.map(mapResource => <div className="cms-map-resource" key={mapResource.id}><div><h4>{resourceViews[mapResource.resource_key].title}</h4><p>{resourceViews[mapResource.resource_key].description}</p>
                {mapResource.draft_id && <small>มีฉบับร่างที่บันทึกไว้</small>}</div><button className="secondary-button" disabled={busy} onClick={() => onNavigate(`/admin?resource=${mapResource.draft_id ?? mapResource.id}`)}>เปิดข้อมูล<ArrowRight size={16} /></button></div>)}
            </div>}
          </article>;
        })}</div>
        {selected.length > 0 && <div className="cms-resource-footer"><span>{selected.length} หมวด · {resourceCount} ชุดข้อมูล{queryText || group !== 'all' ? 'ตามตัวกรอง' : 'พร้อมตรวจสอบ'}</span></div>}
        {!selected.length && <WorkspaceEmptyState className="cms-empty" title={query || group !== 'all' ? 'ไม่พบข้อมูลตามคำค้น' : 'ยังไม่มีข้อมูลประกอบพร้อมใช้งาน'}
          action={query || group !== 'all' ? <button className="secondary-button" onClick={() => { setQuery(''); setGroup('all'); }}>ล้างตัวกรอง</button> : undefined} />}
      </> : <>
        {view && <>
          <MetricGrid className="cms-resource-metrics" ariaLabel="สรุปข้อมูลชุดนี้" metrics={[
            { value: table.rows.length.toLocaleString('th-TH'), label: districtCount !== null ? `ตำบลใน ${districtCount} อำเภอ` : 'รายการทั้งหมด', icon: <FileText size={23} />, className: 'cms-resource-total-metric' },
            { value: `รุ่นแก้ไข ${item.revision}`, label: <span className={`cms-resource-state ${item.state === 'published' ? 'is-published' : 'is-draft'}`}><span aria-hidden="true" />{item.state === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}</span>, icon: <Database size={23} /> },
            ...(districtCount !== null ? [{ value: districtCount, label: 'อำเภอในชุดข้อมูล', icon: <MapPin size={23} />, className: 'cms-resource-secondary-metric cms-resource-area-metric' }] : []),
            ...(updatedDate ? [{ value: updatedDate.toLocaleDateString('th-TH', { dateStyle: 'medium' }), label: dateTitle, detail: `เวลา ${updatedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`, icon: <Clock size={23} />, className: 'cms-resource-secondary-metric cms-resource-date-metric' }] : []),
          ]} />
          <ReferenceRecords key={item.id} columns={table.columns} rows={table.rows} title={title} areas={view.view === 'areas'} busy={busy} revision={item.revision}
            actionLabel="ดูรายละเอียด" onOpen={setInspect} />
        </>}
        <details className="cms-technical cms-resource-history"><summary><History size={19} aria-hidden="true" /><span>ประวัติและไฟล์ต้นฉบับ<small>ตรวจสอบการแก้ไขหรือดาวน์โหลดข้อมูลชุดเต็ม</small></span></summary>
          {updatedDate && <p className="cms-help">{dateTitle} {updatedDate.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
          {view && <p className="cms-help">ข้อมูลชุดนี้เปิดดูและดาวน์โหลดได้ การเปลี่ยนรหัสหรือขอบเขตพื้นที่ต้องตรวจความสัมพันธ์กับข้อมูลพยากรณ์ก่อน</p>}
          <div className="cms-actions"><button className="secondary-button" onClick={() => downloadResource(item)}><Download size={16} />ดาวน์โหลดไฟล์ข้อมูล (JSON)</button>
          <button className="secondary-button" disabled={busy} onClick={() => void run(async () => setHistory(await api<AuditEntry[]>('resource-history', { body: { id: item.id } })))}><History size={16} />ประวัติการแก้ไข</button></div></details>
      </>}
    </>}
    {inspect && item && <ReferenceRecordDialog title={title} view={view} columns={table.columns} row={inspect} revision={item.revision} state={item.state} onClose={() => setInspect(null)} />}
    {history && <WorkspaceDialog title="ประวัติข้อมูลอ้างอิง" bounded onClose={() => setHistory(null)} closeLabel="ปิดประวัติ"><div className="cms-audit">{history.map(entry => <article key={entry.id}><strong>รุ่น {entry.revision} · {entry.action === 'publish' ? 'เผยแพร่' : entry.action === 'edit' ? 'แก้ไข' : 'สร้างฉบับร่าง'}</strong><p>{entry.reason}</p><time>{new Date(entry.occurred_at).toLocaleString('th-TH')}</time></article>)}</div></WorkspaceDialog>}
  </section>;
}
