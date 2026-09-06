"""Read the verified, numeric-only lineage CSV with the standard CSV parser."""
import csv
import json
import sys
from pathlib import Path

directory = Path(__file__).resolve().parents[1] / "data/normalized/drought-rev03"
lineage = {}
with (directory / "source_row_lineage.csv").open(encoding="utf-8-sig", newline="") as stream:
    for row in csv.DictReader(stream):
        key = (row["source_month"], row["source_id"])
        item = lineage.setdefault(key, [int(row["retained_source_row"]), 0])
        assert item[0] == int(row["retained_source_row"])
        item[1] += 1
result = {}
for (month, source_id), item in lineage.items():
    result.setdefault(month, {})[source_id] = item
json.dump(result, sys.stdout, separators=(",", ":"))
