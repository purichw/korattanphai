import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Bookmark, Check, ChevronRight, ListFilter, MapPin, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useDatabaseWorkspace } from '../DatabaseWorkspaceProvider';
import { savedWorkspaceError, type FollowedArea, type SavedFilter, type SavedForecastSelection } from '../data/savedWorkspaces';
import { readWorkspaceSelection, savedAreaInfo, savedFilterPath } from '../savedWorkspaceRoutes';
import { formatMonth } from '../i18n';
import { irrigationLabels } from '../irrigation';
import { forecastTargetPeriod } from '../forecastPeriod';
import '../saved-workspaces.css';

function selectionPeriodLabel(selection: SavedForecastSelection) {
  // target_period is the persisted source-row key, retained for existing saves.
  const origin = selection.target_period.slice(0, 7);
  return `เดือนตั้งต้น ${formatMonth(origin, 'th')} → ${formatMonth(forecastTargetPeriod(origin, selection.horizon), 'th')} (T+${selection.horizon})`;
}

export function WorkspaceBookmarks({ onNavigate }: { onNavigate: (path: string) => void }) {
  const services = useDatabaseWorkspace();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<SavedForecastSelection | null>(null);
  if (!services) return null;
  return <>
    <button type="button" className="secondary-button nr-bookmarks-trigger" title="รายการที่บันทึก" aria-label="รายการที่บันทึก"
      onClick={() => { setSelection(readWorkspaceSelection(window.location, window.history.state)); setOpen(true); }}><Bookmark size={18} aria-hidden="true" /></button>
    {open && <SavedWorkspaceDialog key={services.userId} services={services} selection={selection} onClose={() => setOpen(false)} onNavigate={onNavigate} />}
  </>;
}

function SavedWorkspaceDialog({ services, selection, onClose, onNavigate }: {
  services: NonNullable<ReturnType<typeof useDatabaseWorkspace>>;
  selection: SavedForecastSelection | null; onClose: () => void; onNavigate: (path: string) => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const live = useRef(true);
  const [tab, setTab] = useState<'area' | 'filter'>('area');
  const [areas, setAreas] = useState<FollowedArea[]>([]);
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const area = selection ? savedAreaInfo(selection.area_code) : null;
  const [name, setName] = useState(selection && area ? `${area.label.split(' · ')[0]} ตั้งต้น ${formatMonth(selection.target_period.slice(0,7), 'th')} T+${selection.horizon}` : '');

  async function refresh(signal: AbortSignal) {
    const nextAreas = await services.saved.listAreas(signal);
    const nextFilters = await services.saved.listFilters(signal);
    if (live.current && !signal.aborted) { setAreas(nextAreas); setFilters(nextFilters); setLoaded(true); }
  }
  async function perform(action?: (signal: AbortSignal) => Promise<void>, success = '') {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 20_000);
    setBusy(true); setError(''); setMessage('');
    try {
      await action?.(controller.signal);
      await refresh(controller.signal);
      if (live.current && request.current === controller) { setMessage(success); setConfirm(null); }
    } catch (cause) {
      if (live.current && request.current === controller) setError(savedWorkspaceError(cause));
    } finally {
      clearTimeout(timer);
      if (request.current === controller) { request.current = null; if (live.current) setBusy(false); }
    }
  }
  useEffect(() => {
    live.current = true;
    if (!dialog.current?.open) dialog.current?.showModal();
    void perform();
    return () => { live.current = false; request.current?.abort(); request.current = null; };
  }, []);

  function go(path: string | null) { if (path) { onClose(); onNavigate(path); } }
  function save(event: FormEvent) {
    event.preventDefault();
    if (selection) void perform((signal) => services.saved.saveFilter(name, selection, signal), 'บันทึกตัวกรองแล้ว');
  }
  const followed = selection && areas.some((a) => a.area_code === selection.area_code);
  const items = tab === 'area' ? areas.map((item) => {
    const info = savedAreaInfo(item.area_code);
    return { id: item.area_code, label: info?.label ?? item.area_code, path: info?.path ?? null, detail: '' };
  }) : filters.map((item) => ({
    id: item.id, label: item.name, path: savedFilterPath(item),
    detail: `${savedAreaInfo(item.area_code)?.label ?? item.area_code} · ${selectionPeriodLabel(item)} · ${irrigationLabels[item.irrigation_criterion ?? 'all']}`,
  }));
  return <dialog ref={dialog} className="nr-saved-dialog" aria-labelledby={`${id}-title`} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="nr-saved-dialog-body">
      <header><h2 id={`${id}-title`}>รายการที่บันทึก</h2><button type="button" className="icon-button" title="ปิด" aria-label="ปิดรายการที่บันทึก" onClick={onClose}><X size={20} /></button></header>
      <div className="nr-saved-tabs" role="tablist" aria-label="ประเภทรายการ" onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'area' : event.key === 'End' ? 'filter' : tab === 'area' ? 'filter' : 'area';
        setTab(next); setConfirm(null); document.getElementById(`${id}-${next}`)?.focus();
      }}>
        <button type="button" role="tab" id={`${id}-area`} tabIndex={tab === 'area' ? 0 : -1} aria-selected={tab === 'area'} aria-controls={`${id}-panel`} onClick={() => { setTab('area'); setConfirm(null); }}><MapPin size={17} />พื้นที่ติดตาม</button>
        <button type="button" role="tab" id={`${id}-filter`} tabIndex={tab === 'filter' ? 0 : -1} aria-selected={tab === 'filter'} aria-controls={`${id}-panel`} onClick={() => { setTab('filter'); setConfirm(null); }}><ListFilter size={17} />ตัวกรองที่บันทึก</button>
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
        {selection && area ? tab === 'area' ? <div className="nr-saved-current">
          <span>{area.label}</span>
          <button type="button" className="secondary-button" disabled={busy || Boolean(followed)} onClick={() => void perform((signal) => services.saved.follow(selection.area_code, signal), 'เพิ่มพื้นที่ติดตามแล้ว')}>
            {followed ? <Check size={17} /> : <Plus size={17} />}{followed ? 'ติดตามแล้ว' : 'ติดตามพื้นที่นี้'}
          </button>
        </div> : <form onSubmit={save} className="nr-saved-form">
          <label htmlFor={`${id}-name`}>ชื่อตัวกรอง</label>
          <div><input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required disabled={busy} />
            <button type="submit" className="primary-button" disabled={busy || !name.trim()}><Plus size={17} />บันทึก</button></div>
          <small>{area.label} · {selectionPeriodLabel(selection)} · {irrigationLabels[selection.irrigation_criterion ?? 'all']}</small>
        </form> : <p className="empty-note">รอข้อมูลพยากรณ์พร้อมก่อนบันทึกตัวกรอง</p>}
        {error && <div role="alert" className="nr-saved-error"><span>{error}</span><button type="button" className="secondary-button" disabled={busy} onClick={() => void perform()}><RotateCcw size={16} />ลองใหม่</button></div>}
        <p role="status" className="nr-saved-status">{busy ? 'กำลังโหลดรายการ...' : message}</p>
        {loaded && <ul className="nr-saved-list">
          {items.map(({ id: key, label, path, detail }) => {
            return <li key={key}>
              <button type="button" className="nr-saved-open" disabled={!path || busy} onClick={() => go(path)}><span><strong>{label}</strong>{detail && <small>{detail}</small>}</span><ChevronRight size={18} /></button>
              {confirm === key ? <div className="nr-saved-confirm"><span>ลบรายการนี้?</span><button type="button" className="secondary-button" disabled={busy} onClick={() => void perform((signal) => services.saved.remove(tab, key, signal), 'ลบรายการแล้ว')}>ลบ</button><button type="button" className="icon-button" aria-label="ยกเลิกการลบ" disabled={busy} onClick={() => setConfirm(null)}><X size={17} /></button></div>
                : <button type="button" className="icon-button" title={`ลบ ${label}`} aria-label={`ลบ ${label}`} disabled={busy} onClick={() => setConfirm(key)}><Trash2 size={17} /></button>}
            </li>;
          })}
          {!busy && !error && (tab === 'area' ? areas : filters).length === 0 && <li className="empty-note">{tab === 'area' ? 'ยังไม่มีพื้นที่ติดตาม' : 'ยังไม่มีตัวกรองที่บันทึก'}</li>}
        </ul>}
      </div>
    </div>
  </dialog>;
}
