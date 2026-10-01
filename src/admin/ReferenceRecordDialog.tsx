import { Building2, CheckCircle2, FileText, Hash, Info, Map, MapPin, MapPinned, Pencil, Radio } from 'lucide-react';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import type { ReferenceRow, resourceViews } from './resourcePresentation';

/** Read-only presentation of the existing projection and resource revision. */
export function ReferenceRecordDialog({ title, view, columns, row, revision, state, onClose }: {
  title: string; view?: (typeof resourceViews)[string]; columns: string[]; row: ReferenceRow;
  revision: number; state: 'draft' | 'published'; onClose: () => void;
}) {
  const areas = view?.view === 'areas';
  const geometry = view?.view === 'geometry';
  const CategoryIcon = areas ? Building2 : geometry ? Map : Radio;
  const category = areas ? 'ข้อมูลพื้นที่' : geometry ? 'ชั้นข้อมูลแผนที่' : 'ข้อมูลอ้างอิง';
  const sectionTitle = areas ? 'ข้อมูลอำเภอและตำบล' : geometry ? 'รายละเอียดพื้นที่' : title;
  const PublishedIcon = state === 'published' ? CheckCircle2 : Pencil;
  return <WorkspaceDialog title="รายละเอียดรายการ" description={areas ? 'ข้อมูลอำเภอและตำบลในจังหวัดนครราชสีมา' : title}
    className="cms-record-dialog" bounded onClose={onClose} closeLabel="ปิดรายละเอียดรายการ"
    footer={<><p><FileText size={17} aria-hidden="true" /><span>ข้อมูลอ้างอิงสำหรับตรวจสอบ · รุ่นแก้ไข {revision}</span></p><button className="secondary-button" type="button" onClick={onClose}>ปิด</button></>}>
    <div className="cms-record-dialog-meta"><span><CategoryIcon size={17} aria-hidden="true" />{category}</span><span><FileText size={16} aria-hidden="true" />รุ่นแก้ไข {revision}</span>
      <span className={`cms-record-dialog-status ${state === 'published' ? 'is-published' : 'is-draft'}`}><PublishedIcon size={15} aria-hidden="true" />{state === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}</span></div>
    <section className="cms-record-dialog-fields" aria-label={sectionTitle}><h3><MapPinned size={20} aria-hidden="true" />{sectionTitle}</h3>
      <dl>{columns.map((column, index) => {
        const Icon = areas ? [Building2, MapPin, Hash][index] ?? FileText : column.includes('รหัส') ? Hash : column.includes('พื้นที่') || column.includes('ตำบล') ? MapPin : FileText;
        return <div key={column}><dt><Icon size={18} aria-hidden="true" /><span>{column}</span></dt><dd>{row.cells[index]}</dd></div>;
      })}</dl></section>
    {view?.description && <aside className="cms-record-dialog-description"><Info size={20} aria-hidden="true" /><div><h3>คำอธิบายรายการ</h3><p>{view.description}{areas && ' รหัสตำบลช่วยแยกพื้นที่ที่มีชื่อเหมือนกัน'}</p></div></aside>}
  </WorkspaceDialog>;
}
