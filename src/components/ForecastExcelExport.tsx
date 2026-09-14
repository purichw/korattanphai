import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CalendarDays, Download, Droplets, FileSpreadsheet, LoaderCircle, MapPin, RotateCcw, X } from 'lucide-react';
import { useDatabaseWorkspace } from '../DatabaseWorkspaceProvider';
import { readWorkspaceSelection } from '../savedWorkspaceRoutes';
import { resolveAppRoute } from '../domain';
import hierarchy from '../data/canonical/nakhon_ratchasima/admin_hierarchy.json';
import { buildForecastExport, withForecastExportComparison, sameForecastExportData, type ExportOptions, type ForecastExport } from '../forecastExportModel';
import { createSupabaseForecastLoader } from '../data/supabaseForecastArchive';
import { withLoadDeadline } from '../data/loadDeadline';
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

export function ForecastExcelExport({ onOpen, openRequest = 0 }: { onOpen?: () => void; openRequest?: number }) {
  const services = useDatabaseWorkspace();
  const [options, setOptions] = useState<ExportOptions | null>(null);
  const handledRequest = useRef(0);
  useEffect(() => {
    if (services && openRequest > handledRequest.current) {
      handledRequest.current = openRequest;
      setOptions(currentExportOptions()); onOpen?.();
    }
  }, [openRequest, services, onOpen]);
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
  const job = useRef<AbortController | null>(null);
  // The dialog owns its requests so cancellation never aborts the map's load.
  const [loaders] = useState(() => ({
    full: createSupabaseForecastLoader(services.userId, 6, getSupabaseClient),
    overview: createSupabaseForecastLoader(services.userId, 1, getSupabaseClient),
  }));
  const [options, setOptions] = useState(initial);
  const [periods, setPeriods] = useState<string[]>([]);
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [comparisonPeriod, setComparisonPeriod] = useState('');
  const [preview, setPreview] = useState<ForecastExport | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function initialize() {
    setInitializing(true); setError('');
    try {
      const archive = await loaders.overview.load({ areaCode: initial.areaCode, originPeriod: initial.originPeriod || undefined });
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
    return () => { live.current = false; job.current?.abort(); loaders.full.clear(); loaders.overview.clear(); };
  }, []);
  function cancel() {
    job.current?.abort(); job.current = null; loaders.full.clear();
    setBusy(false); setError(''); setMessage('ยกเลิกแล้ว ตัวเลือกเดิมยังอยู่ สามารถลองอีกครั้งได้');
  }
  function close() { live.current = false; job.current?.abort(); loaders.full.clear(); loaders.overview.clear(); dialog.current?.close(); onClose(); }
  function changeOptions(next: ExportOptions) { setOptions(next); setPreview(null); setError(''); setMessage(''); }
  async function prepareOrDownload() {
    if (job.current) return;
    const controller = new AbortController(); job.current = controller;
    const active = () => live.current && job.current === controller && !controller.signal.aborted;
    setBusy(true); setError(''); setMessage('1/3 กำลังตรวจรุ่นข้อมูลและจำนวนพื้นที่');
    try {
      // load() revalidates the Supabase revision even when this scope is cached.
      const archive = await loaders.full.load({ areaCode: options.areaCode, originPeriod: options.originPeriod });
      if (!active()) return;
      let report = buildForecastExport(archive, options);
      if (comparisonPeriod) {
        setMessage('1/3 กำลังจับคู่เดือนพยากรณ์กับรอบเปรียบเทียบ');
        const baseline = await loaders.full.load({ areaCode: options.areaCode, originPeriod: comparisonPeriod });
        if (!active()) return;
        report = withForecastExportComparison(report, buildForecastExport(baseline, { ...options, originPeriod: comparisonPeriod }, report.exportedAt));
      }
      if (!preview || !sameForecastExportData(preview, report)) {
        setPreview(report);
        setMessage(preview ? 'ข้อมูลเปลี่ยนจากที่ตรวจไว้ กรุณาตรวจสรุปใหม่ก่อนกดดาวน์โหลดอีกครั้ง' : 'ตรวจข้อมูลแล้ว พร้อมดาวน์โหลด');
        return;
      }
      setMessage('2/3 กำลังสร้างตาราง กราฟ และ PivotTable');
      const { createForecastWorkbookJob } = await import('../forecastExcelJob');
      if (!active()) return;
      const bytes = await createForecastWorkbookJob(report, { signal: controller.signal, onProgress: stage => {
        if (active()) setMessage(stage === 'packaging' ? '3/3 กำลังจัดเก็บไฟล์และตรวจเซสชัน' : '2/3 กำลังสร้างตาราง กราฟ และ PivotTable');
      } });
      if (!active()) return;
      const session = await withLoadDeadline(controller, async () => {
        const client = await getSupabaseClient();
        return client?.auth.getSession();
      });
      if (!active()) return;
      if (session?.data.session?.user.id !== services.userId) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a'); link.href = url; link.download = report.filename;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setMessage(`ส่งออกแล้ว ${report.districts.length} อำเภอ · ${report.rows.length} ตำบล · ล่วงหน้า 6 เดือน`);
    } catch (cause) {
      if (live.current && job.current === controller) {
        setMessage('');
        setError(cause instanceof Error && /^(ไม่พบข้อมูลครบ|ข้อมูลพื้นที่ไม่ครบ|พบข้อมูลพยากรณ์|ไม่มีตำบลตรง|เซสชันหมดอายุ|เปรียบเทียบได้เฉพาะ|กรุณาเลือกเดือนตั้งต้น|รหัสพื้นที่หรือ|สองเดือนตั้งต้น|ข้อมูลเปรียบเทียบ|ข้อมูลคนละรุ่น)/.test(cause.message)
          ? cause.message : cause instanceof Error && /Timeout/.test(cause.name)
            ? 'ใช้เวลานานเกินกำหนด จึงหยุดงานแล้ว กรุณาลองอีกครั้ง ตัวเลือกเดิมยังอยู่'
            : 'ส่งออกไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง จะไม่ใช้ข้อมูลเก่าแทน');
      }
    } finally { if (job.current === controller) { job.current = null; if (live.current) setBusy(false); } }
  }
  const comparisonPeriods = periods.filter(period => period !== options.originPeriod
    && forecastTargetPeriod(period, 6) >= forecastTargetPeriod(options.originPeriod, 1)
    && forecastTargetPeriod(period, 1) <= forecastTargetPeriod(options.originPeriod, 6));
  const counts = preview?.totals.reduce((sum, total) => ({ missing: sum.missing + total.counts[4], outOfScope: sum.outOfScope + total.counts[3] }), { missing: 0, outOfScope: 0 });
  const districts = [{ value: '30', label: 'ทุกอำเภอในจังหวัดนครราชสีมา' }, ...hierarchy.province.districts.map(district => ({ value: district.districtCode, label: `อำเภอ${district.nameTh}` }))];
  return <dialog className="nr-export-dialog" ref={dialog} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="nr-export-body">
      <header className="nr-export-header"><FileSpreadsheet size={23} aria-hidden="true" /><h2 id={`${id}-title`}>ส่งออกข้อมูลพยากรณ์</h2>
        <button type="button" className="icon-button" aria-label="ปิดหน้าส่งออก" title="ปิด" onClick={close}><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="nr-export-scroll">
      <fieldset className="nr-export-filters" disabled={initializing || busy}>
        <legend className="sr-only">ตัวกรองรายงาน Excel</legend>
        <AppSelect label="เดือนตั้งต้น (T)" ariaLabel="เดือนตั้งต้นของไฟล์ Excel" value={options.originPeriod} options={periods.map(period => ({ value: period, label: formatMonth(period, 'th') }))} onChange={originPeriod => { changeOptions({ ...options, originPeriod }); setComparisonPeriod(''); }} icon={<CalendarDays size={19} />} />
        <AppSelect label="พื้นที่" ariaLabel="พื้นที่ของไฟล์ Excel" value={options.areaCode} options={districts} onChange={areaCode => changeOptions({ ...options, areaCode })} icon={<MapPin size={19} />} />
        <AppSelect label="สถานะชลประทาน" ariaLabel="ชลประทานของไฟล์ Excel" value={options.irrigation} options={irrigationCriteria.map(value => ({ value, label: irrigationLabels[value] }))} onChange={irrigation => changeOptions({ ...options, irrigation: irrigation as ExportOptions['irrigation'] })} icon={<Droplets size={19} />} />
        <AppSelect label="รอบตั้งต้นที่ใช้เปรียบเทียบ" value={comparisonPeriod} options={[{ value: '', label: 'ไม่เปรียบเทียบ' }, ...comparisonPeriods.map(period => ({ value: period, label: formatMonth(period, 'th') }))]} onChange={period => { setComparisonPeriod(period); setPreview(null); setError(''); setMessage(''); }} icon={<CalendarDays size={19} />} />
      </fieldset>
      {comparisonPeriod && <p className="nr-export-hint">เปรียบเทียบเฉพาะตำบลและเดือนพยากรณ์เดียวกัน ค่าที่เพิ่มขึ้นหมายถึงความเสี่ยงสูงขึ้นจากรอบ {formatMonth(comparisonPeriod, 'th')}</p>}
      {options.originPeriod && <div className="nr-export-period"><CalendarDays size={18} aria-hidden="true" /><span><strong>พยากรณ์ล่วงหน้า 6 เดือน</strong><span>{formatMonth(forecastTargetPeriod(options.originPeriod, 1), 'th')} – {formatMonth(forecastTargetPeriod(options.originPeriod, 6), 'th')}</span></span></div>}
      {preview && counts && <section className="nr-export-preview" aria-labelledby={`${id}-preview`}>
        <h3 id={`${id}-preview`}>ตรวจข้อมูลก่อนดาวน์โหลด</h3>
        <div className="nr-export-preview-counts"><p><strong>{preview.districts.length.toLocaleString('th-TH')}</strong> อำเภอ</p><p><strong>{preview.rows.length.toLocaleString('th-TH')}</strong> ตำบล</p><p><strong>{preview.rows.length * 6}</strong> รายการพยากรณ์</p></div>
        <p>ไม่มีข้อมูล {counts.missing.toLocaleString('th-TH')} · นอกขอบเขตการศึกษา {counts.outOfScope.toLocaleString('th-TH')} รายการ</p>
        <p className="nr-export-hint">1 รายการ = 1 ตำบล × 1 เดือน ทั้งสองสถานะไม่ถือเป็นความเสี่ยงระดับ 0</p>
        {preview.comparison && <p>เทียบได้ {preview.comparison.targets.length} เดือน · {preview.comparison.rows.length.toLocaleString('th-TH')} คู่ จาก {formatMonth(preview.comparison.targets[0], 'th')} ถึง {formatMonth(preview.comparison.targets.at(-1)!, 'th')}</p>}
        <p className="nr-export-revision">รุ่นข้อมูล: {preview.meta.datasetVersion}</p>
      </section>}
      <dl className="nr-export-contents">
        <div><dt>ขอบเขต</dt><dd>ทุกระดับความเสี่ยงของตำบลในพื้นที่ที่เลือก</dd></div>
        <div><dt>ตาราง</dt><dd>สรุปอำเภอ · รายตำบล · สถิติรายเดือน</dd></div>
        <div><dt>วิเคราะห์</dt><dd>กราฟปรับตามตัวกรอง · PivotTable · ที่มาและนิยาม</dd></div>
        <div><dt>ใช้งานต่อ</dt><dd>ข้อมูลสำหรับระบบอื่น · คำอธิบายทุกคอลัมน์ไทย–อังกฤษ{comparisonPeriod ? ' · เปรียบเทียบต่างรอบ' : ''}</dd></div>
      </dl>
      {error && <div className="nr-export-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{error}</span>{!periods.length && <button type="button" className="icon-button" title="ลองโหลดเดือนใหม่" aria-label="ลองโหลดเดือนใหม่" disabled={initializing} onClick={() => void initialize()}><RotateCcw size={18} /></button>}</div>}
      </div>
      <p className="nr-export-status" role="status">{initializing || busy ? <LoaderCircle className="nr-export-spinner" size={17} aria-hidden="true" /> : null}{initializing ? 'กำลังโหลดรายการเดือน' : message}</p>
      <footer><button type="button" className="secondary-button" onClick={busy ? cancel : close}>{busy ? 'ยกเลิก' : 'ปิด'}</button>
        <button type="button" className="primary-button" disabled={initializing || busy || !periods.length} onClick={() => void prepareOrDownload()}><Download size={18} aria-hidden="true" />{busy ? 'กำลังเตรียมข้อมูล' : preview ? 'ดาวน์โหลด Excel' : 'ตรวจข้อมูลก่อนส่งออก'}</button></footer>
    </div>
  </dialog>;
}
