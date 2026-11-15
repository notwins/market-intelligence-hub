#!/usr/bin/env python3
"""Synthetic importer regression cases; contains no supplied source rows."""
import copy
import csv
import json
import tempfile
import unittest
from pathlib import Path

from import_equity_valuation_history import LISTINGS, build, number, parse_file


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
        for index, (_, ticker, currency, _) in enumerate(LISTINGS):
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

    def change_cells(self, rows, ticker, change):
        for row in rows:
            cells = json.loads(row["raw_cells_json"])
            if ticker in cells:
                change(cells)
                row["raw_cells_json"] = json.dumps(cells)
                return
        self.fail(f"Synthetic fixture is missing {ticker}")

    def remove_listing(self, rows, ticker):
        rows[:] = [row for row in rows if ticker not in json.loads(row["raw_cells_json"])]

    def test_missing_moat_keeps_fields_aligned(self):
        _, _, rows = parse_file(self.fixture())
        self.assertEqual(len(rows), len(LISTINGS))
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
            rows.append({"report_date_from_url": "2026-11-02", "source_page": "40", "page_row": "4",
                         "raw_text": "Synthetic four-cell description", "raw_cells_json": json.dumps(["Synthetic issuer", "USD", "META US", "Description only"])})
        self.assertEqual(len(parse_file(self.fixture(change=appendix))[2]), len(LISTINGS))

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
            self.change_cells(rows, "TSM US", lambda cells: cells.__setitem__(cells.index("TSM US") + 9, "0.0"))
        row = next(row for row in parse_file(self.fixture(change=zero_pb))[2] if row["symbol"] == "TSM")
        self.assertEqual(row["pb"], 0)
        self.assertEqual(row["source_values"]["pb"], "0.0")
        self.assertIn("pb_nonmeaningful_for_range", row["quality_flags"])

    def test_micron_nonmeaningful_pe_preserves_source_zero(self):
        def zero_pe(rows):
            self.change_cells(rows, "MU US", lambda cells: cells.__setitem__(cells.index("MU US") + 8, "0.0"))
        row = next(row for row in parse_file(self.fixture(change=zero_pe))[2] if row["symbol"] == "MU")
        self.assertEqual(row["pe"], 0)
        self.assertEqual(row["source_values"]["pe"], "0.0")
        self.assertIn("pe_nonmeaningful_for_range", row["quality_flags"])

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
            self.change_cells(rows, "TSM US", lambda cells: cells.__setitem__(cells.index("TSM US") + 3, "TWD"))
        with self.assertRaisesRegex(ValueError, "Listing/currency mismatch"):
            parse_file(self.fixture(change=wrong_currency))

    def test_missing_latest_listing_is_a_gap_not_an_older_substitute(self):
        earlier = self.fixture(report="2025-11-03", price="31-Oct")
        latest = self.fixture(change=lambda rows: self.remove_listing(rows, "META US"))
        data = build([latest, earlier])
        meta = next(item for item in data["listings"] if item["symbol"] == "META")
        self.assertEqual(data["coverage"]["observation_count"], 2 * len(LISTINGS) - 1)
        self.assertEqual(data["coverage"]["report_dates"], ["2025-11-03", "2026-11-02"])
        self.assertEqual(meta["observation_count"], 1)
        self.assertEqual(meta["report_dates"], ["2025-11-03"])
        self.assertEqual(meta["first_report_date"], "2025-11-03")
        self.assertEqual(meta["last_report_date"], "2025-11-03")
        self.assertEqual([item["report_date"] for item in meta["missing_editions"]], ["2026-11-02"])
        self.assertEqual(meta["missing_editions"][0]["reason"], "exact_source_ticker_unmatched")
        self.assertFalse(any(row["symbol"] == "META" and row["report_date"] == "2026-11-02" for row in data["observations"]))

    def test_historical_ticker_is_not_inferred_from_company_name(self):
        def historical_ticker(rows):
            self.change_cells(rows, "META US", lambda cells: cells.__setitem__(cells.index("META US"), "FB US"))
        path = self.fixture(report="2021-12-01", price="30-Nov", change=historical_ticker)
        data = build([path])
        meta = next(item for item in data["listings"] if item["symbol"] == "META")
        self.assertEqual(meta["observation_count"], 0)
        self.assertEqual(meta["report_dates"], [])
        self.assertIsNone(meta["first_report_date"])
        self.assertIsNone(meta["last_report_date"])
        self.assertEqual([item["report_date"] for item in meta["missing_editions"]], ["2021-12-01"])
        self.assertFalse(any(row["symbol"] == "META" for row in data["observations"]))
        self.assertNotIn("FB US", json.dumps(data))

    def test_truncated_valuation_row_is_not_silently_missing(self):
        def truncate(rows):
            self.change_cells(rows, "META US", lambda cells: cells.__delitem__(slice(4, None)))
        with self.assertRaisesRegex(ValueError, "Unsupported valuation row layout"):
            parse_file(self.fixture(change=truncate))

    def test_unknown_layout_is_rejected(self):
        def shifted(rows):
            self.change_cells(rows, "META US", lambda cells: cells.insert(cells.index("META US") + 1, "Unknown column"))
        with self.assertRaisesRegex(ValueError, "Unsupported valuation row layout"):
            parse_file(self.fixture(change=shifted))

    def test_same_ticker_twice_in_a_row_is_rejected(self):
        def duplicate_ticker(rows):
            self.change_cells(rows, "META US", lambda cells: cells.__setitem__(0, "META US"))
        with self.assertRaisesRegex(ValueError, "Unsupported valuation row layout"):
            parse_file(self.fixture(change=duplicate_ticker))

    def test_edition_without_any_supported_rows_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "No supported valuation rows"):
            parse_file(self.fixture(change=lambda rows: rows.__delitem__(slice(2, None))))

    def test_coverage_counts_and_dates_reconcile_per_listing(self):
        data = build([self.fixture()])
        self.assertEqual(data["coverage"]["listing_count"], len(LISTINGS))
        for listing in data["listings"]:
            self.assertEqual(listing["observation_count"], 1)
            self.assertEqual(listing["report_dates"], ["2026-11-02"])
            self.assertEqual(listing["first_report_date"], "2026-11-02")
            self.assertEqual(listing["last_report_date"], "2026-11-02")
            self.assertEqual(listing["missing_editions"], [])

    def test_missing_forward_heading_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Missing price date or forward-estimate heading"):
            parse_file(self.fixture(change=lambda rows: rows.__delitem__(0)))

    def test_conflicting_price_dates_are_rejected(self):
        def conflicting(rows):
            row = copy.deepcopy(rows[1])
            row["raw_text"] = "Company Name Ticker Cncy 29-Oct P/E P/B"
            rows.insert(2, row)
        with self.assertRaisesRegex(ValueError, "Conflicting price dates"):
            parse_file(self.fixture(change=conflicting))


if __name__ == "__main__":
    unittest.main()
