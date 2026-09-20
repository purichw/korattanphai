import { useEffect, useMemo } from 'react';
import { Archive, ArrowLeft, CalendarDays, CircleHelp, Database, MapPin, RefreshCw, Shield, TriangleAlert } from 'lucide-react';
import { getNakhonRatchasimaMapLayers, type NakhonRatchasimaRouteTarget } from '../../domain';
import { useOperationalContext } from '../../useOperationalContext';
import { archivePath, operationalPath, readOperationalLocation } from '../../operationalLocation';
import { shiftMonthPeriod } from '../../forecastPeriod';
import { formatMonth } from '../../i18n';
import { AppSelect } from '../AppSelect';
import { MonthSelect } from '../MonthSelect';
import { MetricGrid } from '../PageSummary';
import { NakhonRatchasimaLocalMap } from './NakhonRatchasimaLocalMap';
import { DroughtOperationalDisclosure } from './DroughtOperationalWorkspace';
import { districtOptionsForProvince, pathForDistrictCode, pathForSubdistrictCode, routeBackTargetForRoute } from './workspaceModel';

type Target = Extract<NakhonRatchasimaRouteTarget, { valid: true }>;
export function OperationalDroughtWorkspace({ target, onNavigate }: { target: Target; onNavigate: (path: string) => void }) {
  const search = window.location.search;
  const selection = readOperationalLocation(search);
  const requestedPeriod = selection.intent === 'operational' ? selection.period : undefined;
  const areaCode = target.level === 'subdistrict' ? target.subdistrict.subdistrictCode : target.level === 'district' ? target.district.districtCode : '30';
  const data = useOperationalContext(areaCode, requestedPeriod, selection.intent === 'operational');
  const period = data.context?.validPeriod ?? requestedPeriod;
  const currentPeriod = data.context?.currentPeriod;
  const invalid = selection.intent === 'invalid';
  const loading = !invalid && data.status === 'loading';
  const error = invalid || data.status === 'error';
  const future = data.snapshot?.family === 'forecast';
  const kindLabel = data.status === 'ready' ? future ? 'พยากรณ์' : 'สถานการณ์จากข้อมูลรายงาน' : 'กำลังตรวจสอบบริบทข้อมูล';
  const periodLabel = period ? formatMonth(period, 'th') : 'รอตรวจสอบเดือนปัจจุบัน';
  const scope = target.level === 'province' ? 'จังหวัดนครราชสีมา' : target.level === 'district' ? `อำเภอ${target.district.nameTh}` : `ตำบล${target.subdistrict.nameTh} · อำเภอ${target.district.nameTh}`;
  const back = routeBackTargetForRoute(target);
  const scopePath = target.level === 'district' && new URLSearchParams(search).has('district')
    ? pathForDistrictCode(target.district.districtCode) ?? window.location.pathname : window.location.pathname;
  const navigateArea = (path: string) => onNavigate(operationalPath(path, period));
  const areaOptions = target.level === 'province' ? [{ value: '', label: 'ทุกอำเภอ' }, ...districtOptionsForProvince()]
    : [{ value: '', label: 'ทุกตำบล' }, ...target.district.subdistricts.map(area => ({ value: area.subdistrictCode, label: area.nameTh ?? area.name }))];
  const monthOptions = useMemo(() => {
    if (!currentPeriod) return [{ value: period ?? '', label: periodLabel, disabled: true }];
    const periods = new Set(Array.from({ length: 31 }, (_, index) => shiftMonthPeriod(currentPeriod, 6 - index)!));
    if (period) periods.add(period);
    return [...periods].sort().reverse().map(value => ({ value, label: formatMonth(value, 'th'),
      group: `พ.ศ. ${Number(value.slice(0, 4)) + 543}`, description: value > currentPeriod ? 'พยากรณ์ · ยังไม่มีรอบที่พร้อมเผยแพร่' : value === currentPeriod ? 'ข้อมูลระหว่างเดือน · ยังไม่มีรายงานที่พร้อมเผยแพร่' : 'ข้อมูลรายงาน · ยังไม่มีข้อมูลที่พร้อมเผยแพร่' }));
  }, [currentPeriod, period, periodLabel]);
  useEffect(() => {
    if (data.status !== 'ready' || !requestedPeriod) return;
    const clean = operationalPath(scopePath, requestedPeriod);
    if (`${window.location.pathname}${window.location.search}` !== clean) {
      window.history.replaceState(window.history.state, '', clean);
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    }
  }, [data.status, requestedPeriod, search, scopePath]);

  const statusLabel = loading ? 'กำลังตรวจสอบข้อมูล' : error ? 'ยังตรวจสอบข้อมูลไม่ได้' : 'ยังไม่มีข้อมูลที่พร้อมเผยแพร่';
  const primaryTitle = invalid ? 'เดือนข้อมูลในลิงก์ไม่ถูกต้อง' : error ? 'ตรวจสอบข้อมูลไม่สำเร็จ' : loading ? 'กำลังตรวจสอบเดือนและแหล่งข้อมูล'
    : future ? 'ยังไม่มีคำพยากรณ์ที่พร้อมใช้สำหรับเดือนนี้' : 'ยังไม่มีข้อมูลสถานการณ์จริงสำหรับเดือนนี้';
  const explanation = invalid ? 'ระบบไม่ได้เลือกเดือนอื่นมาแทน กรุณากลับไปเลือกเดือนข้อมูล'
    : error ? 'ยังยืนยันเวลาและสถานะเผยแพร่จากระบบไม่ได้ จึงยังไม่แสดงผลประเมินความเสี่ยง'
    : loading ? 'ยังไม่แสดงค่าความเสี่ยงระหว่างตรวจสอบบริบทที่เลือก'
    : future ? 'คลัง rev03 ยังไม่มีหลักฐานวันออกคำพยากรณ์และนโยบายความสดใหม่ที่ยืนยันสำหรับการใช้งานปัจจุบัน'
    : 'ยังไม่มีแหล่งข้อมูล actual ที่ผ่านการยืนยันและพร้อมเผยแพร่ในระบบ คำพยากรณ์ย้อนหลังจะไม่ถูกนำมาแทนข้อมูลจริง';
  const mapContext = useMemo(() => ({ key: `${areaCode}|${period}|${data.status}|${kindLabel}`, kindLabel, periodLabel, statusLabel }),
    [areaCode, period, data.status, kindLabel, periodLabel, statusLabel]);

  return <div className="page-stack nr-workspace nr-primary-workspace" data-data-family={data.snapshot?.family ?? 'unresolved'} data-valid-period={period ?? ''}>
    <header className="nr-operational-header nr-drought-page-header">
      {back && <button className="nr-page-back-link" type="button" onClick={() => navigateArea(back.path)}><ArrowLeft size={16} />{back.label}</button>}
      <p className="eyebrow">{target.level === 'province' && target.tab === 'overview' ? 'ภาพรวมสถานการณ์' : 'ภัยแล้ง'}</p>
      <h1>{scope}</h1>
      <p>{kindLabel}{period && ` · ${periodLabel}`}{data.snapshot?.partialPeriod && ' · เดือนปัจจุบันยังไม่สิ้นสุด'}</p>
    </header>
    <section className="nr-operational-filters nr-primary-filters" aria-label="ตัวกรองสถานการณ์">
      <MonthSelect label="เดือนข้อมูล" ariaLabel="เดือนข้อมูล" icon={<CalendarDays size={20} />} value={period ?? ''} options={monthOptions}
        onChange={value => onNavigate(operationalPath(scopePath, value))} />
      <div className="nr-fixed-filter"><Shield size={20} aria-hidden="true" /><span>ภัย<strong>ภัยแล้ง</strong></span></div>
      <AppSelect searchable label={target.level === 'province' ? 'อำเภอ' : 'ตำบล'} icon={<MapPin size={20} />}
        value={target.level === 'subdistrict' ? areaCode : ''} options={areaOptions} onChange={code => {
          const path = target.level === 'province' ? pathForDistrictCode(code) : code ? pathForSubdistrictCode(code) : pathForDistrictCode(target.district.districtCode);
          if (path) navigateArea(path);
        }} />
    </section>
    <div className="nr-primary-context-line"><span>{currentPeriod ? `ช่วงเดือนในตัวเลือก ${formatMonth(shiftMonthPeriod(currentPeriod, -24)!, 'th')} ถึง ${formatMonth(shiftMonthPeriod(currentPeriod, 6)!, 'th')}` : 'อ้างอิงเวลาระบบ Asia/Bangkok'}</span>
      <a href={archivePath(scopePath)} onClick={event => { event.preventDefault(); onNavigate(archivePath(scopePath)); }}><Archive size={16} />ดูคลังคำพยากรณ์ย้อนหลัง</a>
    </div>
    <div className={`nr-primary-layout is-${target.level}`}>
      <section className="nr-primary-map" aria-label="แผนที่สถานการณ์">
        <div className="panel-header"><MapPin size={18} /><h2>แผนที่{future ? 'พยากรณ์' : 'สถานการณ์'}ภัยแล้ง</h2></div>
        <p className="nr-primary-map-period">{periodLabel} · {statusLabel}</p>
        <NakhonRatchasimaLocalMap target={target} layer={getNakhonRatchasimaMapLayers()[0]} mapMode="prediction-readiness"
          onNavigate={navigateArea} selectedMonth={period ?? ''} monthOptions={[]} onMonthChange={() => {}}
          researchCriteriaEnabled={false} showMonthFilter={false} compactForecast operationalUnavailable={mapContext} />
      </section>
      <aside className="nr-primary-aside">
        <section className="nr-primary-state" aria-live="polite" aria-busy={loading}>
          {error ? <TriangleAlert size={28} aria-hidden="true" /> : loading ? <RefreshCw size={28} aria-hidden="true" /> : <Database size={28} aria-hidden="true" />}
          <h2>{primaryTitle}</h2><p>{explanation}</p>
          {error ? <button className="secondary-button" type="button" onClick={invalid ? () => onNavigate(operationalPath(scopePath)) : data.retry}><RefreshCw size={16} />{invalid ? 'เลือกเดือนข้อมูลใหม่' : 'ลองอีกครั้ง'}</button>
            : !loading && <p className="nr-primary-caution">ไม่มีข้อมูล ไม่ได้หมายถึงไม่มีความเสี่ยง</p>}
        </section>
        <MetricGrid className="nr-primary-metrics" ariaLabel="ขอบเขตและความครอบคลุม" metrics={[
          { label: 'ขอบเขตพื้นที่', value: data.snapshot ? `${data.snapshot.expectedCount} ตำบล` : 'ยังตรวจสอบไม่ได้', icon: <MapPin size={20} />, tone: 'muted', detail: 'จำนวนพื้นที่ ไม่ใช่จำนวนที่มีผลประเมิน' },
          { label: 'ความครอบคลุมข้อมูล', value: 'ยังประเมินไม่ได้', icon: <CircleHelp size={20} />, tone: 'muted', detail: 'ยังไม่มีชุดข้อมูลที่เข้าเกณฑ์ ไม่แสดงเป็น 0%' },
        ]} />
        <DroughtOperationalDisclosure title="ที่มาและข้อจำกัด" description="สถานะการเชื่อมต่อข้อมูล" icon="data">
          <dl className="nr-primary-source-facts">
            <div><dt>ข้อมูลสถานการณ์จริง</dt><dd>ยังไม่มีชุดข้อมูล actual ที่ยืนยันและพร้อมเผยแพร่</dd></div>
            <div><dt>ข้อมูลพืชและชลประทาน</dt><dd>ยังไม่มี observations สำหรับเดือนนี้ ข้อมูลชลประทานในคลัง rev03 เป็นบริบทของชุดพยากรณ์ ไม่ใช่สถานะน้ำปัจจุบัน</dd></div>
            <div><dt>คลังพยากรณ์</dt><dd>rev03 เป็นคำพยากรณ์จากเดือนตั้งต้น T ถึง T+6 ไม่ใช่รายงานผลที่เกิดขึ้นจริง</dd></div>
            {data.snapshot?.partialPeriod && <div><dt>ข้อมูลระหว่างเดือน</dt><dd>ยังไม่มีวันที่ข้อมูลครอบคลุมถึง และไม่ใช่ผลสรุปทั้งเดือน</dd></div>}
          </dl>
        </DroughtOperationalDisclosure>
      </aside>
    </div>
  </div>;
}
