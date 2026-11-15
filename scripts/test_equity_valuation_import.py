#!/usr/bin/env python3
"""Synthetic importer regression cases; contains no supplied source rows."""
import copy
import csv
import json
import tempfile
import unittest
from pathlib import Path

from import_equity_valuation_history import PILOTS, build, number, parse_file


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)

    def fixture(self, report="2026-11-02", price="30-Oct", change=None):
        rows = [
            {"report_date_from_url": report, "source_page": "3", "page_row": "2",
             "raw_text": "Market Current Consensus Forward Estimates YTD Date", "raw_cells_json": "[]"},
            {"report_date_from_url": report, "source_page": "3", "page_row": "4",
             "raw_text": f"Company Name Moat Ticker Cap Cncy {price} Price P/E P/B", "raw_cells_json": "[]"},
        ]
        for index, (_, ticker, currency, _) in enumerate(PILOTS):
            cells = ["Synthetic issuer"] + (["✓✓"] if index % 2 else []) + [
                ticker, "1,234.5", "Hold", currency, "100.25", "120.00", "19.7", "0.0",
                "12.5", "1.5", "(12)", "15", "3", "10", "-", "Oct-26", "test"]
            rows.append({"report_date_from_url": report, "source_page": "3", "page_row": str(index + 9),
                         "raw_text": "Synthetic numerical test row", "raw_cells_json": json.dumps(cells)})
        if change:
            change(rows)
        path = Path(self.directory.name) / f"{report}.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
        return path

    def test_missing_moat_keeps_fields_aligned(self):
        _, _, rows = parse_file(self.fixture())
        self.assertEqual(len(rows), 6)
        for row in rows:
            self.assertEqual(row["price"], 100.25)
            self.assertEqual(row["pe"], 12.5)
            self.assertEqual(row["pb"], 1.5)
            self.assertEqual(row["eps_growth_pct"], -12)
            self.assertEqual(row["market_cap_usd_bn"], 1234.5)
            self.assertEqual(row["source_values"]["dividend_yield_pct"], "0.0")

    def test_description_appendix_is_ignored(self):
        def appendix(rows):
            rows.append({"report_date_from_url": "2026-11-02", "source_page": "40", "page_row": "3",
                         "raw_text": "Synthetic description appendix", "raw_cells_json": json.dumps(["DBS SP", "Synthetic description"])})
        self.assertEqual(len(parse_file(self.fixture(change=appendix))[2]), 6)

    def test_duplicate_valuation_row_is_rejected(self):
        def duplicate(rows):
            row = copy.deepcopy(rows[2])
            row["page_row"] = "50"
            rows.append(row)
        with self.assertRaisesRegex(ValueError, "Expected one exact row"):
            parse_file(self.fixture(change=duplicate))

    def test_missing_negative_and_zero_numbers_remain_distinct(self):
        self.assertEqual(number("(12.50)"), -12.5)
        self.assertEqual(number("-7"), -7)
        self.assertEqual(number("0.0"), 0)
        self.assertEqual(number("1,234.5"), 1234.5)
        for missing in ["", "NA", "N/A", "N.M.", "-"]:
            self.assertIsNone(number(missing))
        for invalid in ["NaN", "Infinity", "12x"]:
            with self.assertRaises(ValueError):
                number(invalid)

    def test_nonmeaningful_ratio_preserves_source_zero(self):
        def zero_pb(rows):
            cells = json.loads(rows[-1]["raw_cells_json"])
            cells[cells.index("TSM US") + 9] = "0.0"
            rows[-1]["raw_cells_json"] = json.dumps(cells)
        row = next(row for row in parse_file(self.fixture(change=zero_pb))[2] if row["symbol"] == "TSM")
        self.assertEqual(row["pb"], 0)
        self.assertEqual(row["source_values"]["pb"], "0.0")
        self.assertIn("pb_nonmeaningful_for_range", row["quality_flags"])

    def test_duplicate_report_is_rejected(self):
        path = self.fixture()
        with self.assertRaisesRegex(ValueError, "Duplicate report edition"):
            build([path, path])

    def test_report_and_price_dates_are_independent(self):
        report, source, rows = parse_file(self.fixture())
        self.assertEqual(report, "2026-11-02")
        self.assertEqual(source["price_dates"], ["2026-10-30"])
        self.assertTrue(all(row["price_date"] == "2026-10-30" for row in rows))
        report, _, rows = parse_file(self.fixture(report="2027-01-04", price="31-Dec"))
        self.assertEqual(report, "2027-01-04")
        self.assertTrue(all(row["price_date"] == "2026-12-31" for row in rows))

    def test_future_observation_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Price observation follows"):
            parse_file(self.fixture(report="2026-11-02", price="03-Nov"))

    def test_wrong_listing_currency_is_rejected(self):
        def wrong_currency(rows):
            cells = json.loads(rows[-1]["raw_cells_json"])
            cells[cells.index("TSM US") + 3] = "TWD"
            rows[-1]["raw_cells_json"] = json.dumps(cells)
        with self.assertRaisesRegex(ValueError, "Listing/currency mismatch"):
            parse_file(self.fixture(change=wrong_currency))


if __name__ == "__main__":
    unittest.main()
