import json
import math
from pathlib import Path

import pandas as pd
import xlsxwriter


OUT = Path("/Users/point/Kaset-Tan-Phai/outputs/normalize-drought-rainfall-20260831")
OUTPUT_XLSX = OUT / "kaset-tan-phai-nakhon-ratchasima-drought-rainfall-normalized.xlsx"
META_JSON = OUT / "sheet_meta.json"


NUMERIC_FORMATS = {
    "Year": "0",
    "Month": "0",
    "ID": "0",
    "sourceResearchId": "0",
    "rainfallRawRowCount": "0",
    "rainfallValueUniqueCount": "0",
    "droughtRiskLevel": "0",
    "droughtRiskMin": "0",
    "droughtRiskMax": "0",
    "droughtRiskFirst": "0",
    "droughtRiskLast": "0",
    "droughtRiskUniqueCount": "0",
    "droughtRawRowCount": "0",
    "rawRowCount": "0",
    "valueUniqueCount": "0",
    "Best_Station_Rainfall": "0.0",
    "rainfallMm": "0.0",
    "Drought_Risk": "0",
}


WIDE_COLUMNS = {
    "recordId": 34,
    "sourceAreaKey": 34,
    "sourceRows": 26,
    "rainfallSourceRows": 28,
    "droughtSourceRows": 28,
    "qualityFlags": 42,
    "matchMethod": 42,
    "notes": 56,
    "note": 56,
    "definition": 58,
    "sourceCondition": 60,
    "normalizedAction": 66,
    "recommendedFollowUp": 58,
    "normalizedTreatment": 48,
}


def excel_value(header, value):
    if pd.isna(value):
        return ""
    if header in NUMERIC_FORMATS:
        if value == "":
            return ""
        numeric = pd.to_numeric(value, errors="coerce")
        if pd.isna(numeric):
            return value
        if float(numeric).is_integer():
            return int(numeric)
        return float(numeric)
    if hasattr(value, "item"):
        value = value.item()
    return value


def column_width(header: str, sheet_name: str) -> int:
    if header in WIDE_COLUMNS:
        return WIDE_COLUMNS[header]
    if header.endswith("Code") or header in {"provinceCode", "districtCode", "subdistrictCode"}:
        return 14
    if "Name" in header or header in {"TAMBON_E", "AMPHOE_E", "sourceArea"}:
        return 22
    if header in {"period", "periodStartDate", "sourceResearchId", "researchAreaId"}:
        return 18
    if sheet_name.startswith("Raw_"):
        return 16
    return min(max(len(header) + 2, 12), 24)


def write_sheet(workbook, sheet_meta, formats):
    sheet_name = sheet_meta["sheet"]
    csv_path = Path(sheet_meta["csv"])
    ws = workbook.add_worksheet(sheet_name)
    ws.hide_gridlines(2)
    ws.freeze_panes(1, 0)

    header_written = False
    current_row = 0
    headers = []
    for chunk in pd.read_csv(csv_path, chunksize=5000, keep_default_na=False, dtype=str):
        if not header_written:
            headers = list(chunk.columns)
            for col_idx, header in enumerate(headers):
                ws.write(0, col_idx, header, formats["header"])
                ws.set_column(col_idx, col_idx, column_width(header, sheet_name))
            header_written = True
            current_row = 1

        for values in chunk.itertuples(index=False, name=None):
            for col_idx, value in enumerate(values):
                header = headers[col_idx]
                cell_format = formats.get(f"num:{NUMERIC_FORMATS.get(header, '')}")
                ws.write(current_row, col_idx, excel_value(header, value), cell_format)
            current_row += 1

    if headers:
        ws.autofilter(0, 0, max(current_row - 1, 0), len(headers) - 1)
        ws.set_row(0, 24)
        if sheet_name in {"README", "Quality_Summary", "Data_Contract", "Resolution_Rules", "Attention_Flags"}:
            ws.set_column(0, len(headers) - 1, None, formats["wrap"])
            for row_idx in range(1, min(current_row, 120)):
                ws.set_row(row_idx, 32)

    if sheet_name == "Monthly_Panel":
        apply_monthly_conditional_formats(ws, headers, current_row, formats)
    if sheet_name in {"Attention_Flags", "Duplicate_Audit"}:
        apply_audit_conditional_formats(ws, headers, current_row, formats)
    return current_row, len(headers)


def col_idx(headers, name):
    try:
        return headers.index(name)
    except ValueError:
        return None


def apply_monthly_conditional_formats(ws, headers, current_row, formats):
    risk_col = col_idx(headers, "droughtRiskLevel")
    if risk_col is not None and current_row > 1:
        ws.conditional_format(1, risk_col, current_row - 1, risk_col, {
            "type": "cell",
            "criteria": "==",
            "value": 0,
            "format": formats["risk0"],
        })
        ws.conditional_format(1, risk_col, current_row - 1, risk_col, {
            "type": "cell",
            "criteria": "==",
            "value": 1,
            "format": formats["risk1"],
        })
        ws.conditional_format(1, risk_col, current_row - 1, risk_col, {
            "type": "cell",
            "criteria": "==",
            "value": 2,
            "format": formats["risk2"],
        })
    status_col = col_idx(headers, "websiteImportStatus")
    if status_col is not None and current_row > 1:
        ws.conditional_format(1, status_col, current_row - 1, status_col, {
            "type": "text",
            "criteria": "containing",
            "value": "CONFLICT",
            "format": formats["attention"],
        })


def apply_audit_conditional_formats(ws, headers, current_row, formats):
    severity_col = col_idx(headers, "severity")
    audit_col = col_idx(headers, "auditStatus")
    target_col = severity_col if severity_col is not None else audit_col
    if target_col is None or current_row <= 1:
        return
    for text in ["HIGH", "VALUE_CONFLICT", "REVIEW"]:
        ws.conditional_format(1, target_col, current_row - 1, target_col, {
            "type": "text",
            "criteria": "containing",
            "value": text,
            "format": formats["attention"],
        })


def main():
    meta = json.loads(META_JSON.read_text())
    workbook = xlsxwriter.Workbook(OUTPUT_XLSX, {"constant_memory": True})
    workbook.set_properties(
        {
            "title": "Kaset Tan Phai Nakhon Ratchasima Drought Rainfall Normalized",
            "subject": "Normalized drought and rainfall research workbooks for website import",
            "author": "Codex",
        }
    )
    formats = {
        "header": workbook.add_format(
            {
                "bold": True,
                "font_color": "#173A2D",
                "bg_color": "#E6F1EA",
                "bottom": 1,
                "bottom_color": "#AFC5B9",
            }
        ),
        "wrap": workbook.add_format({"text_wrap": True, "valign": "top"}),
        "attention": workbook.add_format({"bg_color": "#FFF1D6", "font_color": "#7C4A03"}),
        "risk0": workbook.add_format({"bg_color": "#E9F7EF", "font_color": "#1F6B43", "num_format": "0"}),
        "risk1": workbook.add_format({"bg_color": "#FFF1D6", "font_color": "#7C4A03", "num_format": "0"}),
        "risk2": workbook.add_format({"bg_color": "#FDE2E2", "font_color": "#9F1239", "num_format": "0"}),
        "num:0": workbook.add_format({"num_format": "0"}),
        "num:0.0": workbook.add_format({"num_format": "0.0"}),
    }
    written = []
    for sheet_meta in meta:
        rows, cols = write_sheet(workbook, sheet_meta, formats)
        written.append({"sheet": sheet_meta["sheet"], "rows": rows, "cols": cols})
    workbook.close()
    print(json.dumps({"outputPath": str(OUTPUT_XLSX), "sheets": written}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
