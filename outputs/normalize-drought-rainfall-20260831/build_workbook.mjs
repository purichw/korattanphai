import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outDir = "/Users/point/Kaset-Tan-Phai/outputs/normalize-drought-rainfall-20260831";
const outputPath = path.join(outDir, "kaset-tan-phai-nakhon-ratchasima-drought-rainfall-normalized.xlsx");
const previewDir = path.join(outDir, "previews");
const meta = JSON.parse(await fs.readFile(path.join(outDir, "sheet_meta.json"), "utf8"));

const workbook = Workbook.create();

function colLetter(indexOneBased) {
  let n = indexOneBased;
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function tableName(sheetName) {
  return `${sheetName.replace(/[^A-Za-z0-9]/g, "")}Table`.slice(0, 240);
}

function safeFormat(fn, label) {
  try {
    fn();
  } catch (error) {
    console.warn(`format skipped for ${label}: ${error.message}`);
  }
}

function parseHeader(csvText) {
  const firstLine = csvText.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.split(",");
}

for (const sheet of meta) {
  const csvText = await fs.readFile(sheet.csv, "utf8");
  await workbook.fromCSV(csvText, { sheetName: sheet.sheet });
  sheet.headers = parseHeader(csvText);
}

for (const sheetMeta of meta) {
  const sheet = workbook.worksheets.getItem(sheetMeta.sheet);
  const lastCol = colLetter(sheetMeta.cols);
  const lastRow = sheetMeta.rows_with_header;
  const usedAddress = `A1:${lastCol}${lastRow}`;
  const headerAddress = `A1:${lastCol}1`;
  const isLargeDataSheet = sheetMeta.rows_with_header > 10000 || sheetMeta.cols > 32;
  sheet.showGridLines = false;

  safeFormat(() => sheet.freezePanes.freezeRows(1), `${sheetMeta.sheet} freeze`);
  if (!isLargeDataSheet) {
    safeFormat(() => {
      const used = sheet.getRange(usedAddress);
      used.format.font = { name: "Aptos", size: 10, color: "#1F2A26" };
      used.format.wrapText = false;
    }, `${sheetMeta.sheet} used range`);
  }
  safeFormat(() => {
    const header = sheet.getRange(headerAddress);
    header.format.fill = { color: "#E6F1EA" };
    header.format.font = { name: "Aptos", size: 10, bold: true, color: "#173A2D" };
    header.format.borders = {
      bottom: { style: "thin", color: "#AFC5B9" },
    };
  }, `${sheetMeta.sheet} header`);
  if (!isLargeDataSheet) {
    safeFormat(() => {
      sheet.getRange(usedAddress).format.borders = {
        insideHorizontal: { style: "thin", color: "#EDF2EF" },
      };
    }, `${sheetMeta.sheet} subtle rows`);
    safeFormat(() => {
      const table = sheet.tables.add(usedAddress, true, tableName(sheetMeta.sheet));
      table.showFilterButton = true;
      table.showBandedRows = false;
    }, `${sheetMeta.sheet} table`);
    safeFormat(() => sheet.getRange(usedAddress).format.autofitColumns(), `${sheetMeta.sheet} autofit`);
  }
  safeFormat(() => {
    const header = sheet.getRange(headerAddress);
    header.format.rowHeightPx = 28;
  }, `${sheetMeta.sheet} header height`);

  const headers = sheetMeta.headers;
  const headerIndex = new Map(headers.map((name, idx) => [name, idx + 1]));
  const setColumnFormat = (name, format) => {
    const idx = headerIndex.get(name);
    if (!idx || lastRow < 2) return;
    const letter = colLetter(idx);
    safeFormat(() => sheet.getRange(`${letter}2:${letter}${lastRow}`).setNumberFormat(format), `${sheetMeta.sheet} ${name} number format`);
  };
  const setColumnWidth = (name, widthPx) => {
    const idx = headerIndex.get(name);
    if (!idx) return;
    const letter = colLetter(idx);
    safeFormat(() => {
      sheet.getRange(`${letter}:${letter}`).format.columnWidthPx = widthPx;
    }, `${sheetMeta.sheet} ${name} width`);
  };

  for (const name of ["Year", "Month", "ID", "sourceResearchId", "rainfallRawRowCount", "droughtRawRowCount", "droughtRiskLevel", "droughtRiskMin", "droughtRiskMax", "droughtRiskFirst", "droughtRiskLast", "droughtRiskUniqueCount"]) {
    setColumnFormat(name, "0");
  }
  setColumnFormat("rainfallMm", "0.0");
  setColumnFormat("Best_Station_Rainfall", "0.0");
  setColumnFormat("Drought_Risk", "0");
  setColumnFormat("periodStartDate", "yyyy-mm-dd");

  for (const name of ["notes", "note", "definition", "value", "qualityFlags", "matchMethod"]) {
    setColumnWidth(name, 320);
  }
  for (const name of ["recordId", "sourceAreaKey", "rainfallSourceRows", "droughtSourceRows"]) {
    setColumnWidth(name, 240);
  }
  for (const name of ["subdistrictCode", "districtCode", "provinceCode"]) {
    setColumnWidth(name, 110);
  }

  if (sheetMeta.sheet === "README" || sheetMeta.sheet === "Quality_Summary" || sheetMeta.sheet === "Data_Contract") {
    safeFormat(() => {
      const used = sheet.getRange(usedAddress);
      used.format.wrapText = true;
      used.format.rowHeightPx = 34;
    }, `${sheetMeta.sheet} readable wrap`);
  }
}

await fs.mkdir(previewDir, { recursive: true });
for (const sheetMeta of meta) {
  const sheetName = sheetMeta.sheet;
  const lastCol = colLetter(Math.min(sheetMeta.cols, sheetName.startsWith("Raw_") ? 10 : 18));
  const lastRow = Math.min(sheetMeta.rows_with_header, sheetName === "README" ? 18 : 22);
  const preview = await workbook.render({
    sheetName,
    range: `A1:${lastCol}${lastRow}`,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  const bytes = new Uint8Array(await preview.arrayBuffer());
  await fs.writeFile(path.join(previewDir, `${sheetName}.png`), bytes);
}

const overview = await workbook.inspect({
  kind: "sheet,table",
  maxChars: 6000,
  tableMaxRows: 4,
  tableMaxCols: 8,
});
console.log(overview.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, previewDir }, null, 2));
