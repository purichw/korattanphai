import importlib.util
import unittest
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "scripts/normalize-drought-rev03.py"
SPEC = importlib.util.spec_from_file_location("normalize_rev03", PATH)
normalizer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(normalizer)


def row(**changes):
    values = {"year": 2025, "month": 12, "source_id": 0, "tambon": "Nai Mueang",
              "district": "Mueang Nakhon Ratchasima", "irrigation": "Collecting", "risks": [0, 1, 2, None, "", 0]}
    values.update(changes)
    return tuple(values[k] for k in ("year", "month", "source_id", "tambon", "district", "irrigation")) + tuple(values["risks"])


class NormalizeRev03Tests(unittest.TestCase):
    def test_forward_calendar_months(self):
        self.assertEqual([normalizer.target_month("2025-12", h) for h in range(1, 7)],
                         [f"2026-{m:02d}" for m in range(1, 7)])
        self.assertEqual(normalizer.target_month("2015-06", 1), "2015-07")
        self.assertEqual(normalizer.target_month("2015-06", 6), "2015-12")
        self.assertEqual(normalizer.target_month("2024-01", 1), "2024-02")

    def test_zero_id_and_blank_are_preserved(self):
        unique, locations, lineage, quality = normalizer.normalize_rows([(2, row())])
        self.assertEqual(unique[("2025-12", "0")]["risks"], [0, 1, 2, None, None, 0])
        self.assertIn("0", locations)
        self.assertEqual(lineage[0]["source_row"], 2)
        self.assertEqual(quality["exact_unique_rows"], 1)

    def test_exact_duplicates_have_auditable_lineage(self):
        unique, _, lineage, quality = normalizer.normalize_rows([(2, row()), (3, row())])
        self.assertEqual(unique[("2025-12", "0")]["source_row_count"], 2)
        self.assertEqual([item["retained_source_row"] for item in lineage], [2, 2])
        self.assertEqual(quality["exact_duplicates_removed"], 1)

    def test_conflicting_duplicate_is_not_silently_overwritten(self):
        with self.assertRaisesRegex(ValueError, "conflicting duplicate"):
            normalizer.normalize_rows([(2, row()), (3, row(risks=[1] * 6))])

    def test_irrigation_is_independent_of_risk(self):
        for status in ("Collecting", "RainFed", "Irrigation", "Irragation"):
            with self.subTest(status=status):
                unique, _, _, _ = normalizer.normalize_rows([(2, row(irrigation=status, risks=[2] * 6))])
                self.assertEqual(unique[("2025-12", "0")]["risks"], [2] * 6)
        self.assertEqual(normalizer.irrigation_status("Irragation"), "Irrigation")
        with self.assertRaises(ValueError):
            normalizer.irrigation_status(None)

    def test_changing_location_metadata_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "changing location"):
            normalizer.normalize_rows([(2, row()), (3, row(month=11, irrigation="RainFed"))])

    def test_invalid_risks_are_not_truncated_or_coerced(self):
        for value in (True, False, 1.5, -1, 3, "1", "#N/A", "=1+1", "unknown"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalizer.risk_value(value)

    def test_invalid_dates_and_horizons_are_rejected(self):
        for values in ({"month": 0}, {"month": 13}, {"year": 2568}, {"year": 2025.5}, {"source_id": -1}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                normalizer.normalize_rows([(2, row(**values))])
        for horizon in (0, 7, 1.5, True):
            with self.subTest(horizon=horizon), self.assertRaises(ValueError):
                normalizer.target_month("2025-12", horizon)

    def test_missing_months_or_locations_do_not_become_blank_risks(self):
        for source in ([(2, row(month=10)), (3, row())],
                       [(2, row(month=11)), (3, row()), (4, row(source_id=1))]):
            with self.subTest(source=source), self.assertRaisesRegex(ValueError, "Incomplete"):
                normalizer.normalize_rows(source)


if __name__ == "__main__":
    unittest.main()
