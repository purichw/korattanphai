import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import '../app-startup.css';

/** Public presentation only: no session, workspace or data imports. */
export function AppStartup({ path, message = 'กำลังเตรียมข้อมูลให้คุณ' }: { path: string; message?: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 20_000);
    return () => window.clearTimeout(timer);
  }, []);

  return <section className="app-startup" lang="th" aria-label="กำลังเปิดโคราชทันภัย">
    <div className="app-startup-brand">
      <img src="/brand/korat-tan-phai-emblem.webp" width="192" height="192" alt="" fetchPriority="high" />
      <h1>โคราชทันภัย</h1>
      <p className="app-startup-caption">{path.startsWith('/admin') ? 'จัดการข้อมูล · นครราชสีมา' : 'Korat Tan Phai'}</p>
      <div className="app-startup-track" aria-hidden="true"><span /></div>
      <p className="app-startup-message" role="status">{message}</p>
      {slow && <div className="app-startup-recovery">
        <p>ใช้เวลานานกว่าปกติ กรุณาตรวจสอบการเชื่อมต่อ</p>
        <button type="button" className="secondary-button" onClick={() => window.location.reload()}><RotateCcw size={16} aria-hidden="true" />โหลดหน้าใหม่</button>
      </div>}
    </div>
  </section>;
}
