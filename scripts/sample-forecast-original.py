"""Stratified random sampling directly from original Excel XML, not normalized risks."""
import argparse
import importlib.util
import json
import random
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("workbook", type=Path)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--seed", type=int, default=20260906)
args = parser.parse_args()
spec = importlib.util.spec_from_file_location("independent_xml", Path(__file__).with_name("verify-drought-rev03.py"))
xml = importlib.util.module_from_spec(spec)
spec.loader.exec_module(xml)
assert xml.sha256(args.workbook) == "a3be44486c8e8039f5744674e261ee9b27306f0c78b46bd1ce62e8903d4915b4"
runtime_path = Path(__file__).resolve().parents[1] / "src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json"
locations = {l["sourceId"]: l for l in json.loads(runtime_path.read_text())["locations"]}
buckets = {(risk, h): [] for risk in (0, 1, 2, None) for h in range(1, 7)}
seen = set()
for row, cells in xml.xml_rows(args.workbook):
    if row == 1:
        continue
    year, month, source_id = int(cells["A"]), int(cells["B"]), str(int(cells["C"]))
    period = f"{year:04d}-{month:02d}"
    key = (source_id, period)
    if key in seen:
        continue
    seen.add(key)
    location = locations[source_id]
    assert cells["D"] == location["sourceTambonEn"] and cells["E"] == location["sourceAmphoeEn"]
    for horizon, column in enumerate("GHIJKL", 1):
        raw = cells.get(column, "")
        risk = int(raw) if raw else None
        buckets[(risk, horizon)].append({
            "source_id": source_id, "source_month": period, "horizon": horizon,
            "target_month": xml.forward_month(year, month, horizon),
            "source_row": row, "source_cell": f"{column}{row}", "source_column": f"Pred_Risk_T+{horizon}",
            "original_value": raw, "risk_value": risk,
            "original_tambon": cells["D"], "original_amphoe": cells["E"], "original_irrigation": cells["F"],
            "subdistrict_code": location["subdistrictCode"], "subdistrict_th": location["subdistrictNameTh"],
            "district_th": location["districtNameTh"],
        })
rng = random.Random(args.seed)
samples = [rng.choice(buckets[(risk, h)]) for risk in (0, 1, 2, None) for h in range(1, 7)]
report = {"seed": args.seed, "method": "One original Excel cell sampled for each risk value x horizon stratum; exact duplicate rows sampled once",
          "source_workbook": args.workbook.name, "source_sha256": xml.sha256(args.workbook),
          "source_sheet": "Master_Data_Drought_Final", "sample_count": len(samples), "samples": samples}
with args.output.open("x", encoding="utf-8") as stream:
    json.dump(report, stream, ensure_ascii=False, indent=2)
    stream.write("\n")
print(json.dumps({"output": str(args.output), "count": len(samples), "seed": args.seed}))
