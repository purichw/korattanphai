import { ArchiveX } from 'lucide-react';
import { archivePath } from '../operationalLocation';

export function ArchiveUnavailableState({ invalidHorizon = false }: { invalidHorizon?: boolean }) {
  return <section className="nr-primary-state" role="status"><ArchiveX size={28} aria-hidden="true" />
    <h2>{invalidHorizon ? 'ระยะพยากรณ์ในลิงก์ไม่ถูกต้อง' : 'ไม่มีเดือนตั้งต้นที่เลือกในคลังพยากรณ์'}</h2>
    <p>ไม่ได้ใช้เดือนล่าสุดหรือคำพยากรณ์รอบอื่นมาแทนข้อมูลที่เลือก</p>
    {/* Reset the failed query with a fresh page; same-path SPA navigation retains it. */}
    <a className="secondary-button" href={archivePath(window.location.pathname)} onClick={event => event.stopPropagation()}>เลือกเดือนในคลังใหม่</a>
  </section>;
}
