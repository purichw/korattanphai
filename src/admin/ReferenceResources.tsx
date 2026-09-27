import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Download, History, LockKeyhole, Pencil, RefreshCw, Search } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { WorkspaceEmptyState } from '../components/WorkspaceEmptyState';
import { createAdminClient } from './client';
import type { Json, AuditEntry } from './types';
import { lockedResourceField } from '../../shared/resourceEditPolicy.mjs';
import { useUnsavedChanges } from './useUnsavedChanges';
import { ConfirmAction } from './ConfirmAction';

type Resource = { id: string; resource_key: string; title: string; resource_group: string; published_at: string; draft_id?: string | null };
type ResourceDraft = Resource & { payload: Json; revision: number; state: 'draft' | 'published' };
type Leaf = { path: (string | number)[]; value: Json; locked: boolean };
const groupNames: Record<string, string> = { reference: 'ทะเบียนและข้อมูลประกอบ', retained: 'ข้อมูลเดิมที่พักไว้', derived: 'ข้อมูลคำนวณ', geometry: 'ขอบเขตแผนที่' };
function leaves(value: Json, path: (string | number)[] = [], locked = false): Leaf[] {
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, [...path, Array.isArray(value) ? Number(key) : key], locked || lockedResourceField(key)));
  return [{ value, path, locked: locked || value === null }];
}
function setLeaf(value: Json, path: (string | number)[], next: Json): Json {
  if (!path.length) return next;
  const [key, ...rest] = path;
  if (Array.isArray(value)) return value.map((item, index) => index === key ? setLeaf(item, rest, next) : item);
  const record = value as Record<string, Json>;
  return { ...record, [key]: setLeaf(record[key], rest, next) };
}
function downloadResource(item: ResourceDraft) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(item.payload, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${item.resource_key.split('/').pop()}_r${item.revision}.json`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReferenceResources({ api, resourceId, onNavigate }: { api: ReturnType<typeof createAdminClient>; resourceId: string | null; onNavigate: (url: string) => void }) {
  const [items, setItems] = useState<Resource[]>([]);
  const [item, setItem] = useState<ResourceDraft | null>(null);
  const [payload, setPayload] = useState<Json>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [group, setGroup] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [publish, setPublish] = useState(false);
  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState('');
  const [discard, setDiscard] = useState(false);
  const dirty = item && JSON.stringify(item.payload) !== JSON.stringify(payload);
  useUnsavedChanges(Boolean(dirty), setError);
  const allLeaves = useMemo(() => leaves(payload), [payload]);
  const filteredLeaves = allLeaves.filter(leaf => `${leaf.path.join(' / ')} ${leaf.value}`.toLocaleLowerCase('th').includes(query.toLocaleLowerCase('th')));
  const selected = items.filter(value => (group === 'all' || group === value.resource_group) && `${value.title} ${value.resource_key}`.toLocaleLowerCase('th').includes(query.toLocaleLowerCase('th')));
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError(''); setItem(null); setReason('');
    const load = resourceId ? api<ResourceDraft>('resource-get', { body: { id: resourceId }, signal: controller.signal }).then(value => { setItem(value); setPayload(value.payload); })
      : api<Resource[]>('resource-catalog', { signal: controller.signal }).then(setItems);
    void load.catch(failure => { if (!controller.signal.aborted) setError(failure.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [api, resourceId, retry]);
  useEffect(() => { setPage(0); }, [query, group, resourceId]);
  async function run(operation: () => Promise<void>) {
    setError(''); setBusy(true); setNotice('');
    try { await operation(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'ดำเนินการไม่สำเร็จ'); } finally { setBusy(false); }
  }
  return <section className="cms-reference" aria-labelledby="cms-reference-title">
    <div className="cms-list-heading"><div><h2 id="cms-reference-title">{item?.title ?? 'ทะเบียนและข้อมูลประกอบเว็บไซต์'}</h2>
      {item && <p>{groupNames[item.resource_group]} · รุ่นแก้ไข {item.revision} · {item.state === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}</p>}</div>
      <div className="cms-actions">{item && <><button className="secondary-button" disabled={Boolean(dirty) || busy} onClick={() => { setQuery(''); onNavigate('/admin'); }}><ArrowLeft size={16} />ทะเบียน</button>
        <button className="secondary-button" onClick={() => downloadResource(item)}><Download size={16} />JSON</button>
        <button className="icon-button" aria-label="ประวัติทะเบียน" title="ประวัติทะเบียน" onClick={() => void run(async () => setHistory(await api<AuditEntry[]>('resource-history', { body: { id: item.id } })))}><History size={16} /></button></>}
        <button className="icon-button" disabled={Boolean(dirty) || busy} aria-label="โหลดทะเบียนใหม่" title="โหลดทะเบียนใหม่" onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} /></button></div></div>
    {error && <p role="alert" className="cms-error">{error}</p>}{notice && <p role="status" className="cms-notice">{notice}</p>}
    {!item && !items.length ? <p role="status">{busy ? 'กำลังโหลดทะเบียน' : error ? 'ยังโหลดทะเบียนไม่ได้' : 'ยังไม่ได้นำทะเบียนเดิมเข้า CMS'}</p> : <>
      <div className="cms-filter-row"><label className="cms-search"><Search size={18} /><input aria-label="ค้นหาทะเบียนหรือ field" value={query} onChange={event => setQuery(event.target.value)} placeholder={item ? 'ค้นหา field หรือค่า' : 'ค้นหาทะเบียน'} /></label>
        {!item && <AppSelect ariaLabel="ประเภททะเบียน" value={group} onChange={setGroup} options={[{ value: 'all', label: 'ทุกประเภท' }, ...Object.entries(groupNames).map(([value, label]) => ({ value, label }))]} />}</div>
      <div className="cms-table-scroll is-records"><table className="cms-table"><thead><tr>{item ? <><th>Field</th><th>ค่า</th></> : <><th>ทะเบียน</th><th>ประเภท</th><th>เปิด</th></>}</tr></thead>
        <tbody>{item ? filteredLeaves.slice(page * 30, page * 30 + 30).map(leaf => <tr key={JSON.stringify(leaf.path)}><th scope="row" className="cms-reference-path">{leaf.path.join(' / ')}</th><td>
          {leaf.locked || item.resource_group !== 'reference' || item.state === 'published' ? <span className="cms-reference-value"><LockKeyhole size={14} aria-label="อ่านอย่างเดียว" />{leaf.value === null ? 'ไม่มีค่า (null)' : String(leaf.value)}</span>
            : typeof leaf.value === 'boolean' ? <input type="checkbox" aria-label={leaf.path.join(' / ')} checked={leaf.value} disabled={busy} onChange={event => setPayload(value => setLeaf(value, leaf.path, event.target.checked))} />
            : <input aria-label={leaf.path.join(' / ')} value={String(leaf.value)} disabled={busy} type={typeof leaf.value === 'number' ? 'number' : 'text'} step="any"
              onChange={event => { const value = typeof leaf.value === 'number' ? Number(event.target.value) : event.target.value; if (typeof value !== 'number' || Number.isFinite(value)) setPayload(previous => setLeaf(previous, leaf.path, value)); }} />}</td></tr>)
          : selected.slice(page * 30, page * 30 + 30).map(resource => <tr key={resource.id}><td>{resource.title}<small>{resource.resource_key}</small></td><td>{groupNames[resource.resource_group]}</td>
            <td><button className="secondary-button" disabled={busy} onClick={() => void run(async () => {
              const id = resource.draft_id ?? (resource.resource_group === 'reference' ? (await api<ResourceDraft>('resource-clone', { body: { key: resource.resource_key } })).id : resource.id);
              setQuery(''); onNavigate(`/admin?resource=${id}`);
            })}><Pencil size={16} />ตรวจข้อมูล</button>{resource.draft_id && <small>มีฉบับร่าง</small>}</td></tr>)}</tbody></table></div>
      {!(item ? filteredLeaves.length : selected.length) && <WorkspaceEmptyState className="cms-empty" title="ไม่พบข้อมูลตามตัวกรอง"
        action={<button className="secondary-button" onClick={() => { setQuery(''); setGroup('all'); }}><RefreshCw size={16} />ล้างตัวกรอง</button>} />}
      {(item ? filteredLeaves.length : selected.length) > 30 && <div className="cms-pagination"><button className="icon-button" aria-label="ทะเบียนหน้าก่อน" disabled={page === 0} onClick={() => setPage(value => value - 1)}><ArrowLeft size={16} /></button><span>หน้า {page + 1} / {Math.ceil((item ? filteredLeaves.length : selected.length) / 30)}</span>
        <button className="icon-button" aria-label="ทะเบียนหน้าถัดไป" disabled={(page + 1) * 30 >= (item ? filteredLeaves.length : selected.length)} onClick={() => setPage(value => value + 1)}><ArrowRight size={16} /></button></div>}
    </>}
    {item?.state === 'draft' && item.resource_group === 'reference' && <div className="cms-reference-save"><label className="cms-field">เหตุผลการแก้ไขทะเบียน<textarea aria-label="เหตุผลการแก้ไขทะเบียน" value={reason} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
      <div className="cms-actions"><button className="secondary-button" disabled={busy || !dirty} onClick={() => setDiscard(true)}>ยกเลิกการแก้ไขทะเบียน</button><button className="secondary-button" disabled={busy || !dirty || !reason.trim()} onClick={() => void run(async () => {
        const saved = await api<ResourceDraft>('resource-edit', { body: { id: item.id, revision: item.revision, payload, reason } }); setItem(saved); setPayload(saved.payload); setReason(''); setNotice('บันทึกทะเบียนฉบับร่างแล้ว');
      })}>บันทึกทะเบียนฉบับร่าง</button><button className="primary-button" disabled={busy || Boolean(dirty)} onClick={() => setPublish(true)}><CheckCircle2 size={16} />เผยแพร่ทะเบียน</button></div></div>}
    {publish && item && <WorkspaceDialog title="ยืนยันเผยแพร่ทะเบียน" onClose={() => { if (!busy) setPublish(false); }} closeLabel="ปิดการยืนยันทะเบียน"><div className="cms-form"><p>{item.title} · รุ่นแก้ไข {item.revision}</p>
      <p>หน้าเว็บไซต์ที่เปิดใหม่จะใช้ทะเบียนรุ่นนี้ รุ่นก่อนหน้ายังคงอยู่</p>{error && <p role="alert" className="cms-error">{error}</p>}
      <label className="cms-field">เหตุผลเผยแพร่ทะเบียน<textarea aria-label="เหตุผลเผยแพร่ทะเบียน" value={reason} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
      <button className="primary-button" disabled={busy || !reason.trim()} onClick={() => void run(async () => { const saved = await api<ResourceDraft>('resource-publish', { body: { id: item.id, revision: item.revision, reason } }); setItem(saved); setPublish(false); setReason(''); setNotice('เผยแพร่ทะเบียนแล้ว'); })}>ยืนยันเผยแพร่ทะเบียน</button></div></WorkspaceDialog>}
    {history && <WorkspaceDialog title="ประวัติทะเบียน" bounded onClose={() => setHistory(null)} closeLabel="ปิดประวัติทะเบียน"><div className="cms-audit">{history.map(entry => <article key={entry.id}><strong>รุ่น {entry.revision} · {entry.action}</strong><p>{entry.reason}</p><time>{new Date(entry.occurred_at).toLocaleString('th-TH')}</time></article>)}</div></WorkspaceDialog>}
    {discard && item && <ConfirmAction title="ยกเลิกการแก้ไขทะเบียน" message="กลับไปใช้ค่าฉบับร่างที่บันทึกล่าสุด" confirmLabel="ยืนยันยกเลิกการแก้ไข"
      onCancel={() => setDiscard(false)} onConfirm={() => { setPayload(item.payload); setReason(''); setError(''); setDiscard(false); }} />}
  </section>;
}
