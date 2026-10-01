import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Database, Download, Folder, History, Map, MapPin, Pencil, RefreshCw, Search } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { WorkspaceEmptyState } from '../components/WorkspaceEmptyState';
import { createAdminClient } from './client';
import type { Json, Payload, AuditEntry } from './types';
import { useUnsavedChanges } from './useUnsavedChanges';
import { ConfirmAction } from './ConfirmAction';
import { referenceCatalogGroups, referenceTable, resourceGroups, resourceViews, sourceFields } from './resourcePresentation';
import { useAdminRead } from './useAdminRead';

type Resource = { id: string; resource_key: string; title: string; resource_group: string; published_at: string; draft_id?: string | null };
type ResourceDraft = Resource & { payload: Json; revision: number; state: 'draft' | 'published' };
const groupIcons = { areas: MapPin, maps: Map, sources: Database };
function downloadResource(item: ResourceDraft) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(item.payload, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${item.resource_key.split('/').pop()}_r${item.revision}.json`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReferenceResources({ api, resourceId, onNavigate, refreshVersion = 0 }: { api: ReturnType<typeof createAdminClient>; resourceId: string | null; onNavigate: (url: string) => void; refreshVersion?: number }) {
  const read = useAdminRead<ResourceDraft | Resource[]>(api, resourceId ? 'resource-get' : 'resource-catalog', resourceId ? { body: { id: resourceId } } : {}, refreshVersion);
  const items = resourceId ? [] : read.data as Resource[] | undefined ?? [];
  const item = resourceId ? read.data as ResourceDraft | undefined : undefined;
  const setItem = read.setData;
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [group, setGroup] = useState('all');
  const [error, setError] = useState('');
  const [operationBusy, setBusy] = useState(false);
  const busy = operationBusy || read.refreshing;
  const [reason, setReason] = useState('');
  const [publish, setPublish] = useState(false);
  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [notice, setNotice] = useState('');
  const [edit, setEdit] = useState<{ index: number; value: Payload } | null>(null);
  const [discard, setDiscard] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  useUnsavedChanges(Boolean(edit) && item?.state === 'draft', setError);
  const view = item ? resourceViews[item.resource_key] : undefined;
  const table = useMemo(() => item ? referenceTable(item.resource_key, item.payload) : { columns: [], rows: [] }, [item]);
  const queryText = query.trim().toLocaleLowerCase('th');
  const selected = referenceCatalogGroups(items, queryText, group);
  const resourceCount = selected.reduce((count, category) => count + category.resources.length, 0);
  const rows = table.rows.filter(row => row.cells.join(' ').toLocaleLowerCase('th').includes(queryText));
  useEffect(() => {
    setError(''); setNotice(''); setReason(''); setQuery('');
  }, [api, resourceId]);
  useEffect(() => { setPage(0); }, [query, group, resourceId]);
  useEffect(() => { setMapExpanded(Boolean(queryText) || group === 'maps'); }, [queryText, group]);
  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setError(''); setBusy(true); setNotice('');
    try { await operation(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'ดำเนินการไม่สำเร็จ'); } finally { setBusy(false); }
  }
  const title = item ? view?.title ?? 'ข้อมูลเดิมที่เก็บประวัติ' : 'ข้อมูลประกอบเว็บไซต์';
  return <section className={`cms-reference${!resourceId ? ' is-catalog' : ''}`} aria-labelledby="cms-reference-title" aria-busy={busy}>
    <div className="cms-list-heading"><div className="cms-section-heading"><span className="cms-section-icon"><Folder size={23} aria-hidden="true" /></span><div><h2 id="cms-reference-title">{title}</h2>
      <p className="cms-help">{item ? view?.description ?? 'ข้อมูลชุดนี้ไม่ได้อยู่ในรายการใช้งานปัจจุบัน ต้นฉบับและประวัติยังคงอยู่'
        : 'ชื่อพื้นที่ ขอบเขตแผนที่ และแหล่งอ้างอิง เลือกเปิดเพื่อดูความหมายและรายละเอียด'}</p>
      {item && <p className="cms-help">รุ่นแก้ไข {item.revision} · {item.state === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง ยังไม่เปลี่ยนเว็บไซต์'}</p>}</div></div>
      <div className="cms-actions">{item && <button className="secondary-button" disabled={Boolean(edit) || busy} onClick={() => onNavigate('/admin')}><ArrowLeft size={16} />กลับหน้าจัดการข้อมูล</button>}
        <button className="icon-button" disabled={Boolean(edit) || busy} aria-busy={read.refreshing} aria-label="โหลดข้อมูลประกอบใหม่" title="โหลดข้อมูลประกอบใหม่" onClick={() => { setError(''); read.reload(); }}><RefreshCw size={16} /></button></div></div>
    {(error || read.error) && <p role="alert" className="cms-error">{error || read.error}{read.error && read.data ? ' · กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า' : ''}</p>}{notice && <p role="status" className="cms-success">{notice}</p>}
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
              <small><BookOpen size={12} aria-hidden="true" />{category.id === 'maps' ? `${category.resources.length} ชั้นข้อมูล` : category.id === 'sources' ? 'อ้างอิงประกอบ' : 'รายชื่ออำเภอและตำบล'}{hasDraft ? ' · มีฉบับร่างที่บันทึกไว้' : ''}</small></div>
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
          <div className="cms-reference-toolbar"><label className="cms-search"><Search size={18} /><input aria-label="ค้นหาในข้อมูลชุดนี้" value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาชื่อพื้นที่ หน่วยงาน หรือรหัส" /></label>
            {view.view === 'sources' && item.state === 'published' && <button className="secondary-button" disabled={busy} onClick={() => void run(async () => {
              const draft = await api<ResourceDraft>('resource-clone', { body: { key: item.resource_key } }); onNavigate(`/admin?resource=${draft.id}`);
            })}><Pencil size={16} />สร้างฉบับแก้ไข</button>}</div>
          {view.view !== 'sources' && <p className="cms-help">ข้อมูลอ้างอิงสำหรับตรวจสอบ การเปลี่ยนขอบเขตหรือรหัสพื้นที่ต้องตรวจความสัมพันธ์กับข้อมูลพยากรณ์ก่อน</p>}
          {view.view === 'sources' && <p className="cms-help">รายการนี้เป็นแหล่งอ้างอิงประกอบด้านภัยแล้งและการเกษตร ยังไม่ได้ยืนยันว่าเป็นข้อมูลนำเข้าของแบบจำลอง ค่าพยากรณ์ที่แสดงมาจากชุดข้อมูลพยากรณ์ที่เผยแพร่ในระบบ</p>}
          <div className="cms-table-scroll is-records"><table className="cms-table cms-reference-table"><thead><tr>{table.columns.map(column => <th key={column}>{column}</th>)}{view.view === 'sources' && <th>รายละเอียด</th>}</tr></thead>
            <tbody>{rows.slice(page * 20, page * 20 + 20).map(row => <tr key={row.index}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}
              {view.view === 'sources' && <td><button className="secondary-button" disabled={busy} onClick={() => { setReason(''); setEdit({ index: row.index, value: structuredClone((item.payload as Payload[])[row.index]) }); }}>
                {item.state === 'draft' ? <Pencil size={16} /> : <ArrowRight size={16} />}{item.state === 'draft' ? 'แก้ไข' : 'อ่านรายละเอียด'}</button></td>}</tr>)}</tbody></table></div>
          {!rows.length && <p role="status" className="cms-help">{query ? 'ไม่พบรายการตามคำค้น' : 'ยังไม่มีรายการที่มีข้อมูลอ้างอิงในชุดนี้'}</p>}
          {rows.length > 20 && <div className="cms-pagination"><button className="icon-button" aria-label="ข้อมูลหน้าก่อน" disabled={page === 0} onClick={() => setPage(value => value - 1)}><ArrowLeft size={16} /></button>
            <span>หน้า {page + 1} / {Math.ceil(rows.length / 20)}</span><button className="icon-button" aria-label="ข้อมูลหน้าถัดไป" disabled={(page + 1) * 20 >= rows.length} onClick={() => setPage(value => value + 1)}><ArrowRight size={16} /></button></div>}
          {view.view === 'sources' && item.state === 'draft' && <div className="cms-actions cms-reference-publish"><p className="cms-help">บันทึกการแก้ไขแต่ละรายการก่อน แล้วจึงเผยแพร่ให้เว็บไซต์ใช้</p>
            <button className="primary-button" disabled={busy || Boolean(edit)} onClick={() => { setReason(''); setPublish(true); }}><CheckCircle2 size={16} />เผยแพร่ข้อมูลอ้างอิง</button></div>}
        </>}
        <details className="cms-technical"><summary>ประวัติและไฟล์ต้นฉบับ</summary><div className="cms-actions"><button className="secondary-button" onClick={() => downloadResource(item)}><Download size={16} />ดาวน์โหลดไฟล์ข้อมูล (JSON)</button>
          <button className="secondary-button" disabled={busy} onClick={() => void run(async () => setHistory(await api<AuditEntry[]>('resource-history', { body: { id: item.id } })))}><History size={16} />ประวัติการแก้ไข</button></div></details>
      </>}
    </>}
    {edit && item && <WorkspaceDialog title={item.state === 'draft' ? 'แก้ไขแหล่งข้อมูลอ้างอิง' : 'รายละเอียดแหล่งข้อมูล'} bounded wide onClose={() => { if (!busy) item.state === 'draft' ? setDiscard(true) : setEdit(null); }} closeLabel="ปิดรายละเอียดแหล่งข้อมูล">
      <div className="cms-form">{error && <p role="alert" className="cms-error">{error}</p>}<div className="cms-field-grid">{sourceFields.filter(field => typeof edit.value[field.key] === 'string').map(field => <label className="cms-field" key={field.key}>{field.label}
        {item.state === 'published' ? <span>{String(edit.value[field.key]) || 'ไม่ระบุ'}</span> : <textarea aria-label={field.label} disabled={busy} value={String(edit.value[field.key])} onChange={event => setEdit({ ...edit, value: { ...edit.value, [field.key]: event.target.value } })} />}</label>)}</div>
        {item.state === 'draft' && <><label className="cms-field cms-reason">เหตุผลการแก้ไข<textarea aria-label="เหตุผลการแก้ไขข้อมูลอ้างอิง" maxLength={1000} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></label>
          <footer className="cms-actions"><button className="primary-button" disabled={busy || !reason.trim()} onClick={() => void run(async () => {
            const payload = (item.payload as Payload[]).map((value, index) => index === edit.index ? edit.value : value);
            const saved = await api<ResourceDraft>('resource-edit', { body: { id: item.id, revision: item.revision, payload, reason } });
            setItem(saved); setEdit(null); setReason(''); setNotice('บันทึกข้อมูลอ้างอิงฉบับร่างแล้ว');
          })}>บันทึกฉบับร่าง</button></footer></>}
      </div></WorkspaceDialog>}
    {publish && item && <WorkspaceDialog title="ยืนยันเผยแพร่ข้อมูลอ้างอิง" onClose={() => { if (!busy) setPublish(false); }} closeLabel="ปิดการยืนยัน"><div className="cms-form"><p>{title} · รุ่นแก้ไข {item.revision}</p>
      <p>หน้าเว็บไซต์ที่เปิดใหม่จะใช้ข้อมูลรุ่นนี้ รุ่นก่อนหน้ายังคงอยู่</p>{error && <p role="alert" className="cms-error">{error}</p>}
      <label className="cms-field">เหตุผลเผยแพร่<textarea aria-label="เหตุผลเผยแพร่ข้อมูลอ้างอิง" value={reason} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
      <button className="primary-button" disabled={busy || !reason.trim()} onClick={() => void run(async () => { const saved = await api<ResourceDraft>('resource-publish', { body: { id: item.id, revision: item.revision, reason } }); setItem(saved); setPublish(false); setReason(''); setNotice('เผยแพร่ข้อมูลอ้างอิงแล้ว'); })}>ยืนยันเผยแพร่ข้อมูลอ้างอิง</button></div></WorkspaceDialog>}
    {history && <WorkspaceDialog title="ประวัติข้อมูลอ้างอิง" bounded onClose={() => setHistory(null)} closeLabel="ปิดประวัติ"><div className="cms-audit">{history.map(entry => <article key={entry.id}><strong>รุ่น {entry.revision} · {entry.action === 'publish' ? 'เผยแพร่' : entry.action === 'edit' ? 'แก้ไข' : 'สร้างฉบับร่าง'}</strong><p>{entry.reason}</p><time>{new Date(entry.occurred_at).toLocaleString('th-TH')}</time></article>)}</div></WorkspaceDialog>}
    {discard && <ConfirmAction title="ยังไม่ได้บันทึกการแก้ไข" message="ปิดหน้าต่างนี้โดยใช้ข้อมูลที่บันทึกไว้ล่าสุด" confirmLabel="ปิดโดยไม่บันทึก"
      onCancel={() => setDiscard(false)} onConfirm={() => { setEdit(null); setReason(''); setDiscard(false); }} />}
  </section>;
}
