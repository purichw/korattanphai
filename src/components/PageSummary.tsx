import type { ReactNode } from "react";
import { DataProvenanceChip, type DataProvenanceChipKind } from "./DataProvenanceChip";

export type SummaryMetric = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  provenance?: DataProvenanceChipKind;
  tone?: "default" | "watch" | "good" | "muted";
  className?: string;
};

export type MetricCardProps = SummaryMetric & {
  element?: "article" | "div" | "span";
};

export function MetricCard({
  label,
  value,
  detail,
  icon,
  provenance,
  tone = "default",
  className,
  element: Element = "div",
}: MetricCardProps) {
  return (
    <Element
      className={[
        "metric-card",
        `is-${tone}`,
        icon ? "has-icon" : "",
        detail ? "has-detail" : "",
        provenance ? "has-provenance" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {provenance ? <DataProvenanceChip kind={provenance} /> : null}
      {icon ? (
        <span className="metric-card-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="metric-card-label">{label}</span>
      <strong className="metric-card-value">{value}</strong>
      {detail ? <small className="metric-card-detail">{detail}</small> : null}
    </Element>
  );
}

export function PageSummary({
  eyebrow,
  title,
  description,
  metrics,
  className,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  metrics: SummaryMetric[];
  className?: string;
}) {
  return (
    <section className={["hero-panel", className].filter(Boolean).join(" ")}>
      <div className="hero-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {metrics.length > 0 && (
        <div className="summary-strip">
          {metrics.map((metric, index) => (
            <MetricCard key={index} {...metric} />
          ))}
        </div>
      )}
    </section>
  );
}
