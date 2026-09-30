import { Database, FileUp, Files } from 'lucide-react';

export type AdminView = 'data' | 'imports' | 'upload';

export function adminViewFromSearch(search: string): AdminView {
  const params = new URLSearchParams(search);
  if (params.has('draft')) return 'imports';
  if (params.has('resource')) return 'data';
  const view = params.get('view');
  return view === 'imports' || view === 'upload' ? view : 'data';
}

const destinations = [
  { view: 'data', label: 'จัดการข้อมูล', path: '/admin', Icon: Database },
  { view: 'imports', label: 'รายการนำเข้าและฉบับร่าง', path: '/admin?view=imports', Icon: Files },
  { view: 'upload', label: 'นำเข้าข้อมูล', path: '/admin?view=upload', Icon: FileUp },
] as const;

export function AdminNavigation({ view, onNavigate }: { view: AdminView; onNavigate: (path: string) => void }) {
  return <nav id="primary-navigation" className="primary-nav admin-navigation" aria-label="เมนูผู้ดูแล">
    <p className="admin-navigation-label">พื้นที่ผู้ดูแล</p>
    {destinations.map(({ view: itemView, label, path, Icon }) => <a
      key={itemView} href={path} className={`nav-item${view === itemView ? ' active' : ''}`}
      aria-current={view === itemView ? 'page' : undefined} onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate(path);
      }}>
      <Icon size={17} aria-hidden="true" /><span>{label}</span>
    </a>)}
  </nav>;
}
