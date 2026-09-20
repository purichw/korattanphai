import { ArchiveX } from 'lucide-react';
import { archivePath } from '../operationalLocation';

export function ArchiveUnavailableState({ invalidHorizon = false }: { invalidHorizon?: boolean }) {
  return <section className="nr-primary-state" role="status"><ArchiveX size={28} aria-hidden="true" />
    <h2>{invalidHorizon ? 'ระยะพยากรณ์ในลิงก์ไม่ถูกต้อง' : 'ไม่มีเดือนตั้งต้นที่เลือกในคลังพยากรณ์'}</h2>
    <p>ไม่ได้ใช้เดือนล่าสุดหรือคำพยากรณ์รอบอื่นมาแทนข้อมูลที่เลือก</p>
    <a className="secondary-button" href={archivePath(window.location.pathname)}>เลือกเดือนในคลังใหม่</a>
  </section>;
}
