import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Bookmark, BookmarkPlus, CalendarDays, Check, CircleCheck, ChevronRight, Droplets, ListFilter, LoaderCircle, MapPin, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useDatabaseWorkspace } from '../DatabaseWorkspaceProvider';
import { savedWorkspaceError, type FollowedArea, type SavedFilter, type SavedForecastSelection } from '../data/savedWorkspaces';
import { readWorkspaceSelection, savedAreaInfo, savedFilterPath } from '../savedWorkspaceRoutes';
import { formatMonth } from '../i18n';
import { irrigationLabels } from '../irrigation';
import { forecastHorizonLabel, forecastTargetPeriod } from '../forecastPeriod';
import '../saved-workspaces.css';

function selectionPeriodLabel(selection: SavedForecastSelection) {
  // target_period is the persisted source-row key, retained for existing saves.
  const origin = selection.target_period.slice(0, 7);
  return `เดือนตั้งต้น ${formatMonth(origin, 'th')} → ${formatMonth(forecastTargetPeriod(origin, selection.horizon), 'th')} (${forecastHorizonLabel(selection.horizon)})`;
}

export function WorkspaceBookmarks({ onNavigate }: { onNavigate: (path: string) => void }) {
  const services = useDatabaseWorkspace();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<SavedForecastSelection | null>(null);
  if (!services) return null;
  return <>
    <button type="button" className="icon-button nr-bookmarks-trigger" title="รายการที่บันทึก" aria-label="รายการที่บันทึก"
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
  const [name, setName] = useState(selection && area ? `${area.label.split(' · ')[0]} ตั้งต้น ${formatMonth(selection.target_period.slice(0,7), 'th')} ${forecastHorizonLabel(selection.horizon)}` : '');

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

  function close() { dialog.current?.close(); onClose(); }
  function go(path: string | null) { if (path) { close(); onNavigate(path); } }
  function changeTab(next: 'area' | 'filter') {
    setTab(next); setConfirm(null); setMessage('');
  }
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
  return <dialog ref={dialog} className="nr-saved-dialog" aria-labelledby={`${id}-title`} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="nr-saved-dialog-body">
      <header className="nr-saved-header">
        <span className="nr-saved-heading-icon"><Bookmark size={20} aria-hidden="true" /></span>
        <h2 id={`${id}-title`}>รายการที่บันทึก</h2>
        <button type="button" className="icon-button" title="ปิด" aria-label="ปิดรายการที่บันทึก" onClick={close}><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="nr-saved-tabs" role="tablist" aria-label="ประเภทรายการ" onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'area' : event.key === 'End' ? 'filter' : tab === 'area' ? 'filter' : 'area';
        changeTab(next); document.getElementById(`${id}-${next}`)?.focus();
      }}>
        <button type="button" role="tab" id={`${id}-area`} tabIndex={tab === 'area' ? 0 : -1} aria-selected={tab === 'area'} aria-controls={`${id}-panel`} onClick={() => changeTab('area')}><MapPin size={16} aria-hidden="true" />พื้นที่ติดตาม</button>
        <button type="button" role="tab" id={`${id}-filter`} tabIndex={tab === 'filter' ? 0 : -1} aria-selected={tab === 'filter'} aria-controls={`${id}-panel`} onClick={() => changeTab('filter')}><ListFilter size={16} aria-hidden="true" />ตัวกรองที่บันทึก</button>
      </div>
      <div className="nr-saved-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
        {selection && area ? tab === 'area' ? <div className="nr-saved-current">
          <MapPin size={20} aria-hidden="true" />
          <div><small>พื้นที่ปัจจุบัน</small><strong>{area.label}</strong></div>
          <button type="button" className={followed ? 'secondary-button' : 'primary-button'} disabled={busy || Boolean(followed)} onClick={() => void perform((signal) => services.saved.follow(selection.area_code, signal), 'เพิ่มพื้นที่ติดตามแล้ว')}>
            {followed ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}{followed ? 'ติดตามแล้ว' : 'ติดตามพื้นที่นี้'}
          </button>
        </div> : <form onSubmit={save} className="nr-saved-form">
          <label htmlFor={`${id}-name`}>ชื่อตัวกรอง</label>
          <div className="nr-saved-name-field"><input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required disabled={busy} />
            <button type="submit" className="primary-button" disabled={busy || !name.trim()}><BookmarkPlus size={16} aria-hidden="true" />บันทึก</button></div>
          <div className="nr-saved-selection-context">
            <span><MapPin size={14} aria-hidden="true" />{area.label}</span>
            <span><CalendarDays size={14} aria-hidden="true" />{selectionPeriodLabel(selection)}</span>
            <span><Droplets size={14} aria-hidden="true" />{irrigationLabels[selection.irrigation_criterion ?? 'all']}</span>
          </div>
        </form> : <p className="nr-saved-pending"><AlertCircle size={18} aria-hidden="true" />รอข้อมูลพยากรณ์พร้อมก่อนบันทึกตัวกรอง</p>}
        {error && <div role="alert" className="nr-saved-error"><AlertCircle size={18} aria-hidden="true" /><span>{error}</span><button type="button" className="secondary-button" disabled={busy} onClick={() => void perform()}><RotateCcw size={16} aria-hidden="true" />ลองใหม่</button></div>}
        <p role="status" className="nr-saved-status">{busy ? <><LoaderCircle size={16} className="nr-saved-spinner" aria-hidden="true" /><span>กำลังโหลดรายการ...</span></> : message ? <><CircleCheck size={16} aria-hidden="true" /><span>{message}</span></> : null}</p>
        {loaded && <section className="nr-saved-collection" aria-label={tab === 'area' ? 'พื้นที่ที่ติดตาม' : 'ตัวกรองของฉัน'} aria-busy={busy}>
          <div className="nr-saved-list-heading"><h3>{tab === 'area' ? 'พื้นที่ที่ติดตาม' : 'ตัวกรองของฉัน'}</h3><span>{items.length} รายการ</span></div>
          {items.length > 0 && <ul className="nr-saved-list">
          {items.map(({ id: key, label, path, detail }) => {
            return <li key={key}>
              <button type="button" className="nr-saved-open" disabled={!path || busy} onClick={() => go(path)}>
                {tab === 'area' ? <MapPin size={17} className="nr-saved-item-icon" aria-hidden="true" /> : <ListFilter size={17} className="nr-saved-item-icon" aria-hidden="true" />}
                <span><strong>{label}</strong>{detail && <small>{detail}</small>}</span><ChevronRight size={16} aria-hidden="true" />
              </button>
              {confirm === key ? <div className="nr-saved-confirm"><span><AlertCircle size={16} aria-hidden="true" />ลบรายการนี้?</span>
                <button type="button" className="secondary-button" aria-label="ยกเลิกการลบ" disabled={busy} onClick={() => setConfirm(null)}>ยกเลิก</button>
                <button type="button" className="secondary-button nr-saved-delete-confirm" disabled={busy} onClick={() => void perform((signal) => services.saved.remove(tab, key, signal), 'ลบรายการแล้ว')}><Trash2 size={16} aria-hidden="true" />ลบ</button>
              </div> : <button type="button" className="icon-button nr-saved-remove" title={`ลบ ${label}`} aria-label={`ลบ ${label}`} disabled={busy} onClick={() => setConfirm(key)}><Trash2 size={16} aria-hidden="true" /></button>}
            </li>;
          })}
          </ul>}
          {!busy && !error && items.length === 0 && <div className="nr-saved-empty">
            {tab === 'area' ? <MapPin size={28} strokeWidth={1.5} aria-hidden="true" /> : <Bookmark size={28} strokeWidth={1.5} aria-hidden="true" />}
            <p>{tab === 'area' ? 'ยังไม่มีพื้นที่ติดตาม' : 'ยังไม่มีตัวกรองที่บันทึก'}</p>
          </div>}
        </section>}
      </div>
    </div>
  </dialog>;
}
