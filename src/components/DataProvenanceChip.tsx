import type { DataClass, Language } from "../types";

export type DataProvenanceChipKind = DataClass | "PROXY" | "PENDING_SOURCE" | "FORECAST_ARCHIVE";

const provenanceChipLabels: Record<Language, Record<DataProvenanceChipKind, string>> = {
  th: {
    FORECAST_ARCHIVE: "คลังคำพยากรณ์",
    REAL: "ข้อมูลจริง",
    CANONICAL_SYNTHETIC: "ข้อมูลตัวอย่าง",
    DERIVED: "ผลคำนวณ",
    RUNTIME_STATE: "สถานะใช้งาน",
    PROXY: "ข้อมูลประมาณค่า",
    PENDING_SOURCE: "รอยืนยันข้อมูล",
  },
  en: {
    FORECAST_ARCHIVE: "Forecast archive",
    REAL: "Real data",
    CANONICAL_SYNTHETIC: "Prototype data",
    DERIVED: "Computed",
    RUNTIME_STATE: "Runtime state",
    PROXY: "Proxy data",
    PENDING_SOURCE: "Not connected",
  },
};

const provenanceChipDescriptions: Record<Language, Record<DataProvenanceChipKind, string>> = {
  th: {
    FORECAST_ARCHIVE: "คำพยากรณ์จากชุดข้อมูลต้นฉบับ ไม่ใช่ข้อมูลสถานการณ์จริง",
    REAL: "มาจากแหล่งข้อมูลจริงหรือเอกสารทางการ",
    CANONICAL_SYNTHETIC: "ข้อมูลตัวอย่างสำหรับตรวจสอบรูปแบบการทำงาน",
    DERIVED: "ผลคำนวณจากข้อมูลตั้งต้น",
    RUNTIME_STATE: "สถานะจากการใช้งานในระบบ",
    PROXY: "ใช้สถานีหรือข้อมูลใกล้เคียงเป็นตัวแทน ไม่ใช่ค่าตรวจวัดตรงพื้นที่",
    PENDING_SOURCE: "ยังรอการยืนยันแหล่งข้อมูล",
  },
  en: {
    FORECAST_ARCHIVE: "Predictions from the source dataset, not observed conditions",
    REAL: "From a real source or official document",
    CANONICAL_SYNTHETIC: "Prototype or mock data for demo use",
    DERIVED: "Computed from source inputs",
    RUNTIME_STATE: "State created by app usage",
    PROXY: "Nearest or adjacent source used as a proxy, not an in-area measurement",
    PENDING_SOURCE: "Waiting for a confirmed source connection",
  },
};

const provenanceChipClasses: Record<DataProvenanceChipKind, string> = {
  FORECAST_ARCHIVE: "is-forecast-archive",
  REAL: "is-real",
  CANONICAL_SYNTHETIC: "is-synthetic",
  DERIVED: "is-derived",
  RUNTIME_STATE: "is-runtime",
  PROXY: "is-proxy",
  PENDING_SOURCE: "is-pending",
};

export function DataProvenanceChip({
  kind,
  label,
  className = "",
  language = "th",
}: {
  kind: DataProvenanceChipKind;
  label?: string;
  className?: string;
  language?: Language;
}) {
  const chipLabel = label ?? provenanceChipLabels[language][kind];
  const description = provenanceChipDescriptions[language][kind];

  return (
    <span
      className={["data-provenance-chip", provenanceChipClasses[kind], className].filter(Boolean).join(" ")}
      title={description}
      role="img"
      aria-label={`${chipLabel}: ${description}`}
      data-provenance-label={chipLabel}
    />
  );
}

export function DataProvenanceLegend({
  kinds,
  className = "",
  language = "th",
}: {
  kinds: DataProvenanceChipKind[];
  className?: string;
  language?: Language;
}) {
  return (
    <div className={["data-provenance-legend", className].filter(Boolean).join(" ")} aria-label={language === "th" ? "คำอธิบายชนิดข้อมูล" : "Data provenance legend"}>
      {kinds.map((kind) => (
        <span key={kind}>
          <DataProvenanceChip kind={kind} language={language} className="is-legend-dot" />
          <b>{provenanceChipLabels[language][kind]}</b>
        </span>
      ))}
    </div>
  );
}

export function dataProvenanceChipKindFromText(value: string): DataProvenanceChipKind {
  const normalized = value.toUpperCase();
  if (normalized.includes("SYNTHETIC") || normalized.includes("PROTOTYPE") || normalized.includes("MOCK") || value.includes("ต้นแบบ")) {
    return "CANONICAL_SYNTHETIC";
  }
  if (normalized.includes("DERIVED") || value.includes("คำนวณ")) return "DERIVED";
  if (normalized.includes("REAL") || value.includes("ข้อมูลจริง")) return "REAL";
  if (normalized.includes("RUNTIME")) return "RUNTIME_STATE";
  return "PENDING_SOURCE";
}
