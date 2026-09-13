import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Shared modal shell; feature owners retain loading, filters and data state. */
export function WorkspaceDialog({ title, children, onClose, wide = false }: {
  title: string; children: ReactNode; onClose: () => void; wide?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [opener] = useState(() => document.activeElement);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  function close() { ref.current?.close(); onClose(); }
  return createPortal(<dialog ref={ref} className={`nr-tool-dialog${wide ? ' is-wide' : ''}`}
    aria-labelledby={id} onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}
    onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <header><h2 id={id}>{title}</h2><button className="icon-button" type="button" title="ปิด" aria-label="ปิดเครื่องมือแผนที่" onClick={close}><X size={20} /></button></header>
    <div className="nr-tool-dialog-content">{children}</div>
  </dialog>, document.fullscreenElement ?? document.body);
}
