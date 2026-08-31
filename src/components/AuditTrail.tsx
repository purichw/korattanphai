import type { ReactNode } from "react";
import { DataProvenanceChip, type DataProvenanceChipKind } from "./DataProvenanceChip";

export type AuditTrailItem = {
  id: string;
  provenance?: DataProvenanceChipKind;
  eyebrow?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
};

export type AuditTrailSection = {
  id: string;
  title: ReactNode;
  items: AuditTrailItem[];
  columns?: 2 | 3 | 4;
  note?: ReactNode;
};

export function AuditTrailFootnotes({
  sections,
  ariaLabel = "หลักฐานและตรรกะการใช้ข้อมูล",
  className = "",
}: {
  sections: AuditTrailSection[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={["audit-footnotes", className].filter(Boolean).join(" ")} aria-label={ariaLabel}>
      {sections.map((section) => (
        <section key={section.id} className="audit-footnote-block" aria-label={typeof section.title === "string" ? section.title : undefined}>
          <h3>{section.title}</h3>
          <div className={["audit-card-grid", `is-${section.columns ?? 3}-col`].join(" ")}>
            {section.items.map((item) => (
              <article key={item.id} className={["audit-card", item.provenance ? "has-provenance" : ""].filter(Boolean).join(" ")}>
                {item.provenance ? <DataProvenanceChip kind={item.provenance} /> : null}
                {item.eyebrow ? <span>{item.eyebrow}</span> : null}
                <strong>{item.title}</strong>
                {item.body ? <p>{item.body}</p> : null}
              </article>
            ))}
          </div>
          {section.note ? <p className="provenance-note">{section.note}</p> : null}
        </section>
      ))}
    </div>
  );
}
