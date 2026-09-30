import { Plus, Trash2 } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { DATA_FIELDS, type DataKind } from '../../shared/dataFields.mjs';
import type { Json, Payload } from './types';
import { getNakhonRatchasimaDistrictByCode, getNakhonRatchasimaSubdistrictByCode } from '../domain';
import { choiceLabels, forecastChoice, monthLabel, riskOptions, updateForecastChoice } from './dataPresentation';

export function DataRecordForm({ kind, value, onChange }: { kind: DataKind; value: Payload; onChange: (value: Payload) => void }) {
  if (kind === 'archive') return <ForecastRecordForm value={value} onChange={onChange} />;
  const fields = DATA_FIELDS[kind];
  const change = (key: string, next: Json | undefined) => {
    const updated = { ...value };
    if (next === undefined) delete updated[key]; else updated[key] = next;
    onChange(updated);
  };
  return <div className="cms-field-grid">{fields.map(field => {
    const present = Object.prototype.hasOwnProperty.call(value, field.key);
    const current = value[field.key];
    const label = field.label;
    return <div className="cms-field" key={field.key}>
      <div className="cms-field-label"><span>{field.label}</span></div>
      {field.optional && <label className="cms-check"><input type="checkbox" checked={present}
        onChange={event => change(field.key, event.target.checked ? '' : undefined)} />ระบุข้อมูล</label>}
      {(!field.optional || present) && <>
        {field.nullable && <label className="cms-check"><input type="checkbox" checked={current === null}
          onChange={event => change(field.key, event.target.checked ? null : '')} />ไม่มีค่าจากต้นทาง</label>}
        {current !== null && (field.options ? <AppSelect ariaLabel={label} value={String(current ?? '')} align="start"
          options={[{ value: '', label: 'ยังไม่ระบุ' }, ...(!field.options.includes(String(current)) && current ? [{ value: String(current), label: `ค่าต้นทาง: ${current}` }] : []),
            ...field.options.map(option => ({ value: option, label: choiceLabels[option] ?? option }))]}
          onChange={next => change(field.key, next)} />
          : <input aria-label={label} value={typeof current === 'object' ? JSON.stringify(current) : String(current ?? '')}
            inputMode={field.type === 'number' ? 'decimal' : undefined}
            onChange={event => {
              const raw = event.target.value;
              const numeric = field.type === 'number' && raw.trim() !== '' && Number.isFinite(Number(raw));
              change(field.key, numeric ? Number(raw) : raw);
            }} />)}
      </>}
    </div>;
  })}{Object.keys(value).filter(key => !fields.some(field => field.key === key)).map(key => <div className="cms-field" key={key}>
    <span>คอลัมน์ {key}</span><span className="cms-warning">ข้อมูลเพิ่มเติมที่รูปแบบนี้ยังไม่รองรับ</span>
    <input aria-label={key} value={String(value[key] ?? '')} onChange={event => change(key, event.target.value)} />
    <button className="secondary-button" type="button" onClick={() => change(key, undefined)}><Trash2 size={16} />ไม่นำเข้าคอลัมน์นี้</button>
  </div>)}</div>;
}

function ForecastRecordForm({ value, onChange }: { value: Payload; onChange: (value: Payload) => void }) {
  const area = getNakhonRatchasimaSubdistrictByCode(String(value.subdistrictCode));
  const district = getNakhonRatchasimaDistrictByCode(area?.districtCode);
  const choice = forecastChoice(value);
  return <div className="cms-forecast-edit">
    <dl><div><dt>พื้นที่</dt><dd>{area ? `ต.${area.nameTh} · อ.${district?.nameTh ?? ''}` : `ไม่พบพื้นที่รหัส ${value.subdistrictCode}`}</dd></div>
      <div><dt>เดือนที่พยากรณ์</dt><dd>{monthLabel(value.targetMonth)} · ล่วงหน้า {String(value.horizonMonths)} เดือน</dd></div></dl>
    <p className="cms-help">พื้นที่และเดือนอ้างอิงจากต้นฉบับ เลือกผลพยากรณ์ที่ตรวจสอบแล้ว</p>
    {!choice && <p className="cms-warning" role="status">ค่าต้นทางยังสรุปไม่ได้: {String(value.riskCode ?? 'ไม่มีค่า')} กรุณาตรวจต้นฉบับก่อนเลือกผลพยากรณ์</p>}
    <AppSelect label="ผลพยากรณ์" ariaLabel="ผลพยากรณ์" value={choice} options={[{ value: '', label: 'เลือกระดับที่ตรวจสอบแล้ว', disabled: true }, ...riskOptions]}
      onChange={next => onChange(updateForecastChoice(value, next))} />
    <p className="cms-help">“นอกขอบเขตการศึกษา” หมายถึงไม่มีค่าพยากรณ์สำหรับพื้นที่นั้น ไม่ใช่ “ไม่พบความเสี่ยง”</p>
  </div>;
}

const metaLabels: Record<string, string> = { sourceId: 'รหัสแหล่งข้อมูล', batchId: 'รหัสชุดข้อมูล', runId: 'รหัสการรันแบบจำลอง',
  modelVersion: 'รุ่นแบบจำลอง', originMonth: 'เดือนตั้งต้น (YYYY-MM)', informationCutoff: 'เวลาตัดข้อมูล (ISO พร้อมเขตเวลา)',
  createdAt: 'เวลาสร้างผลพยากรณ์ (ISO พร้อมเขตเวลา)', scope: 'ขอบเขตพื้นที่', subdistrictCodes: 'รหัสตำบล', inputBatches: 'ชุดข้อมูลต้นทาง', contentHash: 'SHA-256 ของชุดข้อมูล' };

/** Structured metadata stays structured; operators never need to edit JSON. */
export function MetadataForm({ value, onChange, prefix = '' }: { value: Payload; onChange: (value: Payload) => void; prefix?: string }) {
  return <div className="cms-field-grid">{Object.entries(value).map(([key, current]) => {
    if (['schemaVersion', 'kind', 'observations', 'predictions'].includes(key)) return null;
    const name = `${prefix}${key}`;
    const change = (next: Json) => onChange({ ...value, [key]: next });
    return <div className={`cms-field${current && typeof current === 'object' ? ' is-full' : ''}`} key={key}>
      <div className="cms-field-label"><span>{metaLabels[key] ?? key}</span></div>
      {Array.isArray(current) ? <div className="cms-array">{current.map((item, index) => <div key={index} className="cms-array-row">
        {item && typeof item === 'object' && !Array.isArray(item)
          ? <MetadataForm value={item} prefix={`${name}.${index}.`} onChange={next => change(current.map((entry, i) => i === index ? next : entry))} />
          : <input aria-label={`${name} ${index + 1}`} value={String(item ?? '')} onChange={event => change(current.map((entry, i) => i === index ? event.target.value : entry))} />}
        <button type="button" className="icon-button" title="นำรายการออก" aria-label={`นำ ${name} ${index + 1} ออก`}
          onClick={() => change(current.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
      </div>)}<button className="secondary-button" type="button" onClick={() => change([...current, key === 'inputBatches'
        ? { sourceId: '', batchId: '', contentHash: '' } : ''])}><Plus size={16} />เพิ่มรายการ</button></div>
        : current && typeof current === 'object' ? <MetadataForm value={current} prefix={`${name}.`} onChange={change} />
        : <input aria-label={metaLabels[key] ?? key} value={String(current ?? '')}
          onChange={event => change(typeof current === 'number' && Number.isFinite(Number(event.target.value)) ? Number(event.target.value) : event.target.value)} />}
    </div>;
  })}</div>;
}
