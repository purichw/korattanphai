import { SearchX, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function WorkspaceEmptyState({ title, description, icon: Icon = SearchX, action, className = '', heading = 'h3', role = 'status' }: {
  title: string; description?: string; icon?: LucideIcon; action?: ReactNode; className?: string;
  heading?: 'h2' | 'h3'; role?: 'status' | 'alert';
}) {
  const Heading = heading;
  return <div className={`workspace-empty ${className}`.trim()} role={role}>
    <span className="workspace-empty-icon"><Icon size={28} strokeWidth={1.6} aria-hidden="true" /></span>
    <hgroup className="workspace-empty-copy"><Heading>{title}</Heading>{description && <p>{description}</p>}</hgroup>
    {action}
  </div>;
}
