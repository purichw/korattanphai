import { useEffect, useRef, useState } from 'react';
import { FileUp, ArrowLeft, ArrowRight } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { MonthSelect } from '../components/MonthSelect';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { DATA_FIELDS, type DataKind } from '../../shared/dataFields.mjs';
import { MetadataForm } from './DataRecordForm';
import { kindLabels, rowsKey, type Payload, type Draft } from './types';
import type { ImportFile, ImportSheet } from './workbook';
import type { createAdminClient } from './client';
import { isOriginalForecastSheet, workbookOrigins, importOriginalForecast } from './normalizedForecastImport';
import { readWorkbookInWorker } from './readWorkbook';
import { ConfirmAction } from './ConfirmAction';
import { useUnsavedChanges } from './useUnsavedChanges';

export function emptyEnvelope(kind: DataKind): Payload {
  if (kind === 'archive') return { schemaVersion: 1, baseDatasetId: '', originMonth: '', scope: { subdistrictCodes: [] }, predictions: [] };
  return kind === 'forecast' ? { schemaVersion: 1, runId: '', modelVersion: '', originMonth: '',
    informationCutoff: '', createdAt: '', scope: { subdistrictCodes: [] }, inputBatches: [], predictions: [] }
    : { schemaVersion: 1, sourceId: '', batchId: '', ...(kind === 'station' ? {} : { kind }), observations: [] };
}

export function AdminImport({ api, onClose, onCreated }: { api: ReturnType<typeof createAdminClient>; onClose: () => void; onCreated: (draft: Draft) => void }) {
  const [kind, setKind] = useState<DataKind>('station');
  const [title, setTitle] = useState('');
  const [filename, setFilename] = useState('');
  const [book, setBook] = useState<ImportFile | null>(null);
  const [sheet, setSheet] = useState<ImportSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [ignored, setIgnored] = useState<string[]>([]);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileHash, setFileHash] = useState('');
  const [origin, setOrigin] = useState('');
  const [catalog, setCatalog] = useState<{ revision: { datasetId: string }; periods: string[] } | null>(null);
  const [rowStart, setRowStart] = useState(1);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const reading = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const allowSavedNavigation = useUnsavedChanges(Boolean(payload || sheet) || busy, setError);
  useEffect(() => () => reading.current?.abort(), []);
  function selectSheet(next: ImportSheet, nextKind = kind) {
    setSheet(next); setIgnored([]); setRowStart(1);
    if (isOriginalForecastSheet(next)) { setKind('archive'); setOrigin(workbookOrigins(next)[0] ?? ''); }
    setMapping(Object.fromEntries(DATA_FIELDS[nextKind].map(field => [field.key, next.columns.includes(field.key) ? field.key : ''])));
  }
  async function read(file?: File) {
    if (!file) return;
    setBusy(true); setError(''); setPayload(null); setBook(null); setSheet(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('ไฟล์เกิน 20 MB');
      setFilename(file.name); setTitle(file.name.replace(/\.[^.]+$/, ''));
      if (file.name.toLowerCase().endsWith('.json')) {
        const next = JSON.parse(await file.text()) as Payload;
        const nextKind: DataKind = 'predictions' in next ? ('baseDatasetId' in next ? 'archive' : 'forecast') : next.kind === 'satellite' ? 'satellite' : next.kind === 'crop' ? 'crop' : 'station';
        if (!next || typeof next !== 'object' || !Array.isArray(next[rowsKey(nextKind)])) throw new Error('ไม่พบ observations หรือ predictions ตามรูปแบบ API');
        setKind(nextKind); setPayload(next);
      } else if (file.name.toLowerCase().endsWith('.xlsx')) {
        const bytes = await file.arrayBuffer();
        setFileHash([...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join(''));
        reading.current = new AbortController();
        const imported = await readWorkbookInWorker(bytes, reading.current.signal);
        const nextKind: DataKind = imported.metadata?.kind === 'satellite' ? 'satellite' : imported.metadata?.kind === 'crop' ? 'crop'
          : imported.metadata?.baseDatasetId !== undefined ? 'archive' : imported.metadata?.runId !== undefined ? 'forecast' : kind;
        setKind(nextKind); setBook(imported); selectSheet(imported.sheets[0], nextKind);
        if (imported.sheets.some(isOriginalForecastSheet)) setCatalog(await api<NonNullable<typeof catalog>>('forecast-catalog'));
      } else throw new Error('รองรับไฟล์ .xlsx และ .json');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'อ่านไฟล์ไม่สำเร็จ'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  async function prepare() {
    if (!sheet) return;
    setError(''); setBusy(true);
    try {
      if (isOriginalForecastSheet(sheet)) {
        if (!catalog?.revision || !catalog.periods.includes(origin)) throw new Error('รอบเดือนนี้ยังไม่มีในคลังที่เผยแพร่ การเพิ่มรอบใหม่ยังไม่เปิดใช้');
        const base = await api<Payload>('forecast-source', { body: { datasetId: catalog.revision.datasetId, originMonth: origin } });
        const crosswalk = await api<{ sourceId: number; subdistrictCode: string }[]>('forecast-crosswalk');
        const next = importOriginalForecast(sheet, base, crosswalk, origin);
        const sourceRows = sheet.rows.flatMap((row, index) => `${row.Year}-${String(row.Month).padStart(2, '0')}` === origin ? [{ sourceRow: index + 2, values: row }] : []);
        setPayload({ ...next, sourceImport: { sha256: fileHash, sheet: sheet.name, rows: sourceRows } });
        return;
      }
      const { mapImportRows } = await import('./workbook');
      const batch = { ...sheet, rows: sheet.rows.slice(rowStart - 1, rowStart - 1 + 2000) };
      setPayload({ ...emptyEnvelope(kind), ...book?.metadata, [rowsKey(kind)]: mapImportRows(kind, batch, mapping, ignored) });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'จับคู่คอลัมน์ไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError('');
    try {
      const draft = await api<Draft>('create', { body: { title, kind, payload, sourceFilename: filename } });
      allowSavedNavigation();
      onCreated(draft);
    }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'สร้างฉบับร่างไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  const close = () => {
    if (busy) { reading.current?.abort(); return; }
    if (payload || sheet) { setConfirmDiscard(true); return; }
    onClose();
  };
  return <><WorkspaceDialog title="นำเข้าชุดข้อมูล" wide bounded closeLabel="ปิดการนำเข้าข้อมูล" onClose={close}>
    <div className="cms-import" aria-busy={busy}>
      {error && <p className="cms-error" role="alert">{error}</p>}
      {!payload ? <>
        <div className="cms-import-controls"><AppSelect label="ประเภทข้อมูล" ariaLabel="ประเภทข้อมูล" value={kind}
          options={Object.entries(kindLabels).filter(([value]) => value !== 'archive' || kind === 'archive').map(([value, label]) => ({ value, label }))}
          onChange={value => { setKind(value as DataKind); if (sheet) selectSheet(sheet, value as DataKind); }} />
          <input ref={input} className="sr-only" type="file" accept=".xlsx,.json" disabled={busy} aria-label="ไฟล์ข้อมูล"
            onChange={event => { void read(event.target.files?.[0]); }} />
          <button className="primary-button" type="button" disabled={busy} onClick={() => input.current?.click()}><FileUp size={18} />{busy ? 'กำลังอ่านไฟล์' : 'เลือกไฟล์'}</button></div>
        {book && sheet && <>
          <AppSelect label="ชีต" ariaLabel="ชีตข้อมูล" value={sheet.name} options={book.sheets.map(item => ({ value: item.name, label: `${item.name} · ${item.rows.length} รายการ` }))}
            onChange={value => selectSheet(book.sheets.find(item => item.name === value)!)} />
          {isOriginalForecastSheet(sheet) ? <><h3>พยากรณ์ T+1–T+6 จากต้นฉบับ</h3><MonthSelect ariaLabel="เดือนตั้งต้นในไฟล์นำเข้า" value={origin} onChange={setOrigin}
            options={workbookOrigins(sheet).map(value => ({ value, label: value }))} /><p>{sheet.rows.length.toLocaleString('th-TH')} แถวต้นฉบับ · รอบที่เลือก {origin}</p>
            {catalog && !catalog.periods.includes(origin) && <p className="cms-warning">รอบเดือนนี้ยังไม่มีในคลัง การเพิ่มรอบใหม่ยังไม่เปิดใช้</p>}
          </> : <><h3>จับคู่คอลัมน์</h3><div className="cms-mapping">{DATA_FIELDS[kind].map(field => <div key={field.key}>
            <span>{field.label}<small>{field.key}{field.optional ? ' · ไม่บังคับ' : ''}</small></span>
            <AppSelect ariaLabel={`คอลัมน์ ${field.key}`} value={mapping[field.key] ?? ''} align="start" searchable
              options={[{ value: '', label: 'ยังไม่จับคู่' }, ...sheet.columns.map(column => ({ value: column, label: column }))]}
              onChange={value => setMapping(current => ({ ...current, [field.key]: value }))} />
          </div>)}</div>
          {sheet.columns.filter(column => !Object.values(mapping).includes(column)).map(column => <label className="cms-check" key={column}>
            <input type="checkbox" checked={ignored.includes(column)} onChange={event => setIgnored(current => event.target.checked ? [...current, column] : current.filter(item => item !== column))} />ไม่นำเข้าคอลัมน์ {column}</label>)}
          {sheet.rows.length > 2000 && <label className="cms-field">ช่วงรายการนำเข้า<AppSelect ariaLabel="ช่วงรายการนำเข้า" value={String(rowStart)}
            options={Array.from({ length: Math.ceil(sheet.rows.length / 2000) }, (_, index) => ({ value: String(index * 2000 + 1), label: `${index * 2000 + 1}–${Math.min(sheet.rows.length, (index + 1) * 2000)} จาก ${sheet.rows.length} รายการ` }))}
            onChange={value => setRowStart(Number(value))} /></label>}</>}
          <footer className="cms-actions"><button className="primary-button" type="button" disabled={busy} onClick={() => { void prepare(); }}>ตรวจรายละเอียด<ArrowRight size={18} /></button></footer>
        </>}
      </> : <>
        <div className="cms-import-summary"><strong>{kindLabels[kind]}</strong><span>{(payload[rowsKey(kind)] as Payload[]).length} รายการ · {filename}</span></div>
        <label className="cms-field">ชื่อชุดข้อมูล<input value={title} maxLength={160} onChange={event => setTitle(event.target.value)} /></label>
        {kind === 'archive' ? <p>เดือนตั้งต้น {String(payload.originMonth)} · {(payload.predictions as Payload[]).length} ค่าพยากรณ์</p>
          : <MetadataForm value={{ ...emptyEnvelope(kind), ...payload }} onChange={setPayload} />}
        <footer className="cms-actions">
          <button className="secondary-button" type="button" disabled={busy} onClick={() => setPayload(null)}><ArrowLeft size={18} />ย้อนกลับ</button>
          <button className="primary-button" type="button" disabled={busy || !title.trim()} onClick={() => { void save(); }}>{busy ? 'กำลังบันทึก' : 'สร้างฉบับร่าง'}</button>
        </footer>
      </>}
    </div>
  </WorkspaceDialog>{confirmDiscard && <ConfirmAction title="ยังไม่บันทึกฉบับร่าง" message="ไฟล์ที่เลือกยังไม่ถูกบันทึกเข้าระบบ"
    confirmLabel="ปิดโดยไม่บันทึก" onCancel={() => setConfirmDiscard(false)} onConfirm={onClose} />}</>;
}
