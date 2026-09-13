import { useEffect, useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ChartColumn, GitCompareArrows, MapPinned, RotateCcw, Search, Table2 } from 'lucide-react';
import { WorkspaceDialog } from '../WorkspaceDialog';
import { AppSelect } from '../AppSelect';
import { useDatabaseWorkspace } from '../../DatabaseWorkspaceProvider';
import { createSupabaseForecastLoader } from '../../data/supabaseForecastArchive';
import { forecastArchiveLoader } from '../../data/forecastArchive';
import { getSupabaseClient } from '../../supabase';
import { buildForecastExport, buildForecastComparison, exportHorizons, type ExportRisk, type ForecastExport } from '../../forecastExportModel';
import { ForecastRiskValue } from '../ForecastRiskValue';
import { analysisDistricts, comparisonStyles, filterAnalysisRows, forecastPattern, riskPatternOptions, type ForecastAnalysisOverlay, type RiskPattern } from '../../forecastAnalysis';
import { forecastTargetPeriod } from '../../forecastPeriod';
import { formatMonth } from '../../i18n';
import { irrigationLabels, type IrrigationCriterion } from '../../irrigation';
import type { NakhonRatchasimaDroughtForecastArchive as Archive } from '../../types';

export default function ForecastAnalysisDialog({ archive, originPeriod, horizon, areaCode, irrigation, onClose, onFocus, onOverlay }: {
  archive: Archive; originPeriod: string; horizon: number; areaCode: string; irrigation: IrrigationCriterion;
  onClose: () => void; onFocus: (code: string) => void; onOverlay: (overlay: ForecastAnalysisOverlay) => void;
}) {
  const services = useDatabaseWorkspace();
  const [loader] = useState(() => services ? createSupabaseForecastLoader(services.userId, 6, getSupabaseClient) : null);
  const [tab, setTab] = useState<'table' | 'districts' | 'comparison'>('table');
  const [level, setLevel] = useState(areaCode.length === 6 ? 'subdistrict' : 'district');
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('');
  const [pattern, setPattern] = useState<RiskPattern>('all');
  const [sort, setSort] = useState('code');
  const [unit, setUnit] = useState('percent');
  const [report, setReport] = useState<ForecastExport | null>(null);
  const [baseline, setBaseline] = useState<ForecastExport | null>(null);
  const [baselinePeriod, setBaselinePeriod] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const targetPeriod = forecastTargetPeriod(originPeriod, horizon);
  const baselineOptions = archive.targetMonths.filter(m => m.period !== originPeriod
    && forecastTargetPeriod(m.period, 1) <= targetPeriod && forecastTargetPeriod(m.period, 6) >= targetPeriod)
    .sort((a, b) => b.period.localeCompare(a.period));

  useEffect(() => {
    let active = true;
    setBusy(true); setError(''); setReport(null); setBaseline(null);
    const load = (origin: string) => loader ? loader.load({ areaCode, originPeriod: origin }) : forecastArchiveLoader.load();
    void (async () => {
      const current = buildForecastExport(await load(originPeriod), { areaCode, originPeriod, irrigation });
      // Do not overlay new data on an older map while its normal revision check is pending.
      if (current.meta.datasetVersion !== archive.meta.datasetVersion || current.meta.sourceWorkbookSha256 !== archive.meta.sourceWorkbookSha256) {
        throw new Error('มีข้อมูลรุ่นใหม่ กรุณาปิดเครื่องมือและโหลดหน้าใหม่ก่อนวิเคราะห์');
      }
      const previous = baselinePeriod ? buildForecastExport(await load(baselinePeriod), { areaCode, originPeriod: baselinePeriod, irrigation }) : null;
      if (previous) buildForecastComparison(current, previous);
      if (active) { setReport(current); setBaseline(previous); }
    })().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; loader?.clear(); };
  }, [loader, areaCode, originPeriod, irrigation, baselinePeriod, attempt, archive.meta.datasetVersion, archive.meta.sourceWorkbookSha256]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setAttempt(value => value + 1); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  const rows = useMemo(() => filterAnalysisRows(report?.rows ?? [], query, district, pattern), [report, query, district, pattern]);
  const districts = useMemo(() => analysisDistricts(rows), [rows]);
  const comparison = useMemo(() => report && baseline ? buildForecastComparison(report, baseline).rows
    .filter(row => row.targetPeriod === targetPeriod && rows.some(location => location.subdistrictCode === row.subdistrictCode)) : [], [report, baseline, targetPeriod, rows]);
  const riskOrder = (risk: ExportRisk) => typeof risk === 'number' ? risk : -1;
  const tableRows = (level === 'district' ? districts.map(item => ({ code: item.code, name: `อ.${item.name}`, district: '',
    risks: item.horizons.map(h => h.highest), coverage: item.horizons.map(h => `${h.valid}/${h.total}`), source: '' })) : rows.map(row => ({
    code: row.subdistrictCode, name: `ต.${row.subdistrictNameTh}`, district: `อ.${row.districtNameTh}`, risks: row.risks, coverage: [], source: row.sourceId,
  }))).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'th') : sort === 'risk'
    ? riskOrder(b.risks[horizon - 1]) - riskOrder(a.risks[horizon - 1]) || a.code.localeCompare(b.code) : a.code.localeCompare(b.code));
  const focused = (code: string) => { onClose(); onFocus(code); };
  function overlay(compare: boolean) {
    if (!report || busy || (compare && !comparison.length)) return;
    onOverlay({ originPeriod, horizon, datasetVersion: report.meta.datasetVersion, revision: report.meta.sourceWorkbookSha256,
      codes: rows.map(row => row.subdistrictCode), label: compare
        ? `เปรียบเทียบรอบ ${formatMonth(baselinePeriod, 'th')} → ${formatMonth(originPeriod, 'th')} · พยากรณ์ ${formatMonth(targetPeriod, 'th')}`
        : `ตัวกรองเฉพาะแผนที่ · ${riskPatternOptions.find(item => item.value === pattern)?.label}${query ? ` · ${query}` : ''}${district ? ` · อ.${report.districts.find(item => item.code === district)?.name}` : ''}`,
      comparison: compare ? comparison : undefined });
    onClose();
  }
  return <WorkspaceDialog title="วิเคราะห์พยากรณ์นครราชสีมา" wide onClose={onClose}>
    <p className="nr-analysis-context">เดือนตั้งต้น {formatMonth(originPeriod, 'th')} · {irrigationLabels[irrigation]} · {areaCode === '30' ? 'จังหวัดนครราชสีมา' : `ขอบเขตพื้นที่ ${areaCode}`}</p>
    <div className="nr-tool-tabs" role="group" aria-label="มุมมองวิเคราะห์">
      <button type="button" aria-pressed={tab === 'table'} onClick={() => setTab('table')}><Table2 size={17} />ตาราง 6 เดือน</button>
      {areaCode.length !== 6 && <button type="button" aria-pressed={tab === 'districts'} onClick={() => setTab('districts')}><ChartColumn size={17} />{areaCode === '30' ? 'เปรียบเทียบอำเภอ' : 'กราฟอำเภอ'}</button>}
      <button type="button" aria-pressed={tab === 'comparison'} onClick={() => setTab('comparison')}><GitCompareArrows size={17} />เปรียบเทียบรอบ</button>
    </div>
    <div className="nr-analysis-filters">
      <label className="nr-tool-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="ค้นหาในตารางพยากรณ์" placeholder="ชื่อพื้นที่ / รหัส" value={query} onChange={e => setQuery(e.target.value)} /></label>
      {areaCode === '30' && <AppSelect ariaLabel="อำเภอในตารางวิเคราะห์" value={district} onChange={setDistrict} options={[{ value: '', label: 'ทุกอำเภอ' }, ...(report?.districts ?? []).map(d => ({ value: d.code, label: d.name }))]} />}
      <AppSelect ariaLabel="รูปแบบความเสี่ยง 6 เดือน" value={pattern} onChange={v => setPattern(v as RiskPattern)} options={riskPatternOptions} />
    </div>
    <p className="nr-analysis-context">รูปแบบความเสี่ยงพิจารณารายตำบลจากรอบตั้งต้นเดียวกัน ค่าว่างไม่ใช่ระดับ 0 และไม่ใช้ยืนยันความเสี่ยงต่อเนื่อง</p>
    {tab === 'comparison' && <div className="nr-analysis-filters">
      <AppSelect ariaLabel="เดือนตั้งต้นรอบเปรียบเทียบ" label="รอบตั้งต้นอ้างอิง" value={baselinePeriod} onChange={setBaselinePeriod} options={[{ value: '', label: 'เลือกรอบที่ต้องการเทียบ' }, ...baselineOptions.map(m => ({ value: m.period, label: formatMonth(m.period, 'th') }))]} />
      <p className="nr-analysis-context">เทียบเดือนพยากรณ์ {formatMonth(targetPeriod, 'th')} เดียวกัน · {baselineOptions.length ? 'แสดงระดับจากรอบอ้างอิง → รอบที่เลือก' : 'ไม่มีรอบอื่นที่พยากรณ์เดือนนี้'}</p>
    </div>}
    {busy ? <p role="status">กำลังตรวจข้อมูลล่าสุดและโหลดพยากรณ์ 6 เดือน</p> : error ? <div role="alert" className="nr-tool-error"><p>{error}</p><button type="button" className="secondary-button" onClick={() => setAttempt(v => v + 1)}><RotateCcw size={16} />ลองใหม่</button></div> : report && <>
      <div className="nr-analysis-toolbar"><span role="status">{rows.length} / {report.rows.length} ตำบล · {districts.length} อำเภอ</span>
        {tab === 'table' && <><AppSelect ariaLabel="ระดับตาราง" value={level} onChange={setLevel} options={[...(areaCode.length !== 6 ? [{ value: 'district', label: 'สรุปอำเภอ' }] : []), { value: 'subdistrict', label: 'รายตำบล' }]} />
          <AppSelect ariaLabel="เรียงตาราง" value={sort} onChange={setSort} icon={<ArrowDownWideNarrow size={16} />} options={[{ value: 'code', label: 'รหัสพื้นที่' }, { value: 'name', label: 'ชื่อพื้นที่' }, { value: 'risk', label: `ความเสี่ยง T+${horizon}` }]} /></>}
        {tab === 'districts' && <AppSelect ariaLabel="หน่วยเปรียบเทียบอำเภอ" value={unit} onChange={setUnit} options={[{ value: 'percent', label: 'สัดส่วนตำบลเสี่ยง (%)' }, { value: 'count', label: 'จำนวนตำบลเสี่ยง' }]} />}
        <button className="secondary-button" type="button" disabled={!rows.length || (tab === 'comparison' && !comparison.length)} onClick={() => overlay(tab === 'comparison')}><MapPinned size={16} />แสดงบนแผนที่</button>
      </div>
      {!rows.length ? <p role="status">ไม่พบตำบลตามตัวกรองนี้</p> : tab === 'table' ? <>
        <div className="nr-analysis-table-wrap" tabIndex={0} role="region" aria-label="ตารางพยากรณ์ 6 เดือน"><table className="nr-analysis-table">
          <caption>{level === 'district' ? 'ระดับอำเภอใช้ค่าสูงสุดของตำบลที่มีค่าพยากรณ์ตามตัวกรอง พร้อมจำนวนที่มีค่า/จำนวนตำบล' : 'ค่าจาก Excel รายตำบล · หมายเลขแหล่งข้อมูลอยู่ใต้รหัสพื้นที่'}</caption>
          <thead><tr><th scope="col">พื้นที่</th>{exportHorizons.map(h => <th scope="col" key={h}>T+{h}<small>{formatMonth(forecastTargetPeriod(originPeriod, h), 'th')}</small></th>)}{level === 'subdistrict' && <th scope="col">ต่อเนื่องสูงสุด</th>}</tr></thead>
          <tbody>{tableRows.map(row => <tr key={row.code}><th scope="row"><button type="button" className="nr-tool-link" onClick={() => focused(row.code)}>{row.name}</button><small>{row.district} · {row.code}{row.source ? ` · ID ${row.source}` : ''}</small></th>
            {row.risks.map((risk, index) => <td key={index} className={index === horizon - 1 ? 'is-active-period' : ''}><ForecastRiskValue risk={risk} />{row.coverage[index] && <small>มีค่า {row.coverage[index]} ตำบล</small>}</td>)}
            {level === 'subdistrict' && <td>{forecastPattern(row.risks).longestRun} เดือน</td>}</tr>)}</tbody>
        </table></div>
      </> : tab === 'districts' ? <>
        <p className="nr-analysis-context">พยากรณ์ {formatMonth(targetPeriod, 'th')} · จำนวนเสี่ยง = ระดับ 1 + 2 · สัดส่วนใช้เฉพาะตำบลที่มีค่าพยากรณ์ตามตัวกรอง ไม่ใช่ร้อยละของพื้นที่ดิน</p>
        <div className="nr-district-comparison" role="list" aria-label="กราฟเปรียบเทียบอำเภอ">
          {[...districts].sort((a, b) => (b.horizons[horizon - 1].riskShare ?? -1) - (a.horizons[horizon - 1].riskShare ?? -1) || a.code.localeCompare(b.code)).map(d => {
            const s = d.horizons[horizon - 1];
            const max = unit === 'percent' ? s.valid : Math.max(1, ...districts.map(item => item.horizons[horizon - 1].counts[1] + item.horizons[horizon - 1].counts[2]));
            return <div key={d.code} role="listitem"><button className="nr-tool-link" type="button" onClick={() => focused(d.code)}>อ.{d.name}</button>
              <div className="nr-district-bar" role="img" aria-label={`ปานกลาง ${s.counts[1]} สูง ${s.counts[2]} มีค่าพยากรณ์ ${s.valid}/${s.total} ตำบล`}><i style={{ width: `${max ? 100 * s.counts[1] / max : 0}%`, background: '#f1b84b' }} /><i style={{ width: `${max ? 100 * s.counts[2] / max : 0}%`, background: '#d95d59' }} /></div>
              <strong>{s.riskShare === null ? 'ไม่มีค่า' : unit === 'percent' ? `${(s.riskShare * 100).toFixed(1)}%` : `${s.counts[1] + s.counts[2]} ตำบล`}</strong><small>มีค่า {s.valid}/{s.total} · ปานกลาง {s.counts[1]} · สูง {s.counts[2]}</small>
            </div>;
          })}
        </div>
      </> : baseline ? <div className="nr-analysis-table-wrap" tabIndex={0} role="region" aria-label="ตารางเปรียบเทียบรอบ"><table className="nr-analysis-table"><thead><tr><th>ตำบล</th><th>รอบ {formatMonth(baselinePeriod, 'th')}</th><th>รอบ {formatMonth(originPeriod, 'th')}</th><th>การเปลี่ยนระดับ</th></tr></thead><tbody>{comparison.map(row => <tr key={row.subdistrictCode}><th scope="row"><button className="nr-tool-link" type="button" onClick={() => focused(row.subdistrictCode)}>ต.{row.subdistrictNameTh}</button><small>อ.{row.districtNameTh} · {row.subdistrictCode}</small></th><td><ForecastRiskValue risk={row.baselineStatus === 'MISSING' ? undefined : row.baselineForecastRisk} /><small>T+{row.baselineHorizon}</small></td><td><ForecastRiskValue risk={row.currentStatus === 'MISSING' ? undefined : row.currentForecastRisk} /><small>T+{row.currentHorizon}</small></td><td>{comparisonStyles[row.comparisonStatus].label}</td></tr>)}</tbody></table></div> : <p role="status">เลือกรอบตั้งต้นอ้างอิงเพื่อเปรียบเทียบเดือนพยากรณ์เดียวกัน</p>}
      <p className="nr-analysis-source">{report.meta.sourceWorkbookOriginal} · {report.meta.sourceSheet}<br />รุ่น {report.meta.datasetVersion} · พยากรณ์ ไม่ใช่ผลความเสียหายจริง</p>
    </>}
  </WorkspaceDialog>;
}
