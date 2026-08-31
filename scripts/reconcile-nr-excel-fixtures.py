#!/usr/bin/env python3
"""Build and reconcile Nakhon Ratchasima Excel-backed UI fixtures.

The water and drought UI imports compact JSON fixtures, while the source of
truth is the normalized workbook/CSV produced from Rainfall.xlsx and
Drought.xlsx. This script regenerates those fixtures and verifies that the data
imported by the app has not drifted from the normalized Excel export.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "outputs" / "normalize-drought-rainfall-20260831"
MONTHLY_CSV = SOURCE_DIR / "Monthly_Panel.csv"
NORMALIZED_XLSX = SOURCE_DIR / "kaset-tan-phai-nakhon-ratchasima-drought-rainfall-normalized.xlsx"
QUALITY_CSV = SOURCE_DIR / "Quality_Summary.csv"
ATTENTION_FLAGS_CSV = SOURCE_DIR / "Attention_Flags.csv"
DROUGHT_CONFLICTS_CSV = SOURCE_DIR / "Drought_Conflicts.csv"
RESOLUTION_RULES_CSV = SOURCE_DIR / "Resolution_Rules.csv"
MONTHLY_FIXTURE = ROOT / "src" / "data" / "canonical" / "nakhon_ratchasima" / "normalized_research_monthly_panel.json"
SUMMARY_FIXTURE = ROOT / "src" / "data" / "canonical" / "nakhon_ratchasima" / "normalized_research_panel_summary.json"
REPORT_PATH = SOURCE_DIR / "fixture_reconciliation_report.json"

IRRIGATION_LEGEND = ["Collecting", "Irrigation", "RainFed"]
UI_SOURCE_SHEETS = [
    "Monthly_Panel",
    "Area_Crosswalk",
    "Quality_Summary",
    "Attention_Flags",
    "Drought_Conflicts",
    "Resolution_Rules",
]
UNAVAILABLE_PRIMARY_DATA_TH = [
    "ระดับน้ำรายสถานี",
    "น้ำใช้การอ่าง/เขื่อน",
    "คาดการณ์ฝน",
    "ค่าฝนสด 24 ชม. รายสถานี",
    "station id/lat/lon/timestamp/source URL ต่อ record",
]


def clean_string(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return str(value)


def split_flags(value: Any) -> list[str]:
    return [item for item in clean_string(value).split(";") if item]


def read_monthly_panel() -> pd.DataFrame:
    dtype = {
        "provinceCode": str,
        "districtCode": str,
        "subdistrictCode": str,
        "sourceResearchId": str,
    }
    panel = pd.read_csv(MONTHLY_CSV, dtype=dtype)
    panel["period"] = panel["period"].astype(str)
    panel["rainfallMm"] = pd.to_numeric(panel["rainfallMm"], errors="raise")
    panel["droughtRiskLevel"] = pd.to_numeric(panel["droughtRiskLevel"], errors="raise").astype(int)
    panel["droughtRiskConflict"] = panel["droughtRiskConflict"].astype(bool)
    return panel.sort_values(["period", "districtCode", "subdistrictCode"]).reset_index(drop=True)


def subdistrict_payload(row: pd.Series) -> dict[str, Any]:
    return {
        "period": row["period"],
        "districtCode": row["districtCode"],
        "districtNameTh": row["districtNameTh"],
        "districtSlug": row["districtSlug"],
        "subdistrictCode": row["subdistrictCode"],
        "subdistrictNameTh": row["subdistrictNameTh"],
        "subdistrictSlug": row["subdistrictSlug"],
        "sourceResearchId": row["sourceResearchId"],
        "rainfallMm": float(row["rainfallMm"]),
        "rainfallUnit": row["rainfallUnit"],
        "rainfallProvenanceClass": row["rainfallProvenanceClass"],
        "droughtRiskLevel": int(row["droughtRiskLevel"]),
        "droughtRiskLabelTh": row["droughtRiskLabelTh"],
        "droughtRiskConflict": bool(row["droughtRiskConflict"]),
        "droughtRiskResolutionPolicy": row["droughtRiskResolutionPolicy"],
        "droughtProvenanceClass": row["droughtProvenanceClass"],
        "irrigationStatus": row["irrigationStatus"],
        "qualityFlags": split_flags(row["qualityFlags"]),
        "websiteImportStatus": row["websiteImportStatus"],
    }


def irrigation_counts(group: pd.DataFrame) -> dict[str, int]:
    counts = group["irrigationStatus"].value_counts().sort_index()
    return {str(key): int(value) for key, value in counts.items()}


def province_month_summary(group: pd.DataFrame) -> dict[str, Any]:
    return {
        "period": str(group["period"].iloc[0]),
        "subdistrictCount": int(group["subdistrictCode"].nunique()),
        "rainfallAvgMm": float(group["rainfallMm"].mean()),
        "rainfallMinMm": float(group["rainfallMm"].min()),
        "rainfallMaxMm": float(group["rainfallMm"].max()),
        "droughtNormalSubdistricts": int((group["droughtRiskLevel"] == 0).sum()),
        "droughtWatchSubdistricts": int((group["droughtRiskLevel"] == 1).sum()),
        "droughtSevereSubdistricts": int((group["droughtRiskLevel"] >= 2).sum()),
        "droughtConflictKeys": int(group["droughtRiskConflict"].sum()),
        "irrigationCounts": irrigation_counts(group),
    }


def district_summary(group: pd.DataFrame) -> dict[str, Any]:
    top = group.sort_values(["rainfallMm", "subdistrictCode"], ascending=[False, True]).iloc[0]
    return {
        "districtCode": str(group["districtCode"].iloc[0]),
        "districtNameTh": group["districtNameTh"].iloc[0],
        "districtSlug": group["districtSlug"].iloc[0],
        "subdistrictCount": int(group["subdistrictCode"].nunique()),
        "rainfallAvgMm": float(group["rainfallMm"].mean()),
        "rainfallMaxMm": float(group["rainfallMm"].max()),
        "rainfallMinMm": float(group["rainfallMm"].min()),
        "topRainfallSubdistrictTh": top["subdistrictNameTh"],
        "droughtNormalSubdistricts": int((group["droughtRiskLevel"] == 0).sum()),
        "droughtWatchSubdistricts": int((group["droughtRiskLevel"] == 1).sum()),
        "droughtSevereSubdistricts": int((group["droughtRiskLevel"] >= 2).sum()),
        "droughtConflictKeys": int(group["droughtRiskConflict"].sum()),
        "irrigationCounts": irrigation_counts(group),
    }


def build_monthly_fixture(panel: pd.DataFrame, generated_at: str) -> dict[str, Any]:
    legend_index = {value: index for index, value in enumerate(IRRIGATION_LEGEND)}
    periods: dict[str, dict[str, list[Any]]] = {}
    for period, group in panel.groupby("period", sort=True):
        period_records: dict[str, list[Any]] = {}
        for _, row in group.iterrows():
            irrigation_status = row["irrigationStatus"]
            if irrigation_status not in legend_index:
                raise ValueError(f"Unknown irrigationStatus: {irrigation_status}")
            period_records[row["subdistrictCode"]] = [
                float(row["rainfallMm"]),
                int(row["droughtRiskLevel"]),
                bool(row["droughtRiskConflict"]),
                legend_index[irrigation_status],
                row["websiteImportStatus"] in {"READY", "READY_WITH_CONFLICT_FLAG"},
            ]
        periods[str(period)] = period_records

    return {
        "meta": {
            "source": "outputs/normalize-drought-rainfall-20260831/Monthly_Panel.csv",
            "sourceWorkbook": "outputs/normalize-drought-rainfall-20260831/kaset-tan-phai-nakhon-ratchasima-drought-rainfall-normalized.xlsx",
            "packing": "[rainfallMm, droughtRiskLevel, droughtRiskConflict, irrigationLegendIndex, websiteImportStatusReady]",
            "generatedAt": generated_at,
            "precisionPolicy": "rainfallMm is copied from Monthly_Panel.csv without UI rounding; components handle display formatting.",
        },
        "irrigationLegend": IRRIGATION_LEGEND,
        "periods": periods,
    }


def build_summary_fixture(panel: pd.DataFrame, generated_at: str) -> dict[str, Any]:
    latest_period = str(panel["period"].max())
    latest = panel[panel["period"] == latest_period].copy()
    monthly_province = [province_month_summary(group) for _, group in panel.groupby("period", sort=True)]
    districts_latest = [district_summary(group) for _, group in latest.groupby("districtCode", sort=True)]
    subdistricts_latest = [subdistrict_payload(row) for _, row in latest.iterrows()]
    top_rainfall_latest = [
        subdistrict_payload(row)
        for _, row in latest.sort_values(["rainfallMm", "subdistrictCode"], ascending=[False, True]).head(8).iterrows()
    ]
    drought_attention_latest = [
        subdistrict_payload(row)
        for _, row in latest.sort_values(
            ["droughtRiskLevel", "droughtRiskConflict", "rainfallMm", "subdistrictCode"],
            ascending=[False, False, False, True],
        )
        .head(10)
        .iterrows()
    ]
    drought_conflict_latest = [
        subdistrict_payload(row)
        for _, row in latest[latest["droughtRiskConflict"]].sort_values(["districtCode", "subdistrictCode"]).head(10).iterrows()
    ]

    quality_summary = pd.read_csv(QUALITY_CSV, dtype=str).fillna("")
    attention_flags = pd.read_csv(ATTENTION_FLAGS_CSV, dtype=str).fillna("")
    resolution_rules = pd.read_csv(RESOLUTION_RULES_CSV, dtype=str).fillna("")
    drought_conflicts = pd.read_csv(DROUGHT_CONFLICTS_CSV, dtype=str).fillna("")
    attention_counts = {
        str(key): int(value)
        for key, value in attention_flags["flagType"].value_counts().sort_index().items()
    }

    return {
        "meta": {
            "sourceOfTruth": "normalized_excel_workbook",
            "sourceWorkbook": "outputs/normalize-drought-rainfall-20260831/kaset-tan-phai-nakhon-ratchasima-drought-rainfall-normalized.xlsx",
            "sourceCsv": "outputs/normalize-drought-rainfall-20260831/Monthly_Panel.csv",
            "sourceSheets": UI_SOURCE_SHEETS,
            "provinceId": "TH-P29",
            "provinceCode": "30",
            "provinceNameTh": "นครราชสีมา",
            "districtCount": int(panel["districtCode"].nunique()),
            "subdistrictCount": int(panel["subdistrictCode"].nunique()),
            "periodStart": str(panel["period"].min()),
            "periodEnd": latest_period,
            "periodCount": int(panel["period"].nunique()),
            "normalizedRowCount": int(len(panel)),
            "timezone": "Asia/Bangkok",
            "generatedAt": generated_at,
            "dataSourceNoticeTh": "Source of Truth: normalized Excel จาก Rainfall.xlsx + Drought.xlsx",
            "conflictPolicyTh": "ภัยแล้งที่ key ซ้ำและค่าชนกัน resolve แบบ conservative max เพื่อไม่ลดระดับความเสี่ยงเงียบ ๆ และ surface flag แยกจากข้อมูลหลัก",
            "joinPolicyTh": "เชื่อมพื้นที่ด้วย provinceCode, districtCode, subdistrictCode เท่านั้น; sourceResearchId ไม่ใช่รหัสราชการ",
            "unavailablePrimaryDataTh": UNAVAILABLE_PRIMARY_DATA_TH,
        },
        "latest": monthly_province[-1],
        "monthlyProvince": monthly_province,
        "districtsLatest": districts_latest,
        "subdistrictsLatest": subdistricts_latest,
        "topRainfallLatest": top_rainfall_latest,
        "droughtAttentionLatest": drought_attention_latest,
        "droughtConflictLatest": drought_conflict_latest,
        "qualitySummary": quality_summary.to_dict(orient="records"),
        "attentionFlagCounts": attention_counts,
        "resolutionRules": resolution_rules.to_dict(orient="records"),
        "droughtConflictSample": drought_conflicts.head(10).to_dict(orient="records"),
    }


def json_dump(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def compare_records(panel: pd.DataFrame, monthly_fixture: dict[str, Any]) -> dict[str, Any]:
    mismatches: list[dict[str, Any]] = []
    missing_in_fixture: list[str] = []
    extra_in_fixture: list[str] = []
    legend = monthly_fixture["irrigationLegend"]
    period_map = monthly_fixture["periods"]
    source_keys = set()
    fixture_keys = {
        (period, subdistrict_code)
        for period, records in period_map.items()
        for subdistrict_code in records
    }

    for _, row in panel.iterrows():
        key = (row["period"], row["subdistrictCode"])
        source_keys.add(key)
        packed = period_map.get(row["period"], {}).get(row["subdistrictCode"])
        if packed is None:
            missing_in_fixture.append(f"{key[0]}:{key[1]}")
            continue
        expected = {
            "rainfallMm": float(row["rainfallMm"]),
            "droughtRiskLevel": int(row["droughtRiskLevel"]),
            "droughtRiskConflict": bool(row["droughtRiskConflict"]),
            "irrigationStatus": row["irrigationStatus"],
            "websiteImportStatusReady": row["websiteImportStatus"] in {"READY", "READY_WITH_CONFLICT_FLAG"},
        }
        actual = {
            "rainfallMm": float(packed[0]),
            "droughtRiskLevel": int(packed[1]),
            "droughtRiskConflict": bool(packed[2]),
            "irrigationStatus": legend[int(packed[3])] if int(packed[3]) < len(legend) else "Unknown",
            "websiteImportStatusReady": bool(packed[4]),
        }
        bad_fields = []
        for field, expected_value in expected.items():
            actual_value = actual[field]
            if field == "rainfallMm":
                if not math.isclose(expected_value, actual_value, rel_tol=0, abs_tol=1e-9):
                    bad_fields.append(field)
            elif expected_value != actual_value:
                bad_fields.append(field)
        if bad_fields:
            mismatches.append(
                {
                    "period": key[0],
                    "subdistrictCode": key[1],
                    "badFields": bad_fields,
                    "expected": expected,
                    "actual": actual,
                }
            )

    for key in sorted(fixture_keys - source_keys):
        extra_in_fixture.append(f"{key[0]}:{key[1]}")

    return {
        "checkedRows": int(len(panel)),
        "periods": int(panel["period"].nunique()),
        "subdistricts": int(panel["subdistrictCode"].nunique()),
        "missingInFixture": missing_in_fixture[:20],
        "missingInFixtureCount": len(missing_in_fixture),
        "extraInFixture": extra_in_fixture[:20],
        "extraInFixtureCount": len(extra_in_fixture),
        "valueMismatchSamples": mismatches[:20],
        "valueMismatchCount": len(mismatches),
    }


def compare_summary(panel: pd.DataFrame, summary: dict[str, Any]) -> dict[str, Any]:
    expected = build_summary_fixture(panel, summary.get("meta", {}).get("generatedAt", ""))
    ignored_paths = {("meta", "generatedAt")}
    mismatches: list[dict[str, Any]] = []

    def walk(path: tuple[str, ...], left: Any, right: Any) -> None:
        if path in ignored_paths:
            return
        if isinstance(left, dict) and isinstance(right, dict):
            for key in sorted(set(left) | set(right)):
                walk((*path, str(key)), left.get(key), right.get(key))
            return
        if isinstance(left, list) and isinstance(right, list):
            if len(left) != len(right):
                mismatches.append({"path": ".".join(path), "expectedLength": len(left), "actualLength": len(right)})
                return
            for index, (left_item, right_item) in enumerate(zip(left, right)):
                walk((*path, str(index)), left_item, right_item)
            return
        if isinstance(left, (int, float)) and isinstance(right, (int, float)):
            if not math.isclose(float(left), float(right), rel_tol=0, abs_tol=1e-9):
                mismatches.append({"path": ".".join(path), "expected": left, "actual": right})
            return
        if left != right:
            mismatches.append({"path": ".".join(path), "expected": left, "actual": right})

    walk((), expected, summary)
    return {
        "summaryMismatchSamples": mismatches[:30],
        "summaryMismatchCount": len(mismatches),
    }


def compare_xlsx_sheet(panel: pd.DataFrame) -> dict[str, Any]:
    workbook_panel = pd.read_excel(NORMALIZED_XLSX, sheet_name="Monthly_Panel", dtype=str).fillna("")
    csv_as_text = pd.read_csv(MONTHLY_CSV, dtype=str).fillna("")
    common_cols = list(csv_as_text.columns)
    workbook_as_text = workbook_panel[common_cols].astype(str).fillna("")
    shape_matches = workbook_as_text.shape == csv_as_text.shape
    mismatches: list[dict[str, Any]] = []
    mismatch_count = -1

    def equivalent(left: str, right: str) -> bool:
        if left == right:
            return True
        if left == "" and right == "":
            return True
        try:
            return math.isclose(float(left), float(right), rel_tol=0, abs_tol=1e-9)
        except ValueError:
            return False

    if shape_matches:
        mismatch_count = 0
        for row_index in range(csv_as_text.shape[0]):
            for col_index, column in enumerate(common_cols):
                csv_value = csv_as_text.iat[row_index, col_index]
                xlsx_value = workbook_as_text.iat[row_index, col_index]
                if not equivalent(csv_value, xlsx_value):
                    mismatch_count += 1
                    if len(mismatches) < 20:
                        mismatches.append(
                            {
                                "row": int(row_index) + 2,
                                "column": column,
                                "csv": csv_value,
                                "xlsx": xlsx_value,
                            }
                        )
    return {
        "normalizedWorkbookMonthlyPanelShape": list(workbook_as_text.shape),
        "monthlyCsvShape": list(csv_as_text.shape),
        "shapeMatches": shape_matches,
        "cellMismatchCount": mismatch_count,
        "cellMismatchSamples": mismatches,
    }


def build_report(panel: pd.DataFrame) -> dict[str, Any]:
    monthly_fixture = load_json(MONTHLY_FIXTURE)
    summary_fixture = load_json(SUMMARY_FIXTURE)
    quality = pd.read_csv(QUALITY_CSV, dtype=str).fillna("")
    conflicts = pd.read_csv(DROUGHT_CONFLICTS_CSV, dtype=str).fillna("")
    attention = pd.read_csv(ATTENTION_FLAGS_CSV, dtype=str).fillna("")

    checks = {
        "areaAndPeriodCompleteness": {
            "districts": int(panel["districtCode"].nunique()),
            "subdistricts": int(panel["subdistrictCode"].nunique()),
            "periods": int(panel["period"].nunique()),
            "expectedRows": int(panel["subdistrictCode"].nunique() * panel["period"].nunique()),
            "actualRows": int(len(panel)),
            "complete": int(len(panel)) == int(panel["subdistrictCode"].nunique() * panel["period"].nunique()),
        },
        "monthlyFixture": compare_records(panel, monthly_fixture),
        "summaryFixture": compare_summary(panel, summary_fixture),
        "normalizedWorkbook": compare_xlsx_sheet(panel),
        "flaggedExceptions": {
            "droughtConflictRows": int(len(conflicts)),
            "droughtConflictRowsInPanel": int(panel["droughtRiskConflict"].sum()),
            "attentionFlagRows": int(len(attention)),
            "attentionFlagCounts": {
                str(key): int(value)
                for key, value in attention["flagType"].value_counts().sort_index().items()
            },
            "qualityMetrics": quality.to_dict(orient="records"),
        },
    }
    blocking_failures = []
    monthly_check = checks["monthlyFixture"]
    if (
        monthly_check["missingInFixtureCount"] > 0
        or monthly_check["extraInFixtureCount"] > 0
        or monthly_check["valueMismatchCount"] > 0
    ):
        blocking_failures.append("monthlyFixture")
    if checks["summaryFixture"]["summaryMismatchCount"] > 0:
        blocking_failures.append("summaryFixture")
    if not checks["areaAndPeriodCompleteness"]["complete"]:
        blocking_failures.append("areaAndPeriodCompleteness")
    if not checks["normalizedWorkbook"]["shapeMatches"] or checks["normalizedWorkbook"]["cellMismatchCount"] != 0:
        blocking_failures.append("normalizedWorkbook")

    return {
        "generatedAt": datetime.now(ZoneInfo("Asia/Bangkok")).replace(microsecond=0).isoformat(),
        "source": {
            "monthlyCsv": str(MONTHLY_CSV.relative_to(ROOT)),
            "normalizedWorkbook": str(NORMALIZED_XLSX.relative_to(ROOT)),
            "monthlyFixture": str(MONTHLY_FIXTURE.relative_to(ROOT)),
            "summaryFixture": str(SUMMARY_FIXTURE.relative_to(ROOT)),
        },
        "result": "pass" if not blocking_failures else "fail",
        "blockingFailures": blocking_failures,
        "checks": checks,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Regenerate JSON fixtures before reconciliation.")
    args = parser.parse_args()

    panel = read_monthly_panel()
    generated_at = datetime.now(ZoneInfo("Asia/Bangkok")).replace(microsecond=0).isoformat()
    if args.write:
        json_dump(MONTHLY_FIXTURE, build_monthly_fixture(panel, generated_at))
        json_dump(SUMMARY_FIXTURE, build_summary_fixture(panel, generated_at))

    report = build_report(panel)
    json_dump(REPORT_PATH, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report["result"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
