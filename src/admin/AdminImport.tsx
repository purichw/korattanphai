import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, ArrowLeft, ArrowRight, Download } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { MonthSelect } from '../components/MonthSelect';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { DATA_FIELDS, type DataKind } from '../../shared/dataFields.mjs';
import { MetadataForm } from './DataRecordForm';
import { kindLabels, rowsKey, type Payload, type Draft } from './types';
import type { ImportFile, ImportSheet } from './workbook';
import type { createAdminClient } from './client';
import { isOriginalForecastSheet, workbookOrigins, importOriginalForecast, matchRev3Columns, normalizeRev3Sheet, rev3Fields, riskHelp } from './normalizedForecastImport';
import type { CsvEncoding, DataFileFormat } from './readDataFile';
import templateUrl from '../assets/rev3-import-template.xlsx?url';
import csvTemplateUrl from '../assets/rev3-import-template.csv?url';
import { readWorkbookInWorker } from './readWorkbook';
import { ConfirmAction } from './ConfirmAction';
import { useUnsavedChanges } from './useUnsavedChanges';
import { monthLabel } from './dataPresentation';

export function emptyEnvelope(kind: DataKind): Payload {
  if (kind === 'archive') return { schemaVersion: 1, baseDatasetId: '', originMonth: '', scope: { subdistrictCodes: [] }, predictions: [] };
  return kind === 'forecast' ? { schemaVersion: 1, runId: '', modelVersion: '', originMonth: '',
    informationCutoff: '', createdAt: '', scope: { subdistrictCodes: [] }, inputBatches: [], predictions: [] }
    : { schemaVersion: 1, sourceId: '', batchId: '', ...(kind === 'station' ? {} : { kind }), observations: [] };
}

export function AdminImport({ api, onClose, onCreated }: { api: ReturnType<typeof createAdminClient>; onClose: () => void; onCreated: (draft: Draft) => void }) {
  const [kind, setKind] = useState<DataKind>('archive');
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
  const [csvEncoding, setCsvEncoding] = useState<CsvEncoding>('utf-8');
  const reading = useRef<AbortController | null>(null);
  const lastFile = useRef<File | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const allowSavedNavigation = useUnsavedChanges(Boolean(payload || sheet) || busy, setError);
  useEffect(() => () => reading.current?.abort(), []);
  const rev3 = kind === 'archive' && !book?.metadata?.baseDatasetId;
  const parsed = useMemo(() => {
    if (!sheet || !rev3) return { sheet: null, periods: [] as string[], error: '' };
    try {
      const normalized = normalizeRev3Sheet(sheet, mapping);
      return { sheet: normalized, periods: workbookOrigins(normalized), error: '' };
    } catch (failure) { return { sheet: null, periods: [] as string[], error: failure instanceof Error ? failure.message : 'ตรวจรูปแบบไม่สำเร็จ' }; }
  }, [sheet, mapping, rev3]);
  useEffect(() => { if (!parsed.periods.includes(origin)) setOrigin(parsed.periods[0] ?? ''); }, [parsed, origin]);
  function selectSheet(next: ImportSheet, nextKind = kind, metadata = book?.metadata) {
    setSheet(next); setIgnored([]); setRowStart(1);
    if (isOriginalForecastSheet(next)) { nextKind = 'archive'; setKind('archive'); }
    setMapping(nextKind === 'archive' && !metadata?.baseDatasetId ? matchRev3Columns(next)
      : Object.fromEntries(DATA_FIELDS[nextKind].map(field => [field.key, next.columns.includes(field.key) ? field.key : next.columns.includes(field.label) ? field.label : ''])));
  }
  async function read(file?: File, encoding = csvEncoding) {
    if (!file) return;
    lastFile.current = file;
    setBusy(true); setError(''); setPayload(null); setBook(null); setSheet(null); setCatalog(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('ไฟล์เกิน 20 MB');
      setFilename(file.name); setTitle(file.name.replace(/\.[^.]+$/, ''));
      if (file.name.toLowerCase().endsWith('.json')) {
        const next = JSON.parse(await file.text()) as Payload;
        if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('ไฟล์นี้ไม่ใช่ชุดข้อมูลที่รองรับ กรุณาเลือกไฟล์ที่ส่งออกจากระบบ');
        const nextKind: DataKind = 'predictions' in next ? ('baseDatasetId' in next ? 'archive' : 'forecast') : next.kind === 'satellite' ? 'satellite' : next.kind === 'crop' ? 'crop' : 'station';
        if (nextKind === 'forecast') throw new Error('การนำเข้าผลแบบจำลองใหม่ยังไม่เปิดใช้ เลือกไฟล์พยากรณ์รอบเดิมที่ส่งออกจากระบบ');
        if (!Array.isArray(next[rowsKey(nextKind)])) throw new Error('ไม่พบตารางข้อมูลในไฟล์ กรุณาเลือกไฟล์ที่ส่งออกจากระบบ');
        setKind(nextKind); setPayload(next);
      } else if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        const bytes = await file.arrayBuffer();
        setFileHash([...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join(''));
        reading.current = new AbortController();
        const imported = await readWorkbookInWorker(bytes, reading.current.signal, file.name.split('.').pop()!.toLowerCase() as DataFileFormat, encoding);
        const nextKind: DataKind = imported.metadata?.kind === 'satellite' ? 'satellite' : imported.metadata?.kind === 'crop' ? 'crop'
          : imported.metadata?.baseDatasetId !== undefined ? 'archive' : imported.metadata?.runId !== undefined ? 'forecast'
          : imported.metadata?.sourceId !== undefined && imported.metadata?.batchId !== undefined ? 'station' : kind;
        if (nextKind === 'forecast') throw new Error('การนำเข้าผลแบบจำลองใหม่ยังไม่เปิดใช้ เลือกไฟล์พยากรณ์รอบเดิมที่ส่งออกจากระบบ');
        const initial = imported.sheets.find(isOriginalForecastSheet) ?? imported.sheets[0];
        setKind(nextKind); setBook(imported); selectSheet(initial, nextKind, imported.metadata);
        if (nextKind === 'archive' || imported.sheets.some(isOriginalForecastSheet)) setCatalog(await api<NonNullable<typeof catalog>>('forecast-catalog'));
      } else throw new Error('รองรับ CSV, Excel .xlsx และ .xls หรือ JSON ที่ส่งออกจากระบบ');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'อ่านไฟล์ไม่สำเร็จ'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  async function prepare() {
    if (!sheet) return;
    setError(''); setBusy(true);
    try {
      if (rev3) {
        if (!parsed.sheet || !origin) throw new Error(parsed.error || 'ยังไม่มีแถวข้อมูล กรุณากรอกข้อมูลตามแม่แบบ');
        if (!catalog?.revision || !catalog.periods.includes(origin)) throw new Error('รอบเดือนนี้ยังไม่มีในคลังที่เผยแพร่ การเพิ่มรอบใหม่ยังไม่เปิดใช้');
        const base = await api<Payload>('forecast-source', { body: { datasetId: catalog.revision.datasetId, originMonth: origin } });
        const crosswalk = await api<{ sourceId: number; subdistrictCode: string }[]>('forecast-crosswalk');
        const next = importOriginalForecast(parsed.sheet, base, crosswalk, origin);
        const sourceRows = parsed.sheet.rows.flatMap((row, index) => `${row.Year}-${String(row.Month).padStart(2, '0')}` === origin ? [{ sourceRow: sheet.sourceRows?.[index] ?? index + 2, values: sheet.rows[index] }] : []);
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
    <fieldset className="cms-import" aria-busy={busy} disabled={busy}>
      <p className="cms-help">อัปโหลด CSV หรือ Excel รุ่นใหม่ (.xlsx) และรุ่นเก่า (.xls) ขนาดไม่เกิน 20 MB ตรวจข้อมูลก่อนบันทึกเป็นฉบับร่าง การนำเข้ายังไม่เปลี่ยนเว็บไซต์</p>
      {error && <p className="cms-error" role="alert">{error}</p>}
      {!payload ? <>
        <div className="cms-import-controls"><AppSelect label="ประเภทข้อมูล" ariaLabel="ประเภทข้อมูล" value={kind}
          options={Object.entries(kindLabels).filter(([value]) => value !== 'forecast').map(([value, label]) => ({ value, label }))}
          onChange={value => { setKind(value as DataKind); if (sheet) selectSheet(sheet, value as DataKind); }} />
          <input ref={input} className="sr-only" type="file" accept=".xlsx,.xls,.csv,.json" disabled={busy} aria-label="ไฟล์ข้อมูล"
            onChange={event => { void read(event.target.files?.[0]); }} />
          <button className="primary-button" type="button" disabled={busy} onClick={() => input.current?.click()}><FileUp size={18} />{busy ? 'กำลังอ่านไฟล์' : 'เลือกไฟล์'}</button></div>
        {kind !== 'archive' && <p className="cms-help">ข้อมูลประเภทนี้รับเก็บจากไฟล์เท่านั้น ยังไม่ใช้สร้างพยากรณ์หรือแสดงบนแผนที่อัตโนมัติ</p>}
        {kind === 'archive' && <section className="cms-import-guide" aria-labelledby="cms-import-guide-title"><h3 id="cms-import-guide-title">เริ่มจากแม่แบบพยากรณ์ rev3</h3>
          <p>เตรียมรายชื่อ 289 ตำบลให้แล้ว กรอกปี–เดือนต้นทางและผลล่วงหน้า 1–6 เดือนในชีต “ข้อมูลพยากรณ์” ดูตัวอย่างและคำอธิบายได้ในชีตแยก</p>
          <div className="cms-actions cms-template-downloads"><a className="secondary-button" href={templateUrl} download="Korat_rev3_template.xlsx"><Download size={16} />แม่แบบ Excel พร้อมคำอธิบาย</a>
            <a className="secondary-button" href={csvTemplateUrl} download="Korat_rev3_template.csv"><Download size={16} />แม่แบบ CSV</a></div>
          <p className="cms-help">CSV มีได้เพียงตารางเดียว ใช้คำอธิบายด้านล่างหรือในแม่แบบ Excel ประกอบ กรอกให้ครบ 289 ตำบลต่อรอบเดือน ระบบยังรับเฉพาะเดือนต้นทางที่มีอยู่ในคลัง</p>
          <details className="cms-import-dictionary"><summary>ความหมายของ 12 คอลัมน์และตัวอย่าง</summary><p>{riskHelp}</p>
            <dl>{rev3Fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.description}<small>ตัวอย่าง: {field.example}</small></dd></div>)}</dl></details>
        </section>}
        <details className="cms-technical"><summary>หากภาษาไทยใน CSV อ่านไม่ออก</summary><AppSelect label="ภาษาในไฟล์ CSV" value={csvEncoding}
          options={[{ value: 'utf-8', label: 'UTF-8 (ทั่วไป)' }, { value: 'windows-874', label: 'ภาษาไทยจาก Excel รุ่นเก่า' }]}
          onChange={value => { setCsvEncoding(value as CsvEncoding); if (lastFile.current?.name.toLowerCase().endsWith('.csv')) void read(lastFile.current, value as CsvEncoding); }} /></details>
        {book && sheet && <>
          <AppSelect label="ชีต" ariaLabel="ชีตข้อมูล" value={sheet.name} options={book.sheets.map(item => ({ value: item.name, label: `${item.name} · ${item.rows.length} รายการ` }))}
            onChange={value => selectSheet(book.sheets.find(item => item.name === value)!)} />
          {rev3 ? <><h3>พยากรณ์ล่วงหน้า 1–6 เดือนจากต้นฉบับ</h3>
            <details className="cms-import-mapping" open={rev3Fields.some(field => !mapping[field.key]) ? true : undefined}><summary>ตรวจการจับคู่คอลัมน์ ({rev3Fields.filter(field => mapping[field.key]).length} / 12 ช่อง)</summary>
              <div className="cms-mapping">{rev3Fields.map(field => <div key={field.key}><div><strong>{field.label}</strong><p>{field.description}</p><small>ตัวอย่างที่กรอกได้: {field.example}</small>
                {mapping[field.key] && <small>พบในไฟล์: {sheet.rows.slice(0, 3).map(row => String(row[mapping[field.key]] ?? '') || 'ช่องว่าง').join(' · ')}</small>}</div>
                <AppSelect ariaLabel={`คอลัมน์ ${field.label}`} value={mapping[field.key] ?? ''} searchable options={[{ value: '', label: 'เลือกคอลัมน์ในไฟล์' }, ...sheet.columns.map(column => ({ value: column, label: column }))]}
                  onChange={value => setMapping(current => ({ ...current, [field.key]: value }))} /></div>)}</div>
            </details>
            {parsed.error && <p className="cms-warning" role="status">{parsed.error}</p>}
            {parsed.periods.length > 0 && <><MonthSelect ariaLabel="เดือนตั้งต้นในไฟล์นำเข้า" value={origin} onChange={setOrigin}
              options={parsed.periods.map(value => ({ value, label: monthLabel(value) }))} /><p>{sheet.rows.length.toLocaleString('th-TH')} แถวต้นฉบับ · นำเข้าเฉพาะ {monthLabel(origin)} ทีละรอบเดือน</p></>}
            {catalog && origin && !catalog.periods.includes(origin) && <p className="cms-warning">รอบเดือนนี้ยังไม่มีในคลัง การเพิ่มรอบใหม่ยังไม่เปิดใช้</p>}
            <p className="cms-help">{riskHelp}</p>
          </> : <><h3>จับคู่คอลัมน์</h3><div className="cms-mapping">{DATA_FIELDS[kind].map(field => <div key={field.key}>
            <span>{field.label}{field.optional && <small>ไม่บังคับ</small>}</span>
            <AppSelect ariaLabel={`คอลัมน์ ${field.label}`} value={mapping[field.key] ?? ''} searchable
              options={[{ value: '', label: 'ยังไม่จับคู่' }, ...sheet.columns.map(column => ({ value: column, label: column }))]}
              onChange={value => setMapping(current => ({ ...current, [field.key]: value }))} />
          </div>)}</div>
          {sheet.columns.filter(column => !Object.values(mapping).includes(column)).map(column => <label className="cms-check" key={column}>
            <input type="checkbox" checked={ignored.includes(column)} onChange={event => setIgnored(current => event.target.checked ? [...current, column] : current.filter(item => item !== column))} />ไม่นำเข้าคอลัมน์ {column}</label>)}
          {sheet.rows.length > 2000 && <label className="cms-field">ช่วงรายการนำเข้า<AppSelect ariaLabel="ช่วงรายการนำเข้า" value={String(rowStart)}
            options={Array.from({ length: Math.ceil(sheet.rows.length / 2000) }, (_, index) => ({ value: String(index * 2000 + 1), label: `${index * 2000 + 1}–${Math.min(sheet.rows.length, (index + 1) * 2000)} จาก ${sheet.rows.length} รายการ` }))}
            onChange={value => setRowStart(Number(value))} /></label>}</>}
          <footer className="cms-actions"><button className="primary-button" type="button" disabled={busy || (rev3 && (!parsed.sheet || !catalog?.revision || !catalog.periods.includes(origin)))} onClick={() => { void prepare(); }}>ตรวจรายละเอียด<ArrowRight size={18} /></button></footer>
        </>}
      </> : <>
        <div className="cms-import-summary"><strong>{kindLabels[kind]}</strong><span>{(payload[rowsKey(kind)] as Payload[]).length} รายการ · {filename}</span></div>
        <label className="cms-field">ชื่อชุดข้อมูล<input value={title} maxLength={160} onChange={event => setTitle(event.target.value)} /></label>
        {kind === 'archive' ? <p>ข้อมูลต้นทาง {monthLabel(payload.originMonth)} · {(payload.predictions as Payload[]).length} ค่าพยากรณ์</p>
          : <MetadataForm value={{ ...emptyEnvelope(kind), ...payload }} onChange={setPayload} />}
        <footer className="cms-actions">
          <button className="secondary-button" type="button" disabled={busy} onClick={() => setPayload(null)}><ArrowLeft size={18} />ย้อนกลับ</button>
          <button className="primary-button" type="button" disabled={busy || !title.trim()} onClick={() => { void save(); }}>{busy ? 'กำลังบันทึก' : 'สร้างฉบับร่าง'}</button>
        </footer>
      </>}
    </fieldset>
  </WorkspaceDialog>{confirmDiscard && <ConfirmAction title="ยังไม่บันทึกฉบับร่าง" message="ไฟล์ที่เลือกยังไม่ถูกบันทึกเข้าระบบ"
    confirmLabel="ปิดโดยไม่บันทึก" onCancel={() => setConfirmDiscard(false)} onConfirm={onClose} />}</>;
}
