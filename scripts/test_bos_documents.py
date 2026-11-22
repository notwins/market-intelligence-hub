import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import update_bos_documents as docs


class PublisherLinksTests(unittest.TestCase):
    def test_dated_data_and_business_day_fallback(self):
        sunday = dt.date(2026, 11, 22)
        self.assertEqual([day.day for day in docs.days(sunday, 2)], [22, 20, 19])
        text = "OCBC Credit Research List\nSources: Bloomberg, OCBC\nISIN Bid Ask\nSGXF71436269 Singapore\n20 Nov 2026"
        self.assertTrue(docs.bond_has_data(text, "credit", dt.date(2026, 11, 20)))
        self.assertFalse(docs.bond_has_data(text, "credit", sunday))
        self.assertFalse(docs.bond_has_data(text.replace("SGXF71436269", ""), "credit", sunday.replace(day=20)))
        self.assertFalse(docs.bond_has_data(text, "bonds", sunday.replace(day=20)))

    def test_company_report_uses_contents_and_exact_share_class(self):
        url = docs.HOST + "apollo/assets/reports/morningstar/apollo/2026/Nov/AMD_20261109_RT.pdf"
        page = "Morningstar Equity Analyst Report | Report as of 10 Nov 2026 00:09, UTC | Reporting Currency: USD Page 1 of 24\nAdvanced Micro Devices Inc AMD QQQ\nLast Price"
        with patch.object(docs, "download", return_value=b"pdf") as download, patch.object(docs, "first_page", return_value=page):
            self.assertEqual(docs.report_details(url, dt.date(2026, 11, 20), "AMD")["report_date"], "2026-11-10")
            with self.assertRaises(ValueError):
                docs.report_details(url, dt.date(2026, 11, 20), "AAPL")
            with self.assertRaises(ValueError):
                docs.report_details("file:///wrong.pdf", dt.date(2026, 11, 20), "AMD")
            self.assertEqual(download.call_count, 2)

    def test_missing_company_uses_last_linked_edition_and_repeat_is_identical(self):
        friday = dt.date(2026, 11, 20)
        thursday = friday - dt.timedelta(days=1)
        def download(url):
            return url.encode() if any(token in url for token in ("2026-11-20", "2026-11-19", "20_Nov")) else None
        def rows(data, day, *args):
            return {"AAPL US": "apple", "GOOGL US": None if day == friday else "alphabet"}
        def report(url, day, ticker):
            return {"url":url, "report_date":"2026-11-03", "edition":day.isoformat()}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "bos").mkdir()
            (root / "bos/manifest.json").write_text(json.dumps({"editions":[]}))
            with patch.object(docs, "LISTINGS", {"GOOGL":"GOOGL US", "AAPL":"AAPL US"}), \
                    patch.object(docs, "download", side_effect=download), patch.object(docs, "equity_rows", side_effect=rows), \
                    patch.object(docs, "first_page", return_value="fixture"), patch.object(docs, "bond_has_data", return_value=True), \
                    patch.object(docs, "report_details", side_effect=report):
                data = docs.refresh(root, friday + dt.timedelta(days=2))
                self.assertEqual(data["reports"]["GOOGL"]["edition"], thursday.isoformat())
                self.assertEqual(data["documents"]["credit"]["date"], friday.isoformat())
                with patch.object(docs.feed, "atomic_manifest", side_effect=AssertionError("unexpected write")):
                    self.assertEqual(docs.refresh(root, friday + dt.timedelta(days=2)), data)
