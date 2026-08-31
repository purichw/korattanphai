import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const issueMonth = process.argv[2] ?? "202608";
const sourceUrl = `https://www.thaiwater.net/proxy/csv.php?file=https://live1.hii.or.th/product/latest/forecast/drought/${issueMonth}droughtForecast_6month.csv`;
const outputPath = path.join(root, "src/data/canonical/nakhon_ratchasima/thaiwater_drought_forecast.json");
const crosswalkPath = path.join(root, "outputs/normalize-drought-rainfall-20260831/Area_Crosswalk.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...body] = rows.filter((item) => item.some((cell) => cell.trim() !== ""));
  return body.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), (cells[index] ?? "").trim()])),
  );
}

function periodFromRow(row) {
  return `${row.YEAR}-${String(row.MONTH).padStart(2, "0")}`;
}

function isRisk(row) {
  return (row.TYPE_E ?? "").toLowerCase() !== "norisk" || row.TYPE_T === "เสี่ยงแล้ง";
}

function thaiPeriodLabel(period) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

const response = await fetch(sourceUrl);
if (!response.ok) {
  throw new Error(`ThaiWater forecast fetch failed: ${response.status} ${sourceUrl}`);
}

const csvText = await response.text();
if (csvText.trim().startsWith("<")) {
  throw new Error(`ThaiWater forecast returned HTML for ${sourceUrl}`);
}

const rows = parseCsv(csvText);
const canonicalRows = parseCsv(await fs.readFile(crosswalkPath, "utf8"));
const canonicalByCode = new Map(canonicalRows.map((row) => [row.subdistrictCode, row]));
const canonicalCodes = new Set(canonicalByCode.keys());
const provinceRows = rows.filter((row) => row.PROV_CODE === "30" || row.PROV_T === "นครราชสีมา");
const periods = [...new Set(provinceRows.map(periodFromRow))].sort();
const uniqueCodes = new Set(provinceRows.map((row) => row.TAMBON_IDN));
const missingCodes = [...canonicalCodes].filter((code) => !uniqueCodes.has(code)).sort();
const extraCodes = [...uniqueCodes].filter((code) => !canonicalCodes.has(code)).sort();

const monthly = periods.map((period, index) => {
  const monthRows = provinceRows.filter((row) => periodFromRow(row) === period);
  const riskRows = monthRows.filter(isRisk);
  const normalRows = monthRows.filter((row) => !isRisk(row));
  return {
    monthIndex: index + 1,
    period,
    labelTh: thaiPeriodLabel(period),
    riskSubdistricts: riskRows.length,
    normalSubdistricts: normalRows.length,
    totalSubdistricts: monthRows.length,
    riskPercent: monthRows.length ? riskRows.length / monthRows.length : 0,
    sourceTypes: [...new Set(monthRows.map((row) => row.TYPE_T).filter(Boolean))].sort(),
    riskTypeTh: "เสี่ยงแล้ง",
    normalTypeTh: "ไม่เสี่ยง",
  };
});

const records = provinceRows.map((row) => ({
  period: periodFromRow(row),
  subdistrictCode: row.TAMBON_IDN,
  subdistrictNameTh: row.TAMBON_T,
  districtCode: row.AMPHOE_IDN,
  districtNameTh: row.AMPHOE_T,
  statusTh: row.TYPE_T,
  statusEn: row.TYPE_E,
}));

const output = {
  meta: {
    sourceNameTh: "ThaiWater พยากรณ์พื้นที่เสี่ยงภัยแล้ง 6 เดือน",
    sourceUrl,
    upstreamFile: `${issueMonth}droughtForecast_6month.csv`,
    issueMonth: `${issueMonth.slice(0, 4)}-${issueMonth.slice(4, 6)}`,
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Bangkok",
    provinceCode: "30",
    provinceId: "TH-P29",
    provinceNameTh: "นครราชสีมา",
    provenance: "REAL",
    semanticsTh: "พยากรณ์พื้นที่เสี่ยงภัยแล้งรายตำบล 6 เดือนจาก ThaiWater ไม่ใช่ข้อมูลภัยแล้งย้อนหลังจาก Excel",
    totalCanonicalSubdistricts: canonicalCodes.size,
    thaiWaterSubdistricts: uniqueCodes.size,
    rowCount: provinceRows.length,
  },
  coverage: {
    matchedSubdistricts: [...uniqueCodes].filter((code) => canonicalCodes.has(code)).length,
    missingSubdistricts: missingCodes.map((code) => ({
      subdistrictCode: code,
      districtCode: canonicalByCode.get(code)?.districtCode ?? "",
      districtNameTh: canonicalByCode.get(code)?.districtNameTh ?? "",
      subdistrictNameTh: canonicalByCode.get(code)?.subdistrictNameTh ?? "",
    })),
    extraSubdistrictCodes: extraCodes,
  },
  monthly,
  records,
};

await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      outputPath,
      issueMonth,
      periods: monthly.length,
      rows: provinceRows.length,
      subdistricts: uniqueCodes.size,
      missingSubdistricts: missingCodes,
    },
    null,
    2,
  ),
);
