import { type NakhonRatchasimaEvidenceRecord } from "../../types";
import { DataProvenanceChip, type DataProvenanceChipKind } from "../DataProvenanceChip";
import {
  evidenceTitle,
  translateScope,
  sourceAgencyFor,
  formatThaiPeriod,
  formatThaiDate,
  factRows,
  translateLimitation,
} from "./workspaceModel";
import { AlertTriangle } from "lucide-react";
import { type ReactNode } from "react";
import { MetricCard } from "../PageSummary";

export function EvidenceCard({ record, inherited = false }: { record: NakhonRatchasimaEvidenceRecord; inherited?: boolean }) {
  return (
    <article className={inherited ? "nr-evidence-card inherited provenance-corner-host" : "nr-evidence-card provenance-corner-host"}>
      <DataProvenanceChip kind={record.provenance} />
      <p className="eyebrow">รหัสหลักฐาน {record.source_id}</p>
      <h3>{evidenceTitle(record)}</h3>
      <p>{inherited ? `บริบทที่สืบทอดจาก${translateScope(record.geography.scope)}` : sourceAgencyFor(record)}</p>
      <dl className="nr-fact-grid">
        <div>
          <dt>ช่วงข้อมูล</dt>
          <dd>{record.observation_period ? formatThaiPeriod(record.observation_period) : `${formatThaiDate(record.forecast_valid_from)} - ${formatThaiDate(record.forecast_valid_to)}`}</dd>
        </div>
        <div>
          <dt>อัปเดต ณ</dt>
          <dd>{formatThaiDate(record.as_of_date)}</dd>
        </div>
        {factRows(record).slice(0, 6).map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="provenance-note">{translateLimitation(record.limitation)}</p>
    </article>
  );
}

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

export function OfficialMetricCard({
  icon,
  label,
  value,
  detail,
  tone = "default",
  provenance,
}: {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  detail: ReactNode;
  tone?: "default" | "watch" | "good" | "muted";
  provenance?: DataProvenanceChipKind;
}) {
  return (
    <MetricCard
      element="article"
      className="nr-official-metric"
      icon={icon}
      label={label}
      value={value}
      detail={detail}
      tone={tone}
      provenance={provenance}
    />
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

export function DashboardAccordionSection({
  eyebrow,
  title,
  description,
  provenance = "REAL",
  icon,
  className = "",
  children,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  provenance?: DataProvenanceChipKind;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={["nr-panel nr-source-readiness nr-dashboard-accordion", className].filter(Boolean).join(" ")}>
      <details className="nr-source-disclosure">
        <summary>
          <span className="nr-source-summary-title">
            <span className="panel-icon" aria-hidden="true">
              {icon}
            </span>
            <span>
              <span className="eyebrow">{eyebrow}</span>
              <strong>{title}</strong>
              {description ? <small>{description}</small> : null}
            </span>
          </span>
          <span className="nr-source-summary-meta">
            <DataProvenanceChip kind={provenance} />
            <span className="nr-source-summary-action" aria-hidden="true" />
          </span>
        </summary>
        <div className="nr-dashboard-accordion-body">{children}</div>
      </details>
    </section>
  );
}

export const dataGovernanceGuardrailItems = [
  <>ใช้ <code>TH-P29</code> เป็นจังหวัดเดิม ไม่สร้างจังหวัดนครราชสีมาซ้ำ</>,
  <>ป้ายชื่อระดับจังหวัดต้องใช้ “นครราชสีมา” หรือ “จังหวัดนครราชสีมา” เท่านั้น</>,
  <>การเชื่อมข้อมูลใช้รหัสจังหวัด/อำเภอ/ตำบลเท่านั้น ไม่ใช้ชื่อหรือที่อยู่เว็บ</>,
  <>ข้อมูลจากแหล่งอ้างอิงไม่ใช่คะแนนความเสี่ยงรวมของพื้นที่</>,
  <>พื้นที่ที่ยังไม่มีหลักฐานเชิงลึกต้องแสดงว่า “ยังไม่มีข้อมูล” ไม่ใช่ “ปกติ”</>,
];

export function DataGovernanceGuardrailList() {
  return (
    <ul className="clean-list">
      {dataGovernanceGuardrailItems.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function DataGovernanceGuardrailAccordion() {
  return (
    <section className="nr-panel nr-guardrail">
      <details>
        <summary>
          <span className="panel-icon" aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <strong>ข้อกำกับข้อมูลสำคัญ</strong>
        </summary>
        <DataGovernanceGuardrailList />
      </details>
    </section>
  );
}

export function ResearchStatGrid({ children }: { children: ReactNode }) {
  return <div className="nr-research-stat-grid">{children}</div>;
}

export function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="panel-header">
      <span>{icon}</span>
      <h2>{title}</h2>
    </div>
  );
}
