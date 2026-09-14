import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Crosshair, Download, Pause, Play, Search, Table2, X } from 'lucide-react';
import { WorkspaceDialog } from '../WorkspaceDialog';
import { AppSelect } from '../AppSelect';
import { areaMatchesSearch, type ForecastAnalysisOverlay } from '../../forecastAnalysis';
import { formatMonth } from '../../i18n';
import { forecastTargetPeriod } from '../../forecastPeriod';
import { irrigationLabels, irrigationStatusFromSource, type IrrigationCriterion } from '../../irrigation';
import { ForecastRiskValue } from '../ForecastRiskValue';
import { LoadingAnalysisTable } from './ForecastLoadingPrimitives';
import type { NakhonRatchasimaDroughtForecastArchive as Archive } from '../../types';
import type { MapExportContext } from '../../mapImageExport';
import type { NakhonRatchasimaGeoFeature } from './workspaceModel';
import type { ForecastArchiveHorizon } from './forecastModel';
import '../../forecast-map-tools.css';

const AnalysisDialog = lazy(() => import('./ForecastAnalysisDialog'));
type Pin = { point: [number, number]; code: string };

export function ForecastMapTools({ archive, originPeriod, horizon, areaCode, scopeName, irrigation, features, onFocus, onPin, onHorizonChange, onOverlay, exportMap, pin, onClearFocus }: {
  archive: Archive; originPeriod: string; horizon: ForecastArchiveHorizon; areaCode: string; scopeName: string; irrigation: IrrigationCriterion;
  features: NakhonRatchasimaGeoFeature[]; onFocus: (code: string) => string | undefined;
  onPin: (pin: Pin | null) => void; pin: Pin | null; onHorizonChange?: (h: ForecastArchiveHorizon) => void;
  onOverlay: (overlay: ForecastAnalysisOverlay) => void;
  onClearFocus: () => void;
  exportMap: () => { svg: SVGSVGElement; context: MapExportContext } | null;
}) {
  const [tool, setTool] = useState<'search' | 'pin' | 'export' | 'analysis' | null>(null);
  const [query, setQuery] = useState('');
  const [lat, setLat] = useState(''); const [lon, setLon] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [format, setFormat] = useState<'png' | 'pdf'>('png');
  const [framing, setFraming] = useState<'scope' | 'camera'>('scope');
  const [exporting, setExporting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pickedCode, setPickedCode] = useState<string | null>(null);
  const live = useRef(true); const job = useRef(0);
  const opener = useRef<Element | null>(null);
  const callback = useRef(onHorizonChange); callback.current = onHorizonChange;
  const sequence = `${originPeriod}|${areaCode}|${irrigation}`;
  useEffect(() => { setPlaying(false); setPickedCode(null); setMessage(''); setError(''); setTool(null); job.current += 1; setExporting(false); }, [sequence]);
  useEffect(() => { live.current = true; return () => { live.current = false; job.current += 1; }; }, []);
  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  useEffect(() => {
    if (!playing || !callback.current) return;
    const timer = window.setTimeout(() => {
      if (horizon === 6) setPlaying(false);
      else callback.current?.((horizon + 1) as ForecastArchiveHorizon);
    }, 1600);
    return () => clearTimeout(timer);
  }, [playing, horizon]);
  const scopeFeatures = features.filter(f => areaCode === '30' || f.properties.Admin_code.startsWith(areaCode));
  const districtMap = new Map(scopeFeatures.map(f => [f.properties.Admin_code.slice(0, 4), f.properties.A_Name_T]));
  const choices = [
    ...(areaCode.length === 6 ? [] : [...districtMap].map(([code, name]) => ({ code, name, detail: 'อำเภอ' }))),
    ...scopeFeatures.map(f => ({ code: f.properties.Admin_code, name: f.properties.T_Name_T, detail: f.properties.A_Name_T })),
  ].filter(item => areaMatchesSearch(query, item.code, item.name, item.detail));
  function open(next: typeof tool) { opener.current = document.activeElement; setPlaying(false); setTool(next); setError(''); setMessage(''); }
  function close() {
    job.current += 1; setExporting(false); setTool(null);
    queueMicrotask(() => { if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus(); });
  }
  function focus(code: string) {
    const problem = onFocus(code);
    if (problem) { setError(problem); return; }
    onPin(null);
    setPickedCode(code); setMessage(''); close();
  }
  async function locate() {
    setError('');
    const current = ++job.current;
    try {
      const { locateKoratPoint } = await import('../../mapPoint');
      if (!live.current || current !== job.current) return;
      const result = locateKoratPoint(lat, lon, features);
      const code = result.feature.properties.Admin_code;
      if (areaCode !== '30' && !code.startsWith(areaCode)) throw new Error('พิกัดอยู่ในนครราชสีมา แต่อยู่นอกพื้นที่หน้านี้ กรุณาเปิดแผนที่จังหวัดเพื่อค้นหาจุดนี้');
      const problem = onFocus(code);
      if (problem) throw new Error(problem);
      onPin({ point: result.point, code });
      setPickedCode(code); setMessage('พยากรณ์ระดับตำบล ไม่ใช่รายแปลง'); close();
    } catch (cause) { if (live.current && current === job.current) setError(cause instanceof Error ? cause.message : 'ค้นหาพิกัดไม่สำเร็จ'); }
  }
  async function download() {
    if (exporting) return;
    const current = ++job.current;
    setExporting(true); setError('');
    try {
      const { snapshotMapSvg, createMapImage, mapImageBlob } = await import('../../mapImageExport');
      if (!live.current || current !== job.current) return;
      const target = exportMap(); if (!target) throw new Error('ไม่พบแผนที่');
      const report = await createMapImage(snapshotMapSvg(target.svg, framing === 'scope' ? target.context.scopeFrame : undefined), target.context, framing);
      const blob = await mapImageBlob(report, format);
      if (!live.current || current !== job.current) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      const extension = format === 'png' && report.pages.length > 1 ? 'zip' : format;
      link.href = url; link.download = `${target.context.filename}.${extension}`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setMessage(`ดาวน์โหลด ${format.toUpperCase()} ${report.pages.length} หน้าแล้ว${extension === 'zip' ? ' (ไฟล์ ZIP)' : ''}`); setTool(null);
    } catch { if (live.current && current === job.current) setError('ส่งออกแผนที่ไม่สำเร็จ กรุณาลองใหม่'); }
    finally { if (live.current && current === job.current) setExporting(false); }
  }
  const picked = archive.locations.find(row => row.subdistrictCode === (pin?.code ?? pickedCode));
  return <div className="nr-map-tools">
    <div className="nr-map-tool-actions" role="group" aria-label="เครื่องมือข้อมูลนครราชสีมา">
      <button className="icon-button" type="button" title="ค้นหาอำเภอ / ตำบล" aria-label="ค้นหาพื้นที่บนแผนที่" onClick={() => open('search')}><Search size={17} /></button>
      <button className="icon-button" type="button" title="ค้นหาด้วยพิกัด" aria-label="ค้นหาด้วยพิกัด" onClick={() => open('pin')}><Crosshair size={17} /></button>
      <button className="nr-tool-analysis-trigger" type="button" onClick={() => open('analysis')}><Table2 size={17} /><span>วิเคราะห์พยากรณ์</span></button>
      <button className="icon-button" type="button" title="ส่งออกแผนที่ PDF / PNG" aria-label="ส่งออกแผนที่" onClick={() => open('export')}><Download size={17} /></button>
      {onHorizonChange && <div className={`nr-map-playback${playing ? ' is-playing' : ''}`}>
        <button className="icon-button" type="button" title={playing ? 'หยุดลำดับพยากรณ์' : 'เล่นลำดับพยากรณ์ 6 เดือน'} aria-label={playing ? 'หยุดลำดับพยากรณ์' : 'เล่นลำดับพยากรณ์ 6 เดือน'} aria-pressed={playing} onClick={() => {
          if (!playing && horizon === 6) onHorizonChange(1);
          setPlaying(!playing);
        }}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
        <span className="nr-map-playback-period" role="status" aria-atomic="true"><strong>T+{horizon}</strong><span>{formatMonth(forecastTargetPeriod(originPeriod, horizon), 'th')}</span></span>
      </div>}
    </div>
    {picked && <div className="nr-map-tool-result" role="status"><span>ต.{picked.subdistrictNameTh} · อ.{picked.districtNameTh}</span><ForecastRiskValue risk={archive.packedRiskByTargetMonth[originPeriod]?.[picked.subdistrictCode]?.[horizon - 1]} /><span>{irrigationLabels[irrigationStatusFromSource(picked.irrigationStatus)]}</span>
      {!pin && <button type="button" className="icon-button" title="ล้างพื้นที่ที่ค้นหา" aria-label="ล้างพื้นที่ที่ค้นหา" onClick={() => { setPickedCode(null); onClearFocus(); }}><X size={15} /></button>}
    </div>}
    {pin && <div className="nr-map-tool-status"><Crosshair size={15} /><span>{pin.point[1].toFixed(5)}, {pin.point[0].toFixed(5)} · พยากรณ์ระดับตำบล</span><button className="icon-button" type="button" title="ล้างจุดพิกัด" aria-label="ล้างจุดพิกัด" onClick={() => { onPin(null); setPickedCode(null); setMessage(''); onClearFocus(); }}><X size={15} /></button></div>}
    {message && <span className="nr-map-tool-status" role="status">{message}</span>}
    {error && !tool && <span className="nr-tool-error" role="alert">{error}</span>}
    {tool === 'analysis' && <WorkspaceDialog title={`วิเคราะห์พยากรณ์ · ${scopeName}`} wide tall onClose={close}>
      <Suspense fallback={<LoadingAnalysisTable />}><AnalysisDialog
        archive={archive} originPeriod={originPeriod} horizon={horizon} areaCode={areaCode} scopeName={scopeName} irrigation={irrigation}
        onClose={close} onFocus={focus} onOverlay={onOverlay} /></Suspense>
    </WorkspaceDialog>}
    {tool && tool !== 'analysis' && <WorkspaceDialog title={tool === 'search' ? 'ค้นหาพื้นที่นครราชสีมา' : tool === 'pin' ? 'ค้นหาตำบลจากพิกัด' : 'ส่งออกแผนที่'} onClose={close}>
      {tool === 'search' && <><label className="nr-tool-search"><Search size={18} /><input autoFocus type="search" aria-label="ชื่อหรือรหัสพื้นที่นครราชสีมา" placeholder="ชื่ออำเภอ ตำบล หรือรหัสพื้นที่" value={query} onChange={event => setQuery(event.target.value)} /></label><p className="nr-analysis-context" role="status">พบ {choices.length} พื้นที่ในขอบเขตหน้านี้</p>
        <ul className="nr-area-search-results">{choices.map(item => <li key={item.code}><button type="button" onClick={() => focus(item.code)}><strong>{item.name}</strong><span>{item.detail} · {item.code}</span></button></li>)}</ul></>}
      {tool === 'pin' && <form className="nr-point-form" onSubmit={event => { event.preventDefault(); void locate(); }}>
        <label>ละติจูด (WGS84)<input autoFocus required type="number" step="any" min="-90" max="90" value={lat} onChange={e => setLat(e.target.value)} /></label>
        <label>ลองจิจูด (WGS84)<input required type="number" step="any" min="-180" max="180" value={lon} onChange={e => setLon(e.target.value)} /></label>
        <p className="nr-analysis-context">เฉพาะนครราชสีมา · ผลพยากรณ์เป็นของตำบลที่ครอบคลุมพิกัด ไม่ใช่การประเมินความเสี่ยง ณ จุดหรือแปลงเกษตร</p>
        <button className="primary-button" type="submit"><Crosshair size={17} />ค้นหาตำบล</button>
      </form>}
      {tool === 'export' && <><p>เดือนตั้งต้น {formatMonth(originPeriod, 'th')} · T+{horizon} · พยากรณ์ {formatMonth(forecastTargetPeriod(originPeriod, horizon), 'th')}</p>
        <AppSelect ariaLabel="รูปแบบไฟล์แผนที่" value={format} onChange={value => setFormat(value as 'png' | 'pdf')} options={[{ value: 'png', label: 'PNG' }, { value: 'pdf', label: 'PDF' }]} />
        <AppSelect ariaLabel="ขอบเขตภาพรายงาน" value={framing} onChange={value => setFraming(value as 'scope' | 'camera')} options={[{ value: 'scope', label: 'พื้นที่ทั้งหมดของหน้านี้' }, { value: 'camera', label: 'มุมมองแผนที่ปัจจุบัน' }]} />
        <p className="nr-analysis-context">รายงาน A4 จัดหน้าตามเนื้อหา · PNG หลายหน้าจะรวมเป็นไฟล์ ZIP</p>
        <button className="primary-button" type="button" disabled={exporting} onClick={() => void download()}><Download size={17} />{exporting ? 'กำลังสร้างไฟล์' : 'ดาวน์โหลด'}</button></>}
      {error && <p className="nr-tool-error" role="alert">{error}</p>}
    </WorkspaceDialog>}
  </div>;
}
