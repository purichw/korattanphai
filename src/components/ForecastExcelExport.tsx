import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CalendarDays, Download, Droplets, FileSpreadsheet, LoaderCircle, MapPin, RotateCcw, X } from 'lucide-react';
import { useDatabaseWorkspace } from '../DatabaseWorkspaceProvider';
import { readWorkspaceSelection } from '../savedWorkspaceRoutes';
import { resolveAppRoute } from '../domain';
import hierarchy from '../data/canonical/nakhon_ratchasima/admin_hierarchy.json';
import { buildForecastExport, type ExportOptions } from '../forecastExportModel';
import { irrigationCriteria, irrigationLabels, readIrrigationSelection } from '../irrigation';
import { forecastTargetPeriod } from '../forecastPeriod';
import { formatMonth } from '../i18n';
import { getSupabaseClient } from '../supabase';
import { AppSelect } from './AppSelect';
import '../forecast-export.css';

type Services = NonNullable<ReturnType<typeof useDatabaseWorkspace>>;

function currentExportOptions(): ExportOptions {
  const selection = readWorkspaceSelection(window.location, window.history.state);
  const route = resolveAppRoute(window.location.pathname);
  const routeArea = route.kind === 'nakhon-ratchasima' && route.target.valid && route.target.level !== 'province'
    ? route.target.district.districtCode : '30';
  const area = selection?.area_code ?? routeArea;
  return { areaCode: area.length === 6 ? area.slice(0, 4) : area,
    originPeriod: selection?.target_period.slice(0, 7) ?? '',
    irrigation: readIrrigationSelection(window.location.search, window.history.state) };
}

export function ForecastExcelExport({ onOpen }: { onOpen?: () => void }) {
  const services = useDatabaseWorkspace();
  const [options, setOptions] = useState<ExportOptions | null>(null);
  if (!services) return null;
  return <>
    <button type="button" className="nav-item nr-export-trigger" onClick={() => { setOptions(currentExportOptions()); onOpen?.(); }}>
      <FileSpreadsheet size={18} aria-hidden="true" /><span>ส่งออก Excel</span>
    </button>
    {options && createPortal(<ExportDialog key={services.userId} services={services} initial={options} onClose={() => setOptions(null)} />, document.body)}
  </>;
}

function ExportDialog({ services, initial, onClose }: { services: Services; initial: ExportOptions; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const live = useRef(false);
  const running = useRef(false);
  const [options, setOptions] = useState(initial);
  const [periods, setPeriods] = useState<string[]>([]);
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function initialize() {
    setInitializing(true); setError('');
    try {
      const archive = await services.overview.load({ areaCode: initial.areaCode, originPeriod: initial.originPeriod || undefined });
      if (!live.current) return;
      const available = archive.targetMonths.map(month => month.period).sort().reverse();
      setPeriods(available);
      setOptions(current => ({ ...current, originPeriod: available.includes(current.originPeriod) ? current.originPeriod : available[0] }));
    } catch {
      if (live.current) setError('ยังโหลดรายการเดือนจาก Supabase ไม่สำเร็จ กรุณาลองใหม่');
    } finally { if (live.current) setInitializing(false); }
  }
  useEffect(() => {
    live.current = true;
    dialog.current?.showModal();
    void initialize();
    return () => { live.current = false; };
  }, []);
  function close() { live.current = false; dialog.current?.close(); onClose(); }
  async function download() {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('กำลังตรวจรุ่นข้อมูลและเตรียมพยากรณ์ล่วงหน้า 6 เดือน');
    try {
      // load() revalidates the Supabase revision even when this scope is cached.
      const archive = await services.full.load({ areaCode: options.areaCode, originPeriod: options.originPeriod });
      if (!live.current) return;
      const report = buildForecastExport(archive, options);
      setMessage('กำลังสร้างตาราง กราฟ และ PivotTable');
      const { createForecastWorkbook } = await import('../forecastExcelWriter');
      if (!live.current) return;
      const bytes = await createForecastWorkbook(report);
      const client = await getSupabaseClient();
      const session = await client?.auth.getSession();
      if (!live.current) return;
      if (session?.data.session?.user.id !== services.userId) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a'); link.href = url; link.download = report.filename;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setMessage(`ส่งออกแล้ว ${report.districts.length} อำเภอ · ${report.rows.length} ตำบล · ล่วงหน้า 6 เดือน`);
    } catch (cause) {
      if (live.current) {
        setMessage('');
        setError(cause instanceof Error && /^(ไม่พบข้อมูลครบ|ข้อมูลพื้นที่ไม่ครบ|พบข้อมูลพยากรณ์|ไม่มีตำบลตรง|เซสชันหมดอายุ)/.test(cause.message)
          ? cause.message : 'ส่งออกไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง จะไม่ใช้ข้อมูลเก่าแทน');
      }
    } finally { running.current = false; if (live.current) setBusy(false); }
  }
  const districts = [{ value: '30', label: 'ทุกอำเภอในจังหวัดนครราชสีมา' }, ...hierarchy.province.districts.map(district => ({ value: district.districtCode, label: `อำเภอ${district.nameTh}` }))];
  return <dialog className="nr-export-dialog" ref={dialog} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="nr-export-body">
      <header className="nr-export-header"><FileSpreadsheet size={23} aria-hidden="true" /><h2 id={`${id}-title`}>ส่งออกข้อมูลพยากรณ์</h2>
        <button type="button" className="icon-button" aria-label="ปิดหน้าส่งออก" title="ปิด" onClick={close}><X size={18} aria-hidden="true" /></button>
      </header>
      <fieldset className="nr-export-filters" disabled={initializing || busy}>
        <legend className="sr-only">ตัวกรองรายงาน Excel</legend>
        <AppSelect label="เดือนตั้งต้น (T)" ariaLabel="เดือนตั้งต้นของไฟล์ Excel" value={options.originPeriod} options={periods.map(period => ({ value: period, label: formatMonth(period, 'th') }))} onChange={originPeriod => { setOptions({ ...options, originPeriod }); setMessage(''); }} icon={<CalendarDays size={19} />} />
        <AppSelect label="พื้นที่" ariaLabel="พื้นที่ของไฟล์ Excel" value={options.areaCode} options={districts} onChange={areaCode => { setOptions({ ...options, areaCode }); setMessage(''); }} icon={<MapPin size={19} />} />
        <AppSelect label="สถานะชลประทาน" ariaLabel="ชลประทานของไฟล์ Excel" value={options.irrigation} options={irrigationCriteria.map(value => ({ value, label: irrigationLabels[value] }))} onChange={irrigation => { setOptions({ ...options, irrigation: irrigation as ExportOptions['irrigation'] }); setMessage(''); }} icon={<Droplets size={19} />} />
      </fieldset>
      {options.originPeriod && <div className="nr-export-period"><CalendarDays size={18} aria-hidden="true" /><span><strong>พยากรณ์ล่วงหน้า 6 เดือน</strong><span>{formatMonth(forecastTargetPeriod(options.originPeriod, 1), 'th')} – {formatMonth(forecastTargetPeriod(options.originPeriod, 6), 'th')}</span></span></div>}
      <dl className="nr-export-contents">
        <div><dt>ขอบเขต</dt><dd>ทุกระดับความเสี่ยงของตำบลในพื้นที่ที่เลือก</dd></div>
        <div><dt>ตาราง</dt><dd>สรุปอำเภอ · รายตำบล · สถิติรายเดือน</dd></div>
        <div><dt>วิเคราะห์</dt><dd>กราฟปรับตามตัวกรอง · PivotTable · ที่มาและนิยาม</dd></div>
      </dl>
      {error && <div className="nr-export-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{error}</span>{!periods.length && <button type="button" className="icon-button" title="ลองโหลดเดือนใหม่" aria-label="ลองโหลดเดือนใหม่" disabled={initializing} onClick={() => void initialize()}><RotateCcw size={18} /></button>}</div>}
      <p className="nr-export-status" role="status">{initializing || busy ? <LoaderCircle className="nr-export-spinner" size={17} aria-hidden="true" /> : null}{initializing ? 'กำลังโหลดรายการเดือน' : message}</p>
      <footer><button type="button" className="secondary-button" onClick={close}>{busy ? 'ยกเลิก' : 'ปิด'}</button>
        <button type="button" className="primary-button" disabled={initializing || busy || !periods.length} onClick={() => void download()}><Download size={18} aria-hidden="true" />{busy ? 'กำลังสร้างไฟล์' : 'ดาวน์โหลด Excel'}</button></footer>
    </div>
  </dialog>;
}
