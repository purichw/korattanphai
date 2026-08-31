import type { ReactNode } from "react";

export function ContentSection({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={["content-section", className].filter(Boolean).join(" ")}>
      <div className="content-section-header">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="content-section-body">{children}</div>
    </section>
  );
}
