import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Database, Download, FileUp, History, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { MonthSelect } from '../components/MonthSelect';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { WorkspaceEmptyState } from '../components/WorkspaceEmptyState';
import { Skeleton } from '../components/nakhon-ratchasima/ForecastLoadingPrimitives';
import { createAdminClient } from './client';
import { AdminImport } from './AdminImport';
import { ReferenceResources } from './ReferenceResources';
import { ConfirmAction } from './ConfirmAction';
import { useUnsavedChanges } from './useUnsavedChanges';
import { DataRecordForm, MetadataForm } from './DataRecordForm';
import { kindLabels, rowsKey, type Draft, type DraftSummary, type Payload, type ValidationReport, type AuditEntry } from './types';
import { DATA_FIELDS } from '../../shared/dataFields.mjs';
import './admin.css';

function download(bytes: BlobPart, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const errorText = (error: unknown) => error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ';
const dateLabel = (value: string) => new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminWorkspace({ userId, draftId, onNavigate }: { userId: string; draftId: string | null; onNavigate: (url: string) => void }) {
  const api = useMemo(() => createAdminClient(userId), [userId]);
  const [items, setItems] = useState<DraftSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setDraft(null);
    const load = draftId ? api<Draft>('get', { id: draftId, signal: controller.signal }).then(setDraft)
      : api<{ items: DraftSummary[]; total: number }>('list', { offset, signal: controller.signal }).then(result => { setItems(result.items); setTotal(result.total); });
    void load.catch(failure => { if (!controller.signal.aborted) setError(errorText(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, draftId, offset, generation]);
  const openDraft = (next: Draft) => { setImportOpen(false); onNavigate(`/admin?draft=${encodeURIComponent(next.id)}`); };
  return <section className="cms-workspace" aria-labelledby="cms-title">
    <header className="cms-page-header"><div><p className="eyebrow">จัดการข้อมูล · นครราชสีมา</p><h1 id="cms-title">{draft?.title ?? 'ชุดข้อมูล'}</h1>
      {draft && <p>{kindLabels[draft.kind]} · รุ่นแก้ไข {draft.revision} · {draft.state === 'accepted' ? 'รับเข้าระบบแล้ว' : 'ฉบับร่าง'}</p>}</div>
      <div className="cms-actions">{draftId ? <button className="secondary-button" onClick={() => onNavigate('/admin')}><ArrowLeft size={18} />ชุดข้อมูล</button>
        : <button className="primary-button" onClick={() => setImportOpen(true)} disabled={loading || Boolean(error)}><FileUp size={18} />นำเข้าข้อมูล</button>}
        <button type="button" className="icon-button" title="โหลดฉบับล่าสุด" aria-label="โหลดฉบับล่าสุด" disabled={loading}
          onClick={() => setGeneration(value => value + 1)}><RefreshCw size={18} /></button></div>
    </header>
    {loading ? <div className="cms-loading" role="status" aria-label="กำลังโหลดชุดข้อมูล"><Skeleton /><Skeleton /><Skeleton /></div>
      : error ? <WorkspaceEmptyState className="cms-empty" role="alert" heading="h2" icon={Database} title="ยังเปิดชุดข้อมูลไม่ได้" description={error}
        action={<button className="secondary-button" onClick={() => setGeneration(value => value + 1)}><RefreshCw size={16} />ลองใหม่</button>} />
      : draft ? <DraftEditor key={draft.id} draft={draft} api={api} onSaved={setDraft} />
      : <>
        <PublishedForecasts api={api} onCreated={openDraft} />
        <ReferenceResources api={api} resourceId={new URLSearchParams(window.location.search).get('resource')} onNavigate={onNavigate} />
        <div className="cms-list-heading"><h2>รายการนำเข้า</h2><span>{total.toLocaleString('th-TH')} ชุดข้อมูล</span></div>
        {!items.length ? <WorkspaceEmptyState className="cms-empty" heading="h2" icon={Database} title="ยังไม่มีรายการนำเข้า"
          action={<button className="secondary-button" onClick={() => setImportOpen(true)}><FileUp size={16} />นำเข้าข้อมูล</button>} />
          : <div className="cms-table-scroll"><table className="cms-table"><thead><tr><th>ชุดข้อมูล</th><th>ประเภท</th><th>สถานะ</th><th>แก้ไขล่าสุด</th><th><span className="sr-only">เปิด</span></th></tr></thead>
            <tbody>{items.map(item => <tr key={item.id}><td><button className="cms-text-button" onClick={() => onNavigate(`/admin?draft=${item.id}`)}>{item.title}</button><small>{item.source_filename}</small></td>
              <td>{kindLabels[item.kind]}</td><td><span className={`cms-status ${item.state}`}>{item.state === 'accepted' ? (item.kind === 'archive' ? 'เผยแพร่แล้ว' : 'รับเข้าระบบแล้ว') : 'ฉบับร่าง'}</span></td>
              <td>{dateLabel(item.updated_at)}<small>รุ่นแก้ไข {item.revision}</small></td><td><button className="icon-button" title={`เปิด ${item.title}`} aria-label={`เปิด ${item.title}`}
                onClick={() => onNavigate(`/admin?draft=${item.id}`)}><ArrowRight size={18} /></button></td></tr>)}</tbody></table></div>}
        {total > 50 && <div className="cms-pagination"><button className="icon-button" aria-label="หน้าก่อน" disabled={offset === 0} onClick={() => setOffset(value => value - 50)}><ArrowLeft size={18} /></button>
          <span>{offset + 1}–{Math.min(total, offset + 50)} / {total}</span><button className="icon-button" aria-label="หน้าถัดไป" disabled={offset + 50 >= total} onClick={() => setOffset(value => value + 50)}><ArrowRight size={18} /></button></div>}
      </>}
    {importOpen && <AdminImport api={api} onClose={() => setImportOpen(false)} onCreated={openDraft} />}
  </section>;
}

function PublishedForecasts({ api, onCreated }: { api: ReturnType<typeof createAdminClient>; onCreated: (draft: Draft) => void }) {
  const [catalog, setCatalog] = useState<{ revision: { datasetId: string; datasetVersion: string } | null; periods: string[] } | null>(null);
  const [period, setPeriod] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const request = new AbortController(); setError('');
    void api<NonNullable<typeof catalog>>('forecast-catalog', { signal: request.signal }).then(value => { setCatalog(value); setPeriod(value.periods[0] ?? ''); })
      .catch(failure => { if (!request.signal.aborted) setError(errorText(failure)); });
    return () => request.abort();
  }, [api, retry]);
  return <section className="cms-published" aria-labelledby="cms-published-title"><div><h2 id="cms-published-title">พยากรณ์ที่แสดงบนเว็บไซต์</h2>
    {error ? <p className="cms-error" role="alert">{error}<button className="cms-text-button" onClick={() => setRetry(value => value + 1)}>ลองใหม่</button></p>
      : !catalog ? <Skeleton /> : !catalog.revision ? <p>ยังไม่มีชุดพยากรณ์ที่เผยแพร่</p>
      : <p>{catalog.revision.datasetVersion} · {catalog.periods.length} เดือนตั้งต้น</p>}</div>
    {catalog?.revision && <div className="cms-actions"><MonthSelect ariaLabel="เดือนตั้งต้นที่จะตรวจแก้" value={period}
      options={catalog.periods.map(value => ({ value, label: new Date(`${value}-01T12:00:00`).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }) }))} onChange={setPeriod} />
      <button className="secondary-button" disabled={busy || !period} onClick={() => {
        setBusy(true); setError(''); void api<Draft>('clone-forecast', { body: { datasetId: catalog.revision!.datasetId, originMonth: period } })
          .then(onCreated).catch(failure => setError(errorText(failure))).finally(() => setBusy(false));
      }}><Pencil size={16} />{busy ? 'กำลังสร้างฉบับร่าง' : 'ตรวจแก้รอบนี้'}</button></div>}
  </section>;
}

function DraftEditor({ draft, api, onSaved }: { draft: Draft; api: ReturnType<typeof createAdminClient>; onSaved: (draft: Draft) => void }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('all');
  const [page, setPage] = useState(0);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ index: number | null; value: Payload; metadata?: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [notice, setNotice] = useState('');
  const [pendingAction, setPendingAction] = useState<'discard' | 'remove' | null>(null);
  useUnsavedChanges(Boolean(edit), setError);
  const rowKey = rowsKey(draft.kind);
  const rows = draft.payload[rowKey] as Payload[];
  const issueRows = new Set(report?.issues.flatMap(issue => issue.row == null ? [] : [issue.row]) ?? []);
  const filtered = rows.map((value, index) => ({ value, index })).filter(({ value, index }) => (mode !== 'issues' || issueRows.has(index + 1))
    && JSON.stringify(value).toLocaleLowerCase('th').includes(query.trim().toLocaleLowerCase('th')));
  const fields = DATA_FIELDS[draft.kind].filter(field => ['stationId', 'subdistrictCode', 'observedAt', 'period', 'cropCode', 'horizonMonths', 'targetMonth', 'metric', 'value', 'unit', 'quality', 'riskCode', 'status'].includes(field.key));
  useEffect(() => { setPage(0); }, [query, mode, draft.revision]);
  const closeEdit = () => { if (!busy) setPendingAction('discard'); };
  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await operation(); } catch (failure) { setError(errorText(failure)); } finally { setBusy(false); }
  }
  async function saveEdit() {
    if (!edit) return;
    const nextRows = edit.metadata ? rows : edit.index === null ? [...rows, edit.value] : rows.map((row, index) => index === edit.index ? edit.value : row);
    const payload = edit.metadata ? { ...edit.value, [rowKey]: rows } : { ...draft.payload, [rowKey]: nextRows };
    const saved = await api<Draft>('edit', { id: draft.id, body: { revision: draft.revision, reason, payload } });
    onSaved(saved); setReport(null); setEdit(null); setNotice('บันทึกฉบับร่างแล้ว');
  }
  async function removeRow() {
    if (!edit || edit.index === null || edit.metadata || rows.length <= 1) return;
    const payload = { ...draft.payload, [rowKey]: rows.filter((_, index) => index !== edit.index) };
    const saved = await api<Draft>('edit', { id: draft.id, body: { revision: draft.revision, reason, payload } });
    onSaved(saved); setReport(null); setEdit(null); setNotice('นำรายการออกจากฉบับร่างแล้ว ต้นฉบับยังอยู่ในประวัติ');
  }
  return <div className="cms-editor">
    <div className="cms-draft-strip"><span>{draft.source_filename || 'ข้อมูลจากฟอร์ม'} · {rows.length.toLocaleString('th-TH')} รายการ</span>
      <div className="cms-actions"><button className="secondary-button" disabled={busy} onClick={() => { void run(async () => {
        const { createAdminWorkbook } = await import('./workbook'); const bytes = await createAdminWorkbook(draft.kind, draft.payload);
        download(new Uint8Array(bytes).buffer, `Korat_${draft.kind}_r${draft.revision}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }); }}><Download size={16} />Excel</button>
        <button className="secondary-button" disabled={busy} onClick={() => download(JSON.stringify(draft.payload, null, 2), `Korat_${draft.kind}_r${draft.revision}.json`, 'application/json')}><Download size={16} />JSON</button>
        <button className="icon-button" title="ประวัติการแก้ไข" aria-label="ประวัติการแก้ไข" disabled={busy} onClick={() => { void run(async () => setAudit(await api<AuditEntry[]>('audit', { id: draft.id }))); }}><History size={18} /></button></div>
    </div>
    {error && <p className="cms-error" role="alert">{error}</p>}{notice && <p className="cms-success" role="status"><CheckCircle2 size={18} />{notice}</p>}
    <div className="cms-validation-bar"><div>{report ? <><strong>{report.valid ? 'ผ่านการตรวจรูปแบบข้อมูล' : `พบ ${report.issues.length} จุดที่ต้องตรวจสอบ`}</strong>
      <span>รุ่นแก้ไข {report.revision}</span></> : <strong>รอตรวจรูปแบบและความครบถ้วน</strong>}</div>
      <button className="secondary-button" disabled={busy} onClick={() => { void run(async () => setReport(await api<ValidationReport>('validate', { id: draft.id, body: { revision: draft.revision } }))); }}><ShieldCheck size={18} />ตรวจข้อมูล</button>
    </div>
    {report && !report.valid && <details className="cms-issues" open><summary>รายละเอียดที่ต้องแก้ไข</summary><ul>{report.issues.slice(0, 100).map((issue, index) => <li key={index}>
      {issue.row != null && <button className="cms-text-button" disabled={busy || draft.state === 'accepted'} onClick={() => { setReason(''); setEdit({ index: issue.row! - 1, value: structuredClone(rows[issue.row! - 1]) }); }}>แถว {issue.row}</button>}
      <span>{issue.message}</span></li>)}</ul>{report.issues.length > 100 && <p>แสดง 100 จาก {report.issues.length} จุด</p>}</details>}
    <div className="cms-filter-row"><label className="cms-search"><Search size={18} /><input aria-label="ค้นหารายการข้อมูล" placeholder="รหัสพื้นที่ สถานี เดือน หรือตัวแปร" value={query} onChange={event => setQuery(event.target.value)} />
      {query && <button className="icon-button" aria-label="ล้างคำค้น" onClick={() => setQuery('')}><X size={16} /></button>}</label>
      <AppSelect ariaLabel="กรองปัญหาข้อมูล" value={mode} options={[{ value: 'all', label: 'ทุกรายการ' }, { value: 'issues', label: 'รายการที่ต้องแก้ไข', disabled: !report }]}
        onChange={setMode} /><button className="secondary-button" disabled={busy || draft.state === 'accepted' || draft.kind === 'archive'} onClick={() => { setReason(''); setEdit({ index: null, value: structuredClone(draft.payload), metadata: true }); }}><Pencil size={16} />รายละเอียดชุดข้อมูล</button>
    </div>
    <div className="cms-result-count"><span>{filtered.length.toLocaleString('th-TH')} / {rows.length.toLocaleString('th-TH')} รายการ</span>
      <button className="secondary-button" disabled={busy || rows.length >= 2000 || draft.state === 'accepted' || draft.kind === 'archive'} onClick={() => { setReason(''); setEdit({ index: null, value: {} }); }}><Plus size={16} />เพิ่มรายการ</button></div>
    {filtered.length ? <div className="cms-table-scroll is-records"><table className="cms-table"><thead><tr><th>แถว</th>{fields.map(field => <th key={field.key}>{field.label}</th>)}<th>แก้ไข</th></tr></thead>
      <tbody>{filtered.slice(page * 25, page * 25 + 25).map(({ value, index }) => <tr key={index} className={issueRows.has(index + 1) ? 'has-issue' : ''}><td>{index + 1}</td>
        {fields.map(field => <td key={field.key}>{value[field.key] === null ? <span className="cms-null">ไม่มีค่า</span> : value[field.key] === undefined ? <span className="cms-null">ไม่ระบุ</span> : String(value[field.key])}</td>)}
        <td><button className="icon-button" title={`แก้ไขแถว ${index + 1}`} aria-label={`แก้ไขแถว ${index + 1}`} disabled={busy || draft.state === 'accepted'}
          onClick={() => { setReason(''); setEdit({ index, value: structuredClone(value) }); }}><Pencil size={16} /></button></td></tr>)}</tbody></table></div>
      : <WorkspaceEmptyState className="cms-empty" heading="h2" title="ไม่พบรายการตามตัวกรอง"
        action={<button className="secondary-button" onClick={() => { setQuery(''); setMode('all'); }}><RefreshCw size={16} />ล้างตัวกรอง</button>} />}
    {filtered.length > 25 && <div className="cms-pagination"><button className="icon-button" aria-label="รายการหน้าก่อน" disabled={page === 0} onClick={() => setPage(value => value - 1)}><ArrowLeft size={18} /></button>
      <span>หน้า {page + 1} / {Math.ceil(filtered.length / 25)}</span><button className="icon-button" aria-label="รายการหน้าถัดไป" disabled={(page + 1) * 25 >= filtered.length} onClick={() => setPage(value => value + 1)}><ArrowRight size={18} /></button></div>}
    <footer className="cms-editor-footer"><button className="cms-text-button" disabled={busy} onClick={() => { void run(async () => {
      const result = await api<{ payload: Payload }>('original', { id: draft.id });
      download(JSON.stringify(result.payload, null, 2), `Korat_original_${draft.id}.json`, 'application/json');
    }); }}><Download size={16} />ข้อมูลก่อนแก้ไข</button>
      {draft.kind !== 'forecast' && draft.state === 'draft' && <button className="primary-button" disabled={busy || !report?.valid || report.revision !== draft.revision}
        onClick={() => { setReason(''); setConfirmAccept(true); }}><CheckCircle2 size={18} />{draft.kind === 'archive' ? 'เผยแพร่รุ่นใหม่' : 'ยืนยันรับเข้าระบบ'}</button>}
    </footer>
    {edit && <WorkspaceDialog title={edit.metadata ? 'รายละเอียดชุดข้อมูล' : edit.index === null ? 'เพิ่มรายการ' : `แก้ไขแถว ${edit.index + 1}`} wide bounded onClose={closeEdit} closeLabel="ปิดการแก้ไข">
      <div className="cms-form" aria-busy={busy}>{error && <p className="cms-error" role="alert">{error}</p>}
        <fieldset disabled={busy}>{edit.metadata ? <MetadataForm value={edit.value} onChange={value => setEdit({ ...edit, value })} />
          : <DataRecordForm kind={draft.kind} value={edit.value} onChange={value => setEdit({ ...edit, value })} />}
          <label className="cms-field cms-reason">เหตุผลการแก้ไข<textarea aria-label="เหตุผลการแก้ไข" required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label></fieldset>
        <footer className="cms-actions">{edit.index !== null && !edit.metadata && draft.kind !== 'archive' && <button className="secondary-button" disabled={busy || !reason.trim() || rows.length <= 1}
          onClick={() => setPendingAction('remove')}><Trash2 size={16} />นำรายการออก</button>}
          <button className="secondary-button" disabled={busy} onClick={closeEdit}>ยกเลิก</button><button className="primary-button" disabled={busy || !reason.trim()} onClick={() => { void run(saveEdit); }}>{busy ? 'กำลังบันทึก' : 'บันทึกฉบับร่าง'}</button></footer>
      </div>
    </WorkspaceDialog>}
    {pendingAction && <ConfirmAction title={pendingAction === 'discard' ? 'ยังไม่ได้บันทึกการแก้ไข' : 'นำรายการออกจากฉบับร่าง'}
      message={pendingAction === 'discard' ? 'การแก้ไขในหน้าต่างนี้ยังไม่ถูกบันทึก' : 'ต้นฉบับและประวัติการแก้ไขจะยังคงอยู่'}
      confirmLabel={pendingAction === 'discard' ? 'ปิดโดยไม่บันทึก' : 'ยืนยันนำรายการออก'} onCancel={() => setPendingAction(null)} onConfirm={() => {
        if (pendingAction === 'discard') setEdit(null); else void run(removeRow); setPendingAction(null);
      }} />}
    {confirmAccept && <WorkspaceDialog title={draft.kind === 'archive' ? 'ยืนยันเผยแพร่พยากรณ์รุ่นใหม่' : 'ยืนยันรับชุดข้อมูล'} onClose={() => { if (!busy) setConfirmAccept(false); }} closeLabel="ปิดการยืนยัน">
      <div className="cms-form"><p>{draft.title} · {rows.length} รายการ · รุ่นแก้ไข {draft.revision}</p><p>{draft.kind === 'archive'
        ? 'เว็บไซต์จะใช้พยากรณ์รุ่นใหม่จากการตรวจแก้รอบนี้ รอบเดือนอื่นจะคงข้อมูลเดิม และเก็บรุ่นที่เผยแพร่ก่อนหน้าไว้'
        : 'ชุดข้อมูลที่รับแล้วจะเป็นรุ่นถาวร การแก้ไขครั้งถัดไปต้องใช้รหัสชุดข้อมูลใหม่'}</p>
        {error && <p className="cms-error" role="alert">{error}</p>}
        <label className="cms-field">บันทึกการตรวจสอบ<textarea aria-label="บันทึกการตรวจสอบ" value={reason} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
        <footer className="cms-actions"><button className="secondary-button" disabled={busy} onClick={() => setConfirmAccept(false)}>ยกเลิก</button>
          <button className="primary-button" disabled={busy || !reason.trim()} onClick={() => { void run(async () => {
            const saved = await api<Draft>('accept', { id: draft.id, body: { revision: draft.revision, reason } });
            onSaved(saved); setReport(null); setConfirmAccept(false); setNotice(draft.kind === 'archive' ? 'เผยแพร่พยากรณ์รุ่นใหม่แล้ว' : 'รับชุดข้อมูลเข้าระบบแล้ว');
          }); }}>{draft.kind === 'archive' ? 'ยืนยันเผยแพร่' : 'ยืนยันรับเข้าระบบ'}</button></footer></div>
    </WorkspaceDialog>}
    {audit && <WorkspaceDialog title="ประวัติการแก้ไข" wide bounded onClose={() => setAudit(null)} closeLabel="ปิดประวัติ"><div className="cms-audit">
      {audit.map(entry => <article key={entry.id}><strong>รุ่นแก้ไข {entry.revision} · {entry.action === 'create' ? 'นำเข้า' : entry.action === 'edit' ? 'แก้ไข' : 'รับเข้าระบบ'}</strong>
        <time>{dateLabel(entry.occurred_at)}</time><p>{entry.reason}</p><small>บัญชี {entry.actor_id}</small></article>)}
    </div></WorkspaceDialog>}
  </div>;
}
