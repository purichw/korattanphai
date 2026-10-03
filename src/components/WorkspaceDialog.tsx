import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Shared modal shell; feature owners retain loading, filters and data state. */
export function WorkspaceDialog({ title, children, onClose, wide = false, bounded = false, closeLabel = 'ปิดเครื่องมือแผนที่', className = '', description, footer }: {
  title: string; children: ReactNode; onClose: () => void; wide?: boolean; bounded?: boolean; closeLabel?: string;
  className?: string; description?: string; footer?: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [opener] = useState(() => document.activeElement);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if ((opener instanceof HTMLElement || opener instanceof SVGElement) && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true }); };
  }, []);
  // The owner may defer closing while saving or ask to discard unsaved changes.
  // Native close belongs to unmount cleanup, after that decision is accepted.
  function close() { onClose(); }
  return createPortal(<dialog ref={ref} className={`nr-tool-dialog${wide ? ' is-wide' : ''}${bounded ? ' is-bounded' : ''}${className ? ` ${className}` : ''}`}
    aria-labelledby={id} aria-describedby={description ? `${id}-description` : undefined} onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}
    onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <header>{description ? <div className="nr-tool-dialog-heading"><h2 id={id}>{title}</h2><p id={`${id}-description`}>{description}</p></div> : <h2 id={id}>{title}</h2>}<button className="icon-button" type="button" title="ปิด" aria-label={closeLabel} onClick={close}><X size={20} /></button></header>
    <div className="nr-tool-dialog-content">{children}</div>
    {footer && <footer className="nr-tool-dialog-footer">{footer}</footer>}
  </dialog>, document.fullscreenElement ?? document.body);
}
