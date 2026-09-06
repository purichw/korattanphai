#!/usr/bin/env python3
"""Independently reconcile normalized CSV/JSON against raw rev03 Excel XML."""
import argparse
import csv
import hashlib
import json
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from zipfile import ZipFile

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def xml_rows(workbook):
    with ZipFile(workbook) as archive:
        sheets = ET.fromstring(archive.read("xl/workbook.xml")).findall("s:sheets/s:sheet", NS)
        assert len(sheets) == 1 and sheets[0].get("name") == "Master_Data_Drought_Final"
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_id = sheets[0].get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        target = next(row.get("Target") for row in relationships if row.get("Id") == rel_id)
        sheet_path = target.lstrip("/") if target.startswith("/") else "xl/" + target
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ["".join(node.itertext()) for node in ET.fromstring(archive.read("xl/sharedStrings.xml"))]
        root = ET.fromstring(archive.read(sheet_path))
        assert not root.findall(".//s:f", NS), "Unexpected source formulas"
        for row in root.findall("s:sheetData/s:row", NS):
            cells = {}
            for cell in row.findall("s:c", NS):
                assert cell.get("t") != "e", "Source error cell"
                column = "".join(c for c in cell.get("r") if c.isalpha())
                value = cell.findtext("s:v", default="", namespaces=NS)
                if cell.get("t") == "s":
                    value = strings[int(value)]
                elif cell.get("t") == "inlineStr":
                    value = "".join(cell.find("s:is", NS).itertext())
                cells[column] = value
            yield int(row.get("r")), cells


def forward_month(year, month, horizon):
    # Separate calendar implementation from the normalizer's month-index arithmetic.
    current = date(year, month, 1)
    for _ in range(horizon):
        current = date(current.year + 1, 1, 1) if current.month == 12 else date(current.year, current.month + 1, 1)
    return current.strftime("%Y-%m")


def verify(workbook, output, report_path, runtime_path=None):
    if report_path.exists():
        raise ValueError("Verification report already exists; choose a new report path")
    manifest = json.loads((output / "manifest.json").read_text())
    assert sha256(workbook) == manifest["source_sha256"]
    assert manifest["forecast_primary_key"] == ["dataset_id", "source_id", "source_month", "horizon_months"]
    assert manifest["source_month_role"] == "forecast_origin_month"
    assert manifest["target_month_rule"] == "source_month + horizon_months"
    for name, expected in manifest["files"].items():
        assert sha256(output / name) == expected["sha256"], name
        assert (output / name).stat().st_size == expected["bytes"], name
    rows = read_csv(output / "forecast_values.csv")
    values = {(r["source_id"], r["source_month"], int(r["horizon_months"])): r for r in rows}
    assert len(values) == len(rows), "Duplicate normalized forecast key"
    location_rows = read_csv(output / "locations.csv")
    locations = {r["source_id"]: r for r in location_rows}
    assert len(locations) == len(location_rows)
    lineage_rows = read_csv(output / "source_row_lineage.csv")
    lineage = {int(r["source_row"]): r for r in lineage_rows}
    assert len(lineage) == len(lineage_rows)
    packed = json.loads((output / "forecast_archive.json").read_text())
    runtime = json.loads(runtime_path.read_text()) if runtime_path else None
    runtime_locations = {r["sourceId"]: r for r in runtime["locations"]} if runtime else {}
    if runtime:
        assert runtime["meta"]["sourceWorkbookSha256"] == sha256(workbook)
        assert runtime["meta"]["temporalInterpretation"] == "SOURCE_YEARMONTH_IS_ORIGIN_MONTH"
        assert len(runtime_locations) == len(locations) == len(runtime["locations"])
        assert len({r["subdistrictCode"] for r in runtime_locations.values()}) == len(locations)
        assert runtime_locations["5"]["subdistrictCode"] == "300106"
        assert runtime_locations["222"]["subdistrictCode"] == "301512"
        assert runtime_locations["222"]["sourceAmphoeEnCorrected"] == "Phimai"
        assert set(runtime["packedRiskByTargetMonth"]) == set(packed["sourceMonths"])
    assert packed["locations"] == location_rows
    assert packed["meta"]["source_sha256"] == sha256(workbook)
    first_rows, occurrence_counts, seen_keys, cells_verified = {}, Counter(), set(), 0
    raw_row_count, source_ids, source_periods = 0, set(), set()
    for number, cells in xml_rows(workbook):
        if number == 1:
            assert [cells.get(c, "") for c in "ABCDEFGHIJKL"] == [
                "Year", "Month", "ID", "TAMBON_E", "AMPHOE_E", "Irrigation_Status",
                *[f"Pred_Risk_T+{h}" for h in range(1, 7)]]
            continue
        year, month = int(cells["A"]), int(cells["B"])
        source_id, period = str(int(cells["C"])), f"{year:04d}-{month:02d}"
        source_ids.add(source_id)
        source_periods.add(period)
        key = (source_id, period)
        raw_row_count += 1
        occurrence_counts[key] += 1
        raw_tuple = tuple(cells.get(c, "") for c in "ABCDEFGHIJKL")
        if key in first_rows:
            assert first_rows[key][1] == raw_tuple, "Conflicting original rows"
        else:
            first_rows[key] = (number, raw_tuple)
        source_lineage = lineage[number]
        assert (source_lineage["source_id"], source_lineage["source_month"]) == key
        assert int(source_lineage["retained_source_row"]) == first_rows[key][0]
        location = locations[source_id]
        assert location["source_tambon_en"] == cells["D"]
        assert location["source_amphoe_en"] == cells["E"]
        assert location["irrigation_status_raw"] == cells["F"]
        expected_irrigation = "Irrigation" if cells["F"] == "Irragation" else cells["F"]
        assert location["irrigation_status"] == expected_irrigation
        if runtime:
            mapped = runtime_locations[source_id]
            assert mapped["sourceTambonEn"] == cells["D"]
            assert mapped["sourceAmphoeEn"] == cells["E"]
            assert mapped["irrigationStatusRaw"] == cells["F"]
            assert mapped["irrigationStatus"] == expected_irrigation
        for horizon, column in enumerate("GHIJKL", 1):
            raw_risk = cells.get(column, "")
            assert raw_risk in ("", "0", "1", "2")
            risk = None if raw_risk == "" else int(raw_risk)
            forecast_key = (*key, horizon)
            actual = values[forecast_key]
            seen_keys.add(forecast_key)
            assert actual["risk_value"] == raw_risk, (number, column)
            assert actual["scope_status"] == ("out_of_scope" if risk is None else "in_scope")
            assert actual["target_month"] == forward_month(year, month, horizon)
            assert int(actual["source_first_row"]) == first_rows[key][0]
            assert packed["packedRiskBySourceMonth"][period][source_id][horizon - 1] == risk
            if runtime:
                assert runtime["packedRiskByTargetMonth"][period][mapped["subdistrictCode"]][horizon - 1] == risk, (number, column, "runtime")
            cells_verified += 1
    assert seen_keys == set(values), "Unexpected or missing forecast keys"
    assert raw_row_count == len(lineage)
    assert source_ids == set(locations)
    assert sorted(source_periods) == packed["sourceMonths"] == sorted(packed["packedRiskBySourceMonth"])
    for month in packed["sourceMonths"]:
        assert set(packed["packedRiskBySourceMonth"][month]) == source_ids
        assert all(len(risks) == 6 for risks in packed["packedRiskBySourceMonth"][month].values())
        if runtime:
            assert set(runtime["packedRiskByTargetMonth"][month]) == {r["subdistrictCode"] for r in runtime_locations.values()}
            assert all(len(risks) == 6 for risks in runtime["packedRiskByTargetMonth"][month].values())
    for r in rows:
        assert int(r["source_row_count"]) == occurrence_counts[(r["source_id"], r["source_month"])]
    counts = Counter((r["source_month"], int(r["horizon_months"]), r["risk_value"]) for r in rows)
    run_rows = read_csv(output / "forecast_runs.csv")
    assert len(run_rows) == len(source_periods) * 6
    assert len({(r["source_month"], r["horizon_months"]) for r in run_rows}) == len(run_rows)
    for row, packed_run in zip(run_rows, packed["runs"], strict=True):
        period, horizon = row["source_month"], int(row["horizon_months"])
        for field, risk in (("out_of_scope_count", ""), ("no_signal_count", "0"), ("moderate_count", "1"), ("high_count", "2")):
            assert int(row[field]) == counts[(period, horizon, risk)]
        assert int(row["record_count"]) == len(source_ids)
        assert int(row["in_scope_count"]) == sum(counts[(period, horizon, str(v))] for v in range(3))
        assert row["target_month"] == forward_month(int(period[:4]), int(period[5:]), horizon)
        assert {key: str(value) for key, value in packed_run.items()} == row
        if runtime:
            target = next(m for m in runtime["targetMonths"] if m["period"] == period)["horizons"][horizon - 1]
            assert target["issueMonth"] == period
            assert target["targetMonth"] == row["target_month"]
            assert target["horizon"] == horizon
            for field, csv_field in (("noRiskSubdistricts", "no_signal_count"), ("moderateRiskSubdistricts", "moderate_count"),
                                     ("highRiskSubdistricts", "high_count"), ("outOfScopeSubdistricts", "out_of_scope_count")):
                assert target[field] == int(row[csv_field])
    quality = json.loads((output / "data_quality.json").read_text())
    assert quality["source_rows"] == raw_row_count
    assert quality["exact_unique_rows"] == len(first_rows)
    assert quality["exact_duplicates_removed"] == raw_row_count - len(first_rows)
    assert quality["forecast_value_count"] == len(rows)
    assert quality["normalized_risk_counts"] == dict(Counter("null" if r["risk_value"] == "" else r["risk_value"] for r in rows))
    assert quality["irrigation_location_counts"] == dict(Counter(r["irrigation_status"] for r in location_rows))
    report = {"verified_at": datetime.now(timezone.utc).isoformat(), "source_sha256": sha256(workbook),
              "manifest_sha256": sha256(output / "manifest.json"), "result": "passed",
              "independent_reader": "Python standard-library ZIP/XML; no normalizer imports",
              "source_rows_checked": raw_row_count, "source_risk_cells_checked_including_duplicates": cells_verified,
              "normalized_forecast_rows_checked": len(rows), "location_rows_checked": len(locations),
              "forecast_runs_checked": len(run_rows), "lineage_rows_checked": len(lineage),
              "duplicate_keys_or_value_mismatches": 0, "external_datasets_used": 0}
    if runtime:
        report["runtime_sha256"] = sha256(runtime_path)
        report["runtime_values_checked_against_original_cells"] = cells_verified
        report["mapping_correction"] = "ID 222 -> Phimai confirmed by user; original fields preserved"
    with report_path.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--runtime", type=Path)
    args = parser.parse_args()
    verify(args.workbook, args.output_dir, args.report, args.runtime)
