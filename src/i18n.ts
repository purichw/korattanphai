import type { Language, Severity } from "./types";

type Key = "brand" | "overview" | "month" | "hazard" | "crop";

const dictionary: Record<Key, Record<Language, string>> = {
  brand: { th: "โคราชทันภัย", en: "Korat Tan Phai" },
  overview: { th: "ภาพรวม", en: "Overview" },
  month: { th: "เดือน", en: "Month" },
  hazard: { th: "ภัย", en: "Hazard" },
  crop: { th: "พืช", en: "Crop" },
};

const severityLabels: Record<Severity, Record<Language, string>> = {
  Normal: { th: "ปกติ", en: "Normal" },
  Watch: { th: "เฝ้าระวัง", en: "Watch" },
  Warning: { th: "เตือนภัย", en: "Warning" },
  Severe: { th: "รุนแรง", en: "Severe" },
};

const monthFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  month: "short",
  year: "numeric",
});

const monthFormatterEn = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
});

export function t(key: Key, language: Language) {
  return dictionary[key][language];
}

export function severityLabel(severity: Severity, language: Language) {
  return severityLabels[severity][language];
}

export function formatMonth(month: string, language: Language) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1, 1);
  return language === "th" ? monthFormatter.format(date) : monthFormatterEn.format(date);
}

export function formatMonthParts(month: string, language: Language) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1, 1);
  const parts = (language === "th" ? monthFormatter : monthFormatterEn).formatToParts(date);
  return {
    month: parts.find((part) => part.type === "month")?.value ?? "",
    year: parts.find((part) => part.type === "year")?.value ?? "",
  };
}

const confidenceTh: Record<string, string> = {
  Low: "ต่ำ",
  Medium: "ปานกลาง",
  High: "สูง",
};

export function labelConfidence(confidence: string, language: Language) {
  return language === "th" ? confidenceTh[confidence] ?? confidence : confidence;
}
