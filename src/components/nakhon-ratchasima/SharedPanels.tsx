import { AlertTriangle, ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { DataProvenanceChip, type DataProvenanceChipKind } from "../DataProvenanceChip";

export function EmptyLocalEvidence() {
  return (
    <div className="nr-no-data">
      <AlertTriangle size={18} />
      <div>
        <strong>พื้นที่นี้ยังไม่มีหลักฐานเชิงลึกระดับท้องถิ่นในรอบข้อมูลนี้</strong>
        <p>ข้อมูลว่างไม่เท่ากับความเสี่ยงต่ำ และระบบจะไม่แสดงเป็นสีเขียวหรือ “ปกติ” โดยไม่มีหลักฐานรองรับ</p>
      </div>
    </div>
  );
}

export function DashboardSection({
  id,
  eyebrow,
  title,
  description,
  provenance = "REAL",
  className = "",
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: ReactNode;
  provenance?: DataProvenanceChipKind;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={["nr-dashboard-section", className].filter(Boolean).join(" ")}>
      <div className="nr-dashboard-section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <DataProvenanceChip kind={provenance} />
      </div>
      {children}
    </section>
  );
}

export function DashboardDetailPanel({ title, icon, preview, children, provenance, className = "" }: {
  title: string;
  icon: ReactNode;
  preview: ReactNode;
  children: ReactNode;
  className?: string;
  provenance?: DataProvenanceChipKind;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <section className={`nr-detail-panel ${className}`}>
    {provenance && <DataProvenanceChip kind={provenance} />}
    <h3><button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span className="panel-icon" aria-hidden="true">{icon}</span><span>{title}</span><ChevronDown size={18} aria-hidden="true" />
    </button></h3>
    <div className="nr-detail-panel-preview">{preview}</div>
    <div id={id} className="nr-detail-panel-body" hidden={!open}>{children}</div>
  </section>;
}

export function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="panel-header">
      <span>{icon}</span>
      <h2>{title}</h2>
    </div>
  );
}
